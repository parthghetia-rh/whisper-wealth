import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'portfolio.db')

const SQL = await initSqlJs()

let db
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath)
  db = new SQL.Database(buffer)
} else {
  db = new SQL.Database()
}

db.run('PRAGMA foreign_keys = ON')

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    shares REAL NOT NULL,
    price_per_share REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS quotes (
    ticker TEXT PRIMARY KEY,
    name TEXT,
    currency TEXT DEFAULT 'USD',
    price REAL,
    previous_close REAL,
    change REAL,
    change_percent REAL,
    market_cap REAL,
    dividend_rate REAL,
    dividend_yield REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

try { db.run("ALTER TABLE quotes ADD COLUMN currency TEXT DEFAULT 'USD'") } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS dividends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    amount REAL NOT NULL,
    ex_date TEXT NOT NULL,
    pay_date TEXT,
    UNIQUE(ticker, ex_date)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS cash_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    amount REAL NOT NULL,
    interest_rate REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

function save() {
  const data = db.export()
  const tmp = dbPath + '.tmp'
  writeFileSync(tmp, Buffer.from(data), { mode: 0o600 })
  renameSync(tmp, dbPath)
}

save()

function stmtAll(sql, params = []) {
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

function stmtGet(sql, params = []) {
  const rows = stmtAll(sql, params)
  return rows[0] || null
}

function stmtRun(sql, params = []) {
  db.run(sql, params)
  const changes = db.getRowsModified()
  const result = db.exec('SELECT last_insert_rowid() as id')
  const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : null
  save()
  return { lastInsertRowid, changes }
}

function stmtRunBatch(sql, params = []) {
  db.run(sql, params)
  const changes = db.getRowsModified()
  const result = db.exec('SELECT last_insert_rowid() as id')
  const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : null
  return { lastInsertRowid, changes }
}

export { stmtAll, stmtGet, stmtRun, stmtRunBatch, save }
export default db
