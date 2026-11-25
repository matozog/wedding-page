-- =============================================================================
-- "Whose guest" - inviters from the guest list.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin (event ADMIN), E = EDITOR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

grant execute on function pg_temp.act_as(uuid) to public;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Edytor"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set E '''00000000-0000-0000-0000-00000000000d'''

select pg_temp.act_as(:A);
select public.create_event('Urodziny', 'abc123') as ev \gset
select public.create_event('Inne', 'xyz789') as ev2 \gset
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');

-- schema --------------------------------------------------------------------------
select hasnt_column('public', 'guests', 'side', 'side column removed');
select hasnt_type('public', 'guest_side', 'guest_side type removed');

-- setup -----------------------------------------------------------------------------
insert into public.guests (event_id, first_name, is_inviter) values (:'ev', 'Jubilat', true) returning id as host \gset
insert into public.guests (event_id, first_name, is_inviter) values (:'ev', 'Kasia', true) returning id as kasia \gset
insert into public.guests (event_id, first_name) values (:'ev', 'Zwykły') returning id as plain \gset
insert into public.guests (event_id, first_name, is_inviter) values (:'ev2', 'Obcy', true) returning id as foreign_host \gset

-- references ------------------------------------------------------------------------
insert into public.guests (event_id, first_name, invited_by_guest_id) values (:'ev', 'Tomek', :'kasia') returning id as tomek \gset
select ok((select invited_by_guest_id = :'kasia' from public.guests where id = :'tomek'), 'guest invited by an inviter');

update public.guests set invited_by_guest_id = :'host' where id = :'kasia';
select ok((select invited_by_guest_id = :'host' from public.guests where id = :'kasia'), 'inviter can be invited by another inviter');

select throws_ok(format($$insert into public.guests (event_id, first_name, invited_by_guest_id) values (%L, 'X', %L)$$, :'ev', :'plain'), 'PT400', null, 'non-inviter cannot be referenced');
select throws_ok(format($$insert into public.guests (event_id, first_name, invited_by_guest_id) values (%L, 'X', %L)$$, :'ev', :'foreign_host'), '23503', null, 'inviter from another event rejected');
select throws_ok(format($$update public.guests set invited_by_guest_id = id where id = %L$$, :'host'), '23514', null, 'cannot invite oneself');
select throws_ok(format($$insert into public.guests (event_id, first_name, invited_by_guest_id, invited_jointly) values (%L, 'X', %L, true)$$, :'ev', :'host'), '23514', null, 'inviter and "jointly" are exclusive');
select lives_ok(format($$insert into public.guests (event_id, first_name, invited_jointly) values (%L, 'Wspólny', true)$$, :'ev'), '"jointly" alone accepted');

-- group default ---------------------------------------------------------------------
insert into public.guest_groups (event_id, name, default_inviter_id) values (:'ev', 'Znajomi Kasi', :'kasia') returning id as grp \gset
select ok((select default_inviter_id = :'kasia' from public.guest_groups where id = :'grp'), 'group default inviter');
select throws_ok(format($$insert into public.guest_groups (event_id, name, default_inviter_id) values (%L, 'X', %L)$$, :'ev', :'plain'), 'PT400', null, 'group default must be an inviter');

-- EDITOR edits guests (seating) -------------------------------------------------------
select pg_temp.act_as(:E);
update public.guests set last_name = 'Edytowana' where id = :'kasia';
select pg_temp.act_as(:A);
select ok((select last_name = 'Edytowana' from public.guests where id = :'kasia'), 'editor edits a guest');

-- unflag / delete releases references ----------------------------------------------------
update public.guests set is_inviter = false where id = :'kasia';
select ok((select invited_by_guest_id is null from public.guests where id = :'tomek'), 'unflagging inviter releases their guests');
select ok((select default_inviter_id is null from public.guest_groups where id = :'grp'), 'unflagging inviter releases group default');
select ok((select invited_by_guest_id = :'host' from public.guests where id = :'kasia'), 'unflagged person keeps own inviter');

delete from public.guests where id = :'host';
select ok((select invited_by_guest_id is null from public.guests where id = :'kasia'), 'deleting inviter releases their guests');
select ok((select count(*) = 4 from public.guests where event_id = :'ev'), 'only the deleted inviter is gone');

-- update_guest_group ------------------------------------------------------------------
select has_function('public', 'update_guest_group', array['uuid', 'text', 'boolean', 'text', 'uuid', 'boolean'], 'update_guest_group exists');
select ok(not has_function_privilege('anon', 'public.update_guest_group(uuid, text, boolean, text, uuid, boolean)', 'execute'), 'anon cannot execute update_guest_group');

insert into public.guests (event_id, first_name, is_inviter) values (:'ev', 'Gospodyni', true) returning id as hostess \gset
insert into public.guest_groups (event_id, name) values (:'ev', 'Rodzina') returning id as fam \gset
update public.guests set group_id = :'fam', invited_jointly = false, invited_by_guest_id = null where id in (:'tomek', :'hostess');
insert into public.guests (event_id, first_name, group_id, invited_jointly) values (:'ev', 'Ola', :'fam', true) returning id as ola \gset

-- name + inviter, applied to members (except the inviter themselves)
select lives_ok(format($$select public.update_guest_group(%L, 'Rodzina G.', false, 'ul. Polna 1', %L, true)$$, :'fam', :'hostess'), 'admin updates group with members');
select ok((select name = 'Rodzina G.' and address = 'ul. Polna 1' and default_inviter_id = :'hostess' and not default_invited_jointly
           from public.guest_groups where id = :'fam'), 'group fields saved');
select ok((select count(*) = 2 from public.guests where group_id = :'fam' and invited_by_guest_id = :'hostess' and not invited_jointly), 'members get the inviter');
select ok((select invited_by_guest_id is null from public.guests where id = :'hostess'), 'inviter is not invited by themselves');

-- without apply_to_members the members stay as they are
select lives_ok(format($$select public.update_guest_group(%L, 'Rodzina G.', true)$$, :'fam'), 'group "jointly" without members');
select ok((select default_invited_jointly and default_inviter_id is null and address is null from public.guest_groups where id = :'fam'), 'group set to jointly, nulls applied');
select ok((select invited_by_guest_id = :'hostess' from public.guests where id = :'ola'), 'members untouched without apply_to_members');

-- atomic: a non-inviter fails the whole call, the group is not changed either
select throws_ok(format($$select public.update_guest_group(%L, 'Zła', false, null, %L, true)$$, :'fam', :'plain'), 'PT400', null, 'non-inviter rejected');
select ok((select name = 'Rodzina G.' from public.guest_groups where id = :'fam'), 'group unchanged after failed call');
select ok((select invited_by_guest_id = :'hostess' from public.guests where id = :'ola'), 'members unchanged after failed call');

-- inviter from another event
select throws_ok(format($$select public.update_guest_group(%L, 'X', false, null, %L, true)$$, :'fam', :'foreign_host'), '23503', null, 'inviter from another event rejected');

-- unknown group
select throws_ok(format($$select public.update_guest_group(%L, 'X', false)$$, gen_random_uuid()), 'PT404', null, 'unknown group -> PT404');

-- EDITOR updates the group too (seating) - same RPC, RLS allows it
select pg_temp.act_as(:E);
select lives_ok(format($$select public.update_guest_group(%L, 'Edytor', false, null, null, false)$$, :'fam'), 'editor updates group');
select pg_temp.act_as(:A);
select ok((select name = 'Edytor' from public.guest_groups where id = :'fam'), 'group renamed by editor');
reset role;

select * from finish();
rollback;
