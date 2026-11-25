import type { SeatConfig, SeatingShape } from '../types/seating'

// Geometria stołu wyliczana z kształtu i liczby miejsc (rozmiar stołu nie
// jest zapisywany w bazie). Jednostki sali: 1 = 1 cm. Współrzędne lokalne
// względem środka stołu (przed obrotem).

export const SEAT_PITCH = 60 // odstęp między krzesłami
export const TABLE_DEPTH = 80 // szerokość blatu
export const SEAT_RADIUS = 22
const SEAT_OFFSET = 32 // środek krzesła od krawędzi blatu
// Odsunięcie wewnętrznych rzędów od narożnika - krzesła z sąsiednich ramion
// nie nachodzą na siebie.
const CORNER_CLEARANCE = 40

export type TableBlock = { x: number; y: number; width: number; height: number }
export type SeatPoint = { number: number; x: number; y: number }

export type TableGeometry = {
  width: number
  height: number
  blocks: TableBlock[]
  seats: SeatPoint[]
  // Miejsce na nazwę stołu - środek pierwszego bloku (L: poziome ramię,
  // U: podstawa), z dala od wewnętrznych krzeseł.
  label: Point
}

type Point = { x: number; y: number }

// n krzeseł wyśrodkowanych na odcinku [start, end] (w osi rzędu).
const row = (count: number, start: number, end: number): number[] => {
  const offset = start + (end - start - count * SEAT_PITCH) / 2 + SEAT_PITCH / 2
  return Array.from({ length: count }, (_, index) => offset + index * SEAT_PITCH)
}

const splitSides = (count: number, sides: 'both' | 'one') =>
  sides === 'both'
    ? { outer: Math.ceil(count / 2), inner: Math.floor(count / 2) }
    : { outer: count, inner: 0 }

const armLength = (outer: number, inner: number, clearance: number) =>
  Math.max(outer * SEAT_PITCH, inner > 0 ? inner * SEAT_PITCH + clearance : 0, SEAT_PITCH)

const clampSeats = (value: number | null | undefined, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 0), max)
    : fallback

// Krzesła numerowane zgodnie z ruchem wskazówek zegara.
const rectGeometry = (capacity: number, config: SeatConfig) => {
  const sides = config.sides ?? 'both'
  const ends = config.ends && capacity >= 3 ? 2 : 0
  const long = capacity - ends
  const top = sides === 'both' ? Math.ceil(long / 2) : long
  const bottom = long - top
  const length = Math.max(top, bottom, 1) * SEAT_PITCH
  const width = length
  const height = TABLE_DEPTH

  const points: Point[] = [
    ...row(top, 0, length).map((x) => ({ x, y: -SEAT_OFFSET })),
    ...(ends ? [{ x: length + SEAT_OFFSET, y: height / 2 }] : []),
    ...row(bottom, 0, length)
      .reverse()
      .map((x) => ({ x, y: height + SEAT_OFFSET })),
    ...(ends ? [{ x: -SEAT_OFFSET, y: height / 2 }] : []),
  ]

  return { width, height, blocks: [{ x: 0, y: 0, width, height }], points }
}

// Ramię poziome u góry, pionowe po lewej (obrót ustawia resztę wariantów).
const lGeometry = (capacity: number, config: SeatConfig) => {
  const sides = config.sides ?? 'both'
  const horizontal = clampSeats(config.armSeats, capacity, Math.ceil(capacity / 2))
  const vertical = capacity - horizontal
  const a = splitSides(horizontal, sides)
  const b = splitSides(vertical, sides)
  const d = TABLE_DEPTH
  const la = armLength(a.outer, a.inner, CORNER_CLEARANCE)
  const lb = armLength(b.outer, b.inner, CORNER_CLEARANCE)

  const points: Point[] = [
    // zewnętrzna strona: pionowe ramię od dołu, poziome od lewej
    ...row(b.outer, d, d + lb)
      .reverse()
      .map((y) => ({ x: -SEAT_OFFSET, y })),
    ...row(a.outer, d, d + la).map((x) => ({ x, y: -SEAT_OFFSET })),
    // wewnętrzna: poziome od prawej, pionowe od góry
    ...row(a.inner, d + CORNER_CLEARANCE, d + la)
      .reverse()
      .map((x) => ({ x, y: d + SEAT_OFFSET })),
    ...row(b.inner, d + CORNER_CLEARANCE, d + lb).map((y) => ({ x: d + SEAT_OFFSET, y })),
  ]

  return {
    width: d + la,
    height: d + lb,
    blocks: [
      { x: 0, y: 0, width: d + la, height: d },
      { x: 0, y: d, width: d, height: lb },
    ],
    points,
  }
}

