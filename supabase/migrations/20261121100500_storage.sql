-- =============================================================================
-- Storage: private "photos" bucket + policies.
-- Object path: {event_id}/{user_id}/originals/{file}
--              {event_id}/{user_id}/thumbnails/{file}
-- Limits mirror src/lib/constants.ts (MAX_PHOTO_SIZE_BYTES,
-- ALLOWED_PHOTO_MIME_TYPES).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  20 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Event members can view photo files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'photos'
  and public.is_event_member(public.storage_path_event_id(name))
);

create policy "Event members can upload into their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and public.storage_path_owner(name) = (select auth.uid())::text
  and public.is_event_member(public.storage_path_event_id(name))
);

create policy "Authors, editors and admins can delete photo files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
  and (
    public.storage_path_owner(name) = (select auth.uid())::text
    or public.has_event_role(
         public.storage_path_event_id(name),
         array['ADMIN', 'EDITOR']::public.event_role[]
       )
  )
);
