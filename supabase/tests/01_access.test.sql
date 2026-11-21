-- =============================================================================
-- Users, events, roles, photos, storage - access rules.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin, G = anonymous guest, O = outsider (other event /
-- no event), E = guest promoted to EDITOR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- helpers -------------------------------------------------------------------
create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Passes when p_sql raises any error.
create function pg_temp.expect_error(p_sql text, p_label text) returns text language plpgsql as $$
begin
  execute p_sql;
  return ok(false, p_label || ' (no error raised)');
exception
  when others then
    return ok(true, p_label || ' [' || sqlstate || ']');
end $$;

-- Migrations revoke default EXECUTE on new functions - test helpers need it
-- while acting as the authenticated / anon roles.
grant execute on function pg_temp.act_as(uuid), pg_temp.expect_error(text, text) to public;

-- users -----------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{"full_name":"Admin Platformy","avatar_url":"https://x/a.png"}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}');

select ok((select count(*) = 4 from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_'), 'profile created for every auth user');
select ok((select display_name = 'Admin Platformy' and not is_anonymous from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Google name copied to profile');
select ok((select is_anonymous and display_name is null from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'anonymous profile flagged');

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set G '''00000000-0000-0000-0000-00000000000b'''
\set O '''00000000-0000-0000-0000-00000000000c'''
\set E '''00000000-0000-0000-0000-00000000000d'''

-- privileges --------------------------------------------------------------------
create function public.__probe_default_privileges() returns int language sql as 'select 1';
select ok(not has_function_privilege('anon', 'public.__probe_default_privileges()', 'execute'), 'new functions are not executable by anon by default');
select ok(not has_function_privilege('anon', 'public.join_event(text)', 'execute'), 'anon cannot execute join_event');
select ok(not has_function_privilege('authenticated', 'public.normalize_access_code(text)', 'execute'), 'internal helper not exposed to clients');

-- events ------------------------------------------------------------------------
select pg_temp.act_as(:A);
select public.create_event('Wesele W&P', 'abc123', '2027-06-12 16:00+02') as event_id \gset
select ok((select role = 'ADMIN' from public.event_members where event_id = :'event_id' and user_id = :A), 'creator becomes event ADMIN');
select pg_temp.expect_error($$select public.create_event('Duplikat', ' ABC123 ')$$, 'duplicate access code rejected (case/space-insensitive)');
select pg_temp.expect_error($$select public.create_event('Krótki', 'abc')$$, 'too short access code rejected');

select pg_temp.act_as(:G);
select pg_temp.expect_error($$select public.create_event('Gościnne', 'zzz999')$$, 'guest cannot create events');
select ok((select count(*) = 0 from public.join_event('wrong-code')), 'wrong code returns nothing');
select ok((select role = 'GUEST' from public.join_event('  Abc123')), 'guest joins with code (normalized)');
select ok((select count(*) = 1 from public.events), 'guest sees only the joined event');
select public.set_display_name('  Ciocia Basia  ');
select ok((select display_name = 'Ciocia Basia' from public.profiles where id = :G), 'set_display_name trims');
select pg_temp.expect_error($$select public.set_display_name('   ')$$, 'empty display name rejected');

-- private columns
select pg_temp.expect_error($$select email from public.profiles$$, 'guest cannot read e-mails from profiles');
select pg_temp.expect_error($$select is_platform_admin from public.profiles$$, 'guest cannot read is_platform_admin');
select pg_temp.expect_error($$select access_code_hash from public.events$$, 'guest cannot read access code hash');
select ok((select count(*) = 1 from public.profiles where id = :A and display_name = 'Admin Platformy'), 'guest reads public profile columns of co-members');

-- privilege escalation attempts
select pg_temp.expect_error(format($$update public.event_members set role = 'ADMIN' where user_id = %L$$, :G), 'guest cannot update own role directly');
select pg_temp.expect_error($$update public.profiles set is_platform_admin = true$$, 'guest cannot make self platform admin');
select pg_temp.expect_error(format($$insert into public.event_members (event_id, user_id) values (%L, %L)$$, :'event_id', :O), 'guest cannot insert memberships');
select pg_temp.expect_error(format($$select public.set_member_role(%L, %L, 'ADMIN')$$, :'event_id', :G), 'guest cannot call set_member_role');

-- photos
insert into public.photos (event_id, storage_path, thumbnail_storage_path, original_filename, mime_type, size_bytes)
values (:'event_id', :'event_id' || '/' || :G || '/originals/1.jpg', :'event_id' || '/' || :G || '/thumbnails/1.jpg', '1.jpg', 'image/jpeg', 1000)
returning id as photo_id \gset
select ok((select uploaded_by = :G from public.photos where id = :'photo_id'), 'guest uploads photo (uploaded_by defaulted)');
select pg_temp.expect_error(format($$insert into public.photos (event_id, storage_path, original_filename, mime_type, size_bytes) values (%L, %L, 'x.jpg', 'image/jpeg', 1)$$, :'event_id', :'event_id' || '/' || :O || '/originals/x.jpg'), 'guest cannot write into someone else''s folder');
select pg_temp.expect_error(format($$insert into public.photos (event_id, uploaded_by, storage_path, original_filename, mime_type, size_bytes) values (%L, %L, %L, 'x.jpg', 'image/jpeg', 1)$$, :'event_id', :O, :'event_id' || '/' || :O || '/originals/y.jpg'), 'guest cannot impersonate uploader');

-- storage
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner_id) values ('photos', %L, %L)$$, :'event_id' || '/' || :G || '/originals/1.jpg', :G), 'guest uploads file into own folder');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'event_id' || '/' || :O || '/originals/z.jpg'), 'guest cannot upload into another user''s folder');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('photos', 'not-a-uuid/x/y.jpg')$$, 'malformed storage path rejected');

