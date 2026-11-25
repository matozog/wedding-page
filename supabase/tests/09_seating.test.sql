-- =============================================================================
-- Seating plan configurator - layout save, seat assignment, publishing and
-- the guest view (get_seating_plan).
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin (event ADMIN), E = EDITOR, G = guest,
-- O = outsider (member of another event only).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

grant execute on function pg_temp.act_as(uuid), pg_temp.act_as_anon() to public;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Gość"}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Obcy"}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Edytor"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set G '''00000000-0000-0000-0000-00000000000b'''
\set O '''00000000-0000-0000-0000-00000000000c'''
\set E '''00000000-0000-0000-0000-00000000000d'''

select pg_temp.act_as(:A);
select public.create_event('Wesele', 'abc123') as ev \gset
select public.create_event('Inne', 'xyz789') as ev2 \gset

select pg_temp.act_as(:G);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:O);
select count(*) from public.join_event('xyz789') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');

insert into public.guest_groups (event_id, name) values (:'ev', 'Kowalscy') returning id as grp \gset
insert into public.guests (event_id, group_id, first_name, last_name, phone) values (:'ev', :'grp', 'Jan', 'Kowalski', '600100200') returning id as g1 \gset
insert into public.guests (event_id, group_id, first_name) values (:'ev', :'grp', 'Ola') returning id as g2 \gset
insert into public.guests (event_id, is_plus_one) values (:'ev', true) returning id as g3 \gset
insert into public.guests (event_id, first_name) values (:'ev2', 'Obcy') returning id as gx \gset

-- EDITOR saves a layout -----------------------------------------------------------
select pg_temp.act_as(:E);
select public.save_seating_layout(
  :'ev',
  '{"width": 2400, "height": 1400}',
  '[{"id": null, "name": "Stół 1", "shape": "RECT", "capacity": 4, "x": 500, "y": 400, "rotation": 0, "seat_config": {"sides": "both"}},
    {"id": null, "name": "Stół 2", "shape": "L", "capacity": 6, "x": 1200, "y": 400, "rotation": 90, "seat_config": {}}]',
  '[{"label": "Parkiet", "x": 1200, "y": 1100, "width": 800, "height": 400, "rotation": 0}]'
) as saved \gset
select ok((select jsonb_array_length(:'saved'::jsonb -> 'table_ids') = 2), 'save returns ids of both tables');
select (:'saved'::jsonb -> 'table_ids' ->> 0) as t1 \gset
select (:'saved'::jsonb -> 'table_ids' ->> 1) as t2 \gset
select ok((select shape = 'L' and rotation = 90 and capacity = 6 from public.seating_tables where id = :'t2'), 'table layout stored');
select ok((select width = 2400 and not is_published from public.seating_rooms where event_id = :'ev'), 'room stored, not published');
select ok((select count(*) = 1 from public.seating_landmarks where event_id = :'ev'), 'landmark stored');

-- landmark drawing order follows the saved list
select public.save_seating_layout(
  :'ev', '{"width": 2400, "height": 1400}',
  format('[{"id": "%s", "name": "Stół 1", "shape": "RECT", "capacity": 4, "x": 500, "y": 400, "rotation": 0, "seat_config": {"sides": "both"}},
           {"id": "%s", "name": "Stół 2", "shape": "L", "capacity": 6, "x": 1200, "y": 400, "rotation": 90, "seat_config": {}}]', :'t1', :'t2')::jsonb,
  '[{"label": "Scena", "x": 100, "y": 100, "width": 400, "height": 200, "rotation": 0},
    {"label": "Parkiet", "x": 200, "y": 200, "width": 400, "height": 200, "rotation": 0},
    {"label": "Bar", "x": 300, "y": 300, "width": 100, "height": 100, "rotation": 0}]'
) \g /dev/null
select is(
  (select string_agg(l ->> 'label', ',') from jsonb_array_elements(public.get_seating_plan(:'ev') -> 'landmarks') l),
  'Scena,Parkiet,Bar', 'landmarks returned in saved order');

-- assign_seat ---------------------------------------------------------------------
select lives_ok(format($$select public.assign_seat(%L, %L, 1)$$, :'g1', :'t1'), 'editor seats a guest');
select lives_ok(format($$select public.assign_seat(%L, %L, 4)$$, :'g2', :'t1'), 'editor seats second guest');
select throws_ok(format($$select public.assign_seat(%L, %L, 5)$$, :'g3', :'t1'), '22023', null, 'seat above capacity rejected');
select throws_ok(format($$update public.guests set table_id = %L, seat_number = 5 where id = %L$$, :'t1', :'g3'), '23514', null, 'direct write above capacity rejected');
select throws_ok(format($$select public.assign_seat(%L, %L, 1)$$, :'gx', :'t1'), 'PT404', null, 'guest of another event invisible');

