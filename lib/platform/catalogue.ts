import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The org's WHOLE stock catalogue, paged.
 *
 * Supabase (PostgREST) silently truncates any unbounded select to 1,000 rows —
 * no error, no header you would notice, just 1,000 rows. Turn 'n Slice's
 * catalogue passed 1,000 items (1,060 on 2026-09-04) and every reader that
 * loaded it with a bare `.eq('org_id', …)` — the order-line matcher, the order
 * reader's product list, the review typeahead (which capped itself at 600 by
 * name on top of that) — quietly lost everything from "Thyme" onward. The
 * symptom Josh reported was "Run matching offers far fewer products than the
 * catalogue has"; the cause was that no two screens were looking at the same
 * catalogue. This is the one loader they all use now, so a catalogue of any
 * size is read whole, in order, or not at all.
 *
 * `select` is passed through verbatim so each caller keeps its own column
 * list; `order` defaults to name so the pages are stable between requests.
 */
export const CATALOGUE_PAGE = 1000;

export async function loadOrgStockItems<T = Record<string, unknown>>(
  db: SupabaseClient,
  orgId: string,
  select: string,
  order: { column: string; ascending?: boolean }[] = [{ column: 'name', ascending: true }],
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += CATALOGUE_PAGE) {
    let query = db.from('pp_stock_items').select(select).eq('org_id', orgId);
    for (const o of order) query = query.order(o.column, { ascending: o.ascending ?? true });
    // `id` as the final tiebreaker so a page boundary never splits or repeats
    // two rows that sort equal on the caller's columns.
    query = query.order('id', { ascending: true });
    const { data, error } = await query.range(from, from + CATALOGUE_PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < CATALOGUE_PAGE) return rows;
  }
}

/** Just the names — what the order readers hand the model as its product list. */
export async function loadOrgProductNames(db: SupabaseClient, orgId: string): Promise<string[]> {
  const rows = await loadOrgStockItems<{ name: string | null }>(db, orgId, 'name');
  return rows.map((r) => r.name ?? '').filter(Boolean);
}
