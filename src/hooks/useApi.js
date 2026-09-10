import { useState, useEffect, useCallback, useRef } from 'react'

function getToken() {
  return localStorage.getItem('folio-auth-token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function responseError(res) {
  const body = await res.json().catch(() => null)
  return new Error(body?.error || body?.message || `Request failed (${res.status})`)
}

function handleUnauthorized(res) {
  if (res.status !== 401) return false
  localStorage.removeItem('folio-auth-token')
  window.location.reload()
  return true
}

export function useApi(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const controllerRef = useRef(null)

  const refetch = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    try {
      const res = await fetch(url, { headers: authHeaders(), signal: controller.signal })
      if (handleUnauthorized(res)) return
      if (!res.ok) throw await responseError(res)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Unable to reach WhisperWealth')
    } finally {
      if (controllerRef.current === controller) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    refetch()
    return () => controllerRef.current?.abort()
  }, [refetch])

  return { data, loading, error, refetch }
}

async function mutationApi(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...authHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (handleUnauthorized(res)) return undefined
  if (!res.ok) throw await responseError(res)
  return res.json()
}

export function postApi(url, body) {
  return mutationApi('POST', url, body)
}

export function putApi(url, body) {
  return mutationApi('PUT', url, body)
}

export function deleteApi(url) {
  return mutationApi('DELETE', url)
}
