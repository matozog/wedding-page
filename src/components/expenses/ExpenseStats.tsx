import { AlertTriangle, CalendarClock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Progress } from '@/components/ui/progress'
import { UPCOMING_DAYS, type ExpenseStats as Stats } from '@/lib/expenseList'
import { formatDate, formatPln } from '@/lib/money'
import { countPl } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { EXPENSE_STATUS_OPTIONS, type ExpenseStatus } from '@/types/expense'
import { EXPENSE_STATUS_TONES } from './expenseTones'

type ExpenseStatsProps = {
  stats: Stats
  // Suma planów kategorii budżetu (null = brak planu).
  plannedBudget: number | null
  spentInPlanned: number
  activeStatus: ExpenseStatus | ''
  overdueOnly: boolean
  onSelectStatus: (value: ExpenseStatus | '') => void
  onToggleOverdue: () => void
}

function StatCard({
  label,
  value,
  children,
  className,
}: {
  label: string
  value: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-3 sm:p-4', className)}>
      <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
      <span className="text-lg font-semibold sm:text-2xl leading-tight tabular-nums text-foreground">{value}</span>
      {children}
    </div>
  )
}

const chipClass =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Kwoty nad tabelą liczone ze wszystkich wydatków (nie tylko widocznych).
// Kliknięcie statusu lub "Zaległe" filtruje listę.
export function ExpenseStats({
  stats,
  plannedBudget,
  spentInPlanned,
  activeStatus,
  overdueOnly,
  onSelectStatus,
  onToggleOverdue,
}: ExpenseStatsProps) {
  const overBudget = plannedBudget !== null && spentInPlanned > plannedBudget

  return (
    <section aria-label="Podsumowanie wydatków" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Suma wydatków" value={formatPln(stats.total)} className="col-span-2 lg:col-span-1">
          <span className="text-xs text-muted-foreground">
            {countPl(stats.count, 'pozycja', 'pozycje', 'pozycji')}
            {plannedBudget !== null && (
              <>
                {' · '}
                <span
                  className={cn(overBudget && 'font-medium text-destructive')}
                  title="Suma planowanych kwot kategorii budżetu"
                >
                  plan kategorii {formatPln(plannedBudget)}
                  {overBudget && ' (przekroczony)'}
                </span>
              </>
            )}
          </span>
        </StatCard>

        <StatCard label="Opłacono" value={formatPln(stats.paid)} className="border-emerald-600/30">
          <Progress
            value={stats.paidPercent}
            aria-label={`Opłacono ${stats.paidPercent}% sumy wydatków`}
            className="mt-1 [&>div]:bg-emerald-600"
          />
          <span className="text-xs text-muted-foreground">{stats.paidPercent}% sumy</span>
        </StatCard>

        <StatCard label="Pozostało do zapłaty" value={formatPln(stats.remaining)}>
          <span className="text-xs text-muted-foreground">
            {stats.byStatus.DEPOSIT_PAID.count > 0
              ? `w tym dopłaty do ${countPl(stats.byStatus.DEPOSIT_PAID.count, 'zadatku', 'zadatków', 'zadatków')}`
              : ' '}
          </span>
        </StatCard>

        <button
          type="button"
          aria-pressed={overdueOnly}
          disabled={stats.overdue.count === 0 && !overdueOnly}
          onClick={onToggleOverdue}
          title={overdueOnly ? 'Kliknij, aby pokazać wszystkie.' : 'Pokaż tylko zaległe.'}
          className={cn(
            'flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-3 text-left sm:p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
            stats.overdue.count > 0 && 'border-destructive/40 bg-destructive/5 hover:border-destructive',
            overdueOnly && 'ring-1 ring-destructive'
          )}
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
            <AlertTriangle
              className={cn('size-4', stats.overdue.count > 0 && 'text-destructive')}
              aria-hidden="true"
            />
            Zaległe
          </span>
          <span
            className={cn(
              'text-lg font-semibold leading-tight tabular-nums sm:text-2xl',
              stats.overdue.count > 0 ? 'text-destructive' : 'text-foreground'
            )}
          >
            {formatPln(stats.overdue.amount)}
          </span>
          <span className="text-xs text-muted-foreground">
            {stats.overdue.count > 0
              ? `${countPl(stats.overdue.count, 'pozycja', 'pozycje', 'pozycji')} po terminie`
              : 'Brak zaległości'}
          </span>
        </button>

        <StatCard label={`Do zapłaty w ${UPCOMING_DAYS} dni`} value={formatPln(stats.upcoming.amount)}>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {stats.upcoming.nextDueDate
              ? `najbliższy termin ${formatDate(stats.upcoming.nextDueDate)}`
              : 'brak terminów'}
          </span>
        </StatCard>
      </div>

      {/* Wąski ekran: jedna linia przewijana w poziomie. */}
      <div
        role="group"
        aria-label="Filtruj według statusu"
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {EXPENSE_STATUS_OPTIONS.map(({ value, label }) => {
          const { count, amount } = stats.byStatus[value]
          const pressed = activeStatus === value

          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              title={`${formatPln(amount)}. ${pressed ? 'Kliknij, aby pokazać wszystkie.' : `Pokaż tylko: ${label}.`}`}
              onClick={() => onSelectStatus(pressed ? '' : value)}
              className={cn(chipClass, pressed && 'border-primary ring-1 ring-primary')}
            >
              <span className={cn('size-2 rounded-full', EXPENSE_STATUS_TONES[value].dot)} aria-hidden="true" />
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums text-foreground">{count}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
