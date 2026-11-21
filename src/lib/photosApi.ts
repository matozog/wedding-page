import type { Photo, PhotoInsert } from '../types/photo'
import { PHOTOS_BUCKET, PHOTO_SELECT_FIELDS } from './constants'
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

// Ścieżki w Storage: {event_id}/{user_id}/originals|thumbnails/{plik} -
// reguły dostępu w bazie pozwalają wgrywać tylko do własnego folderu.
export const uploadPhotoWithThumbnail = async (eventId: string, userId: string, file: File) => {
  const fileId = crypto.randomUUID()
  const originalExtension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const originalPath = `${eventId}/${userId}/originals/${fileId}.${originalExtension}`
  const thumbnailPath = `${eventId}/${userId}/thumbnails/${fileId}.jpg`

  const thumbnail = await createThumbnail(file)

  const { error: originalError } = await uploadPhotoFile(originalPath, file)
  if (originalError) {
    throw originalError
  }

  const { error: thumbnailError } = await uploadPhotoFile(
    thumbnailPath,
    thumbnail,
    'image/jpeg'
  )
  if (thumbnailError) {
    throw thumbnailError
  }

  const { error: dbError } = await insertPhoto({
    event_id: eventId,
    storage_path: originalPath,
    thumbnail_storage_path: thumbnailPath,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  })

  if (dbError) {
    throw dbError
  }
}

export const deletePhoto = async (photo: Photo) => {
  const paths = [photo.storage_path, photo.thumbnail_storage_path].filter(
    (path): path is string => Boolean(path)
  )

  const { error: storageError } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths)

  if (storageError) {
    throw storageError
  }

  const { error: dbError } = await supabase.from('photos').delete().eq('id', photo.id)

  if (dbError) {
    throw dbError
  }
}
