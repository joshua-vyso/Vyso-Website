import { SectionCard } from '@/components/platform/module-ui';
import { TemplatesPanel } from '@/components/platform/serviceden/TemplatesPanel';
import { notionOutreachConfigured, type EmailTemplate } from '@/lib/platform/notion-outreach';
import { cachedEmailTemplates } from '@/lib/platform/outreach-data';

export default async function OutreachTemplatesPage() {
  if (!notionOutreachConfigured) {
    return (
      <SectionCard title="Templates">
        <p className="text-[14px] text-[#5C605A]">Notion is not connected yet.</p>
      </SectionCard>
    );
  }

  let templates: EmailTemplate[] | null = null;
  let message = '';
  try {
    templates = await cachedEmailTemplates();
  } catch (error) {
    message = error instanceof Error ? error.message : 'Could not reach Notion.';
  }

  if (!templates) {
    return (
      <SectionCard title="Templates">
        <p className="text-[14px] text-[#B4342B]">{message}</p>
      </SectionCard>
    );
  }

  return <TemplatesPanel initial={templates} />;
}
