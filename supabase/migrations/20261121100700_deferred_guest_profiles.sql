-- =============================================================================
-- Deferred guest profiles + access-code check right on the code screen.
--
-- Flow:
--   1. Code screen: the client signs in anonymously (auth.users row only, NO
--      profile) and calls check_event_code() - rate limited per user, writes
--      nothing except failed attempts.
--   2. Nickname: join_event(code, display_name) creates the profile (with the
--      name) and the membership in one transaction.
--      Google: a separate (existing or new) account with its own profile; the
--      anonymous user from step 1 is abandoned.
--   3. Anonymous auth users without a profile older than 24 h are deleted
--      daily by pg_cron.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profiles: no longer created for anonymous users without a name.
-- -----------------------------------------------------------------------------
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.clean_display_name(
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
begin
  -- Anonymous visitor who has not given a name yet: profile comes later
  -- from join_event() / set_display_name().
  if coalesce(new.is_anonymous, false) and v_name is null then
    return new;
  end if;

  insert into public.profiles (id, email, is_anonymous, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.is_anonymous, false),
    v_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal helpers (not exposed to clients).
-- -----------------------------------------------------------------------------

-- Validates a display name the same way set_display_name always has.
create function public.require_display_name(p_display_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'Nazwa musi mieć od 1 do 40 znaków.' using errcode = 'PT400';
  end if;

  return v_name;
end;
$$;

-- Creates the caller's profile with the given name, or renames an existing one.
create function public.upsert_own_profile(p_uid uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.require_display_name(p_display_name);
begin
  insert into public.profiles (id, email, is_anonymous, display_name)
  select u.id, u.email, coalesce(u.is_anonymous, false), v_name
  from auth.users u
  where u.id = p_uid
  on conflict (id) do update
    set display_name = excluded.display_name;

  if not found then
    raise exception 'Nie znaleziono użytkownika.' using errcode = 'PT404';
  end if;
end;
$$;

-- Finds the event for an access code. Shared rate limit for check_event_code()
-- and join_event(): max 10 failed attempts per user per 3 minutes.
-- Returns null for a wrong code (and records the failed attempt).
create function public.find_event_by_access_code(p_uid uuid, p_access_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code     text := public.normalize_access_code(p_access_code);
  v_failed   integer;
  v_event_id uuid;
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

  select e.id
  into v_event_id
  from public.events e
  where v_code <> ''
    and extensions.crypt(v_code, e.access_code_hash) = e.access_code_hash
  limit 1;

  if v_event_id is null then
    insert into public.join_attempts (user_id) values (p_uid);
  end if;

  return v_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- check_event_code - signed-in user (anonymous included, profile not needed)
-- checks a code without joining. Returns no rows for a wrong code.
-- SECURITY DEFINER: the caller cannot read events.access_code_hash, nor the
-- event before joining. Only id, name and start time are returned.
-- -----------------------------------------------------------------------------
create function public.check_event_code(p_access_code text)
returns table (
  event_id   uuid,
  event_name text,
  starts_at  timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  v_event_id := public.find_event_by_access_code(v_uid, p_access_code);

  if v_event_id is null then
    return;
  end if;

  return query
  select e.id, e.name, e.starts_at
  from public.events e
  where e.id = v_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- join_event - now with an optional display name.
--   * Caller without a profile (fresh anonymous guest): name required, the
--     profile is created together with the membership.
--   * Name given and profile exists: the name is updated.
-- Returns no rows for a wrong code (nothing is created then).
-- -----------------------------------------------------------------------------
drop function public.join_event(text);

create function public.join_event(p_access_code text, p_display_name text default null)
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
  v_event_id    uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  select exists (select 1 from public.profiles p where p.id = v_uid)
  into v_has_profile;

  -- Validate before touching the code, so a bad name costs no attempt.
  if p_display_name is not null then
    perform public.require_display_name(p_display_name);
  elsif not v_has_profile then
    raise exception 'Podaj pseudonim.' using errcode = 'PT400';
  end if;

  v_event_id := public.find_event_by_access_code(v_uid, p_access_code);

  if v_event_id is null then
    return;
  end if;

  if p_display_name is not null then
    perform public.upsert_own_profile(v_uid, p_display_name);
  end if;

  insert into public.event_members (event_id, user_id, role)
  values (v_event_id, v_uid, 'GUEST')
  on conflict on constraint event_members_pkey do nothing;

  return query
  select e.id, e.name, e.starts_at, m.role
  from public.events e
  join public.event_members m on m.event_id = e.id and m.user_id = v_uid
  where e.id = v_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_display_name - also creates the profile when it does not exist yet.
-- -----------------------------------------------------------------------------
create or replace function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  perform public.upsert_own_profile(auth.uid(), p_display_name);
end;
$$;

-- -----------------------------------------------------------------------------
-- Cleanup of abandoned anonymous users (code screen visits that never got a
-- profile - Google login chosen, wrong code, page closed).
-- A user counts as abandoned after 24 h without any session activity
-- (sign-in or token refresh), so a tab left open on the nickname screen
-- keeps its user. Deleting the auth user cascades to its sessions and
-- join_attempts.
-- -----------------------------------------------------------------------------
create function public.cleanup_abandoned_anonymous_users()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.profiles p where p.id = u.id)
    and not exists (
      select 1
      from auth.sessions s
      where s.user_id = u.id
        -- refreshed_at is a timestamp without time zone, stored in UTC
        and greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC')
            > now() - interval '24 hours'
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'cleanup-abandoned-anonymous-users',
  '30 3 * * *',
  'select public.cleanup_abandoned_anonymous_users()'
);

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.require_display_name(text)               from public, anon, authenticated;
revoke execute on function public.upsert_own_profile(uuid, text)           from public, anon, authenticated;
revoke execute on function public.find_event_by_access_code(uuid, text)    from public, anon, authenticated;
revoke execute on function public.cleanup_abandoned_anonymous_users()      from public, anon, authenticated;
revoke execute on function public.check_event_code(text)                   from public, anon;
revoke execute on function public.join_event(text, text)                   from public, anon;

grant execute on function public.check_event_code(text)       to authenticated;
grant execute on function public.join_event(text, text)       to authenticated;
