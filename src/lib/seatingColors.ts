import type { Attendance } from '../types/guest'

// Kolory krzeseł w edytorze planu (canvas - wartości, nie klasy Tailwinda).

// Paleta grup - kolor wyliczany z id grupy (stały między odświeżeniami,
// bez zapisu w bazie). Dobrane tak, by sąsiednie barwy się różniły.
const GROUP_PALETTE = [
  '#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac',
  '#f06292', '#9575cd', '#aed581', '#4fc3f7', '#ff8a65', '#dce775',
] as const

const hash = (value: string) => {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(result)
}

export const paletteColor = (key: string) => GROUP_PALETTE[hash(key) % GROUP_PALETTE.length]

// Te same barwy co ATTENDANCE_TONES (emerald / lime / amber / rose / szary).
export const ATTENDANCE_COLORS: Record<Attendance, string> = {
  CONFIRMED: '#059669',
  LIKELY: '#65a30d',
  UNLIKELY: '#d97706',
  DECLINED: '#e11d48',
  UNKNOWN: '#9ca3af',
}

export const NEUTRAL_SEAT_COLOR = '#d1d5db'
