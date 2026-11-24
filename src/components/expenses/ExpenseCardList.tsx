import { CalendarDays, Pencil, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPln } from '@/lib/money'
import { paidAmount, remainingAmount, type BudgetCategory, type Expense } from '@/types/expense'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { DueDate, type ExpenseListActions } from './ExpenseTable'

type ExpenseCardListProps = ExpenseListActions & {
  expenses: readonly Expense[]
  categoriesById: ReadonlyMap<string, BudgetCategory>
  today: string
  emptyMessage: string | null
}

export function ExpenseCardList({
  expenses,
  categoriesById,
  today,
  emptyMessage,
  onEdit,
  onDelete,
}: ExpenseCardListProps) {
  if (emptyMessage) {
    return <p className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {expenses.map((expense) => {
        const category = expense.category_id ? categoriesById.get(expense.category_id) : undefined
        const paid = paidAmount(expense)

        return (
          <li key={expense.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{expense.title}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatPln(expense.total_amount)}
                </p>
              </div>
              <ExpenseStatusBadge value={expense.status} className="shrink-0" />
            </div>

            <div className="mt-2 flex flex-col gap-1 text-sm">
              {paid > 0 && expense.status !== 'PAID' && (
                <p className="text-muted-foreground">
                  Zapłacono <span className="tabular-nums text-foreground">{formatPln(paid)}</span>, zostało{' '}
                  <span className="tabular-nums text-foreground">{formatPln(remainingAmount(expense))}</span>
                </p>
              )}
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-label="Termin" />
                <DueDate expense={expense} today={today} />
              </p>
              {category && (
                <p className="flex items-center gap-2">
                  <Tag className="size-4 shrink-0 text-muted-foreground" aria-label="Kategoria" />
                  {category.name}
                </p>
              )}
              {expense.notes && <p className="whitespace-pre-line text-muted-foreground">{expense.notes}</p>}
            </div>

            <div className="mt-3 flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(expense)}
                aria-label={`Edytuj: ${expense.title}`}
              >
                <Pencil className="size-4" />
                Edytuj
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(expense)}
                aria-label={`Usuń: ${expense.title}`}
              >
                <Trash2 className="size-4" />
                Usuń
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
