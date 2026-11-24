import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isOverdue, type ExpenseSort, type ExpenseSortKey } from '@/lib/expenseList'
import { formatDate, formatPln } from '@/lib/money'
import { cn } from '@/lib/utils'
import { paidAmount, type BudgetCategory, type Expense } from '@/types/expense'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'

export type ExpenseListActions = {
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}

type ExpenseTableProps = ExpenseListActions & {
  expenses: readonly Expense[]
  categoriesById: ReadonlyMap<string, BudgetCategory>
  sort: ExpenseSort
  today: string
  emptyMessage: string | null
  onSortChange: (sort: ExpenseSort) => void
}

function SortableHead({
  label,
  sortKey,
  sort,
  className,
  onSortChange,
}: {
  label: string
  sortKey: ExpenseSortKey
  sort: ExpenseSort
  className?: string
  onSortChange: (sort: ExpenseSort) => void
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={cn(
          '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-foreground'
        )}
        onClick={() =>
          onSortChange({ key: sortKey, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })
        }
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    </TableHead>
  )
}

export function DueDate({ expense, today }: { expense: Expense; today: string }) {
  if (!expense.due_date) {
    return <span className="text-muted-foreground">—</span>
  }

  const overdue = isOverdue(expense, today)

  return (
    <span className={cn('whitespace-nowrap', overdue && 'font-medium text-destructive')}>
      {formatDate(expense.due_date)}
      {overdue && <span className="sr-only"> (po terminie)</span>}
    </span>
  )
}

export function ExpenseTable({
  expenses,
  categoriesById,
  sort,
  today,
  emptyMessage,
  onSortChange,
  onEdit,
  onDelete,
}: ExpenseTableProps) {
  const sortProps = { sort, onSortChange }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="Nazwa" sortKey="title" {...sortProps} />
          <SortableHead label="Kategoria" sortKey="category" {...sortProps} />
          <SortableHead label="Kwota" sortKey="total_amount" className="text-right" {...sortProps} />
          <SortableHead label="Zapłacono" sortKey="paid" className="text-right" {...sortProps} />
          <SortableHead label="Status" sortKey="status" {...sortProps} />
          <SortableHead label="Termin" sortKey="due_date" {...sortProps} />
          <TableHead className="text-right">
            <span className="sr-only">Akcje</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {expenses.map((expense) => {
          const category = expense.category_id ? categoriesById.get(expense.category_id) : undefined
          const paid = paidAmount(expense)

          return (
            <TableRow key={expense.id} className="hover:bg-muted/40" onDoubleClick={() => onEdit(expense)}>
              <TableCell className="max-w-80">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{expense.title}</span>
                  {expense.notes && (
                    <span className="truncate text-xs text-muted-foreground" title={expense.notes}>
                      {expense.notes}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{category?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatPln(expense.total_amount)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {paid > 0 ? formatPln(paid) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <ExpenseStatusBadge value={expense.status} />
              </TableCell>
              <TableCell>
                <DueDate expense={expense} today={today} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Edytuj: ${expense.title}`}
                    title="Edytuj"
                    onClick={() => onEdit(expense)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    aria-label={`Usuń: ${expense.title}`}
                    title="Usuń"
                    onClick={() => onDelete(expense)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}

        {emptyMessage && (
          <TableRow>
            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
