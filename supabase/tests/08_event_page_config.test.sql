-- =============================================================================
-- Event page configuration - theme, sections, schedule, locations, contacts.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: S = super admin, B = ADMIN of the event only, G = anonymous guest,
-- O = Google account in another event.
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
  ('00000000-0000-0000-0000-00000000008a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@example.com', false, '{"full_name":"Super"}'),
  ('00000000-0000-0000-0000-00000000008b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'para@example.com', false, '{"full_name":"Para"}'),
  ('00000000-0000-0000-0000-00000000008c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Gość"}'),
  ('00000000-0000-0000-0000-00000000008d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inny@example.com', false, '{"full_name":"Inny"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000008a';

\set S '''00000000-0000-0000-0000-00000000008a'''
\set B '''00000000-0000-0000-0000-00000000008b'''
\set G '''00000000-0000-0000-0000-00000000008c'''
\set O '''00000000-0000-0000-0000-00000000008d'''

-- privileges ----------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.get_event_page(uuid)', 'execute'), 'anon cannot read page config');
select ok(not has_function_privilege('anon', 'public.save_event_schedule(uuid, text, text, text, jsonb)', 'execute'), 'anon cannot save schedule');
select ok(not has_function_privilege('authenticated', 'public.save_event_section_header(uuid, public.event_section, text, text, text)', 'execute'), 'header helper not exposed');
select ok(not has_table_privilege('authenticated', 'public.event_sections', 'update'), 'no direct UPDATE on sections');
select ok(not has_table_privilege('authenticated', 'public.event_schedule_items', 'insert'), 'no direct INSERT on schedule');
select ok(not has_table_privilege('authenticated', 'public.event_contacts', 'delete'), 'no direct DELETE on contacts');

-- setup -------------------------------------------------------------------------------
select pg_temp.act_as(:S);
select public.create_event('Urodziny', 'kod-uro1') as ev \gset
select public.create_event('Inne', 'kod-inn2') as ev2 \gset

select pg_temp.act_as(:B);
select count(*) from public.join_event('kod-uro1') \g /dev/null
select pg_temp.act_as(:G);
select count(*) from public.join_event('kod-uro1') \g /dev/null
select pg_temp.act_as(:O);
select count(*) from public.join_event('kod-inn2') \g /dev/null
select pg_temp.act_as(:S);
select public.set_member_role(:'ev', :B, 'ADMIN');

-- defaults ----------------------------------------------------------------------------
select ok((select count(*) = 6 and bool_and(is_visible) from public.event_sections where event_id = :'ev'), 'new event gets 6 visible sections');
select ok((select title = 'Plan wydarzenia' from public.event_sections where event_id = :'ev' and section = 'schedule'), 'neutral default schedule heading');
select ok((select count(*) = 0 from public.event_schedule_items where event_id = :'ev'), 'new event has no schedule points');
select ok((select theme = 'sand' from public.events where id = :'ev'), 'default theme sand');

-- super admin saves -------------------------------------------------------------------
select lives_ok(format($$select public.set_event_theme(%L, 'sage')$$, :'ev'), 'super admin sets theme');
select throws_ok(format($$select public.set_event_theme(%L, 'neon')$$, :'ev'), 'PT400', null, 'unknown theme rejected');
select lives_ok(format($$select public.set_event_section_visibility(%L, 'seating', false)$$, :'ev'), 'super admin hides a section');

select lives_ok(format($$select public.save_event_schedule(%L, ' Program ', 'Plan dnia', '', %L::jsonb)$$, :'ev',
  '[{"time_label":"18:00","title":" Kolacja ","description":""},{"time_label":"","title":"Tort"}]'), 'super admin saves schedule');
select ok((select eyebrow = 'Program' and description is null from public.event_sections where event_id = :'ev' and section = 'schedule'), 'heading trimmed, empty -> null');
select ok((select array_agg(title order by position) = array['Kolacja', 'Tort'] from public.event_schedule_items where event_id = :'ev'), 'points saved in order, trimmed');
select ok((select time_label is null and description is null from public.event_schedule_items where event_id = :'ev' and position = 1), 'empty optional fields -> null');

select public.save_event_schedule(:'ev', null, 'Plan dnia', null, '[{"title":"Tylko jeden"}]'::jsonb);
select ok((select count(*) = 1 from public.event_schedule_items where event_id = :'ev'), 'save replaces the whole list');

select throws_ok(format($$select public.save_event_schedule(%L, null, 'X', null, %L::jsonb)$$, :'ev', '[{"title":""}]'), '23514', null, 'point without title rejected');
select ok((select count(*) = 1 and min(title) = 'Tylko jeden' from public.event_schedule_items where event_id = :'ev'), 'failed save leaves list unchanged');
select ok((select title = 'Plan dnia' from public.event_sections where event_id = :'ev' and section = 'schedule'), 'failed save leaves heading unchanged');
select throws_ok(format($$select public.save_event_schedule(%L, null, 'X', null, %L::jsonb)$$, :'ev',
  (select jsonb_agg(jsonb_build_object('title', 'P' || g)) from generate_series(1, 31) g)), 'PT400', null, 'more than 30 points rejected');
select throws_ok(format($$select public.save_event_schedule(%L, null, 'X', null, '{}'::jsonb)$$, :'ev'), 'PT400', null, 'non-array rejected');
select throws_ok($$select public.save_event_schedule('00000000-0000-0000-0000-000000000999', null, 'X', null, '[]'::jsonb)$$, 'PT404', null, 'unknown event');

select lives_ok(format($$select public.save_event_locations(%L, 'Jak dojechać', 'Dojazd', null, %L::jsonb)$$, :'ev',
  '[{"label":"Sala","name":"Dworek","address":"ul. Polna 1, Lublin","show_map":false},{"name":"Kościół","address":"ul. Kościelna 2"}]'), 'super admin saves locations');
select ok((select not show_map from public.event_locations where event_id = :'ev' and position = 0), 'show_map saved');
select ok((select show_map and label is null from public.event_locations where event_id = :'ev' and position = 1), 'show_map defaults to true');
select throws_ok(format($$select public.save_event_locations(%L, null, 'X', null, %L::jsonb)$$, :'ev', '[{"name":"Bez adresu"}]'), '23514', null, 'location without address rejected');
select throws_ok(format($$select public.save_event_locations(%L, null, 'X', null, %L::jsonb)$$, :'ev',
  (select jsonb_agg(jsonb_build_object('name', 'N', 'address', 'A')) from generate_series(1, 7))), 'PT400', null, 'more than 6 locations rejected');

select lives_ok(format($$select public.save_event_contacts(%L, 'Kontakt', 'Pytania?', 'Piszcie', %L::jsonb)$$, :'ev',
  '[{"label":"Świadek","name":"Ola","email":"OLA@Example.com"},{"phone":"+48 600 100 200"}]'), 'super admin saves contacts');
select ok((select email = 'ola@example.com' from public.event_contacts where event_id = :'ev' and position = 0), 'e-mail lower-cased');
select throws_ok(format($$select public.save_event_contacts(%L, null, 'X', null, %L::jsonb)$$, :'ev', '[{"name":"Bez kontaktu"}]'), '23514', null, 'contact without e-mail and phone rejected');
select throws_ok(format($$select public.save_event_contacts(%L, null, 'X', null, %L::jsonb)$$, :'ev', '[{"email":"nie-mail"}]'), '23514', null, 'invalid e-mail rejected');
select throws_ok(format($$select public.save_event_contacts(%L, null, 'X', null, %L::jsonb)$$, :'ev', '[{"phone":"abc"}]'), '23514', null, 'invalid phone rejected');

-- reading ---------------------------------------------------------------------------
select pg_temp.act_as(:G);
select ok((select (public.get_event_page(:'ev') -> 'event' ->> 'theme') = 'sage'), 'guest reads the page config');
select ok((select jsonb_array_length(public.get_event_page(:'ev') -> 'sections') = 6), 'guest gets all sections');
select ok((select (s ->> 'is_visible')::boolean = false from jsonb_array_elements(public.get_event_page(:'ev') -> 'sections') s where s ->> 'section' = 'seating'), 'hidden section flagged');
select ok((select public.get_event_page(:'ev') -> 'locations' -> 0 ->> 'name' = 'Dworek'), 'locations ordered by position');
select ok((select public.get_event_page(:'ev2') is null), 'guest gets nothing for another event');
select ok((select count(*) = 0 from public.event_contacts where event_id = :'ev2'), 'guest cannot read another event''s rows');

-- nobody else writes ------------------------------------------------------------------
select pg_temp.act_as(:B);
select throws_ok(format($$select public.set_event_theme(%L, 'navy')$$, :'ev'), 'PT403', null, 'event ADMIN cannot set theme');
select throws_ok(format($$select public.set_event_section_visibility(%L, 'gallery', false)$$, :'ev'), 'PT403', null, 'event ADMIN cannot hide sections');
select throws_ok(format($$select public.save_event_schedule(%L, null, 'X', null, '[]'::jsonb)$$, :'ev'), 'PT403', null, 'event ADMIN cannot save schedule');
select pg_temp.expect_error(format($$update public.event_sections set is_visible = false where event_id = %L$$, :'ev'), 'event ADMIN cannot update sections directly');
select pg_temp.expect_error(format($$delete from public.event_schedule_items where event_id = %L$$, :'ev'), 'event ADMIN cannot delete schedule directly');

select pg_temp.act_as(:G);
select throws_ok(format($$select public.save_event_contacts(%L, null, 'X', null, '[]'::jsonb)$$, :'ev'), 'PT403', null, 'guest cannot save contacts');
select throws_ok(format($$select public.save_event_locations(%L, null, 'X', null, '[]'::jsonb)$$, :'ev'), 'PT403', null, 'guest cannot save locations');

select pg_temp.act_as(:O);
select throws_ok(format($$select public.set_event_theme(%L, 'navy')$$, :'ev'), 'PT403', null, 'outsider cannot set theme');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.expect_error(format($$select public.get_event_page(%L)$$, :'ev'), 'no session: cannot read config');
reset role;

-- unchanged after the denied calls
select ok((select theme = 'sage' from public.events where id = :'ev'), 'theme unchanged after denied calls');
select ok((select bool_and(is_visible) from public.event_sections where event_id = :'ev' and section <> 'seating'), 'visibility unchanged after denied calls');

-- cascade -----------------------------------------------------------------------------
select pg_temp.act_as(:S);
select public.delete_event(:'ev');
select ok((select count(*) = 0 from public.event_sections where event_id = :'ev')
          and (select count(*) = 0 from public.event_locations where event_id = :'ev')
          and (select count(*) = 0 from public.event_contacts where event_id = :'ev'), 'config removed with the event');

select * from finish();
rollback;
