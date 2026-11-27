import { useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/expenses/formField'
import { fieldAria, textareaClass } from '@/components/expenses/formFieldProps'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { EVENT_PAGE_LIMITS } from '@/types/eventPage'
import type { ShoppingItem, ShoppingItemInput, ShoppingSettings } from '@/types/shopping'

type FormValues = {
  name: string
  note: string
  quantity: string
  unit: string
  assignToMe: boolean
}

type ShoppingItemFormProps = {
  settings: ShoppingSettings
  // Edycja istniejącej pozycji; brak - nowa pozycja.
  item?: ShoppingItem
  // Pole "Przypisz do mnie" (nowa pozycja, przypisywanie włączone).
  showAssignToMe?: boolean
  submitLabel: string
  // Rzuca błąd z komunikatem dla użytkownika.
  onSubmit: (input: ShoppingItemInput, assignToMe: boolean) => Promise<void>
  describeError: (err: unknown) => string
  onCancel?: () => void
  // Fokus na polu nazwy po otwarciu formularza.
  autoFocus?: boolean
  className?: string
}

const toValues = (item: ShoppingItem | undefined): FormValues => ({
  name: item?.name ?? '',
  note: item?.note ?? '',
  quantity: item ? (item.quantity === null ? '' : String(item.quantity)) : '1',
  unit: item?.unit ?? '',
  assignToMe: false,
})

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

// Formularz pozycji listy zakupów - dodawanie i edycja.
export function ShoppingItemForm({
  settings,
  item,
  showAssignToMe = false,
  submitLabel,
  onSubmit,
  describeError,
  onCancel,
  autoFocus = false,
  className,
}: ShoppingItemFormProps) {
  const id = useId()
  const busyRef = useRef(false)
  // Pola zgodne z ustawieniami listy - także w panelu organizatora.
  const showNote = settings.showNote
  const showQuantity = settings.showQuantity
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toValues(item), mode: 'onTouched' })

  const submit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    // Wyłączone pola nie trafiają do zapisu - zapisane dane zostają.
    const input: ShoppingItemInput = {
      name: values.name.trim(),
      ...(showNote && { note: orNull(values.note) }),
      ...(showQuantity && {
        quantity: values.quantity.trim() === '' ? null : Number(values.quantity),
        unit: orNull(values.unit),
      }),
    }

    try {
      await onSubmit(input, showAssignToMe && values.assignToMe)
      if (!item) reset(toValues(undefined))
    } catch (err) {
      console.error(err)
      setError('root', { message: describeError(err) })
    } finally {
      busyRef.current = false
    }
  })

  const nameId = `${id}-name`
  const noteId = `${id}-note`
  const quantityId = `${id}-quantity`
  const unitId = `${id}-unit`

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className={cn('flex flex-col gap-4', className)}>
      <div className={cn('grid gap-4', showQuantity && 'sm:grid-cols-[minmax(0,1fr)_6rem_7rem]')}>
        <FormField id={nameId} label="Co trzeba kupić lub przynieść?" error={errors.name?.message}>
          <Input
            id={nameId}
            type="text"
            autoComplete="off"
            placeholder="np. węgiel do grilla, głośnik"
            autoFocus={autoFocus}
            className="aria-invalid:border-destructive"
            {...fieldAria(nameId, errors.name?.message)}
            {...register('name', {
              validate: (value) => value.trim() !== '' || 'Wpisz nazwę.',
              maxLength: {
                value: EVENT_PAGE_LIMITS.shoppingName,
                message: `Maksymalnie ${EVENT_PAGE_LIMITS.shoppingName} znaków.`,
              },
            })}
          />
        </FormField>
        {showQuantity && (
          <>
            <FormField id={quantityId} label="Ilość" error={errors.quantity?.message}>
              <Input
                id={quantityId}
                type="number"
                inputMode="numeric"
                min={1}
                max={EVENT_PAGE_LIMITS.shoppingQuantityMax}
                step={1}
                className="aria-invalid:border-destructive"
                {...fieldAria(quantityId, errors.quantity?.message)}
                {...register('quantity', {
                  validate: (value) => {
                    if (value.trim() === '') return true
                    const number = Number(value)
                    return (
                      (Number.isInteger(number) && number >= 1 && number <= EVENT_PAGE_LIMITS.shoppingQuantityMax) ||
                      `Od 1 do ${EVENT_PAGE_LIMITS.shoppingQuantityMax}.`
                    )
                  },
                })}
              />
            </FormField>
            <FormField id={unitId} label="Jednostka" error={errors.unit?.message}>
              <Input
                id={unitId}
                type="text"
                autoComplete="off"
                placeholder="szt., kg"
                className="aria-invalid:border-destructive"
                {...fieldAria(unitId, errors.unit?.message)}
                {...register('unit', {
                  maxLength: {
                    value: EVENT_PAGE_LIMITS.shoppingUnit,
                    message: `Maksymalnie ${EVENT_PAGE_LIMITS.shoppingUnit} znaków.`,
                  },
                })}
              />
            </FormField>
          </>
        )}
      </div>

      {showNote && (
        <FormField id={noteId} label="Opis (opcjonalnie)" error={errors.note?.message}>
          <textarea
            id={noteId}
            rows={2}
            className={textareaClass}
            {...fieldAria(noteId, errors.note?.message)}
            {...register('note', {
              maxLength: {
                value: EVENT_PAGE_LIMITS.shoppingNote,
                message: `Maksymalnie ${EVENT_PAGE_LIMITS.shoppingNote} znaków.`,
              },
            })}
          />
        </FormField>
      )}

      {errors.root?.message && (
        <div role="alert">
          <ErrorMessage message={errors.root.message} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {showAssignToMe && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox {...register('assignToMe')} />
            Przypisz do mnie - zajmę się tym
          </label>
        )}
        <div className="flex flex-col-reverse gap-3 sm:ml-auto sm:flex-row">
          {onCancel && (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Anuluj
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Zapisywanie…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
