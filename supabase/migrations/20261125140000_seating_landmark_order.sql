-- =============================================================================
-- Seating plan fixes.
--
--   * seating_landmarks.position - drawing order of background elements.
--     A layout save re-inserts all landmarks in one transaction (same
--     created_at), so ordering by created_at, id flipped overlapping elements
--     randomly between saves. Now the order of p_landmarks is kept.
--   * save_seating_layout / get_seating_plan - write and read the position
--     (same signatures, security and grants as in
--     20261125130000_seating_layout.sql).
-- =============================================================================

alter table public.seating_landmarks
  add column position integer not null default 0 check (position >= 0);

create or replace function public.save_seating_layout(
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

  insert into public.seating_landmarks (event_id, label, x, y, width, height, rotation, position)
  select
    p_event_id,
    btrim(e.value ->> 'label'),
    (e.value ->> 'x')::numeric,
    (e.value ->> 'y')::numeric,
    (e.value ->> 'width')::numeric,
    (e.value ->> 'height')::numeric,
    coalesce((e.value ->> 'rotation')::numeric, 0),
    (e.ordinality - 1)::integer
  from jsonb_array_elements(p_landmarks) with ordinality as e (value, ordinality);

  return jsonb_build_object('unseated', v_unseated, 'table_ids', to_jsonb(v_ids));
end;
$$;

create or replace function public.get_seating_plan(p_event_id uuid)
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
             ) order by l.position, l.created_at, l.id)
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
