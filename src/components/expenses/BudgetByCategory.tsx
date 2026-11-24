import { FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NO_CATEGORY, type BudgetSummary, type CategoryBudget } from '@/lib/expenseList'
import { formatPln } from '@/lib/money'
import { countPl } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { BudgetCategory } from '@/types/expense'

type BudgetByCategoryProps = {
  budget: BudgetSummary
  activeCategoryId: string
  onSelectCategory: (categoryId: string) => void
  onAddCategory: () => void
  onEditCategory: (category: BudgetCategory) => void
  onDeleteCategory: (category: BudgetCategory) => void
}

function BudgetBar({ row }: { row: CategoryBudget }) {
  if (row.planned === null || row.planned === 0) {
    return null
  }

  const over = row.spent > row.planned
  const spentPercent = Math.min(100, (row.spent / row.planned) * 100)
  const paidPercent = Math.min(100, (row.paid / row.planned) * 100)

  // Jasny pasek - suma wydatków, ciemny - już zapłacone (względem planu).
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="img"
      aria-label={`Wydatki to ${Math.round((row.spent / row.planned) * 100)}% planu, zapłacono ${Math.round(paidPercent)}% planu`}
    >
      <div
        className={cn('absolute inset-y-0 left-0', over ? 'bg-destructive/40' : 'bg-primary/30')}
        style={{ width: `${spentPercent}%` }}
      />
      <div
        className={cn('absolute inset-y-0 left-0', over ? 'bg-destructive' : 'bg-primary')}
        style={{ width: `${paidPercent}%` }}
      />
    </div>
  )
}

// Budżet wg kategorii: plan vs suma wydatków. Kliknięcie nazwy filtruje
// tabelę wydatków.
export function BudgetByCategory({
  budget,
  activeCategoryId,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: BudgetByCategoryProps) {
  return (
    <section aria-labelledby="budget-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="budget-title" className="font-serif text-2xl text-foreground">
            Budżet wg kategorii
          </h2>
          {budget.planned !== null && (
            <p className="text-sm text-muted-foreground">
              Plan {formatPln(budget.planned)} · wydatki w kategoriach z planem{' '}
              <span className={cn(budget.spentInPlanned > budget.planned && 'font-medium text-destructive')}>
                {formatPln(budget.spentInPlanned)}
              </span>
            </p>
          )}
        </div>
        <Button type="button" variant="outline" onClick={onAddCategory}>
          <FolderPlus className="size-4" />
          Dodaj kategorię
        </Button>
      </div>

      {budget.rows.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Brak kategorii. Dodaj kategorie (np. „Sala”, „Fotograf”) z planowaną kwotą, aby porównywać budżet z
          wydatkami.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {budget.rows.map((row) => {
            const key = row.category?.id ?? NO_CATEGORY
            const name = row.category?.name ?? 'Bez kategorii'
            const pressed = activeCategoryId === key
            const difference = row.planned !== null ? row.planned - row.spent : null

            return (
              <li
                key={key}
                className={cn('flex flex-col gap-2 rounded-xl border bg-card p-4', pressed && 'ring-1 ring-primary')}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-pressed={pressed}
                    title={pressed ? 'Pokaż wszystkie wydatki' : `Pokaż tylko: ${name}`}
                    onClick={() => onSelectCategory(pressed ? '' : key)}
                    className={cn(
                      'min-w-0 flex-1 truncate rounded-sm text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      !row.category && 'italic'
                    )}
                  >
                    {name}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {countPl(row.count, 'pozycja', 'pozycje', 'pozycji')}
                  </span>
                  {row.category && (
                    <div className="-my-1 -mr-2 flex shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edytuj kategorię: ${name}`}
                        title="Edytuj kategorię"
                        onClick={() => row.category && onEditCategory(row.category)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label={`Usuń kategorię: ${name}`}
                        title="Usuń kategorię"
                        onClick={() => row.category && onDeleteCategory(row.category)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Plan</dt>
                    <dd className="tabular-nums">{row.planned !== null ? formatPln(row.planned) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Wydatki</dt>
                    <dd className="tabular-nums">{formatPln(row.spent)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Zapłacono</dt>
                    <dd className="tabular-nums">{formatPln(row.paid)}</dd>
                  </div>
                </dl>

                <BudgetBar row={row} />

                {difference !== null && (
                  <p className={cn('text-xs', difference < 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                    {difference < 0
                      ? `Przekroczono plan o ${formatPln(-difference)}`
                      : `Zostało w planie ${formatPln(difference)}`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
