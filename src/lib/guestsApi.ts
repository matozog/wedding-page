import {
  GUEST_GROUP_SELECT_FIELDS,
  GUEST_SELECT_FIELDS,
  type Guest,
  type GuestGroup,
  type GuestGroupInput,
  type GuestInput,
  type HostLabels,
} from '../types/guest'
import { supabase } from './supabase'

// Lista gości jest dostępna tylko dla ADMIN i EDITOR wydarzenia, zapis
// tylko dla ADMIN - pilnuje tego RLS. Zapis bez uprawnień nie zwraca błędu,
// tylko 0 wierszy, stąd sprawdzanie zwróconych rekordów.

const NO_ROWS_MESSAGE = 'Zmiana nie została zapisana (brak uprawnień lub wpis już nie istnieje).'

const requireRow = <T>(rows: T[] | null): T => {
  const row = rows?.[0]

  if (!row) {
    throw new Error(NO_ROWS_MESSAGE)
  }

  return row
}

export const fetchGuestList = async (
  eventId: string
): Promise<{ guests: Guest[]; groups: GuestGroup[]; hostLabels: HostLabels }> => {
  const [guestsResult, groupsResult, eventResult] = await Promise.all([
    supabase.from('guests').select(GUEST_SELECT_FIELDS).eq('event_id', eventId),
    supabase.from('guest_groups').select(GUEST_GROUP_SELECT_FIELDS).eq('event_id', eventId),
    supabase.from('events').select('host_a_label, host_b_label').eq('id', eventId).maybeSingle(),
  ])

  if (guestsResult.error) {
    throw guestsResult.error
  }

  if (groupsResult.error) {
    throw groupsResult.error
  }

  if (eventResult.error) {
    throw eventResult.error
  }

  return {
    guests: guestsResult.data ?? [],
    groups: groupsResult.data ?? [],
    hostLabels: {
      hostA: eventResult.data?.host_a_label ?? null,
      hostB: eventResult.data?.host_b_label ?? null,
    },
  }
}

// Podsumowanie na kafelek panelu zarządzania - tylko statusy i wiek.
export const fetchGuestSummary = async (
  eventId: string
): Promise<Pick<Guest, 'attendance' | 'age_group'>[]> => {
  const { data, error } = await supabase
    .from('guests')
    .select('attendance, age_group')
    .eq('event_id', eventId)

  if (error) {
    throw error
  }

  return data ?? []
}

export const insertGuest = async (eventId: string, input: GuestInput): Promise<Guest> => {
  const { data, error } = await supabase
    .from('guests')
    .insert({ ...input, event_id: eventId })
    .select(GUEST_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const updateGuest = async (id: string, input: GuestInput): Promise<Guest> => {
  const { data, error } = await supabase
    .from('guests')
    .update(input)
    .eq('id', id)
    .select(GUEST_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const deleteGuest = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('guests').delete().eq('id', id).select('id')

  if (error) {
    throw error
  }

  requireRow(data)
}

export const insertGuestGroup = async (
  eventId: string,
  input: GuestGroupInput
): Promise<GuestGroup> => {
  const { data, error } = await supabase
    .from('guest_groups')
    .insert({ ...input, event_id: eventId })
    .select(GUEST_GROUP_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const updateGuestGroup = async (id: string, input: GuestGroupInput): Promise<GuestGroup> => {
  const { data, error } = await supabase
    .from('guest_groups')
    .update(input)
    .eq('id', id)
    .select(GUEST_GROUP_SELECT_FIELDS)

  if (error) {
    throw error
  }

  return requireRow(data)
}

// Grupa razem z osobami (opcjonalnie) w jednej transakcji. Bez osób - goście
// zostają na liście, bez grupy (FK on delete set null).
export const deleteGuestGroup = async (id: string, deleteGuests: boolean): Promise<void> => {
  const { error } = await supabase.rpc('delete_guest_group', {
    p_group_id: id,
    p_delete_guests: deleteGuests,
  })

  if (error) {
    throw error
  }
}
