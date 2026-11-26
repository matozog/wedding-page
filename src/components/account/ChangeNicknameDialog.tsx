import { useEffect, useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { describeSaveError } from '@/components/events/eventFormat'
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

// Ten sam limit co w bazie (require_display_name / set_display_name).
const NICKNAME_MAX = 40

type FormValues = { nickname: string }

type ChangeNicknameDialogProps = {
  open: boolean
  nickname: string
  onOpenChange: (open: boolean) => void
  // Rzuca błąd, gdy zapis się nie uda.
  onSave: (nickname: string) => Promise<void>
}

// Zmiana pseudonimu tego samego konta - wpisy i zdjęcia zostają przy nim.
export function ChangeNicknameDialog({ open, nickname, onOpenChange, onSave }: ChangeNicknameDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { nickname }, mode: 'onTouched' })

  useEffect(() => {
    if (open) reset({ nickname })
  }, [open, nickname, reset])

  const onSubmit = handleSubmit(async ({ nickname: value }) => {
    if (busyRef.current) return
    busyRef.current = true

    try {
      await onSave(value.trim())
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać pseudonimu.') })
    } finally {
      busyRef.current = false
    }
  })

  const fieldId = `${id}-nickname`
  const fieldError = errors.nickname?.message

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <form noValidate onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Zmień pseudonim</DialogTitle>
            <DialogDescription>
              Nowa nazwa pojawi się przy Twoich zdjęciach i wpisach. Konto zostaje to samo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <FormField id={fieldId} label="Twój pseudonim" error={fieldError}>
              <Input
                id={fieldId}
                type="text"
                autoComplete="nickname"
                autoFocus
                className="aria-invalid:border-destructive"
                {...fieldAria(fieldId, fieldError)}
                {...register('nickname', {
                  validate: (value) => value.trim() !== '' || 'Wpisz pseudonim.',
                  maxLength: { value: NICKNAME_MAX, message: `Maksymalnie ${NICKNAME_MAX} znaków.` },
                })}
              />
            </FormField>
          </div>

          {errors.root?.message && (
            <div className="mt-4" role="alert">
              <ErrorMessage message={errors.root.message} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Zapisywanie…' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
