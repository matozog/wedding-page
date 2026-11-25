import { DEFAULT_THEME, isThemeKey, type ThemeKey } from '../config/themes'
import type {
  EventContact,
  EventLocation,
  EventPage,
  EventSectionKey,
  ScheduleItem,
  SectionConfig,
  SectionHeader,
} from '../types/eventPage'
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

// Wspólne argumenty zapisu sekcji z listą - baza przycina teksty i zamienia
// puste na null, a całą listę podmienia w jednej transakcji.
const sectionArgs = (eventId: string, header: SectionHeader) => ({
  p_event_id: eventId,
  p_eyebrow: header.eyebrow ?? '',
  p_title: header.title ?? '',
  p_description: header.description ?? '',
})

export const saveEventSchedule = async (eventId: string, header: SectionHeader, items: ScheduleItem[]) => {
  const { error } = await supabase.rpc('save_event_schedule', { ...sectionArgs(eventId, header), p_items: items })

  if (error) {
    throw error
  }
}

export const saveEventLocations = async (eventId: string, header: SectionHeader, items: EventLocation[]) => {
  const { error } = await supabase.rpc('save_event_locations', { ...sectionArgs(eventId, header), p_items: items })

  if (error) {
    throw error
  }
}

export const saveEventContacts = async (eventId: string, header: SectionHeader, items: EventContact[]) => {
  const { error } = await supabase.rpc('save_event_contacts', { ...sectionArgs(eventId, header), p_items: items })

  if (error) {
    throw error
  }
}
