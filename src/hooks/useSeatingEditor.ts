import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchGuestList, insertGuestGroup, updateGuest } from '../lib/guestsApi'
import {
  assignSeat,
  fetchSeatedGuests,
  fetchSeatingPlan,
  saveSeatingLayout,
  setSeatingPublished,
  type SaveLayoutResult,
} from '../lib/seatingApi'
import type { GuestGroup, GuestGroupInput, GuestInput } from '../types/guest'
import type {
  SeatedGuest,
  SeatingLandmark,
  SeatingRoom,
  SeatingShape,
  SeatingTable,
} from '../types/seating'

// Edytor planu sali. Układ (sala, stoły, elementy tła) to szkic zapisywany
// przyciskiem "Zapisz układ" w jednej transakcji. Przypisania gości
// zapisują się od razu (assign_seat) - tylko przy zapisanych stołach.

export type SeatingDraft = {
  room: SeatingRoom
  tables: SeatingTable[]
  landmarks: SeatingLandmark[]
}

const DEFAULT_ROOM: SeatingRoom = { width: 2000, height: 1200 }
const EMPTY_DRAFT: SeatingDraft = { room: DEFAULT_ROOM, tables: [], landmarks: [] }

const NEW_PREFIX = 'new-'
export const isNewId = (id: string) => id.startsWith(NEW_PREFIX)

const DEFAULT_CAPACITY: Record<SeatingShape, number> = { RECT: 8, L: 10, U: 16 }

// Geometria zależy od tych pól - po ich zmianie numery miejsc w bazie
// mogą nie pasować do szkicu, więc usadzanie czeka na zapis.
const geometryKey = (table: SeatingTable) =>
  `${table.shape}|${table.capacity}|${JSON.stringify(table.seat_config)}`

const nextTableName = (tables: readonly SeatingTable[]) => {
  const used = new Set(tables.map((table) => table.name))
  let number = tables.length + 1
  for (let candidate = 1; candidate <= tables.length + 1; candidate += 1) {
    if (!used.has(`Stół ${candidate}`)) {
      number = candidate
      break
    }
  }
  return `Stół ${number}`
}

let newIdCounter = 0
const newId = () => `${NEW_PREFIX}${Date.now().toString(36)}-${(newIdCounter += 1)}`

