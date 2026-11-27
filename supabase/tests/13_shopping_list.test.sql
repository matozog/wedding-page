-- =============================================================================
-- Shopping list - section defaults, settings, entries (RLS + column grants),
-- assigning and limits.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: S = super admin (not a member), D = ADMIN of the event, E = EDITOR,
-- G1 / G2 = anonymous guests with the same nickname, O = member of another
-- event only, anon = no session.
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

-- Number of rows changed by an UPDATE / DELETE (0 when RLS hides the row).
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function pg_temp.act_as(uuid), pg_temp.expect_error(text, text), pg_temp.affected(text) to public;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000011a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@example.com', false, '{"full_name":"Super"}'),
  ('00000000-0000-0000-0000-0000000011d0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'para@example.com', false, '{"full_name":"Para"}'),
  ('00000000-0000-0000-0000-0000000011e0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edytor@example.com', false, '{"full_name":"Edytor"}'),
  ('00000000-0000-0000-0000-0000000011b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Kasia"}'),
  ('00000000-0000-0000-0000-0000000011b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Kasia"}'),
  ('00000000-0000-0000-0000-0000000011c0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'obcy@example.com', false, '{"full_name":"Obcy"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-0000000011a0';

\set S '''00000000-0000-0000-0000-0000000011a0'''
\set D '''00000000-0000-0000-0000-0000000011d0'''
\set E '''00000000-0000-0000-0000-0000000011e0'''
\set G1 '''00000000-0000-0000-0000-0000000011b1'''
\set G2 '''00000000-0000-0000-0000-0000000011b2'''
\set O '''00000000-0000-0000-0000-0000000011c0'''

-- privileges ----------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.event_shopping_items', 'select'), 'anon cannot read entries');
select ok(not has_table_privilege('anon', 'public.event_shopping_settings', 'select'), 'anon cannot read settings');
select ok(not has_table_privilege('authenticated', 'public.event_shopping_settings', 'update'), 'no direct UPDATE on settings');
select ok(not has_column_privilege('authenticated', 'public.event_shopping_items', 'created_by', 'insert'), 'author not settable on insert');
select ok(not has_column_privilege('authenticated', 'public.event_shopping_items', 'assigned_to', 'update'), 'assignment not updatable directly');
select ok(not has_column_privilege('authenticated', 'public.event_shopping_items', 'event_id', 'update'), 'event not updatable');
select ok(not has_function_privilege('anon', 'public.assign_shopping_item(uuid)', 'execute'), 'anon cannot assign');
select ok(not has_function_privilege('anon', 'public.save_shopping_section(uuid, jsonb, jsonb)', 'execute'), 'anon cannot save the section');

-- setup -------------------------------------------------------------------------------
select pg_temp.act_as(:S);
select public.create_event('Grill', 'kod-gri1') as ev \gset
select public.create_event('Inne', 'kod-inn1') as ev2 \gset

select pg_temp.act_as(:D);
select count(*) from public.join_event('kod-gri1') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('kod-gri1') \g /dev/null
select pg_temp.act_as(:G1);
select count(*) from public.join_event('kod-gri1') \g /dev/null
select pg_temp.act_as(:G2);
select count(*) from public.join_event('kod-gri1') \g /dev/null
select pg_temp.act_as(:O);
select count(*) from public.join_event('kod-inn1') \g /dev/null
select pg_temp.act_as(:S);
select public.set_member_role(:'ev', :D, 'ADMIN');
select public.set_member_role(:'ev', :E, 'EDITOR');

-- defaults ----------------------------------------------------------------------------
select ok((select not is_visible and title = 'Lista zakupów' from public.event_sections where event_id = :'ev' and section = 'shopping'),
          'new event: shopping section hidden, default title');
select ok((select show_note and not show_quantity and show_author and allow_assign from public.event_shopping_settings where event_id = :'ev'),
          'new event: default list settings');
select pg_temp.act_as(:G1);
select ok((select count(*) = 1 from public.event_shopping_settings where event_id = :'ev'), 'member reads the settings');

-- hidden section ----------------------------------------------------------------------
select pg_temp.act_as(:G1);
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Węgiel')$$, :'ev'),
                            'guest cannot add while the section is hidden');
select pg_temp.act_as(:E);
select lives_ok(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Grill')$$, :'ev'), 'EDITOR adds to a hidden list');
select pg_temp.act_as(:D);
select lives_ok(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Namiot')$$, :'ev'), 'ADMIN adds to a hidden list');
select pg_temp.act_as(:S);
select lives_ok(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Stół')$$, :'ev'), 'super admin adds to a hidden list');
select ok((select created_by = :S from public.event_shopping_items where name = 'Stół'), 'author = caller');

-- settings ----------------------------------------------------------------------------
select pg_temp.act_as(:D);
select throws_ok(format($$select public.save_shopping_section(%L, '{}'::jsonb, '{}'::jsonb)$$, :'ev'), 'PT403', null, 'event ADMIN cannot change settings');
select pg_temp.act_as(:S);
select lives_ok(format($$select public.save_shopping_section(%L, %L::jsonb, %L::jsonb)$$, :'ev',
  '{"title":" Co przynieść ","content_body":"Pusto"}', '{"show_quantity":true}'), 'super admin saves texts and settings');
select ok((select title = 'Co przynieść' from public.event_sections where event_id = :'ev' and section = 'shopping'), 'texts saved');
select ok((select show_quantity and show_note and allow_assign from public.event_shopping_settings where event_id = :'ev'),
          'given key changed, missing keys kept');
select throws_ok(format($$select public.save_shopping_section(%L, '{}'::jsonb, '[]'::jsonb)$$, :'ev'), 'PT400', null, 'settings must be an object');
select public.set_event_section_visibility(:'ev', 'shopping', true);

-- adding ------------------------------------------------------------------------------
select pg_temp.act_as(:G1);
select lives_ok(format($$insert into public.event_shopping_items (event_id, name, note, quantity, unit) values (%L, '  Węgiel ', ' ', 2, ' kg ')$$, :'ev'),
                'guest adds to a visible list');
select ok((select name = 'Węgiel' and note is null and unit = 'kg' and created_by = :G1 and assigned_to is null
           from public.event_shopping_items where event_id = :'ev' and name = 'Węgiel'), 'texts trimmed, empty -> null, author = guest');
select lives_ok(format($$insert into public.event_shopping_items (event_id, name, unit) values (%L, 'Sałatka', 'miska')$$, :'ev'), 'entry without quantity');
select ok((select unit is null from public.event_shopping_items where name = 'Sałatka'), 'unit dropped without a quantity');
select lives_ok(format($$insert into public.event_shopping_items (event_id, name, assigned_to) values (%L, 'Głośnik', %L)$$, :'ev', :G1),
                'guest adds an entry assigned to themselves');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name, assigned_to) values (%L, 'Lód', %L)$$, :'ev', :G2),
                            'guest cannot assign someone else');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name, created_by) values (%L, 'Lód', %L)$$, :'ev', :G2),
                            'guest cannot add as someone else');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Lód')$$, :'ev2'),
                            'guest cannot add to another event');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name) values (%L, '   ')$$, :'ev'), 'empty name rejected');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name, quantity) values (%L, 'Lód', 1000)$$, :'ev'),
                            'quantity above 999 rejected');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name) values (%L, %L)$$, :'ev', repeat('x', 121)),
                            'too long name rejected');

