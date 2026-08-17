/**
 * The reads behind the suggestion chips — the expensive half of
 * `finch-suggestions.ts`, kept apart from it so the ordering rules stay
 * unit-testable (same split as `serviceden-email.ts` / `-data.ts`, and as W1's
 * `finch-chats.ts` / `finch-chats-shared.ts`).
 *
 * TWO RULES.
 *
 * 1. A CHIP ROW IS NEVER WORTH AN ERROR PAGE. This runs in `app/app/layout.tsx`,
 *    which every single /app/* route renders through. Suggestions are the least
 *    important thing on any of those screens, so every read here is wrapped:
 *    a failure (missing table, RLS surprise, a module this org never enabled)
 *    degrades that input to "nothing to say" and the chips fall back to the
 *    generic openers. Nothing in this file throws.
 *
 * 2. EXISTING READS ONLY. The debtors figures come from the same
 *    `outstandingByCustomer` the Finch tool calls, through the caller's own
 *    RLS-scoped client and behind the same admin gate — so a chip can never
 *    name a customer, or imply a balance, that this user is not allowed to see.
 *    (`canSeeMoney` mirrors `/api/ai/agent`'s own gate: owner/admin only.)
 *
 * COST, HONESTLY. `outstandingByCustomer` is not cheap — it loads the org's
 * invoices, items, payments and credit notes to derive balances exactly as the
 * OrderFlow dashboard does. It is paid once per SERVER render of the platform
 * layout (hard load or `router.refresh()`), never on a client-side navigation,
 * and only for a user who may see money. Even so, a dedicated
 * `of_invoices`-only overdue query would be the right thing here if the chip
 * row ever gets a second consumer — noted in `.ai/implementation.md` rather
 * than built now, because the plan's instruction was to reuse the existing fn.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';
import { outstandingByCustomer } from '@/lib/ai/finch/orderflow-data';
import { suggestionsFor, type OverdueDebtor, type Suggestion, type SuggestionFinding } from './finch-suggestions';

export type { Suggestion } from './finch-suggestions';

/** How many debtors to pull. The chip row can show one; a couple of spares
 *  cost nothing and mean a customer with a blank name doesn't lose the slot. */
const DEBTOR_LIMIT = 3;

/** "Recent" for the documents chip. Matches the plan's wording ("docs uploaded
 *  in the last 7 days") and the sentence the chip actually sends. */
const RECENT_DOC_DAYS = 7;

/** A count, not a list — `head: true` asks PostgREST for the row count and no
 *  rows at all, which is the cheapest question we can ask this table. */
async function recentDocumentCount(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number> {
  const since = new Date(Date.now() - RECENT_DOC_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (error) return 0;
  return count ?? 0;
}

/** Reduce the debtors read to the two things a chip says. `outstanding` comes
 *  back already formatted in Rand (that module formats money for the model);
 *  it is carried as display text and never re-parsed. */
function toDebtors(rows: Array<Record<string, string | number>>): OverdueDebtor[] {
  return rows
    .map((r) => ({
      customer: String(r.customer ?? '').trim(),
      days: Number(r.days_past_terms ?? 0) || 0,
      amount: r.outstanding == null ? null : String(r.outstanding),
    }))
    // A customer we cannot name cannot be addressed in a reminder either.
    .filter((d) => d.customer && d.customer !== 'Unknown' && d.days > 0);
}

/**
 * Gather the inputs and decide the chips, in one call for the layout.
 *
 * `findings` is passed IN rather than read here: the layout already has the
 * open feed (it reads it for the rail badges and the chat prelude), and this
 * wave is not adding a second `agent_findings` query to every route.
 */
export async function suggestionsForOrg(params: {
  orgId: string;
  findings: readonly SuggestionFinding[];
  canSeeMoney: boolean;
  supabase?: SupabaseClient;
}): Promise<Suggestion[]> {
  const { orgId, findings, canSeeMoney } = params;
  const supabase =
    params.supabase ?? ((await createServerSupabase()) as unknown as SupabaseClient);

  const [overdue, recentDocCount] = await Promise.all([
    (async (): Promise<OverdueDebtor[]> => {
      if (!canSeeMoney) return [];
      try {
        const rows = await outstandingByCustomer(supabase, orgId, true, DEBTOR_LIMIT);
        return Array.isArray(rows) ? toDebtors(rows) : [];
      } catch {
        // Rule 1 — an org without OrderFlow, or a read that failed, simply has
        // nothing to suggest about debtors.
        return [];
      }
    })(),
    (async (): Promise<number> => {
      try {
        return await recentDocumentCount(supabase, orgId);
      } catch {
        return 0;
      }
    })(),
  ]);

  return suggestionsFor({ findings, overdue, recentDocCount, canSeeMoney });
}
