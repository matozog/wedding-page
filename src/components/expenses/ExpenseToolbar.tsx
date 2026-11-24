import { Plus, Search, X } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  EMPTY_FILTERS,
  NO_CATEGORY,
  SORT_LABELS,
  hasActiveFilters,
  type ExpenseFilters,
  type ExpenseSort,
  type ExpenseSortKey,
} from '@/lib/expenseList'
import { pluralPl } from '@/lib/plural'
import { EXPENSE_STATUS_OPTIONS, type BudgetCategory, type ExpenseStatus } from '@/types/expense'

type ExpenseToolbarProps = {
  filters: ExpenseFilters
  sort: ExpenseSort
  categories: readonly BudgetCategory[]
  // Wąski ekran: sortowanie z listy (karty nie mają nagłówków kolumn).
  compact: boolean
  shownCount: number
  totalCount: number
  onFiltersChange: (filters: ExpenseFilters) => void
  onSortChange: (sort: ExpenseSort) => void
  onAddExpense: () => void
}

const SORT_OPTIONS = (Object.keys(SORT_LABELS) as ExpenseSortKey[]).flatMap((key) => [
  { value: `${key}:asc`, label: `${SORT_LABELS[key]} ↑` },
  { value: `${key}:desc`, label: `${SORT_LABELS[key]} ↓` },
])

export function ExpenseToolbar({
  filters,
  sort,
  categories,
  compact,
  shownCount,
  totalCount,
  onFiltersChange,
  onSortChange,
  onAddExpense,
}: ExpenseToolbarProps) {
  const id = useId()
  const update = (patch: Partial<ExpenseFilters>) => onFiltersChange({ ...filters, ...patch })
  const filtered = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 lg:max-w-80 lg:flex-1">
        <label htmlFor={`${id}-search`} className="sr-only">
          Szukaj wydatku
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={`${id}-search`}
          type="search"
          placeholder="Szukaj: nazwa, kategoria, notatka…"
          className="pl-9"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <div className="sm:w-44">
          <label htmlFor={`${id}-status`} className="sr-only">
            Status
          </label>
          <NativeSelect
            id={`${id}-status`}
            value={filters.status}
            onChange={(event) => update({ status: event.target.value as ExpenseStatus | '' })}
          >
            <option value="">Wszystkie statusy</option>
            {EXPENSE_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="sm:w-44">
          <label htmlFor={`${id}-category`} className="sr-only">
            Kategoria
          </label>
          <NativeSelect
            id={`${id}-category`}
            value={filters.categoryId}
            onChange={(event) => update({ categoryId: event.target.value })}
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value={NO_CATEGORY}>Bez kategorii</option>
          </NativeSelect>
        </div>

        {compact && (
          <div className="col-span-2 sm:w-44">
            <label htmlFor={`${id}-sort`} className="sr-only">
              Sortowanie
            </label>
            <NativeSelect
              id={`${id}-sort`}
              value={`${sort.key}:${sort.direction}`}
              onChange={(event) => {
                const [key, direction] = event.target.value.split(':') as [ExpenseSortKey, ExpenseSort['direction']]
                onSortChange({ key, direction })
              }}
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  Sortuj: {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        {filtered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="col-span-2 justify-self-start"
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
          >
            <X className="size-4" />
            Wyczyść filtry
          </Button>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 lg:ml-auto">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filtered ? `${shownCount} z ${totalCount}` : totalCount}{' '}
          {pluralPl(totalCount, 'pozycja', 'pozycje', 'pozycji')}
        </p>
        <Button type="button" onClick={onAddExpense}>
          <Plus className="size-4" />
          Dodaj wydatek
        </Button>
      </div>
    </div>
  )
}
