import { Eye, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SeatingCanvas, type CanvasFocus, type SeatVisual } from '@/components/seating/SeatingCanvas'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SECTION_IDS } from '@/config/navigation'
import { useThemeColors } from '@/hooks/useThemeColors'
import { cn } from '@/lib/utils'
import type { SectionHeader } from '@/types/eventPage'
import { seatKey, type SeatAssignment, type SeatingPlan } from '@/types/seating'
import { SectionHeading } from './SectionHeading'

type SeatingPlanSectionProps = {
  header: SectionHeader
  // Wskazówka pod wyszukiwarką (content_body sekcji).
  hint: string | null
  plan: SeatingPlan
}

const MAX_RESULTS = 8

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

type Selection = { kind: 'seat'; tableId: string; seatNumber: number } | { kind: 'table'; tableId: string }

// Plan sali dla gości: wyszukiwarka podświetla miejsce i przybliża plan,
// kliknięcie krzesła pokazuje imię i nazwisko, stołu - listę osób.
export function SeatingPlanSection({ header, hint, plan }: SeatingPlanSectionProps) {
  const colors = useThemeColors()
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<CanvasFocus | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  const tableNames = useMemo(() => new Map(plan.tables.map((table) => [table.id, table.name])), [plan.tables])
  const seatsByKey = useMemo(
    () => new Map(plan.seats.map((seat) => [seatKey(seat.table_id, seat.seat_number), seat])),
    [plan.seats]
  )

  const search = normalize(query.trim())
  const matches = useMemo(
    () =>
      search.length < 2
        ? []
        : plan.seats
            .filter((seat) => normalize(seat.guest_name).includes(search))
            .sort((a, b) => a.guest_name.localeCompare(b.guest_name, 'pl')),
    [plan.seats, search]
  )
  const highlightedSeats = useMemo(
    () => new Set(matches.map((seat) => seatKey(seat.table_id, seat.seat_number))),
    [matches]
  )
  const highlightedTables = useMemo(() => new Set(matches.map((seat) => seat.table_id)), [matches])

  const focusSeat = useCallback((seat: SeatAssignment) => {
    setFocus({ tableId: seat.table_id, seatNumber: seat.seat_number, nonce: Date.now() })
  }, [])

  // Jedno trafienie - od razu przybliżamy plan do miejsca.
  const singleMatch = matches.length === 1 ? matches[0] : null
  useEffect(() => {
    if (singleMatch) focusSeat(singleMatch)
  }, [singleMatch, focusSeat])

  const seatVisual = useCallback(
    (tableId: string, seatNumber: number): SeatVisual => {
      const seat = seatsByKey.get(seatKey(tableId, seatNumber))
      return seat
        ? { fill: colors.primary, title: seat.guest_name, dimmed: highlightedSeats.size > 0 && !highlightedSeats.has(seatKey(tableId, seatNumber)) }
        : { fill: colors.card, title: null, dimmed: highlightedSeats.size > 0 }
    },
    [colors.card, colors.primary, highlightedSeats, seatsByKey]
  )

  const selectedSeat = selection?.kind === 'seat' ? seatsByKey.get(seatKey(selection.tableId, selection.seatNumber)) : null
  const selectedTableGuests =
    selection?.kind === 'table'
      ? plan.seats.filter((seat) => seat.table_id === selection.tableId).sort((a, b) => a.seat_number - b.seat_number)
      : []

  return (
    <section id={SECTION_IDS.seating} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading {...header} />

      <Card className="border-border/80 bg-card/80">
        <CardContent className="space-y-4 pt-6">
          {!plan.is_published && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" aria-hidden="true" />
              Podgląd - plan nie jest jeszcze opublikowany, goście go nie widzą.
            </p>
          )}

          <div className="mx-auto max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Znajdź swoje imię…"
                aria-label="Znajdź osobę na planie sali"
                className="pl-9"
              />
            </div>
            {hint && <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p>}

            {search.length >= 2 && (
              <div className="mt-2" aria-live="polite">
                {matches.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">Nie znaleźliśmy takiej osoby na planie.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {matches.slice(0, MAX_RESULTS).map((seat) => (
                      <li key={seat.guest_id}>
                        <button
                          type="button"
                          onClick={() => focusSeat(seat)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-left text-sm hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="font-medium">{seat.guest_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {tableNames.get(seat.table_id)} · miejsce {seat.seat_number}
                          </span>
                        </button>
                      </li>
                    ))}
                    {matches.length > MAX_RESULTS && (
                      <li className="text-center text-xs text-muted-foreground">
                        i {matches.length - MAX_RESULTS} więcej - wpisz więcej liter
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          <SeatingCanvas
            room={plan.room}
            tables={plan.tables}
            landmarks={plan.landmarks}
            seatVisual={seatVisual}
            highlightedSeats={highlightedSeats}
            highlightedTables={highlightedTables}
            selectedSeat={selection?.kind === 'seat' ? seatKey(selection.tableId, selection.seatNumber) : null}
            focus={focus}
            ariaLabel="Plan sali - stoły i miejsca. Lista stołów z gośćmi jest pod planem."
            onSeatClick={(tableId, seatNumber) => setSelection({ kind: 'seat', tableId, seatNumber })}
            onTableClick={(tableId) => setSelection({ kind: 'table', tableId })}
          />
          <p className="text-center text-xs text-muted-foreground">
            Kliknij krzesło lub stół, aby zobaczyć, kto przy nim siedzi. Plan przybliżysz przyciskami lub dwoma palcami.
          </p>

          <details className="rounded-lg border bg-background/60 px-3 py-2 text-sm">
            <summary className="cursor-pointer rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Lista stołów i gości
            </summary>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plan.tables.map((table) => {
                const seated = plan.seats.filter((seat) => seat.table_id === table.id).sort((a, b) => a.seat_number - b.seat_number)
                return (
                  <li key={table.id}>
                    <p className="font-medium text-foreground">{table.name}</p>
                    {seated.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Brak przypisanych osób</p>
                    ) : (
                      <ul className="text-xs text-muted-foreground">
                        {seated.map((seat) => (
                          <li key={seat.guest_id} className={cn(highlightedSeats.has(seatKey(seat.table_id, seat.seat_number)) && 'font-medium text-foreground')}>
                            {seat.seat_number}. {seat.guest_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </details>
        </CardContent>
      </Card>

      <Dialog open={selection !== null} onOpenChange={(open) => !open && setSelection(null)}>
        <DialogContent>
          {selection?.kind === 'seat' ? (
            <DialogHeader>
              <DialogTitle>{selectedSeat ? selectedSeat.guest_name : 'Wolne miejsce'}</DialogTitle>
              <DialogDescription>
                {tableNames.get(selection.tableId)} · miejsce {selection.seatNumber}
              </DialogDescription>
            </DialogHeader>
          ) : selection?.kind === 'table' ? (
            <>
              <DialogHeader>
                <DialogTitle>{tableNames.get(selection.tableId)}</DialogTitle>
                <DialogDescription>Osoby przy tym stole</DialogDescription>
              </DialogHeader>
              {selectedTableGuests.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Lista gości zostanie uzupełniona wkrótce.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {selectedTableGuests.map((seat) => (
                    <li
                      key={seat.guest_id}
                      className={cn(
                        'rounded-md px-2 py-1 text-sm text-foreground',
                        highlightedSeats.has(seatKey(seat.table_id, seat.seat_number)) && 'bg-primary/10 font-medium'
                      )}
                    >
                      <span className="text-muted-foreground">{seat.seat_number}.</span> {seat.guest_name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
