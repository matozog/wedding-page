-- =============================================================================
-- Event page configuration - set by the super admin on /events/{id}.
--
--   * events.theme            - colour palette key (palettes live in the
--                               frontend: src/config/themes.ts + index.css)
--   * event_sections          - every page section: visible or hidden, and
--                               its heading (eyebrow / title / description)
--   * event_schedule_items    - "Plan wydarzenia" points
--   * event_locations         - "Jak dojechać" addresses (map per address)
--   * event_contacts          - "Kontakt" entries
--
-- Access:
--   * read  - event members (the page is rendered for guests) through RLS,
--             get_event_page() returns everything in one call
--   * write - super admin only, through the RPC functions below. Tables give
--             clients SELECT only (same pattern as events / event_members):
--             each save replaces a whole list in one transaction and enforces
--             the per-event limits, which plain row policies cannot.
--             SECURITY DEFINER for that reason; every function checks
--             require_platform_admin() first.
--
-- Existing events get their sections plus the content that has so far been
-- hard-coded in src/config/weddingContent.ts, so the current page looks the
-- same. New events get default sections with neutral headings (trigger).
-- =============================================================================

create type public.event_section as enum (
  'gallery', 'couple', 'schedule', 'seating', 'location', 'contact'
);

-- -----------------------------------------------------------------------------
-- theme
-- -----------------------------------------------------------------------------
alter table public.events
  add column theme text not null default 'sand'
    constraint events_theme_check
    check (theme in ('sand', 'sage', 'blush', 'navy', 'lavender', 'terracotta'));

grant select (theme) on public.events to authenticated;

-- -----------------------------------------------------------------------------
-- tables
-- -----------------------------------------------------------------------------
create table public.event_sections (
  event_id    uuid                 not null references public.events (id) on delete cascade,
  section     public.event_section not null,
  is_visible  boolean              not null default true,
  eyebrow     text constraint event_sections_eyebrow_length     check (eyebrow is null or char_length(eyebrow) between 1 and 60),
  title       text constraint event_sections_title_length       check (title is null or char_length(title) between 1 and 120),
  description text constraint event_sections_description_length check (description is null or char_length(description) between 1 and 1000),
  primary key (event_id, section)
);

create table public.event_schedule_items (
  id          uuid    primary key default gen_random_uuid(),
  event_id    uuid    not null references public.events (id) on delete cascade,
  position    integer not null check (position >= 0),
  time_label  text    constraint event_schedule_items_time_length  check (time_label is null or char_length(time_label) between 1 and 20),
  title       text    not null
                      constraint event_schedule_items_title_length check (char_length(title) between 1 and 120),
  description text    constraint event_schedule_items_description_length check (description is null or char_length(description) between 1 and 500),
  unique (event_id, position)
);

create table public.event_locations (
  id       uuid    primary key default gen_random_uuid(),
  event_id uuid    not null references public.events (id) on delete cascade,
  position integer not null check (position >= 0),
  label    text    constraint event_locations_label_length check (label is null or char_length(label) between 1 and 60),
  name     text    not null
                   constraint event_locations_name_length check (char_length(name) between 1 and 120),
  address  text    not null
                   constraint event_locations_address_length check (char_length(address) between 1 and 300),
  show_map boolean not null default true,
  unique (event_id, position)
);

create table public.event_contacts (
  id       uuid    primary key default gen_random_uuid(),
  event_id uuid    not null references public.events (id) on delete cascade,
  position integer not null check (position >= 0),
  label    text    constraint event_contacts_label_length check (label is null or char_length(label) between 1 and 60),
  name     text    constraint event_contacts_name_length  check (name is null or char_length(name) between 1 and 120),
  email    text    constraint event_contacts_email_format check (
                     email is null
                     or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
                   ),
  phone    text    constraint event_contacts_phone_format check (
                     phone is null or phone ~ '^\+?[0-9 ()-]{3,30}$'
                   ),
  -- a contact is a way to reach someone
  constraint event_contacts_reachable check (email is not null or phone is not null),
  unique (event_id, position)
);

