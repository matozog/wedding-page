import type { AdminEvent, AdminEventInput, AdminEventMember } from '../types/adminEvent'
import type { EventRole } from '../types/role'
import { PHOTOS_BUCKET } from './constants'
import { getErrorCode } from './eventApi'
import { supabase } from './supabase'

// Zarządzanie wszystkimi wydarzeniami - tylko super admin
// (profiles.is_platform_admin). Każde RPC sprawdza uprawnienie w bazie
// i zwraca PT403 dla pozostałych.

export const ACCESS_CODE_TAKEN_ERROR_CODE = 'PT409'

export const isAccessCodeTaken = (err: unknown) => getErrorCode(err) === ACCESS_CODE_TAKEN_ERROR_CODE

export const fetchAdminEvents = async (): Promise<AdminEvent[]> => {
  const { data, error } = await supabase.rpc('list_events_admin')

  if (error) {
    throw error
  }

  return data ?? []
}

export const createAdminEvent = async (input: AdminEventInput, accessCode: string): Promise<string> => {
  const { data, error } = await supabase.rpc('create_event', {
    p_name: input.name,
    p_access_code: accessCode,
    p_starts_at: input.startsAt ?? undefined,
  })

  if (error) {
    throw error
  }

  return data
}

export const updateAdminEvent = async (eventId: string, input: AdminEventInput) => {
  const { error } = await supabase.rpc('update_event', {
    p_event_id: eventId,
    p_name: input.name,
    // null czyści datę - typ wygenerowany z bazy nie zna nulli w argumentach
    p_starts_at: input.startsAt as string,
  })

  if (error) {
    throw error
  }
}

export const setAdminEventAccessCode = async (eventId: string, accessCode: string) => {
  const { error } = await supabase.rpc('set_event_access_code', {
    p_event_id: eventId,
    p_access_code: accessCode,
  })

  if (error) {
    throw error
  }
}

const STORAGE_PAGE_SIZE = 1000
const STORAGE_REMOVE_BATCH = 500

// Wszystkie pliki pod prefiksem (list() w Storage nie schodzi do podfolderów).
const listStorageFiles = async (prefix: string): Promise<string[]> => {
  const files: string[] = []

  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .list(prefix, { limit: STORAGE_PAGE_SIZE, offset })

    if (error) {
      throw error
    }

    for (const item of data) {
      const path = `${prefix}/${item.name}`

      // Folder nie ma id.
      if (item.id === null) {
        files.push(...(await listStorageFiles(path)))
      } else {
        files.push(path)
      }
    }

    if (data.length < STORAGE_PAGE_SIZE) {
      return files
    }
  }
}

// Najpierw pliki zdjęć (baza nie może ich usunąć sama), potem wydarzenie
// z całą zawartością (kaskada w bazie). Przerwane usuwanie można ponowić.
export const deleteAdminEvent = async (eventId: string) => {
  const files = await listStorageFiles(eventId)

  for (let index = 0; index < files.length; index += STORAGE_REMOVE_BATCH) {
    const { error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .remove(files.slice(index, index + STORAGE_REMOVE_BATCH))

    if (error) {
      throw error
    }
  }

  const { error } = await supabase.rpc('delete_event', { p_event_id: eventId })

  if (error) {
    throw error
  }
}

export const fetchAdminEventMembers = async (eventId: string): Promise<AdminEventMember[]> => {
  const { data, error } = await supabase.rpc('list_event_members_admin', { p_event_id: eventId })

  if (error) {
    throw error
  }

  return data ?? []
}

export const setAdminEventMemberRole = async (eventId: string, userId: string, role: EventRole) => {
  const { error } = await supabase.rpc('set_member_role', {
    p_event_id: eventId,
    p_user_id: userId,
    p_role: role,
  })

  if (error) {
    throw error
  }
}

// Wydarzenie wybrane przez super admina wciąż istnieje (np. po usunięciu
// w innej karcie). RLS pokazuje super adminowi wszystkie wydarzenia.
export const adminEventExists = async (eventId: string): Promise<boolean> => {
  const { data, error } = await supabase.from('events').select('id').eq('id', eventId).maybeSingle()

  if (error) {
    throw error
  }

  return data !== null
}