-- swap: g2 (t1#4) onto g1's seat (t1#1)
select public.assign_seat(:'g2', :'t1', 1);
select ok((select seat_number = 1 from public.guests where id = :'g2') and (select seat_number = 4 and table_id = :'t1' from public.guests where id = :'g1'), 'occupied seat swaps guests');

-- unseated guest onto an occupied seat: the occupant becomes unseated
select public.assign_seat(:'g3', :'t1', 4);
select ok((select table_id is null and seat_number is null from public.guests where id = :'g1'), 'occupant of target seat unseated');
select public.assign_seat(:'g1', :'t2', 6);

-- unseat
select public.assign_seat(:'g3');
select ok((select table_id is null from public.guests where id = :'g3'), 'guest unseated');

-- dry run: shrinking t2 to 5 seats and deleting t1 ----------------------------------
select public.save_seating_layout(
  :'ev', '{"width": 2400, "height": 1400}',
  format('[{"id": "%s", "name": "Stół 2", "shape": "L", "capacity": 5, "x": 1200, "y": 400, "rotation": 90, "seat_config": {}}]', :'t2')::jsonb,
  '[]', true
) as dry \gset
select ok((select jsonb_array_length(:'dry'::jsonb -> 'unseated') = 2), 'dry run reports two guests to unseat');
select ok((select count(*) = 2 from public.seating_tables where event_id = :'ev'), 'dry run changes nothing');
select ok((select table_id = :'t2' from public.guests where id = :'g1'), 'dry run keeps seats');

select public.save_seating_layout(
  :'ev', '{"width": 2400, "height": 1400}',
  format('[{"id": "%s", "name": "Stół 2", "shape": "L", "capacity": 5, "x": 1200, "y": 400, "rotation": 90, "seat_config": {}}]', :'t2')::jsonb,
  '[]'
) \g /dev/null
select ok((select count(*) = 1 from public.seating_tables where event_id = :'ev'), 'missing table deleted');
select ok((select count(*) = 0 from public.guests where event_id = :'ev' and table_id is not null), 'guests above capacity and at deleted table unseated');
select ok((select count(*) = 0 from public.seating_landmarks where event_id = :'ev'), 'landmarks replaced');

select throws_ok(
  format($$select public.save_seating_layout(%L, '{"width": 2000, "height": 1200}', '[{"id": "%s", "name": "X", "shape": "RECT", "capacity": 4, "x": 1, "y": 1, "rotation": 0}]', '[]')$$, :'ev', gen_random_uuid()),
  'PT404', null, 'unknown table id rejected');
select throws_ok(
  format($$select public.save_seating_layout(%L, '{"width": 2000, "height": 1200}', '[{"id": null, "name": "X", "shape": "RECT", "capacity": 61, "x": 1, "y": 1, "rotation": 0}]', '[]')$$, :'ev'),
  '23514', null, 'capacity above 60 rejected');

-- publish ------------------------------------------------------------------------------
select pg_temp.act_as(:G);
select ok(public.get_seating_plan(:'ev') is null, 'guest gets no plan before publishing');
select throws_ok(format($$select public.save_seating_layout(%L, '{"width": 2000, "height": 1200}', '[]', '[]')$$, :'ev'), 'PT403', null, 'guest cannot save layout');
select throws_ok(format($$select public.set_seating_published(%L, true)$$, :'ev'), 'PT403', null, 'guest cannot publish');
select throws_ok(format($$select public.assign_seat(%L, %L, 1)$$, :'g1', :'t2'), 'PT404', null, 'guest cannot seat guests');
select ok((select count(*) = 0 from public.seating_rooms) and (select count(*) = 0 from public.seating_landmarks), 'guest reads no room / landmarks directly');

select pg_temp.act_as(:E);
select ok((public.get_seating_plan(:'ev') ->> 'is_published')::boolean = false, 'editor previews unpublished plan');
select public.assign_seat(:'g1', :'t2', 1);
select public.set_seating_published(:'ev', true);

select pg_temp.act_as(:G);
select ok((public.get_seating_plan(:'ev') -> 'seats' -> 0 ->> 'guest_name') = 'Jan Kowalski', 'guest sees seated names after publishing');
select ok(not (public.get_seating_plan(:'ev') -> 'seats' -> 0 ? 'phone'), 'no contact data in the guest view');
select ok(not (public.get_seating_plan(:'ev') -> 'tables' -> 0 ? 'notes'), 'no internal notes in the guest view');

select pg_temp.act_as(:O);
select throws_ok(format($$select public.get_seating_plan(%L)$$, :'ev'), 'PT403', null, 'outsider cannot read the plan');
select throws_ok(format($$select public.save_seating_layout(%L, '{"width": 2000, "height": 1200}', '[]', '[]')$$, :'ev'), 'PT403', null, 'outsider cannot save layout');

select pg_temp.act_as_anon();
select throws_ok(format($$select public.get_seating_plan(%L)$$, :'ev'), '42501', null, 'no session: no access to get_seating_plan');
select throws_ok(format($$select public.assign_seat(%L)$$, :'g1'), '42501', null, 'no session: no access to assign_seat');

reset role;
select * from finish();
rollback;
