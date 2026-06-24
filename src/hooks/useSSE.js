import { useEffect, useRef } from 'react'

export function useSSE(url, onMessage) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    let es
    let retryTimeout

    function connect() {
      const token = localStorage.getItem('folio-auth-token')
      const separator = url.includes('?') ? '&' : '?'
      const authedUrl = token ? `${url}${separator}token=${token}` : url

      es = new EventSource(authedUrl)

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current(data)
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        es.close()
        retryTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(retryTimeout)
      es?.close()
    }
  }, [url])
}
