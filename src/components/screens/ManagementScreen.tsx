import { ChevronRight, LayoutGrid, ShoppingBasket, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { useExpenseSummary } from '@/hooks/useExpenseSummary'
import { useGuestSummary } from '@/hooks/useGuestSummary'
import { useShoppingSummary } from '@/hooks/useShoppingSummary'
import { formatPlnShort } from '@/lib/money'
import { countPl } from '@/lib/plural'
import { ROUTES } from '@/lib/routes'

// Kafelek działa jako link także bez podsumowania.
const SUMMARY_ERROR = 'Nie udało się wczytać podsumowania.'

type ManagementScreenProps = {
  eventId: string
  eventName: string
  nickname: string
  canView: boolean
  // tylko ADMIN - wydatki
  canManage: boolean
  error: string | null
  onLogout: () => void
}

function ManagementTile({
  to,
  icon,
  title,
  description,
  summary,
}: {
  to: string
  icon: ReactNode
  title: string
  description: string
  summary: ReactNode
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h2 className="flex-1 font-serif text-2xl text-foreground">{title}</h2>
        <ChevronRight
          className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="text-sm font-medium text-foreground">{summary}</p>
    </Link>
  )
}

// Strona główna zarządzania - kafelki prowadzące do kolejnych modułów.
export function ManagementScreen({
  eventId,
  eventName,
  nickname,
  canView,
  canManage,
  error,
  onLogout,
}: ManagementScreenProps) {
  const { stats, failed } = useGuestSummary(eventId, canView)
  const expenses = useExpenseSummary(eventId, canManage)
  const shopping = useShoppingSummary(eventId, canView)

  const guestSummary = stats
    ? `${countPl(stats.all.total, 'osoba', 'osoby', 'osób')} na liście · ${stats.expected.total} spodziewanych`
    : failed
      ? SUMMARY_ERROR
      : 'Wczytywanie…'

  const expenseSummary = expenses.stats
    ? expenses.stats.count === 0
      ? 'Brak wydatków'
      : [
          `${formatPlnShort(expenses.stats.paid)} z ${formatPlnShort(expenses.stats.total)} opłacone`,
          expenses.stats.overdue.count > 0 && `${expenses.stats.overdue.count} po terminie`,
        ]
          .filter(Boolean)
          .join(' · ')
    : expenses.failed
      ? SUMMARY_ERROR
      : 'Wczytywanie…'

  const shoppingSummary = shopping.summary
    ? [
        shopping.summary.count === 0
          ? 'Lista jest pusta'
          : `${countPl(shopping.summary.count, 'pozycja', 'pozycje', 'pozycji')} · ${shopping.summary.free} bez osoby`,
        !shopping.summary.sectionVisible && 'sekcja ukryta na stronie',
      ]
        .filter(Boolean)
        .join(' · ')
    : shopping.failed
      ? SUMMARY_ERROR
      : 'Wczytywanie…'

  return (
    <ManagementLayout
      eventName={eventName}
      nickname={nickname}
      canView={canView}
      error={error}
      breadcrumbs={[{ label: 'Zarządzanie' }]}
      onLogout={onLogout}
    >
      <h1 className="font-serif text-3xl text-foreground">Zarządzanie</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ManagementTile
          to={ROUTES.managementGuests}
          icon={<Users className="size-5" aria-hidden="true" />}
          title="Goście"
          description="Lista gości, grupy (rodziny) i przewidywana obecność."
          summary={guestSummary}
        />
        <ManagementTile
          to={ROUTES.managementSeating}
          icon={<LayoutGrid className="size-5" aria-hidden="true" />}
          title="Plan sali"
          description="Układ stołów, usadzanie gości i publikacja planu na stronie."
          summary="Przejdź do edytora"
        />
        <ManagementTile
          to={ROUTES.managementShopping}
          icon={<ShoppingBasket className="size-5" aria-hidden="true" />}
          title="Lista zakupów"
          description="Co trzeba kupić lub przynieść i kto się tym zajmuje."
          summary={shoppingSummary}
        />
        {canManage && (
          <ManagementTile
            to={ROUTES.managementExpenses}
            icon={<Wallet className="size-5" aria-hidden="true" />}
            title="Wydatki"
            description="Koszty, zadatki i terminy płatności, budżet wg kategorii."
            summary={expenseSummary}
          />
        )}
      </div>
    </ManagementLayout>
  )
}
