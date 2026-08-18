/**
 * Brief notification schedules — the decisions, with no database attached.
 *
 * Everything in this file is pure: it takes rows (or an unvalidated request
 * body) and returns values. That is the whole reason it is a separate file from
 * `brief-schedules.ts`, which opens the Supabase server client and therefore
 * transitively imports `next/headers` — a module the `node --test` runner
 * cannot load. Same split, same reason, as `finch-chats-shared.ts` beside it.
 *
 * WHAT IS ACTUALLY AT STAKE HERE. Three of these functions decide whether an
 * email is sent, and every one of their failure modes is silent. A `slotIsDue`
 * that is fifteen minutes out sends nothing and looks exactly like a working
 * cron; a `localDateFor` that reads UTC instead of SAST lets a late-evening
 * slot fire twice on the same night; a `normaliseSlots` that lets '25:00'
 * through writes a row no run will ever match. Nobody notices any of the three
 * until the morning someone asks why they stopped getting their brief. So they
 * live here, where tests/brief-schedules.test.ts can pin them, and
 * `brief-notify.ts` is left with the I/O.
 *
 * Relative, `.ts`-suffixed imports throughout — the `@/` alias only exists
 * inside Next's bundler, and this module is loaded directly by `node --test`.
 * That exact mistake was the 2026-08-14 Price Watch model outage.
 */

import { sastDay, sastMinutesOfDay, sastWeekday } from './sast.ts';
import { isInformationalFinding } from './agents/finding-kinds.ts';

// ---------------------------------------------------------------------------
// The slot
// ---------------------------------------------------------------------------

/** What the email is FOR, in the user's words. Display only — it picks the word
 *  in the subject line and the label on the settings card, and is deliberately
 *  never derived from the clock (see supabase/brief-schedules.sql). */
export type BriefSlotKind = 'morning' | 'evening' | 'custom';

export const BRIEF_SLOT_KINDS: readonly BriefSlotKind[] = ['morning', 'evening', 'custom'];

/**
 * One row of `brief_schedules`, as everything above the database handles it.
 *
 * `local_time` is 'HH:MM' — the `time` column comes back from PostgREST as
 * 'HH:MM:SS', and it is truncated ONCE, on the way out of the data module, so
 * no caller has to remember which of the two shapes it is holding.
 *
 * `id` is optional because the settings card holds slots the user has typed but
 * not yet saved. A slot with an id is one that already exists and whose
 * DELIVERY HISTORY must survive the save (see `brief-schedules.ts`); a slot
 * without one is new.
 */
export interface BriefSlot {
  id?: string;
  kind: BriefSlotKind;
  /** 'HH:MM', 24-hour, in `BRIEF_TIMEZONE`. */
  local_time: string;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. Sorted and de-duplicated. */
  days: number[];
  enabled: boolean;
  /** When the row was written. Only the cron reads it — see `slotIsDue`. */
  created_at?: string;
}

/**
 * The only timezone v1 writes.
 *
 * The column exists so that supporting a second one later is a UI change rather
 * than a migration, but every code path here assumes SAST, and the settings card
 * says so in words rather than pretending to offer a choice it does not have.
 * Half a timezone feature — a picker that the cron ignores — would be worse than
 * none, because the user would believe it.
 */
export const BRIEF_TIMEZONE = 'Africa/Johannesburg';

/**
 * The most slots one person may have.
 *
 * Four, because the point of this feature is to REPLACE opening the app with
 * two well-timed emails, and a person receiving five briefs a day has been
 * given a notification problem instead of solved one. Enforced here rather than
 * in Postgres (supabase/brief-schedules.sql explains why) — which means this
 * constant is the only thing enforcing it, so the write path must call
 * `normaliseSlots` and nothing else may insert.
 */
export const MAX_SLOTS = 4;

/**
 * How far back a run looks for slots it should already have sent.
 *
 * The cron fires every 15 minutes, so a 15-minute window would be the exact
 * answer — and it is the wrong one, because Vercel's cron is best-effort and a
 * tick that lands 20 minutes late would drop that slot's email for the day with
 * no trace. So a run looks back a full hour instead: a 07:00 slot gets up to
 * four chances (07:00, 07:15, 07:30, 07:45) to be delivered, and the delivery
 * row's `unique (schedule_id, local_date)` is what guarantees only the first of
 * them actually sends. Widening the window can therefore only ever make the
 * feature more reliable; it cannot make it send twice.
 *
 * It deliberately does NOT wrap past SAST midnight. A 23:50 slot that was still
 * unsent at 00:05 has missed its day, and the honest thing is to skip it: the
 * whole content of that email is "what happened today", and sending it after
 * the date line has already rolled over would print tomorrow's date over
 * yesterday's news.
 */
