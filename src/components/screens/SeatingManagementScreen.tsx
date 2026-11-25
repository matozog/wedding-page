import { useState } from 'react'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { SeatingEditorPanel } from '@/components/seating/SeatingEditorPanel'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  const [dirty, setDirty] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <ManagementLayout
      eventName={eventName}
      nickname={nickname}
      canView={canView}
      error={error}
      breadcrumbs={[{ label: 'Zarządzanie', to: ROUTES.management }, { label: 'Plan sali' }]}
      fillViewport
      onLogout={() => (dirty ? setConfirmLogout(true) : onLogout())}
    >
      <SeatingEditorPanel eventId={eventId} onDirtyChange={setDirty} />
      <ConfirmDialog
        open={confirmLogout}
        title="Wylogować się?"
        description="Układ sali ma niezapisane zmiany. Po wylogowaniu przepadną."
        confirmLabel="Wyloguj bez zapisu"
        destructive
        onOpenChange={(open) => !open && setConfirmLogout(false)}
        onConfirm={onLogout}
      />
    </ManagementLayout>
  )
}
