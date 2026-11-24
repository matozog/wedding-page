-- =============================================================================
-- "Whose guest" = an inviter from the guest list (replaces HOST_A / HOST_B
-- sides with per-event labels - those never reached a shared database).
--
--   * guests.is_inviter            - person others can be "from" (the couple at
--                                    a wedding, the host and a friend bringing
--                                    colleagues at a party...)
--   * guests.invited_by_guest_id   - the inviter (same event, must be flagged)
--   * guests.invited_jointly       - "Wspólny": invited by all inviters
--   * guest_groups.default_inviter_id / default_invited_jointly - default for
--                                    new members of the group (UI)
--
-- Rules enforced here:
--   * only a guest flagged is_inviter can be referenced, never oneself;
--   * invited_jointly and a specific inviter are mutually exclusive;
--   * unflagging or deleting an inviter clears the references to them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- drop the side model
-- -----------------------------------------------------------------------------
alter table public.guests       add column invited_jointly boolean not null default false;
update public.guests set invited_jointly = true where side = 'BOTH';

alter table public.guests       drop column side;
alter table public.guest_groups drop column side;
drop type public.guest_side;

alter table public.events drop column host_a_label, drop column host_b_label;

-- -----------------------------------------------------------------------------
-- inviters
-- -----------------------------------------------------------------------------
alter table public.guests
  add constraint guests_event_id_id_key unique (event_id, id),
  add column is_inviter          boolean not null default false,
  add column invited_by_guest_id uuid,
  add constraint guests_invited_by_fkey
    foreign key (event_id, invited_by_guest_id)
    references public.guests (event_id, id)
    on delete set null (invited_by_guest_id),
  add constraint guests_not_invited_by_self
    check (invited_by_guest_id is null or invited_by_guest_id <> id),
  add constraint guests_inviter_xor_jointly
    check (not (invited_jointly and invited_by_guest_id is not null));

create index guests_invited_by_guest_id_idx on public.guests (invited_by_guest_id);

alter table public.guest_groups
  add column default_inviter_id      uuid,
  add column default_invited_jointly boolean not null default false,
  add constraint guest_groups_default_inviter_fkey
    foreign key (event_id, default_inviter_id)
    references public.guests (event_id, id)
    on delete set null (default_inviter_id),
  add constraint guest_groups_inviter_xor_jointly
    check (not (default_invited_jointly and default_inviter_id is not null));

-- The referenced guest must be flagged as an inviter. Trigger functions run
-- with the caller's rights (RLS applies) - the composite FK already keeps the
-- reference inside the event.
create function public.guests_check_inviter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invited_by_guest_id is not null
     and (tg_op = 'INSERT' or new.invited_by_guest_id is distinct from old.invited_by_guest_id)
     and not exists (
       select 1 from public.guests g where g.id = new.invited_by_guest_id and g.is_inviter
     ) then
    raise exception 'Wskazana osoba nie jest oznaczona jako zapraszająca.' using errcode = 'PT400';
  end if;
  return new;
end;
$$;

create trigger guests_check_inviter
before insert or update of invited_by_guest_id on public.guests
for each row
execute function public.guests_check_inviter();

create function public.guest_groups_check_inviter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.default_inviter_id is not null
     and (tg_op = 'INSERT' or new.default_inviter_id is distinct from old.default_inviter_id)
     and not exists (
       select 1 from public.guests g where g.id = new.default_inviter_id and g.is_inviter
     ) then
    raise exception 'Wskazana osoba nie jest oznaczona jako zapraszająca.' using errcode = 'PT400';
  end if;
  return new;
end;
$$;

create trigger guest_groups_check_inviter
before insert or update of default_inviter_id on public.guest_groups
for each row
execute function public.guest_groups_check_inviter();

-- Unflagging an inviter releases the people and groups pointing at them.
create function public.guests_release_invitees()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.guests g
  set invited_by_guest_id = null
  where g.event_id = new.event_id
    and g.invited_by_guest_id = new.id;

  update public.guest_groups gg
  set default_inviter_id = null
  where gg.event_id = new.event_id
    and gg.default_inviter_id = new.id;

  return null;
end;
$$;

create trigger guests_release_invitees
after update of is_inviter on public.guests
for each row
when (old.is_inviter and not new.is_inviter)
execute function public.guests_release_invitees();

revoke execute on function public.guests_check_inviter()         from public, anon, authenticated;
revoke execute on function public.guest_groups_check_inviter()   from public, anon, authenticated;
revoke execute on function public.guests_release_invitees()      from public, anon, authenticated;
