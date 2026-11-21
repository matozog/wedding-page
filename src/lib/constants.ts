export const PHOTOS_BUCKET = 'photos' as const

export const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number]

// Rozszerzenie pliku w Storage wynika z typu MIME, nie z nazwy pliku.
export const PHOTO_FILE_EXTENSIONS: Record<AllowedPhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

// HEIC nie jest wymieniony celowo - iOS Safari konwertuje wtedy zdjęcia
// do JPEG przy wyborze pliku. HEIC wgrany inną drogą nadal jest akceptowany.
export const PHOTO_INPUT_ACCEPT = 'image/jpeg,image/png,image/webp'

export const SESSION_STORAGE_KEY = 'wedding-page:session:v2' as const

export const PENDING_GOOGLE_CODE_KEY = 'wedding-page:pending-google-code' as const

export const SIGNED_URL_EXPIRY_SECONDS = 60 * 60

export const THUMBNAIL_TRANSFORM = {
  width: 600,
  height: 600,
  resize: 'contain' as const,
  quality: 75,
}

export const FULLSIZE_TRANSFORM = {
  width: 2000,
  height: 2000,
  resize: 'contain' as const,
  quality: 85,
}

export const PHOTO_SELECT_FIELDS = `
  id,
  uploaded_by,
  storage_path,
  thumbnail_storage_path,
  original_filename,
  mime_type,
  size_bytes,
  created_at
`
