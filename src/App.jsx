import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import BiometricLock, { isBiometricEnabled } from './components/BiometricLock'
import { HouseholdProvider } from './context/HouseholdContext'
import AppErrorBoundary from './components/AppErrorBoundary'
import ToastViewport from './components/ToastViewport'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Dividends = lazy(() => import('./pages/Dividends'))
const Cash = lazy(() => import('./pages/Cash'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const Settings = lazy(() => import('./pages/Settings'))
const Milestones = lazy(() => import('./pages/Milestones'))
const Expenses = lazy(() => import('./pages/Expenses'))
const RealEstate = lazy(() => import('./pages/RealEstate'))

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('folio-auth-token'))
  const [locked, setLocked] = useState(() => authed && isBiometricEnabled())

  if (!authed) {
    return <Login onLogin={() => { setAuthed(true); setLocked(isBiometricEnabled()) }} />
  }

  if (locked) {
    return <BiometricLock onUnlock={() => setLocked(false)} />
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <HouseholdProvider>
          <Routes>
            <Route element={<Layout onLogout={() => {
              localStorage.removeItem('folio-auth-token')
              setAuthed(false)
            }} />}>
              <Route path="/" element={<LazyPage component={Dashboard} />} />
              <Route path="/transactions" element={<LazyPage component={Transactions} />} />
              <Route path="/dividends" element={<LazyPage component={Dividends} />} />
              <Route path="/cash" element={<LazyPage component={Cash} />} />
              <Route path="/expenses" element={<LazyPage component={Expenses} />} />
              <Route path="/real-estate" element={<LazyPage component={RealEstate} />} />
              <Route path="/watchlist" element={<LazyPage component={Watchlist} />} />
              <Route path="/settings" element={<LazyPage component={Settings} />} />
              <Route path="/milestones" element={<LazyPage component={Milestones} />} />
            </Route>
          </Routes>
          <ToastViewport />
        </HouseholdProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}

function LazyPage({ component: Component }) {
  return <Suspense fallback={<RouteFallback />}><Component /></Suspense>
}

function RouteFallback() {
  return (
    <div className="flex min-h-56 items-center justify-center" role="status">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        Loading…
      </div>
    </div>
  )
}