alter table public.event_sections       enable row level security;
alter table public.event_schedule_items enable row level security;
alter table public.event_locations      enable row level security;
alter table public.event_contacts       enable row level security;

revoke all on public.event_sections, public.event_schedule_items,
              public.event_locations, public.event_contacts
  from anon, authenticated;

grant select on public.event_sections, public.event_schedule_items,
                public.event_locations, public.event_contacts
  to authenticated;

create policy "Event members read sections"
on public.event_sections for select to authenticated
using (public.is_event_member(event_id));

create policy "Event members read schedule"
on public.event_schedule_items for select to authenticated
using (public.is_event_member(event_id));

create policy "Event members read locations"
on public.event_locations for select to authenticated
using (public.is_event_member(event_id));

create policy "Event members read contacts"
on public.event_contacts for select to authenticated
using (public.is_event_member(event_id));

-- -----------------------------------------------------------------------------
-- default sections for every new event
-- -----------------------------------------------------------------------------
create function public.create_default_event_sections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_sections (event_id, section, eyebrow, title, description)
  values
    (new.id, 'gallery',  null,           null,             null),
    (new.id, 'couple',   null,           null,             null),
    (new.id, 'schedule', 'Informacje',   'Plan wydarzenia', null),
    (new.id, 'seating',  null,           null,             null),
    (new.id, 'location', 'Jak dojechać', 'Dojazd',          null),
    (new.id, 'contact',  'Kontakt',      'Masz pytania?',
     'W razie pytań dotyczących dojazdu lub programu - śmiało piszcie lub dzwońcie.')
  on conflict do nothing;

  return new;
end;
$$;

create trigger events_create_default_sections
after insert on public.events
for each row
execute function public.create_default_event_sections();

-- -----------------------------------------------------------------------------
-- existing events: the content hard-coded so far in weddingContent.ts
-- -----------------------------------------------------------------------------
insert into public.event_sections (event_id, section, eyebrow, title, description)
select e.id, s.section, s.eyebrow, s.title, s.description
from public.events e
cross join (values
  ('gallery'::public.event_section,  null,           null,                  null),
  ('couple',                         null,           null,                  null),
  ('schedule',                       'Informacje',   'Plan dnia weselnego',
   'Orientacyjny przebieg dnia - godziny mogą jeszcze się nieznacznie zmienić.'),
  ('seating',                        null,           null,                  null),
  ('location',                       'Jak dojechać', 'Ceremonia i wesele',  null),
  ('contact',                        'Kontakt',      'Masz pytania?',
   'W razie pytań dotyczących dojazdu, noclegu lub programu dnia — śmiało piszcie lub dzwońcie.')
) as s (section, eyebrow, title, description)
on conflict do nothing;

insert into public.event_schedule_items (event_id, position, time_label, title, description)
select e.id, i.position, i.time_label, i.title, i.description
from public.events e
cross join (values
  (0, '15:00', 'Ceremonia ślubna',   'Kościół Podwyższenia Krzyża Świętego'),
  (1, '16:00', 'Przyjazd do sali',   'Powitanie chlebem i solą'),
  (2, '16:30', 'Toast powitalny',    'Lampka szampana i pierwsze gratulacje'),
  (3, '17:30', 'Obiad - I danie',    null),
  (4, '19:00', 'Przekąski',          'Zimna płyta'),
  (5, '20:00', 'Pierwszy taniec',    'Para Młoda otwiera parkiet'),
  (6, '20:30', 'Obiad - II danie',   null),
  (7, '21:30', 'Tort weselny',       null),
  (8, '22:30', 'Przekąski nocne',    null)
) as i (position, time_label, title, description);

