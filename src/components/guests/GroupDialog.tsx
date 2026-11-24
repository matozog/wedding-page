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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import {
  GUEST_LIMITS,
  type GuestGroup,
  fromInviterValue,
  groupInviterValue,
  type GuestGroupInput,
} from '@/types/guest'
import { useInviterOptions } from './inviterOptionsContext'

type GroupFormValues = {
  name: string
  address: string
  // '' | JOINT_INVITER | id osoby zapraszającej
  inviter: string
}

type GroupDialogProps = {
  // null = nowa grupa
  group: GuestGroup | null
  onClose: () => void
  onSave: (input: GuestGroupInput) => Promise<void>
}

// Montowany tylko na czas edycji - wartości początkowe biorą się z grupy.
export function GroupDialog({ group, onClose, onSave }: GroupDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  const inviters = useInviterOptions()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GroupFormValues>({
    defaultValues: {
      name: group?.name ?? '',
      address: group?.address ?? '',
      inviter: group ? groupInviterValue(group) : '',
    },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    try {
      const { invitedBy, jointly } = fromInviterValue(values.inviter)
      await onSave({
        name: values.name.trim(),
        address: values.address.trim() || null,
        default_inviter_id: invitedBy,
        default_invited_jointly: jointly,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setError('root', { message: 'Nie udało się zapisać grupy.' })
    } finally {
      busyRef.current = false
    }
  })

  const nameError = errors.name?.message
  const addressError = errors.address?.message

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? 'Edycja grupy' : 'Nowa grupa'}</DialogTitle>
          <DialogDescription>
            Grupa to rodzina lub para zapraszana razem. Adres grupy jest używany dla osób bez
            własnego adresu.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void onSubmit(event)} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Nazwa</Label>
            <Input
              id={`${id}-name`}
              placeholder="np. Kowalscy"
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${id}-name-error` : undefined}
              className={cn(nameError && 'border-destructive')}
              {...register('name', {
                validate: (value) => value.trim() !== '' || 'Podaj nazwę grupy.',
                maxLength: {
                  value: GUEST_LIMITS.groupName,
                  message: `Maksymalnie ${GUEST_LIMITS.groupName} znaków.`,
                },
              })}
            />
            {nameError && (
              <p id={`${id}-name-error`} className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-address`}>Adres</Label>
            <textarea
              id={`${id}-address`}
              rows={2}
              aria-invalid={addressError ? true : undefined}
              aria-describedby={addressError ? `${id}-address-error` : undefined}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                addressError && 'border-destructive'
              )}
              {...register('address', {
                maxLength: {
                  value: GUEST_LIMITS.address,
                  message: `Maksymalnie ${GUEST_LIMITS.address} znaków.`,
                },
              })}
            />
            {addressError && (
              <p id={`${id}-address-error`} className="text-xs text-destructive">
                {addressError}
              </p>
            )}
          </div>

          {inviters.enabled && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-inviter`}>Od kogo</Label>
              <NativeSelect id={`${id}-inviter`} {...register('inviter')}>
                <option value="">—</option>
                {inviters.options.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Domyślna wartość dla nowych osób dodawanych do grupy.
              </p>
            </div>
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
              {group ? 'Zapisz' : 'Dodaj grupę'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
