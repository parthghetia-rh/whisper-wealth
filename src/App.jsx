import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Dividends from './pages/Dividends'
import Cash from './pages/Cash'
import Watchlist from './pages/Watchlist'
import Settings from './pages/Settings'
import Milestones from './pages/Milestones'
import Expenses from './pages/Expenses'
import RealEstate from './pages/RealEstate'
import Login from './pages/Login'
import BiometricLock, { isBiometricEnabled } from './components/BiometricLock'
import { HouseholdProvider } from './context/HouseholdContext'

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
    <BrowserRouter>
      <HouseholdProvider>
        <Routes>
          <Route element={<Layout onLogout={() => {
            localStorage.removeItem('folio-auth-token')
            setAuthed(false)
          }} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/dividends" element={<Dividends />} />
            <Route path="/cash" element={<Cash />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/real-estate" element={<RealEstate />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/milestones" element={<Milestones />} />
          </Route>
        </Routes>
      </HouseholdProvider>
    </BrowserRouter>
  )
}
