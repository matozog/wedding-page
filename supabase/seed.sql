-- =============================================================================
-- Local development seed - runs only on the local stack after
-- `npx supabase db reset` (never on hosted projects, `db push` ignores it).
--
-- Test event: code TEST123 (case-insensitive).
--
-- To become platform admin locally: open the app, enter the code, set a
-- nickname, then in Studio (http://127.0.0.1:54323) -> SQL Editor run:
--   update public.profiles set is_platform_admin = true where id = '<your user id>';
-- (your user id: Authentication -> Users)
-- =============================================================================

insert into public.events (id, name, starts_at, access_code_hash)
values (
  '00000000-0000-0000-0000-0000000000e1',
  'Wesele testowe',
  '2027-06-12 16:00:00+02',
  extensions.crypt(public.normalize_access_code('TEST123'), extensions.gen_salt('bf'))
)
on conflict (id) do nothing;
