import { Check, Loader2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { THEMES, type ThemeKey } from '@/config/themes'
import { setEventTheme } from '@/lib/eventPageApi'
import { cn } from '@/lib/utils'

type ThemeSettingsProps = {
  eventId: string
  eventName: string
  theme: ThemeKey
  onSaved: (theme: ThemeKey) => void
}

// Zapis po chwili bez zmian - przejście strzałkami przez listę to jeden zapis.
const SAVE_DELAY_MS = 600

const GROUPS = [
  { tone: 'light', label: 'Jasne' },
  { tone: 'dark', label: 'Ciemne' },
] as const

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

// Wybór palety i podgląd wybranej. Radio nie jest wyłączane w trakcie
// zapisu, więc fokus klawiatury zostaje na miejscu.
export function ThemeSettings({ eventId, eventName, theme, onSaved }: ThemeSettingsProps) {
  const id = useId()
  const [selected, setSelected] = useState<ThemeKey>(theme)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<ThemeKey | null>(null)
  const savedRef = useRef(theme)
  const onSavedRef = useRef(onSaved)

  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  // Wybór czekający na zapis nie przepada przy wyjściu ze strony.
  useEffect(
    () => () => {
      const pending = pendingRef.current
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (pending && pending !== savedRef.current) {
        setEventTheme(eventId, pending)
          .then(() => onSavedRef.current(pending))
          .catch((err) => console.error('Theme save error:', err))
      }
    },
    [eventId]
  )

  const save = async (key: ThemeKey) => {
    if (key === savedRef.current) return
    setSaving(true)
    setError(null)

    try {
      await setEventTheme(eventId, key)
      savedRef.current = key
      onSavedRef.current(key)
    } catch (err) {
      console.error(err)
      setError(describeSaveError(err, 'Nie udało się zmienić motywu.'))
      setSelected(savedRef.current)
    } finally {
      setSaving(false)
    }
  }

  const choose = (key: ThemeKey) => {
    setSelected(key)
    pendingRef.current = key
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      pendingRef.current = null
      void save(key)
    }, SAVE_DELAY_MS)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => (
          <fieldset key={group.tone}>
            <legend className="mb-2 text-sm font-medium text-foreground">{group.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {THEMES.filter((option) => option.tone === group.tone).map((option) => {
                const checked = option.key === selected

                return (
                  <label
                    key={option.key}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/50',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      checked && 'border-primary bg-primary/5'
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-theme`}
                      value={option.key}
                      checked={checked}
                      onChange={() => choose(option.key)}
                      className="sr-only"
                    />
                    <ThemeSwatches theme={option.key} />
                    <span className="flex-1 text-sm font-medium text-foreground">{option.label}</span>
                    {checked && <Check className="size-4 text-primary" aria-hidden="true" />}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}

        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Zapisywanie motywu…' : ''}
        </p>
        {error && (
          <div role="alert">
            <ErrorMessage message={error} />
          </div>
        )}
      </div>

      <div
        data-theme={selected}
        className="h-fit rounded-xl border bg-background p-4 text-foreground shadow-sm"
        aria-hidden="true"
      >
        <p className="font-serif text-xs uppercase tracking-[0.3em] text-primary">Podgląd</p>
        <p className="mt-1 font-serif text-2xl">{eventName}</p>
        <div className="mt-3 rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">Plan wydarzenia</p>
          <p className="text-xs text-muted-foreground">15:00 · Powitanie gości</p>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" tabIndex={-1}>
            Dodaj zdjęcia
          </Button>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">Galeria</span>
        </div>
      </div>
    </div>
  )
}
