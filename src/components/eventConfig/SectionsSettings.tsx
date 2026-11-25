import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Switch } from '@/components/ui/switch'
import { setEventSectionVisibility } from '@/lib/eventPageApi'
import { cn } from '@/lib/utils'
import { EVENT_SECTIONS, type EventPage, type EventSectionKey } from '@/types/eventPage'
import { ContactsEditor } from './ContactsEditor'
import { LocationsEditor } from './LocationsEditor'
import { ScheduleEditor } from './ScheduleEditor'

type SectionsSettingsProps = {
  page: EventPage
  onChange: (update: (page: EventPage) => EventPage) => void
}

// Sekcja włączona, ale bez treści, nie jest pokazywana gościom.
const isEmpty = (page: EventPage, key: EventSectionKey) =>
  (key === 'schedule' && page.schedule.length === 0) ||
  (key === 'location' && page.locations.length === 0) ||
  (key === 'contact' && page.contacts.length === 0)

// Lista sekcji strony: widoczność (zapis od razu) i edycja treści sekcji,
// które ją mają.
export function SectionsSettings({ page, onChange }: SectionsSettingsProps) {
  const id = useId()
  const eventId = page.event.id
  const [expanded, setExpanded] = useState<EventSectionKey | null>(null)
  const [savingKey, setSavingKey] = useState<EventSectionKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleVisibility = async (key: EventSectionKey, visible: boolean) => {
    if (savingKey) return
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
      setSavingKey(null)
    }
  }

  const renderEditor = (key: EventSectionKey) => {
    switch (key) {
      case 'schedule':
        return (
          <ScheduleEditor
            eventId={eventId}
            header={page.sections.schedule}
            items={page.schedule}
            onSaved={(header, items) =>
              onChange((current) => ({
                ...current,
                schedule: items,
                sections: { ...current.sections, schedule: { ...current.sections.schedule, ...header } },
              }))
            }
          />
        )
      case 'location':
        return (
          <LocationsEditor
            eventId={eventId}
            header={page.sections.location}
            locations={page.locations}
            onSaved={(header, locations) =>
              onChange((current) => ({
                ...current,
                locations,
                sections: { ...current.sections, location: { ...current.sections.location, ...header } },
              }))
            }
          />
        )
      case 'contact':
        return (
          <ContactsEditor
            eventId={eventId}
            header={page.sections.contact}
            contacts={page.contacts}
            onSaved={(header, contacts) =>
              onChange((current) => ({
                ...current,
                contacts,
                sections: { ...current.sections, contact: { ...current.sections.contact, ...header } },
              }))
            }
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
          const visible = config?.is_visible ?? true
          const isOpen = expanded === key
          const panelId = `${id}-${key}-panel`
          const empty = visible && isEmpty(page, key)

          return (
            <li key={key} className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={visible}
                  disabled={savingKey !== null}
                  aria-label={`Pokaż sekcję: ${label}`}
                  onCheckedChange={(next) => void toggleVisibility(key, next)}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium text-foreground', !visible && 'text-muted-foreground')}>{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {!visible
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
