import { useEffect, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

export type CarouselPhoto = {
  id: string
  src: string
  alt: string
}

// Karuzela zdjęć (sekcja "O nas"). Adresy podaje wywołujący.
export function PhotoCarousel({ photos }: { photos: readonly CarouselPhoto[] }) {
  const [api, setApi] = useState<CarouselApi>()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!api) return

    setActiveIndex(api.selectedScrollSnap())
    api.on('select', () => setActiveIndex(api.selectedScrollSnap()))
  }, [api])

  if (photos.length === 0) {
    return null
  }

  return (
    <Carousel setApi={setApi} opts={{ align: 'start', loop: true }} className="px-8">
      <CarouselContent>
        {photos.map((photo) => (
          <CarouselItem key={photo.id} className="basis-4/5 sm:basis-1/2 lg:basis-1/3">
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-lg border border-border/60 object-cover shadow-sm"
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious />
      <CarouselNext />

      <div className="mt-3 flex justify-center gap-1.5">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Przejdź do zdjęcia ${index + 1}`}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              'size-1.5 rounded-full transition-colors',
              index === activeIndex ? 'bg-primary' : 'bg-border'
            )}
          />
        ))}
      </div>
    </Carousel>
  )
}
