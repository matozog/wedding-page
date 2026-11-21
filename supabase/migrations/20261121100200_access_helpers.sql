-- =============================================================================
-- Access helpers used by RLS policies and RPC functions.
-- SECURITY DEFINER so policies on event_members can query event_members
-- without recursing into their own RLS.
-- =============================================================================

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Caller's role in the event, null when not a member.
create function public.my_event_role(p_event_id uuid)
returns public.event_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.event_members m
  where m.event_id = p_event_id
    and m.user_id = auth.uid();
$$;

-- Member of the event (or platform admin).
create function public.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
      or exists (
           select 1
           from public.event_members m
           where m.event_id = p_event_id
             and m.user_id = auth.uid()
         );
$$;

-- Has one of the given roles in the event (or platform admin).
create function public.has_event_role(p_event_id uuid, p_roles public.event_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
      or coalesce(public.my_event_role(p_event_id) = any (p_roles), false);
$$;

-- Caller and p_user_id are members of at least one common event.
create function public.shares_event_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members mine
    join public.event_members theirs on theirs.event_id = mine.event_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

-- First folder of a storage object path as uuid, null when it is not a uuid
-- (so a malformed path makes a policy return false instead of erroring).
create function public.storage_path_event_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- Second folder of a storage object path (the uploader's user id).
create function public.storage_path_owner(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(p_name, '/', 2), '');
$$;

revoke execute on function public.is_platform_admin()                             from public, anon;
revoke execute on function public.my_event_role(uuid)                             from public, anon;
revoke execute on function public.is_event_member(uuid)                           from public, anon;
revoke execute on function public.has_event_role(uuid, public.event_role[])       from public, anon;
revoke execute on function public.shares_event_with(uuid)                         from public, anon;
revoke execute on function public.storage_path_event_id(text)                     from public, anon;
revoke execute on function public.storage_path_owner(text)                        from public, anon;

grant execute on function public.is_platform_admin()                       to authenticated;
grant execute on function public.my_event_role(uuid)                       to authenticated;
grant execute on function public.is_event_member(uuid)                     to authenticated;
grant execute on function public.has_event_role(uuid, public.event_role[]) to authenticated;
grant execute on function public.shares_event_with(uuid)                   to authenticated;
grant execute on function public.storage_path_event_id(text)               to authenticated;
grant execute on function public.storage_path_owner(text)                  to authenticated;
