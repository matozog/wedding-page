-- =============================================================================
-- Event page configuration - set by the super admin on /events/{id}.
--
--   * events.theme          - colour palette key (palettes live in the
--                             frontend: src/config/themes.ts + index.css)
--   * event_sections        - every page section (and the footer): visible or
--                             hidden, menu label, heading (eyebrow / title /
--                             description) and section text (content_title,
--                             content_body - e.g. the "about" story, the empty
--                             gallery text, the footer message)
--   * event_schedule_items  - "Plan wydarzenia" points
--   * event_locations       - "Jak dojechać" addresses (map per address)
--   * event_contacts        - "Kontakt" entries
--   * event_about_facts     - short "label: value" facts of the "about" section
--   * event_page_photos     - photos of a section (the "about" carousel),
--                             files in the photos bucket under
--                             {event_id}/page/{file}
--
-- Access:
--   * read  - event members (the page is rendered for guests) through RLS,
--             get_event_page() returns everything in one call
--   * write - super admin only, through the RPC functions below. Tables give
--             clients SELECT only (same pattern as events / event_members):
--             a save replaces a whole list in one transaction and enforces
--             the per-event limits, which plain row policies cannot.
--             SECURITY DEFINER for that reason; every function checks
--             require_platform_admin() first.
--
-- No content is copied into existing events - they get default sections
-- like new ones. The seating plan section stays hidden by default (its
-- content is not configurable yet).
-- =============================================================================

create type public.event_section as enum (
  'gallery', 'couple', 'schedule', 'seating', 'location', 'contact', 'footer'
);

-- -----------------------------------------------------------------------------
-- theme
-- -----------------------------------------------------------------------------
alter table public.events
  add column theme text not null default 'sand'
    constraint events_theme_check
    check (theme in ('sand', 'sage', 'blush', 'navy', 'lavender', 'terracotta',
                     'midnight', 'graphite', 'forest', 'wine'));

grant select (theme) on public.events to authenticated;

-- -----------------------------------------------------------------------------
-- tables
-- -----------------------------------------------------------------------------
create table public.event_sections (
  event_id      uuid                 not null references public.events (id) on delete cascade,
  section       public.event_section not null,
  is_visible    boolean              not null default true,
  nav_label     text constraint event_sections_nav_label_length     check (nav_label is null or char_length(nav_label) between 1 and 30),
  eyebrow       text constraint event_sections_eyebrow_length       check (eyebrow is null or char_length(eyebrow) between 1 and 60),
  title         text constraint event_sections_title_length         check (title is null or char_length(title) between 1 and 120),
  description   text constraint event_sections_description_length   check (description is null or char_length(description) between 1 and 1000),
  content_title text constraint event_sections_content_title_length check (content_title is null or char_length(content_title) between 1 and 120),
  content_body  text constraint event_sections_content_body_length  check (content_body is null or char_length(content_body) between 1 and 4000),
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

create table public.event_about_facts (
  id       uuid    primary key default gen_random_uuid(),
  event_id uuid    not null references public.events (id) on delete cascade,
  position integer not null check (position >= 0),
  label    text    not null constraint event_about_facts_label_length check (char_length(label) between 1 and 40),
  value    text    not null constraint event_about_facts_value_length check (char_length(value) between 1 and 120),
  unique (event_id, position)
);

create table public.event_page_photos (
  id           uuid                 primary key default gen_random_uuid(),
  event_id     uuid                 not null references public.events (id) on delete cascade,
  section      public.event_section not null,
  position     integer              not null default 0 check (position >= 0),
  storage_path text                 not null unique,
  alt_text     text constraint event_page_photos_alt_length check (alt_text is null or char_length(alt_text) between 1 and 200),
  created_at   timestamptz          not null default now(),
  -- the file must live in this event's page folder
  constraint event_page_photos_path check (
    split_part(storage_path, '/', 1) = event_id::text
    and split_part(storage_path, '/', 2) = 'page'
    and split_part(storage_path, '/', 3) <> ''
    and split_part(storage_path, '/', 4) = ''
  )
);

create index event_page_photos_event_idx on public.event_page_photos (event_id, section, position);

alter table public.event_sections       enable row level security;
alter table public.event_schedule_items enable row level security;
alter table public.event_locations      enable row level security;
alter table public.event_contacts       enable row level security;
alter table public.event_about_facts    enable row level security;
alter table public.event_page_photos    enable row level security;

revoke all on public.event_sections, public.event_schedule_items, public.event_locations,
              public.event_contacts, public.event_about_facts, public.event_page_photos
  from anon, authenticated;

grant select on public.event_sections, public.event_schedule_items, public.event_locations,
                public.event_contacts, public.event_about_facts, public.event_page_photos
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

create policy "Event members read about facts"
on public.event_about_facts for select to authenticated
using (public.is_event_member(event_id));

create policy "Event members read page photos"
on public.event_page_photos for select to authenticated
using (public.is_event_member(event_id));

-- -----------------------------------------------------------------------------
-- Storage: page photos ({event_id}/page/{file}) - only the super admin
-- uploads and deletes them. Reading is covered by "Event members can view
-- photo files". The restrictive policy keeps event ADMIN / EDITOR (who may
-- delete any guest photo file) away from the page folder.
-- -----------------------------------------------------------------------------
create policy "Super admin uploads event page photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and split_part(name, '/', 2) = 'page'
  and public.storage_path_event_id(name) is not null
  and (select public.is_platform_admin())
);

