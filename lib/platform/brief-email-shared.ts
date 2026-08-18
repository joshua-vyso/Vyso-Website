/**
 * The brief email itself — subject and body, as pure string functions.
 *
 * WHY THIS IS A SEPARATE FILE FROM `brief-notify.ts`. The composer is the half
 * of this feature that can be WRONG WITHOUT FAILING: a rand figure formatted
 * into the wrong currency, a card whose deep link points at a preview
 * deployment, a "since your last brief" line that counts a Doc Watch receipt as
 * something needing attention. None of those throw, none of them show up in a
 * cron's JSON, and all of them are read by the owner as facts about their
 * business. `node --test` can load this file and pin every one of them because
 * it touches no database and no framework.
 *
 * IT IS NOT A SECOND EMAIL TEMPLATE. The Monday digest
 * (app/api/agents/digest/route.ts) and this brief are two different documents —
 * one is a weekly summary to an operator-configured address, the other is a
 * personal brief at a time the reader chose — but they are the same PLAIN,
 * MONOCHROME, image-free, tracker-free HTML, and `escapeHtml` and `formatRand`
 * now live here and are imported by the digest rather than duplicated. Two
 * copies of "how Vyso writes a rand figure in an email" is how one of them ends
 * up rounding differently.
 *
 * WHAT IT WILL NOT DO. It adds no arithmetic of its own. Every number printed
 * below arrives in `BriefEmailInput` already derived from rows that exist, and
 * any clause whose input is null is DROPPED rather than filled with a zero —
 * the same "say nothing rather than claim nothing" rule the Brief itself
 * follows.
 *
 * Relative, `.ts`-suffixed imports — `node --test` cannot resolve `@/`.
 */

import { rankFindings } from './brief-feed.ts';
import { SAST } from './sast.ts';
import { daysLabel, kindWord, type BriefSlotKind, type SinceLastBrief } from './brief-schedules-shared.ts';

/**
 * Where a recipient goes to act on what they have just read.
 *
 * Hardcoded exactly as in app/robots.ts, app/sitemap.ts and the digest route,
 * and deliberately NOT derived from VERCEL_URL: on a preview deployment that
 * would send the owner to a preview build's data, and this is the one link in
 * the product that arrives when nobody is looking at a screen to notice.
 */
export const SITE_URL = 'https://vyso.co.za';

/** How many findings the email lists before it stops and links through. Four,
 *  not the Brief's five, because the fifth slot on screen is the overflow CARD
 *  and in an email that is a line of text, not an item. */
export const BRIEF_EMAIL_CARDS = 4;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * "R 12 480" — whole rand. A brief is a prompt to look, not a ledger.
 *
 * Lifted verbatim from the digest route, INCLUDING its output: en-ZA groups
 * thousands with a space (a narrow no-break one, depending on the ICU build),
 * not a comma. The comment this arrived with said "R 12,480" and was simply
 * wrong about what the code did — the behaviour is right for a South African
 * reader and is left exactly as it was; only the comment is corrected, and
 * tests/brief-email.test.ts now pins it so the next reader does not have to
 * take either sentence on trust.
 */
