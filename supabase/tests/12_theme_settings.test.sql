-- =============================================================================
-- Theme settings - custom colours, start screen theme, theme from the code.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: S = super admin, B = ADMIN of the event, G = anonymous guest
-- (joins by code), N = anonymous user without a profile (checks the code,
-- then joins by B's invite link).
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
  ('00000000-0000-0000-0000-0000000011a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super11@example.com', false, '{"full_name":"Super"}'),
  ('00000000-0000-0000-0000-0000000011b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'para11@example.com', false, '{"full_name":"Para"}'),
  ('00000000-0000-0000-0000-0000000011c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Gość"}'),
  ('00000000-0000-0000-0000-0000000011d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-0000000011a1';
-- N has no profile yet (deferred guest profile).
delete from public.profiles where id = '00000000-0000-0000-0000-0000000011d1';

\set S '''00000000-0000-0000-0000-0000000011a1'''
\set B '''00000000-0000-0000-0000-0000000011b1'''
\set G '''00000000-0000-0000-0000-0000000011c1'''
\set N '''00000000-0000-0000-0000-0000000011d1'''

-- privileges ----------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.set_start_theme(text, jsonb)', 'execute'), 'anon cannot set start theme');
select ok(not has_function_privilege('anon', 'public.set_event_theme(uuid, text, jsonb)', 'execute'), 'anon cannot set event theme');
select ok(not has_function_privilege('authenticated', 'public.clean_theme_colors(jsonb)', 'execute'), 'colour helper not exposed');
select ok(has_column_privilege('anon', 'public.app_settings', 'start_theme', 'select'), 'anon reads start theme');
select ok(not has_table_privilege('authenticated', 'public.app_settings', 'update'), 'no direct UPDATE on app settings');
select ok(not has_table_privilege('authenticated', 'public.app_settings', 'insert'), 'no direct INSERT on app settings');
select ok(not has_table_privilege('anon', 'public.app_settings', 'delete'), 'no direct DELETE on app settings');

-- validation helpers --------------------------------------------------------------
select ok(public.is_theme_colors(null), 'null colours valid');
select ok(public.is_theme_colors('{"primary":"#aabb00","accent":"#000000"}'), 'known keys, hex values valid');
select ok(not public.is_theme_colors('{"ring":"#aabb00"}'), 'unknown key invalid');
select ok(not public.is_theme_colors('{"primary":"red"}'), 'non-hex value invalid');
select ok(not public.is_theme_colors('{"primary":"#AABB00"}'), 'upper case stored value invalid (RPC lower-cases)');
select ok(not public.is_theme_colors('["#aabb00"]'), 'array invalid');
select ok(public.clean_theme_colors('{}') is null, 'empty object -> null');
select ok(public.clean_theme_colors('{"primary":"#AABB00"}') = '{"primary":"#aabb00"}', 'values lower-cased');

-- setup -------------------------------------------------------------------------------
select pg_temp.act_as(:S);
select public.create_event('Rocznica', 'kod-roc1') as ev \gset
select pg_temp.act_as(:B);
select count(*) from public.join_event('kod-roc1') \g /dev/null
select pg_temp.act_as(:S);
select public.set_member_role(:'ev', :B, 'ADMIN');

-- event theme -------------------------------------------------------------------------
select lives_ok(format($$select public.set_event_theme(%L, 'forest', '{"primary":"#C08040","background":"#101510"}')$$, :'ev'),
  'super admin sets palette + colours');
select ok((select theme = 'forest' and theme_colors = '{"primary":"#c08040","background":"#101510"}' from public.events where id = :'ev'),
  'palette and colours saved (lower case)');
select throws_ok(format($$select public.set_event_theme(%L, 'forest', '{"ring":"#000000"}')$$, :'ev'), 'PT400', null, 'unknown colour key rejected');
select throws_ok(format($$select public.set_event_theme(%L, 'forest', '{"primary":"#abc"}')$$, :'ev'), 'PT400', null, 'short hex rejected');
select throws_ok(format($$select public.set_event_theme(%L, 'neon')$$, :'ev'), 'PT400', null, 'unknown palette rejected');
select ok((select (public.get_event_page(:'ev') -> 'event' -> 'theme_colors' ->> 'primary') = '#c08040'), 'get_event_page returns colours');

select pg_temp.act_as(:B);
select throws_ok(format($$select public.set_event_theme(%L, 'sand')$$, :'ev'), 'PT403', null, 'event ADMIN cannot set theme');
select pg_temp.act_as(:S);
select ok((select theme = 'forest' and theme_colors is not null from public.events where id = :'ev'), 'theme unchanged after denied call');

select public.set_event_theme(:'ev', 'forest');
select ok((select theme_colors is null from public.events where id = :'ev'), 'palette only clears colours');
select public.set_event_theme(:'ev', 'wine', '{"accent":"#334455"}');

-- theme from the code -----------------------------------------------------------------
select pg_temp.act_as(:N);
select ok((select theme = 'wine' and theme_colors = '{"accent":"#334455"}' from public.check_event_code('kod-roc1')),
  'check_event_code returns the theme before joining');
select ok((select count(*) = 0 from public.check_event_code('zly-kod')), 'wrong code returns nothing');

select pg_temp.act_as(:G);
select ok((select theme = 'wine' and role = 'GUEST' from public.join_event('kod-roc1')), 'join_event returns the theme');

-- theme from an invite link -------------------------------------------------------
select pg_temp.act_as(:B);
select public.get_my_invite_token(:'ev') as tb \gset
select ok((select (public.get_event_page(:'ev') -> 'event') ?& array['theme_colors', 'guest_sharing_enabled']),
  'get_event_page keeps guest_sharing_enabled next to theme_colors');
select pg_temp.act_as(:N);
select ok((select theme = 'wine' and theme_colors = '{"accent":"#334455"}' and inviter_name = 'Para' from public.check_invite(:'tb')),
  'check_invite returns the theme before joining');
select ok((select theme = 'wine' and role = 'GUEST' from public.join_event_by_invite(:'tb', 'Nowy')),
  'join_event_by_invite returns the theme');
select ok((select invited_by = :B from public.event_members where event_id = :'ev' and user_id = :N),
  'invite still records who invited');

-- start theme -------------------------------------------------------------------------
select pg_temp.act_as_anon();
select ok((select start_theme = 'sand' and start_theme_colors is null from public.app_settings), 'anon reads default start theme');
select throws_ok($$select public.set_start_theme('navy')$$, '42501', null, 'anon cannot call set_start_theme');
select throws_ok($$update public.app_settings set start_theme = 'navy'$$, '42501', null, 'anon cannot update app settings');

select pg_temp.act_as(:G);
select throws_ok($$select public.set_start_theme('navy')$$, 'PT403', null, 'anonymous guest cannot set start theme');
select pg_temp.act_as(:B);
select throws_ok($$select public.set_start_theme('navy')$$, 'PT403', null, 'event ADMIN cannot set start theme');
select throws_ok($$update public.app_settings set start_theme = 'navy'$$, '42501', null, 'event ADMIN cannot update app settings directly');

select pg_temp.act_as(:S);
select lives_ok($$select public.set_start_theme('midnight', '{"primary":"#FFCC00"}')$$, 'super admin sets start theme');
select throws_ok($$select public.set_start_theme('neon')$$, 'PT400', null, 'unknown start palette rejected');
select throws_ok($$select public.set_start_theme('sand', '{"primary":1}')$$, 'PT400', null, 'non-string colour rejected');

select pg_temp.act_as(:G);
select ok((select start_theme = 'midnight' and start_theme_colors = '{"primary":"#ffcc00"}' from public.app_settings),
  'everyone sees the new start theme');

reset role;
select ok((select count(*) = 1 from public.app_settings), 'exactly one settings row');
select throws_ok($$insert into public.app_settings (id) values (false)$$, '23514', null, 'second settings row impossible');

select * from finish();
rollback;
