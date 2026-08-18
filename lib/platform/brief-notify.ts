/**
 * The brief notifier — the I/O half of per-user brief emails.
 *
 * `/api/agents/brief-notify` calls `runBriefNotify` every 15 minutes; the
 * settings card's "Send me a test now" calls `sendTestBrief`. Everything either
 * of them DECIDES lives in `brief-schedules-shared.ts` (is a slot due, what
 * changed since the last one) or `brief-email-shared.ts` (what the email says),
 * both of which are pure and pinned by `node --test`. What is left here is
 * reads, a Resend call, and one insert.
 *
 * TWO CLIENTS, ONE SET OF QUERIES. `runBriefNotify` is handed the SERVICE-ROLE
 * client — a cron has no session, so RLS has nothing to key off — while
 * `sendTestBrief` is handed the signed-in caller's RLS-scoped one. Every query
 * below therefore filters `.eq('org_id', orgId)` by hand, per
 * `supabase-service.ts`'s contract, and the ones about a person also filter
 * `.eq('user_id')`. That is what makes the same functions safe under both.
 *
 * THE RECIPIENT'S ADDRESS IS NOT IN THIS DATABASE'S PUBLIC SCHEMA. `profiles`
 * carries `id, org_id, full_name, role, avatar_url, created_at` and no email
 * column (there is no checked-in DDL for it — see AUDIT_FINDINGS.md — but every
 * reader in the codebase agrees, and supabase/tns-users-roles.sql links
 * profiles to people BY LOOKING EMAIL UP IN `auth.users`). So the address comes
 * from `auth.admin.getUserById`, which needs the service role, and it is read
 * at SEND time rather than copied onto the schedule row: an address stored here
 * would be one more copy to go stale the day someone changes their login, and
 * a brief is not something to send to an address the user has stopped reading.
 * The settings card shows `session.email` instead — the same value, from the
 * session it already has, with no admin call from a page render.
 *
 * IT NEVER THROWS PAST THE ORG IT IS WORKING ON. One org's missing profile or
 * bounced send must not stop the other orgs on the tick, so failures are
 * collected into the summary the route returns and logged, exactly as the Phase
 * C agent runs do.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { canSeeBrief } from './access';
import { rankFindings } from './brief-feed';
import { isMissingRelation } from './db-errors';
import { sastDay } from './sast';
import {
  documentEvidenceLabel,
  evidenceKindOf,
  invoiceEvidenceLabel,
  isInformationalFinding,
  STOCK_EVIDENCE_LABEL,
} from './agents/finding-kinds';
import {
  groupDueSlots,
  localDateFor,
  sinceLastBrief,
  slotIsDue,
  type BriefSlot,
  type BriefSlotKind,
  type SinceLastBrief,
} from './brief-schedules-shared';
import {
  BRIEF_EMAIL_CARDS,
  briefSubject,
  renderBriefEmail,
  type BriefEmailFinding,
} from './brief-email-shared';

/** Statuses that still want the owner — mirrors OPEN_STATUSES in
 *  `agent-findings.ts`, which this module cannot import without dragging
 *  `next/headers` into a cron. */
const OPEN_STATUSES = ['new', 'in_progress'];

/**
 * How many findings to read before the email picks its four.
 *
 * 120 — the same FEED_LIMIT the Brief itself reads, deliberately, because the
 * greeting's count has to be the number the owner sees at the top of `/app`. A
 * tighter limit here would produce an email that says "8 things need your
 * attention" over a screen that says twenty-three.
 */
const FEED_LIMIT = 120;

/** How far back to reach for today's receipts before filtering them to the
 *  SAST calendar day. 36 hours covers every timezone offset the product will
 *  ever have without doing offset arithmetic by hand — the thing
 *  `lib/platform/sast.ts` exists to avoid. */
const RECEIPT_WINDOW_MS = 36 * 3_600_000;

/** A brief email is one page; findings raised since the last one are counted,
 *  not listed, so this only has to be larger than any believable day. */
