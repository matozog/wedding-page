import { Eye, EyeOff, Loader2, Maximize, RefreshCw, Save, Undo2, UserMinus, UserPen } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AttendanceBadge } from '@/components/guests/AttendanceBadge'
import { GuestEditSheet } from '@/components/guests/GuestEditSheet'
import { InviterOptionsContext } from '@/components/guests/inviterOptionsContext'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isNewId, useSeatingEditor } from '@/hooks/useSeatingEditor'
import { useThemeColors } from '@/hooks/useThemeColors'
import { ATTENDANCE_COLORS, NEUTRAL_SEAT_COLOR, paletteColor } from '@/lib/seatingColors'
import type { UnseatedGuest } from '@/lib/seatingApi'
import { countPl } from '@/lib/plural'
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  buildInviterOptions,
  guestDisplayName,
  guestInviterValue,
} from '@/types/guest'
import { SHAPE_OPTIONS, seatKey, type SeatedGuest, type SeatingShape } from '@/types/seating'
import { LandmarkSettingsForm } from './LandmarkSettingsForm'
import { RoomSizeDialog } from './RoomSizeDialog'
import { SeatingCanvas, type CanvasFocus, type SeatVisual } from './SeatingCanvas'
import { SeatingGuestList } from './SeatingGuestList'
import { TableSettingsForm } from './TableSettingsForm'

type ColorMode = 'group' | 'attendance' | 'inviter'

const LANDMARK_PRESETS: readonly { label: string; width: number; height: number }[] = [
  { label: 'Parkiet', width: 600, height: 400 },
  { label: 'Wejście', width: 200, height: 60 },
  { label: 'Scena', width: 400, height: 200 },
  { label: 'Zespół / DJ', width: 300, height: 150 },
  { label: 'Bufet', width: 300, height: 100 },
  { label: 'Bar', width: 250, height: 100 },
  { label: 'Tort', width: 120, height: 120 },
  { label: 'Inny element', width: 200, height: 200 },
]

const initials = (guest: SeatedGuest) => {
  const letters = [guest.first_name, guest.last_name]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase()
  return letters || (guest.is_plus_one ? '+1' : '?')
}

const normalizeAngle = (value: number) => (((value % 360) + 360) % 360) % 360

type SeatingEditorPanelProps = {
  eventId: string
  // Niezapisany układ - ekran pyta przed wylogowaniem.
  onDirtyChange?: (dirty: boolean) => void
}

