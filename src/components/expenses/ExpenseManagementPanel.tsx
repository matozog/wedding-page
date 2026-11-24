import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useExpenses } from '@/hooks/useExpenses'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  computeBudget,
  computeExpenseStats,
  filterExpenses,
  hasActiveFilters,
  sortCategories,
  sortExpenses,
  type ExpenseFilters,
  type ExpenseSort,
} from '@/lib/expenseList'
import { todayIso } from '@/lib/money'
import { countPl } from '@/lib/plural'
import type { BudgetCategory, Expense } from '@/types/expense'
import { BudgetByCategory } from './BudgetByCategory'
import { CategoryDialog } from './CategoryDialog'
import { ExpenseCardList } from './ExpenseCardList'
import { ExpenseFormDialog } from './ExpenseFormDialog'
import { ExpenseStats } from './ExpenseStats'
import { ExpenseTable } from './ExpenseTable'
import { ExpenseToolbar } from './ExpenseToolbar'

type ExpenseManagementPanelProps = {
  eventId: string
}

// Wydatki wydarzenia - tylko ADMIN (RLS egzekwuje to samo w bazie).
export function ExpenseManagementPanel({ eventId }: ExpenseManagementPanelProps) {
  const {
    expenses,
    categories,
    loading,
    error,
    reload,
    addExpense,
    editExpense,
    removeExpense,
    addCategory,
    editCategory,
    removeCategory,
  } = useExpenses(eventId)

  // Tabela z kolumnami mieści się dopiero na szerokim ekranie.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const today = useMemo(() => todayIso(), [])

  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ExpenseSort>(DEFAULT_SORT)

  // undefined = zamknięte, null = nowy wpis
  const [expenseDialog, setExpenseDialog] = useState<Expense | null | undefined>(undefined)
  const [categoryDialog, setCategoryDialog] = useState<BudgetCategory | null | undefined>(undefined)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<BudgetCategory | null>(null)

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const sortedCategories = useMemo(() => sortCategories(categories), [categories])
  const stats = useMemo(() => computeExpenseStats(expenses, today), [expenses, today])
  const budget = useMemo(() => computeBudget(expenses, categories), [expenses, categories])
  const filtered = useMemo(
    () => filterExpenses(expenses, filters, categoriesById, today),
    [expenses, filters, categoriesById, today]
  )
  const sorted = useMemo(() => sortExpenses(filtered, sort, categoriesById), [filtered, sort, categoriesById])

  const emptyMessage =
    expenses.length === 0
      ? 'Nie ma jeszcze wydatków. Zacznij od „Dodaj wydatek”.'
      : hasActiveFilters(filters) && filtered.length === 0
        ? 'Brak wydatków pasujących do filtrów.'
        : null

  const listActions = {
    onEdit: (expense: Expense) => setExpenseDialog(expense),
    onDelete: setExpenseToDelete,
  }

  // Nowy wydatek przy aktywnym filtrze kategorii trafia do tej kategorii.
  const defaultCategoryId =
    filters.categoryId && categoriesById.has(filters.categoryId) ? filters.categoryId : null

  const categoryToDeleteCount = categoryToDelete
    ? expenses.filter((expense) => expense.category_id === categoryToDelete.id).length
    : 0

  return (
    <section aria-labelledby="expenses-title" className="flex flex-col gap-4">
      <h1 id="expenses-title" className="font-serif text-3xl leading-tight text-foreground">
        Wydatki
      </h1>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-8" role="alert">
          <ErrorMessage message={error} />
          <Button type="button" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            Spróbuj ponownie
          </Button>
        </div>
      ) : loading && expenses.length === 0 && categories.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground" aria-live="polite">
          Wczytywanie wydatków…
        </p>
      ) : (
        <>
          <ExpenseStats
            stats={stats}
            plannedBudget={budget.planned}
            spentInPlanned={budget.spentInPlanned}
            activeStatus={filters.status}
            overdueOnly={filters.overdueOnly}
            onSelectStatus={(status) => setFilters((current) => ({ ...current, status }))}
            onToggleOverdue={() => setFilters((current) => ({ ...current, overdueOnly: !current.overdueOnly }))}
          />

          {filters.overdueOnly && (
            <p className="text-sm text-destructive">Pokazano tylko nieopłacone wydatki po terminie.</p>
          )}

          <ExpenseToolbar
            filters={filters}
            sort={sort}
            categories={sortedCategories}
            compact={!isDesktop}
            shownCount={filtered.length}
            totalCount={expenses.length}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            onAddExpense={() => setExpenseDialog(null)}
          />

          {isDesktop ? (
            <div className="rounded-xl border bg-card">
              <ExpenseTable
                expenses={sorted}
                categoriesById={categoriesById}
                sort={sort}
                today={today}
                emptyMessage={emptyMessage}
                onSortChange={setSort}
                {...listActions}
              />
            </div>
          ) : (
            <ExpenseCardList
              expenses={sorted}
              categoriesById={categoriesById}
              today={today}
              emptyMessage={emptyMessage}
              {...listActions}
            />
          )}

          <BudgetByCategory
            budget={budget}
            activeCategoryId={filters.categoryId}
            onSelectCategory={(categoryId) => setFilters((current) => ({ ...current, categoryId }))}
            onAddCategory={() => setCategoryDialog(null)}
            onEditCategory={(category) => setCategoryDialog(category)}
            onDeleteCategory={setCategoryToDelete}
          />
        </>
      )}

      {expenseDialog !== undefined && (
        <ExpenseFormDialog
          expense={expenseDialog}
          categories={sortedCategories}
          defaultCategoryId={defaultCategoryId}
          onClose={() => setExpenseDialog(undefined)}
          onCreateCategory={addCategory}
          onSave={async (input) => {
            if (expenseDialog) {
              await editExpense(expenseDialog.id, input)
            } else {
              await addExpense(input)
            }
          }}
        />
      )}

      {categoryDialog !== undefined && (
        <CategoryDialog
          category={categoryDialog}
          categories={categories}
          onClose={() => setCategoryDialog(undefined)}
          onSave={async (input) => {
            if (categoryDialog) {
              await editCategory(categoryDialog.id, input)
            } else {
              await addCategory(input)
            }
          }}
        />
      )}

      <ConfirmDialog
        open={expenseToDelete !== null}
        title="Usunąć wydatek?"
        description={
          expenseToDelete ? `„${expenseToDelete.title}” zniknie z listy wydatków. Tej operacji nie można cofnąć.` : ''
        }
        confirmLabel="Usuń wydatek"
        destructive
        errorMessage="Nie udało się usunąć wydatku."
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        onConfirm={async () => {
          if (!expenseToDelete) return
          await removeExpense(expenseToDelete.id)
        }}
      />

      <ConfirmDialog
        open={categoryToDelete !== null}
        title="Usunąć kategorię?"
        description={
          categoryToDelete
            ? `Kategoria „${categoryToDelete.name}” zostanie usunięta. ${
                categoryToDeleteCount > 0
                  ? `${countPl(categoryToDeleteCount, 'wydatek zostanie', 'wydatki zostaną', 'wydatków zostanie')} na liście jako „Bez kategorii”.`
                  : 'Kategoria nie ma żadnych wydatków.'
              }`
            : ''
        }
        confirmLabel="Usuń kategorię"
        destructive
        errorMessage="Nie udało się usunąć kategorii."
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
        onConfirm={async () => {
          if (!categoryToDelete) return
          await removeCategory(categoryToDelete.id)
          if (filters.categoryId === categoryToDelete.id) {
            setFilters((current) => ({ ...current, categoryId: '' }))
          }
        }}
      />
    </section>
  )
}
