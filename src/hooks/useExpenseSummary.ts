import { useEffect, useState } from 'react'
import { computeExpenseStats, type ExpenseStats } from '../lib/expenseList'
import { fetchExpenseSummary } from '../lib/expensesApi'
import { todayIso } from '../lib/money'

// Liczby na kafelek "Wydatki" w panelu zarządzania (tylko ADMIN). Błąd tylko
// logujemy - kafelek działa jako link także bez podsumowania.
export function useExpenseSummary(eventId: string | null, enabled: boolean) {
  const [stats, setStats] = useState<ExpenseStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!eventId || !enabled) {
      return
    }

    let cancelled = false

    fetchExpenseSummary(eventId)
      .then((rows) => {
        if (!cancelled) setStats(computeExpenseStats(rows, todayIso()))
      })
      .catch((err) => {
        console.error('Expense summary error:', err)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, enabled])

  return { stats, failed }
}
