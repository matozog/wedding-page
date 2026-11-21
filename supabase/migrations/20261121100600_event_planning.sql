-- =============================================================================
-- Event planning (admin panel data): guest list, seating, budget & expenses.
--
-- Access:
--   guest_groups, guests        ADMIN / EDITOR: full access
--   seating_tables              ADMIN / EDITOR: full access, other members: read
--   budget_categories,
--   expenses, expense_payments  ADMIN only
--   Members (GUEST) see the seating plan with names only, via
--   get_seating_plan() - never the guests table itself (contacts, diet, notes).
--
-- Every child row carries event_id and references its parent through a
-- composite (event_id, id) foreign key, so rows can never point at data from
-- another event.
--
-- Clients write these tables directly (no RPC) - RLS checks the event role.
-- =============================================================================

create type public.guest_side      as enum ('BRIDE', 'GROOM', 'BOTH');
create type public.guest_age_group as enum ('ADULT', 'CHILD', 'INFANT');
create type public.rsvp_status     as enum ('PENDING', 'ATTENDING', 'DECLINED');
create type public.expense_status  as enum ('PLANNED', 'BOOKED', 'PAID');

-- -----------------------------------------------------------------------------
-- guest_groups - an invitation / household, e.g. "Kowalscy"
-- -----------------------------------------------------------------------------
create table public.guest_groups (
  id                 uuid        primary key default gen_random_uuid(),
  event_id           uuid        not null references public.events (id) on delete cascade,
  name               text        not null check (char_length(btrim(name)) between 1 and 120),
  notes              text,
  invitation_sent_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (event_id, id)
);

-- -----------------------------------------------------------------------------
-- seating_tables - kept minimal on purpose, layout fields come with the
-- drawing library. capacity is informational (no hard limit).
-- -----------------------------------------------------------------------------
create table public.seating_tables (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references public.events (id) on delete cascade,
  name       text        not null check (char_length(btrim(name)) between 1 and 60),
  capacity   integer     check (capacity is null or capacity > 0),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, name)
);

-- -----------------------------------------------------------------------------
-- guests - the guest list. Independent of app accounts; user_id optionally
-- links an entry to a profile (e.g. to show "your table" later).
-- -----------------------------------------------------------------------------
create table public.guests (
  id                  uuid                   primary key default gen_random_uuid(),
  event_id            uuid                   not null references public.events (id) on delete cascade,
  group_id            uuid,
  first_name          text,
  last_name           text,
  is_plus_one         boolean                not null default false,
  side                public.guest_side,
  age_group           public.guest_age_group not null default 'ADULT',
  rsvp_status         public.rsvp_status     not null default 'PENDING',
  diet                text,
  needs_accommodation boolean                not null default false,
  needs_transport     boolean                not null default false,
  email               text,
  phone               text,
  notes               text,
  user_id             uuid                   references public.profiles (id) on delete set null,
  table_id            uuid,
  seat_number         integer                check (seat_number is null or seat_number > 0),
  created_at          timestamptz            not null default now(),
  updated_at          timestamptz            not null default now(),

  -- a plus-one may stay unnamed, everyone else needs a first name
  constraint guests_name_required
    check (is_plus_one or char_length(btrim(coalesce(first_name, ''))) > 0),
  constraint guests_seat_needs_table
    check (seat_number is null or table_id is not null),
  constraint guests_group_fkey
    foreign key (event_id, group_id)
    references public.guest_groups (event_id, id)
    on delete set null (group_id),
  constraint guests_table_fkey
    foreign key (event_id, table_id)
    references public.seating_tables (event_id, id)
    on delete set null (table_id),
  unique (event_id, user_id),
  unique (table_id, seat_number)
);

create index guests_event_id_idx on public.guests (event_id);
create index guests_group_id_idx on public.guests (group_id);
create index guests_table_id_idx on public.guests (table_id);

-- Removing a guest from a table (or deleting the table) also clears the seat.
create function public.guests_clear_seat_without_table()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.table_id is null then
    new.seat_number := null;
  end if;
  return new;
end;
$$;

create trigger guests_clear_seat_without_table
before insert or update on public.guests
for each row
execute function public.guests_clear_seat_without_table();

-- -----------------------------------------------------------------------------
-- Budget & expenses
-- -----------------------------------------------------------------------------
create table public.budget_categories (
  id             uuid          primary key default gen_random_uuid(),
  event_id       uuid          not null references public.events (id) on delete cascade,
  name           text          not null check (char_length(btrim(name)) between 1 and 60),
  planned_amount numeric(12,2) check (planned_amount is null or planned_amount >= 0),
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  unique (event_id, id),
  unique (event_id, name)
);

