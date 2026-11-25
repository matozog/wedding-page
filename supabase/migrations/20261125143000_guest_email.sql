-- =============================================================================
-- Guest e-mail (optional) - groundwork for invitations / reminders.
--
--   * guests.email exists since event_planning (length <= 254), the panel did
--     not edit it until now.
--   * Same format rule as event_contacts.email, stored trimmed and lower-case
--     (sending later deduplicates addresses within a household).
--   * Access as for the other guest columns: ADMIN and EDITOR read and write
--     (EDITOR may edit guests since 20261125130000_seating_layout.sql),
--     guests and outsiders see nothing.
-- =============================================================================

update public.guests
set email = nullif(lower(btrim(email)), '')
where email is not null
  and email is distinct from nullif(lower(btrim(email)), '');

alter table public.guests
  add constraint guests_email_format check (
    email is null
    or (email = lower(email)
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  );
