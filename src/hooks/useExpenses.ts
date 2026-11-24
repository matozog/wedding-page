import { useCallback, useEffect, useState } from 'react'
import {
  deleteBudgetCategory,
  deleteExpense,
  fetchExpenseData,
  insertBudgetCategory,
  insertExpense,
  updateBudgetCategory,
  updateExpense,
} from '../lib/expensesApi'
import type { BudgetCategory, BudgetCategoryInput, Expense, ExpenseInput } from '../types/expense'

// Wydatki i kategorie budżetu wydarzenia. Zapis aktualizuje stan lokalny
// wierszem zwróconym przez bazę. Błędy zapisu są rzucane dalej - obsługuje
// je formularz / okno, w którym zaszły.
export function useExpenses(eventId: string | null) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchExpenseData(eventId)
      setExpenses(data.expenses)
      setCategories(data.categories)
    } catch (err) {
      console.error('Expenses error:', err)
      setError('Nie udało się pobrać wydatków.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const requireEventId = useCallback(() => {
    if (!eventId) {
      throw new Error('Brak wydarzenia.')
    }
    return eventId
  }, [eventId])

  const addExpense = useCallback(
    async (input: ExpenseInput) => {
      const expense = await insertExpense(requireEventId(), input)
      setExpenses((current) => [...current, expense])
      return expense
    },
    [requireEventId]
  )

  const editExpense = useCallback(async (id: string, input: ExpenseInput) => {
    const expense = await updateExpense(id, input)
    setExpenses((current) => current.map((item) => (item.id === id ? expense : item)))
    return expense
  }, [])

  const removeExpense = useCallback(async (id: string) => {
    await deleteExpense(id)
    setExpenses((current) => current.filter((item) => item.id !== id))
  }, [])

  const addCategory = useCallback(
    async (input: BudgetCategoryInput) => {
      const category = await insertBudgetCategory(requireEventId(), input)
      setCategories((current) => [...current, category])
      return category
    },
    [requireEventId]
  )

  const editCategory = useCallback(async (id: string, input: BudgetCategoryInput) => {
    const category = await updateBudgetCategory(id, input)
    setCategories((current) => current.map((item) => (item.id === id ? category : item)))
    return category
  }, [])

  const removeCategory = useCallback(async (id: string) => {
    await deleteBudgetCategory(id)
    setCategories((current) => current.filter((item) => item.id !== id))
    setExpenses((current) =>
      current.map((item) => (item.category_id === id ? { ...item, category_id: null } : item))
    )
  }, [])

  return {
    expenses,
    categories,
    loading,
    error,
    reload: load,
    addExpense,
    editExpense,
    removeExpense,
    addCategory,
    editCategory,
    removeCategory,
  }
}
