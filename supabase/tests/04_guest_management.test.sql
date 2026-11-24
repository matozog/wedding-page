-- =============================================================================
-- Guest management panel - attendance, addresses, ADMIN-only writes,
-- delete_guest_group().
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin (event ADMIN), E = EDITOR, G = guest,
-- O = outsider, B = ADMIN of the event only (not platform admin).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.expect_error(p_sql text, p_label text) returns text language plpgsql as $$
begin
  execute p_sql;
  return ok(false, p_label || ' (no error raised)');
exception
  when others then
    return ok(true, p_label || ' [' || sqlstate || ']');
end $$;

grant execute on function pg_temp.act_as(uuid), pg_temp.expect_error(text, text) to public;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Gość"}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Obcy"}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Edytor"}'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Admin wydarzenia"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set G '''00000000-0000-0000-0000-00000000000b'''
\set O '''00000000-0000-0000-0000-00000000000c'''
\set E '''00000000-0000-0000-0000-00000000000d'''
\set B '''00000000-0000-0000-0000-00000000000e'''

select pg_temp.act_as(:A);
select public.create_event('Wesele', 'abc123') as ev \gset
select public.create_event('Inne', 'xyz789') as ev2 \gset

select pg_temp.act_as(:G);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:B);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');
select public.set_member_role(:'ev', :B, 'ADMIN');

-- schema -----------------------------------------------------------------------
select hasnt_column('public', 'guests', 'rsvp_status', 'rsvp_status replaced');
select ok(
  (select column_default like '''UNKNOWN''::%' and is_nullable = 'NO'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'guests' and column_name = 'attendance'),
  'attendance is not null and defaults to UNKNOWN'
);

-- event ADMIN (not platform admin) manages the list ------------------------------
select pg_temp.act_as(:B);
insert into public.guest_groups (event_id, name, address, side)
values (:'ev', 'Kowalscy', 'ul. Polna 1, 00-001 Warszawa', 'BRIDE') returning id as grp \gset
insert into public.guests (event_id, group_id, first_name, last_name, attendance)
values (:'ev', :'grp', 'Jan', 'Kowalski', 'LIKELY') returning id as g1 \gset
insert into public.guests (event_id, group_id, first_name, address)
values (:'ev', :'grp', 'Ola', 'ul. Inna 2') returning id as g2 \gset
insert into public.guests (event_id, first_name) values (:'ev', 'Solo') returning id as g3 \gset
select ok((select count(*) = 3 from public.guests where event_id = :'ev'), 'event admin adds group and guests');
select ok((select attendance = 'UNKNOWN' from public.guests where id = :'g3'), 'new guest has UNKNOWN attendance');

update public.guests set attendance = 'CONFIRMED', phone = '600 100 200' where id = :'g1';
select ok((select attendance = 'CONFIRMED' from public.guests where id = :'g1'), 'event admin edits guest');

select throws_ok(format($$insert into public.guests (event_id, first_name) values (%L, %L)$$, :'ev', repeat('x', 81)), '23514', null, 'too long first name rejected');
select throws_ok(format($$update public.guests set address = %L where id = %L$$, repeat('x', 301), :'g1'), '23514', null, 'too long address rejected');
select throws_ok(format($$update public.guests set attendance = 'MAYBE' where id = %L$$, :'g1'), '22P02', null, 'unknown attendance value rejected');

-- EDITOR: read-only --------------------------------------------------------------
select pg_temp.act_as(:E);
select ok((select count(*) = 3 from public.guests), 'editor sees guests');
select ok((select count(*) = 1 from public.guest_groups), 'editor sees groups');
select pg_temp.expect_error(format($$insert into public.guests (event_id, first_name) values (%L, 'X')$$, :'ev'), 'editor cannot add guest');
select pg_temp.expect_error(format($$insert into public.guest_groups (event_id, name) values (%L, 'X')$$, :'ev'), 'editor cannot add group');
update public.guests set first_name = 'Hacked' where id = :'g1';
update public.guest_groups set name = 'Hacked' where id = :'grp';
delete from public.guests where id = :'g3';
select throws_ok(format($$select public.delete_guest_group(%L, true)$$, :'grp'), 'PT404', null, 'editor cannot delete group via RPC');

-- GUEST / outsider -----------------------------------------------------------------
select pg_temp.act_as(:G);
select ok((select count(*) = 0 from public.guests) and (select count(*) = 0 from public.guest_groups), 'guest sees no guest list');
select throws_ok(format($$select public.delete_guest_group(%L, true)$$, :'grp'), 'PT404', null, 'guest cannot delete group');
select pg_temp.act_as(:O);
select ok((select count(*) = 0 from public.guests), 'outsider sees no guests');

-- event ADMIN of another event cannot touch this one ---------------------------------
select pg_temp.act_as(:A);
insert into public.guest_groups (event_id, name) values (:'ev2', 'Obcy') returning id as grp2 \gset
select pg_temp.act_as(:B);
select throws_ok(format($$select public.delete_guest_group(%L)$$, :'grp2'), 'PT404', null, 'admin of event cannot delete group of other event');
select pg_temp.expect_error(format($$insert into public.guests (event_id, first_name) values (%L, 'X')$$, :'ev2'), 'admin of event cannot add guest to other event');

-- nothing changed by the read-only roles -------------------------------------------
select ok((select first_name = 'Jan' from public.guests where id = :'g1'), 'editor could not edit guest');
select ok((select name = 'Kowalscy' from public.guest_groups where id = :'grp'), 'editor could not rename group');
select ok((select count(*) = 1 from public.guests where id = :'g3'), 'editor could not delete guest');

-- delete_guest_group ------------------------------------------------------------------
insert into public.guest_groups (event_id, name) values (:'ev', 'Nowakowie') returning id as grp3 \gset
insert into public.guests (event_id, group_id, first_name) values (:'ev', :'grp3', 'Adam') returning id as g4 \gset
select is(public.delete_guest_group(:'grp3'), 0, 'delete group without members returns 0');
select ok((select group_id is null from public.guests where id = :'g4'), 'members stay, ungrouped');

select is(public.delete_guest_group(:'grp', true), 2, 'delete group with members returns 2');
select ok((select count(*) = 0 from public.guests where id in (:'g1', :'g2')), 'members deleted with group');
select ok((select count(*) = 1 from public.guests where id = :'g3'), 'guests outside the group untouched');
select throws_ok(format($$select public.delete_guest_group(%L)$$, :'grp'), 'PT404', null, 'deleting missing group raises PT404');
reset role;

select * from finish();
rollback;
