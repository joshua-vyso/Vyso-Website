/**
 * Finch chats — the decisions, with no database attached.
 *
 * Everything in this file is pure: it takes rows (or strings) and returns
 * values. That is the whole reason it is a separate file from
 * `finch-chats.ts`, which opens the Supabase server client and therefore
 * transitively imports `next/headers` — a module the `node --test` runner
 * cannot load. The same split exists elsewhere in this codebase for the same
 * reason (`serviceden-email.ts` decides, `serviceden-email-data.ts` reads).
 *
 * `finch-chats.ts` re-exports all of this, so callers have one import site and
 * only the tests reach in here directly.
 */

/** One chat as any list surface draws it. `title` is already resolved — a
 *  caller never has to remember the fallback, so it cannot forget it. */
export interface ChatSummary {
  id: string;
  /** Never null: `CHAT_TITLE_FALLBACK` stands in until the agent names it. */
  title: string;
  module: string | null;
  finding_id: string | null;
  updated_at: string;
}

/** The columns `splitChats` needs. A superset (the full row) is fine. */
export interface ChatSummaryRow {
  id: string;
  title: string | null;
  module: string | null;
  finding_id: string | null;
  updated_at: string;
}

/**
 * How long a chat stays in the rail's "recent" list before it drops to History.
 *
 * Read-time rule, deliberately (see supabase/finch-chats.sql note 3): no cron,
 * no status column, and moving the window is editing this constant.
 */
export const RECENT_WINDOW_DAYS = 14;

const RECENT_WINDOW_MS = RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** What an untitled chat is called. A chat is untitled from the moment it is
 *  created until its first complete assistant reply is summarised, which is a
 *  visible second or two — so this string is on screen often enough to matter. */
export const CHAT_TITLE_FALLBACK = 'New chat';

/** The stored title, or the fallback. Whitespace-only counts as untitled: a
 *  title generated from a one-word question can come back as `" "`, and a
 *  blank line in the rail reads as a broken list rather than a new chat. */
export function chatTitle(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  return t || CHAT_TITLE_FALLBACK;
}

/**
 * Split a user's chats into the rail list and the History list.
 *
 * Recent iff `updated_at` is within the last `RECENT_WINDOW_DAYS`. Both lists
 * come back newest-first regardless of the order they arrived in, so the caller
 * cannot depend on a query's `order by` that a later refactor might drop.
 *
 * A row whose `updated_at` will not parse is treated as RECENT, not archived.
 * The failure mode of guessing wrong in that direction is a stale chat one
 * section too high; guessing the other way hides a conversation the user had,
 * possibly minutes ago, in a collapsed History section they have no reason to
 * open. Unparseable rows sort last within `recent` for the same reason — they
 * are shown, not promoted.
 *
 * `now` is a parameter rather than a `Date.now()` call so the boundary is
 * testable and so a server render and its client hydration can agree on it.
 */
export function splitChats(
  rows: readonly ChatSummaryRow[],
  now: Date | number = Date.now(),
): { recent: ChatSummary[]; archived: ChatSummary[] } {
  const cutoff = (now instanceof Date ? now.getTime() : now) - RECENT_WINDOW_MS;

  const withTime = rows.map((row) => {
    const ms = Date.parse(row.updated_at);
    return { row, ms: Number.isFinite(ms) ? ms : null };
  });

  // Newest first; unparseable timestamps sink to the bottom of their list.
  withTime.sort((a, b) => (b.ms ?? -Infinity) - (a.ms ?? -Infinity));

  const recent: ChatSummary[] = [];
  const archived: ChatSummary[] = [];
  for (const { row, ms } of withTime) {
    (ms == null || ms >= cutoff ? recent : archived).push({
      id: row.id,
      title: chatTitle(row.title),
      module: row.module,
      finding_id: row.finding_id,
      updated_at: row.updated_at,
    });
  }
  return { recent, archived };
}

/**
 * How long ago a chat was last spoken to, for the rail — "4m", "3h", "2d",
 * then a plain date.
 *
 * SHORT ON PURPOSE. The rail is 216px wide and the title has to fit beside
 * this; "Found this morning" (the Brief's voice, `brief-display.ts`) would eat
 * the row. Different surface, different length — the same instant, said
 * briefly.
 *
 * COMPUTED ON THE SERVER, PASSED DOWN AS A STRING. `now` is a parameter for
 * the same reason `splitChats` takes one: a client component recomputing "4m"
 * at hydration time can disagree with the HTML it is hydrating, and a rail row
 * that flickers reads as a bug. The layout resolves these once per render and
 * hands `RailChats` finished text.
 *
 * An unparseable timestamp yields '' — the row then shows its title and no
 * time, which is better than "NaNm" or a made-up date.
 */
export function chatTimeLabel(updatedAt: string, now: Date | number = Date.now()): string {
  const then = Date.parse(updatedAt);
  if (!Number.isFinite(then)) return '';

  const nowMs = now instanceof Date ? now.getTime() : now;
  // A clock skew that puts the row slightly in the future is "now", not "-1m".
  const elapsed = Math.max(0, nowMs - then);

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  // Past a week, a duration stops meaning anything — give the date. SAST,
  // because every figure in this platform is quoted in the owner's clock.
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
  }).format(new Date(then));
}

/**
 * The Brief's findings prelude, removed from a message before it is stored.
 *
 * `components/platform/brief/brief-chat.ts` prefixes the open findings to the
 * FIRST user turn, because `/api/ai/agent` has no context field to put them in
 * (that file's header explains the choice). The model should see them; the
 * transcript must not — a reload would otherwise redraw the owner's first
 * question with five kilobytes of machine-written findings glued to the front
 * of it.
 *
 * The split is on `briefChatContext`'s own closing marker, which is the last
 * thing it emits before the user's words. Kept as a literal here rather than
 * imported so this module stays free of React/`@/…` component imports; if the
 * marker in brief-chat.ts ever changes, the only cost is that a prelude gets
 * stored verbatim once, which is why the fallback below is "return the text
 * unchanged" rather than anything cleverer.
 */
const BRIEF_PRELUDE_END = '[End of findings. The question below is from the user.]';

export function stripBriefPrelude(text: string): string {
  const at = text.lastIndexOf(BRIEF_PRELUDE_END);
  if (at === -1) return text.trim();
  const tail = text.slice(at + BRIEF_PRELUDE_END.length).trim();
  // A prelude with nothing after it isn't a prelude — keep what we were given
  // rather than storing an empty user turn.
  return tail || text.trim();
}