export function SeatingEditorPanel({ eventId, onDirtyChange }: SeatingEditorPanelProps) {
  const editor = useSeatingEditor(eventId)
  const {
    draft,
    dirty,
    isPublished,
    guests,
    groups,
    loading,
    error,
    inactiveTables,
    updateTable,
    updateLandmark,
  } = editor
  const colors = useThemeColors()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; seatNumber: number } | null>(null)
  const [colorMode, setColorMode] = useState<ColorMode>('group')
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<CanvasFocus | null>(null)
  const [roomDialog, setRoomDialog] = useState(false)
  const [editedGuestId, setEditedGuestId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingUnseat, setPendingUnseat] = useState<UnseatedGuest[] | null>(null)
  const [publishing, setPublishing] = useState(false)
  // Informacja po zmianie miejsc (np. ktoś trafił do nieusadzonych).
  const [notice, setNotice] = useState<string | null>(null)
  // Link kliknięty przy niezapisanym układzie - czeka na potwierdzenie.
  const [pendingLink, setPendingLink] = useState<HTMLAnchorElement | null>(null)
  const allowLinkRef = useRef(false)
  // Edycja gościa w arkuszu - zamknięcie z niezapisanymi zmianami pyta.
  const guestDirtyRef = useRef(false)
  const [confirmCloseGuest, setConfirmCloseGuest] = useState(false)

  // Niezapisany układ - ostrzeżenie przy zamknięciu karty.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // Linki aplikacji (ścieżka, "Strona wydarzenia") zmieniają widok bez
  // przeładowania - beforeunload ich nie łapie. BrowserRouter nie ma
  // useBlocker, więc przechwytujemy kliknięcie przed obsługą routera.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: MouseEvent) => {
      if (allowLinkRef.current) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.origin !== window.location.origin) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      setPendingLink(link)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [dirty])

  const inviterOptions = useMemo(() => buildInviterOptions(guests), [guests])
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const tableNames = useMemo(() => new Map(draft.tables.map((table) => [table.id, table.name])), [draft.tables])
  const guestBySeat = useMemo(() => {
    const map = new Map<string, SeatedGuest>()
    for (const guest of guests) {
      if (guest.table_id && guest.seat_number) map.set(seatKey(guest.table_id, guest.seat_number), guest)
    }
    return map
  }, [guests])

  const colorOf = useCallback(
    (guest: SeatedGuest) => {
      if (colorMode === 'attendance') return ATTENDANCE_COLORS[guest.attendance]
      if (colorMode === 'inviter') {
        const value = guestInviterValue(guest)
        return value ? paletteColor(value) : NEUTRAL_SEAT_COLOR
      }
      return guest.group_id ? paletteColor(guest.group_id) : NEUTRAL_SEAT_COLOR
    },
    [colorMode]
  )

  const seatVisual = useCallback(
    (tableId: string, seatNumber: number): SeatVisual => {
      const guest = guestBySeat.get(seatKey(tableId, seatNumber))
      if (!guest) {
        return { fill: colors.card, title: `Wolne miejsce ${seatNumber}`, dimmed: highlightedGroupId !== null }
      }
      const group = guest.group_id ? groupsById.get(guest.group_id) : null
      return {
        fill: colorOf(guest),
        dot: colorMode === 'attendance' ? null : ATTENDANCE_COLORS[guest.attendance],
        label: initials(guest),
        title: [`${seatNumber}. ${guestDisplayName(guest)}`, ATTENDANCE_LABELS[guest.attendance], group?.name]
          .filter(Boolean)
          .join(' · '),
        dimmed: highlightedGroupId !== null && guest.group_id !== highlightedGroupId,
      }
    },
    [colorMode, colorOf, colors.card, groupsById, guestBySeat, highlightedGroupId]
  )

  const selectedTable = draft.tables.find((table) => table.id === selectedId) ?? null
  const selectedLandmark = draft.landmarks.find((item) => item.id === selectedId) ?? null
  // Wybrane krzesło przestaje obowiązywać, gdy stołu nie ma (usunięty,
  // odrzucony szkic) albo czeka na zapis układu.
  const activeSeat =
    selectedSeat && tableNames.has(selectedSeat.tableId) && !inactiveTables.has(selectedSeat.tableId)
      ? selectedSeat
      : null
  const seatOccupant = activeSeat ? (guestBySeat.get(seatKey(activeSeat.tableId, activeSeat.seatNumber)) ?? null) : null
  const editedGuest = guests.find((guest) => guest.id === editedGuestId) ?? null
  const seatedCountAt = (tableId: string) => guests.filter((guest) => guest.table_id === tableId).length
  const seatedTotal = guests.filter((guest) => guest.table_id).length
  const capacityTotal = draft.tables.reduce((sum, table) => sum + table.capacity, 0)

  // --- akcje ------------------------------------------------------------------
  // Zajęte miejsce = zamiana. Gdy nowa osoba nie miała miejsca, poprzednia
  // trafia do nieusadzonych - mówimy o tym wprost.
  const runAssign = async (guestId: string, tableId: string | null, seatNumber: number | null) => {
    setActionError(null)
    setNotice(null)
    const guest = guests.find((item) => item.id === guestId)
    const occupant = tableId && seatNumber ? guestBySeat.get(seatKey(tableId, seatNumber)) : undefined
    try {
      await editor.assign(guestId, tableId, seatNumber)
      if (guest && occupant && occupant.id !== guest.id) {
        setNotice(
          guest.table_id
            ? `${guestDisplayName(occupant)} i ${guestDisplayName(guest)} zamienili się miejscami.`
            : `${guestDisplayName(occupant)} trafia do nieusadzonych - miejsce zajmuje ${guestDisplayName(guest)}.`
        )
      }
      return true
    } catch (err) {
      console.error(err)
      setActionError('Nie udało się zmienić miejsca. Odświeżyliśmy listę gości.')
      return false
    }
  }

  const handleSelect = (id: string | null) => {
    setSelectedId(id)
    if (id) setSelectedSeat(null)
  }

  const handleSeatClick = (tableId: string, seatNumber: number) => {
    setSelectedId(null)
    setSelectedSeat({ tableId, seatNumber })
  }

  const handleGuestClick = (guest: SeatedGuest) => {
    if (activeSeat) {
      // Po przypisaniu krzesło nie jest już wybrane - kolejne kliknięcie
      // gościa nie podmieni osoby, którą właśnie posadzono.
      void runAssign(guest.id, activeSeat.tableId, activeSeat.seatNumber).then((ok) => {
        if (ok) setSelectedSeat(null)
      })
      return
    }
    if (guest.table_id && guest.seat_number) {
      setSelectedSeat({ tableId: guest.table_id, seatNumber: guest.seat_number })
      setFocus({ tableId: guest.table_id, seatNumber: guest.seat_number, nonce: Date.now() })
    }
  }

  const handleAddTable = (shape: SeatingShape) => {
    const id = editor.addTable(shape)
    handleSelect(id)
  }

  const handleAddLandmark = (index: number) => {
    const preset = LANDMARK_PRESETS[index]
    if (!preset) return
    handleSelect(editor.addLandmark(preset.label, preset.width, preset.height))
  }

  const commitSave = async () => {
    const result = await editor.saveLayout(false)
    if (selectedId && result.idMap.has(selectedId)) {
      setSelectedId(result.idMap.get(selectedId) ?? null)
    }
    setPendingUnseat(null)
  }

  const handleSave = async () => {
    const names = draft.tables.map((table) => table.name.trim())
    if (names.some((name) => !name)) {
      setActionError('Każdy stół musi mieć nazwę.')
      return
    }
    if (new Set(names).size !== names.length) {
      setActionError('Nazwy stołów muszą być różne.')
      return
    }

    setSaving(true)
    setActionError(null)
    try {
      const dry = await editor.saveLayout(true)
      if (dry.unseated.length > 0) {
        setPendingUnseat(dry.unseated)
        return
      }
      await commitSave()
    } catch (err) {
      console.error(err)
      setActionError('Nie udało się zapisać układu.')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (published: boolean) => {
    setPublishing(true)
    setActionError(null)
    try {
      await editor.publish(published)
    } catch (err) {
      console.error(err)
      setActionError(published ? 'Nie udało się opublikować planu.' : 'Nie udało się ukryć planu.')
    } finally {
      setPublishing(false)
    }
  }

  // --- render -----------------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8" role="alert">
        <ErrorMessage message={error} />
        <Button type="button" variant="outline" onClick={() => void editor.reload()}>
          <RefreshCw className="size-4" />
          Spróbuj ponownie
        </Button>
      </div>
    )
  }

  if (loading && draft.tables.length === 0 && guests.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Wczytywanie planu sali…
      </p>
    )
  }

  const canvas = (
    <SeatingCanvas
      room={draft.room}
      tables={draft.tables}
      landmarks={draft.landmarks}
      seatVisual={seatVisual}
      selectedId={isDesktop ? selectedId : null}
      selectedSeat={activeSeat ? seatKey(activeSeat.tableId, activeSeat.seatNumber) : null}
      inactiveTables={isDesktop ? inactiveTables : undefined}
      editable={isDesktop}
      fit={isDesktop ? 'contain' : 'width'}
      wheelZoom={isDesktop}
      showGrid={isDesktop}
      focus={focus}
      ariaLabel={`Plan sali: ${countPl(draft.tables.length, 'stół', 'stoły', 'stołów')}, ${seatedTotal} z ${capacityTotal} miejsc zajętych`}
      className={isDesktop ? 'min-h-0 flex-1' : undefined}
      onSelect={handleSelect}
      onTableChange={updateTable}
      onLandmarkChange={updateLandmark}
      onSeatClick={isDesktop ? handleSeatClick : undefined}
      onGuestDrop={(guestId, tableId, seatNumber) => void runAssign(guestId, tableId, seatNumber)}
    />
  )

  return (
    <InviterOptionsContext value={inviterOptions}>
      <section aria-labelledby="seating-title" className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 id="seating-title" className="font-serif text-3xl leading-tight text-foreground">
            Plan sali
          </h1>
          <p className="text-sm text-muted-foreground">
            {countPl(draft.tables.length, 'stół', 'stoły', 'stołów')} · {seatedTotal}/{capacityTotal} miejsc zajętych
          </p>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <Switch
              checked={isPublished}
              disabled={publishing}
              aria-busy={publishing}
              onCheckedChange={(next) => void handlePublish(next)}
              aria-label="Plan widoczny dla gości"
            />
            {isPublished ? (
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" aria-hidden="true" /> Opublikowany
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <EyeOff className="size-4" aria-hidden="true" /> Ukryty przed gośćmi
              </span>
            )}
          </label>
        </div>

        {isPublished && dirty && (
          <p className="text-xs text-muted-foreground">Goście widzą ostatnio zapisany układ.</p>
        )}

        {!isDesktop ? (
          <>
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Edycja planu jest dostępna na większym ekranie. Tutaj możesz go tylko obejrzeć.
            </p>
            {canvas}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
              <span className="px-1 text-sm text-muted-foreground">Dodaj stół:</span>
              {SHAPE_OPTIONS.map((option) => (
                <Button key={option.value} type="button" size="sm" variant="outline" onClick={() => handleAddTable(option.value)}>
                  {option.label}
                </Button>
              ))}
              <NativeSelect
                aria-label="Dodaj element tła"
                className="h-9 w-44"
                value=""
                onChange={(event) => handleAddLandmark(Number(event.target.value))}
              >
                <option value="" disabled>
                  Dodaj element tła…
                </option>
                {LANDMARK_PRESETS.map((preset, index) => (
                  <option key={preset.label} value={index}>
                    {preset.label}
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRoomDialog(true)}>
                <Maximize className="size-4" />
                Sala {draft.room.width / 100}×{draft.room.height / 100} m
              </Button>

              <div className="ml-auto flex items-center gap-2">
                <NativeSelect
                  aria-label="Koloruj krzesła według"
                  className="h-9 w-48"
                  value={colorMode}
                  onChange={(event) => setColorMode(event.target.value as ColorMode)}
                >
                  <option value="group">Kolor: grupa</option>
                  <option value="attendance">Kolor: obecność</option>
                  <option value="inviter">Kolor: od kogo</option>
                </NativeSelect>
                {dirty && <span className="text-xs text-amber-700">Niezapisane zmiany</span>}
                <Button type="button" size="sm" variant="ghost" disabled={!dirty || saving} onClick={editor.discard}>
                  <Undo2 className="size-4" />
                  Odrzuć
                </Button>
                <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Zapisz układ
                </Button>
              </div>
            </div>

            {actionError && <ErrorMessage message={actionError} />}
            <p className="text-sm text-foreground empty:hidden" aria-live="polite">
              {notice}
            </p>

            <div className="grid min-h-[560px] flex-1 grid-cols-[minmax(0,1fr)_22rem] gap-3 lg:min-h-0">
              <div className="flex min-h-0 flex-col gap-2">
                {canvas}
                <p className="text-xs text-muted-foreground">
                  {colorMode === 'attendance' ? (
                    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
                      {ATTENDANCE_OPTIONS.map((option) => (
                        <span key={option.value} className="inline-flex items-center gap-1">
                          <span className="size-2.5 rounded-full" style={{ background: ATTENDANCE_COLORS[option.value] }} aria-hidden="true" />
                          {option.label}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <>
                      Kolor krzesła = {colorMode === 'group' ? 'grupa' : 'osoba zapraszająca'}, kropka = obecność.{' '}
                    </>
                  )}{' '}
                  Przeciągaj stoły, obracaj uchwytem albo klawiszem R, strzałki przesuwają zaznaczony element. Kółko myszy
                  przybliża plan.
                </p>
              </div>

              <aside className="flex min-h-0 flex-col gap-3 rounded-xl border bg-card p-3" aria-label="Ustawienia planu">
                {selectedTable ? (
                  <div>
                    <h2 className="mb-3 font-medium text-foreground">
                      Stół: {selectedTable.name}
                      {isNewId(selectedTable.id) && <span className="ml-2 text-xs font-normal text-muted-foreground">(nowy)</span>}
                    </h2>
                    <TableSettingsForm
                      key={`${selectedTable.id}|${selectedTable.name}|${selectedTable.shape}|${selectedTable.capacity}|${JSON.stringify(selectedTable.seat_config)}`}
                      table={selectedTable}
                      otherNames={new Set(draft.tables.filter((table) => table.id !== selectedTable.id).map((table) => table.name))}
                      seatedCount={seatedCountAt(selectedTable.id)}
                      onApply={(patch) => updateTable(selectedTable.id, patch)}
                      onRotate={() => updateTable(selectedTable.id, { rotation: normalizeAngle(selectedTable.rotation + 90) })}
                      onDelete={() => {
                        editor.removeTable(selectedTable.id)
                        setSelectedId(null)
                      }}
                    />
                    {inactiveTables.has(selectedTable.id) && (
                      <p className="mt-3 text-xs text-muted-foreground">Zapisz układ, aby usadzać gości przy tym stole.</p>
                    )}
                  </div>
                ) : selectedLandmark ? (
                  <div>
                    <h2 className="mb-3 font-medium text-foreground">Element: {selectedLandmark.label}</h2>
                    <LandmarkSettingsForm
                      key={`${selectedLandmark.id}|${selectedLandmark.width}|${selectedLandmark.height}|${selectedLandmark.label}`}
                      landmark={selectedLandmark}
                      onApply={(patch) => updateLandmark(selectedLandmark.id, patch)}
                      onRotate={() => updateLandmark(selectedLandmark.id, { rotation: normalizeAngle(selectedLandmark.rotation + 90) })}
                      onDelete={() => {
                        editor.removeLandmark(selectedLandmark.id)
                        setSelectedId(null)
                      }}
                    />
                  </div>
                ) : activeSeat ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-medium text-foreground">
                        {tableNames.get(activeSeat.tableId)} · miejsce {activeSeat.seatNumber}
                      </h2>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedSeat(null)}>
                        Zamknij
                      </Button>
                    </div>
                    {seatOccupant ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{guestDisplayName(seatOccupant)}</span>
                          <AttendanceBadge value={seatOccupant.attendance} />
                        </div>
                        {seatOccupant.group_id && (
                          <p className="text-xs text-muted-foreground">Grupa: {groupsById.get(seatOccupant.group_id)?.name}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditedGuestId(seatOccupant.id)}>
                            <UserPen className="size-4" />
                            Edytuj dane
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void runAssign(seatOccupant.id, null, null)}>
                            <UserMinus className="size-4" />
                            Zwolnij miejsce
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Wolne miejsce.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Zaznacz stół, aby zmienić jego ustawienia, albo kliknij krzesło, aby kogoś posadzić. Gości możesz też
                    przeciągać z listy na krzesła.
                  </p>
                )}

                <div className="border-t" />

                <SeatingGuestList
                  guests={guests}
                  groups={groups}
                  tableNames={tableNames}
                  colorOf={colorOf}
                  highlightedGroupId={highlightedGroupId}
                  seatSelected={activeSeat !== null}
                  canDrag
                  onGuestClick={handleGuestClick}
                  onHighlightGroup={setHighlightedGroupId}
                />
              </aside>
            </div>
          </>
        )}
      </section>

      {roomDialog && <RoomSizeDialog room={draft.room} onClose={() => setRoomDialog(false)} onApply={editor.setRoom} />}

      {editedGuest && (
        <GuestEditSheet
          key={editedGuest.id}
          guest={editedGuest}
          defaultGroupId={editedGuest.group_id}
          groups={groups}
          onCancel={() => {
            if (guestDirtyRef.current) setConfirmCloseGuest(true)
            else setEditedGuestId(null)
          }}
          onDirtyChange={(value) => {
            guestDirtyRef.current = value
          }}
          onCreateGroup={editor.createGroup}
          onSave={async (input) => {
            await editor.saveGuest(editedGuest.id, input)
            guestDirtyRef.current = false
            setEditedGuestId(null)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmCloseGuest}
        title="Porzucić zmiany?"
        description="Dane gościa mają niezapisane zmiany."
        confirmLabel="Porzuć zmiany"
        destructive
        onOpenChange={(open) => !open && setConfirmCloseGuest(false)}
        onConfirm={() => {
          guestDirtyRef.current = false
          setEditedGuestId(null)
        }}
      />

      <ConfirmDialog
        open={pendingLink !== null}
        title="Opuścić edytor?"
        description="Układ sali ma niezapisane zmiany. Po wyjściu przepadną."
        confirmLabel="Wyjdź bez zapisu"
        destructive
        onOpenChange={(open) => !open && setPendingLink(null)}
        onConfirm={() => {
          const link = pendingLink
          setPendingLink(null)
          if (!link) return
          allowLinkRef.current = true
          link.click()
          allowLinkRef.current = false
        }}
      />

      <ConfirmDialog
        open={pendingUnseat !== null}
        title="Zapisać układ?"
        description={`${countPl(pendingUnseat?.length ?? 0, 'osoba straci', 'osoby stracą', 'osób straci')} miejsce (usunięty stół albo mniej miejsc) i trafi do nieusadzonych.`}
        confirmLabel="Zapisz i przenieś"
        errorMessage="Nie udało się zapisać układu."
        onOpenChange={(open) => !open && setPendingUnseat(null)}
        onConfirm={commitSave}
      >
        <ul className="mt-3 max-h-60 list-disc overflow-y-auto pl-5 text-sm">
          {pendingUnseat?.map((item) => (
            <li key={item.guest_id}>
              {item.guest_name} <span className="text-muted-foreground">({item.table_name})</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </InviterOptionsContext>
  )
}
