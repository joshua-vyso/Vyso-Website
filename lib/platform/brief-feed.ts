/**
 * How many findings The Brief shows, and which ones.
 *
 * THE PROBLEM THIS SOLVES. `fetchFindings` returns every open finding, and the
 * Brief rendered all of them. An org whose agents have been running for a month
 * opens `/app` to twenty-seven cards — which is not a brief, it is a backlog,
 * and a screen that asks for everything gets none of it. The owner's instruction
 * was five cards: "the 5 most imperative, or 4 of the most crucial insights and
 * one card saying 'you have 23 other items that need your attention'".
 *
 * SO THERE ARE TWO DECISIONS HERE, AND BOTH ARE PURE.
 *
 *   1. `rankFindings` — what "most imperative" means, as a total order.
 *   2. `splitForToday` — where the cut falls, and how many are left behind.
 *
 * Neither touches the database and neither renders anything, which is the whole
 * point of the file: the cut is the one piece of this feature that decides what
 * the owner does NOT see, and a rule that silently drops a R40 000 finding off
 * the bottom of the list is invisible until someone loses money. It is pinned by
 * tests/brief-feed.test.ts instead.
 *
 * WHAT IS NOT CAPPED. Receipts (Doc Watch's "read this morning" cards) never
 * pass through here — `fetchFindings` splits them into `informational` before
 * the page sees them, they have their own band, and they count towards nothing.
 * History is uncapped too: it is already a place you go on purpose.
 *
 * THE GREETING KEEPS THE TRUE TOTAL. "{N} things need your attention" is read
 * off `feed.summary.openCount`, not off the cards. The cap is a decision about
 * how much to put on screen at once; it is not a claim that the rest stopped
 * existing, and the overflow card exists precisely so the number in the heading
 * and the number of cards under it never quietly disagree.
 *
 * Framework-free, dependency-free, relative imports only — `node --test` loads
 * this module directly (the `@/` alias does not resolve there; the 2026-08-14
 * Price Watch model outage was exactly that mistake).
 */

/**
 * The minimum a finding has to carry to be ranked.
 *
 * Structural rather than `AgentFinding` so this module imports nothing:
 * `agent-findings.ts` reaches `supabase-server` → `next/headers` and would drag
 * the request context into a test runner that has none. Callers pass their real
 * rows and get the same type back, because both functions are generic.
 */
export interface RankableFinding {
  /** `agent_findings.status`. Only 'new' and 'in_progress' reach the open feed,
   *  but the column is unconstrained text, so an unknown value is ordered last
   *  rather than crashing the sort. */
  status: string;
  rand_impact: number | null;
  /** ISO-8601 from timestamptz — sorts lexically, so no Date objects needed. */
  created_at: string;
}

/** The most cards "Today's brief" will ever draw. */
export const TODAY_CARD_CAP = 5;
/** How many real findings survive the cut once the overflow card is needed.
 *  One less than the cap, because the overflow card occupies the fifth slot. */
export const TODAY_CARD_SHOW = 4;

/**
 * Status rank — lower sorts first.
 *
 * 'new' before 'in_progress' because "in progress" means somebody has already
 * looked at it: it is on the brief so it does not get forgotten, not because it
 * is the most urgent thing this morning. An unknown status (the column is free
 * text) ranks last for the same reason a null rand figure does — say nothing,
 * and put the things we understand in front of it.
 */
function statusRank(status: string): number {
  if (status === 'new') return 0;
  if (status === 'in_progress') return 1;
  return 2;
}

/**
 * "Most imperative", as a total order: unseen first, then by what it costs, then
 * newest.
 *
 * MONEY BEATS RECENCY, DELIBERATELY. The obvious ordering for a feed is newest
 * first, and it is wrong here: the agents run nightly, so "newest" is a
 * near-random tiebreak between everything found in the same 20-minute window,
 * and it would push a R48 000 supplier drift below a R900 one purely because
 * Stock Cover ran five minutes later. `rand_impact` is the only field on the row
 * that says how much this matters.
 *
 * NULLS LAST, NOT ZERO. A finding with no rand figure is one nobody could price
 * — not one worth nothing. Sorting it as 0 would be a claim; sorting it after
 * everything priced is an admission, and it is the same "say nothing rather than
 * claim nothing" rule the rest of the Brief follows.
 *
 * Returns a NEW array. The caller's `feed.open` is shared with the greeting's
 * count and the rail's badge, and a sort in place is how the number in the
 * heading ends up describing a different list from the one below it.
 */
