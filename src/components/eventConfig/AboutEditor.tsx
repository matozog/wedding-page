import { Plus } from 'lucide-react'
import { useId, useRef } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { saveEventSection } from '@/lib/eventPageApi'
import { EVENT_PAGE_LIMITS, type AboutFact, type SectionConfig, type SectionTexts } from '@/types/eventPage'
import {
  FormFooter,
  ItemControls,
  SectionHeaderFields,
  TextAreaField,
  TextField,
  type HeaderFormValues,
} from './fields'
import { maxLength, textsFromForm, textsToForm } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type AboutFormValues = HeaderFormValues & {
  items: { label: string; value: string }[]
}

type AboutEditorProps = {
  eventId: string
  config: SectionConfig
  facts: readonly AboutFact[]
  onSaved: (texts: SectionTexts, facts: AboutFact[]) => void
}

const EMPTY_FACT = { label: '', value: '' }

// "O nas": nagłówek sekcji, nagłówek karty, historia i krótkie informacje.
// Zdjęcia - osobno (PagePhotosManager), bo zapisują się od razu.
export function AboutEditor({ eventId, config, facts, onSaved }: AboutEditorProps) {
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
  } = useForm<AboutFormValues>({
    defaultValues: { ...textsToForm(config), items: facts.map((fact) => ({ ...fact })) },
    mode: 'onTouched',
  })
  const { saved, markSaved } = useSavedFlag(watch)
  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' })

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const texts = textsFromForm(values)
    const nextFacts = values.items.map((item) => ({ label: item.label.trim(), value: item.value.trim() }))

    try {
      await saveEventSection(eventId, 'couple', texts, nextFacts)
      onSaved(texts, nextFacts)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać sekcji.') })
    } finally {
      busyRef.current = false
    }
  })

  const atLimit = fields.length >= EVENT_PAGE_LIMITS.facts

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
      <SectionHeaderFields idPrefix={`${id}-header`} register={register} errors={errors} navLabelPlaceholder="O nas" />

      <TextField
        id={`${id}-content-title`}
        label="Nagłówek karty"
        placeholder="np. Ania & Tomek"
        error={errors.contentTitle?.message}
        registration={register('contentTitle', { maxLength: maxLength(EVENT_PAGE_LIMITS.contentTitle) })}
      />
      <TextAreaField
        id={`${id}-content-body`}
        label="Opis"
        hint="Np. historia, jak się poznaliście. Nowe linie są zachowane."
        rows={5}
        error={errors.contentBody?.message}
        registration={register('contentBody', { maxLength: maxLength(EVENT_PAGE_LIMITS.contentBody) })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-foreground">Krótkie informacje ({fields.length})</legend>

        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index]
            const prefix = `${id}-fact-${field.id}`

            return (
              <li key={field.id} className="rounded-lg border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Informacja {index + 1}</span>
                  <ItemControls
                    label={`informacja ${index + 1}`}
                    index={index}
                    count={fields.length}
                    disabled={isSubmitting}
                    onMove={move}
                    onRemove={remove}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <TextField
                    id={`${prefix}-label`}
                    label="Etykieta *"
                    placeholder="np. Data"
                    error={itemErrors?.label?.message}
                    registration={register(`items.${index}.label`, {
                      validate: (value) => value.trim() !== '' || 'Podaj etykietę.',
                      maxLength: maxLength(EVENT_PAGE_LIMITS.factLabel),
                    })}
                  />
                  <TextField
                    id={`${prefix}-value`}
                    label="Wartość *"
                    placeholder="np. 12 czerwca 2027"
                    error={itemErrors?.value?.message}
                    registration={register(`items.${index}.value`, {
                      validate: (value) => value.trim() !== '' || 'Podaj wartość.',
                      maxLength: maxLength(EVENT_PAGE_LIMITS.factValue),
                    })}
                  />
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
          onClick={() => append(EMPTY_FACT)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Dodaj informację
        </Button>
        {atLimit && <p className="text-xs text-muted-foreground">Maksymalnie {EVENT_PAGE_LIMITS.facts} informacje.</p>}
      </fieldset>

      <FormFooter error={errors.root?.message} saved={saved} submitting={isSubmitting} />
    </form>
  )
}
