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

// Kolejność odpowiada kolejności sekcji na stronie.
export const SECTION_NAV_ITEMS: readonly { id: SectionId; label: string }[] = [
  { id: SECTION_IDS.gallery, label: 'Galeria' },
  { id: SECTION_IDS.couple, label: 'Para młoda' },
  { id: SECTION_IDS.schedule, label: 'Plan dnia' },
  { id: SECTION_IDS.seating, label: 'Plan sali' },
  { id: SECTION_IDS.location, label: 'Dojazd' },
  { id: SECTION_IDS.contact, label: 'Kontakt' },
]