export function rankFindings<T extends RankableFinding>(findings: readonly T[]): T[] {
  return [...findings].sort((a, b) => {
    const byStatus = statusRank(a.status) - statusRank(b.status);
    if (byStatus !== 0) return byStatus;

    // Nulls last. Both null → fall through to the date, so two unpriced
    // findings still have a stable, meaningful order between them.
    const aHas = a.rand_impact != null;
    const bHas = b.rand_impact != null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.rand_impact !== b.rand_impact) {
      return (b.rand_impact as number) - (a.rand_impact as number);
    }

    return b.created_at.localeCompare(a.created_at);
  });
}

/** What "Today's brief" draws: the cards, and how many findings are not among
 *  them. `overflowCount` is 0 when everything fits — the overflow card is
 *  rendered on `> 0`, never on "there might be more". */
export interface TodaySplit<T> {
  cards: T[];
  /** Open findings NOT in `cards`. The number the overflow card quotes. */
  overflowCount: number;
}

/**
 * Cut the open feed down to what fits on one screen.
 *
 * The rule, and why it is not simply `slice(0, cap)`: at exactly `cap` findings
 * there is nothing to overflow to, so all five are shown and no overflow card
 * appears — spending the fifth slot on "you have 0 other items" would be absurd.
 * The moment there are more than `cap`, the fifth slot becomes the overflow card
 * and only `show` real findings survive. That is why crossing from 5 to 6 open
 * findings REMOVES a card from the screen; it is the intended behaviour and the
 * boundary the tests spend most of their time on.
 *
 * RANKING HAPPENS HERE, not at the call site. The cut and the order are one
 * decision — a cap applied to an unranked list is a random four — so this
 * function ranks its input itself and there is no way to ask for the cards
 * without also asking for the ordering that makes them the right ones.
 */
export function splitForToday<T extends RankableFinding>(
  open: readonly T[],
  cap: number = TODAY_CARD_CAP,
  show: number = TODAY_CARD_SHOW,
): TodaySplit<T> {
  const ranked = rankFindings(open);
  if (ranked.length <= cap) return { cards: ranked, overflowCount: 0 };
  return { cards: ranked.slice(0, show), overflowCount: ranked.length - show };
}

/**
 * The agents' fixed order in the full briefing.
 *
 * Money going the wrong way first (a supplier over-charging, a customer not
 * paying), then a level to watch. Agents nobody has listed here still render —
 * they are appended in the order they first appear in the feed, under whatever
 * `agentChip` calls them — because a new agent must never be the reason a
 * finding disappears off a screen whose whole promise is "every open item".
 */
export const FULL_BRIEFING_AGENT_ORDER: readonly string[] = [
  'price_watch',
  'debtors_watch',
  'stock_cover',
];

/** One agent's findings, in render order. */
export interface AgentGroup<T> {
  agent: string;
  findings: T[];
}

/**
 * Group the open feed by agent for the full briefing, ranking WITHIN each group
 * by the same rule the today view uses.
 *
 * Grouping rather than one long ranked list because the full briefing is read
 * differently: the today view answers "what should I do first?", which is a
 * single ordering; this one answers "what has Vyso got on me?", which is a
 * question about coverage — and twenty-three cards in a flat list is exactly the
 * wall the cap exists to prevent. Under a heading each, the same twenty-three
 * become four short lists you can skim.
 */
export function groupByAgent<T extends RankableFinding & { agent: string }>(
  open: readonly T[],
): AgentGroup<T>[] {
  const byAgent = new Map<string, T[]>();
  // Seed nothing: an agent with no open findings must not render an empty
  // heading, so the map only ever learns about agents that actually wrote.
  for (const f of open) {
    const bucket = byAgent.get(f.agent);
    if (bucket) bucket.push(f);
    else byAgent.set(f.agent, [f]);
  }

  const known = FULL_BRIEFING_AGENT_ORDER.filter((a) => byAgent.has(a));
  // Insertion order of a Map is first-appearance order in the feed, which is
  // already impact-ordered from the query — a decent default for an agent this
  // list has never heard of.
  const rest = [...byAgent.keys()].filter((a) => !FULL_BRIEFING_AGENT_ORDER.includes(a));

  return [...known, ...rest].map((agent) => ({
    agent,
    findings: rankFindings(byAgent.get(agent) ?? []),
  }));
}
