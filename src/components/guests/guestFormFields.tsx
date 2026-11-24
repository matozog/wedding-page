import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import {
  AGE_GROUP_OPTIONS,
  ATTENDANCE_OPTIONS,
  GUEST_LIMITS,
  SIDE_OPTIONS,
  type GuestGroup,
} from '@/types/guest'
import { NEW_GROUP_VALUE, type GuestFormLayout, type GuestFormValues } from './guestFormModel'

// -----------------------------------------------------------------------------
// Pola
// -----------------------------------------------------------------------------
type FieldProps = {
  form: UseFormReturn<GuestFormValues>
  idPrefix: string
  layout: GuestFormLayout
}

type FieldShellProps = {
  id: string
  label: string
  error?: string
  layout: GuestFormLayout
  className?: string
  children: ReactNode
}

// W wierszu tabeli etykieta jest tylko dla czytników ekranu (nagłówek
// kolumny pełni jej rolę wizualnie).
function FieldShell({ id, label, error, layout, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex min-w-0 flex-col', layout === 'stacked' && 'gap-1.5', className)}>
      <label htmlFor={id} className={layout === 'row' ? 'sr-only' : 'text-sm font-medium'}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

const fieldA11y = (id: string, error?: string) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
})

const inputSize = (layout: GuestFormLayout) => (layout === 'row' ? 'h-9' : undefined)

export function FirstNameField({ form, idPrefix, layout }: FieldProps) {
  const id = `${idPrefix}-first-name`
  const error = form.formState.errors.first_name?.message

  return (
    <FieldShell id={id} label="Imię" error={error} layout={layout}>
      <Input
        {...fieldA11y(id, error)}
        className={cn(inputSize(layout), error && 'border-destructive')}
        autoComplete="off"
        {...form.register('first_name', {
          maxLength: { value: GUEST_LIMITS.name, message: `Maksymalnie ${GUEST_LIMITS.name} znaków.` },
          validate: (value, values) =>
            values.is_plus_one || value.trim() !== '' || 'Podaj imię (lub zaznacz osobę towarzyszącą).',
        })}
      />
    </FieldShell>
  )
}

export function LastNameField({ form, idPrefix, layout }: FieldProps) {
  const id = `${idPrefix}-last-name`
  const error = form.formState.errors.last_name?.message

  return (
    <FieldShell id={id} label="Nazwisko" error={error} layout={layout}>
      <Input
        {...fieldA11y(id, error)}
        className={cn(inputSize(layout), error && 'border-destructive')}
        autoComplete="off"
        {...form.register('last_name', {
          maxLength: { value: GUEST_LIMITS.name, message: `Maksymalnie ${GUEST_LIMITS.name} znaków.` },
        })}
      />
    </FieldShell>
  )
}

export function AddressField({
  form,
  idPrefix,
  layout,
  groupAddress,
}: FieldProps & { groupAddress: string | null }) {
  const id = `${idPrefix}-address`
  const error = form.formState.errors.address?.message

  return (
    <FieldShell id={id} label="Adres" error={error} layout={layout}>
      <Input
        {...fieldA11y(id, error)}
        className={cn(inputSize(layout), error && 'border-destructive')}
        placeholder={groupAddress ? `Adres grupy: ${groupAddress}` : undefined}
        autoComplete="off"
        {...form.register('address', {
          maxLength: { value: GUEST_LIMITS.address, message: `Maksymalnie ${GUEST_LIMITS.address} znaków.` },
        })}
      />
      {layout === 'stacked' && groupAddress && (
        <p className="text-xs text-muted-foreground">Puste pole = adres grupy.</p>
      )}
    </FieldShell>
  )
}

export function PhoneField({ form, idPrefix, layout }: FieldProps) {
  const id = `${idPrefix}-phone`
  const error = form.formState.errors.phone?.message

  return (
    <FieldShell id={id} label="Telefon" error={error} layout={layout}>
      <Input
        {...fieldA11y(id, error)}
        type="tel"
        inputMode="tel"
        className={cn(inputSize(layout), error && 'border-destructive')}
        autoComplete="off"
        {...form.register('phone', {
          maxLength: { value: GUEST_LIMITS.phone, message: `Maksymalnie ${GUEST_LIMITS.phone} znaków.` },
          pattern: { value: /^[0-9+()\-\s]*$/, message: 'Dozwolone cyfry, spacje i znaki + ( ) -' },
        })}
      />
    </FieldShell>
  )
}

