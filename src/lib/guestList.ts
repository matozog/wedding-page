import {
  ATTENDANCE_OPTIONS,
  ATTENDANCE_ORDER,
  type Attendance,
  type Guest,
  type GuestAgeGroup,
  type GuestGroup,
  type GuestSide,
} from '../types/guest'

// -----------------------------------------------------------------------------
// Licznik - liczy osoby (także nienazwane osoby towarzyszące), z podziałem
// na dorosłych, dzieci i niemowlęta.
// -----------------------------------------------------------------------------
export type HeadCount = Record<GuestAgeGroup, number> & { total: number }

export type GuestStats = {
  byAttendance: Record<Attendance, HeadCount>
  // Pewna obecność + całkiem możliwe.
  expected: HeadCount
  all: HeadCount
}

const emptyHeadCount = (): HeadCount => ({ total: 0, ADULT: 0, CHILD: 0, INFANT: 0 })

const addTo = (count: HeadCount, ageGroup: GuestAgeGroup) => {
  count.total += 1
  count[ageGroup] += 1
}

export const computeGuestStats = (
  guests: readonly Pick<Guest, 'attendance' | 'age_group'>[]
): GuestStats => {
  const byAttendance = Object.fromEntries(
    ATTENDANCE_OPTIONS.map(({ value }) => [value, emptyHeadCount()])
  ) as Record<Attendance, HeadCount>
  const expected = emptyHeadCount()
  const all = emptyHeadCount()

  for (const guest of guests) {
    addTo(byAttendance[guest.attendance], guest.age_group)
    addTo(all, guest.age_group)

    if (guest.attendance === 'CONFIRMED' || guest.attendance === 'LIKELY') {
      addTo(expected, guest.age_group)
    }
  }

  return { byAttendance, expected, all }
}

// -----------------------------------------------------------------------------
// Filtrowanie
// -----------------------------------------------------------------------------
export type GuestFilters = {
  search: string
  attendance: Attendance | ''
  side: GuestSide | ''
}

export const EMPTY_FILTERS: GuestFilters = { search: '', attendance: '', side: '' }

// Wyszukiwanie bez wielkości liter i polskich znaków ("zolw" znajdzie "Żółw").
const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .trim()

export const filterGuests = (
  guests: readonly Guest[],
  filters: GuestFilters,
  groupsById: ReadonlyMap<string, GuestGroup>
): Guest[] => {
  const terms = normalize(filters.search).split(/\s+/).filter(Boolean)

  return guests.filter((guest) => {
    if (filters.attendance && guest.attendance !== filters.attendance) return false
    if (filters.side && guest.side !== filters.side) return false
    if (terms.length === 0) return true

    const group = guest.group_id ? groupsById.get(guest.group_id) : undefined
    const haystack = normalize(
      [guest.first_name, guest.last_name, guest.phone, guest.address, group?.name]
        .filter(Boolean)
        .join(' ')
    )

    return terms.every((term) => haystack.includes(term))
  })
}

// -----------------------------------------------------------------------------
// Sortowanie
// -----------------------------------------------------------------------------
export type GuestSortKey =
  | 'first_name'
  | 'last_name'
  | 'address'
  | 'phone'
  | 'side'
  | 'attendance'
  | 'group'

// Etykiety kluczy sortowania (lista wyboru na wąskim ekranie).
export const SORT_LABELS: Record<GuestSortKey, string> = {
  last_name: 'Nazwisko',
  first_name: 'Imię',
  group: 'Grupa',
  attendance: 'Obecność',
  side: 'Od kogo',
  address: 'Adres',
  phone: 'Telefon',
}

export type GuestSort = { key: GuestSortKey; direction: 'asc' | 'desc' }

export const DEFAULT_SORT: GuestSort = { key: 'last_name', direction: 'asc' }

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

// Puste wartości zawsze na końcu, niezależnie od kierunku.
const compareText = (a: string | null | undefined, b: string | null | undefined, sign: number) => {
  const left = a?.trim() ?? ''
  const right = b?.trim() ?? ''

  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  return collator.compare(left, right) * sign
}

const byName = (a: Guest, b: Guest) =>
  compareText(a.last_name, b.last_name, 1) ||
  compareText(a.first_name, b.first_name, 1) ||
  a.created_at.localeCompare(b.created_at)

// Adres widoczny w tabeli: własny gościa albo adres jego grupy.
export const effectiveAddress = (guest: Guest, groupsById: ReadonlyMap<string, GuestGroup>) =>
  guest.address ?? (guest.group_id ? (groupsById.get(guest.group_id)?.address ?? null) : null)

export const sortGuests = (
  guests: readonly Guest[],
  sort: GuestSort,
  groupsById: ReadonlyMap<string, GuestGroup>,
  sideLabel: (side: GuestSide | null) => string | null
): Guest[] => {
  const sign = sort.direction === 'asc' ? 1 : -1

  const compare = (a: Guest, b: Guest): number => {
    switch (sort.key) {
      case 'first_name':
        return compareText(a.first_name, b.first_name, sign)
      case 'last_name':
        return compareText(a.last_name, b.last_name, sign)
      case 'phone':
        return compareText(a.phone, b.phone, sign)
      case 'address':
        return compareText(effectiveAddress(a, groupsById), effectiveAddress(b, groupsById), sign)
      case 'side':
        return compareText(sideLabel(a.side), sideLabel(b.side), sign)
      case 'attendance':
        return (ATTENDANCE_ORDER[a.attendance] - ATTENDANCE_ORDER[b.attendance]) * sign
      case 'group': {
        // Osoby z jednej grupy obok siebie; id rozdziela grupy o tej samej nazwie.
        const groupA = a.group_id ? groupsById.get(a.group_id) : undefined
        const groupB = b.group_id ? groupsById.get(b.group_id) : undefined
        return (
          compareText(groupA?.name, groupB?.name, sign) ||
          compareText(groupA?.id, groupB?.id, 1)
        )
      }
    }
  }

  return [...guests].sort((a, b) => compare(a, b) || byName(a, b))
}

export const sortGroups = (groups: readonly GuestGroup[]): GuestGroup[] =>
  [...groups].sort(
    (a, b) => compareText(a.name, b.name, 1) || a.created_at.localeCompare(b.created_at)
  )
