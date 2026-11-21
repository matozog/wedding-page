import type { Database } from './database'

type PhotoRow = Database['public']['Tables']['photos']['Row']

export type Photo = Pick<
  PhotoRow,
  | 'id'
  | 'uploaded_by'
  | 'storage_path'
  | 'thumbnail_storage_path'
  | 'original_filename'
  | 'mime_type'
  | 'size_bytes'
  | 'created_at'
>

// uploaded_by uzupełnia baza (domyślnie auth.uid()).
export type PhotoInsert = Omit<
  Database['public']['Tables']['photos']['Insert'],
  'id' | 'uploaded_by' | 'created_at'
>
