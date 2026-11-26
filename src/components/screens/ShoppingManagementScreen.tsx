import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { ShoppingManagementPanel } from '@/components/shopping/ShoppingManagementPanel'
import { ROUTES } from '@/lib/routes'

type ShoppingManagementScreenProps = {
  eventId: string
  eventName: string
  nickname: string
  userId: string | null
  // ADMIN i EDITOR - oboje edytują wszystkie pozycje.
  canView: boolean
  error: string | null
  onLogout: () => void
}

export function ShoppingManagementScreen({
  eventId,
  eventName,
  nickname,
  userId,
  canView,
  error,
  onLogout,
}: ShoppingManagementScreenProps) {
  return (
    <ManagementLayout
      eventName={eventName}
      nickname={nickname}
      canView={canView}
      error={error}
      breadcrumbs={[{ label: 'Zarządzanie', to: ROUTES.management }, { label: 'Lista zakupów' }]}
      onLogout={onLogout}
    >
      <ShoppingManagementPanel eventId={eventId} userId={userId} />
    </ManagementLayout>
  )
}
