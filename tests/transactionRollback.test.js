import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('database transactions roll back an incomplete import batch', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-import-rollback-'))
  process.env.DB_PATH = join(directory, 'portfolio.db')
  process.env.BACKUP_DIR = join(directory, 'backups')
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const { stmtGet, stmtRunBatch, transaction } = await import('../server/db.js')
  const before = stmtGet("SELECT COUNT(*) AS count FROM transactions WHERE ticker LIKE 'ROLLBACK-%'").count

  assert.throws(() => {
    transaction(() => {
      stmtRunBatch(
        `INSERT INTO transactions (ticker, type, shares, price_per_share, date, source)
         VALUES ('ROLLBACK-ONE', 'buy', 1, 10, '2026-01-01', 'transaction_import')`
      )
      stmtRunBatch(
        `INSERT INTO transactions (ticker, type, shares, price_per_share, date, source)
         VALUES ('ROLLBACK-TWO', 'invalid', 1, 10, '2026-01-01', 'transaction_import')`
      )
    })
  })

  const after = stmtGet("SELECT COUNT(*) AS count FROM transactions WHERE ticker LIKE 'ROLLBACK-%'").count
  assert.equal(after, before)
})
