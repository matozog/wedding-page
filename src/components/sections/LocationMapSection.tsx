import { MapPin } from 'lucide-react'
import { SECTION_IDS } from '@/config/navigation'
import { cn } from '@/lib/utils'
import type { EventLocation, SectionHeader } from '@/types/eventPage'
import { SectionHeading } from './SectionHeading'

type LocationMapSectionProps = {
  header: SectionHeader
  locations: readonly EventLocation[]
}

const mapsSearchUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

const mapsEmbedUrl = (address: string) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`

// Jak dojechać - adresy z konfiguracji wydarzenia, mapa dla adresów
// z włączonym "pokaż na mapie".
export function LocationMapSection({ header, locations }: LocationMapSectionProps) {
  const mapped = locations.filter((place) => place.show_map)
  const twoColumns = (list: readonly unknown[]) => list.length > 1 && 'sm:grid-cols-2'

  return (
    <section id={SECTION_IDS.location} className="border-t border-border/60 px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading {...header} />

        <div className={cn('mb-6 grid gap-4', twoColumns(locations))}>
          {locations.map((place, index) => (
            <a
              key={index}
              href={mapsSearchUrl(place.address)}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/80 p-4 shadow-md transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                {place.label && (
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{place.label}</p>
                )}
                <p className="font-medium text-foreground">{place.name}</p>
                <p className="text-sm text-muted-foreground">{place.address}</p>
                <span className="sr-only"> (otwiera Mapy Google w nowej karcie)</span>
              </div>
            </a>
          ))}
        </div>

        {mapped.length > 0 && (
          <div className={cn('grid gap-4', twoColumns(mapped))}>
            {mapped.map((place, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-border/70 shadow-md">
                <iframe
                  title={`Mapa: ${place.name}`}
                  src={mapsEmbedUrl(place.address)}
                  className="aspect-square w-full sm:aspect-[4/3]"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