export const DUE_LOOKBACK_MINUTES = 60;

/** Statuses that mean a finding is no longer open — mirrors HISTORY_STATUSES in
 *  lib/platform/agent-findings.ts, which this module cannot import (it reaches
 *  `next/headers`). */
const CLOSED_STATUSES: readonly string[] = ['resolved', 'dismissed'];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * The two slots the settings card OFFERS on first visit — Josh's own words on
 * 2026-08-18: "one to view overnight changes in the morning, and one after work
 * to view how the day went".
 *
 * They are returned unsaved and carry no id. Nothing writes them on the user's
 * behalf: a product that silently starts emailing you because you opened a
 * settings page has made a decision that was yours to make. The card shows them
 * filled in and the user presses Save.
 *
 * Mon–Sat for the morning one and Mon–Fri for the evening one, because the
 * business receives paper on a Saturday and nobody wants a report on how
 * Saturday went at half past five.
 */
export function defaultSlots(): BriefSlot[] {
  return [
    { kind: 'morning', local_time: '07:00', days: [1, 2, 3, 4, 5, 6], enabled: true },
    { kind: 'evening', local_time: '17:30', days: [1, 2, 3, 4, 5], enabled: true },
  ];
}

/** The settings card's name for a slot. */
export function kindLabel(kind: BriefSlotKind): string {
  if (kind === 'morning') return 'Overnight brief';
  if (kind === 'evening') return 'End-of-day brief';
  return 'Custom brief';
}

/** The word the subject line uses: "your morning brief". 'custom' contributes
 *  nothing rather than an invented adjective, so its subject reads "your
 *  brief" — see `briefSubject` in brief-email-shared.ts. */
export function kindWord(kind: BriefSlotKind): string {
  return kind === 'custom' ? '' : kind;
}

// ---------------------------------------------------------------------------
// Parsing and validation
// ---------------------------------------------------------------------------

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight; null when it is not a time.
 *  Seconds are accepted because that is how PostgREST returns a `time` column,
 *  and ignored because a brief scheduled to the second is a brief scheduled by
 *  accident. */
