import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUE_LOOKBACK_MINUTES,
  MAX_SLOTS,
  daysLabel,
  defaultSlots,
  formatLocalTime,
  groupDueSlots,
  kindWord,
  localDateFor,
  normaliseSlots,
  parseLocalTime,
  sinceLastBrief,
  slotIsDue,
  type BriefSlot,
} from '../lib/platform/brief-schedules-shared.ts';
import { sastMinutesOfDay, sastWeekday } from '../lib/platform/sast.ts';

// Everything pinned here decides whether an EMAIL IS SENT, and every failure
// mode is silent: a due-check fifteen minutes out sends nothing and looks
// exactly like a working cron; a local date read in UTC lets a late-evening
// slot fire twice on the same night. So the tests spend most of their time on
// the boundaries — the minute a slot becomes due, the minute it stops being
// due, and midnight in two timezones at once.
//
// SAST is UTC+02:00 and has no daylight saving, so every instant below is
// written as UTC with the SAST reading in the comment.

function slot(overrides: Partial<BriefSlot> = {}): BriefSlot {
  return {
    id: 'a',
    kind: 'morning',
    local_time: '07:00',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    ...overrides,
  };
}

// 2026-08-18 is a Tuesday (ISO weekday 2).
const TUE_0700_SAST = new Date('2026-08-18T05:00:00.000Z');

test('the SAST clock reads the owner\'s wall time, not the server\'s', () => {
  assert.equal(sastMinutesOfDay(TUE_0700_SAST), 7 * 60);
  assert.equal(sastWeekday(TUE_0700_SAST), 2);

  // 22:30 UTC is already half past midnight the NEXT day in SAST — the case
  // that makes a UTC-keyed dedupe send twice on one night.
  const lateUtc = new Date('2026-08-18T22:30:00.000Z');
  assert.equal(sastMinutesOfDay(lateUtc), 30);
  assert.equal(localDateFor(lateUtc), '2026-08-19');
  assert.equal(sastWeekday(lateUtc), 3);

  // Midnight itself must read as 0, not 1440 — the ICU "24" quirk.
  assert.equal(sastMinutesOfDay(new Date('2026-08-18T22:00:00.000Z')), 0);
});

test('a slot is due from its own minute until the lookback runs out', () => {
  const s = slot();
  // 06:59 SAST — not yet.
  assert.equal(slotIsDue(s, new Date('2026-08-18T04:59:00.000Z')), false);
  // 07:00 exactly.
  assert.equal(slotIsDue(s, TUE_0700_SAST), true);
  // 07:45 — a run three ticks late still sends.
  assert.equal(slotIsDue(s, new Date('2026-08-18T05:45:00.000Z')), true);
  // 08:00 — exactly the lookback, still in.
  assert.equal(slotIsDue(s, new Date('2026-08-18T06:00:00.000Z')), true);
  // 08:01 — the hour is gone and so is the email.
  assert.equal(slotIsDue(s, new Date('2026-08-18T06:01:00.000Z')), false);
  assert.equal(DUE_LOOKBACK_MINUTES, 60);
});

test('a slot off, or on a day it does not run, is never due', () => {
  assert.equal(slotIsDue(slot({ enabled: false }), TUE_0700_SAST), false);
  // Tuesday is ISO 2; this one runs Mondays and Wednesdays only.
  assert.equal(slotIsDue(slot({ days: [1, 3] }), TUE_0700_SAST), false);
  assert.equal(slotIsDue(slot({ days: [2] }), TUE_0700_SAST), true);
  // An unparseable time is a row no run should ever match.
  assert.equal(slotIsDue(slot({ local_time: '25:00' }), TUE_0700_SAST), false);
});

test('the lookback does not wrap past SAST midnight', () => {
  // A 23:50 slot, checked at 00:05 the next SAST day. Only 15 minutes have
  // passed in wall-clock terms, but the day has rolled over and the email's
  // whole content is "what happened today" — so it is skipped, not sent late.
  const late = slot({ local_time: '23:50', days: [1, 2, 3, 4, 5] });
  assert.equal(slotIsDue(late, new Date('2026-08-18T22:05:00.000Z')), false);
});

test('a slot saved after its own time today does not fire the same minute', () => {
  // The 07:20 case: someone opens settings at twenty past and saves a 07:00
  // slot. Without this gate the lookback would send them an "overnight brief"
  // seconds later, because it cannot tell "we missed this" from "this did not
  // exist yet".
  const justSaved = slot({ created_at: '2026-08-18T05:20:00.000Z' }); // 07:20 SAST
  assert.equal(slotIsDue(justSaved, new Date('2026-08-18T05:25:00.000Z')), false);

  // Saved BEFORE its time today — a normal edit earlier the same morning.
  const savedEarlier = slot({ created_at: '2026-08-18T04:10:00.000Z' }); // 06:10 SAST
  assert.equal(slotIsDue(savedEarlier, TUE_0700_SAST), true);

  // Saved on a previous day — the ordinary case, unaffected.
  const savedYesterday = slot({ created_at: '2026-08-17T18:00:00.000Z' });
  assert.equal(slotIsDue(savedYesterday, TUE_0700_SAST), true);

  // An unreadable timestamp must not block a send.
  assert.equal(slotIsDue(slot({ created_at: 'not a date' }), TUE_0700_SAST), true);
});

