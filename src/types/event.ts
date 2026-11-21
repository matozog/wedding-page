import type { EventRole } from './role'

export type EventSession = {
  id: string
  name: string
  startsAt: string | null
  role: EventRole
}
