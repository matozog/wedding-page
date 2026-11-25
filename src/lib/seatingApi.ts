import type { Json } from '../types/database'
import { GUEST_SELECT_FIELDS } from '../types/guest'
import {
  SEATED_GUEST_EXTRA_FIELDS,
  type SeatedGuest,
  type SeatingLandmark,
  type SeatingPlan,
  type SeatingRoom,
  type SeatingTable,
} from '../types/seating'
import { supabase } from './supabase'

// Plan sali. Odczyt - get_seating_plan (goście: tylko imiona i dopiero po
// publikacji, ADMIN / EDITOR zawsze). Zapis - ADMIN / EDITOR przez RPC,
// uprawnienia sprawdza baza.

type RawPlan = Omit<SeatingPlan, 'tables' | 'landmarks'> & {
  tables: (Omit<SeatingTable, 'seat_config'> & { seat_config: SeatingTable['seat_config'] | null })[]
  landmarks: SeatingLandmark[]
}

// numeric z Postgresa przychodzi w JSON jako liczba, ale dla pewności
// rzutujemy (np. po zmianie typu kolumny).
const num = (value: unknown) => Number(value) || 0

// null - plan nie jest opublikowany (dla gościa).
export const fetchSeatingPlan = async (eventId: string): Promise<SeatingPlan | null> => {
  const { data, error } = await supabase.rpc('get_seating_plan', { p_event_id: eventId })

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const raw = data as unknown as RawPlan

  return {
    is_published: raw.is_published,
    room: { width: num(raw.room.width), height: num(raw.room.height) },
    tables: raw.tables.map((table) => ({
      ...table,
      capacity: num(table.capacity),
      x: num(table.x),
      y: num(table.y),
      rotation: num(table.rotation),
      seat_config: table.seat_config ?? {},
    })),
    landmarks: raw.landmarks.map((landmark) => ({
      ...landmark,
      x: num(landmark.x),
      y: num(landmark.y),
      width: num(landmark.width),
      height: num(landmark.height),
      rotation: num(landmark.rotation),
    })),
    seats: raw.seats,
  }
}

export const fetchSeatedGuests = async (eventId: string): Promise<SeatedGuest[]> => {
  const { data, error } = await supabase
    .from('guests')
    .select(`${GUEST_SELECT_FIELDS}, ${SEATED_GUEST_EXTRA_FIELDS}`)
    .eq('event_id', eventId)

  if (error) {
    throw error
  }

  return data ?? []
}

export type LayoutTableInput = Omit<SeatingTable, 'id'> & { id: string | null }
export type LayoutLandmarkInput = Omit<SeatingLandmark, 'id'>

export type UnseatedGuest = { guest_id: string; guest_name: string; table_name: string }

export type SaveLayoutResult = {
  unseated: UnseatedGuest[]
  // id stołów w kolejności przekazanej listy
  table_ids: string[]
}

// Cały układ w jednej transakcji. dryRun - nic nie zmienia, zwraca osoby,
// które straciłyby miejsce (usunięte stoły, miejsca ponad nową liczbą).
export const saveSeatingLayout = async (
  eventId: string,
  layout: { room: SeatingRoom; tables: LayoutTableInput[]; landmarks: LayoutLandmarkInput[] },
  dryRun: boolean
): Promise<SaveLayoutResult> => {
  const { data, error } = await supabase.rpc('save_seating_layout', {
    p_event_id: eventId,
    p_room: layout.room as unknown as Json,
    p_tables: layout.tables as unknown as Json,
    p_landmarks: layout.landmarks as unknown as Json,
    p_dry_run: dryRun,
  })

  if (error) {
    throw error
  }

  return data as unknown as SaveLayoutResult
}

// Zajęte miejsce - goście zamieniają się miejscami. tableId null - zwolnienie.
export const assignSeat = async (
  guestId: string,
  tableId: string | null,
  seatNumber: number | null
): Promise<void> => {
  const { error } = await supabase.rpc('assign_seat', {
    p_guest_id: guestId,
    p_table_id: tableId ?? undefined,
    p_seat_number: seatNumber ?? undefined,
  })

  if (error) {
    throw error
  }
}

export const setSeatingPublished = async (eventId: string, published: boolean): Promise<void> => {
  const { error } = await supabase.rpc('set_seating_published', {
    p_event_id: eventId,
    p_published: published,
  })

  if (error) {
    throw error
  }
}
