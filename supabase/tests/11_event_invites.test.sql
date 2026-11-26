-- =============================================================================
-- Event invite links - who may share, check / join with a token, invited_by,
-- the guest sharing switch and revoking links with a new access code.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = super admin, B = event ADMIN, E = EDITOR, G = guest,
--         O = outsider (member of nothing), N / M = new guests (no profile).
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
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Ania"}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Obcy"}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Edytor"}'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Admin wydarzenia"}'),
  ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set G '''00000000-0000-0000-0000-00000000000b'''
\set O '''00000000-0000-0000-0000-00000000000c'''
\set E '''00000000-0000-0000-0000-00000000000d'''
\set B '''00000000-0000-0000-0000-00000000000e'''
\set N '''00000000-0000-0000-0000-00000000000f'''
\set M '''00000000-0000-0000-0000-000000000010'''

select pg_temp.act_as(:A);
select public.create_event('Wesele', 'abc123') as ev \gset

select pg_temp.act_as(:G);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:B);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');
select public.set_member_role(:'ev', :B, 'ADMIN');

-- no direct table access ------------------------------------------------------------
select pg_temp.act_as(:B);
select throws_ok($$select * from public.event_invites$$, '42501', null, 'event_invites not readable by clients');
select throws_ok(
  format($$insert into public.event_invites (token, event_id, created_by) values ('aaaaaaaaaaaaaaaaaaaaaa', %L, %L)$$, :'ev', :B),
  '42501', null, 'event_invites not writable by clients'
);

-- who may share ---------------------------------------------------------------------
select pg_temp.act_as(:G);
select public.get_my_invite_token(:'ev') as tg \gset
select ok(:'tg' ~ '^[A-Za-z0-9_-]{22}$', 'guest gets a 22-char URL-safe token');
select is(public.get_my_invite_token(:'ev'), :'tg'::text, 'same token on the next call');

select pg_temp.act_as(:B);
select public.get_my_invite_token(:'ev') as tb \gset
select isnt(:'tb'::text, :'tg'::text, 'each member has their own token');

select pg_temp.act_as(:A);
select public.get_my_invite_token(:'ev') as ta \gset
select ok(:'ta' is not null, 'super admin can share without membership');

select pg_temp.act_as(:O);
select throws_ok(format($$select public.get_my_invite_token(%L)$$, :'ev'), 'PT403', null, 'outsider cannot share');

-- check / join ------------------------------------------------------------------------
select pg_temp.act_as(:N);
select results_eq(
  format($$select event_id, event_name, inviter_name from public.check_invite(%L)$$, :'tg'),
  format($$values (%L::uuid, 'Wesele'::text, 'Ania'::text)$$, :'ev'),
  'check_invite returns the event and the inviter name'
);
select ok(
  (select count(*) = 0 from public.event_members where event_id = :'ev' and user_id = :N),
  'check_invite does not join'
);
select throws_ok(format($$select * from public.join_event_by_invite(%L)$$, :'tg'), 'PT400', null, 'new guest must give a nickname');
select is(
  (select role::text from public.join_event_by_invite(:'tg', 'Nowy')),
  'GUEST'::text, 'new guest joins through the link'
);

select pg_temp.act_as(:A);
select is(
  (select invited_by from public.event_members where event_id = :'ev' and user_id = :N),
  :G::uuid, 'invited_by records the inviter'
);
select is(
  (select inviter_name from public.list_event_members_admin(:'ev') where user_id = :N),
  'Ania'::text, 'admin member list shows the inviter name'
);

-- an existing member keeps their membership as it was
select pg_temp.act_as(:E);
select is((select role::text from public.join_event_by_invite(:'tg')), 'EDITOR'::text, 'existing member keeps role');
select pg_temp.act_as(:A);
select ok(
  (select invited_by is null from public.event_members where event_id = :'ev' and user_id = :E),
  'existing membership gets no invited_by'
);

-- inviting through one's own link records nothing
select pg_temp.act_as(:G);
select count(*) from public.join_event_by_invite(:'tg') \g /dev/null
select pg_temp.act_as(:A);
select ok(
  (select invited_by is null from public.event_members where event_id = :'ev' and user_id = :G),
  'own link does not set invited_by'
);

-- invalid tokens --------------------------------------------------------------------
select pg_temp.act_as(:O);
select is((select count(*)::int from public.check_invite('zzzzzzzzzzzzzzzzzzzzzz')), 0, 'unknown token: no rows');
select is((select count(*)::int from public.check_invite('bad token')), 0, 'malformed token: no rows');
select is((select count(*)::int from public.join_event_by_invite('zzzzzzzzzzzzzzzzzzzzzz')), 0, 'unknown token: no join');

-- guest sharing switch -------------------------------------------------------------
select pg_temp.act_as(:B);
select throws_ok(format($$select public.set_event_guest_sharing(%L, false)$$, :'ev'), 'PT403', null, 'event ADMIN cannot flip the switch');

select pg_temp.act_as(:A);
select public.set_event_guest_sharing(:'ev', false);
select is((public.get_event_page(:'ev') -> 'event' ->> 'guest_sharing_enabled')::boolean, false, 'get_event_page exposes the switch');

select pg_temp.act_as(:G);
select throws_ok(format($$select public.get_my_invite_token(%L)$$, :'ev'), 'PT403', null, 'guest cannot share when switched off');

select pg_temp.act_as(:M);
select is((select count(*)::int from public.check_invite(:'tg')), 0, 'guest link stops working when switched off');
select is((select count(*)::int from public.check_invite(:'tb')), 1, 'ADMIN link still works when switched off');

select pg_temp.act_as(:E);
select ok(public.get_my_invite_token(:'ev') is not null, 'EDITOR can share when switched off');

select pg_temp.act_as(:A);
select public.set_event_guest_sharing(:'ev', true);
select pg_temp.act_as(:M);
select is((select count(*)::int from public.check_invite(:'tg')), 1, 'guest link works again when switched on');

-- removed member's link -------------------------------------------------------------
select pg_temp.act_as(:A);
select public.remove_member(:'ev', :G);
select pg_temp.act_as(:M);
select is((select count(*)::int from public.check_invite(:'tg')), 0, 'link of a removed member stops working');

-- new access code revokes links ------------------------------------------------------
select pg_temp.act_as(:A);
select public.set_event_access_code(:'ev', 'nowy-kod');
select pg_temp.act_as(:M);
select is((select count(*)::int from public.check_invite(:'tb')), 0, 'new access code revokes links');
select pg_temp.act_as(:B);
select isnt(public.get_my_invite_token(:'ev'), :'tb'::text, 'member gets a new token after a code change');

-- rate limit shared with access codes ----------------------------------------------
select pg_temp.act_as(:O);
-- O already has 3 failed attempts (invalid tokens above) - 7 more reach the limit of 10.
do $$ begin for i in 1..7 loop perform * from public.check_invite('yyyyyyyyyyyyyyyyyyyyyy'); end loop; end $$;
select throws_ok($$select * from public.check_invite('yyyyyyyyyyyyyyyyyyyyyy')$$, 'PT429', null, 'too many bad links blocked');
select throws_ok($$select * from public.check_event_code('nowy-kod')$$, 'PT429', null, 'limit shared with access codes');

-- no session -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('role', 'anon', true);
select throws_ok($$select * from public.check_invite('zzzzzzzzzzzzzzzzzzzzzz')$$, '42501', null, 'anon cannot call check_invite');

select * from finish();
rollback;