-- outsider ----------------------------------------------------------------------
select pg_temp.act_as(:O);
select ok((select count(*) = 0 from public.events), 'outsider sees no events');
select ok((select count(*) = 0 from public.photos), 'outsider sees no photos');
select ok((select count(*) = 0 from storage.objects where bucket_id = 'photos'), 'outsider sees no files');
select ok((select count(*) = 1 from public.profiles), 'outsider sees only own profile');
select pg_temp.expect_error(format($$insert into public.photos (event_id, storage_path, original_filename, mime_type, size_bytes) values (%L, %L, 'x.jpg', 'image/jpeg', 1)$$, :'event_id', :'event_id' || '/' || :O || '/originals/o.jpg'), 'outsider cannot add photos');
delete from public.photos;

-- rate limit: 10 failed attempts then blocked
select count(*) from (select public.join_event('bad-' || g) from generate_series(1, 10) g) s \g /dev/null
select throws_ok($$select * from public.join_event('abc123')$$, 'PT429', null, '11th attempt blocked by rate limit (even with the right code)');

-- roles -------------------------------------------------------------------------
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
delete from public.photos where id = :'photo_id';
select ok((select count(*) = 1 from public.photos), 'GUEST cannot delete others'' photos');

select pg_temp.act_as(:A);
select public.set_member_role(:'event_id', :E, 'EDITOR');
select throws_ok(format($$select public.set_member_role(%L, %L, 'GUEST')$$, :'event_id', :A), 'PT409', null, 'last ADMIN cannot demote self');
select throws_ok(format($$select public.remove_member(%L, %L)$$, :'event_id', :A), 'PT409', null, 'last ADMIN cannot leave');
select ok((select count(*) >= 4 from public.profiles), 'platform admin sees all profiles');

select pg_temp.act_as(:G);
select ok((select count(*) = 3 from public.profiles), 'guest sees co-members profiles (self, admin, editor)');

select pg_temp.act_as(:E);
delete from public.photos where id = :'photo_id';
select ok((select count(*) = 0 from public.photos), 'EDITOR deletes guest photo');

-- anonymous -> Google (linkIdentity) ------------------------------------------------
reset role;
update auth.users set is_anonymous = false, email = 'basia@example.com',
  raw_user_meta_data = '{"full_name":"Barbara Nowak","avatar_url":"https://x/b.png"}'
where id = :G;
select ok((select email = 'basia@example.com' and not is_anonymous and display_name = 'Ciocia Basia' and avatar_url = 'https://x/b.png' from public.profiles where id = :G),
  'link Google: email/flag/avatar synced, chosen display name kept');
select ok((select count(*) = 1 from public.event_members where user_id = :G), 'link Google: membership kept (same uid)');

-- anon role (no session) gets nothing
set local role anon;
select pg_temp.expect_error($$select id from public.events$$, 'anon role cannot read events');
select pg_temp.expect_error($$select * from public.join_event('abc123')$$, 'anon role cannot call join_event');
reset role;

select * from finish();
rollback;
