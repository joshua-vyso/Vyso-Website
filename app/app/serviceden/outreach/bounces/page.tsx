import { SectionCard } from '@/components/platform/module-ui';
import { BouncesView } from '@/components/platform/serviceden/BouncesView';
import { requireServiceDenSession } from '@/lib/platform/serviceden-access';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { listOutreachBounces, type OutreachBounce } from '@/lib/platform/outreach-bounces';
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

  let bounces: OutreachBounce[] = [];
  let error: string | null = null;
  try {
    const ctx = await requireServiceDenServerContext();
    if (!ctx) {
      error = 'Gmail is not available for this account.';
    } else {
      const result = await listOutreachBounces(ctx, await cachedOutreachLeads());
      bounces = result.bounces ?? [];
      error = result.error;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not read bounces.';
  }

  return <BouncesView bounces={bounces} error={error} />;
}
