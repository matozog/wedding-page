import { supabase } from './supabase'
import {
  FULLSIZE_TRANSFORM,
  PHOTOS_BUCKET,
  SIGNED_URL_EXPIRY_SECONDS,
  THUMBNAIL_TRANSFORM,
} from './constants'

type ImageTransform = {
  width: number
  height: number
  resize: 'contain'
  quality: number
}

export const createSignedPhotoUrl = async (
  storagePath: string,
  transform: ImageTransform = THUMBNAIL_TRANSFORM
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS, { transform })

  if (error) {
    console.error('Signed URL error:', error)
    return null
  }

  return data.signedUrl
}

export const createFullSizePhotoUrl = (storagePath: string) =>
  createSignedPhotoUrl(storagePath, FULLSIZE_TRANSFORM)

export const uploadPhotoFile = async (
  path: string,
  file: File | Blob,
  contentType?: string
) => {
  const options = contentType ? { contentType } : undefined

  return supabase.storage.from(PHOTOS_BUCKET).upload(path, file, options)
}
