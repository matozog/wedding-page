import { useCallback, useEffect, useState } from 'react'
import {
  createAdminEvent,
  deleteAdminEvent,
  fetchAdminEvents,
  setAdminEventAccessCode,
  updateAdminEvent,
} from '../lib/eventsAdminApi'
import type { AdminEvent, AdminEventInput } from '../types/adminEvent'

// Lista wszystkich wydarzeń w panelu super admina. Operacje rzucają błąd
// do wywołującego (formularz / okno potwierdzenia pokazuje go przy sobie),
// a po sukcesie lista jest wczytywana ponownie (liczniki z bazy).
export function useAdminEvents() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setEvents(await fetchAdminEvents())
    } catch (err) {
      console.error('Admin events error:', err)
      setError('Nie udało się wczytać wydarzeń.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const addEvent = useCallback(
    async (input: AdminEventInput, accessCode: string) => {
      const id = await createAdminEvent(input, accessCode)
      await reload()
      return id
    },
    [reload]
  )

  const editEvent = useCallback(
    async (eventId: string, input: AdminEventInput) => {
      await updateAdminEvent(eventId, input)
      await reload()
    },
    [reload]
  )

  const changeAccessCode = useCallback(async (eventId: string, accessCode: string) => {
    await setAdminEventAccessCode(eventId, accessCode)
  }, [])

  const removeEvent = useCallback(
    async (eventId: string) => {
      await deleteAdminEvent(eventId)
      await reload()
    },
    [reload]
  )

  return { events, loading, error, reload, addEvent, editEvent, changeAccessCode, removeEvent }
}
