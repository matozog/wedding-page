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

const photoModules = import.meta.glob('../assets/couple/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const photos = Object.keys(photoModules)
  .sort()
  .map((path) => photoModules[path])

export function PhotoCarousel() {
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
        {photos.map((src, index) => (
          <CarouselItem key={src} className="basis-4/5 sm:basis-1/2 lg:basis-1/3">
            <img
              src={src}
              alt={`Para młoda - zdjęcie ${index + 1}`}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-lg border border-border/60 object-cover shadow-sm"
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious />
      <CarouselNext />

      <div className="mt-3 flex justify-center gap-1.5">
        {photos.map((src, index) => (
          <button
            key={src}
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
