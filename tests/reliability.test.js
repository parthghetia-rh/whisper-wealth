import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  chunkSymbols, correlateBatch, RequestBudget, selectEffectivePrice,
} from '../server/services/stockService.js'

test('quotes are batched at 50 symbols with no duplicates', () => {
  const twenty = Array.from({ length: 20 }, (_, index) => `T${index}`)
  const twoHundred = Array.from({ length: 200 }, (_, index) => `T${index}`)
  assert.equal(chunkSymbols(twenty).length, 1)
  assert.equal(chunkSymbols(twoHundred).length, 4)
  assert.deepEqual(chunkSymbols(['aapl', 'AAPL']), [['AAPL']])
})

test('provider response order preserves requested ticker aliases', () => {
  const first = { symbol: 'CANONICAL-A' }
  const second = { symbol: 'MSFT' }
  const result = correlateBatch(['ALIAS-A', 'MSFT'], [first, second])
  assert.equal(result.get('ALIAS-A'), first)
  assert.equal(result.get('MSFT'), second)
})

test('extended market price becomes the effective price', () => {
  assert.deepEqual(selectEffectivePrice({
    marketState: 'PRE', regularMarketPrice: 100, preMarketPrice: 102,
  }), { price: 102, source: 'pre_market' })
  assert.deepEqual(selectEffectivePrice({
    marketState: 'POST', regularMarketPrice: 100, postMarketPrice: 99,
  }), { price: 99, source: 'post_market' })
  assert.deepEqual(selectEffectivePrice({
    marketState: 'CLOSED', regularMarketPrice: 100,
  }), { price: 100, source: 'regular' })
})

test('request budget blocks starts beyond its window limit', async () => {
  const budget = new RequestBudget(2, 50)
  await budget.acquire()
  await budget.acquire()
  const started = Date.now()
  await budget.acquire()
  assert.ok(Date.now() - started >= 45)
  assert.ok(budget.metrics().requests_last_minute <= 2)
})

test('portfolio dates use America/Toronto boundaries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-test-'))
  process.env.DB_PATH = join(directory, 'portfolio.db')
  process.env.BACKUP_DIR = join(directory, 'backups')
  const { pollIntervalFor, torontoDate, updatePortfolioSnapshot } = await import('../server/services/marketDataService.js')
  const { stmtAll, stmtRun } = await import('../server/db.js')
  assert.equal(torontoDate(new Date('2026-01-01T02:00:00Z')), '2025-12-31')
  assert.equal(torontoDate(new Date('2026-01-01T15:00:00Z')), '2026-01-01')
  assert.equal(pollIntervalFor('regular', 0), 300_000)
  assert.equal(pollIntervalFor('regular', 3), 60_000)
  assert.equal(pollIntervalFor('extended', 3), 300_000)
  assert.equal(pollIntervalFor('closed', 3), 1_800_000)

  stmtRun(
    `INSERT INTO quotes
      (ticker, currency, price, regular_market_price, status, last_success_at)
     VALUES ('AAPL', 'USD', 200, 200, 'fresh', datetime('now'))`
  )
  stmtRun(
    `INSERT INTO quotes
      (ticker, currency, price, regular_market_price, status, last_success_at)
     VALUES ('SHOP.TO', 'CAD', 150, 150, 'fresh', datetime('now'))`
  )
  stmtRun("INSERT INTO transactions (ticker, type, shares, price_per_share, date) VALUES ('AAPL', 'buy', 1, 100, '2025-01-01')")
  stmtRun("INSERT INTO transactions (ticker, type, shares, price_per_share, date) VALUES ('SHOP.TO', 'buy', 2, 100, '2025-01-01')")
  stmtRun("INSERT INTO fx_rates (currency, usd_rate) VALUES ('USD', 1)")
  stmtRun("INSERT INTO fx_rates (currency, usd_rate) VALUES ('CAD', 0.75)")
  updatePortfolioSnapshot()

  const snapshots = stmtAll('SELECT currency, total_value, total_cost FROM portfolio_snapshots_v2 ORDER BY currency')
  assert.deepEqual(snapshots, [
    { currency: 'CAD', total_value: 300, total_cost: 200 },
    { currency: 'USD', total_value: 200, total_cost: 100 },
  ])
  assert.equal(stmtAll('SELECT * FROM portfolio_snapshots').length, 0)
})
