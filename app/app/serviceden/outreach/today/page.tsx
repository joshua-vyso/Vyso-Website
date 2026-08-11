import { SectionCard } from '@/components/platform/module-ui';
import { TodayOutreach } from '@/components/platform/serviceden/TodayOutreach';
import { requireServiceDenSession } from '@/lib/platform/serviceden-access';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { draftInboxFor, type DraftInbox } from '@/lib/platform/outreach-drafts';
import {
  getOutreachLeads,
  notionOutreachConfigured,
  todaySnapshot,
  type TodaySnapshot,
} from '@/lib/platform/notion-outreach';

export default async function TodaysOutreachPage() {
  await requireServiceDenSession();

  if (!notionOutreachConfigured) {
    return (
      <SectionCard title="Today's Outreach">
        <p className="text-[14px] text-[#5C605A]">Notion is not connected yet.</p>
      </SectionCard>
    );
  }

  let snapshot: TodaySnapshot | null = null;
  let inbox: DraftInbox | null = null;
  let draftError: string | null = null;
  let message = '';

  try {
    // One Notion read serves both: the day's summary and the lead set the draft
    // matcher checks recipients against.
    const leads = await getOutreachLeads();
    snapshot = todaySnapshot(leads);

    const ctx = await requireServiceDenServerContext();
    if (ctx) {
      // Gmail failing must not take the page down — the Notion summary stands on
      // its own, so the mailbox error is passed through as a value.
      const result = await draftInboxFor(ctx, leads);
      inbox = result.inbox;
      draftError = result.error;
    } else {
      draftError = 'Gmail is not available for this account.';
    }
  } catch (error) {
    message = error instanceof Error ? error.message : 'Could not reach Notion.';
  }

  if (!snapshot) {
    return (
      <SectionCard title="Today's Outreach">
        <p className="text-[14px] text-[#B4342B]">{message}</p>
      </SectionCard>
    );
  }

  return <TodayOutreach snapshot={snapshot} initialInbox={inbox} initialError={draftError} />;
}
