import type { AppTheme } from '@/config/themes'
import type { EventRole } from './role'

// Wydarzenie znane po sprawdzeniu kodu, przed dołączeniem.
export type EventPreview = {
  id: string
  name: string
  startsAt: string | null
  // Motyw z check_event_code / join_event (brak - np. wybór z listy super
  // admina, wtedy motyw przychodzi z konfiguracji strony).
  theme?: AppTheme
}

export type EventSession = EventPreview & {
  role: EventRole
}
