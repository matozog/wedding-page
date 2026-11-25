import { AlertTriangle, GripVertical, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { ATTENDANCE_COLORS } from '@/lib/seatingColors'
import { ATTENDANCE_LABELS, guestDisplayName, type GuestGroup } from '@/types/guest'
import type { SeatedGuest } from '@/types/seating'
import { GUEST_DRAG_TYPE } from './SeatingCanvas'

type Filter = 'unseated' | 'all'

type SeatingGuestListProps = {
  guests: readonly SeatedGuest[]
  groups: readonly GuestGroup[]
  tableNames: ReadonlyMap<string, string>
  colorOf: (guest: SeatedGuest) => string
  highlightedGroupId: string | null
  // Wybrane krzesło - kliknięcie gościa sadza go na nim.
  seatSelected: boolean
  canDrag: boolean
  onGuestClick: (guest: SeatedGuest) => void
  onHighlightGroup: (groupId: string | null) => void
}

const collator = new Intl.Collator('pl', { sensitivity: 'base' })
const UNGROUPED = '__ungrouped__'

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

export function SeatingGuestList({
  guests,
  groups,
  tableNames,
  colorOf,
  highlightedGroupId,
  seatSelected,
  canDrag,
  onGuestClick,
  onHighlightGroup,
}: SeatingGuestListProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('unseated')

  const unseatedCount = guests.filter((guest) => !guest.table_id).length

  const sections = useMemo(() => {
    const search = normalize(query.trim())
    const byGroup = new Map<string, SeatedGuest[]>()

    for (const guest of guests) {
      const key = guest.group_id ?? UNGROUPED
      byGroup.set(key, [...(byGroup.get(key) ?? []), guest])
    }

    const groupNames = new Map(groups.map((group) => [group.id, group.name]))
    const keys = [...byGroup.keys()].sort((a, b) => {
      if (a === UNGROUPED) return 1
      if (b === UNGROUPED) return -1
      return collator.compare(groupNames.get(a) ?? '', groupNames.get(b) ?? '')
    })

    return keys
      .map((key) => {
        const members = byGroup.get(key) ?? []
        const tables = new Set(members.map((guest) => guest.table_id).filter(Boolean))
        const shown = members
          .filter((guest) => filter === 'all' || !guest.table_id)
          .filter((guest) => !search || normalize(guestDisplayName(guest)).includes(search))
          .sort((a, b) => collator.compare(guestDisplayName(a), guestDisplayName(b)))
        return {
          key,
          name: key === UNGROUPED ? 'Bez grupy' : (groupNames.get(key) ?? 'Grupa'),
          isGroup: key !== UNGROUPED,
          total: members.length,
          seated: members.filter((guest) => guest.table_id).length,
          // Grupa rozdzielona między stoły.
          split: key !== UNGROUPED && tables.size > 1,
          color: members[0] ? colorOf(members[0]) : null,
          guests: shown,
        }
      })
      .filter((section) => section.guests.length > 0)
  }, [colorOf, filter, groups, guests, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-foreground">Goście</h2>
        <span className="text-xs text-muted-foreground">
          {unseatedCount === 0 ? 'Wszyscy usadzeni' : `Nieusadzeni: ${unseatedCount}`}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj gościa…"
            aria-label="Szukaj gościa"
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          aria-label="Pokaż gości"
          className="w-36"
        >
          <option value="unseated">Nieusadzeni</option>
          <option value="all">Wszyscy</option>
        </NativeSelect>
      </div>

      {seatSelected && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground">
          Kliknij gościa, aby posadzić go na wybranym miejscu.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {guests.length === 0
              ? 'Lista gości jest pusta.'
              : filter === 'unseated' && !query
                ? 'Wszyscy goście mają miejsca.'
                : 'Brak pasujących gości.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sections.map((section) => (
              <li key={section.key}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    highlightedGroupId === section.key && 'bg-primary/10 text-foreground'
                  )}
                  aria-pressed={section.isGroup ? highlightedGroupId === section.key : undefined}
                  disabled={!section.isGroup}
                  title={section.isGroup ? 'Podświetl grupę na planie' : undefined}
                  onClick={() => onHighlightGroup(highlightedGroupId === section.key ? null : section.key)}
                >
                  {section.isGroup && section.color && (
                    <span className="size-3 shrink-0 rounded-full border border-border" style={{ background: section.color }} aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate uppercase tracking-wide">{section.name}</span>
                  {section.split && (
                    <span className="inline-flex items-center gap-1 text-amber-600" title="Grupa siedzi przy różnych stołach">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Grupa siedzi przy różnych stołach</span>
                    </span>
                  )}
                  <span>
                    {section.seated}/{section.total}
                  </span>
                </button>

                <ul className="mt-1 flex flex-col gap-1">
                  {section.guests.map((guest) => {
                    const name = guestDisplayName(guest)
                    const tableName = guest.table_id ? tableNames.get(guest.table_id) : null

                    return (
                      <li key={guest.id}>
                        <button
                          type="button"
                          draggable={canDrag}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(GUEST_DRAG_TYPE, guest.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onClick={() => onGuestClick(guest)}
                          className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-sm hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={[
                            seatSelected ? `Posadź: ${name}` : name,
                            ATTENDANCE_LABELS[guest.attendance],
                            tableName ? `${tableName}, miejsce ${guest.seat_number}` : 'bez miejsca',
                          ].join(', ')}
                        >
                          {canDrag && <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: ATTENDANCE_COLORS[guest.attendance] }}
                            title={ATTENDANCE_LABELS[guest.attendance]}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {tableName && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {tableName} · {guest.seat_number}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
