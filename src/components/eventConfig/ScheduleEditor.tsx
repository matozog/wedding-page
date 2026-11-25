import { Plus } from 'lucide-react'
import { useId, useRef } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { describeSaveError } from '@/components/events/eventFormat'
import { saveEventSchedule } from '@/lib/eventPageApi'
import { EVENT_PAGE_LIMITS, type ScheduleItem, type SectionHeader } from '@/types/eventPage'
import { FormFooter, ItemControls, SectionHeaderFields, TextField, type HeaderFormValues } from './fields'
import { headerFromForm, headerToForm, maxLength, orNull } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type ScheduleFormValues = HeaderFormValues & {
  items: { time: string; title: string; description: string }[]
}

type ScheduleEditorProps = {
  eventId: string
  header: SectionHeader
  items: readonly ScheduleItem[]
  onSaved: (header: SectionHeader, items: ScheduleItem[]) => void
}

const EMPTY_ITEM = { time: '', title: '', description: '' }

// Plan wydarzenia: nagłówek sekcji i punkty (godzina, tytuł, opis).
export function ScheduleEditor({ eventId, header, items, onSaved }: ScheduleEditorProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleFormValues>({
    defaultValues: {
      ...headerToForm(header),
      items: items.map((item) => ({
        time: item.time_label ?? '',
        title: item.title,
        description: item.description ?? '',
      })),
    },
    mode: 'onTouched',
  })
  const { saved, markSaved } = useSavedFlag(watch)
  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const nextHeader = headerFromForm(values)
    const nextItems: ScheduleItem[] = values.items.map((item) => ({
      time_label: orNull(item.time),
      title: item.title.trim(),
      description: orNull(item.description),
    }))

    try {
      await saveEventSchedule(eventId, nextHeader, nextItems)
      onSaved(nextHeader, nextItems)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać planu.') })
    } finally {
      busyRef.current = false
    }
  })

  const atLimit = fields.length >= EVENT_PAGE_LIMITS.scheduleItems

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
      <SectionHeaderFields idPrefix={`${id}-header`} register={register} errors={errors} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-foreground">Punkty planu ({fields.length})</legend>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak punktów - sekcja nie jest pokazywana na stronie.</p>
        )}

        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index]
            const prefix = `${id}-item-${field.id}`

            return (
              <li key={field.id} className="rounded-lg border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Punkt {index + 1}</span>
                  <ItemControls
                    label={`punkt ${index + 1}`}
                    index={index}
                    count={fields.length}
                    disabled={isSubmitting}
                    onMove={move}
                    onRemove={remove}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <TextField
                    id={`${prefix}-time`}
                    label="Godzina"
                    placeholder="np. 15:00"
                    error={itemErrors?.time?.message}
                    registration={register(`items.${index}.time`, {
                      maxLength: maxLength(EVENT_PAGE_LIMITS.scheduleTime),
                    })}
                  />
                  <TextField
                    id={`${prefix}-title`}
                    label="Tytuł *"
                    error={itemErrors?.title?.message}
                    registration={register(`items.${index}.title`, {
                      validate: (value) => value.trim() !== '' || 'Podaj tytuł punktu.',
                      maxLength: maxLength(EVENT_PAGE_LIMITS.scheduleTitle),
                    })}
                  />
                  <div className="sm:col-span-2">
                    <TextField
                      id={`${prefix}-description`}
                      label="Opis"
                      error={itemErrors?.description?.message}
                      registration={register(`items.${index}.description`, {
                        maxLength: maxLength(EVENT_PAGE_LIMITS.scheduleDescription),
                      })}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={atLimit || isSubmitting}
          onClick={() => append(EMPTY_ITEM)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Dodaj punkt
        </Button>
        {atLimit && (
          <p className="text-xs text-muted-foreground">Maksymalnie {EVENT_PAGE_LIMITS.scheduleItems} punktów.</p>
        )}
      </fieldset>

      <FormFooter
        error={errors.root?.message}
        saved={saved}
        submitting={isSubmitting}
      />
    </form>
  )
}
