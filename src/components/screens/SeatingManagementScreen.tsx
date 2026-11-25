import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { SeatingEditorPanel } from '@/components/seating/SeatingEditorPanel'
import { ROUTES } from '@/lib/routes'

type SeatingManagementScreenProps = {
  eventId: string
  eventName: string
  nickname: string
  canView: boolean
  error: string | null
  onLogout: () => void
}

// Edytor planu sali - ADMIN i EDITOR (uprawnienia sprawdza baza).
export function SeatingManagementScreen({
  eventId,
  eventName,
  nickname,
  canView,
  error,
  onLogout,
}: SeatingManagementScreenProps) {
  return (
    <ManagementLayout
      eventName={eventName}
      nickname={nickname}
      canView={canView}
      error={error}
      breadcrumbs={[{ label: 'Zarządzanie', to: ROUTES.management }, { label: 'Plan sali' }]}
      fillViewport
      onLogout={onLogout}
    >
      <SeatingEditorPanel eventId={eventId} />
    </ManagementLayout>
  )
}
