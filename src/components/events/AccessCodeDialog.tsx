import { useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
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
import { isAccessCodeTaken } from '@/lib/eventsAdminApi'
import { AccessCodeField } from './AccessCodeField'
import { describeSaveError, generateAccessCode, normalizeAccessCode, validateAccessCode } from './eventFormat'

type AccessCodeFormValues = {
  accessCode: string
}

type AccessCodeDialogProps = {
  event: { id: string; name: string }
  onClose: () => void
  onSave: (eventId: string, accessCode: string) => Promise<void>
}

export function AccessCodeDialog({ event, onClose, onSave }: AccessCodeDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AccessCodeFormValues>({
    defaultValues: { accessCode: generateAccessCode() },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    try {
      await onSave(event.id, normalizeAccessCode(values.accessCode))
      onClose()
    } catch (err) {
      if (isAccessCodeTaken(err)) {
        setError('accessCode', { message: 'Ten kod jest już używany przez inne wydarzenie.' })
      } else {
        console.error(err)
        setError('root', { message: describeSaveError(err, 'Nie udało się zmienić kodu.') })
      }
    } finally {
      busyRef.current = false
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy kod dostępu</DialogTitle>
          <DialogDescription>
            {event.name}: dotychczasowy kod i wszystkie udostępnione linki zaproszeń przestaną działać. Osoby, które
            już dołączyły, zachowują dostęp.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          <AccessCodeField
            id={`${id}-code`}
            label="Nowy kod *"
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
              Zmień kod
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
