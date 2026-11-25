import type { Database } from './database'

// Rola użytkownika w konkretnym wydarzeniu (tabela event_members).
export type EventRole = Database['public']['Enums']['event_role']

export const canManageAllPhotos = (role: EventRole | null) =>
  role === 'ADMIN' || role === 'EDITOR'

// Uprawnienia panelu zarządzania sprawdzane tylko w UI - każda operacja
// panelu jest autoryzowana w bazie (RLS / has_event_role).

// Pełne zarządzanie wydarzeniem (wydatki, usuwanie gości i grup).
export const canManageEvent = (role: EventRole | null) => role === 'ADMIN'

// Dodawanie i edycja gości oraz plan sali: ADMIN i EDITOR.
export const canEditGuests = (role: EventRole | null) => role === 'ADMIN' || role === 'EDITOR'

// Wejście do panelu: ADMIN, a EDITOR w trybie podglądu.
export const canViewManagement = (role: EventRole | null) => role === 'ADMIN' || role === 'EDITOR'
