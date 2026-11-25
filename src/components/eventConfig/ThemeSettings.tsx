import { Check, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
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

// Próbki kolorów - fragment z data-theme dostaje zmienne CSS danej palety.
function ThemeSwatches({ theme }: { theme: ThemeKey }) {
  return (
    <span data-theme={theme} className="flex gap-1" aria-hidden="true">
      {['bg-background', 'bg-primary', 'bg-secondary', 'bg-accent'].map((className) => (
        <span key={className} className={cn('size-5 rounded-full border border-black/10', className)} />
      ))}
    </span>
  )
}

// Wybór palety (zapis od razu po wyborze) i podgląd wybranej.
export function ThemeSettings({ eventId, eventName, theme, onSaved }: ThemeSettingsProps) {
  const id = useId()
  const [saving, setSaving] = useState<ThemeKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (key: ThemeKey) => {
    if (saving || key === theme) return
    setSaving(key)
    setError(null)

    try {
      await setEventTheme(eventId, key)
      onSaved(key)
    } catch (err) {
      console.error(err)
      setError(describeSaveError(err, 'Nie udało się zmienić motywu.'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <fieldset>
        <legend className="sr-only">Motyw kolorystyczny</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEMES.map((option) => {
            const checked = option.key === theme

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
                  disabled={saving !== null}
                  onChange={() => void choose(option.key)}
                  className="sr-only"
                />
                <ThemeSwatches theme={option.key} />
                <span className="flex-1 text-sm font-medium text-foreground">{option.label}</span>
                {saving === option.key ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Zapisywanie" />
                ) : (
                  checked && <Check className="size-4 text-primary" aria-hidden="true" />
                )}
              </label>
            )
          })}
        </div>
        {error && (
          <div className="mt-3" role="alert">
            <ErrorMessage message={error} />
          </div>
        )}
      </fieldset>

      <div data-theme={theme} className="rounded-xl border bg-background p-4 text-foreground shadow-sm" aria-hidden="true">
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
