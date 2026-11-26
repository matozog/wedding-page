import { Button } from '@/components/ui/button'

// Treści podglądu w ThemeSettings (kolory daje otaczający fragment z data-theme).

export function EventThemePreview({ eventName }: { eventName: string }) {
  return (
    <>
      <p className="font-serif text-xs uppercase tracking-[0.3em] text-primary">Podgląd</p>
      <p className="mt-1 font-serif text-2xl">{eventName}</p>
      <div className="mt-3 rounded-lg border bg-card p-3">
        <p className="text-sm font-medium">Plan wydarzenia</p>
        <p className="text-xs text-muted-foreground">15:00 · Powitanie gości</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" tabIndex={-1}>
          Dodaj zdjęcia
        </Button>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">Galeria</span>
        <span className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">Akcent</span>
      </div>
    </>
  )
}

// Ekran wpisywania kodu w miniaturze.
export function StartThemePreview() {
  return (
    <div className="bg-gradient-to-b from-background via-background to-secondary -m-4 rounded-xl p-4">
      <p className="text-center font-serif text-xs uppercase tracking-[0.3em] text-primary">Krok 1 z 2</p>
      <p className="mt-1 text-center font-serif text-3xl">Witaj</p>
      <p className="mt-1 text-center text-xs text-muted-foreground">Wpisz kod dostępu, aby wejść na stronę wydarzenia.</p>
      <div className="mt-3 rounded-lg border bg-card p-3">
        <p className="text-xs font-medium">Kod dostępu</p>
        <div className="mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-center text-xs uppercase tracking-widest text-muted-foreground">
          np. WESELE2026
        </div>
        <Button type="button" size="sm" className="mt-3 w-full" tabIndex={-1}>
          Wejdź na stronę
        </Button>
      </div>
    </div>
  )
}
