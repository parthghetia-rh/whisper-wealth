import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const directory = mkdtempSync(join(tmpdir(), 'whisperwealth-smoke-'))
const port = 3199
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    DB_PATH: join(directory, 'portfolio.db'),
    TOKEN_PATH: join(directory, '.auth-token'),
    BACKUP_DIR: join(directory, 'backups'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let logs = ''
child.stdout.on('data', (chunk) => { logs += chunk })
child.stderr.on('data', (chunk) => { logs += chunk })

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
      if (response.ok) return response.json()
    } catch {}
    await wait(250)
  }
  throw new Error('Server did not become healthy')
}

try {
  const initialHealth = await waitForHealth()
  const token = readFileSync(join(directory, '.auth-token'), 'utf8').trim()
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const today = new Date().toISOString().split('T')[0]
  const transaction = await fetch(`http://127.0.0.1:${port}/api/transactions`, {
    method: 'POST', headers,
    body: JSON.stringify({ ticker: 'AAPL', type: 'buy', shares: 1, price_per_share: 100, date: today }),
  })
  if (!transaction.ok) throw new Error(`Transaction failed: ${transaction.status}`)

  const refresh = await fetch(`http://127.0.0.1:${port}/api/portfolio/quick-refresh`, {
    method: 'POST', headers, body: '{}',
  })
  if (!refresh.ok) throw new Error(`Refresh failed: ${refresh.status}`)
  const refreshResult = await refresh.json()
  const holdings = await fetch(`http://127.0.0.1:${port}/api/portfolio`, { headers }).then((res) => res.json())
  if (holdings[0]?.current_price == null) throw new Error('Holding did not receive a market price')

  const queryAuth = await fetch(`http://127.0.0.1:${port}/api/portfolio/sse?token=${token}`)
  if (queryAuth.status !== 401) throw new Error('Query-string authentication was not rejected')

  const controller = new AbortController()
  const stream = await fetch(`http://127.0.0.1:${port}/api/portfolio/sse`, {
    headers, signal: controller.signal,
  })
  const firstEvent = new TextDecoder().decode((await stream.body.getReader().read()).value)
  controller.abort()
  if (!firstEvent.includes('connected')) throw new Error('SSE did not send its initial event')

  const finalHealth = await fetch(`http://127.0.0.1:${port}/health`).then((res) => res.json())
  const backups = readdirSync(join(directory, 'backups')).filter((name) => name.endsWith('.db'))
  if (!backups.length) throw new Error('Daily backup was not created')
  console.log(JSON.stringify({
    initial_status: initialHealth.status,
    refresh: refreshResult,
    quote_status: holdings[0].quote_status,
    provider_requests: finalHealth.market.total_requests,
    request_limit: finalHealth.market.request_limit_per_minute,
    rss_mb: finalHealth.market.rss_mb,
    backups: backups.length,
    sse: 'connected',
  }, null, 2))
} catch (err) {
  console.error(err.message)
  console.error(logs)
  process.exitCode = 1
} finally {
  child.kill('SIGTERM')
  await wait(500)
  rmSync(directory, { recursive: true, force: true })
}
