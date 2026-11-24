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
import { NativeSelect } from '@/components/ui/native-select'
import { isUniqueViolation } from '@/lib/expensesApi'
import { formatAmountInput, parseAmount } from '@/lib/money'
import {
  EXPENSE_LIMITS,
  EXPENSE_STATUS_OPTIONS,
  type BudgetCategory,
  type BudgetCategoryInput,
  type Expense,
  type ExpenseInput,
  type ExpenseStatus,
} from '@/types/expense'
import { FormField } from './formField'
import { fieldAria, textareaClass } from './formFieldProps'

// Wartość pola kategorii oznaczająca "utwórz nową".
const NEW_CATEGORY = '__new__'

type ExpenseFormValues = {
  title: string
  totalAmount: string
  status: ExpenseStatus
  depositAmount: string
  dueDate: string
  categoryId: string
  newCategoryName: string
  notes: string
}

type ExpenseFormDialogProps = {
  // null = nowy wydatek
  expense: Expense | null
  // Kategorie posortowane do wyświetlenia.
  categories: readonly BudgetCategory[]
  defaultCategoryId?: string | null
  onClose: () => void
  onCreateCategory: (input: BudgetCategoryInput) => Promise<BudgetCategory>
  onSave: (input: ExpenseInput) => Promise<void>
}

const validateAmount = (text: string, { required }: { required: boolean }) => {
  const value = parseAmount(text)

  if (value === null) {
    return required ? 'Podaj kwotę.' : true
  }

  if (Number.isNaN(value)) {
    return 'Podaj kwotę, np. 1500 albo 1500,50.'
  }

  if (value > EXPENSE_LIMITS.maxAmount) {
    return 'Kwota jest za duża.'
  }

  return true
}

