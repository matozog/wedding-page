import { RotateCw, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/expenses/formField'
import { fieldAria } from '@/components/expenses/formFieldProps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { pluralPl } from '@/lib/plural'
import {
  SEATING_LIMITS,
  SHAPE_OPTIONS,
  type SeatSides,
  type SeatingShape,
  type SeatingTable,
} from '@/types/seating'

type TableFormValues = {
  name: string
  shape: SeatingShape
  capacity: number
  sides: SeatSides
  ends: boolean
  // '' = podział automatyczny
  armSeats: string
}

type TableSettingsFormProps = {
  table: SeatingTable
  // Nazwy pozostałych stołów (unikalność).
  otherNames: ReadonlySet<string>
  seatedCount: number
  onApply: (patch: Partial<Omit<SeatingTable, 'id'>>) => void
  onRotate: () => void
  onDelete: () => void
}

const toValues = (table: SeatingTable): TableFormValues => ({
  name: table.name,
  shape: table.shape,
  capacity: table.capacity,
  sides: table.seat_config.sides ?? 'both',
  ends: table.seat_config.ends ?? false,
  armSeats: table.seat_config.armSeats == null ? '' : String(table.seat_config.armSeats),
})

// Ustawienia zaznaczonego stołu - zmiany trafiają do szkicu układu
// (zapis w bazie dopiero przyciskiem "Zapisz układ").
export function TableSettingsForm({
  table,
  otherNames,
  seatedCount,
  onApply,
  onRotate,
  onDelete,
}: TableSettingsFormProps) {
  const id = useId()
  const form = useForm<TableFormValues>({ defaultValues: toValues(table), mode: 'onBlur' })
  const { register, handleSubmit, watch, formState, reset } = form
  const { errors, isDirty } = formState
  const shape = watch('shape')
  const capacity = Number(watch('capacity')) || 0

  const submit = handleSubmit((values) => {
    const armSeats = values.armSeats === '' ? null : Number(values.armSeats)
    const patch = {
      name: values.name.trim(),
      shape: values.shape,
      capacity: Number(values.capacity),
      seat_config: {
        sides: values.sides,
        ...(values.shape === 'RECT' ? { ends: values.ends } : { armSeats }),
      },
    }
    onApply(patch)
    reset({ ...values, name: patch.name })
  })

  const armLabel = shape === 'U' ? 'Miejsca na podstawie' : 'Miejsca na poziomym ramieniu'

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <FormField id={`${id}-name`} label="Nazwa stołu" error={errors.name?.message}>
        <Input
          id={`${id}-name`}
          maxLength={SEATING_LIMITS.tableName}
          {...fieldAria(`${id}-name`, errors.name?.message)}
          {...register('name', {
            validate: (value) => {
              const name = value.trim()
              if (!name) return 'Podaj nazwę stołu.'
              if (otherNames.has(name)) return 'Inny stół ma już tę nazwę.'
              return true
            },
          })}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${id}-shape`} label="Kształt">
          <NativeSelect id={`${id}-shape`} {...register('shape')}>
            {SHAPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id={`${id}-capacity`} label="Liczba miejsc" error={errors.capacity?.message}>
          <Input
            id={`${id}-capacity`}
            type="number"
            inputMode="numeric"
            min={1}
            max={SEATING_LIMITS.capacity}
            {...fieldAria(`${id}-capacity`, errors.capacity?.message)}
            {...register('capacity', {
              valueAsNumber: true,
              validate: (value) =>
                (Number.isInteger(value) && value >= 1 && value <= SEATING_LIMITS.capacity) ||
                `Od 1 do ${SEATING_LIMITS.capacity} miejsc.`,
            })}
          />
        </FormField>
      </div>

      <FormField id={`${id}-sides`} label="Krzesła">
        <NativeSelect id={`${id}-sides`} {...register('sides')}>
          <option value="both">Po obu stronach</option>
          <option value="one">{shape === 'RECT' ? 'Po jednej stronie' : 'Tylko na zewnątrz'}</option>
        </NativeSelect>
      </FormField>

      {shape === 'RECT' ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register('ends')} />
          Miejsca na szczytach stołu
        </label>
      ) : (
        <FormField
          id={`${id}-arm`}
          label={armLabel}
          hint="Puste - podział automatyczny."
          error={errors.armSeats?.message}
        >
          <Input
            id={`${id}-arm`}
            type="number"
            inputMode="numeric"
            min={0}
            max={capacity}
            {...fieldAria(`${id}-arm`, errors.armSeats?.message, true)}
            {...register('armSeats', {
              validate: (value) => {
                if (value === '') return true
                const number = Number(value)
                return (Number.isInteger(number) && number >= 0 && number <= capacity) || `Od 0 do ${capacity}.`
              },
            })}
          />
        </FormField>
      )}

      {seatedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Przy stole {pluralPl(seatedCount, 'siedzi', 'siedzą', 'siedzi')} {seatedCount}{' '}
          {pluralPl(seatedCount, 'osoba', 'osoby', 'osób')}.
          Zmniejszenie liczby miejsc albo usunięcie stołu przeniesie nadmiarowe osoby do nieusadzonych (zapytamy przy
          zapisie).
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!isDirty}>
          Zastosuj
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRotate}>
          <RotateCw className="size-4" />
          Obróć o 90°
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Usuń stół
        </Button>
      </div>
    </form>
  )
}
