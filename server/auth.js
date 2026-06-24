import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tokenPath = process.env.TOKEN_PATH || join(__dirname, '..', '.auth-token')

let authToken

if (existsSync(tokenPath)) {
  authToken = readFileSync(tokenPath, 'utf-8').trim()
} else {
  authToken = randomBytes(32).toString('hex')
  writeFileSync(tokenPath, authToken + '\n', { mode: 0o600 })
}

export function getToken() {
  return authToken
}

export function authMiddleware(req, res, next) {
  if (req.path === '/api/auth/token') return next()

  const header = req.headers.authorization
  const queryToken = req.query.token

  if (header === `Bearer ${authToken}` || queryToken === authToken) {
    return next()
  }
  return res.status(401).json({ error: 'Unauthorized' })
}
