-- =============================================================================
-- Guest links an anonymous account with Google ("Połącz z kontem Google").
--
-- supabase.auth.linkIdentity keeps the same user id, so photos, shopping
-- entries and memberships already belong to the account - nothing to move.
-- Only the name changes: when the account stops being anonymous, the profile
-- takes the name from Google (the nickname stays when Google gives none).
-- Every entry shows profiles.display_name, so the new name appears
-- everywhere at once.
--
-- The name is read from raw_user_meta_data and, as a fallback, from the Google
-- identity (auth.identities.identity_data) - after linking the identity data
-- does not always reach the user metadata.
-- =============================================================================

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked     boolean := coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false);
  v_identity   jsonb;
  v_google_name text;
begin
  if v_linked then
    select i.identity_data into v_identity
    from auth.identities i
    where i.user_id = new.id
      and i.provider = 'google'
    order by i.created_at desc
    limit 1;

    v_google_name := public.clean_display_name(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      v_identity ->> 'full_name',
      v_identity ->> 'name'
    ));
  end if;

  update public.profiles p
  set
    email        = coalesce(new.email, v_identity ->> 'email', p.email),
    is_anonymous = coalesce(new.is_anonymous, false),
    display_name = case
      when v_linked then coalesce(v_google_name, p.display_name)
      else coalesce(
        p.display_name,
        public.clean_display_name(
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
        )
      )
    end,
    avatar_url   = coalesce(
      p.avatar_url,
      new.raw_user_meta_data ->> 'avatar_url',
      v_identity ->> 'avatar_url'
    )
  where p.id = new.id;

  return new;
end;
$$;
