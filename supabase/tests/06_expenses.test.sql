-- =============================================================================
-- Expenses view - statuses, deposit rules, budget categories, ADMIN-only access.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: A = platform admin (event ADMIN), E = EDITOR, G = guest,
-- O = outsider, B = ADMIN of the event only (not platform admin).
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
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', false, '{}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Gość"}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Obcy"}'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Edytor"}'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, '{"name":"Admin wydarzenia"}');
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-00000000000a';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set G '''00000000-0000-0000-0000-00000000000b'''
\set O '''00000000-0000-0000-0000-00000000000c'''
\set E '''00000000-0000-0000-0000-00000000000d'''
\set B '''00000000-0000-0000-0000-00000000000e'''

select pg_temp.act_as(:A);
select public.create_event('Wesele', 'abc123') as ev \gset
select public.create_event('Inne', 'xyz789') as ev2 \gset

select pg_temp.act_as(:G);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:B);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');
select public.set_member_role(:'ev', :B, 'ADMIN');

-- schema -----------------------------------------------------------------------
select enum_has_labels('public', 'expense_status', array['UNPAID', 'DEPOSIT_PAID', 'PAID'], 'expense statuses renamed');
select has_column('public', 'expenses', 'deposit_amount', 'deposit_amount added');
select col_not_null('public', 'expenses', 'total_amount', 'total_amount required');

-- ADMIN (event-only admin, not platform admin) --------------------------------
select pg_temp.act_as(:B);
insert into public.budget_categories (event_id, name, planned_amount) values (:'ev', 'Sala', 30000) returning id as cat \gset
insert into public.expenses (event_id, category_id, title, total_amount, due_date) values (:'ev', :'cat', 'Wynajem sali', 25000, '2027-05-01') returning id as exp \gset
select ok((select status = 'UNPAID' and deposit_amount is null from public.expenses where id = :'exp'), 'event admin adds category and expense, default status UNPAID');
select pg_temp.expect_error(format($$insert into public.budget_categories (event_id, name) values (%L, 'Obca')$$, :'ev2'), 'event admin cannot add category to another event');

update public.expenses set status = 'DEPOSIT_PAID', deposit_amount = 5000 where id = :'exp';
select ok((select status = 'DEPOSIT_PAID' and deposit_amount = 5000 from public.expenses where id = :'exp'), 'admin records a deposit');
update public.expenses set status = 'PAID', deposit_amount = null where id = :'exp';
select ok((select status = 'PAID' from public.expenses where id = :'exp'), 'admin marks expense paid');

select throws_ok(format($$insert into public.expenses (event_id, title) values (%L, 'Bez kwoty')$$, :'ev'), '23502', null, 'expense without amount rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount) values (%L, 'x', -1)$$, :'ev'), '23514', null, 'negative amount rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount, status) values (%L, 'x', 100, 'DEPOSIT_PAID')$$, :'ev'), '23514', null, 'deposit status without deposit rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount, status, deposit_amount) values (%L, 'x', 100, 'DEPOSIT_PAID', 100)$$, :'ev'), '23514', null, 'deposit equal to total rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount, status, deposit_amount) values (%L, 'x', 100, 'DEPOSIT_PAID', 0)$$, :'ev'), '23514', null, 'zero deposit rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount, status, deposit_amount) values (%L, 'x', 100, 'PAID', 10)$$, :'ev'), '23514', null, 'deposit on a paid expense rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount, deposit_amount) values (%L, 'x', 100, 10)$$, :'ev'), '23514', null, 'deposit on an unpaid expense rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount, notes) values (%L, 'x', 100, %L)$$, :'ev', repeat('a', 2001)), '23514', null, 'notes over 2000 chars rejected');
select throws_ok(format($$insert into public.expenses (event_id, title, total_amount) values (%L, '  ', 100)$$, :'ev'), '23514', null, 'blank title rejected');
select throws_ok(format($$insert into public.budget_categories (event_id, name) values (%L, 'Sala')$$, :'ev'), '23505', null, 'duplicate category name rejected');

select pg_temp.act_as(:A);
select throws_ok(format($$insert into public.expenses (event_id, category_id, title, total_amount) values (%L, %L, 'x', 1)$$, :'ev2', :'cat'), '23503', null, 'expense cannot use another event''s category');

-- EDITOR ------------------------------------------------------------------------
select pg_temp.act_as(:E);
select ok((select count(*) = 0 from public.expenses) and (select count(*) = 0 from public.budget_categories), 'editor sees no expenses or categories');
update public.expenses set total_amount = 1 where id = :'exp';
delete from public.expenses where id = :'exp';
select pg_temp.expect_error(format($$insert into public.expenses (event_id, title, total_amount) values (%L, 'x', 1)$$, :'ev'), 'editor cannot add expenses');
select pg_temp.expect_error(format($$insert into public.budget_categories (event_id, name) values (%L, 'x')$$, :'ev'), 'editor cannot add categories');

-- GUEST / OUTSIDER --------------------------------------------------------------
select pg_temp.act_as(:G);
select ok((select count(*) = 0 from public.expenses) and (select count(*) = 0 from public.budget_categories), 'guest sees no expenses or categories');
update public.expenses set total_amount = 1 where id = :'exp';
select pg_temp.expect_error(format($$insert into public.expenses (event_id, title, total_amount) values (%L, 'x', 1)$$, :'ev'), 'guest cannot add expenses');

select pg_temp.act_as(:O);
select ok((select count(*) = 0 from public.expenses), 'outsider sees no expenses');
delete from public.budget_categories where id = :'cat';

-- no session (anon) ---------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.expect_error('select count(*) from public.expenses', 'anon cannot read expenses');
select pg_temp.expect_error('select count(*) from public.budget_categories', 'anon cannot read categories');
reset role;

-- results of the forbidden attempts -------------------------------------------------
select pg_temp.act_as(:A);
select ok((select total_amount = 25000 from public.expenses where id = :'exp'), 'editor / guest could not change the expense');
select ok((select count(*) = 1 from public.budget_categories where id = :'cat'), 'outsider could not delete the category');

delete from public.budget_categories where id = :'cat';
select ok((select category_id is null from public.expenses where id = :'exp'), 'deleting category keeps its expenses');
reset role;

select * from finish();
rollback;
