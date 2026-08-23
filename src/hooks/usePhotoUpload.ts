import { useCallback, useState } from 'react'
import { uploadPhotoWithThumbnail } from '../lib/photosApi'
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_SIZE_BYTES } from '../lib/constants'

const MAX_PHOTO_SIZE_MB = Math.round(MAX_PHOTO_SIZE_BYTES / (1024 * 1024))

const validateFile = (file: File): string | null => {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
    return `${file.name}: nieobsługiwany format pliku.`
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return `${file.name}: plik jest większy niż ${MAX_PHOTO_SIZE_MB} MB.`
  }

  return null
}

type UsePhotoUploadOptions = {
  eventId: string | null
  guestSessionId: string | null
  onComplete?: () => Promise<void> | void
  onError?: (message: string) => void
}

export function usePhotoUpload({
  eventId,
  guestSessionId,
  onComplete,
  onError,
}: UsePhotoUploadOptions) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadPhotos = useCallback(
    async (files: File[]) => {
      if (!eventId || !guestSessionId) {
        onError?.('Brak sesji użytkownika.')
        return
      }

      const validationError = files.map(validateFile).find(Boolean)
      if (validationError) {
        onError?.(validationError)
        return
      }

      setUploading(true)
      setProgress(0)

      for (const [index, file] of files.entries()) {
        try {
          await uploadPhotoWithThumbnail(eventId, guestSessionId, file)

          setProgress(Math.round(((index + 1) / files.length) * 100))
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err)
          setUploading(false)
          onError?.(`Nie udało się wysłać ${file.name}`)
          return
        }
      }

      setProgress(100)
      setUploading(false)
      await onComplete?.()
    },
    [eventId, guestSessionId, onComplete, onError]
  )

  return {
    uploading,
    progress,
    uploadPhotos,
  }
}
