import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('properties track household-scoped equity, appreciation, and editable history locally', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-properties-'))
  process.env.DB_PATH = join(directory, 'portfolio.db')
  process.env.BACKUP_DIR = join(directory, 'backups')

  const dbModule = await import('../server/db.js')
  const { stmtGet, stmtRun, saveNow } = dbModule
  const propertiesRouter = (await import('../server/routes/properties.js')).default
  const primary = stmtGet('SELECT * FROM household_members WHERE is_primary = 1')
  const partnerId = stmtRun(
    "INSERT INTO household_members (name, color) VALUES ('Partner', '#22c55e')"
  ).lastInsertRowid

  assert.equal(stmtGet('PRAGMA user_version').user_version, 5)
  assert.ok(stmtGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'properties'"))
  assert.ok(stmtGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'property_snapshots'"))

  const app = express()
  app.use(express.json())
  app.use('/api/properties', propertiesRouter)
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  t.after(async () => {
    saveNow()
    await new Promise((resolve) => server.close(resolve))
    rmSync(directory, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}`

  async function request(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    return { response, data }
  }

  const homeInput = {
    owner_scope: `member:${primary.id}`,
    label: 'Primary Home',
    address: 'Toronto, ON',
    currency: 'CAD',
    purchase_price: 600000,
    purchase_date: '2020-01-15',
    valuation_date: '2026-09-01',
    estimated_value: 800000,
    mortgage_balance: 500000,
    source_label: 'HouseSigma',
    source_url: 'https://housesigma.com/',
    note: 'Initial estimate',
  }
  const created = await request('/api/properties', { method: 'POST', body: homeInput })
  assert.equal(created.response.status, 201)
  assert.equal(created.data.owner_name, 'Primary')
  assert.equal(created.data.equity, 300000)
  assert.equal(created.data.appreciation, 200000)
  assert.equal(created.data.appreciation_percent, 33.33)
  const homeId = created.data.id

  const sameDay = await request(`/api/properties/${homeId}/snapshots`, {
    method: 'POST',
    body: { ...homeInput, estimated_value: 810000, mortgage_balance: 490000 },
  })
  assert.equal(sameDay.response.status, 200)
  assert.equal(sameDay.data.corrected, true)
  assert.equal(stmtGet('SELECT COUNT(*) AS value FROM property_snapshots WHERE property_id = ?', [homeId]).value, 1)

  const second = await request(`/api/properties/${homeId}/snapshots`, {
    method: 'POST',
    body: {
      valuation_date: '2026-09-05', estimated_value: 825000, mortgage_balance: 475000,
      source_label: 'Manual appraisal', source_url: '', note: 'Updated locally',
    },
  })
  assert.equal(second.response.status, 201)
  const secondId = second.data.snapshot.id

  const history = await request(`/api/properties/${homeId}/history?scope=member:${primary.id}`)
  assert.deepEqual(history.data.data.map((row) => row.valuation_date), ['2026-09-01', '2026-09-05'])
  assert.equal(history.data.data[1].equity, 350000)

  const editedSnapshot = await request(`/api/properties/${homeId}/snapshots/${secondId}`, {
    method: 'PUT',
    body: {
      valuation_date: '2026-09-06', estimated_value: 830000, mortgage_balance: 470000,
      source_label: 'Appraisal', source_url: 'https://example.com/value', note: 'Corrected',
    },
  })
  assert.equal(editedSnapshot.response.status, 200)
  assert.equal(editedSnapshot.data.equity, 360000)

  const shared = await request('/api/properties', {
    method: 'POST',
    body: {
      ...homeInput, owner_scope: 'shared', label: 'Underwater Rental', purchase_price: 500000,
      estimated_value: 400000, mortgage_balance: 450000, valuation_date: '2026-09-02',
    },
  })
  assert.equal(shared.data.equity, -50000)
  assert.equal(shared.data.appreciation, -100000)

  const partner = await request('/api/properties', {
    method: 'POST',
    body: {
      ...homeInput, owner_scope: `member:${partnerId}`, label: 'Partner Condo', purchase_price: 300000,
      estimated_value: 350000, mortgage_balance: 200000, valuation_date: '2026-09-03',
    },
  })

  const primaryList = await request(`/api/properties?scope=member:${primary.id}`)
  const sharedList = await request('/api/properties?scope=shared')
  const partnerList = await request(`/api/properties?scope=member:${partnerId}`)
  const combinedList = await request('/api/properties?scope=household')
  assert.deepEqual(primaryList.data.items.map((item) => item.label), ['Primary Home'])
  assert.deepEqual(sharedList.data.items.map((item) => item.label), ['Underwater Rental'])
  assert.deepEqual(partnerList.data.items.map((item) => item.label), ['Partner Condo'])
  assert.equal(combinedList.data.items.length, 3)
  assert.equal(combinedList.data.totals_by_currency[0].equity, 460000)

  const hiddenHistory = await request(`/api/properties/${homeId}/history?scope=shared`)
  assert.equal(hiddenHistory.response.status, 404)

  const currencyChange = await request(`/api/properties/${homeId}`, {
    method: 'PUT',
    body: { ...homeInput, currency: 'USD' },
  })
  assert.equal(currencyChange.response.status, 400)

  const unsafeUrl = await request(`/api/properties/${homeId}/snapshots`, {
    method: 'POST',
    body: {
      valuation_date: '2026-09-07', estimated_value: 830000, mortgage_balance: 470000,
      source_label: 'Unsafe', source_url: 'http://example.com', note: '',
    },
  })
  assert.equal(unsafeUrl.response.status, 400)

  const impossibleDate = await request(`/api/properties/${homeId}/snapshots`, {
    method: 'POST',
    body: {
      valuation_date: '2026-02-30', estimated_value: 830000, mortgage_balance: 470000,
      source_label: 'Manual', source_url: '', note: '',
    },
  })
  assert.equal(impossibleDate.response.status, 400)

  const blankLabel = await request('/api/properties', {
    method: 'POST', body: { ...homeInput, label: '   ' },
  })
  assert.equal(blankLabel.response.status, 400)

  const firstSnapshotId = stmtGet(
    'SELECT id FROM property_snapshots WHERE property_id = ? ORDER BY valuation_date LIMIT 1',
    [homeId]
  ).id
  const deletedSnapshot = await request(`/api/properties/${homeId}/snapshots/${firstSnapshotId}`, { method: 'DELETE' })
  assert.equal(deletedSnapshot.response.status, 200)
  const lastSnapshotDelete = await request(`/api/properties/${homeId}/snapshots/${secondId}`, { method: 'DELETE' })
  assert.equal(lastSnapshotDelete.response.status, 400)

  const deletedProperty = await request(`/api/properties/${partner.data.id}`, { method: 'DELETE' })
  assert.equal(deletedProperty.response.status, 200)
  assert.equal(stmtGet('SELECT COUNT(*) AS value FROM property_snapshots WHERE property_id = ?', [partner.data.id]).value, 0)

  saveNow()
})
