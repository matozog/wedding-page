import { Heart } from 'lucide-react'
import { PhotoCarousel } from '@/components/PhotoCarousel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SECTION_IDS } from '@/config/navigation'
import { usePagePhotoUrls } from '@/hooks/usePagePhotoUrls'
import { cn } from '@/lib/utils'
import type { AboutFact, PagePhoto, SectionConfig } from '@/types/eventPage'
import { SectionHeading } from './SectionHeading'

type AboutCoupleSectionProps = {
  config: SectionConfig
  facts: readonly AboutFact[]
  photos: readonly PagePhoto[]
}

// "O nas" - nagłówek karty, historia, krótkie informacje i karuzela zdjęć
// z konfiguracji wydarzenia.
export function AboutCoupleSection({ config, facts, photos }: AboutCoupleSectionProps) {
  const photoUrls = usePagePhotoUrls(photos)
  const hasCard = Boolean(config.content_title || config.content_body || facts.length > 0 || photoUrls.length > 0)

  return (
    <section id={SECTION_IDS.couple} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading {...config} />

      {hasCard && (
        <Card className="overflow-hidden border-border/80 bg-card/80">
          {config.content_title && (
            <CardHeader className="border-b border-border/60 bg-secondary/30 pb-6 text-center">
              <CardTitle className="text-3xl md:text-4xl">{config.content_title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className="space-y-6 pt-8">
            {photoUrls.length > 0 && (
              <PhotoCarousel
                photos={photoUrls.map((photo, index) => ({
                  id: photo.id,
                  src: photo.src,
                  alt: photo.alt_text ?? `Zdjęcie ${index + 1}`,
                }))}
              />
            )}

            {config.content_body && (
              <p className="mx-auto max-w-2xl whitespace-pre-line text-center leading-relaxed text-muted-foreground">
                {config.content_body}
              </p>
            )}

            {facts.length > 0 && (
              <>
                <Separator />
                <dl className={cn('grid gap-4', facts.length > 1 && 'sm:grid-cols-2')}>
                  {facts.map((fact, index) => (
                    <div key={index} className="rounded-lg bg-background/70 p-4">
                      <dt className="font-medium text-foreground">{fact.label}</dt>
                      <dd className="text-sm text-muted-foreground">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            <div className="flex justify-center pt-2">
              <Heart className="size-5 text-primary/70" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
