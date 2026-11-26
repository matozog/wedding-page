-- =============================================================================
-- Event invite links - every member can share the event with a personal link
-- (?zaproszenie=<token>). The token stands for the event AND the member who
-- shared it, so the new member's event_members.invited_by records who invited
-- them, and the invite screen shows the inviter's name.
--
--   * event_invites               - one random token per (event, member); no
--                                   client access, only through the RPCs below
--   * event_members.invited_by    - set once, when joining through a link
--   * events.guest_sharing_enabled - when off, GUEST members cannot share and
--                                   their links stop working (ADMIN, EDITOR and
--                                   the super admin can always share)
--
--   * get_my_invite_token()       - the caller's token (created on first use)
--   * check_invite()              - event + inviter name, without joining
--   * join_event_by_invite()      - joins like join_event(), with invited_by
--   * set_event_guest_sharing()   - the switch (super admin)
--
-- A link works like the access code, so it is revoked the same way:
--   * set_event_access_code() deletes every token of the event,
--   * a token is valid only while its author is still a member (or the super
--     admin) and allowed to share.
--
-- SECURITY DEFINER: the invited person is not a member yet and cannot read the
-- event, the inviter's profile or the tokens. Failed token checks count
-- towards the same rate limit as wrong access codes (join_attempts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- schema
-- -----------------------------------------------------------------------------
alter table public.events
  add column guest_sharing_enabled boolean not null default true;

grant select (guest_sharing_enabled) on public.events to authenticated;

alter table public.event_members
  add column invited_by uuid references public.profiles (id) on delete set null;

create table public.event_invites (
  token      text        primary key check (token ~ '^[A-Za-z0-9_-]{22}$'),
  event_id   uuid        not null references public.events (id) on delete cascade,
  created_by uuid        not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, created_by)
);

create index event_invites_created_by_idx on public.event_invites (created_by);

alter table public.event_invites enable row level security;
revoke all on public.event_invites from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Internal helpers.
-- -----------------------------------------------------------------------------

-- May p_user_id share p_event_id? Super admin, ADMIN and EDITOR always; GUEST
-- only while guest sharing is on. False for non-members.
create function public.can_share_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    left join public.event_members m on m.event_id = e.id and m.user_id = p_user_id
    left join public.profiles p on p.id = p_user_id
    where e.id = p_event_id
      and (
        coalesce(p.is_platform_admin, false)
        or m.role in ('ADMIN', 'EDITOR')
        or (m.role = 'GUEST' and e.guest_sharing_enabled)
      )
  );
$$;

