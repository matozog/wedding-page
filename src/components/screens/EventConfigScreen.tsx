import { Loader2 } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router'
import { GeneralSettings } from '@/components/eventConfig/GeneralSettings'
import { SectionsSettings } from '@/components/eventConfig/SectionsSettings'
import { SettingsCard } from '@/components/eventConfig/fields'
import { ThemeSettings } from '@/components/eventConfig/ThemeSettings'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useEventPage } from '@/hooks/useEventPage'
import { ROUTES } from '@/lib/routes'
import type { EventPreview } from '@/types/event'
import type { EventPage } from '@/types/eventPage'
import { OrganizerGate, type OrganizerAccess } from './OrganizerGate'

type EventConfigScreenProps = {
  eventId: string
  access: OrganizerAccess
  currentEventId: string | null
  onOpenPage: (event: EventPreview) => void
  onEventChanged: (eventId: string, event: EventPreview | null) => void
}

// /events/:eventId - konfiguracja jednego wydarzenia (super admin).
export function EventConfigScreen(props: EventConfigScreenProps) {
  return (
    <OrganizerGate access={props.access}>
      <EventConfigContent {...props} />
    </OrganizerGate>
  )
}

function EventConfigContent({ eventId, access, currentEventId, onOpenPage, onEventChanged }: EventConfigScreenProps) {
  const { page, setPage, loading, error, notFound, reload } = useEventPage(eventId)

  const update = useCallback(
    (change: (current: EventPage) => EventPage) => setPage((current) => (current ? change(current) : current)),
    [setPage]
  )

  const preview = (current: EventPage): EventPreview => ({
    id: current.event.id,
    name: current.event.name,
    startsAt: current.event.starts_at,
  })

  return (
    <ManagementLayout
      eventName="Panel organizatora"
      nickname={access.accountLabel}
      canView
      error={access.error}
      breadcrumbs={[{ label: 'Wydarzenia', to: ROUTES.events }, { label: page?.event.name ?? 'Wydarzenie' }]}
      showEventLink={currentEventId !== null}
      onLogout={access.onLogout}
    >
      {page ? (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <h1 className="font-serif text-3xl text-foreground">{page.event.name}</h1>

          <SettingsCard id="event-general" title="Ogólne">
            <GeneralSettings
              key={page.event.id}
              event={page.event}
              onSaved={(name, startsAt) => {
                update((current) => ({ ...current, event: { ...current.event, name, starts_at: startsAt } }))
                onEventChanged(eventId, { id: eventId, name, startsAt })
              }}
              onOpenPage={() => onOpenPage(preview(page))}
            />
          </SettingsCard>

          <SettingsCard
            id="event-theme"
            title="Wygląd"
            description="Paleta kolorów strony wydarzenia i panelu zarządzania tego wydarzenia."
          >
            <ThemeSettings
              eventId={eventId}
              eventName={page.event.name}
              theme={page.event.theme}
              onSaved={(theme) => update((current) => ({ ...current, event: { ...current.event, theme } }))}
            />
          </SettingsCard>

          <SettingsCard
            id="event-sections"
            title="Sekcje strony"
            description="Ukryte sekcje znikają ze strony i z menu. Zmiana widoczności zapisuje się od razu."
          >
            <SectionsSettings page={page} onChange={update} />
          </SettingsCard>
        </div>
      ) : loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Wczytywanie wydarzenia…
        </p>
      ) : notFound ? (
        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="font-serif text-2xl text-foreground">Nie znaleziono wydarzenia</h1>
          <p className="text-sm text-muted-foreground">Mogło zostać usunięte.</p>
          <Button asChild>
            <Link to={ROUTES.events}>Wróć do listy wydarzeń</Link>
          </Button>
        </div>
      ) : (
        <div role="alert" className="flex flex-col items-start gap-3">
          <ErrorMessage message={error} />
          <Button type="button" variant="outline" onClick={() => void reload()}>
            Spróbuj ponownie
          </Button>
        </div>
      )}
    </ManagementLayout>
  )
}
