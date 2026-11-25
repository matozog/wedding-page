import { useId } from 'react'
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
import { Input } from '@/components/ui/input'
import { SEATING_LIMITS, type SeatingRoom } from '@/types/seating'

type RoomFormValues = { width: number; height: number }

type RoomSizeDialogProps = {
  room: SeatingRoom
  onClose: () => void
  onApply: (room: SeatingRoom) => void
}

const MIN_M = SEATING_LIMITS.roomMin / 100
const MAX_M = SEATING_LIMITS.roomMax / 100

const meterRule = {
  valueAsNumber: true as const,
  validate: (value: number) =>
    (Number.isFinite(value) && value >= MIN_M && value <= MAX_M) || `Od ${MIN_M} do ${MAX_M} m.`,
}

// Wymiary sali w metrach (w bazie centymetry).
export function RoomSizeDialog({ room, onClose, onApply }: RoomSizeDialogProps) {
  const id = useId()
  const { register, handleSubmit, formState } = useForm<RoomFormValues>({
    defaultValues: { width: room.width / 100, height: room.height / 100 },
  })
  const { errors } = formState

  const submit = handleSubmit((values) => {
    onApply({ width: Math.round(values.width * 100), height: Math.round(values.height * 100) })
    onClose()
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wymiary sali</DialogTitle>
          <DialogDescription>Plan skaluje się do tych wymiarów. Zmiana trafi do szkicu układu.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField id={`${id}-w`} label="Szerokość (m)" error={errors.width?.message}>
              <Input id={`${id}-w`} type="number" step="0.1" inputMode="decimal" {...fieldAria(`${id}-w`, errors.width?.message)} {...register('width', meterRule)} />
            </FormField>
            <FormField id={`${id}-h`} label="Głębokość (m)" error={errors.height?.message}>
              <Input id={`${id}-h`} type="number" step="0.1" inputMode="decimal" {...fieldAria(`${id}-h`, errors.height?.message)} {...register('height', meterRule)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit">Zastosuj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
