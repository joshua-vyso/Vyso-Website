import { notFound, redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeBrief } from '@/lib/platform/access';
import { getFinding, listFindingEvidence, type FindingEvidence } from '@/lib/platform/agent-findings';
import {
  daysPastTermsLabel,
  evidenceHeading,
  evidenceHeadingWord,
  evidenceMissingCopy,
  evidenceSourceName,
  stockRuleLabel,
} from '@/lib/platform/agents/finding-kinds';
import { seriesForFinding, type FindingSeries } from '@/lib/platform/price-watch/series';
import { xeroMoney } from '@/lib/platform/xero-sync-shared';
import { rand } from '@/lib/platform/procurepulse';
import { firstOpenableModuleHref, railModules } from '@/components/platform/shell/shell-data';
import { FindingDetail } from '@/components/platform/brief/FindingDetail';
import type { EvidenceItem, EvidencePanel } from '@/components/platform/brief/EvidenceList';
import { foundAtLabel, shortDate, unitPrice } from '@/components/platform/brief/brief-display';

/**
 * One finding, in full — `/app/finding/[id]` (design 1c,
 * `.ai/plan_brief_chat_v2.md` §1 item 1 and §4 W3).
 *
 * WHAT THIS PAGE IS FOR. The Brief makes a claim about the owner's money. This
 * is where they check it: the price the agent read, invoice by invoice, with a
 * link beside each one into the module that row lives in. Everything on it
 * therefore comes from rows — the observation and the rand figure from
 * `agent_findings`, the chart from `pw_price_points`, the strip at the bottom
 * from whichever table this agent actually cites. Nothing is illustrative.
 *
 * THE STRIP IS NOT ALWAYS DOCUMENTS. W3 resolved `evidence_refs` against
 * `documents` full stop, which was true of every agent that existed then. Phase
 * C's are not: Debtors Watch cites `of_invoices` and Stock Cover cites nothing at
 * all (its subject lives in the dedupe key). Both therefore came back empty and
 * the page told the owner their evidence was "no longer available" — false, and
 * false in the one place the product is asking to be believed. `listFindingEvidence`
 * now branches on `evidenceKindOf(finding.agent)`, exactly as the feed's resolver
 * does, and this page words each of the three strips.
 *
 * 404 FOR EVERYTHING THAT ISN'T THIS ORG'S FINDING. `getFinding` filters on
 * `org_id` on top of RLS and returns null for "no such finding", "another org's
 * finding" and "the migration hasn't been applied" alike; all three become
 * `notFound()`. A distinct 403 would confirm to anyone guessing ids that one of
 * them is real. (Findings are shared across an org — unlike chats — so any
 * signed-in colleague with brief access may open this one.)
 *
 * OWNERS AND ADMINS ONLY (v2b). This page is a finding in full, which makes it
 * the same money claim the Brief's card is, so it carries the same
 * `canSeeBrief` gate and the same redirect to the caller's first unlocked
 * module. It lives HERE and not in app/app/layout.tsx because Next 16 layouts
 * do not re-render on client-side navigation, so a check in one is not re-run
 * per route (node_modules/next/dist/docs/01-app/02-guides/authentication.md,
 * "Layouts and auth checks"). Note the ORDER below: the role check runs before
 * `getFinding`, so a member never causes a read they are not entitled to make.
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
  // Same gate, same target, same reasoning as app/app/page.tsx — and above the
  // reads, so a member's stale bookmark never costs a query.
  if (!canSeeBrief(session.profile?.role)) {
    redirect(firstOpenableModuleHref(railModules(session.features), session.lockedModules));
  }

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

  const panel = evidencePanel(evidence, series);

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
          evidence={panel}
        />
      </div>
    </div>
  );
}

/**
 * The evidence strip, worded — one of three shapes, all of them already
 * formatted so the client component below has nothing left to compute.
 *
 * The three differ in what an item IS, not in how the strip behaves: a title, a
 * sub-line, an optional figure and an href each, and the same "say nothing
 * rather than claim nothing" rule inside every one of them. A clause whose data
 * is missing (an invoice with no customer name, one that is not actually late) is
 * dropped from the sub-line rather than filled in.
 */
