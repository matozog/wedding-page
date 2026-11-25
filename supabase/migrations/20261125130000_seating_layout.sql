-- =============================================================================
-- Seating plan configurator.
--
--   * seating_tables gets its layout: shape (RECT / L / U), position (x, y =
--     centre of the table in room units, 1 unit = 1 cm), rotation and
--     seat_config (which sides have seats, seats on the first arm). The table
--     size is derived from capacity in the frontend (src/lib/seating), so
--     capacity becomes required = number of seats.
--   * seating_rooms     - one per event: room size and the "published" flag.
--   * seating_landmarks - background elements (dance floor, entrance, ...).
--   * guests.seat_number can never exceed the table capacity (triggers).
--
-- Access:
--   * ADMIN / EDITOR edit the layout and seat guests. EDITOR may now also add
--     and edit guests and groups (seating needs it) - deleting guests and
--     groups stays ADMIN only.
--   * save_seating_layout() - SECURITY INVOKER: the caller's RLS applies, the
--     function makes "room + tables + landmarks + unseating" one transaction
--     and reports (dry run) which guests would lose their seat.
--   * assign_seat()         - SECURITY INVOKER: seat / swap / unseat a guest
--     atomically.
--   * get_seating_plan()    - SECURITY DEFINER (as before): members without a
--     role in the planning tables read names only, and only once the plan is
--     published. ADMIN / EDITOR always get it (preview).
-- =============================================================================

create type public.seating_table_shape as enum ('RECT', 'L', 'U');

-- -----------------------------------------------------------------------------
-- seating_tables - layout columns
-- -----------------------------------------------------------------------------
update public.seating_tables set capacity = 8 where capacity is null;
-- the new limit - older rows had no upper bound
update public.seating_tables set capacity = 60 where capacity > 60;

-- Capacity used to be soft: unseat guests on seats above it (the triggers
-- below only check new writes). guests_clear_seat_without_table clears the
-- seat number.
update public.guests g
set table_id = null
from public.seating_tables t
where t.id = g.table_id
  and g.seat_number > t.capacity;

alter table public.seating_tables
  alter column capacity set not null,
  alter column capacity set default 8,
  add constraint seating_tables_capacity_max check (capacity <= 60),
  add column shape       public.seating_table_shape not null default 'RECT',
  add column x           numeric(7,1) not null default 0
    constraint seating_tables_x_range check (x between 0 and 5000),
  add column y           numeric(7,1) not null default 0
    constraint seating_tables_y_range check (y between 0 and 5000),
  add column rotation    numeric(5,1) not null default 0
    constraint seating_tables_rotation_range check (rotation >= 0 and rotation < 360),
  add column seat_config jsonb not null default '{}'::jsonb
    constraint seating_tables_seat_config_object
    check (jsonb_typeof(seat_config) = 'object' and pg_column_size(seat_config) <= 1000);

-- A layout save may swap two table names - the check waits for the commit.
alter table public.seating_tables
  drop constraint seating_tables_event_id_name_key,
  add constraint seating_tables_event_id_name_key unique (event_id, name) deferrable initially deferred;

-- -----------------------------------------------------------------------------
-- seating_rooms
-- -----------------------------------------------------------------------------
create table public.seating_rooms (
  event_id     uuid        primary key references public.events (id) on delete cascade,
  width        integer     not null default 2000 check (width  between 300 and 5000),
  height       integer     not null default 1200 check (height between 300 and 5000),
  is_published boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger seating_rooms_set_updated_at before update on public.seating_rooms
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- seating_landmarks
-- -----------------------------------------------------------------------------
create table public.seating_landmarks (
  id         uuid         primary key default gen_random_uuid(),
  event_id   uuid         not null references public.events (id) on delete cascade,
  label      text         not null check (char_length(btrim(label)) between 1 and 40),
  x          numeric(7,1) not null check (x between 0 and 5000),
  y          numeric(7,1) not null check (y between 0 and 5000),
  width      numeric(7,1) not null check (width  between 20 and 5000),
  height     numeric(7,1) not null check (height between 20 and 5000),
  rotation   numeric(5,1) not null default 0 check (rotation >= 0 and rotation < 360),
  created_at timestamptz  not null default now()
);

create index seating_landmarks_event_id_idx on public.seating_landmarks (event_id);
create index seating_tables_event_id_idx on public.seating_tables (event_id);

-- -----------------------------------------------------------------------------
-- seat_number <= capacity
-- Both triggers run with the caller's rights: only ADMIN / EDITOR write these
-- tables and they see every table and guest of their event.
-- -----------------------------------------------------------------------------
create function public.guests_check_seat_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_capacity integer;
begin
  if new.seat_number is not null then
    select t.capacity into v_capacity
    from public.seating_tables t
    where t.id = new.table_id;

    if v_capacity is not null and new.seat_number > v_capacity then
      raise exception 'Stół ma tylko % miejsc.', v_capacity using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- A guest without a table has no capacity to check (seat cleared by
-- guests_clear_seat_without_table).
create trigger guests_check_seat_capacity
before insert or update of table_id, seat_number on public.guests
for each row
execute function public.guests_check_seat_capacity();

create function public.seating_tables_check_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.guests g
    where g.table_id = new.id and g.seat_number > new.capacity
  ) then
    raise exception 'Przy stole „%” siedzą osoby na miejscach powyżej %.', new.name, new.capacity
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger seating_tables_check_capacity
after update of capacity on public.seating_tables
for each row
when (new.capacity < old.capacity)
execute function public.seating_tables_check_capacity();

