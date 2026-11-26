-- =============================================================================
-- New page section: shopping list ("Lista zakupów").
-- Separate migration - a new enum value cannot be used in the transaction
-- that adds it (the section, table and functions follow in the next file).
-- =============================================================================
alter type public.event_section add value 'shopping' before 'location';
