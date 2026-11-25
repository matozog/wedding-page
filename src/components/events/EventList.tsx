import { KeyRound, LogIn, Settings2, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AdminEvent } from '@/types/adminEvent'
import { formatEventDate } from './eventFormat'

export type EventListActions = {
  onEnter: (event: AdminEvent) => void
  onEdit: (event: AdminEvent) => void
  onMembers: (event: AdminEvent) => void
  onAccessCode: (event: AdminEvent) => void
  onDelete: (event: AdminEvent) => void
}

type EventListProps = EventListActions & {
  events: readonly AdminEvent[]
  // Wydarzenie wybrane w tej chwili (strona wydarzenia / zarządzanie).
  currentEventId: string | null
}

function EventDate({ iso }: { iso: string | null }) {
  const label = formatEventDate(iso)
  return label ? <span>{label}</span> : <span className="text-muted-foreground">Bez daty</span>
}

function SecondaryActions({ event, onEdit, onMembers, onAccessCode, onDelete }: Omit<EventListActions, 'onEnter'> & { event: AdminEvent }) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Członkowie: ${event.name}`}
        title="Członkowie i role"
        onClick={() => onMembers(event)}
      >
        <Users className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Konfiguracja: ${event.name}`}
        title="Konfiguracja strony"
        onClick={() => onEdit(event)}
      >
        <Settings2 className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Zmień kod dostępu: ${event.name}`}
        title="Zmień kod dostępu"
        onClick={() => onAccessCode(event)}
      >
        <KeyRound className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        aria-label={`Usuń: ${event.name}`}
        title="Usuń"
        onClick={() => onDelete(event)}
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  )
}

function CurrentBadge() {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Wybrane</span>
  )
}

// Tabela - od breakpointu lg.
export function EventTable({ events, currentEventId, onEnter, ...actions }: EventListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nazwa</TableHead>
          <TableHead>Termin</TableHead>
          <TableHead className="text-right">Uczestnicy</TableHead>
          <TableHead className="text-right">Goście</TableHead>
          <TableHead className="text-right">Zdjęcia</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Akcje</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id} className={cn('hover:bg-muted/40', event.id === currentEventId && 'bg-primary/5')}>
            <TableCell className="max-w-96">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">{event.name}</span>
                {event.id === currentEventId && <CurrentBadge />}
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <EventDate iso={event.starts_at} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{event.member_count}</TableCell>
            <TableCell className="text-right tabular-nums">{event.guest_count}</TableCell>
            <TableCell className="text-right tabular-nums">{event.photo_count}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Button type="button" variant="outline" size="sm" className="mr-1" onClick={() => onEnter(event)}>
                  <LogIn className="size-4" aria-hidden="true" />
                  Wejdź
                  <span className="sr-only">: {event.name}</span>
                </Button>
                <SecondaryActions event={event} {...actions} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// Karty - na węższych ekranach.
export function EventCardList({ events, currentEventId, onEnter, ...actions }: EventListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li
          key={event.id}
          className={cn('rounded-xl border bg-card p-4 shadow-sm', event.id === currentEventId && 'border-primary/50')}
        >
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 font-serif text-xl text-foreground">{event.name}</h3>
            {event.id === currentEventId && <CurrentBadge />}
          </div>
          <p className="mt-1 text-sm">
            <EventDate iso={event.starts_at} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Uczestnicy: {event.member_count} · Goście: {event.guest_count} · Zdjęcia: {event.photo_count}
          </p>
          <div className="mt-3 flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="mr-auto" onClick={() => onEnter(event)}>
              <LogIn className="size-4" aria-hidden="true" />
              Wejdź
              <span className="sr-only">: {event.name}</span>
            </Button>
            <SecondaryActions event={event} {...actions} />
          </div>
        </li>
      ))}
    </ul>
  )
}
