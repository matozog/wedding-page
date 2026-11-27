import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type LeaveEventDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Powrót do ekranu kodu, konto zostaje na urządzeniu.
  onLeave: () => void
  // Pełne wylogowanie - konto anonimowe przepada na tym urządzeniu.
  onSignOut: () => void
}

// Wyjście gościa z kontem anonimowym (pseudonim).
export function LeaveEventDialog({ open, onOpenChange, onLeave, onSignOut }: LeaveEventDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Wyjść z wydarzenia?"
      description="Na tym urządzeniu zapamiętamy Twój pseudonim. Po ponownym wpisaniu kodu wrócisz od razu na to samo konto."
      confirmLabel="Wyjdź"
      onOpenChange={onOpenChange}
      onConfirm={onLeave}
    >
      <button
        type="button"
        className="mt-4 rounded-sm text-sm font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          onOpenChange(false)
          onSignOut()
        }}
      >
        Wyjdź z wydarzenia
      </button>
    </ConfirmDialog>
  )
}
