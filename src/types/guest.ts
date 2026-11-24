import { weddingContent } from '@/config/weddingContent'
import type { Database } from './database'

type Enums = Database['public']['Enums']
type GuestRow = Database['public']['Tables']['guests']['Row']
type GuestGroupRow = Database['public']['Tables']['guest_groups']['Row']

export type Attendance = Enums['attendance_likelihood']
export type GuestSide = Enums['guest_side']
export type GuestAgeGroup = Enums['guest_age_group']

export type Guest = Pick<
  GuestRow,
  | 'id'
  | 'group_id'
  | 'first_name'
  | 'last_name'
  | 'address'
  | 'phone'
  | 'side'
  | 'attendance'
  | 'age_group'
  | 'is_plus_one'
  | 'created_at'
>

export type GuestGroup = Pick<GuestGroupRow, 'id' | 'name' | 'address' | 'side' | 'created_at'>

// Pola edytowane w panelu (event_id dokłada warstwa API).
export type GuestInput = Omit<Guest, 'id' | 'created_at'>
export type GuestGroupInput = Omit<GuestGroup, 'id' | 'created_at'>

export const GUEST_SELECT_FIELDS =
  'id, group_id, first_name, last_name, address, phone, side, attendance, age_group, is_plus_one, created_at' as const
export const GUEST_GROUP_SELECT_FIELDS = 'id, name, address, side, created_at' as const

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

export const SIDE_OPTIONS: readonly { value: GuestSide; label: string }[] = [
  { value: 'BRIDE', label: weddingContent.couple.brideName },
  { value: 'GROOM', label: weddingContent.couple.groomName },
  { value: 'BOTH', label: 'Wspólny' },
]

export const SIDE_LABELS = Object.fromEntries(
  SIDE_OPTIONS.map(({ value, label }) => [value, label])
) as Record<GuestSide, string>

export const AGE_GROUP_OPTIONS: readonly { value: GuestAgeGroup; label: string }[] = [
  { value: 'ADULT', label: 'Dorosły' },
  { value: 'CHILD', label: 'Dziecko' },
  { value: 'INFANT', label: 'Niemowlę' },
]

export const AGE_GROUP_LABELS = Object.fromEntries(
  AGE_GROUP_OPTIONS.map(({ value, label }) => [value, label])
) as Record<GuestAgeGroup, string>

// Limity z migracji 20261124100000_guest_management.sql.
export const GUEST_LIMITS = {
  name: 80,
  phone: 40,
  address: 300,
  groupName: 120,
} as const

export const guestDisplayName = (guest: Pick<Guest, 'first_name' | 'last_name' | 'is_plus_one'>) =>
  [guest.first_name, guest.last_name].filter(Boolean).join(' ').trim() ||
  (guest.is_plus_one ? 'Osoba towarzysząca' : 'Bez imienia')
