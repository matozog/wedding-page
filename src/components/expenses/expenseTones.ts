import type { ExpenseStatus } from '@/types/expense'

// Kolory statusów płatności (znacznik w tabeli, filtry statystyk).
export const EXPENSE_STATUS_TONES: Record<ExpenseStatus, { badge: string; dot: string }> = {
  PAID: { badge: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-600' },
  DEPOSIT_PAID: { badge: 'bg-amber-100 text-amber-900', dot: 'bg-amber-600' },
  UNPAID: { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/60' },
}
