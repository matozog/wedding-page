import { ExternalLink, KeyRound } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AccessCodeDialog } from '@/components/events/AccessCodeDialog'
import { describeSaveError, fromDateTimeLocal, toDateTimeLocal } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { setAdminEventAccessCode, updateAdminEvent } from '@/lib/eventsAdminApi'
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
  onOpenPage: () => void
}

// Nazwa, data, kod dostępu i podgląd strony wydarzenia.
export function GeneralSettings({ event, onSaved, onOpenPage }: GeneralSettingsProps) {
  const id = useId()
  const busyRef = useRef(false)
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
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
