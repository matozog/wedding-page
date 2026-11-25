import { Plus } from 'lucide-react'
import { useId, useRef } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { saveEventSection } from '@/lib/eventPageApi'
import { EVENT_PAGE_LIMITS, type EventContact, type SectionConfig, type SectionTexts } from '@/types/eventPage'
import { FormFooter, ItemControls, SectionHeaderFields, TextField, type HeaderFormValues } from './fields'
import { EMAIL_PATTERN, PHONE_PATTERN, textsFromForm, textsToForm, maxLength, orNull } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type ContactFormItem = { label: string; name: string; email: string; phone: string }

type ContactsFormValues = HeaderFormValues & {
  items: ContactFormItem[]
}

type ContactsEditorProps = {
  eventId: string
  config: SectionConfig
  contacts: readonly EventContact[]
  onSaved: (texts: SectionTexts, contacts: EventContact[]) => void
}

const EMPTY_CONTACT: ContactFormItem = { label: '', name: '', email: '', phone: '' }

// Kontakt: nagłówek sekcji, opis i osoby (etykieta, imię, e-mail, telefon).
export function ContactsEditor({ eventId, config, contacts, onSaved }: ContactsEditorProps) {
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
  } = useForm<ContactsFormValues>({
    defaultValues: {
      ...textsToForm(config),
      items: contacts.map((contact) => ({
        label: contact.label ?? '',
        name: contact.name ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
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
    const nextContacts: EventContact[] = values.items.map((item) => ({
      label: orNull(item.label),
      name: orNull(item.name),
      email: orNull(item.email)?.toLowerCase() ?? null,
      phone: orNull(item.phone),
    }))

    try {
      await saveEventSection(eventId, 'contact', nextTexts, nextContacts)
      onSaved(nextTexts, nextContacts)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać kontaktów.') })
    } finally {
      busyRef.current = false
    }
  })

  const atLimit = fields.length >= EVENT_PAGE_LIMITS.contacts

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
      <SectionHeaderFields idPrefix={`${id}-header`} register={register} errors={errors} navLabelPlaceholder="Kontakt" />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-foreground">Osoby do kontaktu ({fields.length})</legend>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak kontaktów - sekcja nie jest pokazywana na stronie.</p>
        )}

        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index]
            const prefix = `${id}-contact-${field.id}`

            return (
              <li key={field.id} className="rounded-lg border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Kontakt {index + 1}</span>
                  <ItemControls
                    label={`kontakt ${index + 1}`}
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
                    placeholder="np. Świadkowa"
                    error={itemErrors?.label?.message}
                    registration={register(`items.${index}.label`, {
                      maxLength: maxLength(EVENT_PAGE_LIMITS.contactLabel),
                    })}
                  />
                  <TextField
                    id={`${prefix}-name`}
                    label="Imię i nazwisko"
                    error={itemErrors?.name?.message}
                    registration={register(`items.${index}.name`, {
                      maxLength: maxLength(EVENT_PAGE_LIMITS.contactName),
                    })}
                  />
                  <TextField
                    id={`${prefix}-email`}
                    type="email"
                    label="E-mail"
                    error={itemErrors?.email?.message}
                    registration={register(`items.${index}.email`, {
                      maxLength: maxLength(EVENT_PAGE_LIMITS.contactEmail),
                      validate: (value, all) => {
                        const email = value.trim()
                        if (email !== '' && !EMAIL_PATTERN.test(email)) return 'Podaj poprawny adres e-mail.'
                        if (email === '' && all.items[index]?.phone.trim() === '')
                          return 'Podaj e-mail albo telefon.'
                        return true
                      },
                      deps: [`items.${index}.phone`],
                    })}
                  />
                  <TextField
                    id={`${prefix}-phone`}
                    type="tel"
                    label="Telefon"
                    placeholder="np. +48 600 100 200"
                    error={itemErrors?.phone?.message}
                    registration={register(`items.${index}.phone`, {
                      validate: (value) =>
                        value.trim() === '' || PHONE_PATTERN.test(value.trim()) || 'Podaj poprawny numer telefonu.',
                      deps: [`items.${index}.email`],
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
          onClick={() => append(EMPTY_CONTACT)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Dodaj kontakt
        </Button>
        {atLimit && <p className="text-xs text-muted-foreground">Maksymalnie {EVENT_PAGE_LIMITS.contacts} kontaktów.</p>}
      </fieldset>

      <FormFooter
        error={errors.root?.message}
        saved={saved}
        submitting={isSubmitting}
      />
    </form>
  )
}
