-- =============================================================================
-- Guest list, seating, budget - access rules and data integrity.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin (event ADMIN), G = guest, O = outsider,
-- E = EDITOR.
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

-- Migrations revoke default EXECUTE on new functions - test helpers need it
-- while acting as the authenticated / anon roles.
grant execute on function pg_temp.act_as(uuid), pg_temp.expect_error(text, text) to public;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set G '''00000000-0000-0000-0000-00000000000b'''
\set O '''00000000-0000-0000-0000-00000000000c'''
\set E '''00000000-0000-0000-0000-00000000000d'''

select pg_temp.act_as(:A);
select public.create_event('Wesele', 'abc123') as ev \gset
select public.create_event('Inne', 'xyz789') as ev2 \gset

select pg_temp.act_as(:G);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');

-- ADMIN builds the plan -----------------------------------------------------------
insert into public.guest_groups (event_id, name) values (:'ev', 'Kowalscy') returning id as grp \gset
insert into public.seating_tables (event_id, name, capacity, notes) values (:'ev', 'Stół 1', 2, 'blisko DJ-a') returning id as t1 \gset
insert into public.seating_tables (event_id, name) values (:'ev', 'Stół 2') returning id as t2 \gset
insert into public.seating_tables (event_id, name) values (:'ev2', 'Obcy stół') returning id as tx \gset

insert into public.guests (event_id, group_id, first_name, last_name, phone, diet, table_id, seat_number)
values (:'ev', :'grp', 'Jan', 'Kowalski', '600100200', 'wege', :'t1', 1) returning id as g1 \gset
insert into public.guests (event_id, group_id, is_plus_one, table_id, seat_number)
values (:'ev', :'grp', true, :'t1', 2) returning id as g2 \gset
select ok((select count(*) = 2 from public.guests where event_id = :'ev'), 'admin adds group, tables, guests and unnamed plus-one');

select throws_ok(format($$insert into public.guests (event_id, first_name) values (%L, '  ')$$, :'ev'), '23514', null, 'guest without name (not plus-one) rejected');
select throws_ok(format($$insert into public.guests (event_id, first_name, table_id, seat_number) values (%L, 'Ala', %L, 1)$$, :'ev', :'t1'), '23505', null, 'two guests on the same seat rejected');
select throws_ok(format($$insert into public.guests (event_id, first_name, table_id) values (%L, 'Ala', %L)$$, :'ev', :'tx'), '23503', null, 'table from another event rejected');
select throws_ok(format($$insert into public.guests (event_id, first_name, group_id) values (%L, 'Ala', %L)$$, :'ev2', :'grp'), '23503', null, 'group from another event rejected');

select lives_ok(format($$insert into public.guests (event_id, first_name, table_id, seat_number) values (%L, 'Ola', %L, 3)$$, :'ev', :'t1'), 'capacity is soft: 3rd guest at table for 2 accepted');

insert into public.budget_categories (event_id, name, planned_amount) values (:'ev', 'Sala', 30000) returning id as cat \gset
insert into public.expenses (event_id, category_id, title, total_amount, due_date) values (:'ev', :'cat', 'Wynajem sali', 25000, '2027-05-01') returning id as exp \gset
insert into public.expense_payments (event_id, expense_id, amount) values (:'ev', :'exp', 5000);
select ok((select created_by = :A from public.expenses where id = :'exp'), 'admin adds budget, expense (created_by defaulted) and payment');
select throws_ok(format($$insert into public.expense_payments (event_id, expense_id, amount) values (%L, %L, 1)$$, :'ev2', :'exp'), '23503', null, 'payment cannot point at another event''s expense');
select throws_ok(format($$insert into public.expense_payments (event_id, expense_id, amount) values (%L, %L, 0)$$, :'ev', :'exp'), '23514', null, 'zero payment rejected');

-- EDITOR ------------------------------------------------------------------------
select pg_temp.act_as(:E);
select ok((select count(*) = 3 from public.guests), 'editor sees guest list');
update public.guests set rsvp_status = 'ATTENDING' where id = :'g1';
select ok((select rsvp_status = 'ATTENDING' from public.guests where id = :'g1'), 'editor edits guest');
select lives_ok(format($$insert into public.seating_tables (event_id, name) values (%L, 'Stół 3')$$, :'ev'), 'editor adds table');
select ok((select notes = 'blisko DJ-a' from public.seating_tables where id = :'t1'), 'editor reads internal table notes');
select ok((select count(*) = 0 from public.expenses) and (select count(*) = 0 from public.budget_categories) and (select count(*) = 0 from public.expense_payments), 'editor sees no budget/expenses/payments');
select pg_temp.expect_error(format($$insert into public.expenses (event_id, title) values (%L, 'x')$$, :'ev'), 'editor cannot add expenses');
select ok((select count(*) = 0 from public.seating_tables where event_id = :'ev2'), 'editor does not see tables of other event');

-- GUEST -------------------------------------------------------------------------
select pg_temp.act_as(:G);
select ok((select count(*) = 0 from public.guests), 'guest cannot read guest list (contacts, diet)');
select ok((select count(*) = 0 from public.guest_groups), 'guest cannot read guest groups');
select ok((select count(*) = 0 from public.seating_tables), 'guest cannot read seating tables (internal notes)');
update public.seating_tables set name = 'Hacked' where id = :'t1';
delete from public.seating_tables where id = :'t2';
select pg_temp.expect_error(format($$insert into public.seating_tables (event_id, name) values (%L, 'X')$$, :'ev'), 'guest cannot add table');
select ok((select count(*) = 0 from public.expenses), 'guest sees no expenses');

select ok((select count(*) = 5 from public.get_seating_plan(:'ev')), 'seating plan: 3 seated rows + 2 empty tables');
select ok((select guest_name = 'Jan Kowalski' from public.get_seating_plan(:'ev') where seat_number = 1), 'seating plan shows guest name');
select ok((select guest_name = 'Osoba towarzysząca' from public.get_seating_plan(:'ev') where seat_number = 2), 'unnamed plus-one labelled');
select throws_ok(format($$select * from public.get_seating_plan(%L)$$, :'ev2'), 'PT403', null, 'seating plan of foreign event denied');

select pg_temp.act_as(:O);
select throws_ok(format($$select * from public.get_seating_plan(%L)$$, :'ev'), 'PT403', null, 'outsider cannot read seating plan');
select ok((select count(*) = 0 from public.seating_tables), 'outsider sees no tables');

-- cascades ------------------------------------------------------------------------
select pg_temp.act_as(:A);
select ok((select name = 'Stół 1' from public.seating_tables where id = :'t1'), 'guest could not rename table');
select ok((select count(*) = 1 from public.seating_tables where id = :'t2'), 'guest could not delete table');

delete from public.seating_tables where id = :'t1';
select ok((select table_id is null and seat_number is null from public.guests where id = :'g1'), 'deleting table unseats guests (seat number cleared)');
delete from public.guest_groups where id = :'grp';
select ok((select group_id is null from public.guests where id = :'g1'), 'deleting group keeps guests');
delete from public.expenses where id = :'exp';
select ok((select count(*) = 0 from public.expense_payments), 'deleting expense removes its payments');
reset role;

select * from finish();
rollback;
