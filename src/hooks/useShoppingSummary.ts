import { useEffect, useState } from 'react'
import { fetchShoppingSummary, type ShoppingSummary } from '../lib/shoppingApi'

// Podsumowanie listy zakupów (kafelek w panelu, baner o ukrytej sekcji).
// Błąd tylko logujemy - kafelek działa jako link także bez podsumowania.
export function useShoppingSummary(eventId: string | null, enabled: boolean) {
  const [summary, setSummary] = useState<ShoppingSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!eventId || !enabled) {
      return
    }

    let cancelled = false

    fetchShoppingSummary(eventId)
      .then((value) => {
        if (!cancelled) setSummary(value)
      })
      .catch((err) => {
        console.error('Shopping summary error:', err)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, enabled])

  return { summary, failed }
}