-- Finds a valid invite. Rate limit shared with find_event_by_access_code():
-- max 10 failed attempts per user per 3 minutes. Returns no row for an
-- unknown or revoked token (and records the failed attempt).
create function public.find_event_invite(p_uid uuid, p_token text)
returns table (event_id uuid, inviter_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_failed  integer;
  v_event   uuid;
  v_inviter uuid;
begin
  delete from public.join_attempts a
  where a.user_id = p_uid
    and a.attempted_at < now() - interval '1 day';

  select count(*)
  into v_failed
  from public.join_attempts a
  where a.user_id = p_uid
    and a.attempted_at > now() - interval '3 minutes';

  if v_failed >= 10 then
    raise exception 'Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut.'
      using errcode = 'PT429';
  end if;

  select i.event_id, i.created_by
  into v_event, v_inviter
  from public.event_invites i
  where p_token ~ '^[A-Za-z0-9_-]{22}$'
    and i.token = p_token
    and public.can_share_event(i.event_id, i.created_by);

  if v_event is null then
    insert into public.join_attempts (user_id) values (p_uid);
    return;
  end if;

  return query select v_event, v_inviter;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_my_invite_token - the caller's link token for the event, created on
-- first use (one per member and event).
-- -----------------------------------------------------------------------------
create function public.get_my_invite_token(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  if not public.can_share_event(p_event_id, v_uid) then
    raise exception 'Nie możesz udostępniać tego wydarzenia.' using errcode = 'PT403';
  end if;

  select i.token
  into v_token
  from public.event_invites i
  where i.event_id = p_event_id
    and i.created_by = v_uid;

  if v_token is not null then
    return v_token;
  end if;

  -- 16 random bytes -> 22 URL-safe characters.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');

  insert into public.event_invites (token, event_id, created_by)
  values (v_token, p_event_id, v_uid)
  on conflict (event_id, created_by) do nothing;

  -- A parallel call may have won the insert - return the stored token.
  select i.token
  into v_token
  from public.event_invites i
  where i.event_id = p_event_id
    and i.created_by = v_uid;

  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- check_invite - event and the inviter's display name for a link, without
-- joining. No rows for an invalid link.
-- -----------------------------------------------------------------------------
create function public.check_invite(p_token text)
returns table (
  event_id     uuid,
  event_name   text,
  starts_at    timestamptz,
  inviter_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_event   uuid;
  v_inviter uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  select f.event_id, f.inviter_id
  into v_event, v_inviter
  from public.find_event_invite(v_uid, p_token) f;

  if v_event is null then
    return;
  end if;

  return query
  select e.id, e.name, e.starts_at, p.display_name
  from public.events e
  left join public.profiles p on p.id = v_inviter
  where e.id = v_event;
end;
$$;

-- -----------------------------------------------------------------------------
-- join_event_by_invite - like join_event(), but with a link token. A new
-- membership remembers who invited (never oneself); an existing one is left
-- as it is.
-- -----------------------------------------------------------------------------
create function public.join_event_by_invite(p_token text, p_display_name text default null)
returns table (
  event_id   uuid,
  event_name text,
  starts_at  timestamptz,
  role       public.event_role
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid         uuid := auth.uid();
  v_has_profile boolean;
  v_event       uuid;
  v_inviter     uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  select exists (select 1 from public.profiles p where p.id = v_uid)
  into v_has_profile;

  -- Validate before touching the token, so a bad name costs no attempt.
  if p_display_name is not null then
    perform public.require_display_name(p_display_name);
  elsif not v_has_profile then
    raise exception 'Podaj pseudonim.' using errcode = 'PT400';
  end if;

  select f.event_id, f.inviter_id
  into v_event, v_inviter
  from public.find_event_invite(v_uid, p_token) f;

  if v_event is null then
    return;
  end if;

  if p_display_name is not null then
    perform public.upsert_own_profile(v_uid, p_display_name);
  end if;

  insert into public.event_members (event_id, user_id, role, invited_by)
  values (v_event, v_uid, 'GUEST', nullif(v_inviter, v_uid))
  on conflict on constraint event_members_pkey do nothing;

  return query
  select e.id, e.name, e.starts_at, m.role
  from public.events e
  join public.event_members m on m.event_id = e.id and m.user_id = v_uid
  where e.id = v_event;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_event_guest_sharing - the switch (super admin, like the rest of the
-- event configuration).
-- -----------------------------------------------------------------------------
create function public.set_event_guest_sharing(p_event_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  if p_enabled is null then
    raise exception 'Nieprawidłowa wartość.' using errcode = 'PT400';
  end if;

  update public.events e
  set guest_sharing_enabled = p_enabled
  where e.id = p_event_id;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_event_access_code - a new code also revokes every invite link (a link
-- works like the code, so changing the code must cut both).
-- -----------------------------------------------------------------------------
create or replace function public.set_event_access_code(p_event_id uuid, p_access_code text)
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

  delete from public.event_invites i
  where i.event_id = p_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- list_event_members_admin - now with the inviter's name.
-- -----------------------------------------------------------------------------
drop function public.list_event_members_admin(uuid);

create function public.list_event_members_admin(p_event_id uuid)
returns table (
  user_id      uuid,
  display_name text,
  email        text,
  is_anonymous boolean,
  role         public.event_role,
  joined_at    timestamptz,
  invited_by   uuid,
  inviter_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  return query
  select m.user_id, p.display_name, p.email, p.is_anonymous, m.role, m.joined_at,
         m.invited_by, ip.display_name
  from public.event_members m
  join public.profiles p on p.id = m.user_id
  left join public.profiles ip on ip.id = m.invited_by
  where m.event_id = p_event_id
  order by
    case m.role when 'ADMIN' then 0 when 'EDITOR' then 1 else 2 end,
    p.display_name nulls last,
    m.joined_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_event_page - the switch goes along with the rest of the event data, so
-- the page knows whether a guest may share it.
-- -----------------------------------------------------------------------------
create or replace function public.get_event_page(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'theme', e.theme,
      'guest_sharing_enabled', e.guest_sharing_enabled
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
               'section', s.section, 'is_visible', s.is_visible, 'nav_label', s.nav_label,
               'eyebrow', s.eyebrow, 'title', s.title, 'description', s.description,
               'content_title', s.content_title, 'content_body', s.content_body
             ) order by s.section)
      from public.event_sections s
      where s.event_id = e.id
    ), '[]'::jsonb),
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
               'time_label', i.time_label, 'title', i.title, 'description', i.description
             ) order by i.position)
      from public.event_schedule_items i
      where i.event_id = e.id
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'label', l.label, 'name', l.name, 'address', l.address, 'show_map', l.show_map
             ) order by l.position)
      from public.event_locations l
      where l.event_id = e.id
    ), '[]'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'label', c.label, 'name', c.name, 'email', c.email, 'phone', c.phone
             ) order by c.position)
      from public.event_contacts c
      where c.event_id = e.id
    ), '[]'::jsonb),
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.position)
      from public.event_about_facts f
      where f.event_id = e.id
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'section', p.section, 'storage_path', p.storage_path, 'alt_text', p.alt_text
             ) order by p.section, p.position, p.created_at)
      from public.event_page_photos p
      where p.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.id = p_event_id;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.can_share_event(uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.find_event_invite(uuid, text)        from public, anon, authenticated;
revoke execute on function public.get_my_invite_token(uuid)            from public, anon;
revoke execute on function public.check_invite(text)                   from public, anon;
revoke execute on function public.join_event_by_invite(text, text)     from public, anon;
revoke execute on function public.set_event_guest_sharing(uuid, boolean) from public, anon;
revoke execute on function public.list_event_members_admin(uuid)       from public, anon;

grant execute on function public.get_my_invite_token(uuid)              to authenticated;
grant execute on function public.check_invite(text)                     to authenticated;
grant execute on function public.join_event_by_invite(text, text)       to authenticated;
grant execute on function public.set_event_guest_sharing(uuid, boolean) to authenticated;
grant execute on function public.list_event_members_admin(uuid)         to authenticated;
