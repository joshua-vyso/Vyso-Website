import { SectionCard } from '@/components/platform/module-ui';
import { OutreachTable } from '@/components/platform/serviceden/OutreachTable';
import { isInOutreach, notionOutreachConfigured, type OutreachLead } from '@/lib/platform/notion-outreach';
import { cachedOutreachLeads } from '@/lib/platform/outreach-data';

export default async function OutreachLeadsPage() {
  if (!notionOutreachConfigured) {
    return (
      <SectionCard title="All leads">
        <p className="text-[14px] text-[#5C605A]">Notion is not connected yet.</p>
      </SectionCard>
    );
  }

  // State is built inside the try and rendered outside it: JSX in a try/catch
  // swallows render-time errors that belong to an error boundary.
  let leads: OutreachLead[] | null = null;
  let message = '';
  try {
    leads = (await cachedOutreachLeads()).filter(isInOutreach);
  } catch (error) {
    message = error instanceof Error ? error.message : 'Could not reach Notion.';
  }

  if (!leads) {
    return (
      <SectionCard title="All leads">
        <p className="text-[14px] text-[#B4342B]">{message}</p>
      </SectionCard>
    );
  }

  return <OutreachTable initial={leads} />;
}
