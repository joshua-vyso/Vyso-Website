import type { ReactNode } from 'react';
import { SubNav } from '@/components/platform/SubNav';
import { requireServiceDenSession } from '@/lib/platform/serviceden-access';
import { isInOutreach, notionOutreachConfigured, outreachToday } from '@/lib/platform/notion-outreach';
import { cachedEmailTemplates, cachedOutreachLeads } from '@/lib/platform/outreach-data';

const ROOT = '/app/serviceden/outreach';

/**
 * The submenu every Outreach screen shares. Counts come from the same
 * request-scoped reads the pages use, so labelling the tabs costs nothing
 * extra, and a Notion outage drops the counts rather than the navigation.
 */
export default async function OutreachLayout({ children }: { children: ReactNode }) {
  await requireServiceDenSession();

  let leadCount: number | null = null;
  let dueToday = 0;
  let templateCount: number | null = null;

  if (notionOutreachConfigured) {
    try {
      const [leads, templates] = await Promise.all([cachedOutreachLeads(), cachedEmailTemplates()]);
      const today = outreachToday();
      const inSequence = leads.filter(isInOutreach);
      leadCount = inSequence.length;
      dueToday = inSequence.filter((l) => l.nextFollowUp === today).length;
      templateCount = templates.length;
    } catch {
      // Counts are decoration; the nav still has to render.
    }
  }

  const tabs = [
    { label: 'Overview', href: ROOT },
    { label: dueToday > 0 ? `Today (${dueToday})` : 'Today', href: `${ROOT}/today` },
    { label: leadCount == null ? 'All leads' : `All leads (${leadCount})`, href: `${ROOT}/leads` },
    { label: templateCount == null ? 'Templates' : `Templates (${templateCount})`, href: `${ROOT}/templates` },
    { label: 'Bounces', href: `${ROOT}/bounces` },
  ];

  return (
    <div className="space-y-6">
      <SubNav tabs={tabs} rootHref={ROOT} />
      {children}
    </div>
  );
}
