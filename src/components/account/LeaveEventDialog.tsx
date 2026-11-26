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
      description="Na tym urządzeniu zapamiętamy Twój pseudonim. Po ponownym wpisaniu kodu wrócisz od razu, z tymi samymi zdjęciami i wpisami."
      confirmLabel="Wyjdź"
      onOpenChange={onOpenChange}
      onConfirm={onLeave}
    >
      <div className="mt-4 rounded-lg border border-border/80 bg-muted/40 p-3 text-sm text-muted-foreground">
        <p>
          Korzystasz z cudzego telefonu lub komputera? Wyjdź całkowicie - następna osoba wejdzie wtedy pod własnym
          pseudonimem. Edycja Twoich dotychczasowych zdjęć i wpisów nie będzie już możliwa.
        </p>
        <button
          type="button"
          className="mt-2 rounded-sm font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            onOpenChange(false)
            onSignOut()
          }}
        >
          To nie moje urządzenie - wyjdź całkowicie
        </button>
      </div>
    </ConfirmDialog>
  )
}