insert into public.event_locations (event_id, position, label, name, address)
select e.id, l.position, l.label, l.name, l.address
from public.events e
cross join (values
  (0, 'Ceremonia', 'Parafia Matki Bożej Różańcowej', 'ul. Bursztynowa 20, 20-576 Lublin'),
  (1, 'Wesele',    'Dworek Jabłonna',                'Jabłonna-Majątek 44 a, 23-114 Jabłonna-Majątek')
) as l (position, label, name, address);

insert into public.event_contacts (event_id, position, label, email, phone)
select e.id, 0, 'Para młoda', 'mateusz.ozog.dev@gmail.com', '+48 512 805 513'
from public.events e;

-- -----------------------------------------------------------------------------
-- get_event_page - the whole configuration in one call. SECURITY INVOKER:
-- RLS decides; null when the caller cannot see the event.
-- -----------------------------------------------------------------------------
create function public.get_event_page(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'theme', e.theme
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
               'section', s.section, 'is_visible', s.is_visible,
               'eyebrow', s.eyebrow, 'title', s.title, 'description', s.description
             ) order by s.section)
      from public.event_sections s
      where s.event_id = e.id
    ), '[]'::jsonb),
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
               'time_label', i.time_label, 'title', i.title, 'description', i.description
             ) order by i.position)
      from public.event_schedule_items i
      where i.event_id = e.id
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'label', l.label, 'name', l.name, 'address', l.address, 'show_map', l.show_map
             ) order by l.position)
      from public.event_locations l
      where l.event_id = e.id
    ), '[]'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'label', c.label, 'name', c.name, 'email', c.email, 'phone', c.phone
             ) order by c.position)
      from public.event_contacts c
      where c.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.id = p_event_id;
$$;

-- -----------------------------------------------------------------------------
-- Internal helpers.
-- -----------------------------------------------------------------------------

-- Trimmed text, empty -> null.
create function public.clean_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p_value), '');
$$;

