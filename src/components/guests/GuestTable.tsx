import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { effectiveAddress, type GuestSort, type GuestSortKey } from '@/lib/guestList'
import { countPl } from '@/lib/plural'
import { cn } from '@/lib/utils'
import {
  AGE_GROUP_LABELS,
  guestDisplayName,
  type Guest,
  type GuestGroup,
} from '@/types/guest'
import { AttendanceBadge } from './AttendanceBadge'
import { sectionTitle, type GuestSection } from './guestSections'
import { useSideOptions } from './sideOptionsContext'

export type GuestListEditing =
  | { mode: 'new'; groupId: string | null }
  | { mode: 'edit'; guestId: string }
  | null

export type GuestListActions = {
  onEdit: (guest: Guest) => void
  onDelete: (guest: Guest) => void
  onAddToGroup: (groupId: string | null) => void
  onEditGroup: (group: GuestGroup) => void
  onDeleteGroup: (group: GuestGroup) => void
  onToggleCollapsed: (key: string) => void
}

type GuestTableProps = GuestListActions & {
  sections: GuestSection[]
  groupView: boolean
  groupsById: ReadonlyMap<string, GuestGroup>
  sort: GuestSort
  canEdit: boolean
  collapsed: ReadonlySet<string>
  editing: GuestListEditing
  emptyMessage: string | null
  // Klasy kontenera przewijania (np. wysokość na cały ekran).
  containerClassName?: string
  onSortChange: (sort: GuestSort) => void
  renderEditRow: (guest: Guest | null, defaultGroupId: string | null, columnCount: number) => ReactNode
}

function SortableHead({
  label,
  sortKey,
  sort,
  className,
  onSortChange,
}: {
  label: string
  sortKey: GuestSortKey
  sort: GuestSort
  className?: string
  onSortChange: (sort: GuestSort) => void
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={cn(
          '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-foreground'
        )}
        onClick={() =>
          onSortChange({
            key: sortKey,
            direction: active && sort.direction === 'asc' ? 'desc' : 'asc',
          })
        }
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    </TableHead>
  )
}

function GuestNameCell({ guest }: { guest: Guest }) {
  const tags = [
    guest.is_plus_one && guest.first_name && 'os. towarzysząca',
    guest.age_group !== 'ADULT' && AGE_GROUP_LABELS[guest.age_group].toLowerCase(),
  ].filter(Boolean)

  return (
    <div className="flex flex-col">
      <span className={cn(!guest.first_name && 'italic text-muted-foreground')}>
        {guest.first_name ?? (guest.is_plus_one ? 'Osoba towarzysząca' : '—')}
      </span>
      {tags.length > 0 && <span className="text-xs text-muted-foreground">{tags.join(' · ')}</span>}
    </div>
  )
}

export function AddressText({
  guest,
  groupsById,
}: {
  guest: Guest
  groupsById: ReadonlyMap<string, GuestGroup>
}) {
  const address = effectiveAddress(guest, groupsById)

  if (!address) {
    return <span className="text-muted-foreground">—</span>
  }

  if (!guest.address) {
    return (
      <span className="text-muted-foreground" title="Adres grupy">
        {address}
      </span>
    )
  }

  return <span>{address}</span>
}

