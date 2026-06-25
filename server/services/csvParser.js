function detectDelimiter(firstLine) {
  const tabs = (firstLine.match(/\t/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  return tabs > commas ? '\t' : ','
}

function parseLine(line, delimiter) {
  if (delimiter === '\t') return line.split('\t').map((s) => s.trim())
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

function parseFile(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { headers: [], rows: [], delimiter: ',' }

  const delimiter = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delimiter)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line, delimiter)
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row)
  }
  return { headers, rows, delimiter }
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

export function parseHeaders(text) {
  const { headers, rows, delimiter } = parseFile(text)
  const sample = rows.slice(0, 3)
  return { headers, rowCount: rows.length, delimiter: delimiter === '\t' ? 'tab' : 'comma', sample }
}

const EXCHANGE_SUFFIX = {
  TSX: '.TO',
  XTSE: '.TO',
  TOR: '.TO',
  TSXV: '.V',
  NEO: '.NE',
  XNEO: '.NE',
  CNSX: '.CN',
  NYSE: '',
  XNYS: '',
  NASDAQ: '',
  XNAS: '',
  ARCA: '',
  ARCX: '',
  BATS: '',
  NSE: '.NS',
  XNSE: '.NS',
  BSE: '.BO',
  XBOM: '.BO',
  LSE: '.L',
  XLON: '.L',
  ASX: '.AX',
  XASX: '.AX',
  HKG: '.HK',
  XHKG: '.HK',
  FRA: '.F',
  XFRA: '.F',
}

function resolveTickerWithExchange(rawTicker, exchangeValue) {
  if (rawTicker.includes('.')) return rawTicker

  if (!exchangeValue) return rawTicker

  const ex = exchangeValue.trim().toUpperCase()
  const suffix = EXCHANGE_SUFFIX[ex]
  if (suffix === undefined) return rawTicker
  return rawTicker + suffix
}

export function getExchangeList() {
  const seen = new Set()
  return Object.entries(EXCHANGE_SUFFIX)
    .filter(([k]) => {
      if (seen.has(EXCHANGE_SUFFIX[k] + k.slice(0, 2))) return false
      seen.add(EXCHANGE_SUFFIX[k] + k.slice(0, 2))
      return true
    })
    .map(([code, suffix]) => ({
      code,
      suffix: suffix || '(none)',
      example: `MSFT → MSFT${suffix}`,
    }))
}

export function importWithMapping(text, mapping) {
  const { rows } = parseFile(text)
  const { mode, tickerCol, sharesCol, priceCol, dateCol, typeCol, bookValueCol, exchangeCol } = mapping

  if (!tickerCol || !sharesCol) {
    return { transactions: [], skipped: [], error: 'Ticker and Shares columns are required' }
  }

  const transactions = []
  const skipped = []
  const today = new Date().toISOString().split('T')[0]

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    const rawTicker = (row[tickerCol] || '').trim().toUpperCase()
    if (!rawTicker || !/^[A-Z0-9.\-]{1,20}$/.test(rawTicker)) {
      skipped.push({ row: i + 2, reason: `Invalid ticker "${row[tickerCol]}"` })
      continue
    }
    const exchangeValue = exchangeCol ? row[exchangeCol] : null
    const ticker = resolveTickerWithExchange(rawTicker, exchangeValue)

    const shares = normalizeAmount(row[sharesCol])
    if (!Number.isFinite(shares) || shares <= 0) {
      skipped.push({ row: i + 2, reason: `Invalid shares "${row[sharesCol]}"` })
      continue
    }

    if (mode === 'holdings') {
      let price
      if (bookValueCol && row[bookValueCol]) {
        const bookValue = normalizeAmount(row[bookValueCol])
        price = Number.isFinite(bookValue) && bookValue > 0 ? bookValue / shares : 0
      } else if (priceCol && row[priceCol]) {
        price = normalizeAmount(row[priceCol])
      } else {
        price = 0
      }

      if (!Number.isFinite(price) || price <= 0) {
        skipped.push({ row: i + 2, reason: `Could not determine price for ${ticker}` })
        continue
      }

      transactions.push({
        ticker,
        type: 'buy',
        shares,
        price_per_share: Math.round(price * 10000) / 10000,
        date: today,
      })
    } else {
      if (!priceCol) {
        skipped.push({ row: i + 2, reason: 'No price column mapped' })
        continue
      }
      const price = normalizeAmount(row[priceCol])
      if (!Number.isFinite(price) || price <= 0) {
        skipped.push({ row: i + 2, reason: `Invalid price "${row[priceCol]}"` })
        continue
      }

      let type = 'buy'
      if (typeCol && row[typeCol]) {
        const rawType = row[typeCol].toLowerCase().trim()
        if (/sell|sold|short/.test(rawType)) {
          type = 'sell'
        } else if (/buy|bought|purchase|long|market buy/.test(rawType)) {
          type = 'buy'
        } else {
          skipped.push({ row: i + 2, reason: `Skipped type "${row[typeCol]}" (not buy/sell)` })
          continue
        }
      }

      let date = today
      if (dateCol && row[dateCol]) {
        const parsed = normalizeDate(row[dateCol])
        if (parsed) {
          date = parsed
        } else {
          skipped.push({ row: i + 2, reason: `Invalid date "${row[dateCol]}"` })
          continue
        }
      }

      transactions.push({ ticker, type, shares, price_per_share: price, date })
    }
  }

  return { transactions, skipped }
}