// Podstawa u góry, ramiona w dół.
const uGeometry = (capacity: number, config: SeatConfig) => {
  const sides = config.sides ?? 'both'
  const baseSeats = clampSeats(config.armSeats, capacity, Math.round(capacity / 3))
  const rest = capacity - baseSeats
  const base = splitSides(baseSeats, sides)
  const left = splitSides(Math.ceil(rest / 2), sides)
  const right = splitSides(Math.floor(rest / 2), sides)
  const d = TABLE_DEPTH
  const baseLength = Math.max(
    armLength(base.outer, base.inner, 2 * CORNER_CLEARANCE),
    sides === 'both' ? SEAT_PITCH + 2 * CORNER_CLEARANCE : SEAT_PITCH
  )
  const legLength = Math.max(
    armLength(left.outer, left.inner, CORNER_CLEARANCE),
    armLength(right.outer, right.inner, CORNER_CLEARANCE)
  )
  const width = 2 * d + baseLength
  const height = d + legLength

  const points: Point[] = [
    ...row(left.outer, d, height)
      .reverse()
      .map((y) => ({ x: -SEAT_OFFSET, y })),
    ...row(base.outer, d, d + baseLength).map((x) => ({ x, y: -SEAT_OFFSET })),
    ...row(right.outer, d, height).map((y) => ({ x: width + SEAT_OFFSET, y })),
    ...row(right.inner, d + CORNER_CLEARANCE, height)
      .reverse()
      .map((y) => ({ x: width - d - SEAT_OFFSET, y })),
    ...row(base.inner, d + CORNER_CLEARANCE, d + baseLength - CORNER_CLEARANCE)
      .reverse()
      .map((x) => ({ x, y: d + SEAT_OFFSET })),
    ...row(left.inner, d + CORNER_CLEARANCE, height).map((y) => ({ x: d + SEAT_OFFSET, y })),
  ]

  return {
    width,
    height,
    blocks: [
      { x: 0, y: 0, width, height: d },
      { x: 0, y: d, width: d, height: legLength },
      { x: width - d, y: d, width: d, height: legLength },
    ],
    points,
  }
}

const cache = new Map<string, TableGeometry>()

export const tableGeometry = (shape: SeatingShape, capacity: number, config: SeatConfig): TableGeometry => {
  const key = `${shape}|${capacity}|${config.sides ?? ''}|${config.ends ? 1 : 0}|${config.armSeats ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached

  const raw =
    shape === 'L' ? lGeometry(capacity, config) : shape === 'U' ? uGeometry(capacity, config) : rectGeometry(capacity, config)
  const cx = raw.width / 2
  const cy = raw.height / 2

  const geometry: TableGeometry = {
    width: raw.width,
    height: raw.height,
    blocks: raw.blocks.map((block) => ({ ...block, x: block.x - cx, y: block.y - cy })),
    seats: raw.points.map((point, index) => ({ number: index + 1, x: point.x - cx, y: point.y - cy })),
    label: {
      x: raw.blocks[0].x + raw.blocks[0].width / 2 - cx,
      y: raw.blocks[0].y + raw.blocks[0].height / 2 - cy,
    },
  }

  cache.set(key, geometry)
  return geometry
}

// Punkt lokalny stołu -> współrzędne sali (obrót wokół środka stołu).
export const toRoomPoint = (table: { x: number; y: number; rotation: number }, point: Point): Point => {
  const angle = (table.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: table.x + point.x * cos - point.y * sin,
    y: table.y + point.x * sin + point.y * cos,
  }
}
