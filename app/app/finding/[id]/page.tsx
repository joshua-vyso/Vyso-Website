import { notFound, redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { getFinding, listFindingEvidence } from '@/lib/platform/agent-findings';
import { seriesForFinding } from '@/lib/platform/price-watch/series';
import { FindingDetail } from '@/components/platform/brief/FindingDetail';
import type { EvidenceItem } from '@/components/platform/brief/EvidenceList';
import { foundAtLabel, shortDate, unitPrice } from '@/components/platform/brief/brief-display';

/**
 * One finding, in full — `/app/finding/[id]` (design 1c,
 * `.ai/plan_brief_chat_v2.md` §1 item 1 and §4 W3).
 *
 * WHAT THIS PAGE IS FOR. The Brief makes a claim about the owner's money. This
 * is where they check it: the price the agent read, invoice by invoice, with a
 * link into Doc-U beside each one. Everything on it therefore comes from rows —
 * the observation and the rand figure from `agent_findings`, the chart from
 * `pw_price_points`, the strip at the bottom from `documents`. Nothing is
 * illustrative.
 *
 * 404 FOR EVERYTHING THAT ISN'T THIS ORG'S FINDING. `getFinding` filters on
 * `org_id` on top of RLS and returns null for "no such finding", "another org's
 * finding" and "the migration hasn't been applied" alike; all three become
 * `notFound()`. A distinct 403 would confirm to anyone guessing ids that one of
 * them is real. (Findings ARE shared across an org — unlike chats — so any
 * signed-in colleague may open this one.)
 *
 * THREE READS, ALL SOFT EXCEPT THE FIRST. Only the finding itself is allowed to
 * fail the page; the series and the evidence both degrade to nothing and the
 * page renders without a chart or without a strip (plan §5: deleted evidence
 * documents, non-Price-Watch agents). They run in parallel because neither
 * depends on the other.
 *
 * EVERY STRING IS FORMATTED HERE, ON THE SERVER. `FindingDetail` is a client
 * component (it writes rows and drives the chat), and a client formatting a
 * date or a price at hydration can disagree with the HTML it is hydrating — a
 * flicker on the date of a money finding reads as a bug. Same rule the cards
 * follow with `foundLabel`.
 */
export default async function FindingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPlatformSession();
  // The layout guards both of these already; repeating them narrows
  // `session.org` for the reads below and keeps the page correct if it is ever
  // rendered outside that layout.
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');

  const { id } = await params;
  const finding = await getFinding(session.org.id, id);
  if (!finding) notFound();

  // The series module takes the caller's client rather than opening its own —
  // it has no business reaching `next/headers`, and this page already needs one.
  const supabase = await createServerSupabase();
  const [series, evidence] = await Promise.all([
    seriesForFinding(supabase, session.org.id, finding),
    listFindingEvidence(session.org.id, finding),
  ]);

  // The price the agent read off each cited document. A document contributes at
  // most one label — the first line it produced for THIS series — because the
  // card has one line for it, and "R9.42/kg (and 3 others)" answers a question
  // nobody asked on a card whose job is to get them into Doc-U.
  const pointByDoc = new Map<string, { invoice_date: string; unit_price: number }>();
  for (const p of series?.points ?? []) {
    if (!pointByDoc.has(p.document_id)) pointByDoc.set(p.document_id, p);
  }

  const items: EvidenceItem[] = evidence.documents.map((doc) => {
    const point = pointByDoc.get(doc.id);
    return {
      id: doc.id,
      filename: doc.filename,
      // The INVOICE date where the agent extracted one, not the day the file was
      // uploaded — a backfilled invoice is dated when it was issued.
      dateLabel: shortDate(point?.invoice_date ?? doc.created_at),
      priceLabel: point
        ? `${series?.item_name ?? 'This line'} @ ${unitPrice(point.unit_price, series?.base_unit ?? null)}`
        : null,
    };
  });

  return (
    // `pb-[168px]`: the chat dock is an overlay pinned to the bottom of <main>,
    // not an element in this column's flow, so the evidence strip has to leave
    // it room — the same allowance app/app/page.tsx makes for the last card.
    <div className="flex min-h-full">
      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6 pb-[168px] pt-11 sm:px-10">
        <FindingDetail
          finding={finding}
          foundAt={foundAtLabel(finding.created_at)}
          series={series}
          evidence={items}
          evidenceLabel={evidence.label}
          evidenceMissing={evidence.missing}
        />
      </div>
    </div>
  );
}
