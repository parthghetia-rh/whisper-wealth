import { useState } from 'react'

export default function Login({ onLogin }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/portfolio/summary', {
        headers: { Authorization: `Bearer ${trimmed}` },
      })
      if (res.status === 401) {
        setError('Invalid token. Check your server console for the correct token.')
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      localStorage.setItem('folio-auth-token', trimmed)
      onLogin(trimmed)
    } catch {
      setError('Could not connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <svg width="48" height="48" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="34" height="34" rx="10" className="fill-accent/15 stroke-accent" strokeWidth="1.5" />
              <path d="M5 18 Q7 12, 9 18 Q11 24, 13 18" className="stroke-accent/50" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path d="M13 18 Q14.5 14, 16 18" className="stroke-accent/70" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <rect x="18" y="20" width="3.5" height="9" rx="1.2" className="fill-accent/50" />
              <rect x="23" y="15" width="3.5" height="14" rx="1.2" className="fill-accent/75" />
              <rect x="28" y="9" width="3.5" height="20" rx="1.2" className="fill-accent" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text">WhisperWealth</h1>
          <p className="text-sm text-text-muted mt-1">
            Your private financial dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-surface-2 rounded-xl border border-border p-5 space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                Auth Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token from the server console"
                autoFocus
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <div className="text-red text-xs bg-red/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Log In'}
            </button>
          </div>

          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            Your token was displayed in the server console on first launch.
            <br />
            Check <code className="text-text/70">docker logs whisperwealth</code> or your terminal output.
          </p>
        </form>
      </div>
    </div>
  )
}
