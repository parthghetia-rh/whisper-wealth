import test from 'node:test'
import assert from 'node:assert/strict'
import { importWithMapping, parseHeaders } from '../server/services/csvParser.js'

test('Wealthsimple holdings are detected without treating account fields as buy/sell type', () => {
  const csv = [
    'Account Type,Symbol,Exchange,Security Type,Quantity,Position Direction,Market Price,Book Value (CAD),Book Value (Market)',
    'TFSA,SHOP,XTSE,Equity,10,Long,125.00,900.00,1000.00',
  ].join('\n')

  const parsed = parseHeaders(csv)
  assert.equal(parsed.suggestedMode, 'holdings')
  assert.equal(parsed.detectedProvider, 'wealthsimple')
  assert.equal(parsed.suggestedMapping.tickerCol, 'Symbol')
  assert.equal(parsed.suggestedMapping.sharesCol, 'Quantity')
  assert.equal(parsed.suggestedMapping.bookValueCol, 'Book Value (Market)')
  assert.equal(parsed.suggestedMapping.typeCol, undefined)

  const result = importWithMapping(csv, { ...parsed.suggestedMapping, mode: 'holdings' })
  assert.equal(result.skipped.length, 0)
  assert.deepEqual(result.transactions[0], {
    ticker: 'SHOP.TO',
    type: 'buy',
    shares: 10,
    price_per_share: 100,
    date: result.transactions[0].date,
    source: 'holdings_import',
  })
})

test('holdings with average cost but no transaction type are detected', () => {
  const csv = 'Ticker,Units,Average Cost\nAAPL,2.5,150.25'
  const parsed = parseHeaders(csv)
  assert.equal(parsed.suggestedMode, 'holdings')

  const result = importWithMapping(csv, { ...parsed.suggestedMapping, mode: 'holdings' })
  assert.equal(result.skipped.length, 0)
  assert.equal(result.transactions[0].price_per_share, 150.25)
  assert.equal(result.transactions[0].shares, 2.5)
})

test('normal transaction exports still detect an exact trade type column', () => {
  const csv = 'Date,Type,Symbol,Quantity,Price\n2026-09-01,Buy,AAPL,1,200'
  const parsed = parseHeaders(csv)
  assert.equal(parsed.suggestedMode, 'transactions')
  assert.equal(parsed.suggestedMapping.typeCol, 'Type')

  const result = importWithMapping(csv, { ...parsed.suggestedMapping, mode: 'transactions' })
  assert.equal(result.skipped.length, 0)
  assert.equal(result.transactions[0].type, 'buy')
})
