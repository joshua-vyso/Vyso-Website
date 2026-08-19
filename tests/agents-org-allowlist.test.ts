import test from 'node:test';
import assert from 'node:assert/strict';
import {
  noOrgsMessage,
  selectAgentOrgs,
  type AgentOrgs,
  type EnvLike,
} from '../lib/platform/agents/org-allowlist.ts';

// This module decides WHICH BUSINESSES THE AGENTS RUN FOR, and the default has
// been inverted: it used to be an opt-in allowlist, and it is now "every
// organisation" minus an exclude list, with the old vars demoted to an optional
// development restriction. Both directions are dangerous in different ways — one
// leaves a paying customer's Brief empty, the other runs agents against an org
// somebody deliberately turned off — so the whole truth table is pinned here
// rather than left to a reading of the code.
//
// `selectAgentOrgs` takes the org list AND the env as arguments precisely so this
// can be table-driven without a database and without mutating process.env (which
// node:test runs in parallel with every other file in tests/).

const A = '01000000-7e5d-4c1a-9b3f-000000000001';
const B = '01000000-7e5d-4c1a-9b3f-000000000002';
const C = '01000000-7e5d-4c1a-9b3f-000000000003';
/** An id that is in an env var but NOT in the organisations table. */
const GHOST = '01000000-7e5d-4c1a-9b3f-0000000000ff';

/** The table, oldest first — the order `agentOrgIds` reads it in. */
const ALL = [A, B, C];

interface Case {
  name: string;
  all?: string[];
  env: EnvLike;
  expected: string[];
  restrictedBy?: string;
  notFound?: string[];
  excluded?: string[];
}

const CASES: Case[] = [
  {
    name: 'NOTHING SET ⇒ every organisation (the production configuration)',
    env: {},
    expected: ALL,
  },
  {
    name: 'every var blank ⇒ still every organisation',
    env: { AGENTS_ORG_IDS: '  ', PRICE_WATCH_ORG_IDS: ' , ', AGENTS_ORG_EXCLUDE: '' },
    expected: ALL,
  },
  {
    name: 'no organisations in the database ⇒ nothing to run, not an error',
    all: [],
    env: {},
    expected: [],
  },
  {
    name: 'AGENTS_ORG_EXCLUDE drops one org and leaves the order alone',
    env: { AGENTS_ORG_EXCLUDE: B },
    expected: [A, C],
    excluded: [B],
  },
  {
    name: 'AGENTS_ORG_EXCLUDE naming every org disables the agents entirely',
    env: { AGENTS_ORG_EXCLUDE: `${A},${B},${C}` },
    expected: [],
    excluded: [A, B, C],
  },
  {
    name: 'an excluded id that is not an organisation is simply ignored',
    env: { AGENTS_ORG_EXCLUDE: GHOST },
    expected: ALL,
  },
  {
    name: 'AGENTS_ORG_IDS restricts to a subset (the dev/staging use)',
    env: { AGENTS_ORG_IDS: B },
    expected: [B],
    restrictedBy: 'AGENTS_ORG_IDS',
  },
  {
    name: 'the legacy PRICE_WATCH_ORG_IDS restricts the same way',
    env: { PRICE_WATCH_ORG_IDS: C },
    expected: [C],
    restrictedBy: 'PRICE_WATCH_ORG_IDS',
  },
  {
    name: 'AGENTS_ORG_IDS wins over the legacy var when both are set',
    env: { AGENTS_ORG_IDS: B, PRICE_WATCH_ORG_IDS: A },
    expected: [B],
    restrictedBy: 'AGENTS_ORG_IDS',
  },
  {
    name: 'a blank AGENTS_ORG_IDS falls through to the legacy var, not to "nothing"',
    env: { AGENTS_ORG_IDS: '   ', PRICE_WATCH_ORG_IDS: A },
    expected: [A],
    restrictedBy: 'PRICE_WATCH_ORG_IDS',
  },
  {
    name: 'a restriction is INTERSECTED with the table — a ghost id runs nothing and is reported',
    env: { AGENTS_ORG_IDS: `${A},${GHOST}` },
    expected: [A],
    restrictedBy: 'AGENTS_ORG_IDS',
    notFound: [GHOST],
  },
  {
    name: 'a restriction that matches no organisation runs nothing at all',
    env: { AGENTS_ORG_IDS: GHOST },
    expected: [],
    restrictedBy: 'AGENTS_ORG_IDS',
    notFound: [GHOST],
  },
  {
    name: 'the restriction keeps created_at order, not the order the var was written in',
    env: { AGENTS_ORG_IDS: `${C}, ${A}` },
    expected: [A, C],
    restrictedBy: 'AGENTS_ORG_IDS',
  },
  {
    name: 'EXCLUDE BEATS RESTRICT: an org named by both is not run',
    env: { AGENTS_ORG_IDS: `${A},${B}`, AGENTS_ORG_EXCLUDE: B },
    expected: [A],
    restrictedBy: 'AGENTS_ORG_IDS',
    excluded: [B],
  },
  {
    name: 'commas, spaces and empty segments are cleaned, not passed through',
    env: { AGENTS_ORG_IDS: ` ${A}, ,${B} ,` },
    expected: [A, B],
    restrictedBy: 'AGENTS_ORG_IDS',
  },
];

for (const c of CASES) {
  test(`selectAgentOrgs: ${c.name}`, () => {
    const got = selectAgentOrgs(c.all ?? ALL, c.env);
    assert.deepEqual(got.orgIds, c.expected);
    assert.equal(got.restrictedBy, c.restrictedBy);
    assert.deepEqual(got.notFound, c.notFound ?? []);
    assert.deepEqual(got.excluded, c.excluded ?? []);
  });
}

test('selectAgentOrgs does not mutate the list it was given', () => {
  const all = [A, B, C];
  selectAgentOrgs(all, { AGENTS_ORG_EXCLUDE: B, AGENTS_ORG_IDS: A });
  assert.deepEqual(all, [A, B, C]);
});

// ---------------------------------------------------------------------------
// noOrgsMessage — the one diagnostic an operator gets from a `ran: 0` at 04:00.
// Each branch has to name the thing they would have to change, so these assert
// on the SUBSTANCE of the sentence rather than pinning its exact wording.
// ---------------------------------------------------------------------------

const EMPTY: AgentOrgs = { orgIds: [], notFound: [], excluded: [], tableMissing: false };

test('noOrgsMessage: a missing organisations table says so', () => {
  const msg = noOrgsMessage({ ...EMPTY, tableMissing: true });
  assert.match(msg, /organisations table is not in this database/i);
});

test('noOrgsMessage: a failed read quotes the database error', () => {
  const msg = noOrgsMessage({ ...EMPTY, error: 'connection refused' });
  assert.match(msg, /connection refused/);
});

test('noOrgsMessage: a restriction that matched nothing names the var AND says production leaves it unset', () => {
  const msg = noOrgsMessage({ ...EMPTY, restrictedBy: 'AGENTS_ORG_IDS', notFound: [GHOST] });
  assert.match(msg, /AGENTS_ORG_IDS/);
  assert.match(msg, /unset/i);
});

test('noOrgsMessage: everything excluded names the exclude var', () => {
  const msg = noOrgsMessage({ ...EMPTY, excluded: [A, B] });
  assert.match(msg, /AGENTS_ORG_EXCLUDE/);
});

test('noOrgsMessage: an empty database says the database is empty, and blames no env var', () => {
  const msg = noOrgsMessage(EMPTY);
  assert.match(msg, /no organisations in this database/i);
  assert.doesNotMatch(msg, /AGENTS_ORG_/);
});
