import { GuestManagementPanel } from '@/components/guests/GuestManagementPanel'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { ROUTES } from '@/lib/routes'

type GuestsManagementScreenProps = {
  eventId: string
  eventName: string
  nickname: string
  canView: boolean
  canEdit: boolean
  error: string | null
  onLogout: () => void
}

export function GuestsManagementScreen({
  eventId,
  eventName,
  nickname,
  canView,
  canEdit,
  error,
  onLogout,
}: GuestsManagementScreenProps) {
  return (
    <ManagementLayout
      eventName={eventName}
      nickname={nickname}
      canView={canView}
      error={error}
      breadcrumbs={[{ label: 'Zarządzanie', to: ROUTES.management }, { label: 'Goście' }]}
      fillViewport
      onLogout={onLogout}
    >
      <GuestManagementPanel eventId={eventId} canEdit={canEdit} />
    </ManagementLayout>
  )
}
