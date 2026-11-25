import { getErrorCode, getErrorMessage } from '@/lib/eventApi'
import { EVENT_LIMITS } from '@/types/adminEvent'

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatEventDate = (iso: string | null) => (iso ? dateTimeFormat.format(new Date(iso)) : null)

const pad = (value: number) => String(value).padStart(2, '0')

// ISO z bazy -> wartość <input type="datetime-local"> w strefie przeglądarki.
export const toDateTimeLocal = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Wartość pola -> ISO (null dla pustego pola, NaN-owa data -> null).
export const fromDateTimeLocal = (value: string): string | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// Kod porównywany jest w bazie po btrim + upper - tak samo go pokazujemy.
export const normalizeAccessCode = (value: string) => value.trim().toUpperCase()

export const validateAccessCode = (value: string) => {
  const code = normalizeAccessCode(value)
  if (code === '') return 'Podaj kod dostępu.'
  if (code.length < EVENT_LIMITS.accessCodeMin) return `Kod musi mieć co najmniej ${EVENT_LIMITS.accessCodeMin} znaków.`
  if (code.length > EVENT_LIMITS.accessCodeMax) return `Kod może mieć najwyżej ${EVENT_LIMITS.accessCodeMax} znaków.`
  return true
}

// Bez znaków łatwych do pomylenia (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const GENERATED_CODE_LENGTH = 8

export const generateAccessCode = () => {
  const values = crypto.getRandomValues(new Uint32Array(GENERATED_CODE_LENGTH))
  return Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('')
}

// Komunikaty walidacji z bazy (PT400) są po polsku - pokazujemy je wprost.
export const describeSaveError = (err: unknown, fallback: string) =>
  getErrorCode(err) === 'PT400' ? (getErrorMessage(err) ?? fallback) : fallback
