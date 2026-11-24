import {
  EXPENSE_STATUS_OPTIONS,
  EXPENSE_STATUS_ORDER,
  paidAmount,
  remainingAmount,
  type BudgetCategory,
  type Expense,
  type ExpenseStatus,
  type ExpenseSummaryRow,
} from '../types/expense'
import { addDaysIso } from './money'

// Horyzont kafelka "Do zapłaty wkrótce".
export const UPCOMING_DAYS = 30

// Filtr kategorii: '' = wszystkie, NO_CATEGORY = wydatki bez kategorii.
export const NO_CATEGORY = 'none'

export type ExpenseFilters = {
  search: string
  status: ExpenseStatus | ''
  categoryId: string
  // Tylko nieopłacone po terminie (kafelek "Zaległe").
  overdueOnly: boolean
}

export const EMPTY_FILTERS: ExpenseFilters = { search: '', status: '', categoryId: '', overdueOnly: false }

export const hasActiveFilters = (filters: ExpenseFilters) =>
  filters.search.trim() !== '' || filters.status !== '' || filters.categoryId !== '' || filters.overdueOnly

export type ExpenseSortKey = 'title' | 'category' | 'total_amount' | 'paid' | 'status' | 'due_date'
export type ExpenseSort = { key: ExpenseSortKey; direction: 'asc' | 'desc' }

export const DEFAULT_SORT: ExpenseSort = { key: 'due_date', direction: 'asc' }

export const SORT_LABELS: Record<ExpenseSortKey, string> = {
  title: 'Nazwa',
  category: 'Kategoria',
  total_amount: 'Kwota',
  paid: 'Zapłacono',
  status: 'Status',
  due_date: 'Termin',
}

export const isOverdue = (expense: Pick<Expense, 'status' | 'due_date'>, today: string) =>
  expense.status !== 'PAID' && expense.due_date !== null && expense.due_date < today

// --- statystyki ------------------------------------------------------------------

export type AmountCount = { count: number; amount: number }

export type ExpenseStats = {
  count: number
  total: number
  paid: number
  remaining: number
  // 0-100, zaokrąglone w dół (100 tylko gdy wszystko opłacone)
  paidPercent: number
  overdue: AmountCount
  upcoming: AmountCount & { nextDueDate: string | null }
  byStatus: Record<ExpenseStatus, AmountCount>
}

