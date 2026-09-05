import { useEffect, useMemo, useRef, useState } from 'react'
import { MoveHorizontal, Search } from 'lucide-react'
import { weddingContent } from '@/config/weddingContent'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const { seating } = weddingContent

export function SeatingPlanSection() {
  const [query, setQuery] = useState('')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const tableRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const normalizedQuery = query.trim().toLowerCase()

  const matchingTableIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>()

    return new Set(
      seating.tables
        .filter((table) => table.guests.some((guest) => guest.toLowerCase().includes(normalizedQuery)))
        .map((table) => table.id)
    )
  }, [normalizedQuery])

  useEffect(() => {
    const [firstMatchId] = matchingTableIds
    if (!firstMatchId) return

    tableRefs.current[firstMatchId]?.scrollIntoView({
      behavior: 'auto',
      inline: 'center',
      block: 'nearest',
    })
  }, [matchingTableIds])

  const selectedTable = seating.tables.find((table) => table.id === selectedTableId) ?? null

  return (
    <section
      id="plan-sali"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8"
    >
      <div className="mb-10 text-center">
        <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">Informacje</p>
        <h2 className="mt-2 font-serif text-4xl text-foreground">Rozmieszczenie gości</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{seating.note}</p>
      </div>

      <Card className="border-border/80 bg-card/80">
        <CardContent className="space-y-6 pt-6">
          <div className="relative mx-auto max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Znajdź swoje imię..."
              className="pl-9"
            />
          </div>

          <div className="-mx-6 overflow-x-auto px-6 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:overflow-visible sm:px-0">
            <div
              className="relative min-w-[640px] overflow-hidden rounded-xl border border-border/60 bg-secondary/30 sm:min-w-0 sm:w-full"
              style={{ aspectRatio: seating.roomAspectRatio }}
            >
              {seating.landmarks.map((landmark) => (
              <div
                key={landmark.id}
                className="absolute flex items-center justify-center rounded-md border border-dashed border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground/70 sm:text-xs"
                style={{
                  left: `${landmark.x}%`,
                  top: `${landmark.y}%`,
                  width: `${landmark.w}%`,
                  height: `${landmark.h}%`,
                }}
              >
                {landmark.label}
              </div>
            ))}

            {seating.tables.map((table) => {
              const isMatch = matchingTableIds.has(table.id)

              return (
                <button
                  key={table.id}
                  ref={(el) => {
                    tableRefs.current[table.id] = el
                  }}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                  aria-label={`${table.label}, goście: ${table.guests.join(', ')}`}
                  className={cn(
                    'absolute flex items-center justify-center rounded-md border bg-card px-0.5 text-center text-[10px] font-medium leading-tight text-foreground shadow-sm transition-colors hover:bg-accent sm:text-xs',
                    isMatch ? 'border-primary ring-2 ring-primary' : 'border-border/80'
                  )}
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.w}%`,
                    height: `${table.h}%`,
                  }}
                >
                  {table.label}
                </button>
              )
            })}
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground sm:hidden">
            <MoveHorizontal className="size-3.5" />
            Przesuń, aby zobaczyć cały plan
          </p>
        </CardContent>
      </Card>

      <Dialog open={selectedTable !== null} onOpenChange={(open) => !open && setSelectedTableId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTable?.label}</DialogTitle>
            <DialogDescription>Lista gości przy tym stole</DialogDescription>
          </DialogHeader>

          {selectedTable && selectedTable.guests.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Lista gości zostanie uzupełniona wkrótce.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {selectedTable?.guests.map((guest) => (
                <li
                  key={guest}
                  className={cn(
                    'rounded-md px-2 py-1 text-sm text-foreground',
                    normalizedQuery && guest.toLowerCase().includes(normalizedQuery) && 'bg-primary/10 font-medium'
                  )}
                >
                  {guest}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
