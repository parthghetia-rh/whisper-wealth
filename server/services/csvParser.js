const BROKER_PRESETS = {
  wealthsimple: {
    label: 'Wealthsimple',
    dateCol: ['Date', 'date', 'Transaction Date'],
    typeCol: ['Type', 'type', 'Transaction Type', 'Activity Type'],
    tickerCol: ['Symbol', 'symbol', 'Ticker', 'ticker'],
    sharesCol: ['Quantity', 'quantity', 'Shares', 'shares', 'Units'],
    priceCol: ['Price', 'price', 'Price per Share', 'Market Price'],
    buyTypes: ['buy', 'bought', 'purchase', 'market buy'],
    sellTypes: ['sell', 'sold', 'market sell'],
  },
  questrade: {
    label: 'Questrade',
    dateCol: ['Transaction Date', 'Settlement Date', 'Date'],
    typeCol: ['Action', 'Type', 'Activity Type'],
    tickerCol: ['Symbol', 'Ticker'],
    sharesCol: ['Quantity', 'Qty'],
    priceCol: ['Price', 'Market Price'],
    buyTypes: ['buy', 'bought'],
    sellTypes: ['sell', 'sold'],
  },
  generic: {
    label: 'Generic',
    dateCol: ['Date', 'date', 'Trade Date', 'Transaction Date'],
    typeCol: ['Type', 'type', 'Action', 'Side', 'Transaction Type'],
    tickerCol: ['Symbol', 'symbol', 'Ticker', 'ticker', 'Stock'],
    sharesCol: ['Quantity', 'quantity', 'Shares', 'shares', 'Qty', 'Units'],
    priceCol: ['Price', 'price', 'Price per Share', 'Unit Price', 'Cost'],
    buyTypes: ['buy', 'bought', 'purchase', 'long'],
    sellTypes: ['sell', 'sold', 'short'],
  },
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row)
  }
  return { headers, rows }
}

function parseLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase())
    if (idx !== -1) return headers[idx]
  }
  return null
}

function normalizeAmount(val) {
  if (!val) return NaN
  return Number(val.replace(/[^\d.\-]/g, '').replace(/−/g, '-'))
}

function normalizeDate(val) {
  if (!val) return null
  const cleaned = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    const [m, d, y] = cleaned.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) {
    return cleaned.replace(/\//g, '-')
  }
  const d = new Date(cleaned)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  return null
}

export function detectBroker(headers) {
  const lower = headers.map((h) => h.toLowerCase().trim())
  if (lower.includes('symbol') && lower.includes('type') && lower.includes('account')) {
    return 'wealthsimple'
  }
  if (lower.includes('action') && lower.includes('settlement date')) {
    return 'questrade'
  }
  return 'generic'
}

export function importCSV(text, brokerHint) {
  const { headers, rows } = parseCSV(text)
  if (!headers.length || !rows.length) {
    return { transactions: [], skipped: [], error: 'Empty or invalid CSV' }
  }

  const broker = brokerHint || detectBroker(headers)
  const preset = BROKER_PRESETS[broker] || BROKER_PRESETS.generic

  const dateKey = findColumn(headers, preset.dateCol)
  const typeKey = findColumn(headers, preset.typeCol)
  const tickerKey = findColumn(headers, preset.tickerCol)
  const sharesKey = findColumn(headers, preset.sharesCol)
  const priceKey = findColumn(headers, preset.priceCol)

  if (!dateKey || !tickerKey) {
    return {
      transactions: [],
      skipped: [],
      error: `Could not find required columns. Found: ${headers.join(', ')}. Need at least Date and Symbol/Ticker columns.`,
    }
  }

  const transactions = []
  const skipped = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rawType = (row[typeKey] || '').toLowerCase().trim()

    let type = null
    if (preset.buyTypes.some((t) => rawType.includes(t))) {
      type = 'buy'
    } else if (preset.sellTypes.some((t) => rawType.includes(t))) {
      type = 'sell'
    }

    if (!type) {
      skipped.push({ row: i + 2, reason: `Skipped type "${row[typeKey] || 'empty'}" (not buy/sell)`, data: row })
      continue
    }

    const ticker = (row[tickerKey] || '').trim().toUpperCase()
    if (!ticker || !/^[A-Z0-9.\-]{1,20}$/.test(ticker)) {
      skipped.push({ row: i + 2, reason: `Invalid ticker "${row[tickerKey]}"`, data: row })
      continue
    }

    const date = normalizeDate(row[dateKey])
    if (!date) {
      skipped.push({ row: i + 2, reason: `Invalid date "${row[dateKey]}"`, data: row })
      continue
    }

    const shares = normalizeAmount(row[sharesKey])
    const price = normalizeAmount(row[priceKey])

    if (!Number.isFinite(shares) || shares <= 0) {
      skipped.push({ row: i + 2, reason: `Invalid shares "${row[sharesKey]}"`, data: row })
      continue
    }
    if (!Number.isFinite(price) || price <= 0) {
      skipped.push({ row: i + 2, reason: `Invalid price "${row[priceKey]}"`, data: row })
      continue
    }

    transactions.push({ ticker, type, shares, price_per_share: price, date })
  }

  return { transactions, skipped, broker, detectedColumns: { dateKey, typeKey, tickerKey, sharesKey, priceKey } }
}

export function getPresets() {
  return Object.entries(BROKER_PRESETS).map(([id, p]) => ({ id, label: p.label }))
}
