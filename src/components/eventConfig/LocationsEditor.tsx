import { Plus } from 'lucide-react'
import { useId, useRef } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { saveEventSection } from '@/lib/eventPageApi'
import { EVENT_PAGE_LIMITS, type EventLocation, type SectionConfig, type SectionTexts } from '@/types/eventPage'
import { FormFooter, ItemControls, SectionHeaderFields, TextField, type HeaderFormValues } from './fields'
import { textsFromForm, textsToForm, maxLength, orNull } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type LocationsFormValues = HeaderFormValues & {
  items: { label: string; name: string; address: string; showMap: boolean }[]
}

type LocationsEditorProps = {
  eventId: string
  config: SectionConfig
  locations: readonly EventLocation[]
  onSaved: (texts: SectionTexts, locations: EventLocation[]) => void
}

const EMPTY_LOCATION = { label: '', name: '', address: '', showMap: true }

// Jak dojechać: nagłówek sekcji i adresy. Mapa jest wyszukiwana po adresie.
export function LocationsEditor({ eventId, config, locations, onSaved }: LocationsEditorProps) {
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
  } = useForm<LocationsFormValues>({
    defaultValues: {
      ...textsToForm(config),
      items: locations.map((place) => ({
        label: place.label ?? '',
        name: place.name,
        address: place.address,
        showMap: place.show_map,
      })),
    },
    mode: 'onTouched',
  })
  const { saved, markSaved } = useSavedFlag(watch)
  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const nextTexts = textsFromForm(values)
    const nextLocations: EventLocation[] = values.items.map((item) => ({
      label: orNull(item.label),
      name: item.name.trim(),
      address: item.address.trim(),
      show_map: item.showMap,
    }))

    try {
      await saveEventSection(eventId, 'location', nextTexts, nextLocations)
      onSaved(nextTexts, nextLocations)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać adresów.') })
    } finally {
      busyRef.current = false
    }
  })

  const atLimit = fields.length >= EVENT_PAGE_LIMITS.locations

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
      <SectionHeaderFields idPrefix={`${id}-header`} register={register} errors={errors} navLabelPlaceholder="Dojazd" />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-foreground">Adresy ({fields.length})</legend>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak adresów - sekcja nie jest pokazywana na stronie.</p>
        )}

        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index]
            const prefix = `${id}-place-${field.id}`

            return (
              <li key={field.id} className="rounded-lg border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Adres {index + 1}</span>
                  <ItemControls
                    label={`adres ${index + 1}`}
                    index={index}
                    count={fields.length}
                    disabled={isSubmitting}
                    onMove={move}
                    onRemove={remove}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id={`${prefix}-label`}
                    label="Etykieta"
                    placeholder="np. Ceremonia"
                    error={itemErrors?.label?.message}
                    registration={register(`items.${index}.label`, {
                      maxLength: maxLength(EVENT_PAGE_LIMITS.locationLabel),
                    })}
                  />
                  <TextField
                    id={`${prefix}-name`}
                    label="Nazwa miejsca *"
                    placeholder="np. Dworek Jabłonna"
                    error={itemErrors?.name?.message}
                    registration={register(`items.${index}.name`, {
                      validate: (value) => value.trim() !== '' || 'Podaj nazwę miejsca.',
                      maxLength: maxLength(EVENT_PAGE_LIMITS.locationName),
                    })}
                  />
                  <div className="sm:col-span-2">
                    <TextField
                      id={`${prefix}-address`}
                      label="Adres *"
                      placeholder="ulica, numer, kod, miejscowość"
                      hint="Na ten adres wskazuje pinezka na mapie i link do Map Google."
                      error={itemErrors?.address?.message}
                      registration={register(`items.${index}.address`, {
                        validate: (value) => value.trim() !== '' || 'Podaj adres.',
                        maxLength: maxLength(EVENT_PAGE_LIMITS.locationAddress),
                      })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[hsl(var(--primary))]"
                      {...register(`items.${index}.showMap`)}
                    />
                    Pokaż na mapie
                  </label>
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
          onClick={() => append(EMPTY_LOCATION)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Dodaj adres
        </Button>
        {atLimit && <p className="text-xs text-muted-foreground">Maksymalnie {EVENT_PAGE_LIMITS.locations} adresów.</p>}
      </fieldset>

      <FormFooter
        error={errors.root?.message}
        saved={saved}
        submitting={isSubmitting}
      />
    </form>
  )
}
