-- =============================================================================
-- Guest e-mail - format rule, EDITOR reads (writes like any guest column,
-- see 04_guest_management), guests / outsiders see nothing.
-- Run: npx supabase test db   (local stack, everything rolled back)
--
-- Actors: B = event ADMIN, E = EDITOR, G = guest, O = outsider.
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

select pg_temp.act_as(:G);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:E);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:B);
select count(*) from public.join_event('abc123') \g /dev/null
select pg_temp.act_as(:A);
select public.set_member_role(:'ev', :E, 'EDITOR');
select public.set_member_role(:'ev', :B, 'ADMIN');

-- format -------------------------------------------------------------------------
select pg_temp.act_as(:B);
insert into public.guests (event_id, first_name, email)
values (:'ev', 'Jan', 'jan.kowalski@example.com') returning id as g1 \gset
insert into public.guests (event_id, first_name) values (:'ev', 'Ola') returning id as g2 \gset
select ok((select email = 'jan.kowalski@example.com' from public.guests where id = :'g1'), 'admin saves a guest e-mail');
select ok((select email is null from public.guests where id = :'g2'), 'e-mail is optional');

select pg_temp.expect_error(
  format('update public.guests set email = %L where id = %L', 'bez-malpy.example.com', :'g2'),
  'e-mail without @ rejected'
);
select pg_temp.expect_error(
  format('update public.guests set email = %L where id = %L', 'ola@example', :'g2'),
  'e-mail without domain dot rejected'
);
select pg_temp.expect_error(
  format('update public.guests set email = %L where id = %L', 'ola @example.com', :'g2'),
  'e-mail with whitespace rejected'
);
select pg_temp.expect_error(
  format('update public.guests set email = %L where id = %L', 'Ola@Example.com', :'g2'),
  'upper-case e-mail rejected (stored lower-case)'
);
select pg_temp.expect_error(
  format('update public.guests set email = %L where id = %L', repeat('a', 250) || '@x.pl', :'g2'),
  'e-mail over 254 characters rejected'
);

update public.guests set email = null where id = :'g1';
select ok((select email is null from public.guests where id = :'g1'), 'admin clears the e-mail');
update public.guests set email = 'jan@example.com' where id = :'g1';

-- access -------------------------------------------------------------------------
select pg_temp.act_as(:E);
select ok((select email = 'jan@example.com' from public.guests where id = :'g1'), 'editor reads the e-mail');
-- Who may write guests (ADMIN / EDITOR) is covered by 04_guest_management.

select pg_temp.act_as(:G);
select ok((select count(*) = 0 from public.guests where id = :'g1'), 'guest does not see guest e-mails');

select pg_temp.act_as(:O);
select ok((select count(*) = 0 from public.guests where id = :'g1'), 'outsider does not see guest e-mails');

select * from finish();
rollback;
