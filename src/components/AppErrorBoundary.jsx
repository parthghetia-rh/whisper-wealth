import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('WhisperWealth interface error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-6 text-text">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface-2 p-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red/10 text-red">!</div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">Your data is safe. Reload the interface to reconnect to WhisperWealth.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-hover">
            Reload app
          </button>
        </div>
      </main>
    )
  }
}
