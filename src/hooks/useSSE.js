import { useEffect, useRef } from 'react'

export function useSSE(url, onMessage) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    let retryTimer

    async function connect() {
      try {
        const token = localStorage.getItem('folio-auth-token')
        const res = await fetch(url, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
          signal: controller.signal,
        })
        if (res.status === 401) {
          localStorage.removeItem('folio-auth-token')
          window.location.reload()
          return
        }
        if (!res.ok || !res.body) throw new Error(`Stream HTTP ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''
          for (const event of events) {
            const data = event.split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n')
            if (!data) continue
            try { onMessageRef.current(JSON.parse(data)) } catch {}
          }
        }
        if (!controller.signal.aborted) throw new Error('Stream ended')
      } catch (err) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          retryTimer = setTimeout(connect, 5000)
        }
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      controller.abort()
    }
  }, [url])
}
