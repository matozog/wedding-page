import type { SectionConfig, SectionTexts } from '@/types/eventPage'
import type { HeaderFormValues } from './fields'

export const maxLength = (value: number) => ({ value, message: `Maksymalnie ${value} znaków.` })

// Wartość pola formularza -> null dla pustej (baza i tak przycina).
export const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

export const textsToForm = (config: SectionConfig): HeaderFormValues => ({
  navLabel: config.nav_label ?? '',
  eyebrow: config.eyebrow ?? '',
  title: config.title ?? '',
  description: config.description ?? '',
  contentTitle: config.content_title ?? '',
  contentBody: config.content_body ?? '',
})

export const textsFromForm = (values: HeaderFormValues): SectionTexts => ({
  nav_label: orNull(values.navLabel),
  eyebrow: orNull(values.eyebrow),
  title: orNull(values.title),
  description: orNull(values.description),
  content_title: orNull(values.contentTitle),
  content_body: orNull(values.contentBody),
})

// Formaty jak w bazie (event_contacts_email_format / _phone_format).
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PHONE_PATTERN = /^\+?[0-9 ()-]{3,30}$/
