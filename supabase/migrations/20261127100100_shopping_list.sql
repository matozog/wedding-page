-- =============================================================================
-- Shopping list ("Lista zakupów") - things to buy or bring, added by every
-- event member, each optionally taken care of by one person.
--
--   * event_sections 'shopping'  - page section, hidden by default (texts as
--                                  in the other sections)
--   * event_shopping_settings    - which fields the list shows (super admin)
--   * event_shopping_items       - the entries
--
-- Access:
--   * read  - event members (RLS)
--   * add   - event members while the section is visible; ADMIN / EDITOR
--             (and the super admin) also when it is hidden. Direct INSERT
--             (SECURITY INVOKER), author = caller, optionally assigned to
--             the caller.
--   * edit / delete - the author (list open) or ADMIN / EDITOR / super admin.
--             Direct UPDATE / DELETE, content columns only.
--   * assign / unassign - RPC (SECURITY DEFINER): a member changes
--             assigned_to of someone else's entry, which row policies cannot
--             limit to one column. A member takes a free entry or drops their
--             own; ADMIN / EDITOR may also clear anyone's assignment. Nobody
--             assigns another person.
--   * settings - super admin, through save_shopping_section(); members read
--             them directly (not part of get_event_page, which stays as it is).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- settings
-- -----------------------------------------------------------------------------
create table public.event_shopping_settings (
  event_id      uuid    primary key references public.events (id) on delete cascade,
  show_note     boolean not null default true,
  show_quantity boolean not null default false,
  show_author   boolean not null default true,
  allow_assign  boolean not null default true
);

alter table public.event_shopping_settings enable row level security;

revoke all on public.event_shopping_settings from anon, authenticated;
grant select on public.event_shopping_settings to authenticated;

create policy "Event members read shopping settings"
on public.event_shopping_settings for select to authenticated
using (public.is_event_member(event_id));

