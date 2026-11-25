import type { SectionHeader } from '@/types/eventPage'
import type { HeaderFormValues } from './fields'

export const maxLength = (value: number) => ({ value, message: `Maksymalnie ${value} znaków.` })

// Wartość pola formularza -> null dla pustej (baza i tak przycina).
export const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

export const headerToForm = (header: SectionHeader): HeaderFormValues => ({
  eyebrow: header.eyebrow ?? '',
  title: header.title ?? '',
  description: header.description ?? '',
})

export const headerFromForm = (values: HeaderFormValues): SectionHeader => ({
  eyebrow: orNull(values.eyebrow),
  title: orNull(values.title),
  description: orNull(values.description),
})

// Formaty jak w bazie (event_contacts_email_format / _phone_format).
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PHONE_PATTERN = /^\+?[0-9 ()-]{3,30}$/
