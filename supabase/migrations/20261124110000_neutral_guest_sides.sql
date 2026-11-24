-- =============================================================================
-- Events are not only weddings: neutral "whose guest" values with per-event
-- labels.
--
--   * guest_side: BRIDE / GROOM / BOTH  ->  HOST_A / HOST_B / BOTH
--     (renamed in place - existing rows keep their meaning).
--   * events.host_a_label / host_b_label - what the panel shows for HOST_A /
--     HOST_B, e.g. "Eunika" / "Mateusz". Both empty = the event has no
--     "whose guest" split and the panel hides that column.
--     Set in Studio for now (no event settings screen yet).
-- =============================================================================

alter type public.guest_side rename value 'BRIDE' to 'HOST_A';
alter type public.guest_side rename value 'GROOM' to 'HOST_B';

alter table public.events
  add column host_a_label text
    constraint events_host_a_label_check
    check (host_a_label is null or char_length(btrim(host_a_label)) between 1 and 40),
  add column host_b_label text
    constraint events_host_b_label_check
    check (host_b_label is null or char_length(btrim(host_b_label)) between 1 and 40);

-- Members already read id, name, starts_at... - the labels are not sensitive.
grant select (host_a_label, host_b_label) on public.events to authenticated;