create table public.expenses (
  id             uuid                  primary key default gen_random_uuid(),
  event_id       uuid                  not null references public.events (id) on delete cascade,
  category_id    uuid,
  title          text                  not null check (char_length(btrim(title)) between 1 and 120),
  vendor_name    text,
  vendor_contact text,
  total_amount   numeric(12,2)         check (total_amount is null or total_amount >= 0),
  currency       text                  not null default 'PLN' check (currency ~ '^[A-Z]{3}$'),
  due_date       date,
  status         public.expense_status not null default 'PLANNED',
  notes          text,
  created_by     uuid                  default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz           not null default now(),
  updated_at     timestamptz           not null default now(),
  unique (event_id, id),
  constraint expenses_category_fkey
    foreign key (event_id, category_id)
    references public.budget_categories (event_id, id)
    on delete set null (category_id)
);

create index expenses_event_id_idx    on public.expenses (event_id);
create index expenses_category_id_idx on public.expenses (category_id);

-- Deposits / instalments of an expense.
create table public.expense_payments (
  id         uuid          primary key default gen_random_uuid(),
  event_id   uuid          not null,
  expense_id uuid          not null,
  amount     numeric(12,2) not null check (amount > 0),
  paid_at    date          not null default current_date,
  method     text,
  notes      text,
  created_at timestamptz   not null default now(),
  constraint expense_payments_expense_fkey
    foreign key (event_id, expense_id)
    references public.expenses (event_id, id)
    on delete cascade
);

create index expense_payments_expense_id_idx on public.expense_payments (expense_id);

-- updated_at ------------------------------------------------------------------
create trigger guest_groups_set_updated_at      before update on public.guest_groups      for each row execute function public.set_updated_at();
create trigger seating_tables_set_updated_at    before update on public.seating_tables    for each row execute function public.set_updated_at();
create trigger guests_set_updated_at            before update on public.guests            for each row execute function public.set_updated_at();
create trigger budget_categories_set_updated_at before update on public.budget_categories for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at          before update on public.expenses          for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS & grants
-- -----------------------------------------------------------------------------
alter table public.guest_groups      enable row level security;
alter table public.seating_tables    enable row level security;
alter table public.guests            enable row level security;
alter table public.budget_categories enable row level security;
alter table public.expenses          enable row level security;
alter table public.expense_payments  enable row level security;

revoke all on public.guest_groups, public.seating_tables, public.guests,
              public.budget_categories, public.expenses, public.expense_payments
  from anon, authenticated;

grant select, insert, update, delete
  on public.guest_groups, public.seating_tables, public.guests,
     public.budget_categories, public.expenses, public.expense_payments
  to authenticated;

-- guest list: ADMIN / EDITOR
create policy "Editors and admins manage guest groups"
on public.guest_groups
for all
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins manage guests"
on public.guests
for all
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

-- seating tables: everyone in the event reads, ADMIN / EDITOR write
create policy "Members can view seating tables"
on public.seating_tables
for select
to authenticated
using (public.is_event_member(event_id));

create policy "Editors and admins can add seating tables"
on public.seating_tables
for insert
to authenticated
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can update seating tables"
on public.seating_tables
for update
to authenticated
using      (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

create policy "Editors and admins can delete seating tables"
on public.seating_tables
for delete
to authenticated
using (public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[]));

-- budget: ADMIN only
create policy "Admins manage budget categories"
on public.budget_categories
for all
to authenticated
using      (public.has_event_role(event_id, array['ADMIN']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Admins manage expenses"
on public.expenses
for all
to authenticated
using      (public.has_event_role(event_id, array['ADMIN']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

create policy "Admins manage expense payments"
on public.expense_payments
for all
to authenticated
using      (public.has_event_role(event_id, array['ADMIN']::public.event_role[]))
with check (public.has_event_role(event_id, array['ADMIN']::public.event_role[]));

-- -----------------------------------------------------------------------------
-- get_seating_plan - read-only seating plan for any event member.
-- One row per seated guest; empty tables appear once with null guest fields.
-- Exposes names only (no contacts, diet or notes).
-- -----------------------------------------------------------------------------
create function public.get_seating_plan(p_event_id uuid)
returns table (
  table_id    uuid,
  table_name  text,
  capacity    integer,
  seat_number integer,
  guest_id    uuid,
  guest_name  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_event_member(p_event_id) then
    raise exception 'Brak dostępu do wydarzenia.' using errcode = 'PT403';
  end if;

  return query
  select
    t.id,
    t.name,
    t.capacity,
    g.seat_number,
    g.id,
    coalesce(
      nullif(btrim(concat_ws(' ', g.first_name, g.last_name)), ''),
      case when g.id is not null then 'Osoba towarzysząca' end
    )
  from public.seating_tables t
  left join public.guests g on g.table_id = t.id
  where t.event_id = p_event_id
  order by t.name, g.seat_number nulls last, g.last_name, g.first_name;
end;
$$;

revoke execute on function public.get_seating_plan(uuid)               from public, anon;
revoke execute on function public.guests_clear_seat_without_table()    from public, anon, authenticated;
grant  execute on function public.get_seating_plan(uuid)               to authenticated;