test('two slots at the same time collapse into one email but both stay booked', () => {
  const groups = groupDueSlots([
    slot({ id: 'b', kind: 'custom', local_time: '07:00' }),
    slot({ id: 'a', kind: 'morning', local_time: '07:00' }),
    slot({ id: 'c', kind: 'evening', local_time: '17:30' }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { localTime: '07:00', kind: 'morning', scheduleIds: ['a', 'b'] });
  assert.deepEqual(groups[1], { localTime: '17:30', kind: 'evening', scheduleIds: ['c'] });
});

test('times parse and round-trip through what an <input type="time"> speaks', () => {
  assert.equal(parseLocalTime('07:00'), 420);
  // PostgREST returns a `time` column with seconds; they are ignored, not fatal.
  assert.equal(parseLocalTime('17:30:00'), 1050);
  assert.equal(parseLocalTime('24:00'), null);
  assert.equal(parseLocalTime('7:00'), null);
  assert.equal(parseLocalTime(''), null);
  assert.equal(formatLocalTime(420), '07:00');
  assert.equal(formatLocalTime(1050), '17:30');
  assert.equal(formatLocalTime(0), '00:00');
});

test('validation rejects rather than repairs anything the user can see', () => {
  assert.equal(normaliseSlots('nope').error, 'Expected a list of schedules.');
  assert.match(normaliseSlots([{}, {}, {}, {}, {}]).error ?? '', /at most 4/);
  assert.match(normaliseSlots([{ kind: 'nightly', local_time: '07:00', days: [1], enabled: true }]).error ?? '', /kind/);
  assert.match(normaliseSlots([{ kind: 'morning', local_time: '25:00', days: [1], enabled: true }]).error ?? '', /time/);
  assert.match(normaliseSlots([{ kind: 'morning', local_time: '07:00', days: [], enabled: true }]).error ?? '', /at least one day/);
  assert.match(normaliseSlots([{ kind: 'morning', local_time: '07:00', days: [0], enabled: true }]).error ?? '', /Monday/);
  assert.match(normaliseSlots([{ kind: 'morning', local_time: '07:00', days: [1] }]).error ?? '', /on or off/);

  // The only two things it DOES normalise are invisible to the user: duplicate
  // weekdays collapse and the list is sorted, so [5,1,1] and [1,5] write the
  // same row. Seconds are trimmed off the time for the same reason.
  const ok = normaliseSlots([{ kind: 'evening', local_time: '17:30:00', days: [5, 1, 1], enabled: true }]);
  assert.equal(ok.error, null);
  assert.deepEqual(ok.slots, [
    { id: undefined, kind: 'evening', local_time: '17:30', days: [1, 5], enabled: true },
  ]);
  assert.equal(MAX_SLOTS, 4);
});

test('the offered defaults are the two Josh asked for, and are unsaved', () => {
  const [morning, evening] = defaultSlots();
  assert.equal(morning.local_time, '07:00');
  assert.deepEqual(morning.days, [1, 2, 3, 4, 5, 6]); // paper arrives on a Saturday
  assert.equal(evening.local_time, '17:30');
  assert.deepEqual(evening.days, [1, 2, 3, 4, 5]); // nobody wants a Saturday report
  // No ids: nothing has been written, and the card says so.
  assert.equal(morning.id, undefined);
  assert.equal(evening.id, undefined);
});

test('day labels collapse a run and name the odd ones out', () => {
  assert.equal(daysLabel([1, 2, 3, 4, 5]), 'Mon–Fri');
  assert.equal(daysLabel([1, 2, 3, 4, 5, 6, 7]), 'Every day');
  assert.equal(daysLabel([1, 3, 5]), 'Mon, Wed, Fri');
  assert.equal(daysLabel([6, 7]), 'Sat, Sun');
  assert.equal(daysLabel([]), 'Never');
});

test('a custom slot contributes no adjective to the subject line', () => {
  assert.equal(kindWord('morning'), 'morning');
  assert.equal(kindWord('evening'), 'evening');
  assert.equal(kindWord('custom'), '');
});

test('"since your last brief" says only what rows prove', () => {
  const finding = (created: string) => ({
    agent: 'price_watch',
    rand_impact: 4200,
    recommended_action: 'Call the supplier',
    created_at: created,
  });
  // A Doc Watch receipt: the slug AND no rand figure AND no recommendation.
  const receipt = (created: string) => ({
    agent: 'doc_watch',
    rand_impact: null,
    recommended_action: null,
    created_at: created,
  });

  // No previous email — nothing to compare against, so nothing is claimed.
  assert.equal(sinceLastBrief(null, [finding('2026-08-18T05:00:00.000Z')], []), null);

  const previous = { sent_at: '2026-08-18T05:00:00.000Z', finding_ids: ['f1', 'f2', 'f3', 'f4'] };
  const since = sinceLastBrief(
    previous,
    [finding('2026-08-18T06:00:00.000Z'), receipt('2026-08-18T06:05:00.000Z'), receipt('2026-08-18T06:06:00.000Z')],
    [
      { id: 'f1', status: 'dismissed' },
      { id: 'f2', status: 'resolved' },
      { id: 'f3', status: 'new' },
      { id: 'f4', status: 'in_progress' },
    ],
  );

  // Receipts are counted as documents READ, never as things needing attention —
  // the same belt-and-braces test the Brief and the digest use.
  assert.deepEqual(since, {
    since: '2026-08-18T05:00:00.000Z',
    raised: 1,
    read: 2,
    closed: 2,
    listed: 4,
  });
});

test('a Doc Watch card that carries a rand figure stops being a receipt', () => {
  // Belt-and-braces, inherited from isInformationalFinding: if Doc Watch ever
  // learns to price something, that row starts counting without anyone editing
  // a list.
  const since = sinceLastBrief(
    { sent_at: '2026-08-18T05:00:00.000Z', finding_ids: [] },
    [{ agent: 'doc_watch', rand_impact: 900, recommended_action: null, created_at: '2026-08-18T06:00:00.000Z' }],
    [],
  );
  assert.equal(since?.raised, 1);
  assert.equal(since?.read, 0);
});
