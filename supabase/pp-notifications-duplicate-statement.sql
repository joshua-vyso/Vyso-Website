-- Widen pp_notifications.kind for the 'duplicate_statement' notification.
--
-- Paste into the Supabase SQL editor by hand (the CLI is unlinked), AFTER the
-- stock-intake fixes deploy. Until this runs, feedDocumentToProcurePulse's
-- duplicate-statement notification insert fails on the check constraint and is
-- swallowed (best-effort insert) — the duplicate is still REFUSED, the user just
-- gets no tile telling them why. Nothing else depends on it.
--
-- Matches PpNotificationKind in lib/platform/types.ts exactly. Idempotent.
alter table public.pp_notifications
  drop constraint if exists pp_notifications_kind_check;

alter table public.pp_notifications
  add constraint pp_notifications_kind_check check (kind in
    ('low_stock', 'new_direct_doc', 'new_market_statement', 'duplicate_statement',
     'price_change', 'reorder'));

-- Verify (PostgREST cannot read pg_constraint; this can):
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'pp_notifications_kind_check';
