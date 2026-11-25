import type { ThemeKey } from '@/config/themes'
import type { Database } from './database'

export type EventSectionKey = Database['public']['Enums']['event_section']

// Nagłówek sekcji: mały napis nad tytułem, tytuł, opis.
export type SectionHeader = {
  eyebrow: string | null
  title: string | null
  description: string | null
}

export type SectionConfig = SectionHeader & {
  section: EventSectionKey
  is_visible: boolean
}

export type ScheduleItem = {
  time_label: string | null
  title: string
  description: string | null
}

export type EventLocation = {
  label: string | null
  name: string
  address: string
  show_map: boolean
}

export type EventContact = {
  label: string | null
  name: string | null
  email: string | null
  phone: string | null
}

// Konfiguracja strony wydarzenia (get_event_page).
export type EventPage = {
  event: { id: string; name: string; starts_at: string | null; theme: ThemeKey }
  sections: Record<EventSectionKey, SectionConfig>
  schedule: ScheduleItem[]
  locations: EventLocation[]
  contacts: EventContact[]
}

// Kolejność i nazwy sekcji w panelu - tak jak na stronie wydarzenia.
export const EVENT_SECTIONS: readonly { key: EventSectionKey; label: string; configurable: boolean }[] = [
  { key: 'gallery', label: 'Galeria zdjęć', configurable: false },
  { key: 'couple', label: 'Para młoda', configurable: false },
  { key: 'schedule', label: 'Plan wydarzenia', configurable: true },
  { key: 'seating', label: 'Plan sali', configurable: false },
  { key: 'location', label: 'Jak dojechać', configurable: true },
  { key: 'contact', label: 'Kontakt', configurable: true },
]

// Te same limity co w bazie (20261125120000_event_page_config.sql).
export const EVENT_PAGE_LIMITS = {
  eyebrow: 60,
  title: 120,
  description: 1000,
  scheduleItems: 30,
  scheduleTime: 20,
  scheduleTitle: 120,
  scheduleDescription: 500,
  locations: 6,
  locationLabel: 60,
  locationName: 120,
  locationAddress: 300,
  contacts: 6,
  contactLabel: 60,
  contactName: 120,
  contactEmail: 254,
} as const
