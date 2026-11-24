import type { Database } from './database'

type Enums = Database['public']['Enums']
type ExpenseRow = Database['public']['Tables']['expenses']['Row']
type BudgetCategoryRow = Database['public']['Tables']['budget_categories']['Row']

export type ExpenseStatus = Enums['expense_status']

export type Expense = Pick<
  ExpenseRow,
  | 'id'
  | 'category_id'
  | 'title'
  | 'total_amount'
  | 'deposit_amount'
  | 'status'
  | 'due_date'
  | 'notes'
  | 'created_at'
>

export type BudgetCategory = Pick<BudgetCategoryRow, 'id' | 'name' | 'planned_amount' | 'created_at'>

// Pola edytowane w panelu (event_id dokłada warstwa API).
export type ExpenseInput = Omit<Expense, 'id' | 'created_at'>
export type BudgetCategoryInput = Omit<BudgetCategory, 'id' | 'created_at'>

// Podsumowanie na kafelek panelu zarządzania.
export type ExpenseSummaryRow = Pick<Expense, 'status' | 'total_amount' | 'deposit_amount' | 'due_date'>

export const EXPENSE_SELECT_FIELDS =
  'id, category_id, title, total_amount, deposit_amount, status, due_date, notes, created_at' as const
export const BUDGET_CATEGORY_SELECT_FIELDS = 'id, name, planned_amount, created_at' as const
export const EXPENSE_SUMMARY_FIELDS = 'status, total_amount, deposit_amount, due_date' as const

// Kolejność = kolejność filtrów i sortowania po statusie.
export const EXPENSE_STATUS_OPTIONS: readonly { value: ExpenseStatus; label: string }[] = [
  { value: 'UNPAID', label: 'Nieopłacone' },
  { value: 'DEPOSIT_PAID', label: 'Zapłacono zadatek' },
  { value: 'PAID', label: 'Zapłacone' },
]

export const EXPENSE_STATUS_LABELS = Object.fromEntries(
  EXPENSE_STATUS_OPTIONS.map(({ value, label }) => [value, label])
) as Record<ExpenseStatus, string>

export const EXPENSE_STATUS_ORDER = Object.fromEntries(
  EXPENSE_STATUS_OPTIONS.map(({ value }, index) => [value, index])
) as Record<ExpenseStatus, number>

// Limity z migracji 20261121100600_event_planning.sql i
// 20261124130000_expense_tracking.sql (numeric(12,2)).
export const EXPENSE_LIMITS = {
  title: 120,
  notes: 2000,
  categoryName: 60,
  maxAmount: 9_999_999_999.99,
} as const

// Kwota już zapłacona: całość albo zadatek.
export const paidAmount = (expense: Pick<Expense, 'status' | 'total_amount' | 'deposit_amount'>) =>
  expense.status === 'PAID'
    ? expense.total_amount
    : expense.status === 'DEPOSIT_PAID'
      ? (expense.deposit_amount ?? 0)
      : 0

export const remainingAmount = (expense: Pick<Expense, 'status' | 'total_amount' | 'deposit_amount'>) =>
  Math.max(0, expense.total_amount - paidAmount(expense))
