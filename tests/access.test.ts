import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeBrief, canSeeMoney } from '../lib/platform/access.ts';

// Small truth table, pinned because the failure mode is a leak. `profiles.role`
// is free text in the database — `UserRole` narrows it in TypeScript, nothing
// enforces it in Postgres — so "unknown role" is a state that really occurs: a
// half-finished invite, a row written by a migration, a typo. Every one of those
// must land on the LEAST privileged answer, and a regression that flipped the
// default would be invisible on every screen an owner ever looks at.

test('owners and admins may see money and the brief', () => {
  for (const role of ['owner', 'admin']) {
    assert.equal(canSeeMoney(role), true, role);
    assert.equal(canSeeBrief(role), true, role);
  }
});

test('members may see neither', () => {
  assert.equal(canSeeMoney('member'), false);
  assert.equal(canSeeBrief('member'), false);
});

test('a missing, null or unknown role fails CLOSED', () => {
  for (const role of [null, undefined, '', 'Owner', 'ADMIN', 'viewer', 'superuser', ' admin']) {
    assert.equal(canSeeMoney(role), false, JSON.stringify(role));
    assert.equal(canSeeBrief(role), false, JSON.stringify(role));
  }
});

test('the two predicates agree — they are one rule under two names today', () => {
  for (const role of ['owner', 'admin', 'member', 'viewer', '', null, undefined]) {
    assert.equal(
      canSeeBrief(role),
      canSeeMoney(role),
      `${JSON.stringify(role)}: if these ever diverge it must be a deliberate edit to access.ts, not an accident`,
    );
  }
});
