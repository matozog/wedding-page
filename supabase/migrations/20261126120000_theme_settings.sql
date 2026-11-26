-- =============================================================================
-- Theme settings:
--   * custom colours - up to five overrides of a palette (background, text,
--     primary, secondary, accent; the frontend derives the rest). Stored as
--     jsonb {"primary": "#aabbcc", ...}, null = palette only.
--   * start screen theme - app_settings (one row): palette + custom colours of
--     the code entry screen. Readable without a session (role anon).
--   * check_event_code / join_event and the invite link versions
--     (check_invite / join_event_by_invite) return the event theme, so the
--     nickname screen and the first page load already use it.
-- Palettes live in the frontend (src/config/themes.ts + index.css) - the key
-- list below must match.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Validation helpers (immutable - used in check constraints).
-- -----------------------------------------------------------------------------
create function public.is_theme_key(p_theme text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_theme in ('sand', 'sage', 'blush', 'navy', 'lavender', 'terracotta',
                              'midnight', 'graphite', 'forest', 'wine'), false);
$$;

-- null or an object with known keys only, every value "#rrggbb" (lower case).
create function public.is_theme_colors(p_colors jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_colors is null
      or (jsonb_typeof(p_colors) = 'object'
          and not exists (
            select 1
            from jsonb_each(p_colors) c
            where c.key not in ('background', 'foreground', 'primary', 'secondary', 'accent')
               or jsonb_typeof(c.value) <> 'string'
               or (c.value #>> '{}') !~ '^#[0-9a-f]{6}$'
          ));
$$;

-- Lower-case values, {} -> null. Raises PT400 for invalid colours.
create function public.clean_theme_colors(p_colors jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_colors jsonb := p_colors;
begin
  if v_colors is null or jsonb_typeof(v_colors) = 'null' then
    return null;
  end if;

  if jsonb_typeof(v_colors) = 'object' then
    select nullif(coalesce(jsonb_object_agg(c.key,
             case when jsonb_typeof(c.value) = 'string' then to_jsonb(lower(c.value #>> '{}')) else c.value end),
             '{}'::jsonb), '{}'::jsonb)
    into v_colors
    from jsonb_each(p_colors) c;
  end if;

  if not public.is_theme_colors(v_colors) then
    raise exception 'Nieprawidłowe kolory motywu.' using errcode = 'PT400';
  end if;

  return v_colors;
end;
$$;

-- -----------------------------------------------------------------------------
-- events: one key list (helper) + custom colours.
-- -----------------------------------------------------------------------------
alter table public.events
  drop constraint events_theme_check,
  add constraint events_theme_check check (public.is_theme_key(theme)),
  add column theme_colors jsonb
    constraint events_theme_colors_check check (public.is_theme_colors(theme_colors));

grant select (theme_colors) on public.events to authenticated;

-- -----------------------------------------------------------------------------
-- app_settings - application-wide settings, exactly one row.
-- Read: everyone (the code entry screen runs before any session). Write: only
-- set_start_theme() (super admin).
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id                 boolean primary key default true
                       constraint app_settings_single_row check (id),
  start_theme        text not null default 'sand'
                       constraint app_settings_start_theme_check check (public.is_theme_key(start_theme)),
  start_theme_colors jsonb
                       constraint app_settings_start_theme_colors_check check (public.is_theme_colors(start_theme_colors)),
  updated_at         timestamptz not null default now()
);

insert into public.app_settings default values;

alter table public.app_settings enable row level security;

revoke all on public.app_settings from public, anon, authenticated;
grant select (start_theme, start_theme_colors) on public.app_settings to anon, authenticated;

create policy "Everyone reads app settings"
  on public.app_settings
  for select
  to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- set_event_theme - now with custom colours (null = palette only).
-- SECURITY DEFINER: clients have no UPDATE on events; super admin only.
-- -----------------------------------------------------------------------------
drop function public.set_event_theme(uuid, text);

create function public.set_event_theme(p_event_id uuid, p_theme text, p_colors jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colors jsonb;
begin
  perform public.require_platform_admin();

  if not public.is_theme_key(p_theme) then
    raise exception 'Nieznany motyw.' using errcode = 'PT400';
  end if;

  v_colors := public.clean_theme_colors(p_colors);

  update public.events e
  set theme = p_theme,
      theme_colors = v_colors
  where e.id = p_event_id;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_start_theme - theme of the code entry screen.
-- SECURITY DEFINER: app_settings has no write policies; super admin only.
-- -----------------------------------------------------------------------------
create function public.set_start_theme(p_theme text, p_colors jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colors jsonb;
begin
  perform public.require_platform_admin();

  if not public.is_theme_key(p_theme) then
    raise exception 'Nieznany motyw.' using errcode = 'PT400';
  end if;

  v_colors := public.clean_theme_colors(p_colors);

  update public.app_settings s
  set start_theme = p_theme,
      start_theme_colors = v_colors,
      updated_at = now()
  where s.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_event_page - event gets theme_colors (body otherwise as in
-- 20261126100000_event_invites.sql).
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
      'theme_colors', e.theme_colors, 'guest_sharing_enabled', e.guest_sharing_enabled
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
-- check_event_code / join_event - return the event theme too (the caller
-- knows the code, the theme is not sensitive). Logic otherwise unchanged
-- (20261121100700_deferred_guest_profiles.sql).
-- -----------------------------------------------------------------------------
drop function public.check_event_code(text);

create function public.check_event_code(p_access_code text)
returns table (
  event_id     uuid,
  event_name   text,
  starts_at    timestamptz,
  theme        text,
  theme_colors jsonb
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
  select e.id, e.name, e.starts_at, e.theme, e.theme_colors
  from public.events e
  where e.id = v_event_id;
end;
$$;

drop function public.join_event(text, text);

create function public.join_event(p_access_code text, p_display_name text default null)
returns table (
  event_id     uuid,
  event_name   text,
  starts_at    timestamptz,
  role         public.event_role,
  theme        text,
  theme_colors jsonb
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
  select e.id, e.name, e.starts_at, m.role, e.theme, e.theme_colors
  from public.events e
  join public.event_members m on m.event_id = e.id and m.user_id = v_uid
  where e.id = v_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- check_invite / join_event_by_invite - the same for invite links. Logic
-- otherwise unchanged (20261126100000_event_invites.sql).
-- -----------------------------------------------------------------------------
drop function public.check_invite(text);

create function public.check_invite(p_token text)
returns table (
  event_id     uuid,
  event_name   text,
  starts_at    timestamptz,
  inviter_name text,
  theme        text,
  theme_colors jsonb
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
  select e.id, e.name, e.starts_at, p.display_name, e.theme, e.theme_colors
  from public.events e
  left join public.profiles p on p.id = v_inviter
  where e.id = v_event;
end;
$$;

drop function public.join_event_by_invite(text, text);

create function public.join_event_by_invite(p_token text, p_display_name text default null)
returns table (
  event_id     uuid,
  event_name   text,
  starts_at    timestamptz,
  role         public.event_role,
  theme        text,
  theme_colors jsonb
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
  select e.id, e.name, e.starts_at, m.role, e.theme, e.theme_colors
  from public.events e
  join public.event_members m on m.event_id = e.id and m.user_id = v_uid
  where e.id = v_event;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.clean_theme_colors(jsonb)                from public, anon, authenticated;
revoke execute on function public.set_event_theme(uuid, text, jsonb)       from public, anon;
revoke execute on function public.set_start_theme(text, jsonb)             from public, anon;
revoke execute on function public.check_event_code(text)                   from public, anon;
revoke execute on function public.join_event(text, text)                   from public, anon;
revoke execute on function public.check_invite(text)                       from public, anon;
revoke execute on function public.join_event_by_invite(text, text)         from public, anon;

grant execute on function public.set_event_theme(uuid, text, jsonb)        to authenticated;
grant execute on function public.set_start_theme(text, jsonb)              to authenticated;
grant execute on function public.check_event_code(text)                    to authenticated;
grant execute on function public.join_event(text, text)                    to authenticated;
grant execute on function public.check_invite(text)                        to authenticated;
grant execute on function public.join_event_by_invite(text, text)          to authenticated;
