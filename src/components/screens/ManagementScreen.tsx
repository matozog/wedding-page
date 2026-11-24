import { ChevronRight, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { useGuestSummary } from '@/hooks/useGuestSummary'
import { countPl } from '@/lib/plural'
import { ROUTES } from '@/lib/routes'

type ManagementScreenProps = {
  eventId: string
  eventName: string
  nickname: string
  canView: boolean
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
  error,
  onLogout,
}: ManagementScreenProps) {
  const { stats, failed } = useGuestSummary(eventId, canView)

  const guestSummary = stats
    ? `${countPl(stats.all.total, 'osoba', 'osoby', 'osób')} na liście · ${stats.expected.total} spodziewanych`
    : failed
      ? ' '
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
      </div>
    </ManagementLayout>
  )
}
