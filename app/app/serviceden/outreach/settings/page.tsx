import { SectionCard } from '@/components/platform/module-ui';
import { SegmentsPanel } from '@/components/platform/serviceden/SegmentsPanel';
import { getSegments, notionOutreachConfigured, type OutreachSegment } from '@/lib/platform/notion-outreach';

export default async function OutreachSettingsPage() {
  if (!notionOutreachConfigured) {
    return (
      <SectionCard title="Settings">
        <p className="text-[14px] text-[#5C605A]">Notion is not connected yet.</p>
      </SectionCard>
    );
  }

  let segments: OutreachSegment[] | null = null;
  let message = '';
  try {
    segments = await getSegments();
  } catch (error) {
    message = error instanceof Error ? error.message : 'Could not reach Notion.';
  }

  if (!segments) {
    return (
      <SectionCard title="Settings">
        <p className="text-[14px] text-[#B4342B]">{message}</p>
      </SectionCard>
    );
  }

  return <SegmentsPanel initial={segments} />;
}
