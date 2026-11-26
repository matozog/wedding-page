import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Switch } from '@/components/ui/switch'
import { describeShoppingError, fetchShoppingSettings, saveShoppingSection } from '@/lib/shoppingApi'
import { EVENT_PAGE_LIMITS, type SectionConfig, type SectionTexts } from '@/types/eventPage'
import type { ShoppingSettings } from '@/types/shopping'
import { FormFooter, SectionHeaderFields, TextAreaField, type HeaderFormValues } from './fields'
import { maxLength, textsFromForm, textsToForm } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type ShoppingListEditorProps = {
  eventId: string
  config: SectionConfig
  onSaved: (texts: SectionTexts) => void
}

type FormValues = HeaderFormValues & ShoppingSettings

const SETTING_FIELDS: readonly { key: keyof ShoppingSettings; label: string; hint: string }[] = [
  { key: 'showNote', label: 'Opis', hint: 'Dodatkowe informacje przy pozycji, np. „bez glutenu”.' },
  { key: 'showQuantity', label: 'Ilość i jednostka', hint: 'Np. „2 kg”, „6 szt.”.' },
  { key: 'showAuthor', label: 'Kto dodał', hint: 'Pseudonim lub imię z konta Google przy pozycji.' },
  {
    key: 'allowAssign',
    label: 'Przypisywanie osób',
    hint: 'Goście deklarują, czym się zajmą („Biorę to”). Wypisać się można zawsze.',
  },
]

// Sekcja "Lista zakupów": nagłówek, tekst pustej listy i pola listy.
// Ustawienia pól są pobierane osobno (nie ma ich w get_event_page).
export function ShoppingListEditor({ eventId, config, onSaved }: ShoppingListEditorProps) {
  const [settings, setSettings] = useState<ShoppingSettings | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchShoppingSettings(eventId)
      .then((value) => {
        if (!cancelled) setSettings(value)
      })
      .catch((err: unknown) => {
        console.error('Shopping settings error:', err)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, attempt])

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-3" role="alert">
        <ErrorMessage message="Nie udało się wczytać ustawień listy." />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setFailed(false)
            setAttempt((value) => value + 1)
          }}
        >
          Spróbuj ponownie
        </Button>
      </div>
    )
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Wczytywanie…</p>
  }

  return <ShoppingListForm eventId={eventId} config={config} settings={settings} onSaved={onSaved} />
}

function ShoppingListForm({
  eventId,
  config,
  settings,
  onSaved,
}: ShoppingListEditorProps & { settings: ShoppingSettings }) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { ...textsToForm(config), ...settings }, mode: 'onTouched' })
  const { saved, markSaved } = useSavedFlag(watch)

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const texts = textsFromForm(values)
    const nextSettings: ShoppingSettings = {
      showNote: values.showNote,
      showQuantity: values.showQuantity,
      showAuthor: values.showAuthor,
      allowAssign: values.allowAssign,
    }

    try {
      await saveShoppingSection(eventId, texts, nextSettings)
      onSaved(texts)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeShoppingError(err, 'Nie udało się zapisać sekcji.') })
    } finally {
      busyRef.current = false
    }
  })

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
      <SectionHeaderFields idPrefix={`${id}-header`} register={register} errors={errors} navLabelPlaceholder="Lista" />
      <TextAreaField
        id={`${id}-body`}
        label="Tekst pustej listy"
        hint="Pokazywany, dopóki nikt nie doda pozycji."
        error={errors.contentBody?.message}
        registration={register('contentBody', { maxLength: maxLength(EVENT_PAGE_LIMITS.contentBody) })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-foreground">Pola i informacje na liście</legend>
        <p className="text-xs text-muted-foreground">
          Nazwa jest zawsze. Wyłączone pole znika z listy i formularza gości - zapisane dane zostają.
        </p>
        <ul className="flex flex-col divide-y rounded-lg border">
          {SETTING_FIELDS.map(({ key, label, hint }) => {
            const labelId = `${id}-${key}-label`
            const hintId = `${id}-${key}-hint`

            return (
              <li key={key} className="flex items-center gap-3 p-3">
                <Controller
                  control={control}
                  name={key}
                  render={({ field }) => (
                    <Switch
                      ref={field.ref}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-labelledby={labelId}
                      aria-describedby={hintId}
                    />
                  )}
                />
                <div className="min-w-0">
                  <p id={labelId} className="text-sm font-medium text-foreground">
                    {label}
                  </p>
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <FormFooter error={errors.root?.message} saved={saved} submitting={isSubmitting} />
    </form>
  )
}
