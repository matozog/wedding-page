import { ExpenseManagementPanel } from '@/components/expenses/ExpenseManagementPanel'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { ROUTES } from '@/lib/routes'

type ExpensesManagementScreenProps = {
  eventId: string
  eventName: string
  nickname: string
  // Wydatki są tylko dla ADMIN - EDITOR widzi kartę "Brak dostępu".
  canView: boolean
  error: string | null
  onLogout: () => void
}

export function ExpensesManagementScreen({
  eventId,
  eventName,
  nickname,
  canView,
  error,
  onLogout,
}: ExpensesManagementScreenProps) {
  return (
    <ManagementLayout
      eventName={eventName}
      nickname={nickname}
      canView={canView}
      error={error}
      breadcrumbs={[{ label: 'Zarządzanie', to: ROUTES.management }, { label: 'Wydatki' }]}
      onLogout={onLogout}
    >
      <ExpenseManagementPanel eventId={eventId} />
    </ManagementLayout>
  )
}