function GuestRow({
  guest,
  groupView,
  groupsById,
  canEdit,
  actionsDisabled,
  onEdit,
  onDelete,
}: {
  guest: Guest
  groupView: boolean
  groupsById: ReadonlyMap<string, GuestGroup>
  canEdit: boolean
  actionsDisabled: boolean
  onEdit: (guest: Guest) => void
  onDelete: (guest: Guest) => void
}) {
  const sides = useSideOptions()
  const name = guestDisplayName(guest)
  const group = guest.group_id ? groupsById.get(guest.group_id) : undefined

  return (
    <TableRow className="hover:bg-muted/40 [&>td]:py-1.5" onDoubleClick={canEdit && !actionsDisabled ? () => onEdit(guest) : undefined}>
      <TableCell className={cn(groupView && 'pl-10')}>
        <GuestNameCell guest={guest} />
      </TableCell>
      <TableCell>{guest.last_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="max-w-72">
        <AddressText guest={guest} groupsById={groupsById} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {guest.phone ? (
          <a
            href={`tel:${guest.phone.replace(/[^\d+]/g, '')}`}
            className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {guest.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {sides.enabled && (
        <TableCell>{sides.labelOf(guest.side) ?? <span className="text-muted-foreground">—</span>}</TableCell>
      )}
      <TableCell>
        <AttendanceBadge value={guest.attendance} />
      </TableCell>
      {!groupView && (
        <TableCell>{group?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
      )}
      {canEdit && (
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={actionsDisabled}
              aria-label={`Edytuj: ${name}`}
              title="Edytuj"
              onClick={() => onEdit(guest)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              aria-label={`Usuń: ${name}`}
              title="Usuń"
              onClick={() => onDelete(guest)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}

function SectionHeaderRow({
  section,
  columnCount,
  canEdit,
  expanded,
  onToggleCollapsed,
  onAddToGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  section: Extract<GuestSection, { kind: 'group' | 'ungrouped' }>
  columnCount: number
  canEdit: boolean
  expanded: boolean
} & Pick<GuestListActions, 'onToggleCollapsed' | 'onAddToGroup' | 'onEditGroup' | 'onDeleteGroup'>) {
  const sides = useSideOptions()
  const title = sectionTitle(section)
  const group = section.kind === 'group' ? section.group : null
  const sideLabel = sides.labelOf(group?.side ?? null)
  const count =
    section.guests.length === section.totalInGroup
      ? countPl(section.totalInGroup, 'osoba', 'osoby', 'osób')
      : `${section.guests.length} z ${section.totalInGroup}`

  return (
    <TableRow>
      {/* Przyklejony pod nagłówkiem kolumn (h-11) podczas przewijania grupy. */}
      <th
        scope="rowgroup"
        colSpan={columnCount}
        className="sticky top-11 z-10 bg-muted px-3 py-1.5 text-left font-normal"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${title} (${count})`}
            onClick={() => onToggleCollapsed(section.key)}
            className="inline-flex items-center gap-2 rounded-sm font-serif text-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            {title}
          </button>
          <span className="text-sm text-muted-foreground">{count}</span>
          {sideLabel && <span className="text-sm text-muted-foreground">· {sideLabel}</span>}
          {group?.address && (
            <span className="min-w-0 truncate text-sm text-muted-foreground">· {group.address}</span>
          )}

          {canEdit && (
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddToGroup(group?.id ?? null)}
                aria-label={`Dodaj osobę: ${title}`}
              >
                <UserPlus className="size-4" />
                <span className="hidden lg:inline">Dodaj osobę</span>
              </Button>
              {group && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={`Edytuj grupę: ${title}`}
                    title="Edytuj grupę"
                    onClick={() => onEditGroup(group)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-destructive hover:text-destructive"
                    aria-label={`Usuń grupę: ${title}`}
                    title="Usuń grupę"
                    onClick={() => onDeleteGroup(group)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </th>
    </TableRow>
  )
}

export function GuestTable({
  sections,
  groupView,
  groupsById,
  sort,
  canEdit,
  collapsed,
  editing,
  emptyMessage,
  containerClassName,
  onSortChange,
  renderEditRow,
  ...actions
}: GuestTableProps) {
  const sides = useSideOptions()
  const columnCount = 5 + (sides.enabled ? 1 : 0) + (groupView ? 0 : 1) + (canEdit ? 1 : 0)
  const sortProps = { sort, onSortChange }
  const editingId = editing?.mode === 'edit' ? editing.guestId : null

  const renderRows = (guests: Guest[]) =>
    guests.map((guest) =>
      guest.id === editingId ? (
        <Fragment key={guest.id}>{renderEditRow(guest, guest.group_id, columnCount)}</Fragment>
      ) : (
        <GuestRow
          key={guest.id}
          guest={guest}
          groupView={groupView}
          groupsById={groupsById}
          canEdit={canEdit}
          actionsDisabled={editing !== null}
          onEdit={actions.onEdit}
          onDelete={actions.onDelete}
        />
      )
    )

  const newRowFor = (groupId: string | null) =>
    editing?.mode === 'new' && editing.groupId === groupId
      ? renderEditRow(null, groupId, columnCount)
      : null

  return (
    <Table containerClassName={containerClassName}>
      <TableHeader className="sticky top-0 z-20 bg-background shadow-[0_1px_0_hsl(var(--border))]">
        <TableRow>
          <SortableHead label="Imię" sortKey="first_name" className={cn(groupView && 'pl-10')} {...sortProps} />
          <SortableHead label="Nazwisko" sortKey="last_name" {...sortProps} />
          <SortableHead label="Adres" sortKey="address" {...sortProps} />
          <SortableHead label="Telefon" sortKey="phone" {...sortProps} />
          {sides.enabled && <SortableHead label="Od kogo" sortKey="side" {...sortProps} />}
          <SortableHead label="Obecność" sortKey="attendance" {...sortProps} />
          {!groupView && <SortableHead label="Grupa" sortKey="group" {...sortProps} />}
          {canEdit && (
            <TableHead className="text-right">
              <span className="sr-only">Akcje</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>

      {sections.map((section) => {
        if (section.kind === 'flat') {
          return (
            <TableBody key={section.key}>
              {newRowFor(null)}
              {renderRows(section.guests)}
            </TableBody>
          )
        }

        const groupId = section.kind === 'group' ? section.group.id : null
        const expanded = !collapsed.has(section.key)

        return (
          <TableBody key={section.key}>
            <SectionHeaderRow
              section={section}
              columnCount={columnCount}
              canEdit={canEdit}
              expanded={expanded}
              onToggleCollapsed={actions.onToggleCollapsed}
              onAddToGroup={actions.onAddToGroup}
              onEditGroup={actions.onEditGroup}
              onDeleteGroup={actions.onDeleteGroup}
            />
            {expanded && renderRows(section.guests)}
            {expanded && newRowFor(groupId)}
            {expanded && section.guests.length === 0 && !newRowFor(groupId) && (
              <TableRow>
                <TableCell colSpan={columnCount} className="pl-10 text-sm text-muted-foreground">
                  Brak osób w grupie.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        )
      })}

      {emptyMessage && (
        <TableBody>
          <TableRow>
            <TableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        </TableBody>
      )}
    </Table>
  )
}

