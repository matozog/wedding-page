-- =============================================================================
-- Guest management panel.
--
--   * guests.attendance replaces guests.rsvp_status - one field for the
--     organisers' estimate, CONFIRMED / DECLINED mean the guest answered.
--   * Address on the household (guest_groups) with an optional per-guest
--     override (a guest without a group, an adult child living elsewhere).
--   * guest_groups.side - default "whose guest" for new group members (UI).
--   * Length limits on the free-text fields the panel edits.
--   * Access: only the event ADMIN changes the guest list, EDITOR reads it.
--     (When a seating UI for editors arrives, it needs its own way to write
--     guests.table_id / seat_number.)
--   * delete_guest_group() - removes a group, optionally with its members, in
--     one transaction.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- attendance
-- -----------------------------------------------------------------------------
create type public.attendance_likelihood as enum (
  'UNKNOWN',    -- nieustalone
  'CONFIRMED',  -- pewna obecność
  'LIKELY',     -- całkiem możliwe
  'UNLIKELY',   -- raczej nie
  'DECLINED'    -- na pewno nie
);

alter table public.guests
  add column attendance public.attendance_likelihood not null default 'UNKNOWN';

update public.guests
set attendance = case rsvp_status
                   when 'ATTENDING' then 'CONFIRMED'
                   when 'DECLINED'  then 'DECLINED'
                   else 'UNKNOWN'
                 end::public.attendance_likelihood;

alter table public.guests drop column rsvp_status;
drop type public.rsvp_status;

-- -----------------------------------------------------------------------------
-- address, group side, text limits
-- -----------------------------------------------------------------------------
alter table public.guest_groups
  add column address text
    constraint guest_groups_address_length check (address is null or char_length(address) <= 300),
  add column side public.guest_side;

alter table public.guest_groups
  add constraint guest_groups_notes_length check (notes is null or char_length(notes) <= 2000);

alter table public.guests
  add column address text
    constraint guests_address_length check (address is null or char_length(address) <= 300);

alter table public.guests
  add constraint guests_first_name_length check (first_name is null or char_length(first_name) <= 80),
  add constraint guests_last_name_length  check (last_name  is null or char_length(last_name)  <= 80),
  add constraint guests_phone_length      check (phone      is null or char_length(phone)      <= 40),
  add constraint guests_email_length      check (email      is null or char_length(email)      <= 254),
  add constraint guests_notes_length      check (notes      is null or char_length(notes)      <= 2000);

-- -----------------------------------------------------------------------------
-- RLS: ADMIN manages, EDITOR reads
-- -----------------------------------------------------------------------------
drop policy "Editors and admins manage guest groups" on public.guest_groups;
drop policy "Editors and admins manage guests"       on public.guests;

create policy "Editors and admins can view guest groups"
on public.guest_groups
for select
to authenticated
using (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Admins can add guest groups"
on public.guest_groups
for insert
to authenticated
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Admins can update guest groups"
on public.guest_groups
for update
to authenticated
using      (public.has_event_role(event_id, array['ADMIN']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Admins can delete guest groups"
on public.guest_groups
for delete
to authenticated
using (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Editors and admins can view guests"
on public.guests
for select
to authenticated
using (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Admins can add guests"
on public.guests
for insert
to authenticated
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Admins can update guests"
on public.guests
for update
to authenticated
using      (public.has_event_role(event_id, array['ADMIN']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Admins can delete guests"
on public.guests
for delete
to authenticated
using (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

-- -----------------------------------------------------------------------------
-- delete_guest_group - SECURITY INVOKER: the caller's RLS applies, the
-- function only makes "group + members" a single transaction.
-- Returns the number of deleted guests. Raises PT404 when the group is not
-- visible to the caller or was not deleted (no permission).
-- -----------------------------------------------------------------------------
create function public.delete_guest_group(p_group_id uuid, p_delete_guests boolean default false)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_deleted  integer := 0;
begin
  select g.event_id
  into v_event_id
  from public.guest_groups g
  where g.id = p_group_id;

  if v_event_id is null then
    raise exception 'Nie znaleziono grupy.' using errcode = 'PT404';
  end if;

  if p_delete_guests then
    delete from public.guests gu
    where gu.event_id = v_event_id
      and gu.group_id = p_group_id;

    get diagnostics v_deleted = row_count;
  end if;

  delete from public.guest_groups g
  where g.id = p_group_id;

  if not found then
    raise exception 'Nie udało się usunąć grupy.' using errcode = 'PT404';
  end if;

  return v_deleted;
end;
$$;

revoke execute on function public.delete_guest_group(uuid, boolean) from public, anon;
grant  execute on function public.delete_guest_group(uuid, boolean) to authenticated;
