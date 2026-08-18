import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeConsecutive, splitTurnText, type TurnText } from '../lib/ai/finch/narration.ts';

// The rehearsal's question 1 came back as:
//
//   "I'll look up the cooking oil price history and see who else supplies
//    it.Now let me get the price history over the past 12 months.Cooking Oil is
//    up 19%…"
//
// Three turns of the agentic loop glued into one paragraph with no separator,
// two of them the model narrating its own plan in the future tense about work
// that was finished before the owner read the sentence. The fixture below is
// that exact answer, turn by turn.

const REHEARSAL: TurnText[] = [
  { turn: 0, text: "I'll look up the cooking oil price history and see who else supplies it.", interim: true },
  { turn: 1, text: 'Now let me get the price history over the past 12 months.', interim: true },
  { turn: 2, text: 'Cooking Oil is up 19% since June — R558.00 on 8 June to R664.00 on 13 August.', interim: false },
];

test('the answer is what the last turn said, and nothing it said on the way', () => {
  const { answer, interim } = splitTurnText(REHEARSAL);
  assert.equal(answer, 'Cooking Oil is up 19% since June — R558.00 on 8 June to R664.00 on 13 August.');
  assert.deepEqual(interim, [
    "I'll look up the cooking oil price history and see who else supplies it.",
    'Now let me get the price history over the past 12 months.',
  ]);
});

test('a turn that answered without touching a tool is the whole answer', () => {
  const { answer, interim } = splitTurnText([{ turn: 0, text: 'Your rebate on Bakers is 4%.', interim: false }]);
  assert.equal(answer, 'Your rebate on Bakers is 4%.');
  assert.deepEqual(interim, []);
});

test('a silent tool turn contributes nothing rather than an empty line', () => {
  const { answer, interim } = splitTurnText([
    { turn: 0, text: '', interim: true },
    { turn: 1, text: '   \n ', interim: true },
    { turn: 2, text: 'Line Fish Fillet is out — 0 kg against a threshold of 20.', interim: false },
  ]);
  assert.deepEqual(interim, []);
  assert.equal(answer, 'Line Fish Fillet is out — 0 kg against a threshold of 20.');
});

test('nothing said at all is an empty answer, not an empty-looking one', () => {
  assert.deepEqual(splitTurnText([]), { interim: [], answer: '' });
  assert.equal(splitTurnText([{ turn: 0, text: 'thinking…', interim: true }]).answer, '');
});

test('whitespace at the seams is trimmed, so nothing is ever glued', () => {
  const { answer } = splitTurnText([
    { turn: 0, text: 'Let me check.', interim: true },
    { turn: 1, text: '  You are owed R12 480.  ', interim: false },
  ]);
  assert.equal(answer, 'You are owed R12 480.');
});

test('two final turns are paragraphs, never a run-on', () => {
  // Not reachable today (the loop breaks on the first non-tool turn) — pinned
  // because the failure it prevents is exactly the bug this file exists for.
  const { answer } = splitTurnText([
    { turn: 0, text: 'First half.', interim: false },
    { turn: 1, text: 'Second half.', interim: false },
  ]);
  assert.equal(answer, 'First half.\n\nSecond half.');
});

/* ── dedupeConsecutive ────────────────────────────────────────────────────── */

test('the same status line twice in a row is one line', () => {
  // The margin question called pw_margin_exposure twice — once with a supplier,
  // once without — and the owner saw "Sizing the margin effect…" twice.
  assert.deepEqual(
    dedupeConsecutive(['Sizing the margin effect…', 'Sizing the margin effect…']),
    ['Sizing the margin effect…'],
  );
});

test('the same tool again AFTER a different one is a second look, and shows', () => {
  assert.deepEqual(
    dedupeConsecutive(['Finding the line…', 'Reading price history…', 'Finding the line…']),
    ['Finding the line…', 'Reading price history…', 'Finding the line…'],
  );
});

test('an absent or empty list is an empty list', () => {
  assert.deepEqual(dedupeConsecutive(undefined), []);
  assert.deepEqual(dedupeConsecutive([]), []);
});
