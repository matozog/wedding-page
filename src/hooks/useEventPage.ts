import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchEventPage } from '../lib/eventPageApi'
import type { EventPage } from '../types/eventPage'

// Konfiguracja strony wydarzenia (motyw, sekcje, treści). notFound - brak
// wydarzenia albo dostępu do niego.
export function useEventPage(eventId: string | null) {
  const [page, setPage] = useState<EventPage | null>(null)
  const [loading, setLoading] = useState(eventId !== null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Odpowiedź dla poprzedniego wydarzenia nie nadpisuje stanu.
  const loadIdRef = useRef(0)
  // Wydarzenie, którego strona jest w stanie - przy zmianie stara strona znika,
  // przy ponownym wczytaniu tego samego zostaje na ekranie.
  const loadedEventIdRef = useRef<string | null>(null)

  const reload = useCallback(async () => {
    const loadId = ++loadIdRef.current
    setNotFound(false)
    setError(null)

    if (loadedEventIdRef.current !== eventId) {
      loadedEventIdRef.current = eventId
      setPage(null)
    }

    if (!eventId) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const value = await fetchEventPage(eventId)
      if (loadId !== loadIdRef.current) return
      setPage(value)
      setNotFound(value === null)
    } catch (err) {
      if (loadId !== loadIdRef.current) return
      console.error('Event page error:', err)
      setError('Nie udało się wczytać strony wydarzenia.')
    } finally {
      if (loadId === loadIdRef.current) setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { page, setPage, loading, error, notFound, reload }
}
