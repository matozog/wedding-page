import { Eye, RefreshCw, Users } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useGuests } from '@/hooks/useGuests'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  computeGuestStats,
  filterGuests,
  sortGroups,
  sortGuests,
  type GuestFilters,
  type GuestSort,
} from '@/lib/guestList'
import { countPl } from '@/lib/plural'
import { guestDisplayName, type Guest, type GuestGroup, type GuestInput } from '@/types/guest'
import { GroupDialog } from './GroupDialog'
import { GuestCardList } from './GuestCardList'
import { GuestEditRow } from './GuestEditRow'
import { GuestEditSheet } from './GuestEditSheet'
import { GuestStats } from './GuestStats'
import { GuestTable, type GuestListEditing } from './GuestTable'
import { GuestToolbar } from './GuestToolbar'
import { UNGROUPED_KEY, type GuestSection } from './guestSections'

const GROUP_VIEW_KEY = 'guest-list-group-view'

const readGroupView = () => {
  try {
    return localStorage.getItem(GROUP_VIEW_KEY) !== 'false'
  } catch {
    return true
  }
}

const saveGroupView = (value: boolean) => {
  try {
    localStorage.setItem(GROUP_VIEW_KEY, String(value))
  } catch {
    // Storage niedostępny - widok nie zostanie zapamiętany
  }
}

type GuestManagementPanelProps = {
  eventId: string
  // ADMIN edytuje, EDITOR tylko podgląd (RLS egzekwuje to samo w bazie).
  canEdit: boolean
}

