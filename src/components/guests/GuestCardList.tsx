import { ChevronDown, ChevronRight, MapPin, Pencil, Phone, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { countPl } from '@/lib/plural'
import {
  AGE_GROUP_LABELS,
  guestDisplayName,
  guestInviterValue,
  type Guest,
  type GuestGroup,
} from '@/types/guest'
import { AttendanceBadge } from './AttendanceBadge'
import { AddressText, InviterBadge, type GuestListActions } from './GuestTable'
import { sectionTitle, type GuestSection } from './guestSections'
import { useInviterOptions } from './inviterOptionsContext'

type GuestCardListProps = GuestListActions & {
  sections: GuestSection[]
  groupView: boolean
  groupsById: ReadonlyMap<string, GuestGroup>
  canEdit: boolean
  collapsed: ReadonlySet<string>
  emptyMessage: string | null
}

function GuestCard({
  guest,
  groupView,
  groupsById,
  canEdit,
  onEdit,
  onDelete,
  onShowInvitees,
}: {
  guest: Guest
  groupView: boolean
  groupsById: ReadonlyMap<string, GuestGroup>
  canEdit: boolean
  onEdit: (guest: Guest) => void
  onDelete: (guest: Guest) => void
  onShowInvitees: (inviterId: string) => void
}) {
  const inviters = useInviterOptions()
  const inviterLabel = inviters.labelOf(guestInviterValue(guest))
  const name = guestDisplayName(guest)
  const group = guest.group_id ? groupsById.get(guest.group_id) : undefined
  const meta = [
    inviterLabel && `od: ${inviterLabel}`,
    guest.age_group !== 'ADULT' && AGE_GROUP_LABELS[guest.age_group],
    guest.is_plus_one && guest.first_name && 'osoba towarzysząca',
    !groupView && group?.name,
  ].filter(Boolean)

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{name}</p>
          {meta.length > 0 && <p className="text-xs text-muted-foreground">{meta.join(' · ')}</p>}
          {guest.is_inviter && (
            <div className="mt-1">
              <InviterBadge guest={guest} onShowInvitees={onShowInvitees} />
            </div>
          )}
        </div>
        <AttendanceBadge value={guest.attendance} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Adres" />
          <AddressText guest={guest} groupsById={groupsById} />
        </p>
        <p className="flex items-center gap-2">
          <Phone className="size-4 shrink-0 text-muted-foreground" aria-label="Telefon" />
          {guest.phone ? (
            <a href={`tel:${guest.phone.replace(/[^\d+]/g, '')}`} className="underline-offset-2 hover:underline">
              {guest.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
      </div>

      {canEdit && (
        <div className="mt-3 flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(guest)} aria-label={`Edytuj: ${name}`}>
            <Pencil className="size-4" />
            Edytuj
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(guest)}
            aria-label={`Usuń: ${name}`}
          >
            <Trash2 className="size-4" />
            Usuń
          </Button>
        </div>
      )}
    </li>
  )
}

export function GuestCardList({
  sections,
  groupView,
  groupsById,
  canEdit,
  collapsed,
  emptyMessage,
  ...actions
}: GuestCardListProps) {
  const renderCards = (guests: Guest[]) => (
    <ul className="flex flex-col gap-3">
      {guests.map((guest) => (
        <GuestCard
          key={guest.id}
          guest={guest}
          groupView={groupView}
          groupsById={groupsById}
          canEdit={canEdit}
          onEdit={actions.onEdit}
          onDelete={actions.onDelete}
          onShowInvitees={actions.onShowInvitees}
        />
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        if (section.kind === 'flat') {
          return <div key={section.key}>{renderCards(section.guests)}</div>
        }

        const title = sectionTitle(section)
        const group = section.kind === 'group' ? section.group : null
        const expanded = !collapsed.has(section.key)

        return (
          <section key={section.key} aria-label={title} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${title} (${countPl(section.guests.length, 'osoba', 'osoby', 'osób')})`}
                onClick={() => actions.onToggleCollapsed(section.key)}
                className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {expanded ? (
                  <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate font-serif text-lg text-foreground">{title}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {countPl(section.guests.length, 'osoba', 'osoby', 'osób')}
                </span>
              </button>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={`Dodaj osobę: ${title}`}
                    onClick={() => actions.onAddToGroup(group?.id ?? null)}
                  >
                    <UserPlus className="size-4" />
                  </Button>
                  {group && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={`Edytuj grupę: ${title}`}
                        onClick={() => actions.onEditGroup(group)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:text-destructive"
                        aria-label={`Usuń grupę: ${title}`}
                        onClick={() => actions.onDeleteGroup(group)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            {expanded && group?.address && (
              <p className="text-sm text-muted-foreground">{group.address}</p>
            )}
            {expanded &&
              (section.guests.length > 0 ? (
                renderCards(section.guests)
              ) : (
                <p className="text-sm text-muted-foreground">Brak osób w grupie.</p>
              ))}
          </section>
        )
      })}

      {emptyMessage && <p className="py-10 text-center text-muted-foreground">{emptyMessage}</p>}
    </div>
  )
}
