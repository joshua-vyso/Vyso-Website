import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeMoney } from '@/lib/platform/access';
import { fetchFindings } from '@/lib/platform/agent-findings';
import { XERO_WATCH_AGENT } from '@/lib/platform/agents/dedupe-keys';
import { loadNotInXeroBills, loadXeroSnapshot } from '@/lib/platform/xero-mirror';
import {
  hubdocSendConfigured,
  hubdocSentDocumentIds,
  loadHubdocForwards,
  loadHubdocSettings,
} from '@/lib/platform/hubdoc';
import { serviceRoleConfigured } from '@/lib/platform/supabase-service';
import { xeroOAuthConfigured } from '@/lib/platform/xero';
import { SAST } from '@/lib/platform/sast';
import {
  XeroConnection,
  type XeroConnectionSummary,
} from '@/components/platform/plugins/XeroConnection';
import { XeroFindings } from '@/components/platform/plugins/XeroFindings';
import { XeroSnapshot } from '@/components/platform/plugins/XeroSnapshot';
import { XeroMissingBills } from '@/components/platform/plugins/XeroMissingBills';
import { HubdocCard } from '@/components/platform/plugins/HubdocCard';
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
 * THE SNAPSHOT IS A THIRD READ, and the mirror it reads is admin-only at the
 * DATABASE level too (supabase/xero-sync.sql gives `xero_invoices` an
 * owner/admin select policy, stricter than `xero_connections`' member one). The
 * `canSeeMoney` redirect above is therefore belt to the policy's braces rather
 * than the only thing standing between a member and the company's ledger.
 *
 * WHY `fetchFindings` AND NOT A FILTERED QUERY. The feed's evidence resolution —
 * which rows a card cites, and where its link goes — happens inside that
 * function, once, for the whole feed. A `select … where agent = 'xero_watch'`
 * here would be cheaper by one predicate and would arrive without any of it, so
 * every card on this page would lose its evidence link. The feed is a few dozen
 * rows and one round-trip.
 */
/**
 * "Last synced 03:20, Wed 19 Aug" — SAST, formatted on the SERVER.
 *
 * Same rule the Brief's `foundAtLabel` follows and for the same reason: a client
 * component rendering a time at hydration can disagree with the HTML it is
 * hydrating, and a flicker on the date of a money figure reads as a bug. Written
 * here rather than reusing `foundAtLabel` because that function's copy begins
 * with the word "Found", which is a claim about an agent rather than about a
 * read — bending it to mean two things would be worse than six lines.
 */
function lastSyncedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: SAST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
  const day = new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(at)
    .replace(/,/g, '');
  return `Last synced ${time}, ${day}`;
}

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
  // Six reads, all through the caller's RLS-scoped client, all soft. The Hubdoc
  // three (X2) join the X1 three for the same reason those were batched: they
  // have no dependency on each other, and a plugin page that fetched them in
  // sequence would spend six round-trips rendering one screen.
  const [query, connectionRow, feed, mirror, hubdoc, forwards, missing] = await Promise.all([
    searchParams,
    db
      .from('xero_connections')
      .select('id, tenant_name, status, last_synced_at')
      .eq('org_id', orgId)
      .maybeSingle(),
    fetchFindings(orgId),
    loadXeroSnapshot(db, orgId),
    loadHubdocSettings(db, orgId),
    loadHubdocForwards(db, orgId),
    loadNotInXeroBills(db, orgId),
  ]);

  // Which of the un-reconciled bills have already gone. A seventh read, and it
  // has to wait for the sixth: it is a lookup BY the ids that one produced.
  const sentDocumentIds = [
    ...(await hubdocSentDocumentIds(db, orgId, missing.bills.map((b) => b.documentId))),
  ];

  const connection = (connectionRow.data as XeroConnectionSummary | null) ?? null;
  const findings = feed.open.filter((f) => f.agent === XERO_WATCH_AGENT);
  const connected = connection?.status === 'connected' || connection?.status === 'syncing';
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

        <XeroSnapshot
          snapshot={mirror.snapshot}
          lastSyncedLabel={lastSyncedLabel(connection?.last_synced_at ?? null)}
          canSync={canManage}
          tableMissing={mirror.tableMissing}
          connected={connected}
        />

        <XeroFindings findings={findings} evidence={feed.evidence} now={now} />

        {/* X2 — the Hubdoc cross-upload, in the order the work happens: WHAT is
            unaccounted for, then WHERE it goes and what has already gone. The
            list is above the settings because that is the sequence an owner
            arrives in ("Xero Watch told me four bills are missing"), and the
            list's own empty state points down at the card when there is no
            address set. */}
        <XeroMissingBills
          bills={missing.bills}
          sentDocumentIds={sentDocumentIds}
          currency={mirror.snapshot.currency}
          canSend={canManage}
          intakeEmailSet={hubdoc.intakeEmail !== null}
          mirrorReady={!missing.tableMissing && !missing.mirrorEmpty}
        />

        <HubdocCard
          intakeEmail={hubdoc.intakeEmail}
          autoForward={hubdoc.autoForward}
          canManage={canManage}
          configured={hubdocSendConfigured}
          tableMissing={hubdoc.tableMissing || forwards.tableMissing}
          forwards={forwards.entries}
        />
      </div>
    </div>
  );
}
