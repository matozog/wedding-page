import Lightbox from 'yet-another-react-lightbox'
import { useCallback, useEffect, useState } from 'react'
import { createFullSizePhotoUrl } from '@/lib/photoStorage'
import type { Photo } from '@/types/photo'
import { cn } from '@/lib/utils'

type PhotoGalleryProps = {
  photos: Photo[]
  loading: boolean
  getPhotoUrl: (path: string) => Promise<string | null>
}

type GallerySlide = {
  src: string
  alt: string
  fullPath: string
}

export function PhotoGallery({ photos, loading, getPhotoUrl }: PhotoGalleryProps) {
  const [slides, setSlides] = useState<GallerySlide[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  console.log(slides)
  useEffect(() => {
    let cancelled = false

    const loadThumbnails = async () => {
      const loaded = await Promise.all(
        photos.map(async (photo) => {
          const src = await getPhotoUrl(photo.thumbnail_storage_path)
          return {
            src: src ?? '',
            alt: photo.original_filename,
            fullPath: photo.storage_path,
          }
        })
      )

      if (!cancelled) {
        setSlides(loaded.filter((slide) => slide.src))
      }
    }

    if (photos.length > 0) {
      loadThumbnails()
    } else {
      setSlides([])
    }

    return () => {
      cancelled = true
    }
  }, [photos, getPhotoUrl])

  const openLightbox = useCallback(
    async (index: number) => {
      setLightboxIndex(index)

      const photo = photos[index]
      if (!photo) {
        return
      }

      const fullUrl = await createFullSizePhotoUrl(photo.storage_path)

      if (fullUrl) {
        setSlides((current) =>
          current.map((slide, i) => (i === index ? { ...slide, src: fullUrl } : slide))
        )
      }
    },
    [photos]
  )

  return (
    <section
      id="galeria"
      className="w-full border-y border-border/60 bg-secondary/50 py-8 shadow-inner sm:py-10"
    >
      <div className="mb-8 px-4 text-center sm:px-6">
        <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">Wspomnienia</p>
        <h2 className="mt-2 font-serif text-4xl text-foreground">Galeria zdjęć</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Kliknij zdjęcie, aby je powiększyć. Dodawaj własne kadry przyciskiem w nagłówku.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground">Ładowanie zdjęć…</p>
        </div>
      )}

      {!loading && slides.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
          <p className="font-serif text-2xl text-foreground">Galeria jest pusta</p>
          <p className="text-sm text-muted-foreground">
            Bądź pierwszą osobą, która doda zdjęcie z wesela!
          </p>
        </div>
      )}

      {!loading && slides.length > 0 && (
        <div className="columns-2 gap-1 px-1 sm:columns-3 sm:px-2 md:columns-4 lg:columns-5 xl:columns-6">
          {slides.map((slide, index) => (
            <button
              key={photos[index]?.id ?? index}
              type="button"
              onClick={() => openLightbox(index)}
              className={cn(
                'group mb-1 block w-full break-inside-avoid overflow-hidden rounded-sm shadow-sm transition-shadow',
                'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={slides.map(({ src, alt }) => ({ src, alt }))}
      />
    </section>
  )
}
