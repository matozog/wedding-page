-- =============================================================================
-- Core schema: users (profiles), events, per-event membership with roles,
-- photos and a log of failed access-code attempts.
--
-- Access model:
--   * Every visitor gets an auth.users row (anonymous sign-in or Google) and a
--     matching public.profiles row (created by triggers in the next migration).
--   * Roles are per event (public.event_members.role).
--   * profiles.is_platform_admin marks the platform owner (creates events,
--     can do everything).
--   * Anonymous guests use the `authenticated` Postgres role (with the
--     is_anonymous JWT claim) - the `anon` role (no session at all) gets
--     nothing.
--   * Sensitive changes (joining an event, roles, display name) go only through
--     SECURITY DEFINER RPC functions - tables expose no UPDATE to clients.
-- =============================================================================

-- Supabase grants EXECUTE on every new function to anon (and PostgreSQL to
-- PUBLIC). Turn that off for functions created from now on - each migration
-- grants EXECUTE explicitly to the roles that need it.
-- PUBLIC comes from a global default, which a per-schema rule cannot revoke,
-- hence two statements.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

create type public.event_role as enum ('ADMIN', 'EDITOR', 'GUEST');

-- Normalizes a display name: trims, caps at 40 chars, empty -> null.
create function public.clean_display_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(left(btrim(p_value), 40)), '');
$$;

-- -----------------------------------------------------------------------------
-- profiles - one row per auth user ("users table")
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid        primary key references auth.users (id) on delete cascade,
  display_name      text        check (
                                  display_name is null
                                  or (char_length(display_name) between 1 and 40
                                      and display_name = btrim(display_name))
                                ),
  email             text,
  avatar_url        text,
  is_anonymous      boolean     not null default true,
  is_platform_admin boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Application users, 1:1 with auth.users (anonymous guests included).';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
create table public.events (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null check (char_length(btrim(name)) between 1 and 120),
  starts_at        timestamptz,
  -- bcrypt hash (extensions.crypt). Uniqueness of codes is enforced by
  -- create_event(), a UNIQUE constraint on salted hashes would be meaningless.
  access_code_hash text        not null,
  created_by       uuid        references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- event_members - who belongs to which event and with what role
-- -----------------------------------------------------------------------------
create table public.event_members (
  event_id  uuid              not null references public.events (id) on delete cascade,
  user_id   uuid              not null references public.profiles (id) on delete cascade,
  role      public.event_role not null default 'GUEST',
  joined_at timestamptz       not null default now(),
  primary key (event_id, user_id)
);

create index event_members_user_id_idx on public.event_members (user_id);

-- -----------------------------------------------------------------------------
-- photos
-- Storage layout: {event_id}/{uploaded_by}/originals/{file}
--                 {event_id}/{uploaded_by}/thumbnails/{file}
-- -----------------------------------------------------------------------------
create table public.photos (
  id                     uuid        primary key default gen_random_uuid(),
  event_id               uuid        not null references public.events (id) on delete cascade,
  uploaded_by            uuid        default auth.uid() references public.profiles (id) on delete set null,
  storage_path           text        not null unique,
  thumbnail_storage_path text,
  original_filename      text        not null,
  mime_type              text        not null,
  size_bytes             bigint      not null check (size_bytes > 0),
  created_at             timestamptz not null default now()
);

create index photos_event_id_created_at_idx on public.photos (event_id, created_at desc);
create index photos_uploaded_by_idx on public.photos (uploaded_by);

-- -----------------------------------------------------------------------------
-- join_attempts - failed access-code attempts, used for rate limiting
-- -----------------------------------------------------------------------------
create table public.join_attempts (
  id           bigint      generated always as identity primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index join_attempts_user_id_attempted_at_idx
  on public.join_attempts (user_id, attempted_at desc);

-- -----------------------------------------------------------------------------
-- RLS on everything, explicit grants only
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.event_members enable row level security;
alter table public.photos        enable row level security;
alter table public.join_attempts enable row level security;

-- Supabase grants ALL on new public tables to anon/authenticated by default.
-- Take that back and grant only what the RLS policies are meant to allow.
revoke all on public.profiles, public.events, public.event_members,
              public.photos, public.join_attempts
  from anon, authenticated;

-- Column-level: email and is_platform_admin stay private (co-members can read
-- each other's profiles). The caller's own email comes from the auth session.
grant select (id, display_name, avatar_url, is_anonymous, created_at, updated_at)
  on public.profiles to authenticated;
-- access_code_hash never leaves the database.
grant select (id, name, starts_at, created_by, created_at)
  on public.events to authenticated;
grant select                 on public.event_members to authenticated;
grant select, insert, delete on public.photos        to authenticated;
-- join_attempts: no client access at all (only join_event() touches it).

revoke execute on function public.clean_display_name(text) from public, anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
