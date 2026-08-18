/**
 * The owner's clock.
 *
 * Every figure and every time-of-day word in this product is quoted in SAST —
 * Vyso's customers are all en-ZA — and the server is not. These three helpers
 * are the whole of that conversion, and they live here rather than inside any
 * one surface because two now need them: The Brief's display layer
 * (components/platform/brief/brief-display.ts, which has said "Found this
 * morning" since the Brief shipped) and Doc Watch's detector
 * (lib/platform/doc-watch/detect.ts, which says "read this morning" about the
 * very same instant). Two copies of "what hour is it for the owner" is exactly
 * how a card ends up labelled "this morning" above a sentence that says
 * "overnight".
 *
 * Framework-free and dependency-free on purpose: a server page, a client
 * component and a bare `node --test` unit test all import it.
 *
 * `Intl` with an explicit `timeZone` is the whole mechanism. No date library, no
 * offset arithmetic — South Africa has no daylight saving today, but hardcoding
 * +02:00 would be a latent bug rather than a simplification.
 */

/** Vyso's customers are all en-ZA. */
export const SAST = 'Africa/Johannesburg';

/** The SAST calendar day of an instant, as 'YYYY-MM-DD' (sorts and compares as
 *  a string, which is all day-difference arithmetic needs). */
export function sastDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAST }).format(d);
}

/** The SAST hour (0–23) of an instant. */
export function sastHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: SAST, hour: '2-digit', hour12: false }).format(d),
  );
}

/**
 * Minutes since SAST midnight (0–1439) — the owner's wall clock as one number.
 *
 * Added for the brief schedules, where the whole question is "has 07:00 passed
 * for this person yet?" and comparing an hour alone would fire a 17:30 slot at
 * 17:00. `sastHour` is left exactly as it was; this is the finer-grained
 * reading of the same clock, not a replacement.
 *
 * `hourCycle: 'h23'` and `formatToParts` rather than `hour12: false` and a
 * string parse: `hour12: false` has historically rendered midnight as "24" in
 * some ICU builds, which would put 00:10 twenty-four hours away from 00:00 and
 * silently stop every early-morning brief. The `% 24` is the belt-and-braces on
 * top of that.
 */
export function sastMinutesOfDay(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SAST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return (hour % 24) * 60 + minute;
}

/**
 * ISO weekday in SAST: 1 = Monday … 7 = Sunday.
 *
 * Derived from `sastDay` rather than from a `weekday` format, so there is one
 * definition of "which day is it for the owner" and a schedule can never
 * disagree with the date line printed at the top of the same email. Parsing the
 * 'YYYY-MM-DD' back as UTC midnight is safe precisely because it carries no
 * time: `getUTCDay` then reads the calendar day, not an instant.
 */
export function sastWeekday(d: Date): number {
  const utcDay = new Date(`${sastDay(d)}T00:00:00Z`).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/** Whole days between two SAST calendar days ('YYYY-MM-DD'), later minus
 *  earlier. Compared as CALENDAR days, so something written at 23:50 is
 *  "yesterday" at 00:10 the next morning rather than "20 minutes ago". */
export function sastDayDiff(earlier: string, later: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}