// Montowany tylko na czas edycji - wartości początkowe biorą się z wydatku.
export function ExpenseFormDialog({
  expense,
  categories,
  defaultCategoryId = null,
  onClose,
  onCreateCategory,
  onSave,
}: ExpenseFormDialogProps) {
  const id = useId()
  const busyRef = useRef(false)
  // Kategoria utworzona przy nieudanym zapisie wydatku - ponowna próba jej
  // nie dubluje.
  const createdCategoryRef = useRef<{ name: string; id: string } | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    defaultValues: {
      title: expense?.title ?? '',
      totalAmount: formatAmountInput(expense?.total_amount ?? null),
      status: expense?.status ?? 'UNPAID',
      depositAmount: formatAmountInput(expense?.deposit_amount ?? null),
      dueDate: expense?.due_date ?? '',
      categoryId: expense?.category_id ?? defaultCategoryId ?? '',
      newCategoryName: '',
      notes: expense?.notes ?? '',
    },
    mode: 'onTouched',
  })

  const status = watch('status')
  const categoryId = watch('categoryId')

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    try {
      let category = values.categoryId || null

      if (category === NEW_CATEGORY) {
        const name = values.newCategoryName.trim()
        try {
          if (createdCategoryRef.current?.name !== name) {
            const created = await onCreateCategory({ name, planned_amount: null })
            createdCategoryRef.current = { name, id: created.id }
          }
          category = createdCategoryRef.current?.id ?? null
        } catch (err) {
          if (isUniqueViolation(err)) {
            setError('newCategoryName', { message: 'Kategoria o tej nazwie już istnieje.' })
            return
          }
          throw err
        }
      }

      await onSave({
        title: values.title.trim(),
        total_amount: parseAmount(values.totalAmount) ?? 0,
        status: values.status,
        deposit_amount: values.status === 'DEPOSIT_PAID' ? parseAmount(values.depositAmount) : null,
        due_date: values.dueDate || null,
        category_id: category,
        notes: values.notes.trim() || null,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setError('root', { message: 'Nie udało się zapisać wydatku.' })
    } finally {
      busyRef.current = false
    }
  })

  const fieldId = (name: keyof ExpenseFormValues) => `${id}-${name}`
  const fieldErrors = {
    title: errors.title?.message,
    totalAmount: errors.totalAmount?.message,
    depositAmount: errors.depositAmount?.message,
    newCategoryName: errors.newCategoryName?.message,
    notes: errors.notes?.message,
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edycja wydatku' : 'Nowy wydatek'}</DialogTitle>
          <DialogDescription>Kwoty w złotych. Pola z gwiazdką są wymagane.</DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void onSubmit(event)} className="mt-6 flex flex-col gap-4">
          <FormField id={fieldId('title')} label="Nazwa *" error={fieldErrors.title}>
            <Input
              id={fieldId('title')}
              placeholder="np. Fotograf"
              autoComplete="off"
              className="aria-invalid:border-destructive"
              {...fieldAria(fieldId('title'), fieldErrors.title)}
              {...register('title', {
                validate: (value) => value.trim() !== '' || 'Podaj nazwę wydatku.',
                maxLength: {
                  value: EXPENSE_LIMITS.title,
                  message: `Maksymalnie ${EXPENSE_LIMITS.title} znaków.`,
                },
              })}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={fieldId('totalAmount')} label="Kwota (zł) *" error={fieldErrors.totalAmount}>
              <Input
                id={fieldId('totalAmount')}
                inputMode="decimal"
                placeholder="0,00"
                autoComplete="off"
                className="aria-invalid:border-destructive"
                {...fieldAria(fieldId('totalAmount'), fieldErrors.totalAmount)}
                {...register('totalAmount', {
                  validate: (value) => validateAmount(value, { required: true }),
                })}
              />
            </FormField>

            <FormField id={fieldId('dueDate')} label="Termin płatności">
              <Input id={fieldId('dueDate')} type="date" {...register('dueDate')} />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={fieldId('status')} label="Status">
              <NativeSelect id={fieldId('status')} {...register('status')}>
                {EXPENSE_STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            {status === 'DEPOSIT_PAID' && (
              <FormField id={fieldId('depositAmount')} label="Zadatek (zł) *" error={fieldErrors.depositAmount}>
                <Input
                  id={fieldId('depositAmount')}
                  inputMode="decimal"
                  placeholder="0,00"
                  autoComplete="off"
                  className="aria-invalid:border-destructive"
                  {...fieldAria(fieldId('depositAmount'), fieldErrors.depositAmount)}
                  {...register('depositAmount', {
                    shouldUnregister: true,
                    deps: ['totalAmount'],
                    validate: (value, values) => {
                      const valid = validateAmount(value, { required: true })
                      if (valid !== true) return valid

                      const deposit = parseAmount(value) ?? 0
                      const total = parseAmount(values.totalAmount)
                      if (deposit <= 0) return 'Zadatek musi być większy od zera.'
                      if (total !== null && !Number.isNaN(total) && deposit >= total) {
                        return 'Zadatek musi być mniejszy od kwoty. Przy pełnej wpłacie wybierz „Zapłacone”.'
                      }
                      return true
                    },
                  })}
                />
              </FormField>
            )}
          </div>

          <FormField id={fieldId('categoryId')} label="Kategoria">
            <NativeSelect id={fieldId('categoryId')} {...register('categoryId')}>
              <option value="">Bez kategorii</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Nowa kategoria…</option>
            </NativeSelect>
          </FormField>

          {categoryId === NEW_CATEGORY && (
            <FormField id={fieldId('newCategoryName')} label="Nazwa nowej kategorii *" error={fieldErrors.newCategoryName}>
              <Input
                id={fieldId('newCategoryName')}
                placeholder="np. Sala i catering"
                autoComplete="off"
                className="aria-invalid:border-destructive"
                {...fieldAria(fieldId('newCategoryName'), fieldErrors.newCategoryName)}
                {...register('newCategoryName', {
                  shouldUnregister: true,
                  validate: (value) => {
                    const name = value.trim()
                    if (name === '') return 'Podaj nazwę kategorii.'
                    if (createdCategoryRef.current?.name === name) return true
                    const lower = name.toLocaleLowerCase('pl')
                    if (categories.some((category) => category.name.toLocaleLowerCase('pl') === lower)) {
                      return 'Kategoria o tej nazwie już istnieje - wybierz ją z listy.'
                    }
                    return true
                  },
                  maxLength: {
                    value: EXPENSE_LIMITS.categoryName,
                    message: `Maksymalnie ${EXPENSE_LIMITS.categoryName} znaków.`,
                  },
                })}
              />
            </FormField>
          )}

          <FormField id={fieldId('notes')} label="Notatka" error={fieldErrors.notes}>
            <textarea
              id={fieldId('notes')}
              rows={2}
              className={textareaClass}
              {...fieldAria(fieldId('notes'), fieldErrors.notes)}
              {...register('notes', {
                maxLength: {
                  value: EXPENSE_LIMITS.notes,
                  message: `Maksymalnie ${EXPENSE_LIMITS.notes} znaków.`,
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
              {expense ? 'Zapisz' : 'Dodaj wydatek'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
