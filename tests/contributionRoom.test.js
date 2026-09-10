import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('contribution room is member-scoped and calculates room without restoring withdrawals', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-contribution-room-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  process.env.DB_PATH = join(directory, 'portfolio.db')
  process.env.BACKUP_DIR = join(directory, 'backups')

  const dbModule = await import('../server/db.js')
  const { stmtGet, stmtRun, saveNow } = dbModule
  const contributionRoomRouter = (await import('../server/routes/contributionRoom.js')).default
  const primary = stmtGet('SELECT * FROM household_members WHERE is_primary = 1')
  const partnerId = stmtRun(
    "INSERT INTO household_members (name, color) VALUES ('Partner', '#22c55e')"
  ).lastInsertRowid
  assert.equal(stmtGet('PRAGMA user_version').user_version, 5)

  const app = express()
  app.use(express.json())
  app.use('/api/contribution-room', contributionRoomRouter)
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/contribution-room`
  const year = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric',
  }).format(new Date()))
  const entryDate = `${year}-01-10`

  const roomResponse = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_scope: `member:${primary.id}`, account_type: 'TFSA', label: 'TFSA room',
      year, currency: 'CAD', opening_room: 7000, note: 'Opening amount from records',
    }),
  })
  assert.equal(roomResponse.status, 201)
  const room = await roomResponse.json()

  const duplicate = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_scope: `member:${primary.id}`, account_type: 'TFSA', label: 'Duplicate',
      year, currency: 'CAD', opening_room: 1,
    }),
  })
  assert.equal(duplicate.status, 409)

  const shared = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_scope: 'shared', account_type: 'RRSP', label: 'Shared room',
      year, currency: 'CAD', opening_room: 100,
    }),
  })
  assert.equal(shared.status, 400)

  for (const entry of [
    { entry_type: 'contribution', amount: 2000, entry_date: entryDate, note: 'Deposit' },
    { entry_type: 'withdrawal', amount: 500, entry_date: entryDate, note: 'Withdrawal' },
    { entry_type: 'adjustment', amount: 250, entry_date: entryDate, note: 'Correction' },
  ]) {
    const response = await fetch(`${base}/${room.id}/entries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    })
    assert.equal(response.status, 201)
  }

  const primaryData = await fetch(`${base}?scope=member:${primary.id}`).then((response) => response.json())
  assert.equal(primaryData.items.length, 1)
  assert.equal(primaryData.items[0].available_room, 7250)
  assert.equal(primaryData.items[0].contributed, 2000)
  assert.equal(primaryData.items[0].withdrawn, 500)
  assert.equal(primaryData.items[0].remaining, 5250)
  assert.equal(primaryData.items[0].used_percent, 27.59)

  const partnerData = await fetch(`${base}?scope=member:${partnerId}`).then((response) => response.json())
  assert.equal(partnerData.items.length, 0)
  const sharedData = await fetch(`${base}?scope=shared`).then((response) => response.json())
  assert.deepEqual(sharedData.items, [])

  const yearChange = await fetch(`${base}/${room.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_scope: `member:${primary.id}`, account_type: 'TFSA', label: 'TFSA room',
      year: year + 1, currency: 'CAD', opening_room: 7000,
    }),
  })
  assert.equal(yearChange.status, 400)

  const currencyChange = await fetch(`${base}/${room.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_scope: `member:${primary.id}`, account_type: 'TFSA', label: 'TFSA room',
      year, currency: 'USD', opening_room: 7000,
    }),
  })
  assert.equal(currencyChange.status, 400)

  await fetch(`${base}/${room.id}/entries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_type: 'contribution', amount: 6000, entry_date: entryDate }),
  })
  const householdData = await fetch(`${base}?scope=household`).then((response) => response.json())
  assert.equal(householdData.items[0].remaining, -750)
  assert.equal(householdData.items[0].over_contribution, 750)
  assert.equal(householdData.totals_by_currency[0].over_contribution, 750)

  saveNow()
})
