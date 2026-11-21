import type { Photo, PhotoInsert } from '../types/photo'
import {
  PHOTOS_BUCKET,
  PHOTO_FILE_EXTENSIONS,
  PHOTO_SELECT_FIELDS,
  type AllowedPhotoMimeType,
} from './constants'
import { createThumbnail } from './createThumbnail'
import { uploadPhotoFile } from './photoStorage'
import { supabase } from './supabase'

export const fetchPhotosByEventId = async (eventId: string): Promise<Photo[]> => {
  const { data, error } = await supabase
    .from('photos')
    .select(PHOTO_SELECT_FIELDS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export const insertPhoto = async (photo: PhotoInsert) => {
  return supabase.from('photos').insert(photo)
}

const isHeic = (mimeType: string) => mimeType === 'image/heic' || mimeType === 'image/heif'

// Sprzątanie po nieudanym kroku - błąd tylko logujemy, żeby nie przykryć
// pierwotnej przyczyny.
const removeFilesQuietly = async (paths: string[]) => {
  if (paths.length === 0) {
    return
  }

  const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths)

  if (error) {
    console.error('Failed to remove photo files:', paths, error)
  }
}

// Przeglądarki poza Safari nie dekodują HEIC - wtedy zdjęcie idzie bez
// miniatury, a galeria pokazuje oryginał przez transformację Supabase.
const createThumbnailIfPossible = async (file: File): Promise<Blob | null> => {
  try {
    return await createThumbnail(file)
  } catch (err) {
    if (isHeic(file.type)) {
      console.warn(`Thumbnail skipped for ${file.name}:`, err)
      return null
    }

    throw err
  }
}

// Ścieżki w Storage: {event_id}/{user_id}/originals|thumbnails/{plik} -
// reguły dostępu w bazie pozwalają wgrywać tylko do własnego folderu.
// Gdy któryś krok się nie uda, wgrane już pliki są usuwane.
export const uploadPhotoWithThumbnail = async (eventId: string, userId: string, file: File) => {
  const fileId = crypto.randomUUID()
  const extension = PHOTO_FILE_EXTENSIONS[file.type as AllowedPhotoMimeType] ?? 'jpg'
  const originalPath = `${eventId}/${userId}/originals/${fileId}.${extension}`
  const thumbnailPath = `${eventId}/${userId}/thumbnails/${fileId}.jpg`

  const thumbnail = await createThumbnailIfPossible(file)
  const uploadedPaths: string[] = []

  try {
    const { error: originalError } = await uploadPhotoFile(originalPath, file)
    if (originalError) {
      throw originalError
    }
    uploadedPaths.push(originalPath)

    if (thumbnail) {
      const { error: thumbnailError } = await uploadPhotoFile(
        thumbnailPath,
        thumbnail,
        'image/jpeg'
      )
      if (thumbnailError) {
        throw thumbnailError
      }
      uploadedPaths.push(thumbnailPath)
    }

    const { error: dbError } = await insertPhoto({
      event_id: eventId,
      storage_path: originalPath,
      thumbnail_storage_path: thumbnail ? thumbnailPath : null,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })

    if (dbError) {
      throw dbError
    }
  } catch (err) {
    await removeFilesQuietly(uploadedPaths)
    throw err
  }
}

// Najpierw wiersz w bazie (RLS decyduje, czy wolno), dopiero potem pliki.
// Usunięcie przez RLS bez uprawnień nie zwraca błędu, tylko 0 wierszy -
// stąd sprawdzenie zwróconych rekordów.
export const deletePhoto = async (photo: Photo) => {
  const { data, error: dbError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photo.id)
    .select('id')

  if (dbError) {
    throw dbError
  }

  if (!data || data.length === 0) {
    throw new Error('Zdjęcie nie zostało usunięte (brak uprawnień lub już nie istnieje).')
  }

  const paths = [photo.storage_path, photo.thumbnail_storage_path].filter(
    (path): path is string => Boolean(path)
  )

  // Wpis już zniknął z galerii - osierocony plik jest mniejszym problemem
  // niż wpis bez pliku, więc błąd Storage tylko logujemy.
  await removeFilesQuietly(paths)
}
