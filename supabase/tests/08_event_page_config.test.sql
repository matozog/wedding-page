-- =============================================================================
-- Event page configuration - theme, sections, lists, about facts, page photos.
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
select ok(not has_function_privilege('anon', 'public.save_event_section(uuid, public.event_section, jsonb, jsonb)', 'execute'), 'anon cannot save sections');
select ok(not has_function_privilege('authenticated', 'public.insert_default_event_sections(uuid)', 'execute'), 'defaults helper not exposed');
select ok(not has_table_privilege('authenticated', 'public.event_sections', 'update'), 'no direct UPDATE on sections');
select ok(not has_table_privilege('authenticated', 'public.event_schedule_items', 'insert'), 'no direct INSERT on schedule');
select ok(not has_table_privilege('authenticated', 'public.event_page_photos', 'insert'), 'no direct INSERT on page photos');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                  and policyname = 'Only super admin touches the page folder' and permissive = 'RESTRICTIVE'),
          'restrictive delete policy guards the page folder');

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
select ok((select count(*) = 7 from public.event_sections where event_id = :'ev'), 'new event gets 7 sections (footer included)');
select ok((select not is_visible from public.event_sections where event_id = :'ev' and section = 'seating'), 'seating hidden by default');
select ok((select bool_and(is_visible) from public.event_sections where event_id = :'ev' and section <> 'seating'), 'other sections visible by default');
select ok((select count(*) = 0 from public.event_schedule_items where event_id = :'ev')
          and (select count(*) = 0 from public.event_contacts where event_id = :'ev')
          and (select count(*) = 0 from public.event_about_facts where event_id = :'ev'), 'no content copied into a new event');
select ok((select theme = 'sand' from public.events where id = :'ev'), 'default theme sand');

-- theme / visibility ------------------------------------------------------------------
select lives_ok(format($$select public.set_event_theme(%L, 'midnight')$$, :'ev'), 'super admin sets a dark theme');
select throws_ok(format($$select public.set_event_theme(%L, 'neon')$$, :'ev'), 'PT400', null, 'unknown theme rejected');
select lives_ok(format($$select public.set_event_section_visibility(%L, 'footer', false)$$, :'ev'), 'super admin hides the footer');

-- save_event_section ------------------------------------------------------------------
select lives_ok(format($$select public.save_event_section(%L, 'gallery', %L::jsonb)$$, :'ev',
  '{"nav_label":" Zdjęcia ","title":"Nasze kadry","content_body":"Pusto"}'), 'texts-only section saved');
select ok((select nav_label = 'Zdjęcia' and eyebrow is null and title = 'Nasze kadry' and content_body = 'Pusto'
           from public.event_sections where event_id = :'ev' and section = 'gallery'), 'texts trimmed, missing -> null');
select throws_ok(format($$select public.save_event_section(%L, 'gallery', '{}'::jsonb, '[]'::jsonb)$$, :'ev'), 'PT400', null, 'list for a section without one rejected');
select throws_ok(format($$select public.save_event_section(%L, 'gallery', '[]'::jsonb)$$, :'ev'), 'PT400', null, 'content must be an object');
select throws_ok(format($$select public.save_event_section(%L, 'gallery', %L::jsonb)$$, :'ev', json_build_object('nav_label', repeat('x', 31))), '23514', null, 'too long menu label rejected');

select lives_ok(format($$select public.save_event_section(%L, 'schedule', %L::jsonb, %L::jsonb)$$, :'ev',
  '{"eyebrow":" Program ","title":"Plan dnia"}', '[{"time_label":"18:00","title":" Kolacja ","description":""},{"title":"Tort"}]'), 'schedule saved');
select ok((select array_agg(title order by position) = array['Kolacja', 'Tort'] from public.event_schedule_items where event_id = :'ev'), 'points saved in order, trimmed');
select ok((select time_label is null and description is null from public.event_schedule_items where event_id = :'ev' and position = 1), 'empty optional fields -> null');

select public.save_event_section(:'ev', 'schedule', '{"title":"Plan dnia"}'::jsonb);
select ok((select count(*) = 2 from public.event_schedule_items where event_id = :'ev'), 'null items keep the list');
select public.save_event_section(:'ev', 'schedule', '{"title":"Plan dnia"}'::jsonb, '[{"title":"Jeden"}]'::jsonb);
select ok((select count(*) = 1 from public.event_schedule_items where event_id = :'ev'), 'items replace the whole list');

select throws_ok(format($$select public.save_event_section(%L, 'schedule', '{"title":"Zmiana"}'::jsonb, %L::jsonb)$$, :'ev', '[{"title":""}]'), '23514', null, 'point without title rejected');
select ok((select count(*) = 1 and min(title) = 'Jeden' from public.event_schedule_items where event_id = :'ev'), 'failed save leaves list unchanged');
select ok((select title = 'Plan dnia' from public.event_sections where event_id = :'ev' and section = 'schedule'), 'failed save leaves texts unchanged');
select throws_ok(format($$select public.save_event_section(%L, 'schedule', '{}'::jsonb, %L::jsonb)$$, :'ev',
  (select jsonb_agg(jsonb_build_object('title', 'P' || g)) from generate_series(1, 31) g)), 'PT400', null, 'more than 30 points rejected');
