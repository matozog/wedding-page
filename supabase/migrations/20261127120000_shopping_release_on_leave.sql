-- =============================================================================
-- Shopping list: a person who stops being a member of the event (removed by
-- the ADMIN or leaving through remove_member) no longer blocks the entries
-- they took care of - their assignments in that event are cleared, so others
-- can take the entries.
--
--   * release_shopping_assignments() - trigger AFTER DELETE on event_members
--   * one-off cleanup of assignments of people who are no longer members
--
-- The super admin has access without membership (is_event_member), so their
-- assignments stay. updated_at does not change (assigning is not a content
-- change - see prepare_shopping_item()).
--
-- SECURITY DEFINER: the trigger changes entries of other people, which the
-- caller's RLS does not allow (and event_shopping_items has no UPDATE grant on
-- assigned_to).
-- =============================================================================

create function public.release_shopping_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_shopping_items i
  set assigned_to = null
  where i.event_id = old.event_id
    and i.assigned_to = old.user_id
    and not exists (
      select 1
      from public.profiles p
      where p.id = old.user_id
        and p.is_platform_admin
    );

  return null;
end;
$$;

create trigger event_members_release_shopping_assignments
after delete on public.event_members
for each row
execute function public.release_shopping_assignments();

revoke execute on function public.release_shopping_assignments() from public, anon, authenticated;

-- Existing data: assignments of people who already left.
update public.event_shopping_items i
set assigned_to = null
where i.assigned_to is not null
  and not exists (
    select 1
    from public.event_members m
    where m.event_id = i.event_id
      and m.user_id = i.assigned_to
  )
  and not exists (
    select 1
    from public.profiles p
    where p.id = i.assigned_to
      and p.is_platform_admin
  );
