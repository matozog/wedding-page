-- =============================================================================
-- Super admin: managing all events from the "Wydarzenia" panel.
--
-- The super admin is profiles.is_platform_admin (global, set manually in SQL,
-- never through the API). Access helpers already treat that flag as ADMIN in
-- every event, so RLS on guests / expenses / photos / storage needs no change.
-- This migration adds the event-level operations:
--
--   * list_events_admin()           - all events with member/guest/photo counts
--   * create_event()                - the creator no longer becomes a member
--                                     (the super admin has access anyway; the
--                                     event's ADMIN is assigned from its member
--                                     list with set_member_role)
--   * update_event()                - name and start time
--   * set_event_access_code()       - new code (the old one is only a hash)
--   * delete_event()                - removes the event with everything in it;
--                                     storage files are removed by the client
--                                     through the Storage API first (direct
--                                     DELETE on storage.objects is blocked)
--   * list_event_members_admin()    - members with e-mail, for picking the
--                                     event's ADMIN
--
-- SECURITY DEFINER where the caller would otherwise lack access: the access
-- code uniqueness check reads every events.access_code_hash and e-mails are
-- not readable by clients. Every such function checks is_platform_admin()
-- first.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal helpers (not exposed to clients).
-- -----------------------------------------------------------------------------
create function public.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Brak uprawnień do zarządzania wydarzeniami.' using errcode = 'PT403';
  end if;
end;
$$;

-- Validated, trimmed event name.
create function public.require_event_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Nazwa wydarzenia musi mieć od 1 do 120 znaków.' using errcode = 'PT400';
  end if;

  return v_name;
end;
$$;

-- Normalized access code, valid and not used by another event.
-- p_except_event_id: the event whose code is being changed.
create function public.require_free_access_code(p_access_code text, p_except_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := public.normalize_access_code(p_access_code);
begin
  if char_length(v_code) not between 6 and 64 then
    raise exception 'Kod dostępu musi mieć od 6 do 64 znaków.' using errcode = 'PT400';
  end if;

  if exists (
    select 1
    from public.events e
    where e.id is distinct from p_except_event_id
      and extensions.crypt(v_code, e.access_code_hash) = e.access_code_hash
  ) then
    raise exception 'Ten kod dostępu jest już używany.' using errcode = 'PT409';
  end if;

  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- list_events_admin - every event, newest start first (events without a date
-- last). SECURITY INVOKER: RLS already lets the platform admin read all rows;
-- the explicit check turns "empty list" into a clear error for anyone else.
-- -----------------------------------------------------------------------------
create function public.list_events_admin()
returns table (
  id           uuid,
  name         text,
  starts_at    timestamptz,
  created_at   timestamptz,
  member_count integer,
  guest_count  integer,
  photo_count  integer
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Brak uprawnień do zarządzania wydarzeniami.' using errcode = 'PT403';
  end if;

  return query
  select
    e.id,
    e.name,
    e.starts_at,
    e.created_at,
    (select count(*)::integer from public.event_members m where m.event_id = e.id),
    (select count(*)::integer from public.guests g where g.event_id = e.id),
    (select count(*)::integer from public.photos p where p.event_id = e.id)
  from public.events e
  order by e.starts_at desc nulls last, e.created_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_event - platform admin only; no membership for the creator anymore.
-- -----------------------------------------------------------------------------
create or replace function public.create_event(
  p_name        text,
  p_access_code text,
  p_starts_at   timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text;
  v_code     text;
  v_event_id uuid;
begin
  perform public.require_platform_admin();

  v_name := public.require_event_name(p_name);
  v_code := public.require_free_access_code(p_access_code, null);

  insert into public.events (name, starts_at, access_code_hash, created_by)
  values (v_name, p_starts_at, extensions.crypt(v_code, extensions.gen_salt('bf')), auth.uid())
  returning id into v_event_id;

  return v_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- update_event - name and start time (null clears the date).
-- -----------------------------------------------------------------------------
create function public.update_event(
  p_event_id  uuid,
  p_name      text,
  p_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform public.require_platform_admin();

  v_name := public.require_event_name(p_name);

  update public.events e
  set name = v_name,
      starts_at = p_starts_at
  where e.id = p_event_id;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_event_access_code - replaces the code. Members keep their membership;
-- only new guests need the new code.
-- -----------------------------------------------------------------------------
create function public.set_event_access_code(p_event_id uuid, p_access_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform public.require_platform_admin();

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;

  v_code := public.require_free_access_code(p_access_code, p_event_id);

  update public.events e
  set access_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf'))
  where e.id = p_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- delete_event - the event and everything referencing it (members, guests,
-- groups, tables, budget, photo rows) go by ON DELETE CASCADE.
-- -----------------------------------------------------------------------------
create function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  delete from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- list_event_members_admin - members of one event with e-mail (Google
-- accounts), so the super admin can tell who to make the event's ADMIN.
-- -----------------------------------------------------------------------------
create function public.list_event_members_admin(p_event_id uuid)
returns table (
  user_id      uuid,
  display_name text,
  email        text,
  is_anonymous boolean,
  role         public.event_role,
  joined_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  return query
  select m.user_id, p.display_name, p.email, p.is_anonymous, m.role, m.joined_at
  from public.event_members m
  join public.profiles p on p.id = m.user_id
  where m.event_id = p_event_id
  order by
    case m.role when 'ADMIN' then 0 when 'EDITOR' then 1 else 2 end,
    p.display_name nulls last,
    m.joined_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.require_platform_admin()                       from public, anon, authenticated;
revoke execute on function public.require_event_name(text)                       from public, anon, authenticated;
revoke execute on function public.require_free_access_code(text, uuid)           from public, anon, authenticated;
revoke execute on function public.list_events_admin()                            from public, anon;
revoke execute on function public.update_event(uuid, text, timestamptz)          from public, anon;
revoke execute on function public.set_event_access_code(uuid, text)              from public, anon;
revoke execute on function public.delete_event(uuid)                             from public, anon;
revoke execute on function public.list_event_members_admin(uuid)                 from public, anon;

grant execute on function public.list_events_admin()                   to authenticated;
grant execute on function public.update_event(uuid, text, timestamptz) to authenticated;
grant execute on function public.set_event_access_code(uuid, text)     to authenticated;
grant execute on function public.delete_event(uuid)                    to authenticated;
grant execute on function public.list_event_members_admin(uuid)        to authenticated;
