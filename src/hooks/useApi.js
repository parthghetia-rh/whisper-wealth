import { useState, useEffect, useCallback } from 'react'

function getToken() {
  return localStorage.getItem('folio-auth-token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useApi(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(url, { headers: authHeaders() })
      if (res.status === 401) {
        localStorage.removeItem('folio-auth-token')
        window.location.reload()
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

export async function postApi(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    localStorage.removeItem('folio-auth-token')
    window.location.reload()
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error)
  }
  return res.json()
}

export async function putApi(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    localStorage.removeItem('folio-auth-token')
    window.location.reload()
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error)
  }
  return res.json()
}

export async function deleteApi(url) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (res.status === 401) {
    localStorage.removeItem('folio-auth-token')
    window.location.reload()
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error)
  }
  return res.json()
}