const SINCE_LIMIT = 500;

const FROM = 'Vyso <noreply@vyso.co.za>';

/** One org's tick, as the route reports it. */
export interface BriefNotifySummary {
  orgId: string;
  /** Slots that were due on this tick, before dedupe. */
  due: number;
  /** Emails actually sent. */
  sent: number;
  /** Sends that were skipped because a delivery row already existed. */
  alreadySent: number;
  /** Slots skipped because the user may no longer see the Brief, or has no
   *  readable address. */
  skipped: number;
  errors: string[];
  /** True when the migration hasn't been pasted into this database yet. */
  tableMissing?: true;
}

/** The row `brief_schedules` returns to the cron. */
interface ScheduleRow {
  id: string;
  user_id: string;
  kind: string;
  local_time: string;
  days: number[] | null;
  enabled: boolean;
  created_at: string;
}

/** The finding columns both the cards and the counts need. */
interface FindingRow {
  id: string;
  agent: string;
  observation: string;
  recommended_action: string | null;
  rand_impact: number | string | null;
  evidence_refs: string[] | null;
  status: string;
  created_at: string;
}

/** Everything about the ORG that an email needs — read once per tick, not once
 *  per recipient, because two admins on the same org get the same feed. */
export interface BriefContext {
  orgName: string;
  /** Open, non-informational findings, ready for the composer to rank. */
  open: BriefEmailFinding[];
  /** Documents read today (SAST), from Doc Watch's receipts. */
  readCount: number;
}

const EMPTY_CONTEXT: BriefContext = { orgName: 'your business', open: [], readCount: 0 };

/**
 * "3 invoices" / "1 stock line" / "2 documents" — what a finding cites, in the
 * agent's own noun.
 *
 * Deliberately does NOT resolve the cited documents' TYPES, which is what the
 * Brief's own `resolveEvidence` does to say "2 statements" rather than "2
 * documents". That would be one extra read per finding on a path that runs
 * every fifteen minutes, to sharpen a noun by one word; `documentEvidenceLabel`
 * already produces the honest catch-all for an unknown set, and it is the same
 * function, so the email can never invent a noun the Brief would not use.
 *
 * Null when nothing is cited — the line is dropped rather than printed as
 * "Based on 0 source records", which says nothing.
 */
function evidenceLabelFor(row: FindingRow): string | null {
  const kind = evidenceKindOf(row.agent);
  if (kind === 'stock') return STOCK_EVIDENCE_LABEL;
  const count = row.evidence_refs?.length ?? 0;
  if (count === 0) return null;
  if (kind === 'invoices') return invoiceEvidenceLabel(count);
  return documentEvidenceLabel(count, []);
}

