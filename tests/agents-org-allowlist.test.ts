import test from 'node:test';
import assert from 'node:assert/strict';
import { agentOrgIds, type EnvLike } from '../lib/platform/agents/org-allowlist.ts';

// The allowlist is the ONE thing standing between "the agents ran for Meridian"
// and "the agents wrote findings into every customer's Brief", so its whole
// truth table is pinned here rather than left to a reading of the code.
//
// `agentOrgIds` takes the env object as an argument precisely so this can be
// table-driven without mutating process.env (which node:test runs in parallel
// with every other file in tests/).

const A = '01000000-7e5d-4c1a-9b3f-000000000001';
const B = '01000000-7e5d-4c1a-9b3f-000000000002';

const CASES: Array<{ name: string; env: EnvLike; expected: string[] }> = [
  { name: 'both unset ⇒ nothing enabled', env: {}, expected: [] },
  {
    name: 'legacy var alone still works (the live Vercel deploy)',
    env: { PRICE_WATCH_ORG_IDS: A },
    expected: [A],
  },
  {
    name: 'new var alone',
    env: { AGENTS_ORG_IDS: A },
    expected: [A],
  },
  {
    name: 'new var WINS over the legacy one when both are set',
    env: { AGENTS_ORG_IDS: B, PRICE_WATCH_ORG_IDS: A },
    expected: [B],
  },
  {
    name: 'new var blank falls back to the legacy one rather than disabling everything',
    env: { AGENTS_ORG_IDS: '   ', PRICE_WATCH_ORG_IDS: A },
    expected: [A],
  },
  {
    name: 'commas, spaces and empty segments are cleaned, not passed through',
    env: { AGENTS_ORG_IDS: ` ${A}, ,${B} ,` },
    expected: [A, B],
  },
  {
    name: 'both blank ⇒ still nothing (an operator who cleared the list means it)',
    env: { AGENTS_ORG_IDS: '', PRICE_WATCH_ORG_IDS: ' , ' },
    expected: [],
  },
];

for (const c of CASES) {
  test(`agentOrgIds: ${c.name}`, () => {
    assert.deepEqual(agentOrgIds(c.env), c.expected);
  });
}
