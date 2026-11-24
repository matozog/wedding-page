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
import { isUniqueViolation } from '@/lib/expensesApi'
import { formatAmountInput, parseAmount } from '@/lib/money'
import { EXPENSE_LIMITS, type BudgetCategory, type BudgetCategoryInput } from '@/types/expense'
import { FormField } from './formField'
import { fieldAria } from './formFieldProps'

type CategoryFormValues = {
  name: string
  plannedAmount: string
}

type CategoryDialogProps = {
  // null = nowa kategoria
  category: BudgetCategory | null
  categories: readonly BudgetCategory[]
  onClose: () => void
  onSave: (input: BudgetCategoryInput) => Promise<void>
}

// Montowany tylko na czas edycji - wartości początkowe biorą się z kategorii.
export function CategoryDialog({ category, categories, onClose, onSave }: CategoryDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    defaultValues: {
      name: category?.name ?? '',
      plannedAmount: formatAmountInput(category?.planned_amount ?? null),
    },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    try {
      await onSave({ name: values.name.trim(), planned_amount: parseAmount(values.plannedAmount) })
      onClose()
    } catch (err) {
      if (isUniqueViolation(err)) {
        setError('name', { message: 'Kategoria o tej nazwie już istnieje.' })
      } else {
        console.error(err)
        setError('root', { message: 'Nie udało się zapisać kategorii.' })
      }
    } finally {
      busyRef.current = false
    }
  })

  const nameId = `${id}-name`
  const plannedId = `${id}-planned`
  const nameError = errors.name?.message
  const plannedError = errors.plannedAmount?.message

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edycja kategorii' : 'Nowa kategoria'}</DialogTitle>
          <DialogDescription>
            Planowana kwota to budżet kategorii - porównujemy ją z sumą wydatków w tej kategorii.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void onSubmit(event)} className="mt-6 flex flex-col gap-4">
          <FormField id={nameId} label="Nazwa *" error={nameError}>
            <Input
              id={nameId}
              placeholder="np. Sala i catering"
              autoComplete="off"
              className="aria-invalid:border-destructive"
              {...fieldAria(nameId, nameError)}
              {...register('name', {
                validate: (value) => {
                  const name = value.trim()
                  if (name === '') return 'Podaj nazwę kategorii.'
                  const lower = name.toLocaleLowerCase('pl')
                  const duplicate = categories.some(
                    (item) => item.id !== category?.id && item.name.toLocaleLowerCase('pl') === lower
                  )
                  return !duplicate || 'Kategoria o tej nazwie już istnieje.'
                },
                maxLength: {
                  value: EXPENSE_LIMITS.categoryName,
                  message: `Maksymalnie ${EXPENSE_LIMITS.categoryName} znaków.`,
                },
              })}
            />
          </FormField>

          <FormField
            id={plannedId}
            label="Planowana kwota (zł)"
            error={plannedError}
            hint="Opcjonalnie. Bez kwoty kategoria tylko grupuje wydatki."
          >
            <Input
              id={plannedId}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              className="aria-invalid:border-destructive"
              {...fieldAria(plannedId, plannedError, true)}
              {...register('plannedAmount', {
                validate: (value) => {
                  const amount = parseAmount(value)
                  if (amount === null) return true
                  if (Number.isNaN(amount)) return 'Podaj kwotę, np. 15000 albo 15000,50.'
                  return amount <= EXPENSE_LIMITS.maxAmount || 'Kwota jest za duża.'
                },
              })}
            />
          </FormField>

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
              {category ? 'Zapisz' : 'Dodaj kategorię'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