function toNumber(value: number | string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The org's name, its open findings and what Vyso read today.
 *
 * Two reads rather than one: the open feed is ordered by rand impact and capped,
 * and receipts carry no rand figure at all, so they would sort to the bottom of
 * that query and be the first thing a busy week truncated — the count of
 * documents read would then quietly drift downwards exactly when it was most
 * worth reporting.
 */
export async function loadBriefContext(
  supabase: SupabaseClient,
  orgId: string,
  now: Date,
): Promise<BriefContext> {
  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle<{ name: string | null }>();

  const { data: rows, error } = await supabase
    .from('agent_findings')
    .select('id, agent, observation, recommended_action, rand_impact, evidence_refs, status, created_at')
    .eq('org_id', orgId)
    .in('status', OPEN_STATUSES)
    .order('rand_impact', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)
    .returns<FindingRow[]>();

  if (error) {
    if (isMissingRelation(error)) return { ...EMPTY_CONTEXT, orgName: org?.name ?? EMPTY_CONTEXT.orgName };
    throw error;
  }

  const open: BriefEmailFinding[] = [];
  for (const row of rows ?? []) {
    const rand = toNumber(row.rand_impact);
    // The same belt-and-braces receipt test the Brief and the digest use: a Doc
    // Watch card is a receipt, not something needing attention, and must never
    // be counted in the greeting.
    if (isInformationalFinding({ agent: row.agent, rand_impact: rand, recommended_action: row.recommended_action })) {
      continue;
    }
    open.push({
      id: row.id,
      observation: row.observation,
      recommended_action: row.recommended_action,
      rand_impact: rand,
      status: row.status,
      created_at: row.created_at,
      evidenceLabel: evidenceLabelFor(row),
    });
  }

  const { data: receipts } = await supabase
    .from('agent_findings')
    .select('agent, rand_impact, recommended_action, created_at')
    .eq('org_id', orgId)
    .gte('created_at', new Date(now.getTime() - RECEIPT_WINDOW_MS).toISOString())
    .limit(SINCE_LIMIT)
    .returns<{ agent: string; rand_impact: number | string | null; recommended_action: string | null; created_at: string }[]>();

  const today = localDateFor(now);
  const readCount = (receipts ?? []).filter(
    (r) =>
      isInformationalFinding({
        agent: r.agent,
        rand_impact: toNumber(r.rand_impact),
        recommended_action: r.recommended_action,
      }) && sastDay(new Date(r.created_at)) === today,
  ).length;

  return { orgName: org?.name ?? EMPTY_CONTEXT.orgName, open, readCount };
}

/**
 * What changed since this person's previous brief — or null when there has not
 * been one.
 *
 * Two small reads on top of the previous delivery row, and both are exact:
 * findings raised since that instant (`created_at` is a real column) and the
 * current status of the findings that email actually listed. The one thing
 * nobody can ask for — "what was resolved today" — is explained in
 * `sinceLastBrief`.
 */
export async function loadSince(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  before?: string,
): Promise<SinceLastBrief | null> {
  const query = supabase
    .from('brief_deliveries')
    .select('sent_at, finding_ids')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1);
  // A second email on the same tick measures from the FIRST one, not from
  // itself — otherwise a user with two due slots gets "0 new since your last
  // brief" on the second, which is true and useless.
  const { data: deliveries, error } = before
    ? await query.lt('sent_at', before).returns<{ sent_at: string; finding_ids: string[] | null }[]>()
    : await query.returns<{ sent_at: string; finding_ids: string[] | null }[]>();

  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }

  const previous = (deliveries ?? [])[0];
  if (!previous) return null;

  const { data: raised } = await supabase
    .from('agent_findings')
    .select('agent, rand_impact, recommended_action, created_at')
    .eq('org_id', orgId)
    .gt('created_at', previous.sent_at)
    .limit(SINCE_LIMIT)
    .returns<{ agent: string; rand_impact: number | string | null; recommended_action: string | null; created_at: string }[]>();

  const listed = previous.finding_ids ?? [];
  let statuses: { id: string; status: string }[] = [];
  if (listed.length > 0) {
    const { data } = await supabase
      .from('agent_findings')
      .select('id, status')
      .eq('org_id', orgId)
      .in('id', listed)
      .returns<{ id: string; status: string }[]>();
    statuses = data ?? [];
  }

  return sinceLastBrief(
    { sent_at: previous.sent_at, finding_ids: listed },
    (raised ?? []).map((r) => ({
      agent: r.agent,
      rand_impact: toNumber(r.rand_impact),
      recommended_action: r.recommended_action,
      created_at: r.created_at,
    })),
    statuses,
  );
}

/** One Resend call, in one place, so the cron and the test button cannot drift
 *  apart on the From address or the error shape. */
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to: [to], subject, html });
  if (error) throw new Error(error.message);
}

/** True when anyone in this org has asked for a brief on a schedule. The Monday
 *  digest reads this to stand down (see app/api/agents/digest/route.ts). A
 *  missing table means nobody has, which is the pre-migration truth. */
export async function orgHasEnabledSchedules(
  supabase: SupabaseClient,
  orgId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('brief_schedules')
    .select('id')
    .eq('org_id', orgId)
    .eq('enabled', true)
    .limit(1);
  if (error) {
    if (isMissingRelation(error)) return false;
    throw error;
  }
  return (data ?? []).length > 0;
}

