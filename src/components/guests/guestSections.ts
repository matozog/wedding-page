import type { Guest, GuestGroup } from '@/types/guest'

// Fragment listy wyświetlany razem: cała lista (widok płaski), jedna grupa
// albo osoby bez grupy (widok grup).
export type GuestSection =
  | { kind: 'flat'; key: 'all'; guests: Guest[] }
  | { kind: 'group'; key: string; group: GuestGroup; guests: Guest[]; totalInGroup: number }
  | { kind: 'ungrouped'; key: 'ungrouped'; guests: Guest[]; totalInGroup: number }

export const UNGROUPED_KEY = 'ungrouped'

// Nagłówek sekcji - wspólny dla tabeli i kart.
export const sectionTitle = (section: GuestSection) =>
  section.kind === 'group' ? section.group.name : section.kind === 'ungrouped' ? 'Bez grupy' : 'Goście'
