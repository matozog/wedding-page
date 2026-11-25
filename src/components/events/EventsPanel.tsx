import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useAdminEvents } from '@/hooks/useAdminEvents'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { countPl } from '@/lib/plural'
import type { AdminEvent, AdminEventInput } from '@/types/adminEvent'
import type { EventPreview } from '@/types/event'
import { AccessCodeDialog } from './AccessCodeDialog'
import { DeleteEventDialog } from './DeleteEventDialog'
import { EventCardList, EventTable } from './EventList'
import { EventFormDialog } from './EventFormDialog'
import { EventMembersDialog } from './EventMembersDialog'

type EventsPanelProps = {
  currentEventId: string | null
  onEnter: (event: EventPreview) => void
  // Zmiana / usunięcie wydarzenia - wybrane wydarzenie w sesji nadąża.
  onEventChanged: (eventId: string, event: EventPreview | null) => void
}

type OpenDialog =
  | { kind: 'form'; event: AdminEvent | null }
  | { kind: 'code' | 'delete' | 'members'; event: AdminEvent }
  | null

const toPreview = (event: AdminEvent): EventPreview => ({
  id: event.id,
  name: event.name,
  startsAt: event.starts_at,
})

// Wszystkie wydarzenia - tylko super admin (każde RPC sprawdza to w bazie).
export function EventsPanel({ currentEventId, onEnter, onEventChanged }: EventsPanelProps) {
  const { events, loading, error, reload, addEvent, editEvent, changeAccessCode, removeEvent } = useAdminEvents()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [dialog, setDialog] = useState<OpenDialog>(null)

  const close = () => setDialog(null)

  const handleUpdate = async (eventId: string, input: AdminEventInput) => {
    await editEvent(eventId, input)
    onEventChanged(eventId, { id: eventId, name: input.name, startsAt: input.startsAt })
  }

  const handleDelete = async (eventId: string) => {
    await removeEvent(eventId)
    onEventChanged(eventId, null)
  }

  const actions = {
    onEnter: (event: AdminEvent) => onEnter(toPreview(event)),
    onEdit: (event: AdminEvent) => setDialog({ kind: 'form', event }),
    onMembers: (event: AdminEvent) => setDialog({ kind: 'members', event }),
    onAccessCode: (event: AdminEvent) => setDialog({ kind: 'code', event }),
    onDelete: (event: AdminEvent) => setDialog({ kind: 'delete', event }),
  }

  return (
    <section aria-labelledby="events-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 id="events-heading" className="font-serif text-3xl text-foreground">
            Wydarzenia
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading && events.length === 0
              ? 'Wczytywanie…'
              : countPl(events.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={loading}
          aria-label="Odśwież listę"
          title="Odśwież listę"
          onClick={() => void reload()}
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
        <Button type="button" onClick={() => setDialog({ kind: 'form', event: null })}>
          <Plus className="size-4" aria-hidden="true" />
          Nowe wydarzenie
        </Button>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <ErrorMessage message={error} />
          <Button type="button" variant="outline" onClick={() => void reload()}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : loading && events.length === 0 ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Wczytywanie wydarzeń…
        </p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nie ma jeszcze żadnych wydarzeń. Zacznij od „Nowe wydarzenie”.
        </div>
      ) : isDesktop ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <EventTable events={events} currentEventId={currentEventId} {...actions} />
        </div>
      ) : (
        <EventCardList events={events} currentEventId={currentEventId} {...actions} />
      )}

      {dialog?.kind === 'form' && (
        <EventFormDialog event={dialog.event} onClose={close} onCreate={addEvent} onUpdate={handleUpdate} />
      )}
      {dialog?.kind === 'code' && (
        <AccessCodeDialog event={dialog.event} onClose={close} onSave={changeAccessCode} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteEventDialog event={dialog.event} onClose={close} onDelete={handleDelete} />
      )}
      {dialog?.kind === 'members' && <EventMembersDialog event={dialog.event} onClose={close} />}
    </section>
  )
}
