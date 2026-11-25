import type { Database } from './database'
import type { EventRole } from './role'

type Functions = Database['public']['Functions']

// Wydarzenie na liście super admina (list_events_admin).
export type AdminEvent = Functions['list_events_admin']['Returns'][number]

// Członek wydarzenia z e-mailem (list_event_members_admin).
export type AdminEventMember = Functions['list_event_members_admin']['Returns'][number]

export type AdminEventInput = {
  name: string
  // ISO albo null - wydarzenie bez daty
  startsAt: string | null
}

export const EVENT_ROLE_LABELS: Record<EventRole, string> = {
  ADMIN: 'Administrator',
  EDITOR: 'Edytor (podgląd)',
  GUEST: 'Gość',
}

// Te same limity co w bazie (require_event_name, require_free_access_code).
export const EVENT_LIMITS = {
  name: 120,
  accessCodeMin: 6,
  accessCodeMax: 64,
} as const