-- -----------------------------------------------------------------------------
-- items
-- -----------------------------------------------------------------------------
create table public.event_shopping_items (
  id          uuid        primary key default gen_random_uuid(),
  event_id    uuid        not null references public.events (id) on delete cascade,
  created_by  uuid        default auth.uid()
                          constraint event_shopping_items_created_by_fkey
                          references public.profiles (id) on delete set null,
  assigned_to uuid        constraint event_shopping_items_assigned_to_fkey
                          references public.profiles (id) on delete set null,
  name        text        not null
                          constraint event_shopping_items_name_length check (char_length(name) between 1 and 120),
  note        text        constraint event_shopping_items_note_length check (note is null or char_length(note) between 1 and 500),
  quantity    integer     constraint event_shopping_items_quantity_range check (quantity is null or quantity between 1 and 999),
  unit        text        constraint event_shopping_items_unit_length check (unit is null or char_length(unit) between 1 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index event_shopping_items_event_idx on public.event_shopping_items (event_id, created_at);
create index event_shopping_items_created_by_idx on public.event_shopping_items (created_by);
create index event_shopping_items_assigned_to_idx on public.event_shopping_items (assigned_to);

alter table public.event_shopping_items enable row level security;

revoke all on public.event_shopping_items from anon, authenticated;
-- event_id / created_by / dates are never set by the client; assigned_to only
-- on insert (policy: null or the caller) and later through the RPCs below.
grant select on public.event_shopping_items to authenticated;
grant insert (event_id, name, note, quantity, unit, assigned_to) on public.event_shopping_items to authenticated;
grant update (name, note, quantity, unit) on public.event_shopping_items to authenticated;
grant delete on public.event_shopping_items to authenticated;

-- -----------------------------------------------------------------------------
-- access helpers (SECURITY DEFINER like the other helpers - they read
-- event_sections / settings regardless of the caller's RLS)
-- -----------------------------------------------------------------------------

-- Section visible, or the caller organises the event (ADMIN / EDITOR /
-- super admin may prepare the list before showing it).
create function public.shopping_list_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_event_role(p_event_id, array['ADMIN', 'EDITOR']::public.event_role[])
      or (
           public.is_event_member(p_event_id)
           and exists (
                 select 1
                 from public.event_sections s
                 where s.event_id = p_event_id
                   and s.section = 'shopping'
                   and s.is_visible
               )
         );
$$;

-- Assigning switched on in the event's settings. Only for members - others
-- get false and learn nothing about the event.
create function public.shopping_assign_allowed(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_event_member(p_event_id)
     and coalesce(
           (select st.allow_assign from public.event_shopping_settings st where st.event_id = p_event_id),
           true
         );
$$;

-- -----------------------------------------------------------------------------
-- policies
-- -----------------------------------------------------------------------------
create policy "Event members read shopping items"
on public.event_shopping_items for select to authenticated
using (public.is_event_member(event_id));

create policy "Members add shopping items as themselves"
on public.event_shopping_items for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.shopping_list_open(event_id)
  and (
    assigned_to is null
    or (assigned_to = (select auth.uid()) and public.shopping_assign_allowed(event_id))
  )
);

create policy "Authors and organisers edit shopping items"
on public.event_shopping_items for update to authenticated
using (
  (created_by = (select auth.uid()) and public.shopping_list_open(event_id))
  or public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[])
);

create policy "Authors and organisers delete shopping items"
on public.event_shopping_items for delete to authenticated
using (
  (created_by = (select auth.uid()) and public.shopping_list_open(event_id))
  or public.has_event_role(event_id, array['ADMIN', 'EDITOR']::public.event_role[])
);

-- -----------------------------------------------------------------------------
-- trigger: trimmed texts, unit only with a quantity, updated_at on content
-- changes (assigning does not count - an author editing at the same time
-- would see a false conflict), limits on insert.
-- SECURITY DEFINER: the limit counts all entries of the event, not only the
-- rows visible to the caller.
-- -----------------------------------------------------------------------------
create function public.prepare_shopping_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.note := nullif(btrim(new.note), '');
  new.unit := nullif(btrim(new.unit), '');

  if new.quantity is null then
    new.unit := null;
  end if;

  if tg_op = 'INSERT' then
    -- Concurrent inserts into one event wait here, so each one counts the
    -- rows of the previous ones (the limits hold under parallel requests).
    perform pg_advisory_xact_lock(hashtextextended('event_shopping_items:' || new.event_id::text, 0));

    if (select count(*) from public.event_shopping_items i where i.event_id = new.event_id) >= 500 then
      raise exception 'Lista może mieć najwyżej 500 pozycji.' using errcode = 'PT400';
    end if;

    if new.created_by is not null
       and (select count(*) from public.event_shopping_items i
            where i.event_id = new.event_id and i.created_by = new.created_by) >= 50 then
      raise exception 'Możesz dodać najwyżej 50 pozycji.' using errcode = 'PT400';
    end if;
  elsif (new.name, new.note, new.quantity, new.unit) is distinct from (old.name, old.note, old.quantity, old.unit) then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger event_shopping_items_prepare
before insert or update on public.event_shopping_items
for each row
execute function public.prepare_shopping_item();

-- -----------------------------------------------------------------------------
-- assign / unassign
-- -----------------------------------------------------------------------------

-- The caller takes care of a free entry.
create function public.assign_shopping_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_event_id uuid;
  v_assigned uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  select i.event_id, i.assigned_to
  into v_event_id, v_assigned
  from public.event_shopping_items i
  where i.id = p_item_id
  for update;

  if v_event_id is null or not public.is_event_member(v_event_id) then
    raise exception 'Nie znaleziono pozycji.' using errcode = 'PT404';
  end if;

  if not public.shopping_list_open(v_event_id) or not public.shopping_assign_allowed(v_event_id) then
    raise exception 'Przypisywanie jest wyłączone.' using errcode = 'PT403';
  end if;

  if v_assigned = v_uid then
    return;
  end if;

  if v_assigned is not null then
    raise exception 'Ktoś już się tym zajmuje.' using errcode = 'PT409';
  end if;

  update public.event_shopping_items i
  set assigned_to = v_uid
  where i.id = p_item_id;
end;
$$;

-- The assigned person drops the entry; ADMIN / EDITOR may clear anyone's.
-- Works also with assigning switched off, so nobody stays stuck.
create function public.unassign_shopping_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_event_id uuid;
  v_assigned uuid;
begin
  if v_uid is null then
    raise exception 'Wymagana sesja użytkownika.' using errcode = 'PT401';
  end if;

  select i.event_id, i.assigned_to
  into v_event_id, v_assigned
  from public.event_shopping_items i
  where i.id = p_item_id
  for update;

  if v_event_id is null or not public.is_event_member(v_event_id) then
    raise exception 'Nie znaleziono pozycji.' using errcode = 'PT404';
  end if;

  if v_assigned is null then
    return;
  end if;

  if v_assigned <> v_uid
     and not public.has_event_role(v_event_id, array['ADMIN', 'EDITOR']::public.event_role[]) then
    raise exception 'Możesz zrezygnować tylko z własnej pozycji.' using errcode = 'PT403';
  end if;

  update public.event_shopping_items i
  set assigned_to = null
  where i.id = p_item_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- default section + settings for every event (new ones by the existing
-- trigger, existing ones below). Same rows as before plus 'shopping'.
-- -----------------------------------------------------------------------------
create or replace function public.insert_default_event_sections(p_event_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.event_sections (event_id, section, is_visible, eyebrow, title, description, content_body)
  values
    (p_event_id, 'gallery',  true,  'Wspomnienia',  'Galeria zdjęć',
     'Kliknij zdjęcie, aby je powiększyć. Dodawaj własne kadry przyciskiem w nagłówku.',
     'Bądź pierwszą osobą, która doda zdjęcie!'),
    (p_event_id, 'couple',   true,  'O nas',        null,              null, null),
    (p_event_id, 'schedule', true,  'Informacje',   'Plan wydarzenia', null, null),
    -- content not configurable yet - hidden until it is
    (p_event_id, 'seating',  false, 'Informacje',   'Rozmieszczenie gości', null, null),
    -- hidden until the super admin turns it on
    (p_event_id, 'shopping', false, 'Pomóż nam',    'Lista zakupów',
     'Dopisz, czego brakuje albo co przyniesiesz. Przypisz się do rzeczy, którą się zajmiesz.',
     'Lista jest pusta - dodaj pierwszą rzecz!'),
    (p_event_id, 'location', true,  'Jak dojechać', 'Dojazd',          null, null),
    (p_event_id, 'contact',  true,  'Kontakt',      'Masz pytania?',
     'W razie pytań dotyczących dojazdu lub programu - śmiało piszcie lub dzwońcie.', null),
    (p_event_id, 'footer',   true,  null,           null,              null,
     'Dziękujemy, że jesteście z nami.')
  on conflict do nothing;

  insert into public.event_shopping_settings (event_id)
  values (p_event_id)
  on conflict do nothing;
$$;

-- Existing events: only the missing section and settings are added.
select public.insert_default_event_sections(e.id) from public.events e;

-- -----------------------------------------------------------------------------
-- save_shopping_section - section texts and list settings in one transaction.
-- p_settings: { "show_note", "show_quantity", "show_author", "allow_assign" }
-- - missing keys keep the current value.
-- SECURITY DEFINER like save_event_section (settings have no write grants).
-- -----------------------------------------------------------------------------
create function public.save_shopping_section(
  p_event_id uuid,
  p_content  jsonb,
  p_settings jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Nieprawidłowe ustawienia listy.' using errcode = 'PT400';
  end if;

  -- texts (checks the event and the content object)
  perform public.save_event_section(p_event_id, 'shopping', p_content);

  insert into public.event_shopping_settings as st (event_id, show_note, show_quantity, show_author, allow_assign)
  values (
    p_event_id,
    coalesce((p_settings ->> 'show_note')::boolean, true),
    coalesce((p_settings ->> 'show_quantity')::boolean, false),
    coalesce((p_settings ->> 'show_author')::boolean, true),
    coalesce((p_settings ->> 'allow_assign')::boolean, true)
  )
  on conflict (event_id) do update
    set show_note     = coalesce((p_settings ->> 'show_note')::boolean, st.show_note),
        show_quantity = coalesce((p_settings ->> 'show_quantity')::boolean, st.show_quantity),
        show_author   = coalesce((p_settings ->> 'show_author')::boolean, st.show_author),
        allow_assign  = coalesce((p_settings ->> 'allow_assign')::boolean, st.allow_assign);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.shopping_list_open(uuid)                  from public, anon;
revoke execute on function public.shopping_assign_allowed(uuid)             from public, anon;
revoke execute on function public.prepare_shopping_item()                   from public, anon, authenticated;
revoke execute on function public.assign_shopping_item(uuid)                from public, anon;
revoke execute on function public.unassign_shopping_item(uuid)              from public, anon;
revoke execute on function public.save_shopping_section(uuid, jsonb, jsonb) from public, anon;

-- the helpers are called from RLS policies, which run as the caller
grant execute on function public.shopping_list_open(uuid)                  to authenticated;
grant execute on function public.shopping_assign_allowed(uuid)             to authenticated;
grant execute on function public.assign_shopping_item(uuid)                to authenticated;
grant execute on function public.unassign_shopping_item(uuid)              to authenticated;
grant execute on function public.save_shopping_section(uuid, jsonb, jsonb) to authenticated;
