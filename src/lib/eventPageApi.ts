import { DEFAULT_THEME, isThemeKey, type ThemeKey } from '../config/themes'
import type {
  AboutFact,
  EventContact,
  EventLocation,
  EventPage,
  EventSectionKey,
  PagePhoto,
  ScheduleItem,
  SectionConfig,
  SectionTexts,
} from '../types/eventPage'
import { PHOTOS_BUCKET } from './constants'
import { supabase } from './supabase'

// Konfiguracja strony wydarzenia. Odczyt - członkowie wydarzenia (RLS),
// zapis - tylko super admin (każde RPC sprawdza to w bazie).

type RawEventPage = Omit<EventPage, 'sections' | 'event'> & {
  event: Omit<EventPage['event'], 'theme'> & { theme: string }
  sections: SectionConfig[]
}

// null - wydarzenie nie istnieje albo nie jest widoczne dla użytkownika.
export const fetchEventPage = async (eventId: string): Promise<EventPage | null> => {
  const { data, error } = await supabase.rpc('get_event_page', { p_event_id: eventId })

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const raw = data as unknown as RawEventPage

  return {
    ...raw,
    event: { ...raw.event, theme: isThemeKey(raw.event.theme) ? raw.event.theme : DEFAULT_THEME },
    sections: Object.fromEntries(raw.sections.map((section) => [section.section, section])) as EventPage['sections'],
  }
}

export const setEventTheme = async (eventId: string, theme: ThemeKey) => {
  const { error } = await supabase.rpc('set_event_theme', { p_event_id: eventId, p_theme: theme })

  if (error) {
    throw error
  }
}

export const setEventSectionVisibility = async (eventId: string, section: EventSectionKey, visible: boolean) => {
  const { error } = await supabase.rpc('set_event_section_visibility', {
    p_event_id: eventId,
    p_section: section,
    p_visible: visible,
  })

  if (error) {
    throw error
  }
}

// Listy sekcji, które je mają (p_items w save_event_section).
export type SectionItems = {
  schedule: ScheduleItem[]
  location: EventLocation[]
  contact: EventContact[]
  couple: AboutFact[]
}

// Teksty sekcji i (opcjonalnie) jej lista w jednej transakcji. Baza przycina
// teksty i zamienia puste na null.
export const saveEventSection = async <K extends EventSectionKey>(
  eventId: string,
  section: K,
  texts: SectionTexts,
  items?: K extends keyof SectionItems ? SectionItems[K] : never
) => {
  const { error } = await supabase.rpc('save_event_section', {
    p_event_id: eventId,
    p_section: section,
    p_content: texts,
    p_items: items,
  })

  if (error) {
    throw error
  }
}

// -----------------------------------------------------------------------------
// Zdjęcia sekcji ("O nas"). Plik trafia do {event_id}/page/{uuid}.{ext}, potem
// jest rejestrowany w bazie. Przy błędzie rejestracji plik jest usuwany.
// -----------------------------------------------------------------------------
const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

// Zwraca zarejestrowane zdjęcie.
export const uploadEventPagePhoto = async (eventId: string, file: File, altText: string | null): Promise<PagePhoto> => {
  const extension = PHOTO_EXTENSIONS[file.type]

  if (!extension) {
    throw new Error('UNSUPPORTED_TYPE')
  }

  const path = `${eventId}/page/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    throw uploadError
  }

  const { data: id, error } = await supabase.rpc('add_event_page_photo', {
    p_event_id: eventId,
    p_section: 'couple',
    p_storage_path: path,
    p_alt_text: altText ?? undefined,
  })

  if (error) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path])
    throw error
  }

  return { id, section: 'couple', storage_path: path, alt_text: altText }
}

export const saveEventPagePhotos = async (eventId: string, items: { id: string; alt_text: string | null }[]) => {
  const { error } = await supabase.rpc('save_event_page_photos', {
    p_event_id: eventId,
    p_section: 'couple',
    p_items: items,
  })

  if (error) {
    throw error
  }
}

// Najpierw wiersz w bazie, potem plik - pozostawiony plik nie psuje strony.
export const deleteEventPagePhoto = async (photoId: string) => {
  const { data: path, error } = await supabase.rpc('delete_event_page_photo', { p_photo_id: photoId })

  if (error) {
    throw error
  }

  const { error: removeError } = await supabase.storage.from(PHOTOS_BUCKET).remove([path])

  if (removeError) {
    console.error('Page photo file removal error:', removeError)
  }
}
