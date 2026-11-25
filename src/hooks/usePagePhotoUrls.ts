import { useEffect, useState } from 'react'
import { createSignedPhotoUrl } from '../lib/photoStorage'
import { FULLSIZE_TRANSFORM, THUMBNAIL_TRANSFORM } from '../lib/constants'
import type { PagePhoto } from '../types/eventPage'

export type PagePhotoUrl = PagePhoto & { src: string }

// Podpisane adresy zdjęć sekcji (prywatny bucket). Zdjęcie, którego adresu
// nie udało się utworzyć, jest pomijane. photos musi być stabilną tablicą
// (stan albo useMemo) - nowa tablica to nowe adresy.
export function usePagePhotoUrls(photos: readonly PagePhoto[], size: 'thumbnail' | 'full' = 'full') {
  const [urls, setUrls] = useState<PagePhotoUrl[]>([])
  useEffect(() => {
    let cancelled = false
    const transform = size === 'full' ? FULLSIZE_TRANSFORM : THUMBNAIL_TRANSFORM

    Promise.all(photos.map(async (photo) => ({ ...photo, src: await createSignedPhotoUrl(photo.storage_path, transform) })))
      .then((rows) => {
        if (!cancelled) {
          setUrls(rows.filter((row): row is PagePhotoUrl => row.src !== null))
        }
      })
      .catch((err) => console.error('Page photo URL error:', err))

    return () => {
      cancelled = true
    }
  }, [photos, size])

  return urls
}
