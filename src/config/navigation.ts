import type { EventSectionKey } from '@/types/eventPage'

// Identyfikatory sekcji strony wydarzenia. Komponenty sekcji używają ich
// jako atrybutu id, a menu jako celu przewijania.
export const SECTION_IDS = {
  gallery: 'galeria',
  couple: 'para',
  schedule: 'plan-dnia',
  seating: 'plan-sali',
  location: 'mapa',
  contact: 'kontakt',
} as const

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS]

// Kolejność odpowiada kolejności sekcji na stronie. key - sekcja w
// konfiguracji wydarzenia (ukryte sekcje znikają też z menu).
export const SECTION_NAV_ITEMS: readonly { key: EventSectionKey; id: SectionId; label: string }[] = [
  { key: 'gallery', id: SECTION_IDS.gallery, label: 'Galeria' },
  { key: 'couple', id: SECTION_IDS.couple, label: 'Para młoda' },
  { key: 'schedule', id: SECTION_IDS.schedule, label: 'Plan dnia' },
  { key: 'seating', id: SECTION_IDS.seating, label: 'Plan sali' },
  { key: 'location', id: SECTION_IDS.location, label: 'Dojazd' },
  { key: 'contact', id: SECTION_IDS.contact, label: 'Kontakt' },
]
