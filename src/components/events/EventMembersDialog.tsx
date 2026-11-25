import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { NativeSelect } from '@/components/ui/native-select'
import { getErrorCode, getErrorMessage } from '@/lib/eventApi'
import { fetchAdminEventMembers, setAdminEventMemberRole } from '@/lib/eventsAdminApi'
import { EVENT_ROLE_LABELS, type AdminEvent, type AdminEventMember } from '@/types/adminEvent'
import type { EventRole } from '@/types/role'

const ROLE_ORDER: readonly EventRole[] = ['ADMIN', 'EDITOR', 'GUEST']

type EventMembersDialogProps = {
  event: AdminEvent
  onClose: () => void
}

// Członkowie wydarzenia i ich role. Organizator (np. para młoda) dołącza
// kodem jak gość, a super admin nadaje mu tu rolę Administrator.
export function EventMembersDialog({ event, onClose }: EventMembersDialogProps) {
  const id = useId()
  const [members, setMembers] = useState<AdminEventMember[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)

    try {
      setMembers(await fetchAdminEventMembers(event.id))
    } catch (err) {
      console.error(err)
      setLoadError('Nie udało się wczytać członków wydarzenia.')
    }
  }, [event.id])

  useEffect(() => {
    void load()
  }, [load])

  const changeRole = async (member: AdminEventMember, role: EventRole) => {
    if (savingUserId || role === member.role) return
    setSavingUserId(member.user_id)
    setSaveError(null)

    try {
      await setAdminEventMemberRole(event.id, member.user_id, role)
      await load()
    } catch (err) {
      console.error(err)
      // PT409 - ostatni administrator; komunikat z bazy jest po polsku.
      setSaveError(
        getErrorCode(err) === 'PT409'
          ? (getErrorMessage(err) ?? 'Wydarzenie musi mieć co najmniej jednego administratora.')
          : 'Nie udało się zmienić roli.'
      )
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !savingUserId && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Członkowie: {event.name}</DialogTitle>
          <DialogDescription>
            Organizator dołącza kodem dostępu jak gość. Potem nadaj mu tu rolę Administrator - zyska dostęp do
            panelu zarządzania.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60svh] overflow-y-auto">
          {loadError ? (
            <div role="alert" className="flex flex-col gap-3">
              <ErrorMessage message={loadError} />
              <Button type="button" variant="outline" onClick={() => void load()}>
                Spróbuj ponownie
              </Button>
            </div>
          ) : members === null ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Wczytywanie…
            </p>
          ) : members.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nikt jeszcze nie dołączył. Przekaż organizatorom kod dostępu.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {members.map((member) => {
                const selectId = `${id}-${member.user_id}`
                const name = member.display_name || 'Bez nazwy'

                return (
                  <li key={member.user_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={selectId} className="block truncate font-medium text-foreground">
                        {name}
                      </label>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.is_anonymous ? 'Konto anonimowe' : member.email || 'Konto Google'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:w-52">
                      <div className="flex-1">
                        <NativeSelect
                          id={selectId}
                          value={member.role}
                          disabled={savingUserId !== null}
                          onChange={(e) => void changeRole(member, e.target.value as EventRole)}
                        >
                          {ROLE_ORDER.map((role) => (
                            <option key={role} value={role}>
                              {EVENT_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      {savingUserId === member.user_id && (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Zapisywanie" />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {saveError && (
          <div className="mt-4" role="alert">
            <ErrorMessage message={saveError} />
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" disabled={savingUserId !== null} onClick={onClose}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
