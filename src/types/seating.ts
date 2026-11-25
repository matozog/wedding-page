import type { Database } from './database'
import type { Guest } from './guest'

export type SeatingShape = Database['public']['Enums']['seating_table_shape']

// Ustawienia miejsc stołu (seating_tables.seat_config).
//   sides    - 'both': miejsca po obu stronach blatu, 'one': tylko po
//              zewnętrznej (prostokąt - górnej) stronie
//   ends     - prostokąt: po jednym miejscu na obu szczytach
//   armSeats - L: miejsca na poziomym ramieniu, U: miejsca na podstawie.
//              Brak = podział automatyczny.
export type SeatSides = 'both' | 'one'
export type SeatConfig = {
  sides?: SeatSides
  ends?: boolean
  armSeats?: number | null
}

// Współrzędne w jednostkach sali (1 = 1 cm). x, y - środek stołu.
export type SeatingTable = {
  id: string
  name: string
  shape: SeatingShape
  capacity: number
  x: number
  y: number
  rotation: number
  seat_config: SeatConfig
}

// Element tła (parkiet, wejście...) - x, y to środek prostokąta.
export type SeatingLandmark = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export type SeatingRoom = { width: number; height: number }

export type SeatAssignment = {
  table_id: string
  seat_number: number
  guest_id: string
  guest_name: string
}

// get_seating_plan - widok gościa (tylko imiona) i podgląd organizatora.
export type SeatingPlan = {
  is_published: boolean
  room: SeatingRoom
  tables: SeatingTable[]
  landmarks: SeatingLandmark[]
  seats: SeatAssignment[]
}

// Gość w edytorze - z miejscem.
export type SeatedGuest = Guest & { table_id: string | null; seat_number: number | null }

export const SEATED_GUEST_EXTRA_FIELDS = 'table_id, seat_number' as const

export const SHAPE_OPTIONS: readonly { value: SeatingShape; label: string }[] = [
  { value: 'RECT', label: 'Prostokątny' },
  { value: 'L', label: 'Narożny (L)' },
  { value: 'U', label: 'Podkowa (U)' },
]

export const SHAPE_LABELS = Object.fromEntries(
  SHAPE_OPTIONS.map(({ value, label }) => [value, label])
) as Record<SeatingShape, string>

// Te same limity co w bazie (20261125130000_seating_layout.sql).
export const SEATING_LIMITS = {
  tables: 100,
  landmarks: 30,
  capacity: 60,
  tableName: 60,
  landmarkLabel: 40,
  roomMin: 300,
  roomMax: 5000,
  landmarkMin: 20,
} as const

export const seatKey = (tableId: string, seatNumber: number) => `${tableId}:${seatNumber}`
