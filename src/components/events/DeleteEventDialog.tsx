import { useId, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { countPl } from '@/lib/plural'
import type { AdminEvent } from '@/types/adminEvent'

type DeleteEventDialogProps = {
  event: AdminEvent
  onClose: () => void
  onDelete: (eventId: string) => Promise<void>
}

// Usunięcie jest nieodwracalne - trzeba przepisać nazwę wydarzenia.
export function DeleteEventDialog({ event, onClose, onDelete }: DeleteEventDialogProps) {
  const id = useId()
  const [typedName, setTypedName] = useState('')
  const matches = typedName.trim() === event.name.trim()

  return (
    <ConfirmDialog
      open
      title="Usunąć wydarzenie?"
      description={
        <>
          Zostanie trwale usunięte <strong className="text-foreground">{event.name}</strong> razem z{' '}
          {countPl(event.photo_count, 'zdjęciem', 'zdjęciami', 'zdjęciami')},{' '}
          {countPl(event.guest_count, 'gościem', 'gośćmi', 'gośćmi')} na liście, budżetem i dostępem{' '}
          {countPl(event.member_count, 'uczestnika', 'uczestników', 'uczestników')}. Tego nie da się cofnąć.
        </>
      }
      confirmLabel="Usuń na zawsze"
      destructive
      confirmDisabled={!matches}
      errorMessage="Nie udało się usunąć wydarzenia. Spróbuj ponownie - usunięte już zdjęcia nie wrócą."
      onOpenChange={(open) => !open && onClose()}
      onConfirm={() => onDelete(event.id)}
    >
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor={`${id}-confirm`}>Wpisz nazwę wydarzenia, aby potwierdzić</Label>
        <Input
          id={`${id}-confirm`}
          autoComplete="off"
          value={typedName}
          placeholder={event.name}
          onChange={(e) => setTypedName(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  )
}
