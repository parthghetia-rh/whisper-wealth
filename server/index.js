import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware, getToken, getIsFirstRun } from './auth.js'
import transactionsRouter from './routes/transactions.js'
import portfolioRouter from './routes/portfolio.js'
import dividendsRouter from './routes/dividends.js'
import cashRouter from './routes/cash.js'
import watchlistRouter from './routes/watchlist.js'
import { startPoller } from './services/poller.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1'

app.use(helmet({ contentSecurityPolicy: false }))

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]

app.use(cors({ origin: allowedOrigins }))

const apiLimiter = rateLimit({ windowMs: 60_000, max: 120 })
const refreshLimiter = rateLimit({ windowMs: 60_000, max: 3 })
const importLimiter = rateLimit({ windowMs: 60_000, max: 5 })

app.use('/api/transactions/import', express.json({ limit: '10mb' }), importLimiter)
app.use(express.json({ limit: '100kb' }))

app.use('/api', apiLimiter)
app.use('/api', authMiddleware)
app.use('/api/transactions', transactionsRouter)
app.use('/api/portfolio/refresh', refreshLimiter)
app.use('/api/portfolio/quick-refresh', refreshLimiter)
app.use('/api/portfolio', portfolioRouter)
app.use('/api/dividends', dividendsRouter)
app.use('/api/cash', cashRouter)
app.use('/api/watchlist', watchlistRouter)

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  console.error(process.env.NODE_ENV === 'production' ? err.message : err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, HOST, () => {
  console.log(`WhisperWealth running at http://${HOST}:${PORT}`)
  if (getIsFirstRun()) {
    console.log('=== FIRST RUN ===')
    console.log(`Your auth token: ${getToken()}`)
    console.log('Save this token — you need it to log in.')
    console.log('This will only be shown once.')
    console.log('=================')
  } else {
    console.log('Auth token loaded from file.')
  }
  startPoller()
})
