/**
 * The Brief — pure display metadata and derivations. No framework imports, so
 * the server page and the client cards can share one copy.
 *
 * THE GRADIENT RULE. `#BE5D23 → #3E8FE0` (orange → blue) is the AI voice in
 * this product, not a decoration: the design system gives the platform ONE
 * accent (blue `#1F5FA8`) and reserves orange for marketing, so the two of them
 * together only ever mean "Vyso said this". It appears in exactly FIVE places —
 * on the Brief: the greeting's rand figure, the new-finding accent bar, the
 * chat pill's border and the ✦ marks; and, since the chat became persistent
 * chrome, that same pill border and ✦ on every other /app/* route, where the
 * dock renders its compact variant (GlobalChatDock — the fifth placement,
 * sanctioned by .ai/plan_chat_first_shell.md §4.3). A SIXTH joined them with
 * the finding detail page (design 1c): the same rand figure in its header, and
 * the hairline across the top of its "Recommended" block — that block IS Vyso
 * making a recommendation, which is exactly what the gradient means, and the
 * design draws it there. Note what that does NOT
 * license: the gradient left the Brief attached to the chat, and only to the
 * chat. On a module screen the ONLY thing wearing it is the dock. Anywhere
 * else it is still a bug.
 */

import { SAST, sastDay, sastDayDiff, sastHour } from '@/lib/platform/sast';

/** Orange → blue, angled for text runs (greeting figure). */
export const AI_GRADIENT_TEXT = 'linear-gradient(100deg,#BE5D23,#3E8FE0)';
/** Vertical, for the new-finding accent bar down a card's left edge. */
export const AI_GRADIENT_BAR = 'linear-gradient(180deg,#BE5D23,#3E8FE0)';
/** The chat pill's border and the rail's live dot. */
export const AI_GRADIENT_CHROME = 'linear-gradient(115deg,#BE5D23,#D9730D 35%,#3E8FE0)';
/** Horizontal, for the hairline over the finding detail's "Recommended" block. */
export const AI_GRADIENT_RULE = 'linear-gradient(90deg,#BE5D23,#3E8FE0)';

/** Every platform figure is quoted in SAST — Vyso's customers are all en-ZA.
 *  The conversion itself lives in lib/platform/sast.ts now, shared with Doc
 *  Watch's detector so a card's "Found this morning" label and the sentence
 *  inside it can never disagree about what hour it is for the owner. Re-exported
 *  here because this module was where the constant used to live. */
export { SAST };

/**
 * Agent chip styling, keyed by the `agent_findings.agent` slug. The column is
 * free text (every future agent shares the table), so an unknown slug degrades
 * to a title-cased label on the neutral tone pair rather than rendering blank.
 * Price Watch takes the warning pair — it reports money leaking, not an error.
 *
 * The tones say how hard a card pushes, and they are not interchangeable:
 * Price Watch and Debtors Watch both report money going the wrong way (warning);
 * Stock Cover reports a level, which is information the owner acts on at their
 * own pace (neutral); Doc Watch reports nothing wrong at all — it is a receipt
 * for paper Vyso read — so it takes the info pair and lives in its own band
 * below the findings (ReadOvernightBand), never among them.
 */
const AGENT_CHIPS: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  price_watch: { label: 'Price Watch', bg: 'var(--tone-warning-bg)', fg: 'var(--tone-warning-fg)', dot: '#BE5D23' },
  debtors_watch: { label: 'Debtors', bg: 'var(--tone-warning-bg)', fg: 'var(--tone-warning-fg)', dot: '#BE5D23' },
  stock_cover: { label: 'Stock', bg: 'var(--tone-neutral-bg)', fg: 'var(--tone-neutral-fg)', dot: '#8A8E86' },
  doc_watch: { label: 'Read', bg: 'var(--tone-info-bg)', fg: 'var(--tone-info-fg)', dot: '#3E8FE0' },
};

export interface AgentChip {
  label: string;
  bg: string;
  fg: string;
  dot: string;
}

