import { createServerSupabase } from './supabase-server';
import { isMissingRelation } from './db-errors';
import {
  PLUGINS,
  xeroStatusTone,
  type PluginRailRow,
  type PluginTone,
} from './plugins';

/**
 * The Plugins section's ONE read — the connection status behind every rail row.
 *
 * WHY IT LIVES BESIDE `plugins.ts` INSTEAD OF INSIDE IT. That module is pure and
 * unit-tested; this one imports `supabase-server` → `next/headers` and can only
 * run inside a request. Keeping the I/O out of the tested leaf is the same split
 * `agents/finding-kinds.ts` and `agent-findings.ts` already have, and the reason
 * is the same: `node --test` cannot resolve `next/headers`.
 *
 * ONE READ FOR THE WHOLE SHELL. `app/app/layout.tsx` calls this once per request
 * and hands the rows to BOTH the desktop rail and the mobile drawer, exactly as
 * it does with the findings counts. A rail row and a drawer row that disagreed
 * about whether Xero is connected would be two queries' worth of a problem
 * nobody needs.
 *
 * THE CALLER'S RLS-SCOPED CLIENT, not the service role. `xero_connections`
 * carries a member-select policy (supabase/xero-integration.sql), so a signed-in
 * page has no excuse to bypass RLS; `org_id` is still pinned by hand on top of
 * it, the same belt-and-braces every other read path here uses.
 *
 * NEVER THROWS. This decorates the rail. A database that has not seen
 * `xero_connections` yet, or a read that fails for any other reason, yields the
 * `idle` dot — which is the truth as far as the product can establish it, and is
 * strictly better than a 500 on every `/app/*` route.
 */
export async function pluginRailRows(orgId: string): Promise<PluginRailRow[]> {
  const statusByKey = await xeroStatus(orgId);
  return PLUGINS.map((p) => ({
    key: p.key,
    label: p.label,
    href: p.href,
    tone: p.key === 'xero' ? statusByKey : ('idle' as PluginTone),
  }));
}

/** The org's Xero connection status, or null when there is no row (or no table).
 *  Exported because the plugin page wants the same fact and should not learn a
 *  second way of asking for it. */
export async function xeroConnectionStatus(orgId: string): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('xero_connections')
      .select('status')
      .eq('org_id', orgId)
      .maybeSingle<{ status: string | null }>();
    // A missing table is the pre-migration case and is not worth distinguishing
    // from "no connection" HERE — both mean the owner has not connected Xero as
    // far as this rail is concerned. The plugin page says more.
    if (error && !isMissingRelation(error)) return null;
    return data?.status ?? null;
  } catch {
    return null;
  }
}

async function xeroStatus(orgId: string): Promise<PluginTone> {
  return xeroStatusTone(await xeroConnectionStatus(orgId));
}
