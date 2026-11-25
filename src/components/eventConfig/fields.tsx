import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FieldErrors, FieldValues, Path, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/components/expenses/formField'
import { fieldAria, textareaClass } from '@/components/expenses/formFieldProps'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/input'
import { EVENT_PAGE_LIMITS } from '@/types/eventPage'
import { maxLength } from './formUtils'

// Karta jednej części strony konfiguracji.
export function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card aria-labelledby={`${id}-title`} role="region" className="border-border/80">
      <CardHeader>
        <h2 id={`${id}-title`} className="font-serif text-2xl text-foreground">
          {title}
        </h2>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function TextField({
  id,
  label,
  error,
  hint,
  type = 'text',
  placeholder,
  registration,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  type?: string
  placeholder?: string
  registration: UseFormRegisterReturn
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete="off"
        className="aria-invalid:border-destructive"
        {...fieldAria(id, error, Boolean(hint))}
        {...registration}
      />
    </FormField>
  )
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  rows = 3,
  registration,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  rows?: number
  registration: UseFormRegisterReturn
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <textarea id={id} rows={rows} className={textareaClass} {...fieldAria(id, error, Boolean(hint))} {...registration} />
    </FormField>
  )
}

export type HeaderFormValues = {
  eyebrow: string
  title: string
  description: string
}

// Pola nagłówka sekcji - wspólne dla formularzy sekcji z treścią.
export function SectionHeaderFields<T extends FieldValues & HeaderFormValues>({
  idPrefix,
  register,
  errors,
}: {
  idPrefix: string
  register: UseFormRegister<T>
  errors: FieldErrors<T>
}) {
  const headerErrors = errors as FieldErrors<HeaderFormValues>

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id={`${idPrefix}-eyebrow`}
        label="Napis nad tytułem"
        hint="Mały napis, np. „Informacje”."
        error={headerErrors.eyebrow?.message}
        registration={register('eyebrow' as Path<T>, { maxLength: maxLength(EVENT_PAGE_LIMITS.eyebrow) })}
      />
      <TextField
        id={`${idPrefix}-title`}
        label="Nagłówek"
        error={headerErrors.title?.message}
        registration={register('title' as Path<T>, { maxLength: maxLength(EVENT_PAGE_LIMITS.title) })}
      />
      <div className="sm:col-span-2">
        <TextAreaField
          id={`${idPrefix}-description`}
          label="Opis"
          error={headerErrors.description?.message}
          registration={register('description' as Path<T>, { maxLength: maxLength(EVENT_PAGE_LIMITS.description) })}
        />
      </div>
    </div>
  )
}

// Przesuwanie i usuwanie pozycji listy (bez przeciągania - działa z klawiatury).
export function ItemControls({
  label,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  label: string
  index: number
  count: number
  disabled: boolean
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled || index === 0}
        aria-label={`Przesuń wyżej: ${label}`}
        title="Przesuń wyżej"
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled || index === count - 1}
        aria-label={`Przesuń niżej: ${label}`}
        title="Przesuń niżej"
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        disabled={disabled}
        aria-label={`Usuń: ${label}`}
        title="Usuń"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

// Stopka formularza sekcji: błąd zapisu, informacja o zapisaniu, przycisk.
export function FormFooter({
  error,
  saved,
  submitting,
  label = 'Zapisz',
}: {
  error?: string
  saved: boolean
  submitting: boolean
  label?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div role="alert">
          <ErrorMessage message={error} />
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {saved ? 'Zapisano zmiany.' : ''}
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Zapisywanie…' : label}
        </Button>
      </div>
    </div>
  )
}
