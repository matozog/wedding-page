import { Mail, Phone } from 'lucide-react'
import { weddingContent } from '@/config/weddingContent'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ContactSection() {
  const { contact } = weddingContent

  return (
    <section id="kontakt" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-10 text-center">
        <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">Kontakt</p>
        <h2 className="mt-2 font-serif text-4xl text-foreground">Masz pytania?</h2>
      </div>

      <Card className="mx-auto max-w-2xl border-border/80 bg-card/80">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Skontaktuj się z nami</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">{contact.note}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <Mail className="size-5 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium text-foreground">{contact.email}</p>
              </div>
            </a>

            <a
              href={`tel:${contact.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <Phone className="size-5 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Telefon</p>
                <p className="text-sm font-medium text-foreground">{contact.phone}</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
