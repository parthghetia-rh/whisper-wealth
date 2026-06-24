import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { themes, getStoredTheme, applyTheme } from '../utils/themes'

const DEFAULT_NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/transactions', label: 'Transactions', icon: 'transactions' },
  { to: '/dividends', label: 'Dividends', icon: 'dividends' },
  { to: '/cash', label: 'Sitting Cash', icon: 'cash' },
  { to: '/watchlist', label: 'Watchlist', icon: 'watchlist' },
]

const ICONS = {
  dashboard: DashboardIcon,
  transactions: TransactionsIcon,
  dividends: DividendsIcon,
  cash: CashIcon,
  watchlist: WatchlistIcon,
}

const NAV_ORDER_KEY = 'folio-nav-order'

function getStoredOrder() {
  try {
    const saved = localStorage.getItem(NAV_ORDER_KEY)
    if (!saved) return null
    const order = JSON.parse(saved)
    const defaultPaths = DEFAULT_NAV.map((n) => n.to)
    if (
      order.length === defaultPaths.length &&
      order.every((p) => defaultPaths.includes(p))
    ) {
      return order
    }
  } catch {}
  return null
}

function getOrderedNav() {
  const order = getStoredOrder()
  if (!order) return DEFAULT_NAV
  return order.map((path) => DEFAULT_NAV.find((n) => n.to === path)).filter(Boolean)
}

export default function Layout() {
  const [currentTheme, setCurrentTheme] = useState(getStoredTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navItems, setNavItems] = useState(getOrderedNav)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const dragNode = useRef(null)
  const location = useLocation()

  useEffect(() => {
    applyTheme(currentTheme)
  }, [currentTheme])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    dragNode.current = e.target
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const updated = [...navItems]
    const [moved] = updated.splice(dragIdx, 1)
    updated.splice(idx, 0, moved)
    setNavItems(updated)
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(updated.map((n) => n.to)))
    setDragIdx(null)
    setOverIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setOverIdx(null)
  }

  const sidebar = (
    <>
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-text leading-tight">
                Folio
              </h1>
              <p className="text-[10px] text-text-muted tracking-widest uppercase">
                Tracker
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-text-muted hover:text-text"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon }, idx) => {
          const Icon = ICONS[icon]
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors select-none ${
                  isActive
                    ? 'bg-accent/15 text-accent-hover font-medium'
                    : 'text-text-muted hover:text-text hover:bg-surface-3'
                } ${dragIdx === idx ? 'opacity-40' : ''} ${
                  overIdx === idx && dragIdx !== idx
                    ? 'border-t-2 border-accent'
                    : ''
                }`
              }
            >
              <svg
                width="8" height="12" viewBox="0 0 8 12" fill="currentColor"
                className="shrink-0 cursor-grab hidden md:block"
                style={{ opacity: 0.2 }}
              >
                <circle cx="2" cy="2" r="1" />
                <circle cx="6" cy="2" r="1" />
                <circle cx="2" cy="6" r="1" />
                <circle cx="6" cy="6" r="1" />
                <circle cx="2" cy="10" r="1" />
                <circle cx="6" cy="10" r="1" />
              </svg>
              <Icon />
              {label}
            </NavLink>
          )
        })}
      </div>
      <div className="px-2 pb-2">
        <button
          onClick={() => setThemeOpen(!themeOpen)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface-3 transition-colors w-full"
        >
          <div
            className="w-4 h-4 rounded-full border border-border"
            style={{ backgroundColor: themes[currentTheme]?.swatch }}
          />
          Theme
        </button>
        {themeOpen && (
          <div className="mt-1 p-2 bg-surface-3 rounded-lg border border-border space-y-1">
            {Object.entries(themes).map(([id, theme]) => (
              <button
                key={id}
                onClick={() => {
                  setCurrentTheme(id)
                  setThemeOpen(false)
                }}
                className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  currentTheme === id
                    ? 'bg-accent/15 text-accent-hover font-medium'
                    : 'text-text-muted hover:text-text hover:bg-surface-2'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: theme.swatch }}
                />
                {theme.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border">
        <p className="text-[11px] text-text-muted">Localhost only</p>
      </div>
    </>
  )

  return (
    <div className="flex h-screen">
      <nav className="hidden md:flex w-56 bg-surface-2 border-r border-border flex-col shrink-0">
        {sidebar}
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-2 border-r border-border flex flex-col transform transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 p-3 bg-surface-2 border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-text-muted hover:text-text"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="text-sm font-semibold text-text">Folio</span>
          </div>
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  )
}

function TransactionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M2 8h12M2 12h8" />
    </svg>
  )
}

function DividendsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v6M6 7.5h4" />
    </svg>
  )
}

function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="34" height="34" rx="10" className="fill-accent/15 stroke-accent" strokeWidth="1.5" />
      <rect x="7" y="20" width="4" height="9" rx="1.5" className="fill-accent/40" />
      <rect x="13" y="16" width="4" height="13" rx="1.5" className="fill-accent/60" />
      <rect x="19" y="12" width="4" height="17" rx="1.5" className="fill-accent/80" />
      <rect x="25" y="7" width="4" height="22" rx="1.5" className="fill-accent" />
      <path d="M8 17L14 12L20 14L28 6" className="stroke-green" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 6H28V10" className="stroke-green" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WatchlistIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5v4l2.5 1.5" />
    </svg>
  )
}

function CashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M8 6v4M6.5 7.5h3" />
    </svg>
  )
}
