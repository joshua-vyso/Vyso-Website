import { NextResponse } from 'next/server';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeMoney } from '@/lib/platform/access';
import { isMissingRelation } from '@/lib/platform/db-errors';

/**
 * Re-assign a supplier's category (`ss_suppliers.category`).
 *
 * WHY A ROUTE AT ALL. The Market sheet's "Suppliers by category" section is the
 * one place in the new Stock & Suppliers page that writes, and the thing it
 * writes is the column that `feedDocumentToSupplySync` fills with the literal
 * string 'General' every time a scanned invoice invents a supplier profile
 * (lib/platform/supplysync-feed.ts). Categorising that pile is a two-second
 * inline edit or it never happens, hence a thin PATCH rather than a form page.
 *
 * WHY OWNER/ADMIN. A category is not money, but it steers every roll-up that
 * groups spend by category, so it sits on the same side of the line as the rest
 * of the buying tools (`canSeeMoney`, lib/platform/access.ts — fail-closed on an
 * unknown role). The client only renders the editor when the same predicate
 * passed on the server, so a 403 here means a hand-rolled request.
 *
 * WHY NO OWNERSHIP LOOKUP. The update is scoped by `org_id` AND runs under the
 * caller's own RLS session (`createServerSupabase`, never the service role), so
 * a supplier id belonging to another org matches zero rows and comes back as a
 * 404 — there is no read-then-write window to lose, and no way to confirm the
 * existence of a row the caller may not see.
 */
async function saveCategory(req: Request) {
  const session = await getPlatformSession();
  const orgId = session?.org?.id;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canSeeMoney(session?.profile?.role)) {
    return NextResponse.json({ error: 'Owners and admins only.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; category?: unknown };
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  // The column is NOT NULL, so a blank category is a rejected edit, not a clear.
  const category = typeof body.category === 'string' ? body.category.trim().slice(0, 60) : '';
  if (!id || !category) {
    return NextResponse.json({ error: 'A supplier and a category are required.' }, { status: 400 });
  }

  const db = await createServerSupabase();
  const { data, error } = await db
    .from('ss_suppliers')
    .update({ category, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id')
    .maybeSingle();

  if (error) {
    // A database that has not run the SupplySync schema yet is a setup problem,
    // not a server fault — say which migration, the way the thresholds route does.
    if (isMissingRelation(error)) {
      return NextResponse.json(
        { error: 'Supplier profiles aren’t set up yet — run the SupplySync schema migration in Supabase.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message || 'Could not save the category.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });

  return NextResponse.json({ ok: true, id, category });
}

/** PATCH is the honest verb for a partial update of one row. */
export async function PATCH(req: Request) {
  return saveCategory(req);
}

/** POST accepted too: `fetch` from a form-ish client and older callers default
 *  to it, and refusing the same body on a different verb helps nobody. */
export async function POST(req: Request) {
  return saveCategory(req);
}
