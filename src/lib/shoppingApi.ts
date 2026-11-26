import type { SectionTexts } from '../types/eventPage'
import type { ShoppingItem, ShoppingItemInput, ShoppingSettings } from '../types/shopping'
import { DEFAULT_SHOPPING_SETTINGS } from '../types/shopping'
import { getErrorCode, getErrorMessage } from './eventApi'
import { supabase } from './supabase'

// Lista zakupów. Odczyt - członkowie wydarzenia. Dodawanie, edycja i
// usuwanie - bezpośrednio na tabeli (RLS: autor przy otwartej liście,
// ADMIN / EDITOR zawsze). Przypisanie - RPC (osoba zmienia tylko siebie).
// Zapis bez uprawnień nie zwraca błędu, tylko 0 wierszy.

const ITEM_FIELDS =
  'id, name, note, quantity, unit, created_at, updated_at, created_by, assigned_to, ' +
  'author:profiles!event_shopping_items_created_by_fkey(display_name), ' +
  'assignee:profiles!event_shopping_items_assigned_to_fkey(display_name)'

type ItemRow = {
  id: string
  name: string
  note: string | null
  quantity: number | null
  unit: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  assigned_to: string | null
  author: { display_name: string | null } | null
  assignee: { display_name: string | null } | null
}

// Kod błędu: wpis zmienił się w międzyczasie (albo brak uprawnień).
export const STALE_ITEM_CODE = 'STALE_ITEM'

const staleError = () =>
  Object.assign(new Error('Pozycja zmieniła się w międzyczasie albo nie masz już do niej dostępu.'), {
    code: STALE_ITEM_CODE,
  })

const toItem = (row: ItemRow): ShoppingItem => ({
  id: row.id,
  name: row.name,
  note: row.note,
  quantity: row.quantity,
  unit: row.unit,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: row.created_by ? { id: row.created_by, displayName: row.author?.display_name ?? null } : null,
  assignee: row.assigned_to ? { id: row.assigned_to, displayName: row.assignee?.display_name ?? null } : null,
})

// Komunikat dla użytkownika - z bazy dla znanych błędów (walidacja, limity,
// zajęta pozycja), inaczej ogólny.
export const describeShoppingError = (err: unknown, fallback: string) => {
  const code = getErrorCode(err)

  if (code === STALE_ITEM_CODE || code === 'PT400' || code === 'PT403' || code === 'PT404' || code === 'PT409') {
    return getErrorMessage(err) ?? fallback
  }

  return fallback
}

const toSettings = (row: {
  show_note: boolean
  show_quantity: boolean
  show_author: boolean
  allow_assign: boolean
} | null): ShoppingSettings =>
  row
    ? {
        showNote: row.show_note,
        showQuantity: row.show_quantity,
        showAuthor: row.show_author,
        allowAssign: row.allow_assign,
      }
    : DEFAULT_SHOPPING_SETTINGS

export const fetchShoppingSettings = async (eventId: string): Promise<ShoppingSettings> => {
  const { data, error } = await supabase
    .from('event_shopping_settings')
    .select('show_note, show_quantity, show_author, allow_assign')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return toSettings(data)
}

export const fetchShoppingItems = async (eventId: string): Promise<ShoppingItem[]> => {
  const { data, error } = await supabase
    .from('event_shopping_items')
    .select(ITEM_FIELDS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .overrideTypes<ItemRow[], { merge: false }>()

  if (error) {
    throw error
  }

  return data.map(toItem)
}

const toRow = (input: ShoppingItemInput) => ({
  name: input.name,
  ...(input.note !== undefined && { note: input.note }),
  ...(input.quantity !== undefined && { quantity: input.quantity }),
  ...(input.unit !== undefined && { unit: input.unit }),
})

// assignTo - id zalogowanej osoby ("Przypisz do mnie") albo null.
export const addShoppingItem = async (
  eventId: string,
  input: ShoppingItemInput,
  assignTo: string | null
): Promise<ShoppingItem> => {
  const { data, error } = await supabase
    .from('event_shopping_items')
    .insert({ event_id: eventId, ...toRow(input), assigned_to: assignTo })
    .select(ITEM_FIELDS)
    .overrideTypes<ItemRow[], { merge: false }>()

  if (error) {
    throw error
  }

  const row = data[0]

  if (!row) {
    throw staleError()
  }

  return toItem(row)
}

// expectedUpdatedAt - wersja, którą edytował użytkownik. Gdy ktoś zmienił
// wpis w międzyczasie, zapis nie przejdzie (STALE_ITEM_CODE).
export const updateShoppingItem = async (
  itemId: string,
  input: ShoppingItemInput,
  expectedUpdatedAt: string
): Promise<ShoppingItem> => {
  const { data, error } = await supabase
    .from('event_shopping_items')
    .update(toRow(input))
    .eq('id', itemId)
    .eq('updated_at', expectedUpdatedAt)
    .select(ITEM_FIELDS)
    .overrideTypes<ItemRow[], { merge: false }>()

  if (error) {
    throw error
  }

  const row = data[0]

  if (!row) {
    throw staleError()
  }

  return toItem(row)
}

export const deleteShoppingItem = async (itemId: string) => {
  const { data, error } = await supabase.from('event_shopping_items').delete().eq('id', itemId).select('id')

  if (error) {
    throw error
  }

  if (data.length === 0) {
    throw staleError()
  }
}

export const assignShoppingItem = async (itemId: string) => {
  const { error } = await supabase.rpc('assign_shopping_item', { p_item_id: itemId })

  if (error) {
    throw error
  }
}

export const unassignShoppingItem = async (itemId: string) => {
  const { error } = await supabase.rpc('unassign_shopping_item', { p_item_id: itemId })

  if (error) {
    throw error
  }
}

// Super admin - teksty sekcji i pola listy w jednej transakcji.
export const saveShoppingSection = async (eventId: string, texts: SectionTexts, settings: ShoppingSettings) => {
  const { error } = await supabase.rpc('save_shopping_section', {
    p_event_id: eventId,
    p_content: texts,
    p_settings: {
      show_note: settings.showNote,
      show_quantity: settings.showQuantity,
      show_author: settings.showAuthor,
      allow_assign: settings.allowAssign,
    },
  })

  if (error) {
    throw error
  }
}

export type ShoppingSummary = {
  count: number
  // pozycje bez osoby
  free: number
  // sekcja włączona na stronie wydarzenia
  sectionVisible: boolean
}

// Kafelek w panelu zarządzania i baner "sekcja ukryta".
export const fetchShoppingSummary = async (eventId: string): Promise<ShoppingSummary> => {
  const [items, section] = await Promise.all([
    supabase.from('event_shopping_items').select('assigned_to').eq('event_id', eventId),
    supabase
      .from('event_sections')
      .select('is_visible')
      .eq('event_id', eventId)
      .eq('section', 'shopping')
      .maybeSingle(),
  ])

  if (items.error) {
    throw items.error
  }

  if (section.error) {
    throw section.error
  }

  return {
    count: items.data.length,
    free: items.data.filter((row) => row.assigned_to === null).length,
    sectionVisible: section.data?.is_visible ?? false,
  }
}
