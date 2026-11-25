import { ChevronDown } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Switch } from '@/components/ui/switch'
import { setEventSectionVisibility } from '@/lib/eventPageApi'
import { cn } from '@/lib/utils'
import { EVENT_SECTIONS, type EventPage, type EventSectionKey, type SectionTexts } from '@/types/eventPage'
import { AboutEditor } from './AboutEditor'
import { ContactsEditor } from './ContactsEditor'
import { LocationsEditor } from './LocationsEditor'
import { PagePhotosManager } from './PagePhotosManager'
import { ScheduleEditor } from './ScheduleEditor'
import { TextSectionEditor } from './TextSectionEditor'

type SectionsSettingsProps = {
  page: EventPage
  onChange: (update: (page: EventPage) => EventPage) => void
}

// Sekcja włączona, ale bez treści, nie jest pokazywana gościom.
const isEmpty = (page: EventPage, key: EventSectionKey) => {
  switch (key) {
    case 'schedule':
      return page.schedule.length === 0
    case 'location':
      return page.locations.length === 0
    case 'contact':
      return page.contacts.length === 0
    case 'couple': {
      const about = page.sections.couple
      return !about?.content_title && !about?.content_body && page.facts.length === 0 && page.photos.length === 0
    }
    default:
      return false
  }
}

// Lista sekcji strony: widoczność (zapis od razu) i edycja treści.
export function SectionsSettings({ page, onChange }: SectionsSettingsProps) {
  const id = useId()
  const eventId = page.event.id
  const [expanded, setExpanded] = useState<EventSectionKey | null>(null)
  const [savingKey, setSavingKey] = useState<EventSectionKey | null>(null)
  // Blokada drugiego zapisu bez wyłączania kontrolek - wyłączony przełącznik
  // straciłby fokus klawiatury.
  const savingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const aboutPhotos = useMemo(() => page.photos.filter((photo) => photo.section === 'couple'), [page.photos])

  const toggleVisibility = async (key: EventSectionKey, visible: boolean) => {
    if (savingRef.current) return
    savingRef.current = true
    setSavingKey(key)
    setError(null)

    try {
      await setEventSectionVisibility(eventId, key, visible)
      onChange((current) => ({
        ...current,
        sections: { ...current.sections, [key]: { ...current.sections[key], is_visible: visible } },
      }))
    } catch (err) {
      console.error(err)
      setError(describeSaveError(err, 'Nie udało się zmienić widoczności sekcji.'))
    } finally {
      savingRef.current = false
      setSavingKey(null)
    }
  }

  const saveTexts = (key: EventSectionKey, texts: SectionTexts) =>
    onChange((current) => ({
      ...current,
      sections: { ...current.sections, [key]: { ...current.sections[key], ...texts } },
    }))

  const renderEditor = (key: EventSectionKey) => {
    const config = page.sections[key]

    switch (key) {
      case 'gallery':
        return (
          <TextSectionEditor
            eventId={eventId}
            section="gallery"
            config={config}
            withHeader
            navLabelPlaceholder="Galeria"
            bodyLabel="Tekst pustej galerii"
            bodyHint="Pokazywany, dopóki nikt nie doda zdjęcia."
            onSaved={(texts) => saveTexts('gallery', texts)}
          />
        )
      case 'couple':
        return (
          <div className="flex flex-col gap-8">
            <AboutEditor
              eventId={eventId}
              config={config}
              facts={page.facts}
              onSaved={(texts, facts) => {
                saveTexts('couple', texts)
                onChange((current) => ({ ...current, facts }))
              }}
            />
            <div className="border-t pt-6">
              <PagePhotosManager
                eventId={eventId}
                photos={aboutPhotos}
                onChange={(photos) =>
                  onChange((current) => ({
                    ...current,
                    photos: [...current.photos.filter((photo) => photo.section !== 'couple'), ...photos],
                  }))
                }
              />
            </div>
          </div>
        )
      case 'schedule':
        return (
          <ScheduleEditor
            eventId={eventId}
            config={config}
            items={page.schedule}
            onSaved={(texts, items) => {
              saveTexts('schedule', texts)
              onChange((current) => ({ ...current, schedule: items }))
            }}
          />
        )
      case 'location':
        return (
          <LocationsEditor
            eventId={eventId}
            config={config}
            locations={page.locations}
            onSaved={(texts, locations) => {
              saveTexts('location', texts)
              onChange((current) => ({ ...current, locations }))
            }}
          />
        )
      case 'contact':
        return (
          <ContactsEditor
            eventId={eventId}
            config={config}
            contacts={page.contacts}
            onSaved={(texts, contacts) => {
              saveTexts('contact', texts)
              onChange((current) => ({ ...current, contacts }))
            }}
          />
        )
      case 'seating':
        return (
          <TextSectionEditor
            eventId={eventId}
            section="seating"
            config={config}
            withHeader
            navLabelPlaceholder="Plan sali"
            bodyLabel="Wskazówka pod wyszukiwarką"
            bodyHint="Np. „Kliknij swoje miejsce, aby zobaczyć szczegóły.”. Układ stołów i gości ustawia organizator w Zarządzanie → Plan sali; goście widzą plan dopiero po jego opublikowaniu."
            onSaved={(texts) => saveTexts('seating', texts)}
          />
        )
      case 'footer':
        return (
          <TextSectionEditor
            eventId={eventId}
            section="footer"
            config={config}
            withHeader={false}
            navLabelPlaceholder=""
            bodyLabel="Podziękowanie"
            bodyHint="Tekst pod nazwą wydarzenia w stopce strony."
            onSaved={(texts) => saveTexts('footer', texts)}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div role="alert">
          <ErrorMessage message={error} />
        </div>
      )}

      <ul className="flex flex-col divide-y rounded-lg border">
        {EVENT_SECTIONS.map(({ key, label, configurable }) => {
          const config = page.sections[key]
          if (!config) return null

          const visible = config.is_visible
          const isOpen = expanded === key
          const panelId = `${id}-${key}-panel`
          const empty = visible && isEmpty(page, key)

          return (
            <li key={key} className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={visible}
                  aria-busy={savingKey === key}
                  aria-label={`Pokaż sekcję: ${label}`}
                  onCheckedChange={(next) => void toggleVisibility(key, next)}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium text-foreground', !visible && 'text-muted-foreground')}>{label}</p>
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {savingKey === key
                      ? 'Zapisywanie…'
                      : !visible
                        ? 'Ukryta'
                        : empty
                          ? 'Włączona, ale bez treści - goście jej nie zobaczą'
                          : configurable
                            ? 'Widoczna'
                            : 'Widoczna · treść na razie stała'}
                  </p>
                </div>
                {configurable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpanded(isOpen ? null : key)}
                  >
                    Edytuj treść
                    <ChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                  </Button>
                )}
              </div>

              {configurable && isOpen && (
                <div id={panelId} className="mt-4 border-t pt-4">
                  {renderEditor(key)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
