import { useCallback, useState } from 'react'
import { createSignedPhotoUrl } from '../lib/photoStorage'
import { fetchPhotosByEventId } from '../lib/photosApi'
import type { Photo } from '../types/photo'

export function usePhotos(eventId: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPhotos = useCallback(async () => {
    if (!eventId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchPhotosByEventId(eventId)
      setPhotos(data)
    } catch (err) {
      console.error('Photos error:', err)
      setError('Nie udało się pobrać zdjęć.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  const getPhotoUrl = useCallback(
    (storagePath: string) => createSignedPhotoUrl(storagePath),
    []
  )

  return {
    photos,
    loading,
    error,
    setError,
    loadPhotos,
    getPhotoUrl,
  }
}
