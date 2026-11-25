import { Check, X } from 'lucide-react'
import { useId, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import type { Guest, GuestGroup } from '@/types/guest'
import {
  AddressField,
  AgeGroupField,
  AttendanceField,
  EmailField,
  FirstNameField,
  GroupField,
  LastNameField,
  PhoneField,
  PlusOneField,
  InviterField,
  InviterFlagField,
} from './guestFormFields'
import { useGuestForm, useGuestSubmit, type GuestSaveHandlers } from './guestFormModel'
import { useInviterOptions } from './inviterOptionsContext'

type GuestEditRowProps = GuestSaveHandlers & {
  guest: Guest | null
  defaultGroupId: string | null
  groups: readonly GuestGroup[]
  // Widok płaski: grupa ma własną kolumnę. Widok grup: wybór grupy w
  // drugim wierszu.
  showGroupColumn: boolean
  columnCount: number
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

// Wiersz edycji (także dodawania). <form> nie może otaczać wierszy tabeli,
// więc stoi pusty w kolumnie akcji (przycisk zapisu wskazuje go atrybutem
// form), a Enter w polu tekstowym obsługujemy sami. Esc anuluje.
export function GuestEditRow({
  guest,
  defaultGroupId,
  groups,
  showGroupColumn,
  columnCount,
  onCancel,
  onDirtyChange,
  onCreateGroup,
  onSave,
}: GuestEditRowProps) {
  const idPrefix = useId()
  const inviters = useInviterOptions()
  const guestId = guest?.id ?? null
  const formId = `${idPrefix}-form`
  const form = useGuestForm({ guest, defaultGroupId, groups, onDirtyChange })
  const { isSubmitting, errors } = form.formState
  const groupId = form.watch('group_id')
  const groupAddress = groups.find((group) => group.id === groupId)?.address ?? null
  const fieldProps = { form, idPrefix, layout: 'row' as const }
  const label = guest ? 'Edycja gościa' : 'Nowy gość'

  const submit = useGuestSubmit(form, { onCreateGroup, onSave })

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }

    const target = event.target as HTMLElement
    if (
      event.key === 'Enter' &&
      target instanceof HTMLInputElement &&
      target.type !== 'checkbox' &&
      !isSubmitting
    ) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <>
      <TableRow
        className="border-b-0 bg-secondary/60 [&_input]:bg-background [&_select]:bg-background"
        aria-label={label}
        onKeyDown={handleKeyDown}
      >
        <TableCell className="align-top">
          <FirstNameField {...fieldProps} />
        </TableCell>
        <TableCell className="align-top">
          <LastNameField {...fieldProps} />
        </TableCell>
        <TableCell className="min-w-56 align-top">
          <AddressField {...fieldProps} groupAddress={groupAddress} />
        </TableCell>
        <TableCell className="min-w-36 align-top">
          <PhoneField {...fieldProps} />
        </TableCell>
        {inviters.enabled && (
          <TableCell className="min-w-36 align-top">
            <InviterField {...fieldProps} guestId={guestId} />
          </TableCell>
        )}
        <TableCell className="min-w-40 align-top">
          <AttendanceField {...fieldProps} />
        </TableCell>
        {showGroupColumn && (
          <TableCell className="min-w-48 align-top">
            <GroupField {...fieldProps} groups={groups} />
          </TableCell>
        )}
        <TableCell className="align-top">
          <form
            id={formId}
            noValidate
            onSubmit={(event) => void submit(event)}
          />
          <div className="flex justify-end gap-1">
            <Button
              type="submit"
              form={formId}
              size="icon"
              className="size-9"
              disabled={isSubmitting}
              aria-label="Zapisz gościa"
              title="Zapisz (Enter)"
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              disabled={isSubmitting}
              onClick={onCancel}
              aria-label="Anuluj edycję"
              title="Anuluj (Esc)"
            >
              <X className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      <TableRow
        className="bg-secondary/60 [&_input]:bg-background [&_select]:bg-background"
        onKeyDown={handleKeyDown}
      >
        <TableCell colSpan={columnCount} className="pt-0">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <AgeGroupField {...fieldProps} />
            <EmailField {...fieldProps} />
            <PlusOneField {...fieldProps} />
            <InviterFlagField {...fieldProps} guestId={guestId} />
            {!showGroupColumn && <GroupField {...fieldProps} groups={groups} showLabel />}
            {errors.root?.message && (
              <p role="alert" className="ml-auto self-center text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </div>
        </TableCell>
      </TableRow>
    </>
  )
}
