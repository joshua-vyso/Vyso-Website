import { OutreachView, type OutreachState } from '@/components/platform/serviceden/OutreachView';
import { requireServiceDenSession } from '@/lib/platform/serviceden-access';
import {
  campaignMetrics,
  getCampaigns,
  getEmailTemplates,
  getOutreachLeads,
  industryBreakdown,
  isInOutreach,
  notionOutreachConfigured,
} from '@/lib/platform/notion-outreach';

export default async function ServiceDenOutreachPage() {
  await requireServiceDenSession();

  if (!notionOutreachConfigured) {
    return <OutreachView state={{ kind: 'unconfigured' }} />;
  }

  let state: OutreachState;
  try {
    const [all, templates, cohorts] = await Promise.all([getOutreachLeads(), getEmailTemplates(), getCampaigns()]);
    state = {
      kind: 'ready',
      leads: all.filter(isInOutreach),
      // Metrics span every lead ever contacted, including those that replied —
      // a reply rate computed only over non-repliers would always be zero.
      metrics: campaignMetrics(all, cohorts),
      industries: industryBreakdown(all),
      totalLeads: all.length,
      templates,
    };
  } catch (error) {
    state = { kind: 'error', message: error instanceof Error ? error.message : 'Could not reach Notion.' };
  }

  return <OutreachView state={state} />;
}