select throws_ok($$select public.save_event_section('00000000-0000-0000-0000-000000000999', 'schedule', '{}'::jsonb)$$, 'PT404', null, 'unknown event');

select lives_ok(format($$select public.save_event_section(%L, 'location', '{}'::jsonb, %L::jsonb)$$, :'ev',
  '[{"label":"Sala","name":"Dworek","address":"ul. Polna 1","show_map":false},{"name":"Kościół","address":"ul. Kościelna 2"}]'), 'locations saved');
select ok((select not show_map from public.event_locations where event_id = :'ev' and position = 0), 'show_map saved');
select ok((select show_map from public.event_locations where event_id = :'ev' and position = 1), 'show_map defaults to true');
select throws_ok(format($$select public.save_event_section(%L, 'location', '{}'::jsonb, %L::jsonb)$$, :'ev', '[{"name":"Bez adresu"}]'), '23514', null, 'location without address rejected');

select lives_ok(format($$select public.save_event_section(%L, 'contact', '{}'::jsonb, %L::jsonb)$$, :'ev',
  '[{"label":"Świadek","name":"Ola","email":"OLA@Example.com"},{"phone":"+48 600 100 200"}]'), 'contacts saved');
select ok((select email = 'ola@example.com' from public.event_contacts where event_id = :'ev' and position = 0), 'e-mail lower-cased');
select throws_ok(format($$select public.save_event_section(%L, 'contact', '{}'::jsonb, %L::jsonb)$$, :'ev', '[{"name":"Bez kontaktu"}]'), '23514', null, 'contact without e-mail and phone rejected');
select throws_ok(format($$select public.save_event_section(%L, 'contact', '{}'::jsonb, %L::jsonb)$$, :'ev', '[{"email":"nie-mail"}]'), '23514', null, 'invalid e-mail rejected');

select lives_ok(format($$select public.save_event_section(%L, 'couple', %L::jsonb, %L::jsonb)$$, :'ev',
  '{"content_title":"Ania i Tomek","content_body":"Historia"}', '[{"label":"Data","value":"12 czerwca"},{"label":"Miejsce","value":"Lublin"}]'), 'about section saved');
select ok((select count(*) = 2 from public.event_about_facts where event_id = :'ev'), 'facts saved');
select throws_ok(format($$select public.save_event_section(%L, 'couple', '{}'::jsonb, %L::jsonb)$$, :'ev', '[{"label":"Bez wartości"}]'), '23514', null, 'fact without value rejected');
select throws_ok(format($$select public.save_event_section(%L, 'couple', '{}'::jsonb, %L::jsonb)$$, :'ev',
  (select jsonb_agg(jsonb_build_object('label', 'L', 'value', 'V')) from generate_series(1, 5))), 'PT400', null, 'more than 4 facts rejected');

-- page photos -------------------------------------------------------------------------
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ev' || '/page/a.jpg'), 'super admin uploads into the page folder');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ev' || '/page/b.jpg'), 'second page photo uploaded');
select public.add_event_page_photo(:'ev', 'couple', :'ev' || '/page/a.jpg', ' Para ') as photo_a \gset
select public.add_event_page_photo(:'ev', 'couple', :'ev' || '/page/b.jpg') as photo_b \gset
select ok((select alt_text = 'Para' and position = 0 from public.event_page_photos where id = :'photo_a'), 'photo registered with alt text');
select ok((select position = 1 from public.event_page_photos where id = :'photo_b'), 'next photo goes last');
select throws_ok(format($$select public.add_event_page_photo(%L, 'couple', %L)$$, :'ev', :'ev' || '/page/missing.jpg'), 'PT400', null, 'photo without uploaded file rejected');
select throws_ok(format($$select public.add_event_page_photo(%L, 'gallery', %L)$$, :'ev', :'ev' || '/page/a.jpg'), 'PT400', null, 'section without photos rejected');
select pg_temp.expect_error(format($$select public.add_event_page_photo(%L, 'couple', %L)$$, :'ev', :'ev2' || '/page/x.jpg'), 'file from another event rejected');

select lives_ok(format($$select public.save_event_page_photos(%L, 'couple', %L::jsonb)$$, :'ev',
  json_build_array(json_build_object('id', :'photo_b'), json_build_object('id', :'photo_a', 'alt_text', 'Nowy opis'))), 'photos reordered');
select ok((select position = 0 from public.event_page_photos where id = :'photo_b')
          and (select position = 1 and alt_text = 'Nowy opis' from public.event_page_photos where id = :'photo_a'), 'order and alt text saved');