export function agentChip(agent: string): AgentChip {
  const known = AGENT_CHIPS[agent];
  if (known) return known;
  const label = agent
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  return {
    label: label || 'Agent',
    bg: 'var(--tone-neutral-bg)',
    fg: 'var(--tone-neutral-fg)',
    dot: '#8A8E86',
  };
}

/** "Morning" | "Afternoon" | "Evening" for the greeting, in SAST — the owner's
 *  clock, not the server's. */
export function timeOfDayGreeting(now: Date): string {
  const h = sastHour(now);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/** Uppercase eyebrow: "WEDNESDAY 13 AUGUST" (SAST, en-ZA). */
export function briefDateLine(now: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
}

/**
 * When a finding was found, in the owner's words: "Found this morning",
 * "Yesterday", "3 days ago", then a plain date.
 *
 * Computed on the SERVER and passed down as a string — a client component
 * recomputing "this morning" at hydration time can disagree with the HTML it is
 * hydrating, and a flicker on the date of a money finding reads as a bug.
 */
export function foundLabel(createdAt: string, now: Date): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '';

  const today = sastDay(now);
  const day = sastDay(created);
  if (day === today) {
    const h = sastHour(created);
    if (h < 12) return 'Found this morning';
    if (h < 17) return 'Found this afternoon';
    return 'Found this evening';
  }

  // Day difference from the SAST calendar dates, so a finding written at 23:50
  // is "yesterday" at 00:10 the next morning rather than "13 hours ago".
  const days = sastDayDiff(day, today);
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-ZA', { timeZone: SAST, day: 'numeric', month: 'short' }).format(created);
}

/**
 * The exact moment a finding was written: "Found 06:14, Wed 13 Aug" (design
 * 1c).
 *
 * The card says "Found this morning" because a feed is read at a glance; the
 * DETAIL page says the clock time, because that page is where an owner works
 * out whether a finding predates the invoice they are holding. Both are SAST
 * and both are computed on the server for the reason `foundLabel` explains — a
 * client recomputing a time at hydration can disagree with the HTML it is
 * hydrating.
 *
 * Returns '' on an unparseable timestamp, so the header simply omits the line.
 */
export function foundAtLabel(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '';

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: SAST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(created);
  // en-ZA renders this as "Thu, 13 Aug"; the comma comes out because the line
  // already has one after the clock time and "06:14, Thu, 13 Aug" reads as a
  // list rather than a moment.
  const day = new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(created)
    .replace(/,/g, '');

  return `Found ${time}, ${day}`;
}

/** "13 Aug 2026" — a date the owner can match against a piece of paper. Takes
 *  an ISO date ('YYYY-MM-DD', an invoice date) or a full timestamp (a document's
 *  `created_at`); both are read in SAST. '' when it can't be parsed. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * "R9.42/kg" — a UNIT price, always to two decimals.
 *
 * Deliberately not `rand()`, which rounds to whole rands because it formats
 * annual impact figures. Rounding R9.42 to R9 would erase most of the move this
 * page exists to show.
 */
export function unitPrice(value: number, baseUnit: string | null): string {
  const amount = value.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return baseUnit ? `R${amount}/${baseUnit}` : `R${amount}`;
}

/**
 * How many of these instants fall on TODAY's SAST calendar day — i.e. since
 * midnight in the owner's timezone, not the server's.
 *
 * This is what makes design 1a's "✦ Overnight I read 12 new invoices…" line
 * data-driven instead of decorative: it counts Doc Watch receipts, so the
 * sentence can only ever state a number of documents that actually have cards
 * behind them. A count of 0 means the band drops the line rather than saying
 * "read 0 documents" — the same "say nothing rather than claim nothing" rule the
 * greeting follows.
 */
export function countSinceSastMidnight(createdAts: readonly string[], now: Date): number {
  const today = sastDay(now);
  let n = 0;
  for (const iso of createdAts) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    if (sastDay(d) === today) n += 1;
  }
  return n;
}

/** First name for the greeting; falls back to nothing rather than "there". */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Initials for the rail's user chip. Mirrors TopBar's `initials()`. */
export function initials(name: string | null | undefined): string {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
