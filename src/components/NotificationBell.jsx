import { useState, useEffect, useRef } from 'react'
import { useApi, postApi } from '../hooks/useApi'

export default function NotificationBell() {
  const { data, refetch } = useApi('/api/watchlist/notifications')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)
  const [dropUp, setDropUp] = useState(false)

  const unread = data?.unread || 0
  const notifications = data?.notifications || []

  useEffect(() => {
    const interval = setInterval(refetch, 30000)
    return () => clearInterval(interval)
  }, [refetch])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropUp(rect.bottom > window.innerHeight - 300)
    }
  }, [open])

  const markRead = async () => {
    await postApi('/api/watchlist/notifications/read', {})
    refetch()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => { setOpen(!open); if (!open && unread > 0) markRead() }}
        className="p-1.5 text-text-muted hover:text-text transition-colors relative"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 6.75a4.5 4.5 0 10-9 0c0 5.25-2.25 6.75-2.25 6.75h13.5s-2.25-1.5-2.25-6.75" />
          <path d="M10.3 15.75a1.5 1.5 0 01-2.6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`fixed md:absolute w-72 bg-surface-2 border border-border rounded-xl shadow-lg z-[100] overflow-hidden ${
            dropUp
              ? 'bottom-full mb-2 left-0'
              : 'top-full mt-2 right-0'
          }`}
          style={
            typeof window !== 'undefined' && window.innerWidth < 768
              ? { position: 'fixed', top: '56px', right: '8px', left: 'auto', bottom: 'auto' }
              : undefined
          }
        >
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium">Notifications</span>
            {notifications.length > 0 && (
              <button onClick={markRead} className="text-[10px] text-accent hover:text-accent-hover">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-text-muted text-xs">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 border-b border-border/30 ${
                    !n.read ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      !n.read ? 'bg-accent' : 'bg-transparent'
                    }`} />
                    <div>
                      <p className="text-xs font-medium">{n.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{n.message}</p>
                      <p className="text-[9px] text-text-muted/60 mt-0.5">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