select pg_temp.act_as(:G2);
select lives_ok(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Kubki')$$, :'ev'), 'second guest with the same nickname adds');
select ok((select count(distinct created_by) = 2 from public.event_shopping_items
           where name in ('Węgiel', 'Kubki')), 'same nickname, separate authors');

select id as wegiel from public.event_shopping_items where name = 'Węgiel' \gset
select id as kubki from public.event_shopping_items where name = 'Kubki' \gset
select id as glosnik from public.event_shopping_items where name = 'Głośnik' \gset
select id as grill from public.event_shopping_items where name = 'Grill' \gset

-- editing -----------------------------------------------------------------------------
select pg_temp.act_as(:G2);
select is(pg_temp.affected(format($$update public.event_shopping_items set name = 'Zmiana' where id = %L$$, :'wegiel')), 0,
          'guest cannot edit someone else''s entry');
select is(pg_temp.affected(format($$delete from public.event_shopping_items where id = %L$$, :'wegiel')), 0,
          'guest cannot delete someone else''s entry');
select pg_temp.expect_error(format($$update public.event_shopping_items set created_by = %L where id = %L$$, :G2, :'wegiel'),
                            'author cannot be changed');

select pg_temp.act_as(:G1);
select updated_at as before_edit from public.event_shopping_items where id = :'wegiel' \gset
select is(pg_temp.affected(format($$update public.event_shopping_items set name = 'Węgiel drzewny' where id = %L$$, :'wegiel')), 1,
          'author edits own entry');
select pg_temp.expect_error(format($$update public.event_shopping_items set assigned_to = %L where id = %L$$, :G1, :'wegiel'),
                            'assignment not changed by UPDATE');
select pg_temp.expect_error(format($$update public.event_shopping_items set event_id = %L where id = %L$$, :'ev2', :'wegiel'),
                            'entry cannot move to another event');

select pg_temp.act_as(:E);
select is(pg_temp.affected(format($$update public.event_shopping_items set note = 'Do grilla' where id = %L$$, :'kubki')), 1,
          'EDITOR edits any entry');
select pg_temp.act_as(:D);
select is(pg_temp.affected(format($$update public.event_shopping_items set note = 'Papierowe' where id = %L$$, :'kubki')), 1,
          'ADMIN edits any entry');

-- assigning ---------------------------------------------------------------------------
select pg_temp.act_as(:G1);
select lives_ok(format($$select public.assign_shopping_item(%L)$$, :'kubki'), 'guest takes a free entry of someone else');
select ok((select assigned_to = :G1 from public.event_shopping_items where id = :'kubki'), 'entry assigned to the guest');
select pg_temp.act_as(:G2);
select throws_ok(format($$select public.assign_shopping_item(%L)$$, :'kubki'), 'PT409', null, 'taken entry cannot be taken over');
select throws_ok(format($$select public.unassign_shopping_item(%L)$$, :'kubki'), 'PT403', null, 'guest cannot drop someone else''s assignment');
select pg_temp.act_as(:G1);
select lives_ok(format($$select public.unassign_shopping_item(%L)$$, :'kubki'), 'guest drops own assignment');
select ok((select assigned_to is null from public.event_shopping_items where id = :'kubki'), 'entry free again');
select pg_temp.act_as(:E);
select lives_ok(format($$select public.unassign_shopping_item(%L)$$, :'glosnik'), 'EDITOR clears anyone''s assignment');
select ok((select assigned_to is null from public.event_shopping_items where id = :'glosnik'), 'assignment cleared by EDITOR');

select pg_temp.act_as(:G1);
select public.assign_shopping_item(:'glosnik');
select pg_temp.act_as(:S);
select public.save_shopping_section(:'ev', '{}'::jsonb, '{"allow_assign":false}'::jsonb);
select public.set_event_section_visibility(:'ev', 'shopping', true);
select pg_temp.act_as(:G2);
select throws_ok(format($$select public.assign_shopping_item(%L)$$, :'kubki'), 'PT403', null, 'assigning switched off');
select pg_temp.expect_error(format($$insert into public.event_shopping_items (event_id, name, assigned_to) values (%L, 'Lód', %L)$$, :'ev', :G2),
                            'no self-assignment on insert when switched off');
select pg_temp.act_as(:G1);
select lives_ok(format($$select public.unassign_shopping_item(%L)$$, :'glosnik'), 'dropping still works when switched off');
select pg_temp.act_as(:S);
select public.save_shopping_section(:'ev', '{}'::jsonb, '{"allow_assign":true}'::jsonb);

-- updated_at ----------------------------------------------------------------------------
select ok((select updated_at >= :'before_edit'::timestamptz from public.event_shopping_items where id = :'wegiel'), 'edit updates updated_at');
select updated_at as before_assign from public.event_shopping_items where id = :'wegiel' \gset
select pg_temp.act_as(:G2);
select public.assign_shopping_item(:'wegiel');
select ok((select updated_at = :'before_assign'::timestamptz from public.event_shopping_items where id = :'wegiel'),
          'assigning does not change updated_at');

-- hidden again: guests read-only, organisers keep editing ---------------------------
select pg_temp.act_as(:S);
select public.set_event_section_visibility(:'ev', 'shopping', false);
select pg_temp.act_as(:G1);
select is(pg_temp.affected(format($$update public.event_shopping_items set name = 'Węgiel' where id = %L$$, :'wegiel')), 0,
          'author cannot edit while the section is hidden');
select throws_ok(format($$select public.assign_shopping_item(%L)$$, :'kubki'), 'PT403', null, 'guest cannot assign while hidden');
select pg_temp.act_as(:E);
select is(pg_temp.affected(format($$delete from public.event_shopping_items where id = %L$$, :'grill')), 1, 'EDITOR deletes while hidden');
select pg_temp.act_as(:S);
select public.set_event_section_visibility(:'ev', 'shopping', true);

-- outsiders -----------------------------------------------------------------------------
select pg_temp.act_as(:O);
select ok((select count(*) = 0 from public.event_shopping_items where event_id = :'ev'), 'outsider sees no entries');
select ok((select count(*) = 0 from public.event_shopping_settings where event_id = :'ev'), 'outsider sees no settings');
select ok(not public.shopping_assign_allowed(:'ev'), 'outsider learns nothing from shopping_assign_allowed');
select throws_ok(format($$select public.assign_shopping_item(%L)$$, :'kubki'), 'PT404', null, 'outsider cannot assign');
select is(pg_temp.affected(format($$delete from public.event_shopping_items where id = %L$$, :'kubki')), 0, 'outsider cannot delete');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.expect_error($$select count(*) from public.event_shopping_items$$, 'no session: no access');
reset role;

-- limits ----------------------------------------------------------------------------------
select pg_temp.act_as(:G2);
select throws_ok(format($$insert into public.event_shopping_items (event_id, name) select %L, 'Rzecz ' || g from generate_series(1, 50) g$$, :'ev'),
                 'PT400', null, 'at most 50 entries per person');
reset role;
insert into public.event_shopping_items (event_id, created_by, name)
select :'ev', null, 'Hurt ' || g
from generate_series(1, 500 - (select count(*) from public.event_shopping_items where event_id = :'ev')) g;
select pg_temp.act_as(:D);
select throws_ok(format($$insert into public.event_shopping_items (event_id, name) values (%L, 'Za dużo')$$, :'ev'),
                 'PT400', null, 'at most 500 entries per event');

-- profile removal / cascade ---------------------------------------------------------------
reset role;
delete from public.profiles where id = :G1;
select ok((select count(*) = 0 from public.event_shopping_items where created_by = :G1 or assigned_to = :G1), 'removed profile: author / assignee -> null');
select ok((select count(*) = 1 from public.event_shopping_items where event_id = :'ev' and name = 'Węgiel drzewny'), 'entries of a removed profile stay');

select pg_temp.act_as(:S);
select public.delete_event(:'ev');
select ok((select count(*) = 0 from public.event_shopping_items where event_id = :'ev')
          and (select count(*) = 0 from public.event_shopping_settings where event_id = :'ev'), 'list removed with the event');

select * from finish();
rollback;