/** A stored row, in the shape the pure `slotIsDue` expects. */
function toSlot(row: ScheduleRow): BriefSlot {
  const kind: BriefSlotKind = row.kind === 'morning' || row.kind === 'evening' ? row.kind : 'custom';
  return {
    id: row.id,
    kind,
    local_time: row.local_time,
    days: row.days ?? [],
    enabled: row.enabled,
    created_at: row.created_at,
  };
}

/**
 * One tick, for one org.
 *
 * The order of operations is the whole design: find what is due, drop what has
 * already been delivered TODAY, compose from one shared read of the org's feed,
 * send, and only then write the delivery row. Writing it last is what makes a
 * Resend failure retryable — no row, so the next tick (still inside the
 * one-hour lookback) tries again — and writing it at all is what stops the
 * three ticks after a success from sending the same email again.
 *
 * @param now injected rather than read from the clock so a test, or a manual
 *        curl, reasons about a fixed instant. The route always passes
 *        `new Date()`.
 */
export async function runBriefNotify(
  supabase: SupabaseClient,
  orgId: string,
  now: Date,
): Promise<BriefNotifySummary> {
  const summary: BriefNotifySummary = { orgId, due: 0, sent: 0, alreadySent: 0, skipped: 0, errors: [] };

  const { data: rows, error } = await supabase
    .from('brief_schedules')
    .select('id, user_id, kind, local_time, days, enabled, created_at')
    .eq('org_id', orgId)
    .eq('enabled', true)
    .returns<ScheduleRow[]>();

  if (error) {
    if (isMissingRelation(error)) return { ...summary, tableMissing: true };
    throw error;
  }

  const due = (rows ?? []).map(toSlot).filter((slot) => slotIsDue(slot, now));
  summary.due = due.length;
  if (due.length === 0) return summary;

  const localDate = localDateFor(now);
  const dueIds = due.map((s) => s.id).filter((id): id is string => !!id);

  // Which of these slots has already had its email today. One read for the
  // whole org rather than one per slot.
  const { data: delivered } = await supabase
    .from('brief_deliveries')
    .select('schedule_id')
    .eq('org_id', orgId)
    .eq('local_date', localDate)
    .in('schedule_id', dueIds)
    .returns<{ schedule_id: string }[]>();
  const deliveredIds = new Set((delivered ?? []).map((d) => d.schedule_id));

  // Whose slots these are. `user_id` is deliberately NOT carried on `BriefSlot`
  // — the pure module has no business knowing who a slot belongs to, since
  // "is it 07:00 yet" is the same question for everyone — so the owner is
  // looked up from the rows that were just read.
  const ownerOf = new Map((rows ?? []).map((r) => [r.id, r.user_id]));
  const byUser = new Map<string, BriefSlot[]>();
  for (const slot of due) {
    const owner = slot.id ? ownerOf.get(slot.id) : undefined;
    if (!owner) continue;
    const bucket = byUser.get(owner);
    if (bucket) bucket.push(slot);
    else byUser.set(owner, [slot]);
  }

  // Whether each of them may still see a Brief. A user demoted to 'member'
  // since they set the schedule up must stop receiving it: every card in this
  // email is a claim about money, and `canSeeBrief` is the rule that gates that
  // everywhere else in the product (lib/platform/access.ts).
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('org_id', orgId)
    .in('id', [...byUser.keys()])
    .returns<{ id: string; role: string | null; full_name: string | null }[]>();
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const context = await loadBriefContext(supabase, orgId, now);

  for (const [userId, slots] of byUser) {
    const profile = profileById.get(userId);
    if (!profile || !canSeeBrief(profile.role)) {
      summary.skipped += slots.length;
      continue;
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const to = authUser?.user?.email ?? '';
    if (!to) {
      summary.skipped += slots.length;
      summary.errors.push(`No email address for user ${userId}.`);
      continue;
    }

    const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] ?? '';

    for (const group of groupDueSlots(slots)) {
      const outstanding = group.scheduleIds.filter((id) => !deliveredIds.has(id));
      if (outstanding.length === 0) {
        summary.alreadySent += group.scheduleIds.length;
        continue;
      }
      // Some of the group delivered and some not: the EMAIL went out (that is
      // what a delivery row records), and the missing rows are an insert that
      // failed half way. Backfill them rather than send a duplicate — an owner
      // reading the same brief twice is the worse of the two wrongs.
      if (outstanding.length < group.scheduleIds.length) {
        await insertDeliveries(supabase, orgId, userId, localDate, outstanding, []);
        summary.alreadySent += group.scheduleIds.length;
        continue;
      }

      try {
        const since = await loadSince(supabase, orgId, userId);
        const slot = slots.find((s) => s.id === group.scheduleIds[0]);
        const html = renderBriefEmail({
          orgName: context.orgName,
          firstName,
          kind: group.kind,
          now,
          open: context.open,
          readCount: context.readCount,
          since,
          days: slot?.days ?? [],
          localTime: group.localTime,
        });
        await send(to, briefSubject({ orgName: context.orgName, kind: group.kind, now }), html);

        await insertDeliveries(
          supabase,
          orgId,
          userId,
          localDate,
          group.scheduleIds,
          // What the email LISTED, which is what "3 of the 4 items in it are
          // now closed" will be measured against next time. The composer ranks
          // and cuts the same way, so these are the same four.
          rankFindings([...context.open]).slice(0, BRIEF_EMAIL_CARDS).map((f) => f.id),
        );
        for (const id of group.scheduleIds) deliveredIds.add(id);
        summary.sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('brief-notify: send failed', orgId, userId, message);
        summary.errors.push(message);
      }
    }
  }

  return summary;
}

