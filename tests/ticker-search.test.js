import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('ticker lookup validates symbols and reuses last-good tracked quotes without provider calls', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-search-'))
  process.env.DB_PATH = join(directory, 'portfolio.db')
  process.env.BACKUP_DIR = join(directory, 'backups')
  const { stmtRun, saveNow, default: db } = await import('../server/db.js')
  const { getProviderMetrics } = await import('../server/services/stockService.js')
  const { default: router } = await import('../server/routes/watchlist.js')
  stmtRun("INSERT INTO quotes (ticker, name, currency, price, status) VALUES (?, ?, ?, ?, ?)", ['IBM', 'International Business Machines', 'USD', 250, 'stale'])
  const app = express()
  app.use('/api/watchlist', router)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    saveNow()
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}/api/watchlist/quote/`
  const before = getProviderMetrics().total_requests
  const response = await fetch(`${base}ibm`)
  assert.equal(response.status, 200)
  const quote = await response.json()
  assert.equal(quote.ticker, 'IBM')
  assert.equal(quote.price, 250)
  assert.equal(quote.status, 'stale')
  const invalid = await fetch(`${base}bad%20symbol`)
  assert.equal(invalid.status, 400)
  assert.equal(getProviderMetrics().total_requests, before)
})