select throws_ok(format($$select public.save_event_page_photos(%L, 'couple', %L::jsonb)$$, :'ev',
  json_build_array(json_build_object('id', :'photo_a'))), 'PT409', null, 'stale photo list rejected');
select throws_ok(format($$select public.save_event_page_photos(%L, 'couple', %L::jsonb)$$, :'ev',
  json_build_array(json_build_object('id', :'photo_a'), json_build_object('id', :'photo_a'))), 'PT409', null, 'repeated photo id rejected');
select throws_ok(format($$select public.save_event_page_photos(%L, 'couple', %L::jsonb)$$, :'ev',
  json_build_array(json_build_object('id', :'photo_a'), json_build_object('id', 'not-a-uuid'))), 'PT409', null, 'unknown photo id rejected');
select ok((select position = 0 from public.event_page_photos where id = :'photo_b')
          and (select position = 1 from public.event_page_photos where id = :'photo_a'), 'rejected lists leave the order unchanged');

select ok((select public.delete_event_page_photo(:'photo_b') = :'ev' || '/page/b.jpg'), 'delete returns the file path');
select throws_ok(format($$select public.delete_event_page_photo(%L)$$, :'photo_b'), 'PT404', null, 'deleting twice reports missing photo');

-- reading ---------------------------------------------------------------------------
select pg_temp.act_as(:G);
select ok((select (public.get_event_page(:'ev') -> 'event' ->> 'theme') = 'midnight'), 'guest reads the page config');
select ok((select jsonb_array_length(public.get_event_page(:'ev') -> 'sections') = 7), 'guest gets all sections');
select ok((select (s ->> 'is_visible')::boolean = false from jsonb_array_elements(public.get_event_page(:'ev') -> 'sections') s where s ->> 'section' = 'footer'), 'hidden section flagged');
select ok((select jsonb_array_length(public.get_event_page(:'ev') -> 'facts') = 2), 'guest gets facts');
select ok((select public.get_event_page(:'ev') -> 'photos' -> 0 ->> 'alt_text' = 'Nowy opis'), 'guest gets photos');
select ok((select count(*) = 1 from storage.objects where bucket_id = 'photos' and name = :'ev' || '/page/a.jpg'), 'guest can see the page photo file');
select ok((select public.get_event_page(:'ev2') is null), 'guest gets nothing for another event');

-- nobody else writes ------------------------------------------------------------------
select pg_temp.act_as(:B);
select throws_ok(format($$select public.set_event_theme(%L, 'navy')$$, :'ev'), 'PT403', null, 'event ADMIN cannot set theme');
select throws_ok(format($$select public.set_event_section_visibility(%L, 'gallery', false)$$, :'ev'), 'PT403', null, 'event ADMIN cannot hide sections');
select throws_ok(format($$select public.save_event_section(%L, 'schedule', '{}'::jsonb, '[]'::jsonb)$$, :'ev'), 'PT403', null, 'event ADMIN cannot save sections');
select throws_ok(format($$select public.add_event_page_photo(%L, 'couple', %L)$$, :'ev', :'ev' || '/page/a.jpg'), 'PT403', null, 'event ADMIN cannot add page photos');
select throws_ok(format($$select public.delete_event_page_photo(%L)$$, :'photo_a'), 'PT403', null, 'event ADMIN cannot delete page photos');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ev' || '/page/hack.jpg'), 'event ADMIN cannot upload into the page folder');
select pg_temp.expect_error(format($$update public.event_sections set is_visible = false where event_id = %L$$, :'ev'), 'event ADMIN cannot update sections directly');

select pg_temp.act_as(:G);
select throws_ok(format($$select public.save_event_section(%L, 'contact', '{}'::jsonb, '[]'::jsonb)$$, :'ev'), 'PT403', null, 'guest cannot save contacts');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ev' || '/page/g.jpg'), 'guest cannot upload into the page folder');

select pg_temp.act_as(:O);
select throws_ok(format($$select public.set_event_theme(%L, 'navy')$$, :'ev'), 'PT403', null, 'outsider cannot set theme');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.expect_error(format($$select public.get_event_page(%L)$$, :'ev'), 'no session: cannot read config');
reset role;

select ok((select theme = 'midnight' from public.events where id = :'ev'), 'theme unchanged after denied calls');
select ok((select count(*) = 1 from public.event_page_photos where event_id = :'ev'), 'photos unchanged after denied calls');

-- cascade -----------------------------------------------------------------------------
select pg_temp.act_as(:S);
select public.delete_event(:'ev');
select ok((select count(*) = 0 from public.event_sections where event_id = :'ev')
          and (select count(*) = 0 from public.event_about_facts where event_id = :'ev')
          and (select count(*) = 0 from public.event_page_photos where event_id = :'ev'), 'config removed with the event');

select * from finish();
rollback;
