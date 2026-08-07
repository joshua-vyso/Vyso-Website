import { SalesView, type SalesState } from '@/components/platform/serviceden/SalesView';
import { requireServiceDenSession } from '@/lib/platform/serviceden-access';
import { getOutreachLeads, isInSales, notionOutreachConfigured } from '@/lib/platform/notion-outreach';

export default async function ServiceDenSalesPage() {
  await requireServiceDenSession();

  if (!notionOutreachConfigured) {
    return <SalesView state={{ kind: 'unconfigured' }} />;
  }

  let state: SalesState;
  try {
    const all = await getOutreachLeads();
    state = {
      kind: 'ready',
      leads: all.filter(isInSales),
      // Denominator for the hand-off rate: everyone who was ever contacted.
      contactedTotal: all.length,
    };
  } catch (error) {
    state = { kind: 'error', message: error instanceof Error ? error.message : 'Could not reach Notion.' };
  }

  return <SalesView state={state} />;
}
