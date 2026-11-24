import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { Guest, GuestGroup } from '@/types/guest'
import {
  AddressField,
  AgeGroupField,
  AttendanceField,
  FirstNameField,
  GroupField,
  LastNameField,
  PhoneField,
  PlusOneField,
  SideField,
} from './guestFormFields'
import { useGuestForm, useGuestSubmit, type GuestSaveHandlers } from './guestFormModel'
import { useSideOptions } from './sideOptionsContext'

type GuestEditSheetProps = GuestSaveHandlers & {
  guest: Guest | null
  defaultGroupId: string | null
  groups: readonly GuestGroup[]
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

// Edycja / dodawanie gościa na wąskim ekranie (zamiast wiersza tabeli).
export function GuestEditSheet({
  guest,
  defaultGroupId,
  groups,
  onCancel,
  onDirtyChange,
  onCreateGroup,
  onSave,
}: GuestEditSheetProps) {
  const idPrefix = useId()
  const sides = useSideOptions()
  const form = useGuestForm({ guest, defaultGroupId, groups, onDirtyChange })
  const submit = useGuestSubmit(form, { onCreateGroup, onSave })
  const { isSubmitting, errors } = form.formState
  const groupId = form.watch('group_id')
  const groupAddress = groups.find((group) => group.id === groupId)?.address ?? null
  const fieldProps = { form, idPrefix, layout: 'stacked' as const }

  return (
    <Sheet open onOpenChange={(open) => !open && onCancel()}>
      <SheetContent closeLabel="Zamknij" className="w-[min(26rem,calc(100%-1.5rem))] overflow-y-auto">
        <SheetTitle>{guest ? 'Edycja gościa' : 'Nowy gość'}</SheetTitle>
        <SheetDescription className="mt-1">Pola poza imieniem są opcjonalne.</SheetDescription>

        <form noValidate onSubmit={(event) => void submit(event)} className="mt-6 flex flex-col gap-4">
          <FirstNameField {...fieldProps} />
          <LastNameField {...fieldProps} />
          <PlusOneField {...fieldProps} />
          <AttendanceField {...fieldProps} />
          {sides.enabled && <SideField {...fieldProps} />}
          <AgeGroupField {...fieldProps} />
          <GroupField {...fieldProps} groups={groups} />
          <AddressField {...fieldProps} groupAddress={groupAddress} />
          <PhoneField {...fieldProps} />

          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Zapisz
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
