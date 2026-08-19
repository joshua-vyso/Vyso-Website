import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeMoney } from '@/lib/platform/access';
import { fetchFindings } from '@/lib/platform/agent-findings';
import { XERO_WATCH_AGENT } from '@/lib/platform/agents/dedupe-keys';
import { serviceRoleConfigured } from '@/lib/platform/supabase-service';
import { xeroOAuthConfigured } from '@/lib/platform/xero';
import {
  XeroConnection,
  type XeroConnectionSummary,
} from '@/components/platform/plugins/XeroConnection';
import { XeroFindings } from '@/components/platform/plugins/XeroFindings';
import { firstOpenableModuleHref, railModules } from '@/components/platform/shell/shell-data';

/**
 * `/app/plugins/xero` — everything about this org's Xero connection in one
 * place: whether it is connected, what Vyso has read out of it, what Xero Watch
 * has to say about it, and (from X2) sending supplier invoices on to Hubdoc.
 *
 * OWNERS AND ADMINS ONLY, and the check is in the page rather than a layout —
 * `app/app/plugins/page.tsx` carries the same three lines and the same reasoning
 * (Next 16 layouts do not re-render per client-side navigation).
 *
 * THE OAUTH ROUND-TRIP LANDS HERE NOW. `/api/integrations/xero/{connect,callback}`
 * used to redirect back to `/app/settings`, which was right while the connect
 * card lived there. It does not any more, so both routes were repointed at this
 * page: coming back from Xero's consent screen onto a settings page that no
 * longer mentions Xero would look exactly like a failed connection.
 * `?xero_connected` / `?xero_error` are read below and handed to the card.
 *
 * TWO READS, BOTH SOFT. The connection row is one `maybeSingle` through the
 * caller's RLS-scoped client (`xero_connections` has a member-select policy, and
 * `org_id` is pinned on top of it anyway); the findings come from the Brief's own
 * `fetchFindings`, which already degrades to an empty feed when `agent_findings`
 * is not in this database. Neither can fail the page.
 *
 * WHY `fetchFindings` AND NOT A FILTERED QUERY. The feed's evidence resolution —
 * which rows a card cites, and where its link goes — happens inside that
 * function, once, for the whole feed. A `select … where agent = 'xero_watch'`
 * here would be cheaper by one predicate and would arrive without any of it, so
 * every card on this page would lose its evidence link. The feed is a few dozen
 * rows and one round-trip.
 */
export default async function XeroPluginPage({
  searchParams,
}: {
  searchParams: Promise<{ xero_connected?: string; xero_error?: string }>;
}) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');
  if (!canSeeMoney(session.profile?.role)) {
    redirect(firstOpenableModuleHref(railModules(session.features), session.lockedModules));
  }

  const orgId = session.org.id;
  const role = session.profile?.role;
  const canManage = role === 'owner' || role === 'admin';

  const db = await createServerSupabase();
  const [query, connectionRow, feed] = await Promise.all([
    searchParams,
    db
      .from('xero_connections')
      .select('id, tenant_name, status, last_synced_at')
      .eq('org_id', orgId)
      .maybeSingle(),
    fetchFindings(orgId),
  ]);

  const connection = (connectionRow.data as XeroConnectionSummary | null) ?? null;
  const findings = feed.open.filter((f) => f.agent === XERO_WATCH_AGENT);
  // ONE clock for the whole page, resolved on the server — the same contract the
  // Brief's cards have (see brief-display.ts `foundLabel`).
  const now = new Date();

  return (
    <div className="px-8 py-7">
      <div className="min-w-0">
        <Link
          href="/app/plugins"
          className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#8A8E86] transition-colors hover:text-[#171A17]"
        >
          Plugins
        </Link>
        <h1 className="of-display mt-1 text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">
          Xero
        </h1>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">
          {connection?.tenant_name && connection.status !== 'disconnected'
            ? connection.tenant_name
            : 'Not connected yet'}
        </p>
      </div>

      <div className="mt-6 max-w-[820px] space-y-6">
        <XeroConnection
          configured={xeroOAuthConfigured && serviceRoleConfigured}
          canManage={canManage}
          connection={connection}
          notice={query.xero_connected ? `Connected ${query.xero_connected}` : null}
          initialError={query.xero_error ?? null}
        />

        <XeroFindings findings={findings} evidence={feed.evidence} now={now} />

        {/* X2 — the Hubdoc cross-upload. A placeholder card rather than nothing,
            because Josh's ask was one feature ("highlights findings, cross
            uploads invoices to HubDoc, and has an agent flag any issues") and a
            page that silently omitted a third of it would read as a page that
            had forgotten it. Deliberately NOT a disabled button: there is
            nothing to press yet, and a greyed control invites the click that
            proves it. */}
        <section>
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Hubdoc</h2>
          <div className="mt-3 rounded-2xl border border-dashed border-[#DDE2E9] bg-[#FAFBFC] p-5">
            <div className="text-[13.5px] font-semibold text-[#171A17]">
              Cross-upload to Hubdoc — coming in the next update
            </div>
            <p className="mt-1 text-[13px] text-[#6B6F68]">
              Send a supplier invoice Doc-U has read straight to your Hubdoc intake address, one
              document at a time or as a standing instruction you switch on yourself. Nothing will
              ever be forwarded without you asking for it.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