-- Saves a section heading; PT404 when the event does not exist.
create function public.save_event_section_header(
  p_event_id    uuid,
  p_section     public.event_section,
  p_eyebrow     text,
  p_title       text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_sections s
  set eyebrow     = public.clean_text(p_eyebrow),
      title       = public.clean_text(p_title),
      description = public.clean_text(p_description)
  where s.event_id = p_event_id
    and s.section = p_section;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- Raises PT400 when p_items is not an array or has more than p_max elements.
create function public.require_item_list(p_items jsonb, p_max integer, p_label text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Nieprawidłowa lista: %.', p_label using errcode = 'PT400';
  end if;

  if jsonb_array_length(p_items) > p_max then
    raise exception 'Maksymalnie % pozycji: %.', p_max, p_label using errcode = 'PT400';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_event_theme / set_event_section_visibility
-- -----------------------------------------------------------------------------
create function public.set_event_theme(p_event_id uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  if p_theme is null
     or p_theme not in ('sand', 'sage', 'blush', 'navy', 'lavender', 'terracotta') then
    raise exception 'Nieznany motyw.' using errcode = 'PT400';
  end if;

  update public.events e
  set theme = p_theme
  where e.id = p_event_id;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

create function public.set_event_section_visibility(
  p_event_id uuid,
  p_section  public.event_section,
  p_visible  boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  update public.event_sections s
  set is_visible = coalesce(p_visible, true)
  where s.event_id = p_event_id
    and s.section = p_section;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- save_event_schedule - heading + all points (replaced in one transaction).
-- p_items: [{ "time_label": "15:00", "title": "...", "description": "..." }]
-- -----------------------------------------------------------------------------
create function public.save_event_schedule(
  p_event_id    uuid,
  p_eyebrow     text,
  p_title       text,
  p_description text,
  p_items       jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  perform public.require_item_list(p_items, 30, 'punkty planu');
  perform public.save_event_section_header(p_event_id, 'schedule', p_eyebrow, p_title, p_description);

  delete from public.event_schedule_items i where i.event_id = p_event_id;

  insert into public.event_schedule_items (event_id, position, time_label, title, description)
  select p_event_id,
         (x.ord - 1)::integer,
         public.clean_text(x.item ->> 'time_label'),
         coalesce(public.clean_text(x.item ->> 'title'), ''),
         public.clean_text(x.item ->> 'description')
  from jsonb_array_elements(p_items) with ordinality as x (item, ord);
end;
$$;

-- -----------------------------------------------------------------------------
-- save_event_locations
-- p_items: [{ "label": "Ceremonia", "name": "...", "address": "...", "show_map": true }]
-- -----------------------------------------------------------------------------
create function public.save_event_locations(
  p_event_id    uuid,
  p_eyebrow     text,
  p_title       text,
  p_description text,
  p_items       jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  perform public.require_item_list(p_items, 6, 'adresy');
  perform public.save_event_section_header(p_event_id, 'location', p_eyebrow, p_title, p_description);

  delete from public.event_locations l where l.event_id = p_event_id;

  insert into public.event_locations (event_id, position, label, name, address, show_map)
  select p_event_id,
         (x.ord - 1)::integer,
         public.clean_text(x.item ->> 'label'),
         coalesce(public.clean_text(x.item ->> 'name'), ''),
         coalesce(public.clean_text(x.item ->> 'address'), ''),
         coalesce((x.item ->> 'show_map')::boolean, true)
  from jsonb_array_elements(p_items) with ordinality as x (item, ord);
end;
$$;

-- -----------------------------------------------------------------------------
-- save_event_contacts
-- p_items: [{ "label": "Świadek", "name": "...", "email": "...", "phone": "..." }]
-- -----------------------------------------------------------------------------
create function public.save_event_contacts(
  p_event_id    uuid,
  p_eyebrow     text,
  p_title       text,
  p_description text,
  p_items       jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  perform public.require_item_list(p_items, 6, 'kontakty');
  perform public.save_event_section_header(p_event_id, 'contact', p_eyebrow, p_title, p_description);

  delete from public.event_contacts c where c.event_id = p_event_id;

  insert into public.event_contacts (event_id, position, label, name, email, phone)
  select p_event_id,
         (x.ord - 1)::integer,
         public.clean_text(x.item ->> 'label'),
         public.clean_text(x.item ->> 'name'),
         lower(public.clean_text(x.item ->> 'email')),
         public.clean_text(x.item ->> 'phone')
  from jsonb_array_elements(p_items) with ordinality as x (item, ord);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.create_default_event_sections()                                        from public, anon, authenticated;
revoke execute on function public.clean_text(text)                                                       from public, anon, authenticated;
revoke execute on function public.save_event_section_header(uuid, public.event_section, text, text, text) from public, anon, authenticated;
revoke execute on function public.require_item_list(jsonb, integer, text)                                 from public, anon, authenticated;
revoke execute on function public.get_event_page(uuid)                                                   from public, anon;
revoke execute on function public.set_event_theme(uuid, text)                                            from public, anon;
revoke execute on function public.set_event_section_visibility(uuid, public.event_section, boolean)      from public, anon;
revoke execute on function public.save_event_schedule(uuid, text, text, text, jsonb)                     from public, anon;
revoke execute on function public.save_event_locations(uuid, text, text, text, jsonb)                    from public, anon;
revoke execute on function public.save_event_contacts(uuid, text, text, text, jsonb)                     from public, anon;

grant execute on function public.get_event_page(uuid)                                              to authenticated;
grant execute on function public.set_event_theme(uuid, text)                                       to authenticated;
grant execute on function public.set_event_section_visibility(uuid, public.event_section, boolean) to authenticated;
grant execute on function public.save_event_schedule(uuid, text, text, text, jsonb)                to authenticated;
grant execute on function public.save_event_locations(uuid, text, text, text, jsonb)               to authenticated;
grant execute on function public.save_event_contacts(uuid, text, text, text, jsonb)                to authenticated;
