import { ExternalLink, KeyRound } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AccessCodeDialog } from '@/components/events/AccessCodeDialog'
import { describeSaveError, fromDateTimeLocal, toDateTimeLocal } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Switch } from '@/components/ui/switch'
import { setAdminEventAccessCode, updateAdminEvent } from '@/lib/eventsAdminApi'
import { setEventGuestSharing } from '@/lib/inviteLink'
import { EVENT_LIMITS } from '@/types/adminEvent'
import type { EventPage } from '@/types/eventPage'
import { FormFooter, TextField } from './fields'
import { maxLength } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type GeneralFormValues = {
  name: string
  startsAt: string
}

type GeneralSettingsProps = {
  event: EventPage['event']
  onSaved: (name: string, startsAt: string | null) => void
  onGuestSharingSaved: (enabled: boolean) => void
  onOpenPage: () => void
}

// Nazwa, data, kod dostępu, udostępnianie przez gości i podgląd strony.
export function GeneralSettings({ event, onSaved, onGuestSharingSaved, onOpenPage }: GeneralSettingsProps) {
  const id = useId()
  const busyRef = useRef(false)
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const sharingBusyRef = useRef(false)
  const [savingSharing, setSavingSharing] = useState(false)
  const [sharingError, setSharingError] = useState<string | null>(null)

  const toggleGuestSharing = async (enabled: boolean) => {
    if (sharingBusyRef.current) return
    sharingBusyRef.current = true
    setSavingSharing(true)
    setSharingError(null)

    try {
      await setEventGuestSharing(event.id, enabled)
      onGuestSharingSaved(enabled)
    } catch (err) {
      console.error(err)
      setSharingError(describeSaveError(err, 'Nie udało się zmienić ustawienia udostępniania.'))
    } finally {
      sharingBusyRef.current = false
      setSavingSharing(false)
    }
  }
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GeneralFormValues>({
    defaultValues: { name: event.name, startsAt: toDateTimeLocal(event.starts_at) },
    mode: 'onTouched',
  })
  const { saved, markSaved } = useSavedFlag(watch)

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const name = values.name.trim()
    const startsAt = fromDateTimeLocal(values.startsAt)

    try {
      await updateAdminEvent(event.id, { name, startsAt })
      onSaved(name, startsAt)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać wydarzenia.') })
    } finally {
      busyRef.current = false
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${id}-name`}
            label="Nazwa *"
            hint="Widoczna w nagłówku i stopce strony wydarzenia."
            error={errors.name?.message}
            registration={register('name', {
              validate: (value) => value.trim() !== '' || 'Podaj nazwę wydarzenia.',
              maxLength: maxLength(EVENT_LIMITS.name),
            })}
          />
          <TextField
            id={`${id}-date`}
            type="datetime-local"
            label="Data i godzina"
            hint="Opcjonalnie."
            error={errors.startsAt?.message}
            registration={register('startsAt', {
              validate: (value) => value === '' || fromDateTimeLocal(value) !== null || 'Podaj poprawną datę.',
            })}
          />
        </div>
        <FormFooter
          error={errors.root?.message}
          saved={saved}
          submitting={isSubmitting}
        />
      </form>

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex items-start gap-3">
          <Switch
            id={`${id}-guest-sharing`}
            checked={event.guest_sharing_enabled}
            disabled={savingSharing}
            aria-busy={savingSharing}
            aria-describedby={`${id}-guest-sharing-hint`}
            onCheckedChange={(next) => void toggleGuestSharing(next)}
          />
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-guest-sharing`} className="font-medium text-foreground">
              Goście mogą udostępniać wydarzenie
            </label>
            <p id={`${id}-guest-sharing-hint`} className="text-xs text-muted-foreground" aria-live="polite">
              {savingSharing
                ? 'Zapisywanie…'
                : event.guest_sharing_enabled
                  ? 'Każdy uczestnik ma w menu osobisty link zaproszenia.'
                  : 'Link mają tylko administratorzy i edytorzy. Linki gości nie działają.'}
            </p>
          </div>
        </div>
        <ErrorMessage message={sharingError} />
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => setCodeDialogOpen(true)}>
          <KeyRound className="size-4" aria-hidden="true" />
          Zmień kod dostępu
        </Button>
        <Button type="button" variant="outline" onClick={onOpenPage}>
          <ExternalLink className="size-4" aria-hidden="true" />
          Otwórz stronę wydarzenia
        </Button>
      </div>

      {codeDialogOpen && (
        <AccessCodeDialog
          event={{ id: event.id, name: event.name }}
          onClose={() => setCodeDialogOpen(false)}
          onSave={setAdminEventAccessCode}
        />
      )}
    </div>
  )
}
