-- =============================================================================
-- RPC functions - the only way clients change events, membership and names.
--
-- Error codes (PostgREST maps PTxxx to HTTP status xxx):
--   42501 / PT403 - not allowed
--   22023 / PT400 - invalid input
--   PT409         - conflict (code already used, last admin)
--   PT429         - too many attempts
-- Access codes are normalized: trimmed and upper-cased.
-- =============================================================================

create function public.normalize_access_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(btrim(coalesce(p_code, '')));
$$;

-- -----------------------------------------------------------------------------
-- create_event - platform admin only; the creator becomes the event's ADMIN.
-- -----------------------------------------------------------------------------
create function public.create_event(
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
  v_code     text := public.normalize_access_code(p_access_code);
  v_name     text := btrim(coalesce(p_name, ''));
  v_event_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Brak uprawnień do tworzenia wydarzeń.' using errcode = 'PT403';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'Nazwa wydarzenia musi mieć od 1 do 120 znaków.' using errcode = 'PT400';
  end if;

  if char_length(v_code) < 6 then
    raise exception 'Kod dostępu musi mieć co najmniej 6 znaków.' using errcode = 'PT400';
  end if;

  if exists (
    select 1
    from public.events e
    where extensions.crypt(v_code, e.access_code_hash) = e.access_code_hash
  ) then
    raise exception 'Ten kod dostępu jest już używany.' using errcode = 'PT409';
  end if;

  insert into public.events (name, starts_at, access_code_hash, created_by)
  values (v_name, p_starts_at, extensions.crypt(v_code, extensions.gen_salt('bf')), auth.uid())
  returning id into v_event_id;

  insert into public.event_members (event_id, user_id, role)
  values (v_event_id, auth.uid(), 'ADMIN');

  return v_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- join_event - any signed-in user (anonymous included) joins by access code.
-- Returns no rows for a wrong code. Max 10 failed attempts per 3 minutes.
-- An existing membership (and its role) is kept as-is.
-- -----------------------------------------------------------------------------
create function public.join_event(p_access_code text)
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
  v_uid      uuid := auth.uid();
  v_code     text := public.normalize_access_code(p_access_code);
  v_failed   integer;
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  delete from public.join_attempts a
  where a.user_id = v_uid
    and a.attempted_at < now() - interval '1 day';

  select count(*)
  into v_failed
  from public.join_attempts a
  where a.user_id = v_uid
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
    insert into public.join_attempts (user_id) values (v_uid);
    return;
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
-- set_display_name - caller's own name (global, shown in every event).
-- -----------------------------------------------------------------------------
create function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  if char_length(v_name) not between 1 and 40 then
    raise exception 'Nazwa musi mieć od 1 do 40 znaków.' using errcode = 'PT400';
  end if;

  update public.profiles
  set display_name = v_name
  where id = auth.uid();

  if not found then
    raise exception 'Nie znaleziono profilu użytkownika.' using errcode = 'PT404';
  end if;
end;
$$;

-- Raises when the change would leave the event without any ADMIN.
-- Locks the event's ADMIN rows to avoid two admins demoting each other at once.
create function public.assert_not_last_admin(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other_admins integer;
begin
  perform 1
  from public.event_members m
  where m.event_id = p_event_id
    and m.role = 'ADMIN'
  for update;

  select count(*)
  into v_other_admins
  from public.event_members m
  where m.event_id = p_event_id
    and m.role = 'ADMIN'
    and m.user_id <> p_user_id;

  if v_other_admins = 0
     and exists (
       select 1
       from public.event_members m
       where m.event_id = p_event_id
         and m.user_id = p_user_id
         and m.role = 'ADMIN'
     ) then
    raise exception 'Wydarzenie musi mieć co najmniej jednego administratora.'
      using errcode = 'PT409';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_member_role - event ADMIN (or platform admin) changes a member's role.
-- -----------------------------------------------------------------------------
create function public.set_member_role(
  p_event_id uuid,
  p_user_id  uuid,
  p_role     public.event_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_event_role(p_event_id, array['ADMIN']::public.event_role[]) then
    raise exception 'Brak uprawnień do zmiany ról.' using errcode = 'PT403';
  end if;

  if p_role is null then
    raise exception 'Rola jest wymagana.' using errcode = 'PT400';
  end if;

  if p_role <> 'ADMIN' then
    perform public.assert_not_last_admin(p_event_id, p_user_id);
  end if;

  update public.event_members m
  set role = p_role
  where m.event_id = p_event_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'Użytkownik nie jest członkiem wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- remove_member - event ADMIN removes someone, or a member leaves the event.
-- Photos stay in the event (uploaded_by keeps pointing at the profile).
-- -----------------------------------------------------------------------------
create function public.remove_member(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is distinct from auth.uid()
     and not public.has_event_role(p_event_id, array['ADMIN']::public.event_role[]) then
    raise exception 'Brak uprawnień do usuwania członków.' using errcode = 'PT403';
  end if;

  perform public.assert_not_last_admin(p_event_id, p_user_id);

  delete from public.event_members m
  where m.event_id = p_event_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'Użytkownik nie jest członkiem wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: callable only by signed-in users (anonymous guests included).
-- -----------------------------------------------------------------------------
revoke execute on function public.normalize_access_code(text)                              from public, anon, authenticated;
revoke execute on function public.assert_not_last_admin(uuid, uuid)                        from public, anon, authenticated;
revoke execute on function public.create_event(text, text, timestamptz)                    from public, anon;
revoke execute on function public.join_event(text)                                         from public, anon;
revoke execute on function public.set_display_name(text)                                   from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, public.event_role)           from public, anon;
revoke execute on function public.remove_member(uuid, uuid)                                from public, anon;

grant execute on function public.create_event(text, text, timestamptz)          to authenticated;
grant execute on function public.join_event(text)                               to authenticated;
grant execute on function public.set_display_name(text)                         to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.event_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid)                      to authenticated;
