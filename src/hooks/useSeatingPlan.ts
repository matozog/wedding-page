import { useCallback, useEffect, useState } from 'react'
import { fetchSeatingPlan } from '../lib/seatingApi'
import type { SeatingPlan } from '../types/seating'

// Plan sali na stronę wydarzenia. eventId null - nie pobieramy (sekcja
// wyłączona). plan null - brak planu albo nieopublikowany (dla gościa).
export function useSeatingPlan(eventId: string | null) {
  const [state, setState] = useState<{ eventId: string | null; plan: SeatingPlan | null; failed: boolean }>({
    eventId: null,
    plan: null,
    failed: false,
  })
  // Zwiększenie wymusza ponowne pobranie (przycisk "Spróbuj ponownie").
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    fetchSeatingPlan(eventId)
      .then((plan) => {
        if (!cancelled) setState({ eventId, plan, failed: false })
      })
      .catch((err: unknown) => {
        console.error('Seating plan error:', err)
        if (!cancelled) setState({ eventId, plan: null, failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [eventId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const current = state.eventId === eventId ? state : null
  return { plan: current?.plan ?? null, failed: current?.failed ?? false, retry }
}
