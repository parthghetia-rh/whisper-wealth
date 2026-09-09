import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import initSqlJs from 'sql.js'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('v2 data migrates to Primary and household scopes stay isolated without provider calls', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-household-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const dbPath = join(directory, 'portfolio.db')
  const SQL = await initSqlJs()
  const legacy = new SQL.Database()
  legacy.run(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT NOT NULL, type TEXT NOT NULL,
      shares REAL NOT NULL, price_per_share REAL NOT NULL, date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE cash_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, currency TEXT NOT NULL,
      amount REAL NOT NULL, interest_rate REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'cash', frequency TEXT NOT NULL DEFAULT 'yearly',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other', currency TEXT NOT NULL DEFAULT 'CAD',
      amount REAL NOT NULL, frequency TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE portfolio_snapshots_v2 (
      date TEXT NOT NULL, currency TEXT NOT NULL, total_value REAL NOT NULL,
      total_cost REAL NOT NULL, annual_dividends REAL NOT NULL, positions INTEGER NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')), PRIMARY KEY(date, currency)
    );
    CREATE TABLE milestones (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT, icon TEXT, achieved_at TEXT DEFAULT (datetime('now')), value REAL
    );
    INSERT INTO transactions (ticker, type, shares, price_per_share, date)
      VALUES ('AAPL', 'buy', 1, 100, '2025-01-01');
    INSERT INTO cash_positions (label, currency, amount, interest_rate)
      VALUES ('Savings', 'USD', 50, 2);
    INSERT INTO expenses (label, category, currency, amount, frequency)
      VALUES ('Rent', 'housing', 'CAD', 1000, 'monthly');
    INSERT INTO portfolio_snapshots_v2
      (date, currency, total_value, total_cost, annual_dividends, positions)
      VALUES ('2026-01-01', 'USD', 150, 100, 5, 1);
    INSERT INTO milestones (id, category, title) VALUES ('value_100', 'value', 'Legacy');
    PRAGMA user_version = 2;
  `)
  writeFileSync(dbPath, Buffer.from(legacy.export()))
  legacy.close()

  process.env.DB_PATH = dbPath
  process.env.BACKUP_DIR = join(directory, 'backups')

  const dbModule = await import('../server/db.js')
  const { stmtAll, stmtGet, stmtRun } = dbModule
  const { torontoDate, updatePortfolioSnapshot } = await import('../server/services/marketDataService.js')
  const { getProviderMetrics } = await import('../server/services/stockService.js')
  const householdRouter = (await import('../server/routes/household.js')).default
  const transactionsRouter = (await import('../server/routes/transactions.js')).default
  const portfolioRouter = (await import('../server/routes/portfolio.js')).default

  const primary = stmtGet('SELECT * FROM household_members WHERE is_primary = 1')
  assert.equal(stmtGet('PRAGMA user_version').user_version, 4)
  assert.equal(primary.name, 'Primary')
  assert.equal(stmtGet('SELECT member_id FROM transactions WHERE ticker = ?', ['AAPL']).member_id, primary.id)
  assert.equal(stmtGet('SELECT member_id FROM cash_positions').member_id, primary.id)
  assert.equal(stmtGet('SELECT member_id FROM expenses').member_id, primary.id)
  assert.equal(stmtGet("SELECT total_value FROM portfolio_snapshots_v3 WHERE date = '2026-01-01' AND scope_key = 'household'").total_value, 150)
  assert.equal(stmtGet('SELECT total_value FROM portfolio_snapshots_v3 WHERE date = ? AND scope_key = ?', ['2026-01-01', `member:${primary.id}`]).total_value, 150)
  const migrationBackup = readdirSync(join(directory, 'backups')).find((name) => name.includes('pre-migration'))
  assert.ok(migrationBackup)
  const restored = new SQL.Database(readFileSync(join(directory, 'backups', migrationBackup)))
  assert.equal(restored.exec('PRAGMA user_version')[0].values[0][0], 2)
  assert.equal(restored.exec('SELECT COUNT(*) FROM transactions')[0].values[0][0], 1)
  restored.close()

  stmtRun(`INSERT INTO quotes
    (ticker, currency, price, regular_market_price, status, last_success_at)
    VALUES ('AAPL', 'USD', 200, 200, 'fresh', datetime('now'))`)
  stmtRun(`INSERT INTO quotes
    (ticker, currency, price, regular_market_price, status, last_success_at)
    VALUES ('MSFT', 'USD', 150, 150, 'fresh', datetime('now'))`)
  stmtRun("INSERT INTO fx_rates (currency, usd_rate) VALUES ('USD', 1)")

  const app = express()
  app.use(express.json())
  app.use('/api/household', householdRouter)
  app.use('/api/transactions', transactionsRouter)
  app.use('/api/portfolio', portfolioRouter)
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  const base = `http://127.0.0.1:${server.address().port}`

  const addedMember = await fetch(`${base}/api/household/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Partner', color: '#22c55e' }),
  }).then((response) => response.json())
  assert.equal(addedMember.scope, `member:${addedMember.id}`)

  const transactionBody = { ticker: 'MSFT', type: 'buy', shares: 2, price_per_share: 100, date: '2025-02-01' }
  const partnerTransaction = await fetch(`${base}/api/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...transactionBody, owner_scope: addedMember.scope }),
  }).then((response) => response.json())
  assert.equal(partnerTransaction.owner_name, 'Partner')
  await fetch(`${base}/api/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...transactionBody, shares: 1, owner_scope: 'shared' }),
  })

  const primaryRows = await fetch(`${base}/api/transactions?scope=member:${primary.id}`).then((response) => response.json())
  const partnerRows = await fetch(`${base}/api/transactions?scope=${addedMember.scope}`).then((response) => response.json())
  const sharedRows = await fetch(`${base}/api/transactions?scope=shared`).then((response) => response.json())
  const combinedRows = await fetch(`${base}/api/transactions?scope=household`).then((response) => response.json())
  assert.deepEqual(primaryRows.map((row) => row.ticker), ['AAPL'])
  assert.deepEqual(partnerRows.map((row) => row.ticker), ['MSFT'])
  assert.equal(sharedRows[0].owner_scope, 'shared')
  assert.equal(combinedRows.length, 3)

  const beforeRequests = getProviderMetrics().total_requests
  updatePortfolioSnapshot()
  assert.equal(getProviderMetrics().total_requests, beforeRequests)

  const todayRows = stmtAll(`SELECT scope_key, total_value, total_cost
    FROM portfolio_snapshots_v3 WHERE date = (
      SELECT MAX(date) FROM portfolio_snapshots_v3
    ) AND currency = 'USD' ORDER BY scope_key`)
  const values = Object.fromEntries(todayRows.map((row) => [row.scope_key, row]))
  assert.equal(values.household.total_value, 700)
  assert.equal(values.household.total_cost, 450)
  assert.equal(values[`member:${primary.id}`].total_value, 250)
  assert.equal(values[`member:${addedMember.id}`].total_value, 300)
  assert.equal(values.shared.total_value, 150)

  const combinedHoldings = await fetch(`${base}/api/portfolio?scope=household`).then((response) => response.json())
  const partnerHoldings = await fetch(`${base}/api/portfolio?scope=${addedMember.scope}`).then((response) => response.json())
  const sharedHoldings = await fetch(`${base}/api/portfolio?scope=shared`).then((response) => response.json())
  assert.equal(combinedHoldings.find((holding) => holding.ticker === 'MSFT').owners.length, 2)
  assert.equal(partnerHoldings[0].shares, 2)
  assert.equal(sharedHoldings[0].shares, 1)

  const primaryHistory = await fetch(
    `${base}/api/portfolio/history?scope=member:${primary.id}&currency=USD&range=1y`
  ).then((response) => response.json())
  assert.ok(primaryHistory.data.some((snapshot) => snapshot.date === '2026-01-01' && snapshot.value === 150))
  assert.equal(getProviderMetrics().total_requests, beforeRequests)

  const incompleteDate = torontoDate(new Date(Date.now() - 3 * 86400000))
  stmtRun(`INSERT INTO portfolio_snapshots_v3
    (date, scope_key, currency, total_value, total_cost, annual_dividends, positions)
    VALUES (?, 'household', 'USD', 100, 80, 0, 1)`, [incompleteDate])
  stmtRun(`INSERT INTO portfolio_snapshots_v3
    (date, scope_key, currency, total_value, total_cost, annual_dividends, positions)
    VALUES (?, 'household', 'CAD', 100, 80, 0, 1)`, [incompleteDate])
  stmtRun(`INSERT INTO snapshot_fx_rates (date, currency, usd_rate)
    VALUES (?, 'USD', 1)`, [incompleteDate])
  stmtRun("UPDATE quotes SET price = 225, regular_market_price = 225 WHERE ticker = 'AAPL'")
  stmtRun(`INSERT INTO quotes
    (ticker, currency, price, regular_market_price, status, last_success_at)
    VALUES ('SHOP.TO', 'CAD', 100, 100, 'fresh', datetime('now'))`)
  stmtRun(`INSERT INTO transactions
    (ticker, type, shares, price_per_share, date, member_id)
    VALUES ('SHOP.TO', 'buy', 2, 80, '2026-02-01', ?)`, [primary.id])
  stmtRun("INSERT INTO fx_rates (currency, usd_rate) VALUES ('CAD', 0.75)")

  const currentSummary = await fetch(`${base}/api/portfolio/summary?scope=household`)
    .then((response) => response.json())
  const currentHistory = await fetch(
    `${base}/api/portfolio/history?scope=household&currency=USD&range=1y`
  ).then((response) => response.json())
  const livePoint = currentHistory.data.at(-1)
  const currentValueUsd = currentSummary.currencies.reduce((total, row) => (
    total + row.total_value * (row.currency === 'CAD' ? 0.75 : 1)
  ), 0)
  assert.equal(livePoint.date, torontoDate())
  assert.equal(livePoint.source, 'live')
  assert.equal(livePoint.value, currentValueUsd)
  assert.equal(currentHistory.data.some((snapshot) => snapshot.date === incompleteDate), false)
  assert.equal(currentHistory.excluded_incomplete, 1)
  assert.equal(getProviderMetrics().total_requests, beforeRequests)

  const limitedHistory = await fetch(
    `${base}/api/portfolio/history?scope=shared&currency=USD&range=1y`
  ).then((response) => response.json())
  assert.equal(limitedHistory.available_from, torontoDate())
  assert.deepEqual(limitedHistory.available_ranges, ['1m'])
  assert.ok(limitedHistory.range_unlocks['3m'])

  const invalidOwner = await fetch(`${base}/api/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...transactionBody, owner_scope: 'household' }),
  })
  assert.equal(invalidOwner.status, 400)
  dbModule.saveNow()
  await new Promise((resolve) => server.close(resolve))
})
