-- =============================================================================
-- Expenses view in the management panel.
--
--   * expense_status: PLANNED / BOOKED / PAID -> UNPAID / DEPOSIT_PAID / PAID
--     (renamed in place - existing rows and the column default follow).
--   * expenses.deposit_amount - the deposit already paid. Required for
--     DEPOSIT_PAID (more than 0, less than the total), empty otherwise, so
--     "already paid" = PAID totals + deposits can be computed from one row.
--     expense_payments stays for a future payment history.
--   * expenses.total_amount becomes required.
--   * Length limits on the free-text fields the panel edits.
--   * Access is unchanged: budget_categories / expenses are ADMIN only.
-- =============================================================================

alter type public.expense_status rename value 'PLANNED' to 'UNPAID';
alter type public.expense_status rename value 'BOOKED'  to 'DEPOSIT_PAID';

-- -----------------------------------------------------------------------------
-- total_amount: required
-- -----------------------------------------------------------------------------
update public.expenses set total_amount = 0 where total_amount is null;

alter table public.expenses
  alter column total_amount set not null;

-- -----------------------------------------------------------------------------
-- deposit_amount
-- -----------------------------------------------------------------------------
alter table public.expenses
  add column deposit_amount numeric(12,2);

-- Former BOOKED rows: deposit = recorded payments when they form a valid
-- deposit, otherwise the expense goes back to UNPAID.
update public.expenses e
set deposit_amount = p.paid
from (
  select expense_id, sum(amount) as paid
  from public.expense_payments
  group by expense_id
) p
where p.expense_id = e.id
  and e.status = 'DEPOSIT_PAID'
  and p.paid > 0
  and p.paid < e.total_amount;

update public.expenses
set status = 'UNPAID'
where status = 'DEPOSIT_PAID'
  and deposit_amount is null;

alter table public.expenses
  add constraint expenses_deposit_matches_status check (
    case status
      when 'DEPOSIT_PAID' then deposit_amount is not null
                               and deposit_amount > 0
                               and deposit_amount < total_amount
      else deposit_amount is null
    end
  );

-- -----------------------------------------------------------------------------
-- text limits
-- -----------------------------------------------------------------------------
alter table public.expenses
  add constraint expenses_notes_length check (notes is null or char_length(notes) <= 2000);