export function useSeatingEditor(eventId: string) {
  const [saved, setSaved] = useState<SeatingDraft>(EMPTY_DRAFT)
  const [draft, setDraft] = useState<SeatingDraft>(EMPTY_DRAFT)
  const [isPublished, setIsPublished] = useState(false)
  const [guests, setGuests] = useState<SeatedGuest[]>([])
  const [groups, setGroups] = useState<GuestGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadIdRef = useRef(0)

  // failMessage - inny komunikat np. po udanym zapisie układu, żeby nie
  // sugerować, że zmiany przepadły.
  const load = useCallback(async (failMessage = 'Nie udało się wczytać planu sali.') => {
    const loadId = ++loadIdRef.current
    setLoading(true)
    setError(null)

    try {
      const [plan, seated, list] = await Promise.all([
        fetchSeatingPlan(eventId),
        fetchSeatedGuests(eventId),
        fetchGuestList(eventId),
      ])
      if (loadId !== loadIdRef.current) return
      const next: SeatingDraft = plan
        ? { room: plan.room, tables: plan.tables, landmarks: plan.landmarks }
        : EMPTY_DRAFT
      setSaved(next)
      setDraft(next)
      setIsPublished(plan?.is_published ?? false)
      setGuests(seated)
      setGroups(list.groups)
    } catch (err) {
      if (loadId !== loadIdRef.current) return
      console.error('Seating plan error:', err)
      setError(failMessage)
    } finally {
      if (loadId === loadIdRef.current) setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const reloadGuests = useCallback(async () => {
    try {
      setGuests(await fetchSeatedGuests(eventId))
    } catch (err) {
      console.error('Seated guests error:', err)
    }
  }, [eventId])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  // Stoły bez możliwości usadzania: nowe albo ze zmienioną geometrią.
  const inactiveTables = useMemo(() => {
    const savedById = new Map(saved.tables.map((table) => [table.id, geometryKey(table)]))
    return new Set(
      draft.tables
        .filter((table) => savedById.get(table.id) !== geometryKey(table))
        .map((table) => table.id)
    )
  }, [draft.tables, saved.tables])

  // --- szkic układu -----------------------------------------------------------
  const addTable = useCallback((shape: SeatingShape, at?: { x: number; y: number }) => {
    const id = newId()
    setDraft((current) => ({
      ...current,
      tables: [
        ...current.tables,
        {
          id,
          name: nextTableName(current.tables),
          shape,
          capacity: DEFAULT_CAPACITY[shape],
          x: Math.round(at?.x ?? current.room.width / 2),
          y: Math.round(at?.y ?? current.room.height / 2),
          rotation: 0,
          seat_config: { sides: 'both' },
        },
      ],
    }))
    return id
  }, [])

  const updateTable = useCallback((id: string, patch: Partial<Omit<SeatingTable, 'id'>>) => {
    setDraft((current) => ({
      ...current,
      tables: current.tables.map((table) => (table.id === id ? { ...table, ...patch } : table)),
    }))
  }, [])

  const removeTable = useCallback((id: string) => {
    setDraft((current) => ({ ...current, tables: current.tables.filter((table) => table.id !== id) }))
  }, [])

  const addLandmark = useCallback((label: string, width: number, height: number) => {
    const id = newId()
    setDraft((current) => ({
      ...current,
      landmarks: [
        ...current.landmarks,
        {
          id,
          label,
          width,
          height,
          x: Math.round(current.room.width / 2),
          y: Math.round(current.room.height / 2),
          rotation: 0,
        },
      ],
    }))
    return id
  }, [])

  const updateLandmark = useCallback((id: string, patch: Partial<Omit<SeatingLandmark, 'id'>>) => {
    setDraft((current) => ({
      ...current,
      landmarks: current.landmarks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }, [])

  const removeLandmark = useCallback((id: string) => {
    setDraft((current) => ({ ...current, landmarks: current.landmarks.filter((item) => item.id !== id) }))
  }, [])

  // Mniejsza sala - stoły i elementy spoza niej wracają na krawędź (edytor
  // pokazuje tylko salę, więc inaczej nie dałoby się ich złapać).
  const setRoom = useCallback((room: SeatingRoom) => {
    const clampX = (x: number) => Math.min(Math.max(x, 0), room.width)
    const clampY = (y: number) => Math.min(Math.max(y, 0), room.height)
    setDraft((current) => ({
      room,
      tables: current.tables.map((table) => ({ ...table, x: clampX(table.x), y: clampY(table.y) })),
      landmarks: current.landmarks.map((item) => ({ ...item, x: clampX(item.x), y: clampY(item.y) })),
    }))
  }, [])

  const discard = useCallback(() => setDraft(saved), [saved])

  // dryRun - lista osób, które stracą miejsce, bez zmian w bazie.
  // Po zapisie: id nowych stołów (stare id szkicu -> id z bazy).
  const saveLayout = useCallback(
    async (dryRun: boolean): Promise<SaveLayoutResult & { idMap: Map<string, string> }> => {
      const result = await saveSeatingLayout(
        eventId,
        {
          room: draft.room,
          tables: draft.tables.map(({ id, ...table }) => ({ ...table, id: isNewId(id) ? null : id })),
          landmarks: draft.landmarks.map(({ label, x, y, width, height, rotation }) => ({
            label,
            x,
            y,
            width,
            height,
            rotation,
          })),
        },
        dryRun
      )

      const idMap = new Map<string, string>()
      if (!dryRun) {
        draft.tables.forEach((table, index) => {
          const id = result.table_ids[index]
          if (id) idMap.set(table.id, id)
        })
        await load('Układ został zapisany, ale nie udało się odświeżyć planu sali.')
      }

      return { ...result, idMap }
    },
    [draft, eventId, load]
  )

  const publish = useCallback(
    async (published: boolean) => {
      await setSeatingPublished(eventId, published)
      setIsPublished(published)
    },
    [eventId]
  )

  // --- goście -----------------------------------------------------------------
  // Lokalnie to samo co assign_seat: zajęte miejsce = zamiana.
  const assign = useCallback(
    async (guestId: string, tableId: string | null, seatNumber: number | null) => {
      setGuests((current) => {
        const guest = current.find((item) => item.id === guestId)
        if (!guest) return current
        const occupant =
          tableId === null
            ? null
            : current.find(
                (item) => item.id !== guestId && item.table_id === tableId && item.seat_number === seatNumber
              )
        return current.map((item) => {
          if (item.id === guestId) return { ...item, table_id: tableId, seat_number: tableId ? seatNumber : null }
          if (occupant && item.id === occupant.id) {
            return { ...item, table_id: guest.table_id, seat_number: guest.table_id ? guest.seat_number : null }
          }
          return item
        })
      })

      try {
        await assignSeat(guestId, tableId, seatNumber)
      } catch (err) {
        await reloadGuests()
        throw err
      }
    },
    [reloadGuests]
  )

  const saveGuest = useCallback(async (id: string, input: GuestInput) => {
    const updated = await updateGuest(id, input)
    setGuests((current) => current.map((item) => (item.id === id ? { ...item, ...updated } : item)))
  }, [])

  const createGroup = useCallback(
    async (input: GuestGroupInput) => {
      const group = await insertGuestGroup(eventId, input)
      setGroups((current) => [...current, group])
      return group
    },
    [eventId]
  )

  return {
    draft,
    saved,
    dirty,
    isPublished,
    guests,
    groups,
    loading,
    error,
    inactiveTables,
    reload: load,
    addTable,
    updateTable,
    removeTable,
    addLandmark,
    updateLandmark,
    removeLandmark,
    setRoom,
    discard,
    saveLayout,
    publish,
    assign,
    saveGuest,
    createGroup,
  }
}
