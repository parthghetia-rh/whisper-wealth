import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Dividends from './pages/Dividends'
import Cash from './pages/Cash'
import Watchlist from './pages/Watchlist'
import Login from './pages/Login'

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('folio-auth-token'))

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout onLogout={() => {
          localStorage.removeItem('folio-auth-token')
          setAuthed(false)
        }} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/cash" element={<Cash />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
