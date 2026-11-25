-- =============================================================================
-- update_guest_group() - edits a group and (optionally) applies its "whose
-- guest" to the members in one transaction. Before, the panel made two
-- separate writes and a failure of the second left the group saved while the
-- dialog reported an error.
--
-- SECURITY INVOKER: the caller's RLS applies (only the event ADMIN can update
-- guest_groups / guests), the function only makes the two writes atomic.
-- Members get the group's inviter except the inviter themselves (a guest
-- cannot be invited by oneself). Raises PT404 when the group is not visible to
-- the caller or was not updated (no permission).
-- =============================================================================
create function public.update_guest_group(
  p_group_id                uuid,
  p_name                    text,
  p_default_invited_jointly boolean,
  -- nullable - defaults make them optional in the generated types
  p_address                 text    default null,
  p_default_inviter_id      uuid    default null,
  p_apply_to_members        boolean default false
)
returns public.guest_groups
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group public.guest_groups;
begin
  update public.guest_groups g
  set name                    = p_name,
      address                 = p_address,
      default_inviter_id      = p_default_inviter_id,
      default_invited_jointly = p_default_invited_jointly
  where g.id = p_group_id
  returning g.* into v_group;

  if v_group.id is null then
    raise exception 'Nie znaleziono grupy.' using errcode = 'PT404';
  end if;

  if p_apply_to_members then
    update public.guests gu
    set invited_by_guest_id = p_default_inviter_id,
        invited_jointly     = p_default_invited_jointly
    where gu.event_id = v_group.event_id
      and gu.group_id = v_group.id
      and (p_default_inviter_id is null or gu.id <> p_default_inviter_id);
  end if;

  return v_group;
end;
$$;

revoke execute on function public.update_guest_group(uuid, text, boolean, text, uuid, boolean) from public, anon;
grant  execute on function public.update_guest_group(uuid, text, boolean, text, uuid, boolean) to authenticated;
