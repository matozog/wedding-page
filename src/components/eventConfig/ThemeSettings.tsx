import { Check, RotateCcw, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useRef, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import {
  CUSTOM_COLORS,
  THEMES,
  parseCustomColors,
  type AppTheme,
  type CustomColorKey,
  type ThemeKey,
} from '@/config/themes'
import { MIN_CONTRAST, findContrastIssues, isPaletteReady, readPaletteColors, themeStyle } from '@/lib/themeColors'
import { cn } from '@/lib/utils'
import { FormFooter } from './fields'
import { useSavedFlag } from './useSavedFlag'

type ThemeSettingsProps = {
  theme: AppTheme
  // Treść podglądu (np. EventThemePreview) - w kolorach wybranego motywu.
  preview: ReactNode
  onSave: (theme: AppTheme) => Promise<void>
  onSaved: (theme: AppTheme) => void
}

// '' - kolor z palety.
type ThemeFormValues = {
  key: ThemeKey
  colors: Record<CustomColorKey, string>
}

const GROUPS = [
  { tone: 'light', label: 'Jasne' },
  { tone: 'dark', label: 'Ciemne' },
] as const

const NO_COLORS = Object.fromEntries(CUSTOM_COLORS.map(({ key }) => [key, ''])) as Record<CustomColorKey, string>

const toFormValues = (theme: AppTheme): ThemeFormValues => ({
  key: theme.key,
  colors: { ...NO_COLORS, ...theme.colors },
})

const toTheme = (values: ThemeFormValues): AppTheme => ({
  key: values.key,
  colors: parseCustomColors(values.colors),
})

const formatRatio = (ratio: number) => ratio.toFixed(1).replace('.', ',')

// Komunikat dla czytnika ekranu - zmienia się tylko z liczbą problemów, więc
// przeciąganie suwaka koloru nie powoduje ciągłych ogłoszeń.
const describeIssueCount = (count: number) =>
  count === 0
    ? ''
    : count === 1
      ? 'Słaby kontrast w 1 miejscu.'
      : `Słaby kontrast w ${count} miejscach.`

// Próbki kolorów - fragment z data-theme dostaje zmienne CSS danej palety.
function ThemeSwatches({ theme }: { theme: ThemeKey }) {
  return (
    <span data-theme={theme} className="flex gap-1" aria-hidden="true">
      {['bg-background', 'bg-primary', 'bg-secondary', 'bg-accent'].map((className) => (
        <span key={className} className={cn('size-5 rounded-full border border-foreground/15', className)} />
      ))}
    </span>
  )
}

// Paleta jako punkt wyjścia i do pięciu własnych kolorów (pozostałe są
// wyliczane). Podgląd na żywo, zapis przyciskiem.
export function ThemeSettings({ theme, preview, onSave, onSaved }: ThemeSettingsProps) {
  const id = useId()
  const busyRef = useRef(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ThemeFormValues>({ defaultValues: toFormValues(theme) })
  const { saved, markSaved } = useSavedFlag(watch)

  const values = watch()
  const current = toTheme(values)
  // paletteReady - przelicz, gdy arkusz CSS wczyta się po pierwszym odczycie.
  const paletteReady = isPaletteReady(values.key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paletteColors = useMemo(() => readPaletteColors(values.key), [values.key, paletteReady])
  const issues = findContrastIssues(current)
  const hasCustomColors = current.colors !== null

  const onSubmit = handleSubmit(async (formValues) => {
    if (busyRef.current) return
    busyRef.current = true

    const next = toTheme(formValues)

    try {
      await onSave(next)
      onSaved(next)
      reset(toFormValues(next))
      markSaved()
    } catch (err) {
      console.error(err)
      setError('root', { message: describeSaveError(err, 'Nie udało się zapisać motywu.') })
    } finally {
      busyRef.current = false
    }
  })

  const resetColors = () => {
    for (const { key } of CUSTOM_COLORS) setValue(`colors.${key}`, '', { shouldDirty: true })
  }

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {GROUPS.map((group) => (
          <fieldset key={group.tone}>
            <legend className="mb-2 text-sm font-medium text-foreground">Zestawy {group.label.toLowerCase()}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {THEMES.filter((option) => option.tone === group.tone).map((option) => {
                const checked = option.key === values.key

                return (
                  <label
                    key={option.key}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/50',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      checked && 'border-primary bg-primary/5'
                    )}
                  >
                    <input type="radio" value={option.key} className="sr-only" {...register('key')} />
                    <ThemeSwatches theme={option.key} />
                    <span className="flex-1 text-sm font-medium text-foreground">{option.label}</span>
                    {checked && <Check className="size-4 text-primary" aria-hidden="true" />}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-foreground">Własne kolory</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            Nadpisują kolory zestawu. Karty, obramowania i kolor tekstu na przyciskach są wyliczane automatycznie.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CUSTOM_COLORS.map(({ key, label }) => (
              <Controller
                key={key}
                control={control}
                name={`colors.${key}`}
                render={({ field }) => {
                  const inputId = `${id}-${key}`
                  const color = field.value || paletteColors[key]

                  return (
                    <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
                      <input
                        id={inputId}
                        ref={field.ref}
                        type="color"
                        value={color}
                        onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                        onBlur={field.onBlur}
                        className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm font-medium text-foreground">{label}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {color}
                          {field.value ? '' : ' · z zestawu'}
                        </span>
                      </label>
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0"
                          aria-label={`Przywróć kolor z zestawu: ${label}`}
                          title="Przywróć kolor z zestawu"
                          onClick={() => field.onChange('')}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  )
                }}
              />
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-3" disabled={!hasCustomColors} onClick={resetColors}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Przywróć domyślne kolory
          </Button>
        </fieldset>

        <p role="status" className="sr-only">
          {describeIssueCount(issues.length)}
        </p>
        <div>
          {issues.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                Słaby kontrast - tekst może być trudny do odczytania
              </p>
              <ul className="mt-1 list-disc pl-10 text-muted-foreground">
                {issues.map((issue) => (
                  <li key={issue.label}>
                    {issue.label}: {formatRatio(issue.ratio)}:1 (zalecane co najmniej {formatRatio(MIN_CONTRAST)}:1)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <FormFooter error={errors.root?.message} saved={saved} submitting={isSubmitting} label="Zapisz motyw" />
      </div>

      <div
        data-theme={current.key}
        style={themeStyle(current)}
        className="h-fit rounded-xl border bg-background p-4 text-foreground shadow-sm lg:sticky lg:top-4"
        aria-hidden="true"
      >
        {preview}
      </div>
    </form>
  )
}
