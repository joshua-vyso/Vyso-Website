import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchSettings } from '@/lib/platform/procurepulse-queries';
import { UnitsCard } from '@/components/platform/procurepulse/UnitsCard';
import {
  EmailIngestCard,
  type IngestEvent,
  type IngestSender,
} from '@/components/platform/settings/EmailIngestCard';
import { BriefNotifications } from '@/components/platform/settings/BriefNotifications';
import { canSeeBrief, canSeeMoney } from '@/lib/platform/access';
import { listSchedules } from '@/lib/platform/brief-schedules';
import { INGEST_DOMAIN, addressFor } from '@/lib/platform/email-ingest-policy';

/**
 * Workspace settings — organisation-wide preferences reached from the profile
 * chip. Owns the organisation's units of measurement (used by Doc-U review +
 * ProcurePulse) and its email-ingestion address, plus a link to the team hub.
 */
export default async function WorkspaceSettings() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const settings = await fetchSettings(db, orgId);

  // Email ingestion. RLS scopes all three reads to the caller's org.
  //
  // Two addresses, two independent secrets: 'documents' goes to your suppliers,
  // 'quotes' goes into your website's contact form. Rows written before the purpose
  // column existed default to 'documents', which is the stricter lane.
  const [addressRows, senderRows, eventRows] = await Promise.all([
    db
      .from('email_ingest_addresses')
      .select('local_part, purpose')
      .eq('org_id', orgId)
      .eq('active', true),
    db.from('email_ingest_senders').select('id, email, status').eq('org_id', orgId).order('created_at', { ascending: false }),
    db
      .from('email_ingests')
      .select('id, from_email, subject, status, documents_created, error, created_at, tag')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const addresses = (addressRows.data ?? []) as { local_part: string; purpose: string | null }[];
  const localPart = addresses.find((a) => (a.purpose ?? 'documents') === 'documents')?.local_part ?? null;
  const quotesLocalPart = addresses.find((a) => a.purpose === 'quotes')?.local_part ?? null;

  const role = session.profile?.role;
  const canManage = role === 'owner' || role === 'admin';

  // Brief notifications are PER-USER, not per-org, so this read is keyed on the
  // signed-in user as well as the org — and it is skipped entirely for a member,
  // who has no Brief to be notified about (v2b made it admin-only). Awaited
  // after the org reads above rather than beside them because it is the only
  // query on this page whose answer nobody else needs.
  const briefSchedules = canSeeBrief(role)
    ? await listSchedules(orgId, session.userId, db)
    : null;

  return (
    <div className="px-8 py-7">
      <div className="min-w-0">
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Workspace settings</h1>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">
          Settings for {session.org?.name ?? 'your organisation'}
        </p>
      </div>

      <div className="mt-6 max-w-[820px] space-y-4">
        {briefSchedules ? (
          <BriefNotifications
            initialSlots={briefSchedules.slots}
            email={session.email}
            tableMissing={briefSchedules.tableMissing}
          />
        ) : null}

        <UnitsCard initialCustom={settings?.custom_units ?? []} />

        <EmailIngestCard
          configured={Boolean(INGEST_DOMAIN)}
          canManage={canManage}
          address={localPart ? addressFor(localPart) : null}
          quotesAddress={quotesLocalPart ? addressFor(quotesLocalPart) : null}
          senders={(senderRows.data ?? []) as IngestSender[]}
          events={(eventRows.data ?? []) as IngestEvent[]}
        />

        {/* Xero moved to Plugins (X1). This page keeps a POINTER rather than a
            second copy of the card, because two screens that can both connect an
            accounting system are two screens that can disagree about whether it
            is connected — and the OAuth round-trip now returns to the plugin
            page, so a card here would also be the wrong place to land. Shown
            only to owners/admins: the plugin routes are gated on `canSeeMoney`
            and a link a member cannot follow is worse than no link. */}
        {canSeeMoney(role) ? (
          <Link
            href="/app/plugins/xero"
            className="flex items-center justify-between gap-4 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]"
          >
            <div className="min-w-0">
              <div className="of-display text-[16px] font-semibold text-[#171A17]">Xero accounting</div>
              <p className="mt-1 text-[13px] text-[#6B6F68]">Manage in Plugins → Xero</p>
            </div>
            <span className="shrink-0 text-[18px] text-[#A0A49C]" aria-hidden>
              ›
            </span>
          </Link>
        ) : null}

        <Link
          href="/app/organisation"
          className="flex items-center justify-between gap-4 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]"
        >
          <div className="min-w-0">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">My Organisation</div>
            <p className="mt-1 text-[13px] text-[#6B6F68]">Team members and recent workspace activity</p>
          </div>
          <span className="shrink-0 text-[18px] text-[#A0A49C]" aria-hidden>
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
