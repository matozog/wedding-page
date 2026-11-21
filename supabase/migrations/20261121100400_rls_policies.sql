-- =============================================================================
-- Row Level Security policies.
-- Writes other than photos go through RPC functions (see *_rpc.sql).
-- =============================================================================

-- profiles: own profile, people from the same events, everyone for platform admin.
create policy "Profiles visible to self, co-members and platform admins"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.shares_event_with(id)
  or public.is_platform_admin()
);

-- events: members only.
create policy "Events visible to members"
on public.events
for select
to authenticated
using (public.is_event_member(id));

-- event_members: members see the member list of their events.
create policy "Members visible to members of the same event"
on public.event_members
for select
to authenticated
using (public.is_event_member(event_id));

-- photos ----------------------------------------------------------------------
create policy "Photos visible to event members"
on public.photos
for select
to authenticated
using (public.is_event_member(event_id));

-- Members add photos as themselves, into their own folder of the event.
create policy "Members can add their own photos"
on public.photos
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.is_event_member(event_id)
  and storage_path like event_id::text || '/' || auth.uid()::text || '/%'
  and (
    thumbnail_storage_path is null
    or thumbnail_storage_path like event_id::text || '/' || auth.uid()::text || '/%'
  )
);

-- Authors delete their own photos, EDITOR/ADMIN any photo in their event.
create policy "Authors, editors and admins can delete photos"
on public.photos
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  or public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[])
);

-- profiles, events, event_members, join_attempts: no INSERT/UPDATE/DELETE
-- policies on purpose - RLS denies those operations for clients.
