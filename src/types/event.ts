import type { EventRole } from './role'

// Wydarzenie znane po sprawdzeniu kodu, przed dołączeniem.
export type EventPreview = {
  id: string
  name: string
  startsAt: string | null
}

export type EventSession = EventPreview & {
  role: EventRole
}
