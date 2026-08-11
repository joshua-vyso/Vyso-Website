import { OutreachView, type OutreachState } from '@/components/platform/serviceden/OutreachView';
import {
  campaignMetrics,
  industryBreakdown,
  isInOutreach,
  notionOutreachConfigured,
} from '@/lib/platform/notion-outreach';
import { cachedCampaigns, cachedOutreachLeads } from '@/lib/platform/outreach-data';

export default async function ServiceDenOutreachPage() {
  if (!notionOutreachConfigured) {
    return <OutreachView state={{ kind: 'unconfigured' }} />;
  }

  let state: OutreachState;
  try {
    const [all, cohorts] = await Promise.all([cachedOutreachLeads(), cachedCampaigns()]);
    state = {
      kind: 'ready',
      leads: all.filter(isInOutreach),
      // Metrics span every lead ever contacted, including those that replied —
      // a reply rate computed only over non-repliers would always be zero.
      metrics: campaignMetrics(all, cohorts),
      industries: industryBreakdown(all),
      totalLeads: all.length,
    };
  } catch (error) {
    state = { kind: 'error', message: error instanceof Error ? error.message : 'Could not reach Notion.' };
  }

  return <OutreachView state={state} />;
}
