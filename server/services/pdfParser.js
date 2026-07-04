import pdfParse from 'pdf-parse/lib/pdf-parse.js'

const EXCHANGE_SUFFIX = {
  TSX: '.TO', XTSE: '.TO', TOR: '.TO',
  NEO: '.NE', XNEO: '.NE',
  TSXV: '.V', CNSX: '.CN',
  NYSE: '', XNYS: '', NASDAQ: '', XNAS: '', ARCA: '', BATS: '',
  NSE: '.NS', XNSE: '.NS',
  BSE: '.BO', XBOM: '.BO',
  LSE: '.L', XLON: '.L',
}

const TICKER_RE = /^[A-Z0-9.\-]{1,20}$/

const INLINE_PATTERNS = [
  {
    name: 'wealthsimple-inline',
    regex: /(?:you\s+)?(?<type>bought|sold)\s+(?<shares>[\d,.]+)\s+(?:units?\s+of\s+)?(?<ticker>[A-Z0-9.\-]+)\s+(?:at|@)\s+\$?(?<price>[\d,.]+)/gi,
  },
  {
    name: 'questrade',
    regex: /(?:order\s+executed|filled)[:\s\-]*(?<type>buy|sell)\s+(?<shares>[\d,.]+)\s+(?<ticker>[A-Z0-9.\-]+)\s+(?:@|at)\s+\$?(?<price>[\d,.]+)/gi,
  },
  {
    name: 'generic-inline',
    regex: /(?<type>buy|sell|bought|sold|purchase[d]?)\s+(?<shares>[\d,.]+)\s+(?:shares?\s+(?:of\s+)?)?(?<ticker>[A-Z0-9.\-]+)\s+(?:at|@)\s+\$?(?<price>[\d,.]+)/gi,
  },
]

const DATE_PATTERNS = [
  /(?<date>\d{4}-\d{2}-\d{2})/g,
  /(?<date>\d{2}\/\d{2}\/\d{4})/g,
  /(?<date>(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/gi,
]

function parseAmount(val) {
  return Number(val.replace(/[,\s]/g, ''))
}

function normalizeDate(val) {
  if (!val) return null
  const cleaned = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    const [m, d, y] = cleaned.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const d = new Date(cleaned)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

function extractDates(text) {
  const dates = []
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(text)) !== null) {
      const parsed = normalizeDate(m.groups?.date || m[1])
      if (parsed) dates.push(parsed)
    }
  }
  return [...new Set(dates)].sort().reverse()
}

function parseBlockFormat(text) {
  const transactions = []

  const blockRegex = /Type:\s*(?:Limit\s+|Market\s+|Fractional\s+|Stop\s+|Stop\s+Limit\s+)?(?<type>Buy|Sell)\s*\n\s*Symbol:\s*(?<ticker>[A-Z0-9.\-]+)\s*\n\s*Shares:\s*(?<shares>[\d,.]+)\s*\n\s*(?:Average\s+price|Price):\s*\$?(?<price>[\d,.]+)/gi

  let match
  while ((match = blockRegex.exec(text)) !== null) {
    const g = match.groups
    if (!g) continue

    const type = g.type.toLowerCase() === 'buy' ? 'buy' : 'sell'
    const ticker = g.ticker.toUpperCase()
    const shares = parseAmount(g.shares)
    const price = parseAmount(g.price)

    if (!TICKER_RE.test(ticker)) continue
    if (!Number.isFinite(shares) || shares <= 0) continue
    if (!Number.isFinite(price) || price <= 0) continue

    const nearbyText = text.substring(
      Math.max(0, match.index - 300),
      match.index + match[0].length + 300
    )
    const nearbyDates = extractDates(nearbyText)

    transactions.push({
      ticker,
      type,
      shares,
      price_per_share: Math.round(price * 10000) / 10000,
      date: nearbyDates[0] || null,
      source: 'wealthsimple-block',
    })
  }

  return transactions
}

function parseInlineFormat(text) {
  const transactions = []

  for (const pattern of INLINE_PATTERNS) {
    pattern.regex.lastIndex = 0
    let match
    while ((match = pattern.regex.exec(text)) !== null) {
      const g = match.groups
      if (!g) continue

      const rawType = g.type.toLowerCase()
      const type = /buy|bought|purchase/.test(rawType) ? 'buy' : 'sell'
      const ticker = g.ticker.toUpperCase()
      const shares = parseAmount(g.shares)
      const price = parseAmount(g.price)

      if (!TICKER_RE.test(ticker)) continue
      if (!Number.isFinite(shares) || shares <= 0) continue
      if (!Number.isFinite(price) || price <= 0) continue

      const nearbyText = text.substring(
        Math.max(0, match.index - 300),
        match.index + match[0].length + 300
      )
      const nearbyDates = extractDates(nearbyText)

      transactions.push({
        ticker,
        type,
        shares,
        price_per_share: Math.round(price * 10000) / 10000,
        date: nearbyDates[0] || null,
        source: pattern.name,
      })
    }
  }

  return transactions
}

export async function parsePDF(buffer) {
  const data = await pdfParse(buffer)
  const text = data.text

  if (!text || text.trim().length < 10) {
    return {
      transactions: [],
      skipped: [],
      rawText: '',
      error: 'Could not extract text from PDF. The file may be a scanned image.',
    }
  }

  const allDates = extractDates(text)
  const fallbackDate = allDates[0] || new Date().toISOString().split('T')[0]

  const blockTxns = parseBlockFormat(text)
  const inlineTxns = parseInlineFormat(text)

  const seen = new Set()
  const transactions = []

  for (const t of [...blockTxns, ...inlineTxns]) {
    const key = `${t.type}-${t.ticker}-${t.shares}-${t.price_per_share}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!t.date) t.date = fallbackDate
    transactions.push(t)
  }

  return {
    transactions,
    skipped: [],
    rawText: text.substring(0, 3000),
    datesFound: allDates,
    patternsMatched: [...new Set(transactions.map((t) => t.source))],
  }
}
