import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { fetchFindings } from '@/lib/platform/agent-findings';
import { rand } from '@/lib/platform/procurepulse';
import { BriefEmpty } from '@/components/platform/brief/BriefEmpty';
import { FindingCard, ResolvedFindingCard } from '@/components/platform/brief/FindingCard';
import { ReadOvernightBand } from '@/components/platform/brief/ReadOvernightBand';
import {
  AI_GRADIENT_TEXT,
  briefDateLine,
  firstName,
  foundLabel,
  timeOfDayGreeting,
} from '@/components/platform/brief/brief-display';

/**
 * The Brief — what /app is now.
 *
 * It used to redirect to the first enabled module. The product moved: the
 * landing page is what the agents found overnight, and the nine modules are
 * demoted to "under the hood" in the rail (.ai/plan_brief_home.md). Sign-in
 * lands here too (`POST_LOGIN_ROUTE` in app/login/page.tsx).
 *
 * TRUTHFULNESS. Every sentence on this page is derived from rows that exist:
 * the counts come from `agent_findings`, the rand figure is the biggest real
 * `rand_impact`, the supplier count comes from the evidence documents. When a
 * number can't be established the clause is dropped rather than invented.
 *
 * The mock's "overnight I read 12 invoices" line used to be absent for exactly
 * that reason — nothing in the schema recorded that an agent had READ anything.
 * Phase C's Doc Watch does record it, one row per document, so the line exists
 * now and is derived from those rows (ReadOvernightBand). Those rows are
 * informational: `fetchFindings` keeps them out of `open` entirely, so twelve
 * invoices read overnight never inflate "N things need your attention".
 *
 * The page is now just the feed column. The 216px rail it used to own moved to
 * app/app/layout.tsx as AppRail, so it persists across every /app/* route
 * (.ai/plan_chat_first_shell.md §4.1, W2) — which is also why the modules
 * filter and the findings counts the rail needs are derived up there instead
 * of here. W4 moved the chat pill the same way and for the same reason: it is
 * GlobalChatDock now, docked by the layout over every route, with its state in
 * FinchChatProvider so a conversation survives navigation. The findings prelude
 * it sends is built up there too, from the layout's own copy of this feed — so
 * this page no longer serialises anything for the chat, and the bottom of the
 * column is now just padding that keeps the last card clear of the dock.
 * TrialGate and ModuleLockGuard both let this page through: the guard
 * only locks paths owned by a MODULES entry and none of them is `/app`, and
 * the trial gate is a platform-wide expiry screen that /app should not be an
 * exception to.
 */

/** Copy for the two flavours of "nothing here", kept together so they read as
 *  one voice. `tableMissing` is the pre-migration case — same face to the user,
 *  because "your ops software isn't finished" is not their problem. */
const EMPTY_BRIEF = {
  title: 'No findings yet',
  // Named the agents rather than Price Watch alone from Phase C: four of them
  // write here now, and an empty state that credits one would misdescribe the
  // silence of the other three.
  body: 'Vyso reads your invoices, your debtors book and your stock every night — supplier prices against what you paid before, who is past terms, and what is about to run out. Anything worth your attention lands here.',
};
const EMPTY_HISTORY = {
  title: 'Nothing closed yet',
  body: 'Findings you dismiss are kept here, so a mis-click is never the end of the story.',
};

