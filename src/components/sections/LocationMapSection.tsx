import { MapPin } from 'lucide-react'
import { weddingContent } from '@/config/weddingContent'

export function LocationMapSection() {
  const { ceremony, reception } = weddingContent.locations

  const places = [ceremony, reception]

  return (
    <section id="mapa" className="border-t border-border/60 px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">
            Jak dojechać
          </p>
          <h2 className="mt-2 font-serif text-4xl text-foreground">Ceremonia i wesele</h2>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <a
              key={place.name}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                place.address
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/80 p-4 shadow-md transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">{place.name}</p>
                <p className="text-sm text-muted-foreground">{place.address}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <div
              key={place.name}
              className="overflow-hidden rounded-xl border border-border/70 shadow-md"
            >
              <iframe
                title={`Mapa: ${place.name}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  place.address
                )}&output=embed`}
                className="aspect-square w-full sm:aspect-[4/3]"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
