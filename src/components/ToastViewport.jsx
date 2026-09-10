import { useEffect, useState } from 'react'

const EVENT_NAME = 'whisperwealth:toast'
let toastId = 0

export function notify(message, options = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: {
      message,
      tone: options.tone || 'success',
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      duration: options.duration || 4500,
    },
  }))
}

export default function ToastViewport() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onToast = (event) => {
      const id = ++toastId
      const toast = { id, ...event.detail }
      setToasts((current) => [...current.slice(-2), toast])
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id))
      }, toast.duration)
    }
    window.addEventListener(EVENT_NAME, onToast)
    return () => window.removeEventListener(EVENT_NAME, onToast)
  }, [])

  const dismiss = (id) => setToasts((current) => current.filter((toast) => toast.id !== id))

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[160] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:items-end" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
            toast.tone === 'error'
              ? 'border-red/30 bg-surface-2 text-red'
              : toast.tone === 'info'
                ? 'border-accent/30 bg-surface-2 text-text'
                : 'border-green/30 bg-surface-2 text-text'
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${toast.tone === 'error' ? 'bg-red' : toast.tone === 'info' ? 'bg-accent' : 'bg-green'}`} />
          <span className="min-w-0 flex-1 leading-snug">{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="min-h-9 rounded-lg px-2 text-xs font-semibold text-accent-hover hover:bg-accent/10"
              onClick={() => {
                toast.onAction?.()
                dismiss(toast.id)
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button type="button" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  )
}
