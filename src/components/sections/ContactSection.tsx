import { Mail, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SECTION_IDS } from '@/config/navigation'
import { cn } from '@/lib/utils'
import type { EventContact, SectionHeader } from '@/types/eventPage'
import { SectionHeading } from './SectionHeading'

type ContactSectionProps = {
  header: SectionHeader
  contacts: readonly EventContact[]
}

const linkClassName =
  'flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Kontakt - osoby z konfiguracji wydarzenia (etykieta, imię, e-mail, telefon).
export function ContactSection({ header, contacts }: ContactSectionProps) {
  return (
    <section id={SECTION_IDS.contact} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading {...header} />

      <div className={cn('mx-auto grid max-w-4xl gap-4', contacts.length > 1 && 'md:grid-cols-2')}>
        {contacts.map((contact, index) => (
          <Card key={index} className="border-border/80 bg-card/80">
            <CardContent className="space-y-3 pt-6">
              {(contact.label || contact.name) && (
                <div className="text-center">
                  {contact.label && (
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{contact.label}</p>
                  )}
                  {contact.name && <p className="font-serif text-2xl text-foreground">{contact.name}</p>}
                </div>
              )}

              {contact.email && (
                <a href={`mailto:${contact.email}`} className={linkClassName}>
                  <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">E-mail</p>
                    <p className="truncate text-sm font-medium text-foreground">{contact.email}</p>
                  </div>
                </a>
              )}

              {contact.phone && (
                <a href={`tel:${contact.phone.replace(/[\s()-]/g, '')}`} className={linkClassName}>
                  <Phone className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Telefon</p>
                    <p className="text-sm font-medium text-foreground">{contact.phone}</p>
                  </div>
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
