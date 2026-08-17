import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFORMATIONAL_AGENTS,
  INFORMATIONAL_TTL_HOURS,
  STOCK_EVIDENCE_LABEL,
  daysPastTermsLabel,
  documentEvidenceLabel,
  evidenceHeading,
  evidenceHeadingWord,
  evidenceKindOf,
  evidenceMissingCopy,
  evidenceSourceName,
  invoiceEvidenceLabel,
  isInformationalExpired,
  isInformationalFinding,
  stockRuleLabel,
} from '../lib/platform/agents/finding-kinds.ts';
import type { EvidenceKind } from '../lib/platform/agents/finding-kinds.ts';

// The pure half of lib/platform/agent-findings.ts. The read path itself cannot
// be unit tested (it imports supabase-server → next/headers, which only exists
// inside a request), but the decisions it makes are pure — and they are the ones
// that go wrong quietly: a receipt counted in the greeting, a card labelled "3
// documents" when it cites three invoices, a receipt that never ages out.

// ---------------------------------------------------------------------------
// Which table an agent's evidence_refs point at
// ---------------------------------------------------------------------------

const KIND_CASES: Array<[agent: string, kind: string]> = [
  ['price_watch', 'documents'],
  ['doc_watch', 'documents'],
  ['debtors_watch', 'invoices'],
  ['stock_cover', 'stock'],
  // An agent this build has never heard of degrades to the behaviour the Brief
  // already had, rather than to no evidence at all.
  ['some_future_agent', 'documents'],
  ['', 'documents'],
];

for (const [agent, kind] of KIND_CASES) {
  test(`evidenceKindOf(${JSON.stringify(agent)}) === '${kind}'`, () => {
    assert.equal(evidenceKindOf(agent), kind);
  });
}

// ---------------------------------------------------------------------------
// Evidence labels — the noun has to be true
// ---------------------------------------------------------------------------

const LABEL_CASES: Array<[types: (string | null)[], label: string]> = [
  [['invoice'], '1 invoice'],
  [['invoice', 'invoice', 'invoice'], '3 invoices'],
  [['statement'], '1 statement'],
  [['price_list', 'price_list'], '2 price lists'],
  [['delivery_note'], '1 delivery note'],
  // Mixed types have no single true noun, so they degrade to the catch-all.
  [['invoice', 'statement'], '2 documents'],
  // So does an unknown or missing type.
  [['something_else'], '1 document'],
  [[null, null], '2 documents'],
];

for (const [types, label] of LABEL_CASES) {
  test(`documentEvidenceLabel(${JSON.stringify(types)}) === '${label}'`, () => {
    assert.equal(documentEvidenceLabel(types.length, types), label);
  });
}

test('invoiceEvidenceLabel: Debtors Watch cites invoices, and knows it', () => {
  assert.equal(invoiceEvidenceLabel(1), '1 invoice');
  assert.equal(invoiceEvidenceLabel(2), '2 invoices');
});

test('Stock Cover cites exactly one catalogue line', () => {
  assert.equal(STOCK_EVIDENCE_LABEL, '1 stock line');
});

// ---------------------------------------------------------------------------
// How the detail page introduces the strip — the bug this fixes was a heading
// and a sentence that said "documents" over a finding that cites invoices.
// ---------------------------------------------------------------------------

const KINDS: EvidenceKind[] = ['documents', 'invoices', 'stock'];

const SOURCE_CASES: Array<[kind: EvidenceKind, source: string]> = [
  ['documents', 'Doc-U'],
  ['invoices', 'OrderFlow'],
  ['stock', 'ProcurePulse'],
];

for (const [kind, source] of SOURCE_CASES) {
  test(`evidenceSourceName('${kind}') === '${source}'`, () => {
    assert.equal(evidenceSourceName(kind), source);
  });
}

test('a stock line is the finding’s SUBJECT, not evidence for it', () => {
  assert.equal(evidenceHeadingWord('stock'), 'Subject');
  assert.equal(evidenceHeadingWord('documents'), 'Evidence');
  assert.equal(evidenceHeadingWord('invoices'), 'Evidence');
});

const HEADING_CASES: Array<[kind: EvidenceKind, label: string, heading: string]> = [
  ['documents', '3 invoices', 'Evidence · 3 invoices from Doc-U'],
  ['documents', '1 statement', 'Evidence · 1 statement from Doc-U'],
  ['invoices', '2 invoices', 'Evidence · 2 invoices from OrderFlow'],
  ['invoices', '1 invoice', 'Evidence · 1 invoice from OrderFlow'],
  // Stock ignores the label it is handed: there is only ever one line, and it is
  // named in the card below rather than counted in the heading.
  ['stock', '1 stock line', 'Subject · 1 stock line'],
  ['stock', '', 'Subject · 1 stock line'],
];

for (const [kind, label, heading] of HEADING_CASES) {
  test(`evidenceHeading('${kind}', '${label}') === '${heading}'`, () => {
    assert.equal(evidenceHeading(kind, label), heading);
  });
}

