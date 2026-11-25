import { Separator } from '@/components/ui/separator'

// Stopka: nazwa wydarzenia i podziękowanie z konfiguracji wydarzenia.
export function SiteFooter({ eventName, message }: { eventName: string; message: string | null }) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/70 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <p className="font-serif text-lg text-foreground">{eventName}</p>
        {message && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{message}</p>}
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground">
          © {year} {eventName}. Wszystkie prawa zastrzeżone.
        </p>
      </div>
    </footer>
  )
}