/** The delivery rows for one email. Written AFTER the send, so a failure leaves
 *  nothing behind and the next tick retries inside the same lookback window. */
async function insertDeliveries(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  localDate: string,
  scheduleIds: readonly string[],
  findingIds: readonly string[],
): Promise<void> {
  if (scheduleIds.length === 0) return;
  const { error } = await supabase.from('brief_deliveries').insert(
    scheduleIds.map((schedule_id) => ({
      schedule_id,
      org_id: orgId,
      user_id: userId,
      local_date: localDate,
      finding_ids: findingIds,
    })),
  );
  // A unique violation here means another tick won the race and already
  // recorded this send — which is the mechanism working, not a failure.
  if (error) console.error('brief-notify: delivery row failed', orgId, userId, error.message);
}

/**
 * "Send me a test now" — the same email, to the person pressing the button,
 * immediately.
 *
 * IGNORES THE SCHEDULE ENTIRELY and writes NO delivery row (plan §5). It is a
 * check that the address works and a preview of the wording; recording it as a
 * delivery would suppress the real 07:00 brief the next morning and shift the
 * "since your last brief" anchor to a moment nothing happened at.
 *
 * Runs on the CALLER'S client, so it needs no service role: `agent_findings`
 * and `brief_deliveries` are both readable by the signed-in user under RLS, and
 * the recipient address is the session's own, which is the only address this
 * button is ever allowed to send to.
 */
export async function sendTestBrief(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  options: { to: string; firstName: string; kind: BriefSlotKind; localTime: string; days: readonly number[] },
  now: Date = new Date(),
): Promise<void> {
  const context = await loadBriefContext(supabase, orgId, now);
  const since = await loadSince(supabase, orgId, userId);
  const html = renderBriefEmail({
    orgName: context.orgName,
    firstName: options.firstName,
    kind: options.kind,
    now,
    open: context.open,
    readCount: context.readCount,
    since,
    days: options.days,
    localTime: options.localTime,
  });
  await send(options.to, briefSubject({ orgName: context.orgName, kind: options.kind, now }), html);
}
