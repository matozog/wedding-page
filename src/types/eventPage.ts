import type { CustomColors, ThemeKey } from '@/config/themes'
import type { Database } from './database'

export type EventSectionKey = Database['public']['Enums']['event_section']

// Nagłówek sekcji: mały napis nad tytułem, tytuł, opis.
export type SectionHeader = {
  eyebrow: string | null
  title: string | null
  description: string | null
}

// Teksty sekcji zapisywane razem (save_event_section, p_content).
export type SectionTexts = SectionHeader & {
  nav_label: string | null
  // np. nagłówek karty "O nas"
  content_title: string | null
  // np. historia w "O nas", tekst pustej galerii, podziękowanie w stopce
  content_body: string | null
}

export type SectionConfig = SectionTexts & {
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

// Krótka informacja w sekcji "O nas", np. Data: 12 czerwca.
export type AboutFact = {
  label: string
  value: string
}

// Zdjęcie sekcji (karuzela "O nas"), plik w {event_id}/page/{plik}.
export type PagePhoto = {
  id: string
  section: EventSectionKey
  storage_path: string
  alt_text: string | null
}

// Konfiguracja strony wydarzenia (get_event_page).
export type EventPage = {
  event: {
    id: string
    name: string
    starts_at: string | null
    theme: ThemeKey
    theme_colors: CustomColors | null
    // Goście (rola GUEST) mogą udostępniać link do wydarzenia.
    guest_sharing_enabled: boolean
  }
  sections: Record<EventSectionKey, SectionConfig>
  schedule: ScheduleItem[]
  locations: EventLocation[]
  contacts: EventContact[]
  facts: AboutFact[]
  photos: PagePhoto[]
}

// Sekcje w kolejności strony. navLabel - nazwa w menu, gdy nie ustawiono
// własnej; configurable - ma edytowalną treść.
export const EVENT_SECTIONS: readonly {
  key: EventSectionKey
  label: string
  navLabel: string | null
  configurable: boolean
}[] = [
  { key: 'gallery', label: 'Galeria zdjęć', navLabel: 'Galeria', configurable: true },
  { key: 'couple', label: 'O nas', navLabel: 'O nas', configurable: true },
  { key: 'schedule', label: 'Plan wydarzenia', navLabel: 'Plan', configurable: true },
  { key: 'seating', label: 'Plan sali', navLabel: 'Plan sali', configurable: true },
  { key: 'location', label: 'Jak dojechać', navLabel: 'Dojazd', configurable: true },
  { key: 'contact', label: 'Kontakt', navLabel: 'Kontakt', configurable: true },
  { key: 'footer', label: 'Stopka', navLabel: null, configurable: true },
]

// Te same limity co w bazie (20261125120000_event_page_config.sql).
export const EVENT_PAGE_LIMITS = {
  navLabel: 30,
  eyebrow: 60,
  title: 120,
  description: 1000,
  contentTitle: 120,
  contentBody: 4000,
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
  facts: 4,
  factLabel: 40,
  factValue: 120,
  photos: 10,
  photoAlt: 200,
} as const