export function parseLocalTime(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes since midnight → 'HH:MM'. The inverse of `parseLocalTime`, used to
 *  normalise '07:00:00' from the database down to what an `<input type="time">`
 *  round-trips. */
export function formatLocalTime(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const m = String(wrapped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** ISO weekday initials for the card's toggles, Monday first. */
export const WEEKDAY_LABELS: readonly { day: number; label: string; full: string }[] = [
  { day: 1, label: 'M', full: 'Monday' },
  { day: 2, label: 'T', full: 'Tuesday' },
  { day: 3, label: 'W', full: 'Wednesday' },
  { day: 4, label: 'T', full: 'Thursday' },
  { day: 5, label: 'F', full: 'Friday' },
  { day: 6, label: 'S', full: 'Saturday' },
  { day: 7, label: 'S', full: 'Sunday' },
];

/** "Mon–Fri" / "Every day" / "Mon, Wed, Fri" — how the card and the email
 *  footer say which days a slot runs. Contiguous runs collapse to a dash
 *  because "Mon, Tue, Wed, Thu, Fri" is five words for one idea. */
export function daysLabel(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return 'Never';
  if (sorted.length === 7) return 'Every day';
  const short = (d: number) => WEEKDAY_LABELS[d - 1].full.slice(0, 3);
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${short(sorted[0])}–${short(sorted[sorted.length - 1])}`;
  return sorted.map(short).join(', ');
}

/** What `normaliseSlots` answers with: the slots to write, or the one sentence
 *  the settings card should show instead. Never both. */
export interface SlotValidation {
  slots: BriefSlot[];
  error: string | null;
}

/**
 * Turn an unvalidated PUT body into rows that are safe to write.
 *
 * REJECTS RATHER THAN REPAIRS, for everything the user can see. A day list the
 * server silently "fixed" to Mon–Fri is a settings screen that lies about what
 * it saved, and the user only finds out when the email does not arrive on
 * Saturday. The two things it DOES normalise are invisible to the user and
 * cannot mean anything else: duplicate weekdays collapse, and the day list is
 * sorted, so `[5,1,1]` and `[1,5]` write the same row.
 *
 * `id` is carried through when present so the write path can UPDATE an existing
 * slot instead of replacing it. It is not trusted here — an id belonging to
 * somebody else is rejected by the query's own `.eq('user_id')`, which is where
 * that check belongs.
 */
export function normaliseSlots(input: unknown): SlotValidation {
  if (!Array.isArray(input)) {
    return { slots: [], error: 'Expected a list of schedules.' };
  }
  if (input.length > MAX_SLOTS) {
    return { slots: [], error: `You can have at most ${MAX_SLOTS} brief times.` };
  }

  const slots: BriefSlot[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) {
      return { slots: [], error: 'Each schedule must be an object.' };
    }
    const row = raw as Record<string, unknown>;

    const kind = row.kind;
    if (typeof kind !== 'string' || !(BRIEF_SLOT_KINDS as readonly string[]).includes(kind)) {
      return { slots: [], error: 'Each schedule needs a kind of morning, evening or custom.' };
    }

    const time = row.local_time;
    if (typeof time !== 'string' || parseLocalTime(time) === null) {
      return { slots: [], error: 'Each schedule needs a time between 00:00 and 23:59.' };
    }

    const days = row.days;
    if (!Array.isArray(days) || days.length === 0) {
      return { slots: [], error: 'Pick at least one day for every brief time.' };
    }
    if (!days.every((d) => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7)) {
      return { slots: [], error: 'Days must be whole numbers from 1 (Monday) to 7 (Sunday).' };
    }

    const enabled = row.enabled;
    if (typeof enabled !== 'boolean') {
      return { slots: [], error: 'Each schedule must say whether it is on or off.' };
    }

    slots.push({
      id: typeof row.id === 'string' && row.id ? row.id : undefined,
      kind: kind as BriefSlotKind,
      local_time: formatLocalTime(parseLocalTime(time) as number),
      days: [...new Set(days as number[])].sort((a, b) => a - b),
      enabled,
    });
  }

  return { slots, error: null };
}

// ---------------------------------------------------------------------------
// Is it time?
// ---------------------------------------------------------------------------

/** The SAST calendar day a run is sending FOR, as 'YYYY-MM-DD'. This is the
 *  `local_date` half of the delivery row's unique key — see the DDL for why it
 *  must not be the UTC date. */
export function localDateFor(nowUtc: Date): string {
  return sastDay(nowUtc);
}

/**
 * Should this slot's email go out on this run?
 *
 * Four gates, in the order that costs least to check:
 *   1. the slot is on at all;
 *   2. today (in SAST) is one of its days;
 *   3. its wall-clock time has passed, and by no more than `lookbackMinutes`;
 *   4. it was not saved AFTER that time today.
 *
 * GATE 4 IS THE ONE THAT IS NOT OBVIOUS. Without it, a user who opens settings
 * at 07:20 and saves a 07:00 slot receives their "overnight brief" forty
 * seconds later, at twenty past seven, having asked for nothing of the sort —
 * the lookback window cannot tell "we missed this" from "this did not exist
 * yet". Comparing against the row's own `created_at` distinguishes them
 * exactly, and it costs a column the write path already sets. A slot with no
 * `created_at` (an unsaved one from the settings card) passes gate 4, because
 * the only caller that hands those over is the "send me a test now" path, which
 * does not consult this function at all.
 *
 * Note what this function does NOT know: whether the email was already sent.
 * That is `brief_deliveries`' job, and keeping the two apart is what lets the
 * window be generous.
 */
export function slotIsDue(
  slot: BriefSlot,
  nowUtc: Date,
  lookbackMinutes: number = DUE_LOOKBACK_MINUTES,
): boolean {
  if (!slot.enabled) return false;

  const at = parseLocalTime(slot.local_time);
  if (at === null) return false;

  if (!slot.days.includes(sastWeekday(nowUtc))) return false;

  const elapsed = sastMinutesOfDay(nowUtc) - at;
  if (elapsed < 0 || elapsed > lookbackMinutes) return false;

  if (slot.created_at) {
    const created = new Date(slot.created_at);
    if (Number.isNaN(created.getTime())) return true; // unreadable → do not block the send
    if (sastDay(created) === sastDay(nowUtc) && sastMinutesOfDay(created) > at) return false;
  }

  return true;
}

/** One email a run is about to send, and every slot it satisfies. */
export interface DueGroup {
  /** 'HH:MM' — the wall-clock time these slots share. */
  localTime: string;
  /** The word the subject uses. Taken from the group's first slot. */
  kind: BriefSlotKind;
  /** Every slot this one email discharges. All of them get a delivery row. */
  scheduleIds: string[];
}

/**
 * Collapse slots that fall due at the same minute into ONE email.
 *
 * A user who keeps a 'morning' slot at 07:00 and adds a 'custom' one at 07:00
 * has made a mistake, not a request for two identical emails thirty
 * milliseconds apart. Both slots are still marked delivered, so neither
 * re-fires on the next tick — collapsing the SEND without collapsing the
 * BOOKKEEPING is what keeps that idempotent.
 *
 * The group takes its kind from the first slot in id order rather than from
 * some precedence between 'morning' and 'custom': any rule there would be
 * arbitrary, and the honest thing when a user has told us two things about one
 * email is to pick one deterministically and leave the mistake visible on the
 * settings card, where they can fix it.
 */
export function groupDueSlots(slots: readonly BriefSlot[]): DueGroup[] {
  const byTime = new Map<string, BriefSlot[]>();
  for (const slot of slots) {
    const bucket = byTime.get(slot.local_time);
    if (bucket) bucket.push(slot);
    else byTime.set(slot.local_time, [slot]);
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([localTime, members]) => {
      const ordered = [...members].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
      return {
        localTime,
        kind: ordered[0].kind,
        scheduleIds: ordered.map((s) => s.id).filter((id): id is string => !!id),
      };
    });
}

// ---------------------------------------------------------------------------
// "Since your last brief"
// ---------------------------------------------------------------------------

/** The previous email this person was sent — the anchor everything below is
 *  measured from. */
export interface PreviousDelivery {
  sent_at: string;
  /** The findings that email listed (`brief_deliveries.finding_ids`). */
  finding_ids: string[];
}

/** The minimum a finding row has to carry for the diff. Structural rather than
 *  `AgentFinding`, so this module imports no I/O. */
export interface SinceRow {
  agent: string;
  rand_impact: number | null;
  recommended_action: string | null;
  created_at: string;
}

/**
 * What has changed since this person's last brief. Null when there has not been
 * one — a first brief has nothing to compare against, and "0 new since your
 * last brief" under a first email would be a claim about a history that does
 * not exist.
 */
export interface SinceLastBrief {
  /** When the previous email went out, ISO-8601. */
  since: string;
  /** Findings raised since then (receipts excluded). */
  raised: number;
  /** Documents Vyso read since then — Doc Watch's receipts. */
  read: number;
  /** How many of the items in the LAST email are now closed… */
  closed: number;
  /** …out of how many were in it. `closed`/`listed` is the whole claim; the
   *  copy never says WHEN they closed, because no row records that. */
  listed: number;
}

/**
 * Diff the world against the last email.
 *
 * WHAT THIS CANNOT SAY, AND WHY. The obvious "3 findings resolved today" is not
 * derivable: `agent_findings` has no `updated_at` and no `resolved_at`
 * (supabase/agents-price-watch.sql), so a row that is resolved now carries no
 * record of the moment it stopped being open. Rather than approximate it — the
 * Brief's one rule is that every sentence comes from a row that proves it —
 * this reports the one thing that IS provable: the previous email named these
 * four findings, and this many of them are closed today. That is why
 * `brief_deliveries.finding_ids` exists.
 *
 * `raised` and `read` come from `created_at`, which is a real column, and are
 * therefore exact.
 */
export function sinceLastBrief(
  previous: PreviousDelivery | null,
  createdSince: readonly SinceRow[],
  previousStatuses: readonly { id: string; status: string }[],
): SinceLastBrief | null {
  if (!previous) return null;

  let raised = 0;
  let read = 0;
  for (const row of createdSince) {
    // The same belt-and-braces receipt test the Brief and the digest use, so a
    // Doc Watch card can never be counted as something needing attention.
    if (isInformationalFinding(row)) read += 1;
    else raised += 1;
  }

  const closed = previousStatuses.filter((s) => CLOSED_STATUSES.includes(s.status)).length;

  return { since: previous.sent_at, raised, read, closed, listed: previous.finding_ids.length };
}
