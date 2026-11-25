-- =============================================================================
-- Super admin - managing all events (list, create, edit, access code, delete,
-- members) and that nobody else can do it.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: S = super admin (profiles.is_platform_admin), B = ADMIN of the
-- event only, G = anonymous guest, W = Google account in no event.
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
  ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@example.com', false, '{"full_name":"Super Admin"}'),
  ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'para@example.com', false, '{"full_name":"Para Młoda"}'),
  ('00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Gość"}'),
  ('00000000-0000-0000-0000-00000000005d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ktos@example.com', false, '{"full_name":"Ktoś"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000005a';

\set S '''00000000-0000-0000-0000-00000000005a'''
\set B '''00000000-0000-0000-0000-00000000005b'''
\set G '''00000000-0000-0000-0000-00000000005c'''
\set W '''00000000-0000-0000-0000-00000000005d'''

-- privileges ----------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.list_events_admin()', 'execute'), 'anon cannot execute list_events_admin');
select ok(not has_function_privilege('anon', 'public.delete_event(uuid)', 'execute'), 'anon cannot execute delete_event');
select ok(not has_function_privilege('anon', 'public.update_event(uuid, text, timestamptz)', 'execute'), 'anon cannot execute update_event');
select ok(not has_function_privilege('anon', 'public.set_event_access_code(uuid, text)', 'execute'), 'anon cannot execute set_event_access_code');
select ok(not has_function_privilege('anon', 'public.list_event_members_admin(uuid)', 'execute'), 'anon cannot execute list_event_members_admin');
select ok(not has_function_privilege('authenticated', 'public.require_platform_admin()', 'execute'), 'require_platform_admin not exposed');
select ok(not has_function_privilege('authenticated', 'public.require_free_access_code(text, uuid)', 'execute'), 'require_free_access_code not exposed');

-- super admin: create -------------------------------------------------------------
select pg_temp.act_as(:S);
select public.create_event('Wesele A', 'kod-aaa1', '2027-06-12 16:00+02') as ev \gset
select public.create_event('Wesele B', 'kod-bbb2') as ev2 \gset
select ok((select count(*) = 0 from public.event_members where event_id = :'ev'), 'creator does not become a member');
select ok((select created_by = :S from public.events where id = :'ev'), 'created_by set');
select throws_ok($$select public.create_event('Dup', ' KOD-AAA1 ')$$, 'PT409', null, 'duplicate code rejected (normalized)');
select throws_ok($$select public.create_event('Krótki', 'abc')$$, 'PT400', null, 'too short code rejected');
select throws_ok($$select public.create_event('   ', 'kod-ccc3')$$, 'PT400', null, 'empty name rejected');

-- guests join, the couple gets ADMIN from the super admin
select pg_temp.act_as(:B);
select count(*) from public.join_event('kod-aaa1') \g /dev/null
select pg_temp.act_as(:G);
select count(*) from public.join_event('kod-aaa1') \g /dev/null

select pg_temp.act_as(:S);
select lives_ok(format($$select public.set_member_role(%L, %L, 'ADMIN')$$, :'ev', :B), 'super admin makes a member the event ADMIN');

-- list -------------------------------------------------------------------------------
select ok((select count(*) = 2 from public.list_events_admin() where id in (:'ev', :'ev2')), 'super admin lists all events');
select ok((select member_count = 2 and guest_count = 0 and photo_count = 0 from public.list_events_admin() where id = :'ev'), 'list counts members, guests, photos');
select ok((select count(*) = 2 from public.list_event_members_admin(:'ev')), 'super admin lists members');
select ok((select email = 'para@example.com' and role = 'ADMIN' from public.list_event_members_admin(:'ev') where user_id = :B), 'member list has e-mail and role, ADMIN first');

-- update ------------------------------------------------------------------------------
select public.update_event(:'ev', '  Wesele A+  ', null);
select ok((select name = 'Wesele A+' and starts_at is null from public.events where id = :'ev'), 'update_event trims name, clears date');
select throws_ok(format($$select public.update_event(%L, '', null)$$, :'ev'), 'PT400', null, 'update_event rejects empty name');
select throws_ok($$select public.update_event('00000000-0000-0000-0000-000000000999', 'X', null)$$, 'PT404', null, 'update_event on missing event');

-- access code -------------------------------------------------------------------------
select throws_ok(format($$select public.set_event_access_code(%L, 'kod-bbb2')$$, :'ev'), 'PT409', null, 'cannot take another event''s code');
select lives_ok(format($$select public.set_event_access_code(%L, 'kod-aaa1')$$, :'ev'), 'can keep own code');
select public.set_event_access_code(:'ev', 'nowy-kod9');
select pg_temp.act_as(:W);
select ok((select count(*) = 0 from public.check_event_code('kod-aaa1')), 'old code stops working');
select ok((select count(*) = 1 from public.check_event_code('NOWY-KOD9')), 'new code works');

-- nobody else ----------------------------------------------------------------------
-- event ADMIN (not super admin)
select pg_temp.act_as(:B);
select throws_ok($$select * from public.list_events_admin()$$, 'PT403', null, 'event ADMIN cannot list all events');
select throws_ok($$select public.create_event('Moje', 'kod-ddd4')$$, 'PT403', null, 'event ADMIN cannot create events');
select throws_ok(format($$select public.update_event(%L, 'Zmiana', null)$$, :'ev'), 'PT403', null, 'event ADMIN cannot edit own event via update_event');
select throws_ok(format($$select public.set_event_access_code(%L, 'kod-eee5')$$, :'ev'), 'PT403', null, 'event ADMIN cannot change the code');
select throws_ok(format($$select public.delete_event(%L)$$, :'ev'), 'PT403', null, 'event ADMIN cannot delete own event');
select throws_ok(format($$select * from public.list_event_members_admin(%L)$$, :'ev'), 'PT403', null, 'event ADMIN cannot read member e-mails');
select pg_temp.expect_error(format($$update public.events set name = 'x' where id = %L$$, :'ev'), 'event ADMIN cannot update events table directly');
select pg_temp.expect_error(format($$delete from public.events where id = %L$$, :'ev'), 'event ADMIN cannot delete from events table directly');
select ok((select count(*) = 1 from public.events), 'event ADMIN still sees only own event');

-- anonymous guest
select pg_temp.act_as(:G);
select throws_ok($$select * from public.list_events_admin()$$, 'PT403', null, 'guest cannot list all events');
select throws_ok(format($$select public.delete_event(%L)$$, :'ev'), 'PT403', null, 'guest cannot delete events');
select pg_temp.expect_error($$update public.profiles set is_platform_admin = true$$, 'guest cannot make self super admin');

-- Google account in no event (e.g. someone who found /events)
select pg_temp.act_as(:W);
select throws_ok($$select * from public.list_events_admin()$$, 'PT403', null, 'outsider cannot list events');
select throws_ok($$select public.create_event('Obce', 'kod-fff6')$$, 'PT403', null, 'outsider cannot create events');
select ok((select count(*) = 0 from public.events), 'outsider sees no events');
select ok(not public.is_platform_admin(), 'is_platform_admin false for outsider');

-- no session (anon role)
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.expect_error($$select * from public.list_events_admin()$$, 'no session: list_events_admin denied');
select pg_temp.expect_error($$select public.create_event('Anon', 'kod-ggg7')$$, 'no session: create_event denied');
reset role;

-- delete ------------------------------------------------------------------------------
select pg_temp.act_as(:S);
insert into public.photos (event_id, storage_path, original_filename, mime_type, size_bytes)
values (:'ev', :'ev' || '/' || :S || '/originals/1.jpg', '1.jpg', 'image/jpeg', 10);
insert into public.guests (event_id, first_name) values (:'ev', 'Jan');
select ok((select photo_count = 1 and guest_count = 1 from public.list_events_admin() where id = :'ev'), 'counts follow photos and guests');
select lives_ok(format($$select public.delete_event(%L)$$, :'ev'), 'super admin deletes event');
select ok((select count(*) = 0 from public.events where id = :'ev'), 'event gone');
select ok((select count(*) = 0 from public.event_members where event_id = :'ev'), 'members cascaded');
select ok((select count(*) = 0 from public.photos where event_id = :'ev'), 'photo rows cascaded');
select ok((select count(*) = 0 from public.guests where event_id = :'ev'), 'guests cascaded');
select throws_ok(format($$select public.delete_event(%L)$$, :'ev'), 'PT404', null, 'deleting twice reports missing event');
select ok((select count(*) = 1 from public.events where id = :'ev2'), 'other event untouched');

select * from finish();
rollback;
