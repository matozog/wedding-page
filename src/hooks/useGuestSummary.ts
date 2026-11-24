import { useEffect, useState } from 'react'
import { computeGuestStats, type GuestStats } from '../lib/guestList'
import { fetchGuestSummary } from '../lib/guestsApi'

// Liczby na kafelek "Goście" w panelu zarządzania. Błąd tylko logujemy -
// kafelek działa jako link także bez podsumowania.
export function useGuestSummary(eventId: string | null, enabled: boolean) {
  const [stats, setStats] = useState<GuestStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!eventId || !enabled) {
      return
    }

    let cancelled = false

    fetchGuestSummary(eventId)
      .then((rows) => {
        if (!cancelled) setStats(computeGuestStats(rows))
      })
      .catch((err) => {
        console.error('Guest summary error:', err)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, enabled])

  return { stats, failed }
}
