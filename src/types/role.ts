import type { Database } from './database'

// Rola użytkownika w konkretnym wydarzeniu (tabela event_members).
export type EventRole = Database['public']['Enums']['event_role']

export const canManageAllPhotos = (role: EventRole | null) =>
  role === 'ADMIN' || role === 'EDITOR'

// Dostęp do panelu zarządzania wydarzeniem (tylko w UI - operacje panelu
// muszą sprawdzać uprawnienia w bazie, np. has_event_role(..., '{ADMIN}')).
export const canManageEvent = (role: EventRole | null) => role === 'ADMIN'