revoke execute on function public.guests_check_seat_capacity()    from public, anon, authenticated;
revoke execute on function public.seating_tables_check_capacity() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS & grants
-- -----------------------------------------------------------------------------
alter table public.seating_rooms     enable row level security;
alter table public.seating_landmarks enable row level security;

revoke all on public.seating_rooms, public.seating_landmarks from anon, authenticated;
grant select, insert, update         on public.seating_rooms     to authenticated;
grant select, insert, update, delete on public.seating_landmarks to authenticated;

create policy "Editors and admins can view seating room"
on public.seating_rooms
for select
to authenticated
using (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can add seating room"
on public.seating_rooms
for insert
to authenticated
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can update seating room"
on public.seating_rooms
for update
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins manage seating landmarks"
on public.seating_landmarks
for all
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

-- EDITOR adds and edits guests and groups (seating), deleting stays ADMIN only.
drop policy "Admins can add guest groups"    on public.guest_groups;
drop policy "Admins can update guest groups" on public.guest_groups;
drop policy "Admins can add guests"          on public.guests;
drop policy "Admins can update guests"       on public.guests;

create policy "Editors and admins can add guest groups"
on public.guest_groups
for insert
to authenticated
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can update guest groups"
on public.guest_groups
for update
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can add guests"
on public.guests
for insert
to authenticated
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can update guests"
on public.guests
for update
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

-- -----------------------------------------------------------------------------
-- save_seating_layout - replaces the whole layout of an event.
--
--   p_room      {"width": int, "height": int}
--   p_tables    [{"id": uuid|null, "name", "shape", "capacity", "x", "y",
--                 "rotation", "seat_config"}]  - tables missing from the list
--                 are deleted, id null = new table
--   p_landmarks [{"label", "x", "y", "width", "height", "rotation"}] - replaced
--   p_dry_run   true = change nothing, only report who would lose the seat
--
-- Guests at deleted tables and on seats above the new capacity are unseated.
-- Returns {"unseated": [{"guest_id", "guest_name", "table_name"}],
--          "table_ids": [uuid, ...]} - table_ids in the order of p_tables.
-- -----------------------------------------------------------------------------
create function public.save_seating_layout(
  p_event_id  uuid,
  p_room      jsonb,
  p_tables    jsonb,
  p_landmarks jsonb,
  p_dry_run   boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table     jsonb;
  v_id        uuid;
  v_ids       uuid[] := '{}';
  v_unseated  jsonb;
begin
  if not public.has_event_role(p_event_id, array['ADMIN', 'EDITOR']::public.event_role[]) then
    raise exception 'Brak uprawnień do planu sali.' using errcode = 'PT403';
  end if;

  if jsonb_typeof(p_tables) <> 'array' or jsonb_typeof(p_landmarks) <> 'array'
     or jsonb_typeof(p_room) <> 'object' then
    raise exception 'Nieprawidłowe dane planu.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_tables) > 100 then
    raise exception 'Plan może mieć najwyżej 100 stołów.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_landmarks) > 30 then
    raise exception 'Plan może mieć najwyżej 30 elementów tła.' using errcode = '22023';
  end if;

  -- one layout save / seat change per event at a time
  perform pg_advisory_xact_lock(hashtextextended('seating:' || p_event_id::text, 0));

  -- guests who lose their seat
  select coalesce(jsonb_agg(jsonb_build_object(
           'guest_id',   g.id,
           'guest_name', coalesce(nullif(btrim(concat_ws(' ', g.first_name, g.last_name)), ''), 'Osoba towarzysząca'),
           'table_name', t.name
         ) order by t.name, g.seat_number), '[]'::jsonb)
  into v_unseated
  from public.guests g
  join public.seating_tables t on t.id = g.table_id
  left join lateral (
    select (e ->> 'capacity')::integer as capacity
    from jsonb_array_elements(p_tables) e
    where e ->> 'id' = t.id::text
    limit 1
  ) kept on true
  where t.event_id = p_event_id
    and (kept.capacity is null or g.seat_number > kept.capacity);

  if p_dry_run then
    return jsonb_build_object('unseated', v_unseated, 'table_ids', '[]'::jsonb);
  end if;

  update public.guests g
  set table_id = null
  where g.event_id = p_event_id
    and g.id in (select (u ->> 'guest_id')::uuid from jsonb_array_elements(v_unseated) u);

  -- room
  insert into public.seating_rooms (event_id, width, height)
  values (p_event_id, (p_room ->> 'width')::integer, (p_room ->> 'height')::integer)
  on conflict (event_id) do update
  set width = excluded.width, height = excluded.height;

  -- tables: delete the missing ones, update / insert the rest
  delete from public.seating_tables t
  where t.event_id = p_event_id
    and not exists (
      select 1 from jsonb_array_elements(p_tables) e where e ->> 'id' = t.id::text
    );

  for v_table in select * from jsonb_array_elements(p_tables)
  loop
    if v_table ->> 'id' is null then
      insert into public.seating_tables (event_id, name, shape, capacity, x, y, rotation, seat_config)
      values (
        p_event_id,
        btrim(v_table ->> 'name'),
        (v_table ->> 'shape')::public.seating_table_shape,
        (v_table ->> 'capacity')::integer,
        (v_table ->> 'x')::numeric,
        (v_table ->> 'y')::numeric,
        (v_table ->> 'rotation')::numeric,
        coalesce(v_table -> 'seat_config', '{}'::jsonb)
      )
      returning id into v_id;
    else
      update public.seating_tables t
      set name        = btrim(v_table ->> 'name'),
          shape       = (v_table ->> 'shape')::public.seating_table_shape,
          capacity    = (v_table ->> 'capacity')::integer,
          x           = (v_table ->> 'x')::numeric,
          y           = (v_table ->> 'y')::numeric,
          rotation    = (v_table ->> 'rotation')::numeric,
          seat_config = coalesce(v_table -> 'seat_config', '{}'::jsonb)
      where t.id = (v_table ->> 'id')::uuid
        and t.event_id = p_event_id
      returning t.id into v_id;

      if v_id is null then
        raise exception 'Nie znaleziono stołu.' using errcode = 'PT404';
      end if;
    end if;

    v_ids := v_ids || v_id;
    v_id := null;
  end loop;

  -- landmarks
  delete from public.seating_landmarks l where l.event_id = p_event_id;

  insert into public.seating_landmarks (event_id, label, x, y, width, height, rotation)
  select
    p_event_id,
    btrim(e ->> 'label'),
    (e ->> 'x')::numeric,
    (e ->> 'y')::numeric,
    (e ->> 'width')::numeric,
    (e ->> 'height')::numeric,
    coalesce((e ->> 'rotation')::numeric, 0)
  from jsonb_array_elements(p_landmarks) e;

  return jsonb_build_object('unseated', v_unseated, 'table_ids', to_jsonb(v_ids));
end;
$$;

revoke execute on function public.save_seating_layout(uuid, jsonb, jsonb, jsonb, boolean) from public, anon;
grant  execute on function public.save_seating_layout(uuid, jsonb, jsonb, jsonb, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- set_seating_published - publish / hide the plan for guests.
-- -----------------------------------------------------------------------------
create function public.set_seating_published(p_event_id uuid, p_published boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_event_role(p_event_id, array['ADMIN', 'EDITOR']::public.event_role[]) then
    raise exception 'Brak uprawnień do planu sali.' using errcode = 'PT403';
  end if;

  insert into public.seating_rooms (event_id, is_published)
  values (p_event_id, p_published)
  on conflict (event_id) do update set is_published = excluded.is_published;
end;
$$;

revoke execute on function public.set_seating_published(uuid, boolean) from public, anon;
grant  execute on function public.set_seating_published(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- assign_seat - seats a guest. An occupied seat swaps the two guests (the
-- other one takes the guest's previous seat, or becomes unseated).
-- p_table_id null = unseat the guest.
-- -----------------------------------------------------------------------------
create function public.assign_seat(p_guest_id uuid, p_table_id uuid default null, p_seat_number integer default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guest    public.guests;
  v_capacity integer;
  v_other_id uuid;
begin
  select g.* into v_guest from public.guests g where g.id = p_guest_id;

  if v_guest.id is null then
    raise exception 'Nie znaleziono gościa.' using errcode = 'PT404';
  end if;

  if not public.has_event_role(v_guest.event_id, array['ADMIN', 'EDITOR']::public.event_role[]) then
    raise exception 'Brak uprawnień do planu sali.' using errcode = 'PT403';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('seating:' || v_guest.event_id::text, 0));

  if p_table_id is null then
    update public.guests g set table_id = null where g.id = v_guest.id;
    return;
  end if;

  select t.capacity into v_capacity
  from public.seating_tables t
  where t.id = p_table_id and t.event_id = v_guest.event_id;

  if v_capacity is null then
    raise exception 'Nie znaleziono stołu.' using errcode = 'PT404';
  end if;

  if p_seat_number is null or p_seat_number < 1 or p_seat_number > v_capacity then
    raise exception 'Nieprawidłowy numer miejsca.' using errcode = '22023';
  end if;

  -- re-read under the lock
  select g.* into v_guest from public.guests g where g.id = p_guest_id;

  if v_guest.table_id = p_table_id and v_guest.seat_number = p_seat_number then
    return;
  end if;

  select g.id into v_other_id
  from public.guests g
  where g.table_id = p_table_id and g.seat_number = p_seat_number;

  -- free both seats first - (table_id, seat_number) is unique
  update public.guests g set table_id = null where g.id = v_guest.id;

  if v_other_id is not null then
    update public.guests g
    set table_id    = v_guest.table_id,
        seat_number = v_guest.seat_number
    where g.id = v_other_id;
  end if;

  update public.guests g
  set table_id    = p_table_id,
      seat_number = p_seat_number
  where g.id = v_guest.id;
end;
$$;

revoke execute on function public.assign_seat(uuid, uuid, integer) from public, anon;
grant  execute on function public.assign_seat(uuid, uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- get_seating_plan - the plan for the event page (and the editor preview).
-- SECURITY DEFINER: guests (GUEST role) cannot read seating_tables / guests,
-- the function exposes only the layout and guest names. Returns null when the
-- plan is not published and the caller is not ADMIN / EDITOR.
-- -----------------------------------------------------------------------------
drop function public.get_seating_plan(uuid);

create function public.get_seating_plan(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room      public.seating_rooms;
  v_organizer boolean;
begin
  if not public.is_event_member(p_event_id) then
    raise exception 'Brak dostępu do wydarzenia.' using errcode = 'PT403';
  end if;

  v_organizer := public.has_event_role(p_event_id, array['ADMIN', 'EDITOR']::public.event_role[]);

  select r.* into v_room from public.seating_rooms r where r.event_id = p_event_id;

  if not v_organizer and not coalesce(v_room.is_published, false) then
    return null;
  end if;

  return jsonb_build_object(
    'is_published', coalesce(v_room.is_published, false),
    'room', jsonb_build_object(
      'width',  coalesce(v_room.width, 2000),
      'height', coalesce(v_room.height, 1200)
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'shape', t.shape, 'capacity', t.capacity,
               'x', t.x, 'y', t.y, 'rotation', t.rotation, 'seat_config', t.seat_config
             ) order by t.name)
      from public.seating_tables t
      where t.event_id = p_event_id
    ), '[]'::jsonb),
    'landmarks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'label', l.label, 'x', l.x, 'y', l.y,
               'width', l.width, 'height', l.height, 'rotation', l.rotation
             ) order by l.created_at, l.id)
      from public.seating_landmarks l
      where l.event_id = p_event_id
    ), '[]'::jsonb),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
               'table_id', g.table_id,
               'seat_number', g.seat_number,
               'guest_id', g.id,
               'guest_name', coalesce(nullif(btrim(concat_ws(' ', g.first_name, g.last_name)), ''), 'Osoba towarzysząca')
             ) order by g.table_id, g.seat_number)
      from public.guests g
      where g.event_id = p_event_id
        and g.table_id is not null
        and g.seat_number is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_seating_plan(uuid) from public, anon;
grant  execute on function public.get_seating_plan(uuid) to authenticated;