export default async function AppIndex({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getPlatformSession();
  // The layout guards both of these already; repeating them here is what
  // narrows `session.org` for the read below (and keeps the page correct if it
  // is ever rendered outside that layout).
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');

  const [{ view }, feed] = await Promise.all([searchParams, fetchFindings(session.org.id)]);
  const isHistory = view === 'history';

  // One clock for the whole render: the greeting, the date line and every
  // card's "found" label must agree, even across a midnight boundary.
  const now = new Date();
  const name = firstName(session.profile?.full_name);
  const { openCount, maxRandImpact, supplierCount } = feed.summary;

  return (
    // `pb-[168px]`: the chat dock is an overlay pinned to the bottom of <main>
    // now, not an element in this column's flow, so the feed has to leave it
    // room or the last finding card would sit under the pill and its scrim.
    // The reservation is this page's alone — plan §8 E5 forbids adding bottom
    // padding to the modules, which take the overlap and the scrim instead.
    <div className="flex min-h-full">
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-6 pb-[168px] pt-10 sm:px-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pf-text-muted)]">
          {briefDateLine(now)} · {session.org.name}
        </div>

        <h1 className="of-display mt-2.5 text-[clamp(24px,3.2vw,33px)] font-semibold leading-[1.25] tracking-[-0.01em] text-balance text-[var(--pf-text)]">
          {timeOfDayGreeting(now)}
          {name ? ` ${name}` : ''}.{' '}
          {openCount > 0 ? (
            <>
              {openCount === 1 ? '1 thing needs' : `${openCount} things need`} your attention
              {maxRandImpact != null ? (
                <>
                  {' — '}
                  {openCount === 1 ? 'it is' : 'one is'} worth{' '}
                  {/* The one rand figure that carries the AI gradient. */}
                  <span
                    className="of-num whitespace-nowrap bg-clip-text text-transparent"
                    style={{ backgroundImage: AI_GRADIENT_TEXT }}
                  >
                    {rand(maxRandImpact)} a year
                  </span>
                </>
              ) : null}
              .
            </>
          ) : (
            'Nothing needs your attention.'
          )}
        </h1>

        <p className="mt-3.5 flex items-center gap-2 text-[13.5px] text-[var(--pf-text-secondary)]">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: AI_GRADIENT_TEXT }}
            aria-hidden
          >
            ✦
          </span>
          <StatusLine
            tableMissing={feed.tableMissing}
            openCount={openCount}
            supplierCount={supplierCount}
            historyCount={feed.history.length}
          />
        </p>

        <div className="mt-9 flex flex-col gap-3.5">
          {isHistory ? (
            feed.history.length > 0 ? (
              feed.history.map((f) => <ResolvedFindingCard key={f.id} finding={f} />)
            ) : (
              <BriefEmpty {...EMPTY_HISTORY} />
            )
          ) : feed.open.length > 0 ? (
            feed.open.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                evidence={feed.evidence[f.id]}
                foundLabel={foundLabel(f.created_at, now)}
              />
            ))
          ) : (
            <BriefEmpty {...EMPTY_BRIEF} />
          )}
        </div>

        {/* Doc Watch's receipts — "Read this morning". Informational only, below
            the findings and counted in none of them; the band renders nothing
            when there are none, and nothing at all under History. */}
        {isHistory ? null : (
          <ReadOvernightBand findings={feed.informational} evidence={feed.evidence} now={now} />
        )}
      </div>
    </div>
  );
}

/**
 * The ✦ line. Says only what the data supports — no "I read 12 invoices
 * overnight", because nothing records that. The supplier clause disappears when
 * the evidence documents couldn't be resolved, rather than claiming 0.
 */
function StatusLine({
  tableMissing,
  openCount,
  supplierCount,
  historyCount,
}: {
  tableMissing: boolean;
  openCount: number;
  supplierCount: number | null;
  historyCount: number;
}) {
  if (tableMissing) return <>Nothing has been written to your brief yet.</>;

  if (openCount > 0) {
    const findings = `${openCount} open ${openCount === 1 ? 'finding' : 'findings'}`;
    if (supplierCount == null) return <>{findings}.</>;
    return (
      <>
        {findings} across {supplierCount} {supplierCount === 1 ? 'supplier' : 'suppliers'}.
      </>
    );
  }

  if (historyCount > 0) {
    return (
      <>
        {historyCount} {historyCount === 1 ? 'finding' : 'findings'} closed · nothing open right now.
      </>
    );
  }

  return <>No findings yet.</>;
}
