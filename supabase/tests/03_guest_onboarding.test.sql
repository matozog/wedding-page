-- =============================================================================
-- Guest onboarding: anonymous session without a profile, code check on the
-- code screen, profile created together with the membership, cleanup.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin, N = fresh anonymous visitor (no profile),
-- W = anonymous visitor guessing codes, S = old abandoned visitor,
-- K = old anonymous guest WITH a profile, Q = Google user,
-- T = old anonymous visitor with recent session activity.
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

\set A '''00000000-0000-0000-0000-0000000000a1'''
\set N '''00000000-0000-0000-0000-0000000000a2'''
\set W '''00000000-0000-0000-0000-0000000000a3'''
\set S '''00000000-0000-0000-0000-0000000000a4'''
\set K '''00000000-0000-0000-0000-0000000000a5'''
\set Q '''00000000-0000-0000-0000-0000000000a6'''
\set T '''00000000-0000-0000-0000-0000000000a7'''

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data, created_at) values
  (:A, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{"full_name":"Admin"}', now()),
  (:N, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}', now()),
  (:W, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}', now()),
  (:S, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}', now() - interval '2 days'),
  (:K, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Wujek Kazio"}', now() - interval '2 days'),
  (:Q, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q@example.com', false, '{}', now() - interval '2 days');

-- profiles ------------------------------------------------------------------------
select ok(not exists (select 1 from public.profiles where id in (:N, :W, :S)), 'anonymous sign-in without a name creates no profile');
select ok((select display_name = 'Wujek Kazio' and is_anonymous from public.profiles where id = :K), 'anonymous sign-in with a name creates a named profile');
select ok(exists (select 1 from public.profiles where id = :Q), 'Google user always gets a profile');
select ok(exists (select 1 from cron.job where jobname = 'cleanup-abandoned-anonymous-users'), 'cleanup scheduled in pg_cron');

update public.profiles set is_platform_admin = true where id = :A;
select pg_temp.act_as(:A);
select public.create_event('Wesele', 'abc123', '2027-06-12 16:00+02') as ev \gset

-- privileges ----------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.check_event_code(text)', 'execute'), 'anon cannot execute check_event_code');
select ok(has_function_privilege('authenticated', 'public.check_event_code(text)', 'execute'), 'authenticated can execute check_event_code');
select ok(not has_function_privilege('authenticated', 'public.find_event_by_access_code(uuid, text)', 'execute'), 'code lookup helper not exposed');
select ok(not has_function_privilege('authenticated', 'public.upsert_own_profile(uuid, text)', 'execute'), 'profile helper not exposed');
select ok(not has_function_privilege('authenticated', 'public.cleanup_abandoned_anonymous_users()', 'execute'), 'cleanup not exposed');

-- code check without a profile ------------------------------------------------------
select pg_temp.act_as(:N);
select ok((select count(*) = 0 from public.check_event_code('wrong-code')), 'check_event_code: wrong code returns nothing');
select ok((select event_name = 'Wesele' from public.check_event_code(' abc123 ')), 'check_event_code: right code returns event (normalized)');
select ok(not exists (select 1 from public.event_members where user_id = :N), 'check_event_code does not join');
select ok((select count(*) = 0 from public.events), 'event still not readable before joining');

-- join ------------------------------------------------------------------------------
select throws_ok($$select * from public.join_event('abc123')$$, 'PT400', null, 'join without profile and without name rejected');
select throws_ok($$select * from public.join_event('abc123', '   ')$$, 'PT400', null, 'join with blank name rejected');
select ok((select count(*) = 0 from public.join_event('wrong-code', 'Ania')), 'join with wrong code returns nothing');
select ok(not exists (select 1 from public.profiles where id = :N), 'wrong code creates no profile');
select ok((select role = 'GUEST' from public.join_event('abc123', '  Ania  ')), 'join with name works');
select ok((select display_name = 'Ania' and is_anonymous from public.profiles where id = :N), 'profile created with trimmed name');
select ok((select count(*) = 1 from public.events), 'event readable after joining');
select ok((select role = 'GUEST' from public.join_event('abc123')), 'later join without name works (profile exists)');

-- set_display_name creates a missing profile ----------------------------------------
select pg_temp.act_as(:W);
select public.set_display_name('Zosia');
select ok((select display_name = 'Zosia' from public.profiles where id = :W), 'set_display_name creates missing profile');

-- shared rate limit -------------------------------------------------------------------
select count(*) from (select public.check_event_code('bad-' || g) from generate_series(1, 6) g) s \g /dev/null
select count(*) from (select public.join_event('bad-' || g) from generate_series(1, 4) g) s \g /dev/null
select throws_ok($$select * from public.check_event_code('abc123')$$, 'PT429', null, 'check_event_code blocked after 10 failures (shared with join_event)');
select throws_ok($$select * from public.join_event('abc123')$$, 'PT429', null, 'join_event blocked by the same limit');

-- anon role (no session) ----------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.check_event_code('abc123')$$, '42501', null, 'anon role cannot check codes');
reset role;

-- cleanup -------------------------------------------------------------------------------
-- Asserts only on fixture users - the local DB may hold other abandoned visits.
insert into public.join_attempts (user_id) values (:S);
-- T: old anonymous user without profile, but its session was refreshed recently
-- (tab left open on the nickname screen).
insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data, created_at)
values (:T, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, '{}', now() - interval '2 days');
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
values (gen_random_uuid(), :T, now() - interval '2 days', now() - interval '2 days', (now() - interval '1 hour') at time zone 'UTC');
-- S also had a session, but it went quiet 2 days ago.
insert into auth.sessions (id, user_id, created_at, updated_at)
values (gen_random_uuid(), :S, now() - interval '2 days', now() - interval '2 days');

select ok(public.cleanup_abandoned_anonymous_users() >= 1, 'cleanup reports deleted users');
select ok(not exists (select 1 from auth.users where id = :S), 'old inactive anonymous user without profile deleted');
select ok(not exists (select 1 from auth.sessions where user_id = :S), 'its sessions deleted (cascade)');
select ok(exists (select 1 from auth.users where id = :T), 'anonymous user with recent session activity kept');
select ok(not exists (select 1 from public.join_attempts where user_id = :S), 'its join attempts deleted (cascade)');
select ok(exists (select 1 from auth.users where id = :K), 'old anonymous guest with profile kept');
select ok(exists (select 1 from auth.users where id = :Q), 'Google user kept');
select ok(exists (select 1 from auth.users where id = :N), 'fresh anonymous user kept');

select * from finish();
rollback;
