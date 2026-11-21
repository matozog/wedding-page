-- =============================================================================
-- Keep public.profiles in sync with auth.users / auth.identities.
--
--   * New auth user (anonymous or Google)   -> create profile.
--   * Anonymous user links Google
--     (supabase.auth.linkIdentity)          -> same uid, profile gets email,
--                                              is_anonymous = false, and
--                                              name/avatar if still empty.
-- =============================================================================

create function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, is_anonymous, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.is_anonymous, false),
    public.clean_display_name(
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

create function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set
    email        = coalesce(new.email, p.email),
    is_anonymous = coalesce(new.is_anonymous, false),
    display_name = coalesce(
      p.display_name,
      public.clean_display_name(
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
      )
    ),
    avatar_url   = coalesce(p.avatar_url, new.raw_user_meta_data ->> 'avatar_url')
  where p.id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_updated
after update of email, is_anonymous, raw_user_meta_data on auth.users
for each row
when (
  old.email is distinct from new.email
  or old.is_anonymous is distinct from new.is_anonymous
  or old.raw_user_meta_data is distinct from new.raw_user_meta_data
)
execute function public.handle_auth_user_updated();

-- Identity data (Google) can arrive before auth.users metadata is merged,
-- so fill the profile from the identity itself as well.
create function public.handle_auth_identity_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set
    email        = coalesce(p.email, new.identity_data ->> 'email'),
    is_anonymous = false,
    display_name = coalesce(
      p.display_name,
      public.clean_display_name(
        coalesce(new.identity_data ->> 'full_name', new.identity_data ->> 'name')
      )
    ),
    avatar_url   = coalesce(p.avatar_url, new.identity_data ->> 'avatar_url')
  where p.id = new.user_id;

  return new;
end;
$$;

create trigger on_auth_identity_created
after insert on auth.identities
for each row
when (new.provider <> 'anonymous')
execute function public.handle_auth_identity_created();

revoke execute on function public.handle_auth_user_created()     from public, anon, authenticated;
revoke execute on function public.handle_auth_user_updated()     from public, anon, authenticated;
revoke execute on function public.handle_auth_identity_created() from public, anon, authenticated;