function evidencePanel(evidence: FindingEvidence, series: FindingSeries | null): EvidencePanel {
  const base = {
    heading: evidenceHeading(evidence.kind, evidence.label),
    missingHeading: evidenceHeadingWord(evidence.kind),
    missingCopy: evidenceMissingCopy(evidence.kind),
    missing: evidence.missing,
    openLabel: `Open in ${evidenceSourceName(evidence.kind)} ↗`,
  };

  if (evidence.kind === 'invoices') {
    return {
      ...base,
      mark: 'paper',
      items: evidence.invoices.map((inv) => ({
        id: inv.id,
        href: `/app/orderflow/invoices/${inv.id}`,
        title: `Invoice ${inv.invoice_number}`,
        // "Northern Suburbs Supply · due 4 Jul 2026" — either half alone is
        // still a sentence, so both are optional and the separator follows.
        subtitle: [inv.customer_name, inv.due_date ? `due ${shortDate(inv.due_date)}` : null]
          .filter(Boolean)
          .join(' · '),
        // The BALANCE, not the invoice total: the headline is "R190,900
        // outstanding", and these lines have to be what adds up to it.
        detail: [rand(inv.balance), daysPastTermsLabel(inv.days_overdue)].filter(Boolean).join(' · '),
      })),
    };
  }

  if (evidence.kind === 'xero') {
    return {
      ...base,
      // Paper, not a crate: a Xero invoice is a document the business issued or
      // received, exactly like an OrderFlow one.
      mark: 'paper',
      items: evidence.invoices.map((inv) => ({
        id: inv.id,
        // THE ONLY EVIDENCE LINK IN THIS PRODUCT THAT LEAVES IT. The row lives in
        // Xero and that is where anything can be done about it. The URL was
        // recorded at sync time rather than built here, so a card keeps the link
        // that worked when it was written. A row the sync never gave one falls
        // back to the plugin page — a real destination, and the place the owner
        // would go next anyway.
        href: inv.xero_url ?? '/app/plugins/xero',
        title: inv.invoice_number ? `Invoice ${inv.invoice_number}` : 'Xero invoice',
        // "Northern Suburbs Deli · due 4 Jul 2026 · you owe" — every clause is
        // optional and the separator follows, so a row missing a contact name is
        // still a sentence. The ledger is named because the same strip can carry
        // both directions of money on a duplicate-bill card.
        subtitle: [
          inv.contact_name,
          inv.due_date ? `due ${shortDate(inv.due_date)}` : null,
          inv.type === 'ACCPAY' ? 'you owe' : inv.type === 'ACCREC' ? 'owed to you' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        // Xero's OWN amount_due, quoted, never recomputed — see
        // `listXeroEvidence`. `xeroMoney` keeps a foreign-currency ledger from
        // being drawn with a rand sign.
        detail: [xeroMoney(inv.amount_due, inv.currency), daysPastTermsLabel(inv.days_overdue)]
          .filter(Boolean)
          .join(' · '),
      })),
    };
  }

  if (evidence.kind === 'stock') {
    return {
      ...base,
      mark: 'stock',
      items: evidence.item
        ? [
            {
              id: evidence.item.id,
              href: `/app/procurepulse/stock/${evidence.item.id}`,
              title: evidence.item.name,
              // Which of Stock Cover's two rules fired — the only other thing
              // the dedupe key records, and the difference between "you are
              // about to run out" and "your count does not match your ledger".
              subtitle: stockRuleLabel(evidence.item.rule),
              detail: null,
            },
          ]
        : [],
    };
  }

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
      href: `/app/docu/${doc.id}`,
      title: doc.filename,
      // The INVOICE date where the agent extracted one, not the day the file was
      // uploaded — a backfilled invoice is dated when it was issued.
      subtitle: shortDate(point?.invoice_date ?? doc.created_at),
      detail: point
        ? `${series?.item_name ?? 'This line'} @ ${unitPrice(point.unit_price, series?.base_unit ?? null)}`
        : null,
    };
  });

  return { ...base, mark: 'paper', items };
}
