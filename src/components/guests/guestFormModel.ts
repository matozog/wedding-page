import { useEffect, useRef } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import {
  fromInviterValue,
  groupInviterValue,
  guestInviterValue,
  type Attendance,
  type Guest,
  type GuestAgeGroup,
  type GuestGroup,
  type GuestGroupInput,
  type GuestInput,
} from '@/types/guest'

export const NEW_GROUP_VALUE = '__new__'

export type GuestFormValues = {
  first_name: string
  last_name: string
  address: string
  phone: string
  // "Od kogo": '' | JOINT_INVITER | id osoby zapraszającej
  inviter: string
  is_inviter: boolean
  attendance: Attendance
  age_group: GuestAgeGroup
  is_plus_one: boolean
  // '' = bez grupy, NEW_GROUP_VALUE = nowa grupa o nazwie new_group_name
  group_id: string
  new_group_name: string
}

export type GuestFormLayout = 'row' | 'stacked'

export type GuestFormSubmit = {
  guest: GuestInput
  newGroup: GuestGroupInput | null
}

const toValues = (guest: Guest | null, groupId: string | null, groups: readonly GuestGroup[]): GuestFormValues => {
  const group = groupId ? groups.find((item) => item.id === groupId) : undefined

  return {
    first_name: guest?.first_name ?? '',
    last_name: guest?.last_name ?? '',
    address: guest?.address ?? '',
    phone: guest?.phone ?? '',
    inviter: guest ? guestInviterValue(guest) : group ? groupInviterValue(group) : '',
    is_inviter: guest?.is_inviter ?? false,
    attendance: guest?.attendance ?? 'UNKNOWN',
    age_group: guest?.age_group ?? 'ADULT',
    is_plus_one: guest?.is_plus_one ?? false,
    group_id: guest ? (guest.group_id ?? '') : (groupId ?? ''),
    new_group_name: '',
  }
}

const emptyToNull = (value: string) => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export const toSubmit = (values: GuestFormValues): GuestFormSubmit => {
  const isNewGroup = values.group_id === NEW_GROUP_VALUE
  const { invitedBy, jointly } = fromInviterValue(values.inviter)

  return {
    guest: {
      first_name: emptyToNull(values.first_name),
      last_name: emptyToNull(values.last_name),
      address: emptyToNull(values.address),
      phone: emptyToNull(values.phone),
      is_inviter: values.is_inviter,
      invited_by_guest_id: invitedBy,
      invited_jointly: jointly,
      attendance: values.attendance,
      age_group: values.age_group,
      is_plus_one: values.is_plus_one,
      group_id: isNewGroup || values.group_id === '' ? null : values.group_id,
    },
    newGroup: isNewGroup
      ? {
          name: values.new_group_name.trim(),
          address: null,
          default_inviter_id: invitedBy,
          default_invited_jointly: jointly,
        }
      : null,
  }
}

type UseGuestFormOptions = {
  guest: Guest | null
  // Grupa, do której dodajemy nowego gościa (widok grup).
  defaultGroupId: string | null
  groups: readonly GuestGroup[]
  onDirtyChange: (dirty: boolean) => void
}

export function useGuestForm({ guest, defaultGroupId, groups, onDirtyChange }: UseGuestFormOptions) {
  const form = useForm<GuestFormValues>({
    defaultValues: toValues(guest, defaultGroupId, groups),
    mode: 'onTouched',
  })

  const { isDirty } = form.formState

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  // Fokus na pierwszym polu po otwarciu edycji (praca z klawiatury).
  const { setFocus } = form
  useEffect(() => {
    setFocus('first_name')
  }, [setFocus])

  return form
}

export type GuestSaveHandlers = {
  onCreateGroup: (input: GuestGroupInput) => Promise<GuestGroup>
  onSave: (input: GuestInput) => Promise<void>
}

// Zapis z formularza: najpierw ewentualna nowa grupa, potem gość. Gdy
// grupa powstała, a gość nie - formularz wskazuje już tę grupę, więc
// ponowna próba nie utworzy duplikatu.
export const submitGuestForm = async (
  form: UseFormReturn<GuestFormValues>,
  values: GuestFormValues,
  { onCreateGroup, onSave }: GuestSaveHandlers
) => {
  const { guest, newGroup } = toSubmit(values)
  let groupId = guest.group_id

  try {
    if (newGroup) {
      const group = await onCreateGroup(newGroup)
      groupId = group.id
      form.setValue('group_id', group.id)
      form.setValue('new_group_name', '')
    }

    await onSave({ ...guest, group_id: groupId })
  } catch (err) {
    console.error(err)
    form.setError('root', {
      message: newGroup && groupId ? 'Grupa została utworzona, ale nie udało się zapisać gościa.' : 'Nie udało się zapisać gościa.',
    })
  }
}

// Obsługa wysłania z blokadą podwójnego zapisu (isSubmitting z RHF
// aktualizuje się dopiero po renderze, a Enter można wcisnąć dwa razy).
export function useGuestSubmit(form: UseFormReturn<GuestFormValues>, handlers: GuestSaveHandlers) {
  const busyRef = useRef(false)

  return form.handleSubmit(async (values) => {
    if (busyRef.current) return
    busyRef.current = true

    try {
      await submitGuestForm(form, values, handlers)
    } finally {
      busyRef.current = false
    }
  })
}

