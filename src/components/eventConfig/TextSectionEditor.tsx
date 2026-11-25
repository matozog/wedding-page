import { useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { describeSaveError } from '@/components/events/eventFormat'
import { saveEventSection } from '@/lib/eventPageApi'
import { EVENT_PAGE_LIMITS, type EventSectionKey, type SectionConfig, type SectionTexts } from '@/types/eventPage'
import { FormFooter, SectionHeaderFields, TextAreaField, type HeaderFormValues } from './fields'
import { maxLength, textsFromForm, textsToForm } from './formUtils'
import { useSavedFlag } from './useSavedFlag'

type TextSectionEditorProps = {
  eventId: string
  section: EventSectionKey
  config: SectionConfig
  // Nagłówek i nazwa w menu (stopka ich nie ma).
  withHeader: boolean
  navLabelPlaceholder: string
  bodyLabel: string
  bodyHint?: string
  onSaved: (texts: SectionTexts) => void
}

// Sekcja bez listy: nagłówek i jeden tekst (galeria - tekst pustej galerii,
// stopka - podziękowanie).
export function TextSectionEditor({
  eventId,
  section,
  config,
  withHeader,
  navLabelPlaceholder,
  bodyLabel,
  bodyHint,
  onSaved,
}: TextSectionEditorProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<HeaderFormValues>({ defaultValues: textsToForm(config), mode: 'onTouched' })
  const { saved, markSaved } = useSavedFlag(watch)

  const onSubmit = handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    const texts = textsFromForm(values)

    try {
      await saveEventSection(eventId, section, texts)
      onSaved(texts)
      reset(values)
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać sekcji.') })
    } finally {
      busyRef.current = false
    }
  })

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
      {withHeader && (
        <SectionHeaderFields
          idPrefix={`${id}-header`}
          register={register}
          errors={errors}
          navLabelPlaceholder={navLabelPlaceholder}
        />
      )}
      <TextAreaField
        id={`${id}-body`}
        label={bodyLabel}
        hint={bodyHint}
        error={errors.contentBody?.message}
        registration={register('contentBody', { maxLength: maxLength(EVENT_PAGE_LIMITS.contentBody) })}
      />
      <FormFooter error={errors.root?.message} saved={saved} submitting={isSubmitting} />
    </form>
  )
}
