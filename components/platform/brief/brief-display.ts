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
 * sanctioned by .ai/plan_chat_first_shell.md §4.3). Note what that does NOT
 * license: the gradient left the Brief attached to the chat, and only to the
 * chat. On a module screen the ONLY thing wearing it is the dock. Anywhere
 * else it is still a bug.
 */

/** Orange → blue, angled for text runs (greeting figure). */
export const AI_GRADIENT_TEXT = 'linear-gradient(100deg,#BE5D23,#3E8FE0)';
/** Vertical, for the new-finding accent bar down a card's left edge. */
export const AI_GRADIENT_BAR = 'linear-gradient(180deg,#BE5D23,#3E8FE0)';
/** The chat pill's border and the rail's live dot. */
export const AI_GRADIENT_CHROME = 'linear-gradient(115deg,#BE5D23,#D9730D 35%,#3E8FE0)';

/** Every platform figure is quoted in SAST — Vyso's customers are all en-ZA. */
export const SAST = 'Africa/Johannesburg';

/**
 * Agent chip styling, keyed by the `agent_findings.agent` slug. The column is
 * free text (every future agent shares the table), so an unknown slug degrades
 * to a title-cased label on the neutral tone pair rather than rendering blank.
 * Price Watch takes the warning pair — it reports money leaking, not an error.
 */
const AGENT_CHIPS: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  price_watch: { label: 'Price Watch', bg: 'var(--tone-warning-bg)', fg: 'var(--tone-warning-fg)', dot: '#BE5D23' },
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

/** The SAST calendar day of an instant, as 'YYYY-MM-DD' (sorts and compares as
 *  a string, which is all the day-difference maths below needs). */
function sastDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAST }).format(d);
}

/** The SAST hour (0–23) of an instant. */
function sastHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: SAST, hour: '2-digit', hour12: false }).format(d),
  );
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
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-ZA', { timeZone: SAST, day: 'numeric', month: 'short' }).format(created);
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