create policy "Super admin deletes event page photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
  and split_part(name, '/', 2) = 'page'
  and (select public.is_platform_admin())
);

create policy "Only super admin touches the page folder"
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'photos'
  or split_part(name, '/', 2) <> 'page'
  or (select public.is_platform_admin())
);

-- -----------------------------------------------------------------------------
-- default sections for every event (new ones by trigger, existing ones here)
-- -----------------------------------------------------------------------------
create function public.insert_default_event_sections(p_event_id uuid)
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
    (p_event_id, 'location', true,  'Jak dojechać', 'Dojazd',          null, null),
    (p_event_id, 'contact',  true,  'Kontakt',      'Masz pytania?',
     'W razie pytań dotyczących dojazdu lub programu - śmiało piszcie lub dzwońcie.', null),
    (p_event_id, 'footer',   true,  null,           null,              null,
     'Dziękujemy, że jesteście z nami.')
  on conflict do nothing;
$$;

create function public.create_default_event_sections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.insert_default_event_sections(new.id);
  return new;
end;
$$;

create trigger events_create_default_sections
after insert on public.events
for each row
execute function public.create_default_event_sections();

-- Existing events get the same defaults - no content is copied.
select public.insert_default_event_sections(e.id) from public.events e;

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
               'section', s.section, 'is_visible', s.is_visible, 'nav_label', s.nav_label,
               'eyebrow', s.eyebrow, 'title', s.title, 'description', s.description,
               'content_title', s.content_title, 'content_body', s.content_body
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
    ), '[]'::jsonb),
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.position)
      from public.event_about_facts f
      where f.event_id = e.id
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'section', p.section, 'storage_path', p.storage_path, 'alt_text', p.alt_text
             ) order by p.section, p.position, p.created_at)
      from public.event_page_photos p
      where p.event_id = e.id
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
     or p_theme not in ('sand', 'sage', 'blush', 'navy', 'lavender', 'terracotta',
                        'midnight', 'graphite', 'forest', 'wine') then
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
-- save_event_section - texts of a section and (optionally) its list, in one
-- transaction.
--
-- p_content: { "nav_label", "eyebrow", "title", "description",
--              "content_title", "content_body" } - missing / empty -> null
-- p_items (null = list unchanged):
--   schedule: [{ "time_label", "title", "description" }]            max 30
--   location: [{ "label", "name", "address", "show_map" }]          max 6
--   contact:  [{ "label", "name", "email", "phone" }]               max 6
--   couple:   [{ "label", "value" }]  (facts)                       max 4
-- -----------------------------------------------------------------------------
create function public.save_event_section(
  p_event_id uuid,
  p_section  public.event_section,
  p_content  jsonb,
  p_items    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();

  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Nieprawidłowa treść sekcji.' using errcode = 'PT400';
  end if;

  update public.event_sections s
  set nav_label     = public.clean_text(p_content ->> 'nav_label'),
      eyebrow       = public.clean_text(p_content ->> 'eyebrow'),
      title         = public.clean_text(p_content ->> 'title'),
      description   = public.clean_text(p_content ->> 'description'),
      content_title = public.clean_text(p_content ->> 'content_title'),
      content_body  = public.clean_text(p_content ->> 'content_body')
  where s.event_id = p_event_id
    and s.section = p_section;

  if not found then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;

  if p_items is null then
    return;
  end if;

  case p_section
    when 'schedule' then
      perform public.require_item_list(p_items, 30, 'punkty planu');
      delete from public.event_schedule_items i where i.event_id = p_event_id;
      insert into public.event_schedule_items (event_id, position, time_label, title, description)
      select p_event_id,
             (x.ord - 1)::integer,
             public.clean_text(x.item ->> 'time_label'),
             coalesce(public.clean_text(x.item ->> 'title'), ''),
             public.clean_text(x.item ->> 'description')
      from jsonb_array_elements(p_items) with ordinality as x (item, ord);

    when 'location' then
      perform public.require_item_list(p_items, 6, 'adresy');
      delete from public.event_locations l where l.event_id = p_event_id;
      insert into public.event_locations (event_id, position, label, name, address, show_map)
      select p_event_id,
             (x.ord - 1)::integer,
             public.clean_text(x.item ->> 'label'),
             coalesce(public.clean_text(x.item ->> 'name'), ''),
             coalesce(public.clean_text(x.item ->> 'address'), ''),
             coalesce((x.item ->> 'show_map')::boolean, true)
      from jsonb_array_elements(p_items) with ordinality as x (item, ord);

    when 'contact' then
      perform public.require_item_list(p_items, 6, 'kontakty');
      delete from public.event_contacts c where c.event_id = p_event_id;
      insert into public.event_contacts (event_id, position, label, name, email, phone)
      select p_event_id,
             (x.ord - 1)::integer,
             public.clean_text(x.item ->> 'label'),
             public.clean_text(x.item ->> 'name'),
             lower(public.clean_text(x.item ->> 'email')),
             public.clean_text(x.item ->> 'phone')
      from jsonb_array_elements(p_items) with ordinality as x (item, ord);

    when 'couple' then
      perform public.require_item_list(p_items, 4, 'informacje');
      delete from public.event_about_facts f where f.event_id = p_event_id;
      insert into public.event_about_facts (event_id, position, label, value)
      select p_event_id,
             (x.ord - 1)::integer,
             coalesce(public.clean_text(x.item ->> 'label'), ''),
             coalesce(public.clean_text(x.item ->> 'value'), '')
      from jsonb_array_elements(p_items) with ordinality as x (item, ord);

    else
      raise exception 'Ta sekcja nie ma listy pozycji.' using errcode = 'PT400';
  end case;
end;
$$;

-- -----------------------------------------------------------------------------
-- Page photos. The client uploads the file to {event_id}/page/{file} first
-- (storage policy above), then registers it here. Deleting: the row first,
-- then the client removes the file (a leftover file is harmless, a row
-- without a file would show a broken image).
-- -----------------------------------------------------------------------------
create function public.add_event_page_photo(
  p_event_id     uuid,
  p_section      public.event_section,
  p_storage_path text,
  p_alt_text     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_platform_admin();

  if p_section <> 'couple' then
    raise exception 'Ta sekcja nie ma zdjęć.' using errcode = 'PT400';
  end if;

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'Nie znaleziono wydarzenia.' using errcode = 'PT404';
  end if;

  if (select count(*) from public.event_page_photos p
      where p.event_id = p_event_id and p.section = p_section) >= 10 then
    raise exception 'Maksymalnie 10 zdjęć w sekcji.' using errcode = 'PT400';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'photos' and o.name = p_storage_path
  ) then
    raise exception 'Nie znaleziono pliku zdjęcia.' using errcode = 'PT400';
  end if;

  insert into public.event_page_photos (event_id, section, position, storage_path, alt_text)
  values (
    p_event_id,
    p_section,
    coalesce((select max(p.position) + 1 from public.event_page_photos p
              where p.event_id = p_event_id and p.section = p_section), 0),
    p_storage_path,
    public.clean_text(p_alt_text)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Order and alt texts: p_items = [{ "id", "alt_text" }] - every photo of the
-- section, in the new order.
create function public.save_event_page_photos(
  p_event_id uuid,
  p_section  public.event_section,
  p_items    jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  perform public.require_item_list(p_items, 10, 'zdjęcia');

  if (select count(*) from public.event_page_photos p
      where p.event_id = p_event_id and p.section = p_section)
     <> jsonb_array_length(p_items) then
    raise exception 'Lista zdjęć jest nieaktualna - odśwież stronę.' using errcode = 'PT409';
  end if;

  update public.event_page_photos p
  set position = (x.ord - 1)::integer,
      alt_text = public.clean_text(x.item ->> 'alt_text')
  from jsonb_array_elements(p_items) with ordinality as x (item, ord)
  where p.id = (x.item ->> 'id')::uuid
    and p.event_id = p_event_id
    and p.section = p_section;

  if not found and jsonb_array_length(p_items) > 0 then
    raise exception 'Lista zdjęć jest nieaktualna - odśwież stronę.' using errcode = 'PT409';
  end if;
end;
$$;

-- Returns the storage path of the removed photo (the client deletes the file).
create function public.delete_event_page_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  perform public.require_platform_admin();

  delete from public.event_page_photos p
  where p.id = p_photo_id
  returning p.storage_path into v_path;

  if v_path is null then
    raise exception 'Nie znaleziono zdjęcia.' using errcode = 'PT404';
  end if;

  return v_path;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.create_default_event_sections()                                   from public, anon, authenticated;
revoke execute on function public.insert_default_event_sections(uuid)                                from public, anon, authenticated;
revoke execute on function public.clean_text(text)                                                  from public, anon, authenticated;
revoke execute on function public.require_item_list(jsonb, integer, text)                            from public, anon, authenticated;
revoke execute on function public.get_event_page(uuid)                                              from public, anon;
revoke execute on function public.set_event_theme(uuid, text)                                       from public, anon;
revoke execute on function public.set_event_section_visibility(uuid, public.event_section, boolean) from public, anon;
revoke execute on function public.save_event_section(uuid, public.event_section, jsonb, jsonb)      from public, anon;
revoke execute on function public.add_event_page_photo(uuid, public.event_section, text, text)      from public, anon;
revoke execute on function public.save_event_page_photos(uuid, public.event_section, jsonb)         from public, anon;
revoke execute on function public.delete_event_page_photo(uuid)                                     from public, anon;

grant execute on function public.get_event_page(uuid)                                              to authenticated;
grant execute on function public.set_event_theme(uuid, text)                                       to authenticated;
grant execute on function public.set_event_section_visibility(uuid, public.event_section, boolean) to authenticated;
grant execute on function public.save_event_section(uuid, public.event_section, jsonb, jsonb)      to authenticated;
grant execute on function public.add_event_page_photo(uuid, public.event_section, text, text)      to authenticated;
grant execute on function public.save_event_page_photos(uuid, public.event_section, jsonb)         to authenticated;
grant execute on function public.delete_event_page_photo(uuid)                                     to authenticated;
