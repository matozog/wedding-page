import type { Database } from './database'

type Enums = Database['public']['Enums']
type GuestRow = Database['public']['Tables']['guests']['Row']
type GuestGroupRow = Database['public']['Tables']['guest_groups']['Row']

export type Attendance = Enums['attendance_likelihood']
export type GuestAgeGroup = Enums['guest_age_group']

export type Guest = Pick<
  GuestRow,
  | 'id'
  | 'group_id'
  | 'first_name'
  | 'last_name'
  | 'address'
  | 'phone'
  | 'email'
  | 'attendance'
  | 'age_group'
  | 'is_plus_one'
  | 'is_inviter'
  | 'invited_by_guest_id'
  | 'invited_jointly'
  | 'created_at'
>

export type GuestGroup = Pick<
  GuestGroupRow,
  'id' | 'name' | 'address' | 'default_inviter_id' | 'default_invited_jointly' | 'created_at'
>

// Pola edytowane w panelu (event_id dokłada warstwa API).
export type GuestInput = Omit<Guest, 'id' | 'created_at'>
export type GuestGroupInput = Omit<GuestGroup, 'id' | 'created_at'>

export const GUEST_SELECT_FIELDS =
  'id, group_id, first_name, last_name, address, phone, email, attendance, age_group, is_plus_one, is_inviter, invited_by_guest_id, invited_jointly, created_at' as const
export const GUEST_GROUP_SELECT_FIELDS =
  'id, name, address, default_inviter_id, default_invited_jointly, created_at' as const

// Kolejność = kolejność kafelków licznika i sortowania po obecności.
export const ATTENDANCE_OPTIONS: readonly { value: Attendance; label: string }[] = [
  { value: 'CONFIRMED', label: 'Pewna obecność' },
  { value: 'LIKELY', label: 'Całkiem możliwe' },
  { value: 'UNLIKELY', label: 'Raczej nie' },
  { value: 'DECLINED', label: 'Na pewno nie' },
  { value: 'UNKNOWN', label: 'Nieustalone' },
]

export const ATTENDANCE_LABELS = Object.fromEntries(
  ATTENDANCE_OPTIONS.map(({ value, label }) => [value, label])
) as Record<Attendance, string>

export const ATTENDANCE_ORDER = Object.fromEntries(
  ATTENDANCE_OPTIONS.map(({ value }, index) => [value, index])
) as Record<Attendance, number>

export const AGE_GROUP_OPTIONS: readonly { value: GuestAgeGroup; label: string }[] = [
  { value: 'ADULT', label: 'Dorosły' },
  { value: 'CHILD', label: 'Dziecko' },
  { value: 'INFANT', label: 'Niemowlę' },
]

export const AGE_GROUP_LABELS = Object.fromEntries(
  AGE_GROUP_OPTIONS.map(({ value, label }) => [value, label])
) as Record<GuestAgeGroup, string>

// Limity z migracji 20261124100000_guest_management.sql (e-mail:
// 20261125143000_guest_email.sql - format jak event_contacts, małe litery).
export const GUEST_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const GUEST_LIMITS = {
  name: 80,
  phone: 40,
  email: 254,
  address: 300,
  groupName: 120,
} as const

export const guestDisplayName = (guest: Pick<Guest, 'first_name' | 'last_name' | 'is_plus_one'>) =>
  [guest.first_name, guest.last_name].filter(Boolean).join(' ').trim() ||
  (guest.is_plus_one ? 'Osoba towarzysząca' : 'Bez imienia')

// -----------------------------------------------------------------------------
// "Od kogo" - osoba zapraszająca z listy (guests.is_inviter) albo "Wspólny"
// (zaproszony przez wszystkich). W formularzach i filtrach jedna wartość:
// '' (brak) | JOINT_INVITER | id osoby zapraszającej.
// -----------------------------------------------------------------------------
export const JOINT_INVITER = 'JOINT'
// Tylko filtr: osoby bez przypisania.
export const NO_INVITER = 'NONE'

export const inviterValueOf = (invitedBy: string | null, jointly: boolean) =>
  jointly ? JOINT_INVITER : (invitedBy ?? '')

export const guestInviterValue = (guest: Pick<Guest, 'invited_by_guest_id' | 'invited_jointly'>) =>
  inviterValueOf(guest.invited_by_guest_id, guest.invited_jointly)

export const groupInviterValue = (
  group: Pick<GuestGroup, 'default_inviter_id' | 'default_invited_jointly'>
) => inviterValueOf(group.default_inviter_id, group.default_invited_jointly)

export const fromInviterValue = (value: string) => ({
  invitedBy: value && value !== JOINT_INVITER ? value : null,
  jointly: value === JOINT_INVITER,
})

export type InviterOption = { value: string; label: string; count: number }

export type InviterOptions = {
  // Kolumna, filtr i licznik "Od kogo" mają sens dopiero, gdy ktoś jest
  // oznaczony jako zapraszający (albo ktoś jest "wspólny").
  enabled: boolean
  // Osoby zapraszające (alfabetycznie), na końcu "Wspólny".
  options: readonly InviterOption[]
  unassignedCount: number
  labelOf: (value: string) => string | null
  countOf: (value: string) => number
}

const inviterCollator = new Intl.Collator('pl', { sensitivity: 'base' })

export const buildInviterOptions = (guests: readonly Guest[]): InviterOptions => {
  const counts = new Map<string, number>()
  let unassignedCount = 0

  for (const guest of guests) {
    const value = guestInviterValue(guest)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
    else unassignedCount += 1
  }

  const inviters = guests
    .filter((guest) => guest.is_inviter)
    .map((guest) => ({ value: guest.id, label: guestDisplayName(guest), count: counts.get(guest.id) ?? 0 }))
    .sort((a, b) => inviterCollator.compare(a.label, b.label))

  const options = [
    ...inviters,
    { value: JOINT_INVITER, label: 'Wspólny', count: counts.get(JOINT_INVITER) ?? 0 },
  ]
  const labels = new Map(options.map(({ value, label }) => [value, label]))

  return {
    enabled: inviters.length > 0 || counts.has(JOINT_INVITER),
    options,
    unassignedCount,
    labelOf: (value) => (value ? (labels.get(value) ?? null) : null),
    countOf: (value) => counts.get(value) ?? 0,
  }
}
