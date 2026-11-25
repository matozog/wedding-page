import { useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/expenses/formField'
import { fieldAria } from '@/components/expenses/formFieldProps'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/input'
import { isAccessCodeTaken } from '@/lib/eventsAdminApi'
import { EVENT_LIMITS, type AdminEvent, type AdminEventInput } from '@/types/adminEvent'
import { AccessCodeField } from './AccessCodeField'
import {
  describeSaveError,
  fromDateTimeLocal,
  generateAccessCode,
  normalizeAccessCode,
  toDateTimeLocal,
  validateAccessCode,
} from './eventFormat'

type EventFormValues = {
  name: string
  startsAt: string
  accessCode: string
}

type EventFormDialogProps = {
  // null = nowe wydarzenie (z kodem dostępu), inaczej edycja nazwy i daty
  event: AdminEvent | null
  onClose: () => void
  onCreate: (input: AdminEventInput, accessCode: string) => Promise<unknown>
  onUpdate: (eventId: string, input: AdminEventInput) => Promise<void>
}

// Montowany tylko na czas edycji - wartości początkowe biorą się z wydarzenia.
export function EventFormDialog({ event, onClose, onCreate, onUpdate }: EventFormDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  const isNew = event === null
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    defaultValues: {
      name: event?.name ?? '',
      startsAt: toDateTimeLocal(event?.starts_at ?? null),
      accessCode: isNew ? generateAccessCode() : '',
    },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const input: AdminEventInput = {
      name: values.name.trim(),
      startsAt: fromDateTimeLocal(values.startsAt),
    }

    try {
      if (isNew) {
        await onCreate(input, normalizeAccessCode(values.accessCode))
      } else {
        await onUpdate(event.id, input)
      }
      onClose()
    } catch (err) {
      if (isNew && isAccessCodeTaken(err)) {
        setError('accessCode', { message: 'Ten kod jest już używany przez inne wydarzenie.' })
      } else {
        console.error(err)
        setError('root', { message: describeSaveError(err, 'Nie udało się zapisać wydarzenia.') })
      }
    } finally {
      busyRef.current = false
    }
  })

  const nameId = `${id}-name`
  const dateId = `${id}-date`
  const codeId = `${id}-code`
  const nameError = errors.name?.message
  const dateError = errors.startsAt?.message

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nowe wydarzenie' : 'Edycja wydarzenia'}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Goście wchodzą do wydarzenia kodem dostępu. Organizatorów wskażesz potem w „Członkowie”.'
              : 'Zmiana nazwy i daty jest od razu widoczna dla wszystkich uczestników.'}
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          <FormField id={nameId} label="Nazwa *" error={nameError}>
            <Input
              id={nameId}
              placeholder="np. Wesele Ani i Tomka"
              autoComplete="off"
              className="aria-invalid:border-destructive"
              {...fieldAria(nameId, nameError)}
              {...register('name', {
                validate: (value) => value.trim() !== '' || 'Podaj nazwę wydarzenia.',
                maxLength: { value: EVENT_LIMITS.name, message: `Maksymalnie ${EVENT_LIMITS.name} znaków.` },
              })}
            />
          </FormField>

          <FormField id={dateId} label="Data i godzina" error={dateError} hint="Opcjonalnie.">
            <Input
              id={dateId}
              type="datetime-local"
              className="aria-invalid:border-destructive"
              {...fieldAria(dateId, dateError, true)}
              {...register('startsAt', {
                validate: (value) => value === '' || fromDateTimeLocal(value) !== null || 'Podaj poprawną datę.',
              })}
            />
          </FormField>

          {isNew && (
            <AccessCodeField
              id={codeId}
              label="Kod dostępu *"
              error={errors.accessCode?.message}
              registration={register('accessCode', { validate: validateAccessCode })}
              onGenerate={() =>
                setValue('accessCode', generateAccessCode(), { shouldValidate: true, shouldDirty: true })
              }
            />
          )}

          {errors.root?.message && (
            <div role="alert">
              <ErrorMessage message={errors.root.message} />
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isNew ? 'Utwórz wydarzenie' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
