import { SectionCard } from '@/components/platform/module-ui';
import { BouncesView, type BounceRow } from '@/components/platform/serviceden/BouncesView';
import { requireServiceDenSession } from '@/lib/platform/serviceden-access';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { listOutreachBounces } from '@/lib/platform/outreach-bounces';
import { notionOutreachConfigured } from '@/lib/platform/notion-outreach';
import { cachedOutreachLeads } from '@/lib/platform/outreach-data';

export default async function OutreachBouncesPage() {
  await requireServiceDenSession();

  if (!notionOutreachConfigured) {
    return (
      <SectionCard title="Bounces">
        <p className="text-[14px] text-[#5C605A]">Notion is not connected yet.</p>
      </SectionCard>
    );
  }

  let rows: BounceRow[] = [];
  let error: string | null = null;
  let scanError: string | null = null;

  try {
    const leads = await cachedOutreachLeads();

    // Notion is the permanent record: once a lead is marked Bounced it stays on
    // this page forever, regardless of how long ago the report left the mailbox.
    const byId = new Map<string, BounceRow>();
    for (const lead of leads) {
      if (lead.emailStatus !== 'Bounced' && lead.emailStatus !== 'Do Not Contact') continue;
      byId.set(lead.id, {
        key: lead.id,
        leadId: lead.id,
        company: lead.company,
        email: lead.email,
        kind: 'hard',
        status: lead.emailStatus,
        reason: 'Marked in Notion',
        failedAt: lead.mostRecentContact ?? '',
        phone: lead.phone,
        website: lead.website,
        stage: lead.outreachStage,
        recorded: true,
      });
    }

    // The mailbox scan adds the diagnostic detail, and surfaces failures that
    // have not been recorded yet — those get the "record" button.
    const ctx = await requireServiceDenServerContext();
    if (ctx) {
      const scan = await listOutreachBounces(ctx, leads, { days: 90 });
      if (scan.bounces) {
        for (const b of scan.bounces) {
          if (b.leadId && byId.has(b.leadId)) {
            const row = byId.get(b.leadId)!;
            row.reason = b.reason;
            row.status = b.status;
            row.failedAt = b.failedAt.slice(0, 10);
            row.kind = b.kind;
          } else {
            byId.set(b.leadId ?? b.messageId, {
              key: b.leadId ?? b.messageId,
              leadId: b.leadId,
              company: b.company,
              email: b.email,
              kind: b.kind,
              status: b.status,
              reason: b.reason,
              failedAt: b.failedAt.slice(0, 10),
              phone: b.phone,
              website: b.website,
              stage: b.stage,
              recorded: false,
            });
          }
        }
      } else {
        scanError = scan.error;
      }
    } else {
      scanError = 'Gmail is not available for this account.';
    }

    rows = [...byId.values()].sort((a, b) => (b.failedAt || '').localeCompare(a.failedAt || ''));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not read bounces.';
  }

  return <BouncesView rows={rows} error={error} scanError={scanError} />;
}
