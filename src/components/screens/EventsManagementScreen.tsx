import { EventsPanel } from '@/components/events/EventsPanel'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import type { EventPreview } from '@/types/event'
import { OrganizerGate, type OrganizerAccess } from './OrganizerGate'

type EventsManagementScreenProps = {
  access: OrganizerAccess
  currentEventId: string | null
  onEnter: (event: EventPreview) => void
  onEventChanged: (eventId: string, event: EventPreview | null) => void
}

// Panel organizatora pod /events - lista wszystkich wydarzeń.
export function EventsManagementScreen({ access, currentEventId, onEnter, onEventChanged }: EventsManagementScreenProps) {
  return (
    <OrganizerGate access={access}>
      <ManagementLayout
        eventName="Panel organizatora"
        nickname={access.accountLabel}
        canView
        error={access.error}
        breadcrumbs={[{ label: 'Wydarzenia' }]}
        showEventLink={currentEventId !== null}
        onLogout={access.onLogout}
      >
        <EventsPanel currentEventId={currentEventId} onEnter={onEnter} onEventChanged={onEventChanged} />
      </ManagementLayout>
    </OrganizerGate>
  )
}
