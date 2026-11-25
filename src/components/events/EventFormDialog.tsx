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
import { EVENT_LIMITS, type AdminEventInput } from '@/types/adminEvent'
import { AccessCodeField } from './AccessCodeField'
import {
  describeSaveError,
  fromDateTimeLocal,
  generateAccessCode,
  normalizeAccessCode,
  validateAccessCode,
} from './eventFormat'

type EventFormValues = {
  name: string
  startsAt: string
  accessCode: string
}

type EventFormDialogProps = {
  onClose: () => void
  // Zwraca id nowego wydarzenia.
  onCreate: (input: AdminEventInput, accessCode: string) => Promise<string>
  onCreated: (eventId: string) => void
}

// Nowe wydarzenie: nazwa, data i kod dostępu. Resztę ustawia się na stronie
// konfiguracji wydarzenia, na którą panel przechodzi po utworzeniu.
export function EventFormDialog({ onClose, onCreate, onCreated }: EventFormDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    defaultValues: {
      name: '',
      startsAt: '',
      accessCode: generateAccessCode(),
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
      const eventId = await onCreate(input, normalizeAccessCode(values.accessCode))
      onCreated(eventId)
    } catch (err) {
      if (isAccessCodeTaken(err)) {
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
          <DialogTitle>Nowe wydarzenie</DialogTitle>
          <DialogDescription>
            Goście wchodzą do wydarzenia kodem dostępu. Po utworzeniu przejdziesz do konfiguracji strony.
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

          <AccessCodeField
            id={codeId}
            label="Kod dostępu *"
            error={errors.accessCode?.message}
            registration={register('accessCode', { validate: validateAccessCode })}
            onGenerate={() => setValue('accessCode', generateAccessCode(), { shouldValidate: true, shouldDirty: true })}
          />

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
              Utwórz wydarzenie
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