test('the missing-evidence sentence names what was actually cited', () => {
  assert.equal(
    evidenceMissingCopy('documents'),
    'The documents behind this finding are no longer available.',
  );
  assert.equal(
    evidenceMissingCopy('invoices'),
    'The invoices behind this finding are no longer available.',
  );
  assert.equal(
    evidenceMissingCopy('stock'),
    'The stock line behind this finding is no longer available.',
  );
});

test('every kind gets a heading and a sentence — none falls through to ""', () => {
  for (const kind of KINDS) {
    assert.ok(evidenceHeading(kind, '1 thing').length > 0);
    assert.ok(evidenceMissingCopy(kind).endsWith('.'));
    assert.ok(evidenceSourceName(kind).length > 0);
  }
});

// ---------------------------------------------------------------------------
// "40 days past terms" — the same words Debtors Watch's observation uses
// ---------------------------------------------------------------------------

const OVERDUE_CASES: Array<[days: number | null, label: string | null]> = [
  [40, '40 days past terms'],
  [1, '1 day past terms'],
  [2, '2 days past terms'],
  // Not late is not a fact worth a line: "0 days past terms" under a heading
  // about overdue money reads as a bug.
  [0, null],
  [-3, null],
  // No due date → no terms to be past.
  [null, null],
  [Number.NaN, null],
  [Number.POSITIVE_INFINITY, null],
  // `daysSince` floors already; a fractional day here is still a whole day of
  // lateness, never "1.6 days".
  [1.6, '1 day past terms'],
];

for (const [days, label] of OVERDUE_CASES) {
  test(`daysPastTermsLabel(${String(days)}) === ${JSON.stringify(label)}`, () => {
    assert.equal(daysPastTermsLabel(days), label);
  });
}

// ---------------------------------------------------------------------------
// Which Stock Cover rule fired — read back off the dedupe key
// ---------------------------------------------------------------------------

test('stockRuleLabel names the rule in the owner’s words', () => {
  assert.equal(stockRuleLabel('low_cover'), 'Low cover');
  assert.equal(stockRuleLabel('count_variance'), 'Count variance');
});

// ---------------------------------------------------------------------------
// Receipts vs findings — what the greeting is allowed to count
// ---------------------------------------------------------------------------

const finding = (o: Partial<{ agent: string; rand_impact: number | null; recommended_action: string | null }> = {}) => ({
  agent: 'doc_watch',
  rand_impact: null,
  recommended_action: null,
  ...o,
});

const INFORMATIONAL_CASES: Array<{ name: string; finding: ReturnType<typeof finding>; informational: boolean }> = [
  {
    name: 'a Doc Watch receipt with no money and no advice',
    finding: finding(),
    informational: true,
  },
  {
    name: 'a Price Watch finding is never a receipt',
    finding: finding({ agent: 'price_watch', rand_impact: 140_848 }),
    informational: false,
  },
  {
    name: 'a Debtors Watch finding is never a receipt',
    finding: finding({ agent: 'debtors_watch', rand_impact: 190_900, recommended_action: 'Send a statement' }),
    informational: false,
  },
  {
    name: 'a Stock Cover low-cover finding carries no rand figure but is still a finding',
    finding: finding({ agent: 'stock_cover', recommended_action: 'Reorder before Friday' }),
    informational: false,
  },
  {
    // Belt and braces: if Doc Watch ever learns to price something, that row
    // starts counting without anyone having to remember to edit the list.
    name: 'a Doc Watch row that somehow carries money starts counting',
    finding: finding({ rand_impact: 1_000 }),
    informational: false,
  },
  {
    name: 'a Doc Watch row that somehow carries advice starts counting',
    finding: finding({ recommended_action: 'Do something' }),
    informational: false,
  },
];

for (const c of INFORMATIONAL_CASES) {
  test(`isInformationalFinding: ${c.name}`, () => {
    assert.equal(isInformationalFinding(c.finding), c.informational);
  });
}

test('INFORMATIONAL_AGENTS is exactly Doc Watch today', () => {
  assert.deepEqual([...INFORMATIONAL_AGENTS], ['doc_watch']);
});

// ---------------------------------------------------------------------------
// Ageing out — no cron, no status write, just a comparison
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-17T09:00:00+02:00');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const EXPIRY_CASES: Array<[createdAt: string, expired: boolean]> = [
  [hoursAgo(1), false],
  [hoursAgo(INFORMATIONAL_TTL_HOURS - 1), false],
  [hoursAgo(INFORMATIONAL_TTL_HOURS), false],
  [hoursAgo(INFORMATIONAL_TTL_HOURS + 1), true],
  [hoursAgo(24 * 30), true],
  // An unreadable timestamp keeps the card: lingering is a smaller wrong than
  // vanishing.
  ['not a date', false],
  ['', false],
];

for (const [createdAt, expired] of EXPIRY_CASES) {
  test(`isInformationalExpired(${JSON.stringify(createdAt)}) === ${expired}`, () => {
    assert.equal(isInformationalExpired(createdAt, NOW), expired);
  });
}
