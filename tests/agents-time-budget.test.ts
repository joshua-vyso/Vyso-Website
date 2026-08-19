import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startTimeBudget,
  TIME_BUDGET_RESERVE_SECONDS,
} from '../lib/platform/agents/time-budget.ts';

// The guard that decides whether an agent route may START another organisation.
// Its whole value is that a run over many orgs reports what it did instead of
// being killed mid-org with no response at all, so the boundary — exactly when it
// flips — is pinned here. `now` is injected; nothing below sleeps.

/** A controllable clock, in milliseconds. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1_000_000;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test('the reserve is 30s — the headroom the routes subtract from maxDuration', () => {
  assert.equal(TIME_BUDGET_RESERVE_SECONDS, 30);
});

test('a fresh budget has not been spent', () => {
  const clock = fakeClock();
  assert.equal(startTimeBudget(300, clock.now).spent(), false);
});

test('the budget is maxDuration minus the reserve, and flips exactly on it', () => {
  const clock = fakeClock();
  const budget = startTimeBudget(300, clock.now);

  clock.advance(269_000);
  assert.equal(budget.spent(), false, '269s of a 270s budget: another org may start');

  clock.advance(999);
  assert.equal(budget.spent(), false, '269.999s: still inside');

  clock.advance(1);
  assert.equal(budget.spent(), true, '270s exactly: no new org may start');
});

test("brief-notify's 60s route gets a 30s budget", () => {
  const clock = fakeClock();
  const budget = startTimeBudget(60, clock.now);
  clock.advance(29_999);
  assert.equal(budget.spent(), false);
  clock.advance(1);
  assert.equal(budget.spent(), true);
});

test('elapsedMs reports real elapsed time, not the budget', () => {
  const clock = fakeClock();
  const budget = startTimeBudget(300, clock.now);
  clock.advance(12_345);
  assert.equal(budget.elapsedMs(), 12_345);
  clock.advance(1_000_000);
  assert.equal(budget.elapsedMs(), 1_012_345, 'keeps counting past the budget');
});

test('spent() is a pure question — asking twice does not change the answer', () => {
  const clock = fakeClock();
  const budget = startTimeBudget(300, clock.now);
  assert.equal(budget.spent(), false);
  assert.equal(budget.spent(), false);
  clock.advance(300_000);
  assert.equal(budget.spent(), true);
  assert.equal(budget.spent(), true);
});

test('a maxDuration at or below the reserve is clamped to zero, never negative', () => {
  const clock = fakeClock();
  // Nothing in the codebase has one; the clamp exists so a future short route
  // fails as an obvious no-op rather than as a guard that silently never fires.
  const budget = startTimeBudget(TIME_BUDGET_RESERVE_SECONDS, clock.now);
  assert.equal(budget.spent(), true);
  assert.equal(startTimeBudget(5, clock.now).spent(), true);
});
