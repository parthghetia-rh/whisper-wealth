import initSqlJs from 'sql.js'
import {
  readFileSync, writeFileSync, renameSync, existsSync, mkdirSync,
  copyFileSync, readdirSync, unlinkSync, statSync, accessSync, constants,
} from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'portfolio.db')
let backupDir = process.env.BACKUP_DIR || join(dirname(dbPath), 'backups')
const backupRetentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS) || 14)

try {
  mkdirSync(backupDir, { recursive: true })
  accessSync(backupDir, constants.W_OK)
} catch {
  const fallback = join(dirname(dbPath), 'backups')
  console.warn(`Backup directory ${backupDir} is not writable; using ${fallback}`)
  backupDir = fallback
  mkdirSync(backupDir, { recursive: true })
}

const SQL = await initSqlJs()

let db
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath)
  db = new SQL.Database(buffer)
} else {
  db = new SQL.Database()
}

db.run('PRAGMA foreign_keys = ON')

const currentSchemaVersion = db.exec('PRAGMA user_version')[0]?.values?.[0]?.[0] || 0
if (existsSync(dbPath) && currentSchemaVersion < 4) {
  try {
    mkdirSync(backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = join(backupDir, `portfolio-pre-migration-${stamp}.db`)
    copyFileSync(dbPath, target)
    console.log(`Created pre-migration backup: ${target}`)
  } catch (err) {
    throw new Error(`Unable to create pre-migration backup: ${err.message}`)
  }
}

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

function ensureColumn(table, column, definition) {
  const columns = db.exec(`PRAGMA table_info(${table})`)[0]?.values || []
  if (!columns.some((row) => row[1] === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('quotes', 'provider_symbol', 'TEXT')
ensureColumn('quotes', 'regular_market_price', 'REAL')
ensureColumn('quotes', 'pre_market_price', 'REAL')
ensureColumn('quotes', 'pre_market_change', 'REAL')
ensureColumn('quotes', 'pre_market_change_percent', 'REAL')
ensureColumn('quotes', 'post_market_price', 'REAL')
ensureColumn('quotes', 'post_market_change', 'REAL')
ensureColumn('quotes', 'post_market_change_percent', 'REAL')
ensureColumn('quotes', 'market_state', 'TEXT')
ensureColumn('quotes', 'price_source', "TEXT DEFAULT 'regular'")
ensureColumn('quotes', 'day_high', 'REAL')
ensureColumn('quotes', 'day_low', 'REAL')
ensureColumn('quotes', 'fifty_two_week_high', 'REAL')
ensureColumn('quotes', 'fifty_two_week_low', 'REAL')
ensureColumn('quotes', 'volume', 'REAL')
ensureColumn('quotes', 'avg_volume', 'REAL')
ensureColumn('quotes', 'analyst_rating', 'TEXT')
ensureColumn('quotes', 'provider_updated_at', 'TEXT')
ensureColumn('quotes', 'last_success_at', 'TEXT')
ensureColumn('quotes', 'status', "TEXT DEFAULT 'unavailable'")
ensureColumn('quotes', 'last_error', 'TEXT')

db.run(`
  UPDATE quotes
  SET regular_market_price = COALESCE(regular_market_price, price),
      provider_symbol = COALESCE(provider_symbol, ticker),
      last_success_at = COALESCE(last_success_at, updated_at),
      status = CASE WHEN price IS NOT NULL AND price > 0 THEN 'stale' ELSE 'unavailable' END
  WHERE provider_symbol IS NULL OR regular_market_price IS NULL OR last_success_at IS NULL
`)

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
    type TEXT NOT NULL DEFAULT 'cash',
    frequency TEXT NOT NULL DEFAULT 'yearly',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

try { db.run("ALTER TABLE cash_positions ADD COLUMN type TEXT NOT NULL DEFAULT 'cash'") } catch {}
try { db.run("ALTER TABLE cash_positions ADD COLUMN frequency TEXT NOT NULL DEFAULT 'yearly'") } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

try { db.run("ALTER TABLE dividends ADD COLUMN drip_processed INTEGER DEFAULT 0") } catch {}

try { db.run("ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'manual'") } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    date TEXT PRIMARY KEY,
    total_value REAL,
    total_cost REAL,
    total_gain REAL,
    annual_dividends REAL,
    positions INTEGER,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS portfolio_snapshots_v2 (
    date TEXT NOT NULL,
    currency TEXT NOT NULL,
    total_value REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    annual_dividends REAL NOT NULL DEFAULT 0,
    positions INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(date, currency)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS snapshot_fx_rates (
    date TEXT NOT NULL,
    currency TEXT NOT NULL,
    usd_rate REAL NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(date, currency)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS fx_rates (
    currency TEXT PRIMARY KEY,
    usd_rate REAL NOT NULL,
    provider_updated_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS period_changes (
    ticker TEXT PRIMARY KEY,
    change_3m REAL,
    change_6m REAL,
    change_1y REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS enrichment_state (
    ticker TEXT PRIMARY KEY,
    period_date TEXT,
    dividend_date TEXT
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    currency TEXT NOT NULL DEFAULT 'CAD',
    amount REAL NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS household_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    is_primary INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  INSERT OR IGNORE INTO household_members (name, color, is_primary)
  SELECT 'Primary', '#6366f1', 1
  WHERE NOT EXISTS (SELECT 1 FROM household_members WHERE is_primary = 1)
`)

ensureColumn('transactions', 'member_id', 'INTEGER')
ensureColumn('cash_positions', 'member_id', 'INTEGER')
ensureColumn('expenses', 'member_id', 'INTEGER')

db.run(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    address TEXT,
    currency TEXT NOT NULL DEFAULT 'CAD',
    purchase_price REAL NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    member_id INTEGER REFERENCES household_members(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS property_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    valuation_date TEXT NOT NULL,
    estimated_value REAL NOT NULL,
    mortgage_balance REAL NOT NULL DEFAULT 0,
    source_label TEXT NOT NULL DEFAULT 'Manual',
    source_url TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(property_id, valuation_date)
  )
`)

const primaryMemberId = db.exec(
  'SELECT id FROM household_members WHERE is_primary = 1 ORDER BY id LIMIT 1'
)[0]?.values?.[0]?.[0]

if (currentSchemaVersion < 3 && primaryMemberId) {
  db.run('UPDATE transactions SET member_id = ? WHERE member_id IS NULL', [primaryMemberId])
  db.run('UPDATE cash_positions SET member_id = ? WHERE member_id IS NULL', [primaryMemberId])
  db.run('UPDATE expenses SET member_id = ? WHERE member_id IS NULL', [primaryMemberId])
}

db.run('CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member_id)')
db.run('CREATE INDEX IF NOT EXISTS idx_cash_member ON cash_positions(member_id)')
db.run('CREATE INDEX IF NOT EXISTS idx_expenses_member ON expenses(member_id)')
db.run('CREATE INDEX IF NOT EXISTS idx_properties_member ON properties(member_id)')
db.run('CREATE INDEX IF NOT EXISTS idx_property_snapshots_property_date ON property_snapshots(property_id, valuation_date)')

db.run(`
  CREATE TABLE IF NOT EXISTS portfolio_snapshots_v3 (
    date TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    currency TEXT NOT NULL,
    total_value REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    annual_dividends REAL NOT NULL DEFAULT 0,
    positions INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(date, scope_key, currency)
  )
`)

// Keep the legacy milestone table readable while scoped milestones are seeded.
db.run(`
  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    achieved_at TEXT DEFAULT (datetime('now')),
    value REAL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS milestones_v2 (
    scope_key TEXT NOT NULL,
    id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    achieved_at TEXT DEFAULT (datetime('now')),
    value REAL,
    PRIMARY KEY(scope_key, id)
  )
`)

if (currentSchemaVersion < 3 && primaryMemberId) {
  db.run(`
    INSERT OR IGNORE INTO portfolio_snapshots_v3
      (date, scope_key, currency, total_value, total_cost, annual_dividends, positions, updated_at)
    SELECT date, 'household', currency, total_value, total_cost, annual_dividends, positions, updated_at
    FROM portfolio_snapshots_v2
  `)
  db.run(`
    INSERT OR IGNORE INTO portfolio_snapshots_v3
      (date, scope_key, currency, total_value, total_cost, annual_dividends, positions, updated_at)
    SELECT date, 'member:${primaryMemberId}', currency, total_value, total_cost,
      annual_dividends, positions, updated_at
    FROM portfolio_snapshots_v2
  `)
  db.run(`
    INSERT OR IGNORE INTO milestones_v2
      (scope_key, id, category, title, description, icon, achieved_at, value)
    SELECT 'household', id, category, title, description, icon, achieved_at, value
    FROM milestones
  `)
  db.run(`
    INSERT OR IGNORE INTO milestones_v2
      (scope_key, id, category, title, description, icon, achieved_at, value)
    SELECT 'member:${primaryMemberId}', id, category, title, description, icon, achieved_at, value
    FROM milestones
  `)
}

db.run(`
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL UNIQUE,
    list_name TEXT DEFAULT 'Default',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

try { db.run("ALTER TABLE watchlist ADD COLUMN list_name TEXT DEFAULT 'Default'") } catch {}
try { db.run("ALTER TABLE watchlist ADD COLUMN note TEXT") } catch {}
try { db.run("ALTER TABLE watchlist ADD COLUMN sort_order INTEGER DEFAULT 0") } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS price_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    condition TEXT NOT NULL,
    target_price REAL NOT NULL,
    triggered INTEGER DEFAULT 0,
    triggered_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

let savePending = false
let saveTimer = null
let lastSaveError = null
let saveExportCount = 0

function save() {
  if (saveTimer) return
  savePending = true
  saveTimer = setTimeout(flushSave, 1000)
}

function flushSave() {
  saveTimer = null
  if (!savePending) return
  savePending = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = db.export()
      const tmp = dbPath + '.tmp'
      writeFileSync(tmp, Buffer.from(data), { mode: 0o600 })
      renameSync(tmp, dbPath)
      lastSaveError = null
      saveExportCount++
      return
    } catch (err) {
      console.error(`DB save attempt ${attempt + 1} failed:`, err.message)
      lastSaveError = err.message
    }
  }
  console.error('DB save failed after 3 attempts — data is in memory but not on disk')
}

function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  savePending = true
  flushSave()
}

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

function transaction(callback) {
  db.run('BEGIN')
  try {
    const result = callback()
    db.run('COMMIT')
    save()
    return result
  } catch (err) {
    try { db.run('ROLLBACK') } catch {}
    throw err
  }
}

function pruneBackups() {
  if (!existsSync(backupDir)) return
  const cutoff = Date.now() - backupRetentionDays * 24 * 60 * 60 * 1000
  for (const name of readdirSync(backupDir)) {
    if (!/^portfolio-(daily|pre-migration)-.*\.db$/.test(name)) continue
    const target = join(backupDir, name)
    if (statSync(target).mtimeMs < cutoff) unlinkSync(target)
  }
}

function createBackup(kind = 'daily') {
  mkdirSync(backupDir, { recursive: true })
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const target = join(backupDir, `portfolio-${kind}-${date}.db`)
  if (kind === 'daily' && existsSync(target)) return target
  const tmp = `${target}.tmp`
  writeFileSync(tmp, Buffer.from(db.export()), { mode: 0o600 })
  renameSync(tmp, target)
  pruneBackups()
  return target
}

function getDbHealth() {
  return {
    path: dbPath,
    persisted: existsSync(dbPath),
    last_save_error: lastSaveError,
    backup_dir: backupDir,
    retention_days: backupRetentionDays,
    save_exports: saveExportCount,
  }
}

if (currentSchemaVersion < 4) db.run('PRAGMA user_version = 4')
saveNow()

export {
  stmtAll, stmtGet, stmtRun, stmtRunBatch, transaction, save, saveNow,
  createBackup, getDbHealth,
}
export default db
