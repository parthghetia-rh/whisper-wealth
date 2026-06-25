import { randomBytes, timingSafeEqual } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tokenPath = process.env.TOKEN_PATH || join(__dirname, '..', '.auth-token')

let authToken
let isFirstRun = false

if (existsSync(tokenPath)) {
  authToken = readFileSync(tokenPath, 'utf-8').trim()
} else {
  authToken = randomBytes(32).toString('hex')
  writeFileSync(tokenPath, authToken + '\n', { mode: 0o600 })
  isFirstRun = true
}

export function getToken() {
  return authToken
}

export function getIsFirstRun() {
  return isFirstRun
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  const queryToken = req.query.token

  const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (
    (headerToken && safeCompare(headerToken, authToken)) ||
    (queryToken && safeCompare(queryToken, authToken))
  ) {
    return next()
  }
  return res.status(401).json({ error: 'Unauthorized' })
}