export const computeExpenseStats = (expenses: readonly ExpenseSummaryRow[], today: string): ExpenseStats => {
  const horizon = addDaysIso(today, UPCOMING_DAYS)
  const byStatus = Object.fromEntries(
    EXPENSE_STATUS_OPTIONS.map(({ value }) => [value, { count: 0, amount: 0 }])
  ) as Record<ExpenseStatus, AmountCount>

  const stats: ExpenseStats = {
    count: expenses.length,
    total: 0,
    paid: 0,
    remaining: 0,
    paidPercent: 0,
    overdue: { count: 0, amount: 0 },
    upcoming: { count: 0, amount: 0, nextDueDate: null },
    byStatus,
  }

  for (const expense of expenses) {
    const remaining = remainingAmount(expense)

    stats.total += expense.total_amount
    stats.paid += paidAmount(expense)
    stats.remaining += remaining
    byStatus[expense.status].count += 1
    byStatus[expense.status].amount += expense.total_amount

    if (remaining <= 0 || !expense.due_date) {
      continue
    }

    if (isOverdue(expense, today)) {
      stats.overdue.count += 1
      stats.overdue.amount += remaining
    } else if (expense.due_date <= horizon) {
      stats.upcoming.count += 1
      stats.upcoming.amount += remaining
      if (!stats.upcoming.nextDueDate || expense.due_date < stats.upcoming.nextDueDate) {
        stats.upcoming.nextDueDate = expense.due_date
      }
    }
  }

  // Suma groszowych kwot w liczbach zmiennoprzecinkowych.
  stats.total = roundMoney(stats.total)
  stats.paid = roundMoney(stats.paid)
  stats.remaining = roundMoney(stats.remaining)
  stats.overdue.amount = roundMoney(stats.overdue.amount)
  stats.upcoming.amount = roundMoney(stats.upcoming.amount)
  stats.paidPercent =
    stats.total > 0 ? (stats.remaining === 0 ? 100 : Math.min(99, Math.floor((stats.paid / stats.total) * 100))) : 0

  return stats
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

// --- budżet wg kategorii --------------------------------------------------------

export type CategoryBudget = {
  // null = wydatki bez kategorii
  category: BudgetCategory | null
  planned: number | null
  spent: number
  paid: number
  count: number
}

export type BudgetSummary = {
  rows: CategoryBudget[]
  // Suma planów kategorii (null, gdy żadna kategoria nie ma planu).
  planned: number | null
  // Wydatki w kategoriach z planem - do porównania z planem.
  spentInPlanned: number
}

export const computeBudget = (
  expenses: readonly Expense[],
  categories: readonly BudgetCategory[]
): BudgetSummary => {
  const byCategory = new Map<string | null, { spent: number; paid: number; count: number }>()
  const known = new Set(categories.map((category) => category.id))

  for (const expense of expenses) {
    const key = expense.category_id && known.has(expense.category_id) ? expense.category_id : null
    const entry = byCategory.get(key) ?? { spent: 0, paid: 0, count: 0 }
    entry.spent += expense.total_amount
    entry.paid += paidAmount(expense)
    entry.count += 1
    byCategory.set(key, entry)
  }

  const rows: CategoryBudget[] = sortCategories(categories).map((category) => {
    const entry = byCategory.get(category.id)
    return {
      category,
      planned: category.planned_amount,
      spent: roundMoney(entry?.spent ?? 0),
      paid: roundMoney(entry?.paid ?? 0),
      count: entry?.count ?? 0,
    }
  })

  const uncategorized = byCategory.get(null)
  if (uncategorized) {
    rows.push({
      category: null,
      planned: null,
      spent: roundMoney(uncategorized.spent),
      paid: roundMoney(uncategorized.paid),
      count: uncategorized.count,
    })
  }

  const withPlan = rows.filter((row) => row.planned !== null)

  return {
    rows,
    planned: withPlan.length > 0 ? roundMoney(withPlan.reduce((sum, row) => sum + (row.planned ?? 0), 0)) : null,
    spentInPlanned: roundMoney(withPlan.reduce((sum, row) => sum + row.spent, 0)),
  }
}

// --- filtrowanie i sortowanie ---------------------------------------------------

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

export const sortCategories = (categories: readonly BudgetCategory[]) =>
  [...categories].sort((a, b) => collator.compare(a.name, b.name) || a.created_at.localeCompare(b.created_at))

const normalize = (text: string) =>
  text.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '')

export const filterExpenses = (
  expenses: readonly Expense[],
  filters: ExpenseFilters,
  categoriesById: ReadonlyMap<string, BudgetCategory>,
  today: string
) => {
  const query = normalize(filters.search.trim())

  return expenses.filter((expense) => {
    if (filters.status && expense.status !== filters.status) return false
    if (filters.overdueOnly && !isOverdue(expense, today)) return false

    if (filters.categoryId) {
      const categoryId =
        expense.category_id && categoriesById.has(expense.category_id) ? expense.category_id : NO_CATEGORY
      if (categoryId !== filters.categoryId) return false
    }

    if (query) {
      const category = expense.category_id ? categoriesById.get(expense.category_id)?.name : undefined
      const haystack = normalize([expense.title, category, expense.notes].filter(Boolean).join(' '))
      if (!haystack.includes(query)) return false
    }

    return true
  })
}

// Puste wartości (brak terminu, brak kategorii) zawsze na końcu.
const compareNullable = <T>(a: T | null, b: T | null, compare: (a: T, b: T) => number, sign: number) => {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return compare(a, b) * sign
}

export const sortExpenses = (
  expenses: readonly Expense[],
  sort: ExpenseSort,
  categoriesById: ReadonlyMap<string, BudgetCategory>
) => {
  const sign = sort.direction === 'asc' ? 1 : -1
  const categoryName = (expense: Expense) =>
    (expense.category_id && categoriesById.get(expense.category_id)?.name) || null

  const compare = (a: Expense, b: Expense): number => {
    switch (sort.key) {
      case 'title':
        return collator.compare(a.title, b.title) * sign
      case 'category':
        return compareNullable(categoryName(a), categoryName(b), collator.compare, sign)
      case 'total_amount':
        return (a.total_amount - b.total_amount) * sign
      case 'paid':
        return (paidAmount(a) - paidAmount(b)) * sign
      case 'status':
        return (EXPENSE_STATUS_ORDER[a.status] - EXPENSE_STATUS_ORDER[b.status]) * sign
      case 'due_date':
        return compareNullable(a.due_date, b.due_date, (x, y) => x.localeCompare(y), sign)
    }
  }

  return [...expenses].sort(
    (a, b) => compare(a, b) || collator.compare(a.title, b.title) || a.created_at.localeCompare(b.created_at)
  )
}
