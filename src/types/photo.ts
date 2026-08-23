export type Photo = {
  id: string
  storage_path: string
  thumbnail_storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export type PhotoInsert = {
  event_id: string
  guest_session_id: string
  storage_path: string
  thumbnail_storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number
}
