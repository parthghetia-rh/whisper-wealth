import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { themes, getStoredTheme, applyTheme } from '../utils/themes'
import NotificationBell from './NotificationBell'
import { useHousehold } from '../context/HouseholdContext'

const DEFAULT_NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', short: 'Home' },
  { to: '/transactions', label: 'Transactions', icon: 'transactions', short: 'Trade' },
  { to: '/dividends', label: 'Dividends', icon: 'dividends', short: 'Divs' },
  { to: '/cash', label: 'Sitting Cash', icon: 'cash', short: 'Cash' },
  { to: '/expenses', label: 'Expenses', icon: 'expenses', short: 'Bills' },
  { to: '/real-estate', label: 'Real Estate', icon: 'property', short: 'Homes' },
  { to: '/watchlist', label: 'Watchlist', icon: 'watchlist', short: 'Watch' },
]

const ICONS = {
  dashboard: DashboardIcon,
  transactions: TransactionsIcon,
  dividends: DividendsIcon,
  expenses: ExpensesIcon,
  property: PropertyIcon,
  cash: CashIcon,
  watchlist: WatchlistIcon,
}

const NAV_ORDER_KEY = 'folio-nav-order'
const SIDEBAR_KEY = 'folio-sidebar-collapsed'

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

export default function Layout({ onLogout }) {
  const { scope, setScope, members } = useHousehold()
  const [currentTheme, setCurrentTheme] = useState(getStoredTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const [navItems, setNavItems] = useState(getOrderedNav)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const dragNode = useRef(null)
  const location = useLocation()

  useEffect(() => {
    applyTheme(currentTheme)
  }, [currentTheme])

  useEffect(() => {
    setSettingsOpen(false)
  }, [location.pathname])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, String(next))
    if (next) setThemeOpen(false)
  }

  const handleDragStart = (e, idx) => {
    if (collapsed) return
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

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <nav
        className={`hidden md:flex bg-surface-2 border-r border-border flex-col shrink-0 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <NavLink to="/" className={`block border-b border-border ${collapsed ? 'p-3 flex justify-center' : 'p-5'} hover:bg-surface-3/30 transition-colors`}>
          {collapsed ? (
            <Logo size={28} />
          ) : (
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <h1 className="text-[15px] font-semibold tracking-tight text-text leading-tight">
                  WhisperWealth
                </h1>
                <p className="text-[9px] text-text-muted tracking-wide">
                  Private financial dashboard
                </p>
              </div>
            </div>
          )}
        </NavLink>

        <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon }, idx) => {
            const Icon = ICONS[icon]
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                draggable={!collapsed}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-sm transition-colors select-none ${
                    collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-accent/15 text-accent-hover font-medium'
                      : 'text-text-muted hover:text-text hover:bg-surface-3'
                  } ${dragIdx === idx ? 'opacity-40' : ''} ${
                    overIdx === idx && dragIdx !== idx ? 'border-t-2 border-accent' : ''
                  }`
                }
              >
                {!collapsed && (
                  <svg
                    width="8" height="12" viewBox="0 0 8 12" fill="currentColor"
                    className="shrink-0 cursor-grab"
                    style={{ opacity: 0.2 }}
                  >
                    <circle cx="2" cy="2" r="1" />
                    <circle cx="6" cy="2" r="1" />
                    <circle cx="2" cy="6" r="1" />
                    <circle cx="6" cy="6" r="1" />
                    <circle cx="2" cy="10" r="1" />
                    <circle cx="6" cy="10" r="1" />
                  </svg>
                )}
                <Icon />
                {!collapsed && label}
              </NavLink>
            )
          })}
        </div>

        <div className="px-2 pb-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center rounded-lg text-sm transition-colors ${
                collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
              } ${
                isActive
                  ? 'bg-accent/15 text-accent-hover font-medium'
                  : 'text-text-muted hover:text-text hover:bg-surface-3'
              }`
            }
            title={collapsed ? 'Settings' : undefined}
          >
            <SettingsIcon />
            {!collapsed && 'Settings'}
          </NavLink>
        </div>

        {!collapsed && (
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
        )}

        {collapsed && (
          <div className="px-2 pb-2 flex justify-center">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="p-2.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
              title="Theme"
            >
              <div
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: themes[currentTheme]?.swatch }}
              />
            </button>
          </div>
        )}

        {collapsed && themeOpen && (
          <div className="px-2 pb-2">
            <div className="p-1.5 bg-surface-3 rounded-lg border border-border space-y-0.5">
              {Object.entries(themes).map(([id, theme]) => (
                <button
                  key={id}
                  onClick={() => {
                    setCurrentTheme(id)
                    setThemeOpen(false)
                  }}
                  className={`flex justify-center w-full p-1.5 rounded-md transition-colors ${
                    currentTheme === id
                      ? 'bg-accent/15'
                      : 'hover:bg-surface-2'
                  }`}
                  title={theme.label}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: theme.swatch }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`border-t border-border ${collapsed ? 'p-2' : 'p-3'}`}>
          <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button
                onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {collapsed ? (
                  <path d="M5 3l4 4-4 4" />
                ) : (
                  <path d="M9 3l-4 4 4 4" />
                )}
              </svg>
            </button>
            </div>
            {!collapsed && (
              <>
                <p className="text-[11px] text-text-muted">Localhost only</p>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-[11px] text-text-muted hover:text-red transition-colors"
                  >
                    Log out
                  </button>
                )}
              </>
            )}
            {collapsed && onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-text-muted hover:text-red hover:bg-surface-3 transition-colors"
                title="Log out"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 1.5H11.5V12.5H9M5 4L1.5 7L5 10M1.5 7H9.5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="relative z-50 flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5 md:hidden">
          <NavLink to="/" className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <Logo size={24} />
            <span className="truncate text-sm font-semibold text-text">WhisperWealth</span>
          </NavLink>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-surface-3">
              <NotificationBell />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeOpen((open) => !open)}
                aria-label="Choose theme"
                aria-expanded={themeOpen}
                aria-controls="mobile-theme-menu"
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  themeOpen
                    ? 'bg-accent/15 text-accent-hover'
                    : 'text-text-muted hover:bg-surface-3 hover:text-text'
                }`}
              >
                <ThemeIcon />
                <span
                  className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-surface-2"
                  style={{ backgroundColor: themes[currentTheme]?.swatch }}
                />
              </button>
              {themeOpen && (
                <div
                  id="mobile-theme-menu"
                  className="absolute right-0 top-full z-[110] mt-2 w-64 rounded-xl border border-border bg-surface-2 p-2 shadow-xl"
                >
                  <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Choose theme
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(themes).map(([id, theme]) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => {
                          setCurrentTheme(id)
                          setThemeOpen(false)
                        }}
                        aria-pressed={currentTheme === id}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                          currentTheme === id
                            ? 'bg-accent/15 font-medium text-accent-hover'
                            : 'text-text-muted hover:bg-surface-3 hover:text-text'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: theme.swatch }}
                        />
                        <span className="truncate">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <NavLink
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className={({ isActive }) =>
                `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent-hover'
                    : 'text-text-muted hover:bg-surface-3 hover:text-text'
                }`
              }
            >
              <SettingsIcon size={20} />
            </NavLink>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-2 bg-surface-2/60 border-b border-border">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Portfolio view</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="max-w-52 bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
          >
            <option value="household">Combined</option>
            <option value="shared">Shared</option>
            {members.map((member) => <option key={member.id} value={member.scope}>{member.name}</option>)}
          </select>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-2 border-t border-border z-40">
          <div className="flex">
            {navItems.map(({ to, short, icon }) => {
              const Icon = ICONS[icon]
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                      isActive ? 'text-accent-hover' : 'text-text-muted'
                    }`
                  }
                >
                  <Icon />
                  {short}
                </NavLink>
              )
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
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
      <path d="M5 18 Q7 12, 9 18 Q11 24, 13 18" className="stroke-accent/50" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M13 18 Q14.5 14, 16 18" className="stroke-accent/70" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <rect x="18" y="20" width="3.5" height="9" rx="1.2" className="fill-accent/50" />
      <rect x="23" y="15" width="3.5" height="14" rx="1.2" className="fill-accent/75" />
      <rect x="28" y="9" width="3.5" height="20" rx="1.2" className="fill-accent" />
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

function SettingsIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.37.31.72.6 1 .3.26.68.4 1.1.4H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function ThemeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.87-4.03-7-9-7Z" />
      <circle cx="7.5" cy="10.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r=".75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7" r=".75" fill="currentColor" stroke="none" />
      <circle cx="17" cy="10.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ExpensesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M2 8h8M2 12h5" />
      <path d="M12 9v5M10 12h4" />
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

function PropertyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7.5L8 2l6 5.5V14H9.5v-4h-3v4H2V7.5Z" />
    </svg>
  )
}
