import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation } from './db-errors';
import { todayIso } from './orderflow-debtors';
import { summariseXeroMirror, type XeroMirrorSnapshot, type XeroSnapshotInput } from './xero-sync-shared';

/**
 * Reading the Xero mirror — the one query behind the plugin page's Snapshot, the
 * Finch tool's figures, and (through the agent's own loader) the nightly rules.
 *
 * TAKES A CLIENT RATHER THAN MAKING ONE, deliberately. Three callers need these
 * rows and they arrive with three different clients: the plugin page has the
 * caller's RLS-scoped one, Finch's tool is handed the same through `ToolContext`,
 * and the agent runs with the cron's service-role one. A module that built its
 * own would have to pick one of those and be wrong for the other two — the shape
 * `lib/platform/orderflow-debtors.ts` already uses for exactly this reason.
 *
 * `org_id` IS PINNED REGARDLESS. RLS narrows two of those three callers to the
 * right org; the third has nothing to narrow it. Filtering by hand is what makes
 * the query correct for all three.
 *
 * SOFT ON A MISSING TABLE. `supabase/xero-sync.sql` is pasted into the SQL editor
 * by hand, so a deployed build can legitimately run ahead of the schema. The
 * snapshot then reports `tableMissing` and the page says the sync has not run
 * yet — the same tolerance `fetchFindings` has for `agent_findings`.
 */

/** Columns the snapshot needs, and no more — these rows are money and there is
 *  no reason to move a `reference` or an `xero_url` across the wire to add a
 *  column up. */
const SNAPSHOT_COLS =
  'type, status, due_date, amount_due, currency, contact_id, contact_name';

/** A ceiling on rows read per render. An org with more open Xero invoices than
 *  this has a reporting problem this page is not the answer to, and an unbounded
 *  select on a page render is how a plugin screen becomes a timeout. */
const SNAPSHOT_LIMIT = 5_000;

export interface XeroMirrorResult {
  snapshot: XeroMirrorSnapshot;
  /** True when the mirror tables are not in this database yet. */
  tableMissing: boolean;
  /** True when the mirror holds no rows at all — the sync has never run, or the
   *  Xero organisation is empty. Distinguished from `tableMissing` because the
   *  fixes are different (paste the SQL vs run the sync). */
  empty: boolean;
}

/**
 * The org's Xero position as of `today`.
 *
 * `today` is a parameter rather than a read of the clock so the page, the chat
 * tool and a test can all be pinned to one date and get one deterministic
 * answer — the rule every dated computation in this codebase follows.
 */
export async function loadXeroSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  today: string = todayIso(),
): Promise<XeroMirrorResult> {
  const { data, error } = await supabase
    .from('xero_invoices')
    .select(SNAPSHOT_COLS)
    .eq('org_id', orgId)
    .limit(SNAPSHOT_LIMIT)
    .returns<XeroSnapshotInput[]>();

  if (error) {
    if (isMissingRelation(error)) {
      return { snapshot: summariseXeroMirror([], today), tableMissing: true, empty: true };
    }
    // Any other failure degrades to an empty snapshot rather than throwing: this
    // decorates a page whose Connection block and findings are already rendered,
    // and a plugin page that 500s because one figure could not be read would be
    // a worse answer than a page that says it has nothing to show.
    return { snapshot: summariseXeroMirror([], today), tableMissing: false, empty: true };
  }

  const rows = data ?? [];
  return {
    snapshot: summariseXeroMirror(rows, today),
    tableMissing: false,
    empty: rows.length === 0,
  };
}

/**
 * Every mirrored invoice of one type, for the agent's rules.
 *
 * Separate from the snapshot above because the two want different things: the
 * snapshot wants totals and reads seven columns, the agent wants the rows
 * themselves (ids, numbers, dates) to name them in a finding and cite them as
 * evidence. Sharing one loader would mean the page paying for columns it never
 * draws — the same split `agent-findings.ts` keeps between its feed resolver and
 * its detail resolver.
 */
export interface XeroMirrorInvoice {
  id: string;
  xero_invoice_id: string;
  type: string;
  status: string | null;
  contact_id: string | null;
  contact_name: string | null;
  invoice_number: string | null;
  due_date: string | null;
  date: string | null;
  currency: string | null;
  total: number | null;
  amount_due: number | null;
  xero_url: string | null;
}

const INVOICE_COLS =
  'id, xero_invoice_id, type, status, contact_id, contact_name, invoice_number, due_date, date, currency, total, amount_due, xero_url';

/** Same ceiling, same reasoning as the snapshot's. */
const INVOICE_LIMIT = 5_000;

export async function loadXeroInvoices(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ rows: XeroMirrorInvoice[]; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from('xero_invoices')
    .select(INVOICE_COLS)
    .eq('org_id', orgId)
    .limit(INVOICE_LIMIT)
    .returns<XeroMirrorInvoice[]>();

  if (error) {
    return { rows: [], tableMissing: isMissingRelation(error) };
  }
  return { rows: data ?? [], tableMissing: false };
}