export function GuestManagementPanel({ eventId, canEdit }: GuestManagementPanelProps) {
  const {
    guests,
    groups,
    loading,
    error,
    reload,
    addGuest,
    editGuest,
    removeGuest,
    addGroup,
    editGroup,
    removeGroup,
  } = useGuests(eventId)

  // Tabela z kolumnami mieści się dopiero na szerokim ekranie.
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [filters, setFilters] = useState<GuestFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<GuestSort>(DEFAULT_SORT)
  const [groupView, setGroupView] = useState(readGroupView)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const [editing, setEditing] = useState<GuestListEditing>(null)
  const dirtyRef = useRef(false)
  // Zmiana edytowanego wiersza czeka na potwierdzenie porzucenia zmian.
  const [pendingEditing, setPendingEditing] = useState<{ next: GuestListEditing } | null>(null)

  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<GuestGroup | null>(null)
  const [deleteGroupMembers, setDeleteGroupMembers] = useState(false)
  // undefined = zamknięte, null = nowa grupa
  const [groupDialog, setGroupDialog] = useState<GuestGroup | null | undefined>(undefined)

  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const sortedGroups = useMemo(() => sortGroups(groups), [groups])
  const stats = useMemo(() => computeGuestStats(guests), [guests])
  const filtered = useMemo(() => filterGuests(guests, filters, groupsById), [guests, filters, groupsById])
  const sorted = useMemo(() => sortGuests(filtered, sort, groupsById), [filtered, sort, groupsById])
  const hasFilters = filters.search !== '' || filters.attendance !== '' || filters.side !== ''

  const sections = useMemo<GuestSection[]>(() => {
    if (!groupView) {
      return [{ kind: 'flat', key: 'all', guests: sorted }]
    }

    const shown = new Map<string | null, Guest[]>()
    const totals = new Map<string | null, number>()
    const groupKey = (guest: Guest) =>
      guest.group_id && groupsById.has(guest.group_id) ? guest.group_id : null

    for (const guest of guests) {
      const key = groupKey(guest)
      totals.set(key, (totals.get(key) ?? 0) + 1)
    }

    for (const guest of sorted) {
      const key = groupKey(guest)
      shown.set(key, [...(shown.get(key) ?? []), guest])
    }

    const addingTo = editing?.mode === 'new' ? editing.groupId : undefined

    // Z aktywnym filtrem tylko grupy z pasującymi osobami.
    const result: GuestSection[] = sortedGroups
      .filter((group) => !hasFilters || shown.has(group.id) || addingTo === group.id)
      .map((group) => ({
        kind: 'group',
        key: group.id,
        group,
        guests: shown.get(group.id) ?? [],
        totalInGroup: totals.get(group.id) ?? 0,
      }))

    if (shown.has(null) || addingTo === null) {
      result.push({
        kind: 'ungrouped',
        key: UNGROUPED_KEY,
        guests: shown.get(null) ?? [],
        totalInGroup: totals.get(null) ?? 0,
      })
    }

    return result
  }, [editing, groupView, groupsById, guests, hasFilters, sorted, sortedGroups])

  const emptyMessage =
    editing?.mode === 'new'
      ? null
      : guests.length === 0 && groups.length === 0
        ? canEdit
          ? 'Lista gości jest pusta. Zacznij od „Dodaj gościa” albo „Dodaj grupę”.'
          : 'Lista gości jest pusta.'
        : hasFilters && filtered.length === 0
          ? 'Brak gości pasujących do filtrów.'
          : null

  // --- edycja -----------------------------------------------------------------
  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const requestEditing = (next: GuestListEditing) => {
    if (editing && dirtyRef.current) {
      setPendingEditing({ next })
      return
    }
    setEditing(next)
  }

  const expand = (key: string) =>
    setCollapsed((current) => {
      if (!current.has(key)) return current
      const next = new Set(current)
      next.delete(key)
      return next
    })

  const startAdding = (groupId: string | null) => {
    if (groupView) {
      expand(groupId ?? UNGROUPED_KEY)
    }
    requestEditing({ mode: 'new', groupId })
  }

  const finishEditing = () => {
    dirtyRef.current = false
    setEditing(null)
  }

  const handleSave = async (input: GuestInput) => {
    if (editing?.mode === 'edit') {
      await editGuest(editing.guestId, input)
    } else {
      await addGuest(input)
    }
    finishEditing()
  }

  const saveHandlers = { onCreateGroup: addGroup, onSave: handleSave }
  const cancelEditing = () => requestEditing(null)

  const editedGuest =
    editing?.mode === 'edit' ? (guests.find((guest) => guest.id === editing.guestId) ?? null) : null
  const editingKey = editing ? (editing.mode === 'edit' ? editing.guestId : `new-${editing.groupId}`) : ''

  const renderEditRow = (guest: Guest | null, defaultGroupId: string | null, columnCount: number) => (
    <GuestEditRow
      guest={guest}
      defaultGroupId={defaultGroupId}
      groups={sortedGroups}
      showGroupColumn={!groupView}
      columnCount={columnCount}
      onCancel={cancelEditing}
      onDirtyChange={handleDirtyChange}
      {...saveHandlers}
    />
  )

  // --- akcje listy --------------------------------------------------------------
  const listActions = {
    onEdit: (guest: Guest) => requestEditing({ mode: 'edit', guestId: guest.id }),
    onDelete: setGuestToDelete,
    onAddToGroup: startAdding,
    onEditGroup: (group: GuestGroup) => setGroupDialog(group),
    onDeleteGroup: (group: GuestGroup) => {
      setDeleteGroupMembers(false)
      setGroupToDelete(group)
    },
    onToggleCollapsed: (key: string) =>
      setCollapsed((current) => {
        const next = new Set(current)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      }),
  }

  const handleGroupViewChange = (value: boolean) => {
    setGroupView(value)
    saveGroupView(value)
    // W widoku płaskim "sortuj po grupach" trzyma rodziny obok siebie.
    if (!value && sort.key === DEFAULT_SORT.key) {
      setSort({ key: 'group', direction: 'asc' })
    }
  }

  const groupToDeleteCount = groupToDelete
    ? guests.filter((guest) => guest.group_id === groupToDelete.id).length
    : 0

  // --- render -----------------------------------------------------------------
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden="true" />
          Goście
        </CardTitle>
        <CardDescription>
          Lista gości, rodziny i przewidywana obecność.
        </CardDescription>
        {!canEdit && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="size-4" aria-hidden="true" />
            Masz dostęp tylko do podglądu listy gości.
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8" role="alert">
            <ErrorMessage message={error} />
            <Button type="button" variant="outline" onClick={() => void reload()}>
              <RefreshCw className="size-4" />
              Spróbuj ponownie
            </Button>
          </div>
        ) : loading && guests.length === 0 && groups.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground" aria-live="polite">
            Wczytywanie listy gości…
          </p>
        ) : (
          <>
            <GuestStats
              stats={stats}
              activeAttendance={filters.attendance}
              onSelectAttendance={(attendance) => setFilters((current) => ({ ...current, attendance }))}
            />

            <GuestToolbar
              filters={filters}
              groupView={groupView}
              sort={sort}
              showSortSelect={!isDesktop}
              canEdit={canEdit}
              shownCount={filtered.length}
              totalCount={guests.length}
              onFiltersChange={setFilters}
              onGroupViewChange={handleGroupViewChange}
              onSortChange={setSort}
              onCollapseAll={() =>
                setCollapsed(new Set([...groups.map((group) => group.id), UNGROUPED_KEY]))
              }
              onExpandAll={() => setCollapsed(new Set())}
              onAddGuest={() => startAdding(null)}
              onAddGroup={() => setGroupDialog(null)}
            />

            {isDesktop ? (
              <GuestTable
                sections={sections}
                groupView={groupView}
                groupsById={groupsById}
                sort={sort}
                canEdit={canEdit}
                collapsed={collapsed}
                editing={editing}
                emptyMessage={emptyMessage}
                onSortChange={setSort}
                renderEditRow={renderEditRow}
                {...listActions}
              />
            ) : (
              <GuestCardList
                sections={sections}
                groupView={groupView}
                groupsById={groupsById}
                canEdit={canEdit}
                collapsed={collapsed}
                emptyMessage={emptyMessage}
                {...listActions}
              />
            )}
          </>
        )}
      </CardContent>

      {!isDesktop && editing && (
        <GuestEditSheet
          key={editingKey}
          guest={editedGuest}
          defaultGroupId={editing.mode === 'new' ? editing.groupId : (editedGuest?.group_id ?? null)}
          groups={sortedGroups}
          onCancel={cancelEditing}
          onDirtyChange={handleDirtyChange}
          {...saveHandlers}
        />
      )}

      {groupDialog !== undefined && (
        <GroupDialog
          group={groupDialog}
          onClose={() => setGroupDialog(undefined)}
          onSave={async (input) => {
            if (groupDialog) {
              await editGroup(groupDialog.id, input)
            } else {
              await addGroup(input)
            }
          }}
        />
      )}

      <ConfirmDialog
        open={pendingEditing !== null}
        title="Porzucić zmiany?"
        description="Edytowany wiersz ma niezapisane zmiany."
        confirmLabel="Porzuć zmiany"
        destructive
        onOpenChange={(open) => !open && setPendingEditing(null)}
        onConfirm={() => {
          dirtyRef.current = false
          setEditing(pendingEditing?.next ?? null)
        }}
      />

      <ConfirmDialog
        open={guestToDelete !== null}
        title="Usunąć gościa?"
        description={
          guestToDelete
            ? `${guestDisplayName(guestToDelete)} zniknie z listy gości i z planu stołów. Tej operacji nie można cofnąć.`
            : ''
        }
        confirmLabel="Usuń gościa"
        destructive
        errorMessage="Nie udało się usunąć gościa."
        onOpenChange={(open) => !open && setGuestToDelete(null)}
        onConfirm={async () => {
          if (!guestToDelete) return
          await removeGuest(guestToDelete.id)
          if (editing?.mode === 'edit' && editing.guestId === guestToDelete.id) {
            finishEditing()
          }
        }}
      />

      <ConfirmDialog
        open={groupToDelete !== null}
        title="Usunąć grupę?"
        description={
          groupToDelete
            ? `Grupa „${groupToDelete.name}” zostanie usunięta. ${
                groupToDeleteCount > 0
                  ? 'Osoby z grupy zostaną na liście jako „Bez grupy”, chyba że zaznaczysz inaczej.'
                  : 'Grupa nie ma żadnych osób.'
              }`
            : ''
        }
        confirmLabel={deleteGroupMembers ? 'Usuń grupę i osoby' : 'Usuń grupę'}
        destructive
        errorMessage="Nie udało się usunąć grupy."
        onOpenChange={(open) => !open && setGroupToDelete(null)}
        onConfirm={async () => {
          if (!groupToDelete) return
          const withMembers = deleteGroupMembers && groupToDeleteCount > 0
          await removeGroup(groupToDelete.id, withMembers)
          // Otwarty formularz wskazywałby nieistniejącą grupę.
          if (
            editedGuest?.group_id === groupToDelete.id ||
            (editing?.mode === 'new' && editing.groupId === groupToDelete.id)
          ) {
            finishEditing()
          }
        }}
      >
        {groupToDeleteCount > 0 && (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-destructive"
              checked={deleteGroupMembers}
              onChange={(event) => setDeleteGroupMembers(event.target.checked)}
            />
            Usuń także {countPl(groupToDeleteCount, 'osobę', 'osoby', 'osób')} z tej grupy
          </label>
        )}
      </ConfirmDialog>
    </Card>
  )
}
