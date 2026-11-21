import type { Database } from './database'

// Rola użytkownika w konkretnym wydarzeniu (tabela event_members).
export type EventRole = Database['public']['Enums']['event_role']

export const canManageAllPhotos = (role: EventRole | null) =>
  role === 'ADMIN' || role === 'EDITOR'