export function SideField({ form, idPrefix, layout }: FieldProps) {
  const id = `${idPrefix}-side`

  return (
    <FieldShell id={id} label="Od kogo" layout={layout}>
      <NativeSelect id={id} className={inputSize(layout)} {...form.register('side')}>
        <option value="">—</option>
        {SIDE_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

export function AttendanceField({ form, idPrefix, layout }: FieldProps) {
  const id = `${idPrefix}-attendance`

  return (
    <FieldShell id={id} label="Obecność" layout={layout}>
      <NativeSelect id={id} className={inputSize(layout)} {...form.register('attendance')}>
        {ATTENDANCE_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

export function AgeGroupField({ form, idPrefix, layout }: FieldProps) {
  const id = `${idPrefix}-age-group`

  return (
    <FieldShell id={id} label="Wiek" layout="stacked" className={layout === 'row' ? 'w-36' : undefined}>
      <NativeSelect id={id} className={inputSize(layout)} {...form.register('age_group')}>
        {AGE_GROUP_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

export function PlusOneField({ form, idPrefix }: FieldProps) {
  const id = `${idPrefix}-plus-one`

  return (
    <div className="flex items-center gap-2 self-end py-2">
      <input
        id={id}
        type="checkbox"
        className="size-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...form.register('is_plus_one', { deps: ['first_name'] })}
      />
      <label htmlFor={id} className="text-sm">
        Osoba towarzysząca
      </label>
    </div>
  )
}

export function GroupField({
  form,
  idPrefix,
  layout,
  groups,
  showLabel = layout === 'stacked',
}: FieldProps & { groups: readonly GuestGroup[]; showLabel?: boolean }) {
  const id = `${idPrefix}-group`
  const newNameId = `${idPrefix}-new-group`
  const isNew = form.watch('group_id') === NEW_GROUP_VALUE
  const newNameError = form.formState.errors.new_group_name?.message

  // Nowy gość w grupie przejmuje jej stronę, jeśli nie wybrano innej.
  const groupRegistration = form.register('group_id', {
    onChange: (event: { target: { value: string } }) => {
      const group = groups.find((item) => item.id === event.target.value)
      if (group?.side && !form.getValues('side')) {
        form.setValue('side', group.side, { shouldDirty: true })
      }
    },
  })

  return (
    <div className={cn('flex min-w-0 gap-2', layout === 'stacked' ? 'flex-col' : 'flex-wrap items-end')}>
      <FieldShell
        id={id}
        label="Grupa"
        layout={showLabel ? 'stacked' : 'row'}
        className={layout === 'row' ? 'w-48' : undefined}
      >
        <NativeSelect id={id} className={inputSize(layout)} {...groupRegistration}>
          <option value="">Bez grupy</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
          <option value={NEW_GROUP_VALUE}>+ Nowa grupa…</option>
        </NativeSelect>
      </FieldShell>
      {isNew && (
        <FieldShell
          id={newNameId}
          label="Nazwa nowej grupy"
          error={newNameError}
          layout={showLabel ? 'stacked' : 'row'}
          className={layout === 'row' ? 'w-48' : undefined}
        >
          <Input
            {...fieldA11y(newNameId, newNameError)}
            className={cn(inputSize(layout), newNameError && 'border-destructive')}
            placeholder="np. Kowalscy"
            autoComplete="off"
            {...form.register('new_group_name', {
              validate: (value, values) =>
                values.group_id !== NEW_GROUP_VALUE ||
                (value.trim() !== '' && value.trim().length <= GUEST_LIMITS.groupName) ||
                'Podaj nazwę grupy.',
            })}
          />
        </FieldShell>
      )}
    </div>
  )
}
