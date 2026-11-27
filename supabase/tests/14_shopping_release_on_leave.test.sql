-- =============================================================================
-- Shopping list - assignments are released when a person stops being a member
-- of the event (removed by the ADMIN or leaving on their own).
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: S = super admin (not a member), D = ADMIN of the event,
-- G1 / G2 / G3 = anonymous guests.
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
  ('00000000-0000-0000-0000-0000000014a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super14@example.com', false, '{"full_name":"Super"}'),
  ('00000000-0000-0000-0000-0000000014d0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'para14@example.com', false, '{"full_name":"Para"}'),
  ('00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Ala"}'),
  ('00000000-0000-0000-0000-0000000014b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Ola"}'),
  ('00000000-0000-0000-0000-0000000014b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Ela"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-0000000014a0';

\set S '''00000000-0000-0000-0000-0000000014a0'''
\set D '''00000000-0000-0000-0000-0000000014d0'''
\set G1 '''00000000-0000-0000-0000-0000000014b1'''
\set G2 '''00000000-0000-0000-0000-0000000014b2'''
\set G3 '''00000000-0000-0000-0000-0000000014b3'''

select ok(not has_function_privilege('authenticated', 'public.release_shopping_assignments()', 'execute'),
          'trigger function not callable by clients');

-- setup -------------------------------------------------------------------------------
select pg_temp.act_as(:S);
select public.create_event('Ognisko', 'kod-ogn14') as ev \gset
select public.create_event('Drugie', 'kod-dru14') as ev2 \gset

select pg_temp.act_as(:D);
select count(*) from public.join_event('kod-ogn14') \g /dev/null
select pg_temp.act_as(:G1);
select count(*) from public.join_event('kod-ogn14') \g /dev/null
select count(*) from public.join_event('kod-dru14') \g /dev/null
select pg_temp.act_as(:G2);
select count(*) from public.join_event('kod-ogn14') \g /dev/null
select pg_temp.act_as(:G3);
select count(*) from public.join_event('kod-ogn14') \g /dev/null
select pg_temp.act_as(:S);
select public.set_member_role(:'ev', :D, 'ADMIN');
select public.set_event_section_visibility(:'ev', 'shopping', true);
select public.set_event_section_visibility(:'ev2', 'shopping', true);

-- entries: G1 takes "Kiełbaski" (ev) and "Chleb" (ev2), G2 takes "Napoje",
-- the super admin takes "Drewno"
select pg_temp.act_as(:D);
insert into public.event_shopping_items (event_id, name) values (:'ev', 'Kiełbaski'), (:'ev', 'Napoje'), (:'ev', 'Drewno');
select pg_temp.act_as(:G1);
insert into public.event_shopping_items (event_id, name) values (:'ev2', 'Chleb');

select id as kielbaski from public.event_shopping_items where name = 'Kiełbaski' \gset
select id as napoje from public.event_shopping_items where name = 'Napoje' \gset
select id as drewno from public.event_shopping_items where name = 'Drewno' \gset
select id as chleb from public.event_shopping_items where name = 'Chleb' \gset

select pg_temp.act_as(:G1);
select public.assign_shopping_item(:'kielbaski');
select public.assign_shopping_item(:'chleb');
select pg_temp.act_as(:G2);
select public.assign_shopping_item(:'napoje');
select pg_temp.act_as(:S);
select public.assign_shopping_item(:'drewno');

select updated_at as before_remove from public.event_shopping_items where id = :'kielbaski' \gset

-- ADMIN removes a guest ---------------------------------------------------------------
select pg_temp.act_as(:D);
select lives_ok(format($$select public.remove_member(%L, %L)$$, :'ev', :G1), 'ADMIN removes a guest');
reset role;
select ok((select assigned_to is null from public.event_shopping_items where id = :'kielbaski'),
          'removed guest: their entry is free again');
select ok((select updated_at = :'before_remove'::timestamptz from public.event_shopping_items where id = :'kielbaski'),
          'releasing does not change updated_at');
select ok((select assigned_to = :G2 from public.event_shopping_items where id = :'napoje'),
          'assignments of other people stay');
select ok((select assigned_to = :G1 from public.event_shopping_items where id = :'chleb'),
          'assignment in another event stays');
select ok((select assigned_to = :S from public.event_shopping_items where id = :'drewno'),
          'super admin assignment stays');

select pg_temp.act_as(:G3);
select lives_ok(format($$select public.assign_shopping_item(%L)$$, :'kielbaski'), 'another guest takes the released entry');
reset role;
select ok((select assigned_to = :G3 from public.event_shopping_items where id = :'kielbaski'), 'entry assigned to the other guest');

-- a guest leaves on their own ---------------------------------------------------------
select pg_temp.act_as(:G2);
select lives_ok(format($$select public.remove_member(%L, %L)$$, :'ev', :G2), 'guest leaves the event');
reset role;
select ok((select assigned_to is null from public.event_shopping_items where id = :'napoje'),
          'guest who left: their entry is free again');
select ok((select assigned_to = :G3 from public.event_shopping_items where id = :'kielbaski'),
          'remaining member keeps their assignment');

-- deleting the event still works --------------------------------------------------------
select pg_temp.act_as(:S);
select lives_ok(format($$select public.delete_event(%L)$$, :'ev'), 'event with assigned entries can be deleted');
reset role;
select ok((select count(*) = 0 from public.event_shopping_items where event_id = :'ev'), 'entries removed with the event');

select * from finish();
rollback;
