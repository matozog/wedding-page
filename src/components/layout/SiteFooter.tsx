import { weddingContent } from '@/config/weddingContent'
import { Separator } from '@/components/ui/separator'

export function SiteFooter({ eventName }: { eventName: string }) {
  const { footer } = weddingContent
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/70 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <p className="font-serif text-lg text-foreground">{eventName}</p>
        <p className="mt-2 text-sm text-muted-foreground">{footer.message}</p>
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground">
          © {year} {eventName}. Wszystkie prawa zastrzeżone.
        </p>
      </div>
    </footer>
  )
}