export function formatRand(n: number): string {
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

/** "Tue 18 Aug" — the date in the subject line, in the owner's timezone. The
 *  commas en-ZA inserts are stripped: the subject already has one before the
 *  date and "your morning brief, Tue, 18 Aug" reads as a list. */
export function briefDate(now: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(now)
    .replace(/,/g, '');
}

/** "07:12" in SAST — the clock time the previous brief went out. */
export function briefClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SAST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** One finding as the email draws it. `evidenceLabel` is resolved by the
 *  caller (`brief-notify.ts`) because it needs the agent's own noun; null means
 *  the finding cites nothing, and the line is dropped rather than printed as
 *  "0 documents". */
export interface BriefEmailFinding {
  id: string;
  observation: string;
  recommended_action: string | null;
  rand_impact: number | null;
  status: string;
  created_at: string;
  evidenceLabel: string | null;
}

export interface BriefEmailInput {
  orgName: string;
  /** The reader's first name, or '' — the greeting drops the name rather than
   *  saying "Hi there", which is what a mailing list says. */
  firstName: string;
  kind: BriefSlotKind;
  /** The instant the run is sending at; every date and time below is read from
   *  it in SAST. */
  now: Date;
  /** Every OPEN, non-informational finding. Ranked and cut here, not by the
   *  caller — the cut and the order are one decision (see brief-feed.ts). */
  open: readonly BriefEmailFinding[];
  /** Documents Vyso read overnight/today — Doc Watch receipts. 0 drops the
   *  clause entirely. */
  readCount: number;
  since: SinceLastBrief | null;
  /** The days this slot runs, for the footer's one-line reminder of what the
   *  reader signed up for. */
  days: readonly number[];
  /** 'HH:MM' — the slot's own time, same footer. */
  localTime: string;
}

/** "Meridian Fresh — your morning brief, Tue 18 Aug". A 'custom' slot has no
 *  honest adjective, so it is simply "your brief". */
export function briefSubject(input: Pick<BriefEmailInput, 'orgName' | 'kind' | 'now'>): string {
  const word = kindWord(input.kind);
  const what = word ? `your ${word} brief` : 'your brief';
  return `${input.orgName} — ${what}, ${briefDate(input.now)}`;
}

/**
 * The greeting's one sentence.
 *
 * THE COUNT IS THE TRUE TOTAL, not the number of cards below it — exactly as on
 * the Brief itself, where the overflow card exists to stop the heading and the
 * list disagreeing. Here the "and N others" line does that job.
 *
 * Zero open findings is a real, honest answer and gets its own sentence rather
 * than "0 things need your attention", which reads like a bug.
 */
export function briefGreeting(firstName: string, openCount: number, kind: BriefSlotKind): string {
  const who = firstName ? `${firstName}, ` : '';
  if (openCount === 0) {
    const when = kind === 'evening' ? 'this evening' : 'this morning';
    return `${who}nothing needs your attention ${when}.`;
  }
  const noun = openCount === 1 ? 'thing needs' : 'things need';
  return `${who}${openCount} ${noun} your attention.`;
}

/**
 * "Since your brief at 07:12: 2 new findings, 9 documents read, 3 of the 4
 * items in it are now closed."
 *
 * Returns '' when there is nothing provable to say — a first-ever brief (no
 * previous delivery at all) or a previous one that nothing has happened since.
 * An empty block is omitted by the renderer rather than printed as a heading
 * over nothing.
 *
 * The closed clause NEVER claims a time. `agent_findings` records no moment of
 * status change, so "3 of the 4 items in it are now closed" is the strongest
 * true statement available; "3 resolved today" would not be one.
 */
export function sinceLine(since: SinceLastBrief | null): string {
  if (!since) return '';
  const parts: string[] = [];
  if (since.raised > 0) parts.push(`${since.raised} new finding${since.raised === 1 ? '' : 's'}`);
  if (since.read > 0) parts.push(`${since.read} document${since.read === 1 ? '' : 's'} read`);
  if (since.listed > 0 && since.closed > 0) {
    parts.push(`${since.closed} of the ${since.listed} items in it now closed`);
  }
  if (parts.length === 0) return '';
  const clock = briefClock(since.since);
  const anchor = clock ? `Since your brief at ${clock}` : 'Since your last brief';
  return `${anchor}: ${parts.join(', ')}.`;
}

/**
 * The footer's plain-English reminder of the schedule that sent this.
 *
 * Empty when there is no schedule behind the email — which is exactly the case
 * for "Send me a test now", where quoting a time the user has not saved yet
 * would be the email telling them about a setting that does not exist. The
 * "Manage brief notifications" link is rendered either way, so a test send
 * still says where it came from.
 */
export function scheduleLine(localTime: string, days: readonly number[]): string {
  if (!localTime || days.length === 0) return '';
  return `You asked for this brief at ${localTime}, ${daysLabel(days)}.`;
}

/**
 * The whole email.
 *
 * Inline styles only, no images, no tracking pixel, no web fonts: it has to
 * survive Gmail, Outlook and a phone, and its entire job is to get the reader
 * either to a decision or to /app.
 *
 * SENT EVEN WHEN THERE IS NOTHING TO REPORT — and this is the one place this
 * email deliberately behaves differently from the Monday digest, which sends
 * nothing rather than train its reader to archive it unread. The difference is
 * consent: nobody chose the digest, whereas this arrives at a time this person
 * picked, and an empty morning is information they asked for. Silence would be
 * indistinguishable from a cron that has stopped, which is the failure this
 * feature can least afford.
 */
export function renderBriefEmail(input: BriefEmailInput): string {
  const ranked = rankFindings([...input.open]);
  const cards = ranked.slice(0, BRIEF_EMAIL_CARDS);
  const others = ranked.length - cards.length;

  const items = cards
    .map((f, i) => {
      const impact = f.rand_impact == null ? null : Number(f.rand_impact);
      return `
        <div style="margin: 0 0 16px; padding: 16px; border: 1px solid #E3E8EF; border-radius: 8px;">
          <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.5; color: #111;">
            ${i + 1}. ${escapeHtml(f.observation)}
          </p>
          ${
            impact != null && Number.isFinite(impact)
              ? `<p style="margin: 0 0 8px; font-size: 14px; color: #0C447C;"><strong>Worth:</strong> ${formatRand(impact)}</p>`
              : ''
          }
          ${
            f.recommended_action
              ? `<p style="margin: 0 0 8px; font-size: 14px; color: #374151;"><strong>Suggested next step:</strong> ${escapeHtml(f.recommended_action)}</p>`
              : ''
          }
          ${
            f.evidenceLabel
              ? `<p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Based on ${escapeHtml(f.evidenceLabel)}.</p>`
              : ''
          }
          <p style="margin: 0; font-size: 14px;">
            <a href="${SITE_URL}/app/finding/${encodeURIComponent(f.id)}" style="color: #1F5FA8;">Open this finding</a>
          </p>
        </div>`;
    })
    .join('');

  const since = sinceLine(input.since);

  return `
    <div style="font-family: sans-serif; max-width: 640px; color: #111;">
      <p style="margin: 0 0 4px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280;">
        ${escapeHtml(briefDate(input.now))}
      </p>
      <h2 style="margin: 0 0 4px;">${escapeHtml(input.orgName)}</h2>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5;">
        ${escapeHtml(briefGreeting(input.firstName, ranked.length, input.kind))}
      </p>
      ${items}
      ${
        others > 0
          ? `<p style="margin: 0 0 20px; font-size: 14px;">
               <a href="${SITE_URL}/app?view=all" style="color: #1F5FA8;">${others} other item${
                 others === 1 ? '' : 's'
               } — read the full briefing</a>
             </p>`
          : ''
      }
      ${
        // Only what rows prove: the receipts band exists on the Brief, so the
        // count is real; 0 drops the sentence rather than saying "read 0".
        input.readCount > 0
          ? `<p style="margin: 0 0 20px; font-size: 14px; color: #374151;">
               Vyso read ${input.readCount} document${input.readCount === 1 ? '' : 's'} for you today.
             </p>`
          : ''
      }
      ${
        since
          ? `<div style="margin: 0 0 20px; padding: 14px 16px; background: #F5F7FA; border-radius: 8px;">
               <p style="margin: 0; font-size: 14px; color: #374151;">${escapeHtml(since)}</p>
             </div>`
          : ''
      }
      <p style="margin: 24px 0 0;">
        <a href="${SITE_URL}/app" style="background: #1F5FA8; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 15px;">
          Open the Brief
        </a>
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px;">
        Vyso's agents observe and recommend — nothing has been actioned on your behalf.
      </p>
      <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">
        ${(() => {
          const line = scheduleLine(input.localTime, input.days);
          return line ? `${escapeHtml(line)} ` : '';
        })()}<a href="${SITE_URL}/app/settings#brief-notifications" style="color: #1F5FA8;">Manage brief notifications</a>
      </p>
    </div>`;
}
