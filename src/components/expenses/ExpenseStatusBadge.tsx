import { cn } from '@/lib/utils'
import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from '@/types/expense'
import { EXPENSE_STATUS_TONES } from './expenseTones'

export function ExpenseStatusBadge({ value, className }: { value: ExpenseStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        EXPENSE_STATUS_TONES[value].badge,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', EXPENSE_STATUS_TONES[value].dot)} aria-hidden="true" />
      {EXPENSE_STATUS_LABELS[value]}
    </span>
  )
}
