import { RotateCw, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/expenses/formField'
import { fieldAria } from '@/components/expenses/formFieldProps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SEATING_LIMITS, type SeatingLandmark } from '@/types/seating'

type LandmarkFormValues = { label: string; width: number; height: number }

type LandmarkSettingsFormProps = {
  landmark: SeatingLandmark
  onApply: (patch: Partial<Omit<SeatingLandmark, 'id'>>) => void
  onRotate: () => void
  onDelete: () => void
}

const sizeRule = {
  valueAsNumber: true as const,
  validate: (value: number) =>
    (Number.isFinite(value) && value >= SEATING_LIMITS.landmarkMin && value <= SEATING_LIMITS.roomMax) ||
    `Od ${SEATING_LIMITS.landmarkMin} do ${SEATING_LIMITS.roomMax} cm.`,
}

// Element tła (parkiet, wejście...) - widoczny na planie, nieklikalny dla gości.
export function LandmarkSettingsForm({ landmark, onApply, onRotate, onDelete }: LandmarkSettingsFormProps) {
  const id = useId()
  const { register, handleSubmit, formState, reset } = useForm<LandmarkFormValues>({
    defaultValues: { label: landmark.label, width: landmark.width, height: landmark.height },
    mode: 'onBlur',
  })
  const { errors, isDirty } = formState

  const submit = handleSubmit((values) => {
    const patch = { label: values.label.trim(), width: Math.round(values.width), height: Math.round(values.height) }
    onApply(patch)
    reset(patch)
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <FormField id={`${id}-label`} label="Nazwa" error={errors.label?.message}>
        <Input
          id={`${id}-label`}
          maxLength={SEATING_LIMITS.landmarkLabel}
          {...fieldAria(`${id}-label`, errors.label?.message)}
          {...register('label', { validate: (value) => value.trim() !== '' || 'Podaj nazwę.' })}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${id}-width`} label="Szerokość (cm)" error={errors.width?.message}>
          <Input id={`${id}-width`} type="number" inputMode="numeric" {...fieldAria(`${id}-width`, errors.width?.message)} {...register('width', sizeRule)} />
        </FormField>
        <FormField id={`${id}-height`} label="Głębokość (cm)" error={errors.height?.message}>
          <Input id={`${id}-height`} type="number" inputMode="numeric" {...fieldAria(`${id}-height`, errors.height?.message)} {...register('height', sizeRule)} />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Rozmiar zmienisz też, przeciągając uchwyty na planie.</p>

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
          Usuń
        </Button>
      </div>
    </form>
  )
}
