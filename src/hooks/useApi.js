import { useState, useEffect, useCallback } from 'react'

let cachedToken = localStorage.getItem('folio-auth-token')

async function getAuthToken() {
  if (cachedToken) return cachedToken
  const res = await fetch('/api/auth/token')
  if (!res.ok) return null
  const data = await res.json()
  cachedToken = data.token
  localStorage.setItem('folio-auth-token', cachedToken)
  return cachedToken
}

function authHeaders() {
  const headers = {}
  if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
  return headers
}

export function useApi(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      await getAuthToken()
      const res = await fetch(url, { headers: authHeaders() })
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
  await getAuthToken()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error)
  }
  return res.json()
}

export async function putApi(url, body) {
  await getAuthToken()
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error)
  }
  return res.json()
}

export async function deleteApi(url) {
  await getAuthToken()
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error)
  }
  return res.json()
}
