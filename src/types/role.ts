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

// Udostępnianie linku do wydarzenia: ADMIN i EDITOR zawsze, gość - gdy
// organizator na to pozwala (events.guest_sharing_enabled). Baza sprawdza
// to samo w get_my_invite_token().
export const canShareEvent = (role: EventRole | null, guestSharingEnabled: boolean) =>
  role === 'ADMIN' || role === 'EDITOR' || (role === 'GUEST' && guestSharingEnabled)

// Wejście do panelu: ADMIN, a EDITOR w trybie podglądu.
export const canViewManagement = (role: EventRole | null) => role === 'ADMIN' || role === 'EDITOR'
