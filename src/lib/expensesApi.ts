import {
  BUDGET_CATEGORY_SELECT_FIELDS,
  EXPENSE_SELECT_FIELDS,
  EXPENSE_SUMMARY_FIELDS,
  type BudgetCategory,
  type BudgetCategoryInput,
  type Expense,
  type ExpenseInput,
  type ExpenseSummaryRow,
} from '../types/expense'
import { supabase } from './supabase'

// Wydatki i kategorie budżetu są dostępne tylko dla ADMIN wydarzenia -
// pilnuje tego RLS. Zmiana bez uprawnień nie zwraca błędu, tylko 0 wierszy,
// stąd sprawdzanie zwróconych rekordów.

const NO_ROWS_MESSAGE = 'Zmiana nie została zapisana (brak uprawnień lub wpis już nie istnieje).'

const requireRow = <T>(rows: T[] | null): T => {
  const row = rows?.[0]

  if (!row) {
    throw new Error(NO_ROWS_MESSAGE)
  }

  return row
}

export const fetchExpenseData = async (
  eventId: string
): Promise<{ expenses: Expense[]; categories: BudgetCategory[] }> => {
  const [expensesResult, categoriesResult] = await Promise.all([
    supabase.from('expenses').select(EXPENSE_SELECT_FIELDS).eq('event_id', eventId),
    supabase.from('budget_categories').select(BUDGET_CATEGORY_SELECT_FIELDS).eq('event_id', eventId),
  ])

  if (expensesResult.error) {
    throw expensesResult.error
  }

  if (categoriesResult.error) {
    throw categoriesResult.error
  }

  return { expenses: expensesResult.data ?? [], categories: categoriesResult.data ?? [] }
}

// Podsumowanie na kafelek panelu zarządzania - tylko kwoty, statusy i terminy.
export const fetchExpenseSummary = async (eventId: string): Promise<ExpenseSummaryRow[]> => {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SUMMARY_FIELDS)
    .eq('event_id', eventId)

  if (error) {
    throw error
  }

  return data ?? []
}

export const insertExpense = async (eventId: string, input: ExpenseInput): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, event_id: eventId })
    .select(EXPENSE_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const updateExpense = async (id: string, input: ExpenseInput): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .update(input)
    .eq('id', id)
    .select(EXPENSE_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const deleteExpense = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id')

  if (error) {
    throw error
  }

  requireRow(data)
}

export const insertBudgetCategory = async (
  eventId: string,
  input: BudgetCategoryInput
): Promise<BudgetCategory> => {
  const { data, error } = await supabase
    .from('budget_categories')
    .insert({ ...input, event_id: eventId })
    .select(BUDGET_CATEGORY_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const updateBudgetCategory = async (
  id: string,
  input: BudgetCategoryInput
): Promise<BudgetCategory> => {
  const { data, error } = await supabase
    .from('budget_categories')
    .update(input)
    .eq('id', id)
    .select(BUDGET_CATEGORY_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

// Wydatki kategorii zostają, bez kategorii (FK on delete set null).
export const deleteBudgetCategory = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('budget_categories').delete().eq('id', id).select('id')

  if (error) {
    throw error
  }

  requireRow(data)
}

// Postgres 23505 - nazwa kategorii jest unikalna w wydarzeniu.
export const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === '23505'
