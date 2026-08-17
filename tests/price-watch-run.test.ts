import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDedupeKey,
  documentSkipReason,
  hasCreditIndicator,
  isoWeekOf,
  parseDedupeKey,
  parseDocumentDate,
  parseEnvList,
  readOnlyClient,
  resolveDocumentDate,
  runPriceWatch,
  statementCoveredByInvoices,
  type PriceWatchDocument,
} from '../lib/platform/price-watch/run.ts';

// run.ts's I/O half needs a Supabase client and is exercised against the real
// database by scripts/backfill-price-watch.ts --dry-run. What is tested here is
// the half that DECIDES things — which documents count, what date a price point
// carries, when a statement duplicates invoices, and the key that makes a
// re-run idempotent — because every one of those silently corrupts a price
// history when it is wrong, rather than failing loudly.

function doc(overrides: Partial<PriceWatchDocument> = {}): PriceWatchDocument {
  return {
    id: 'doc-1',
    supplier_id: 'supplier-1',
    document_type: 'invoice',
    status: 'extracted',
    archived_at: null,
    created_at: '2026-07-20T09:15:00.000Z',
    filename: 'invoice-4471.pdf',
    extracted_data: { fields: [], line_items: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Statement-date parser — the real formats, and garbage
// ---------------------------------------------------------------------------

test('parseDocumentDate: the real statement format "06/JUN/2026"', () => {
  assert.equal(parseDocumentDate('06/JUN/2026'), '2026-06-06');
  assert.equal(parseDocumentDate('6/jun/2026'), '2026-06-06');
  assert.equal(parseDocumentDate('23/MAY/2026'), '2026-05-23');
  // Separator and case variations seen across extractions of the same header.
  assert.equal(parseDocumentDate('06-JUN-2026'), '2026-06-06');
  assert.equal(parseDocumentDate(' 06 Jun 2026 '), '2026-06-06');
  assert.equal(parseDocumentDate('06/June/2026'), '2026-06-06');
});

test('parseDocumentDate: the real invoice format "2026-07-20"', () => {
  assert.equal(parseDocumentDate('2026-07-20'), '2026-07-20');
  assert.equal(parseDocumentDate('2028-02-29'), '2028-02-29'); // 2028 is a leap year
});

test('parseDocumentDate: ambiguous all-numeric dates are REJECTED, not guessed', () => {
  // 06/06 is safe either way, but accepting it would mean accepting 05/06 —
  // and there is no way to tell 5 June from 6 May. Both are refused.
  assert.equal(parseDocumentDate('06/06/2026'), null);
  assert.equal(parseDocumentDate('05/06/2026'), null);
  assert.equal(parseDocumentDate('2026/06/05'), null);
  assert.equal(parseDocumentDate('20-07-2026'), null);
});

test('parseDocumentDate: impossible and malformed dates are rejected', () => {
  assert.equal(parseDocumentDate('31/FEB/2026'), null);
  assert.equal(parseDocumentDate('2026-02-29'), null); // 2026 is not a leap year
  assert.equal(parseDocumentDate('2026-02-30'), null);
  assert.equal(parseDocumentDate('2026-13-01'), null);
  assert.equal(parseDocumentDate('00/JUN/2026'), null);
  assert.equal(parseDocumentDate('06/JUNX/2026'), null);
  assert.equal(parseDocumentDate('06/Janu/2026'), null); // partial month name
  assert.equal(parseDocumentDate('statement date'), null);
  assert.equal(parseDocumentDate(''), null);
  assert.equal(parseDocumentDate(null), null);
  assert.equal(parseDocumentDate(undefined), null);
  assert.equal(parseDocumentDate('2026-07-20T00:00:00Z'), null); // caller slices first
});

// ---------------------------------------------------------------------------
// resolveDocumentDate — the per-document-type precedence
// ---------------------------------------------------------------------------

test('resolveDocumentDate: a statement uses summary.statement_date', () => {
  const d = doc({
    document_type: 'statement',
    created_at: '2026-06-25T09:38:00.000Z',
    extracted_data: { fields: [], line_items: [], summary: { statement_date: '06/JUN/2026' } },
  });
  assert.deepEqual(resolveDocumentDate(d), { date: '2026-06-06', source: 'statement_summary' });
});

test('resolveDocumentDate: a statement with a null statement_date falls back to created_at', () => {
  // This is the one legacy document (edda8e8f) the plan calls out by name.
  const d = doc({
    document_type: 'statement',
    created_at: '2026-06-25T09:38:00.000Z',
    extracted_data: { fields: [], line_items: [], summary: { statement_date: null } },
  });
  assert.deepEqual(resolveDocumentDate(d), { date: '2026-06-25', source: 'created_at' });
});

test('resolveDocumentDate: an invoice uses its extracted invoice-date field', () => {
  const d = doc({
    created_at: '2026-08-01T06:00:00.000Z',
    extracted_data: {
      fields: [
        { label: 'Account no', value: '4471' },
        { label: 'Invoice Date', value: '2026-07-20' },
      ],
      line_items: [],
    },
  });
  assert.deepEqual(resolveDocumentDate(d), { date: '2026-07-20', source: 'field' });
});

test('resolveDocumentDate: an unparseable date field falls back to created_at, never to a guess', () => {
  const d = doc({
    created_at: '2026-08-01T06:00:00.000Z',
    extracted_data: {
      fields: [{ label: 'Invoice Date', value: '07/08/2026' }],
      line_items: [],
    },
  });
  assert.deepEqual(resolveDocumentDate(d), { date: '2026-08-01', source: 'created_at' });
});

test('resolveDocumentDate: no usable date anywhere returns null (the document is skipped)', () => {
  assert.equal(resolveDocumentDate(doc({ created_at: null })), null);
});

// ---------------------------------------------------------------------------
// Document filter
// ---------------------------------------------------------------------------

test('documentSkipReason: a normal priced document is eligible', () => {
  assert.equal(documentSkipReason(doc()), null);
  assert.equal(documentSkipReason(doc({ document_type: 'statement' })), null);
  assert.equal(documentSkipReason(doc({ document_type: 'price_list' })), null);
});

test('documentSkipReason: unpriced document types are excluded', () => {
  assert.equal(documentSkipReason(doc({ document_type: 'delivery_note' })), 'wrong_type');
  assert.equal(documentSkipReason(doc({ document_type: 'order' })), 'wrong_type');
  assert.equal(documentSkipReason(doc({ document_type: null })), 'wrong_type');
});

test('documentSkipReason: rejected and archived documents are excluded', () => {
  assert.equal(documentSkipReason(doc({ status: 'rejected' })), 'status_excluded');
  assert.equal(documentSkipReason(doc({ status: 'archived' })), 'status_excluded');
  assert.equal(
    documentSkipReason(doc({ status: 'extracted', archived_at: '2026-07-01T00:00:00Z' })),
    'archived',
  );
  // Statuses that are NOT exclusions — a reviewed/approved document is the best
  // evidence there is and must keep counting.
  assert.equal(documentSkipReason(doc({ status: 'reviewed' })), null);
  assert.equal(documentSkipReason(doc({ status: 'approved' })), null);
});

test('documentSkipReason: credit notes are excluded, from any of the three haystacks', () => {
  assert.equal(documentSkipReason(doc({ filename: 'CREDIT NOTE 118.pdf' })), 'credit_note');
  assert.equal(
    documentSkipReason(
      doc({
        extracted_data: {
          fields: [{ label: 'Document type', value: 'Credit Note' }],
          line_items: [],
        },
      }),
    ),
    'credit_note',
  );
  assert.equal(
    documentSkipReason(
      doc({
        extracted_data: {
          fields: [],
          line_items: [{ description: 'CREDIT - Tomatoes Saladette returned' }],
        },
      }),
    ),
    'credit_note',
  );
});

test('hasCreditIndicator: word-boundary only — "accredited" is not a credit note', () => {
  assert.equal(hasCreditIndicator(doc({ filename: 'accredited-supplier-invoice.pdf' })), false);
  assert.equal(hasCreditIndicator(doc({ filename: 'invoice-credit-note.pdf' })), true);
});

// ---------------------------------------------------------------------------
// Statement-vs-invoice double-count guard
// ---------------------------------------------------------------------------

test('statementCoveredByInvoices: an invoice inside the statement period suppresses the statement', () => {
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-07-20']), true);
  // Boundaries are inclusive at both ends.
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-07-31']), true);
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-06-30']), true);
});

test('statementCoveredByInvoices: invoices outside the period leave the statement usable', () => {
  assert.equal(statementCoveredByInvoices('2026-07-31', []), false);
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-06-29']), false); // 32 days before
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-08-01']), false); // after the statement
});

test('statementCoveredByInvoices: the window is configurable and garbage dates never suppress', () => {
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-07-20'], 7), false);
  assert.equal(statementCoveredByInvoices('2026-07-31', ['2026-07-26'], 7), true);
  assert.equal(statementCoveredByInvoices('not-a-date', ['2026-07-20']), false);
  assert.equal(statementCoveredByInvoices('2026-07-31', ['not-a-date']), false);
});

// ---------------------------------------------------------------------------
// ISO week
// ---------------------------------------------------------------------------

test('isoWeekOf: every day of one week maps to the same key', () => {
  // Monday 2026-08-10 .. Sunday 2026-08-16.
  const days = [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
    '2026-08-14', '2026-08-15', '2026-08-16',
  ];
  const keys = new Set(days.map(isoWeekOf));
  assert.equal(keys.size, 1, `expected one week key, got ${[...keys].join(', ')}`);
  assert.equal(isoWeekOf('2026-08-13'), '2026-W33');
  // The next day past Sunday starts a new week — this is what stops the same
  // finding being re-written every night.
  assert.notEqual(isoWeekOf('2026-08-17'), isoWeekOf('2026-08-16'));
});

test('isoWeekOf: year boundaries follow ISO rules, not the calendar year', () => {
  // 2027-01-01 is a Friday, so it belongs to the week of Mon 2026-12-28 → W53.
  assert.equal(isoWeekOf('2027-01-01'), '2026-W53');
  assert.equal(isoWeekOf('2026-12-28'), '2026-W53');
  // 2026-01-01 is a Thursday → week 1 of 2026.
  assert.equal(isoWeekOf('2026-01-01'), '2026-W01');
  assert.equal(isoWeekOf('nonsense'), 'unknown');
});

// ---------------------------------------------------------------------------
// Dedupe key
// ---------------------------------------------------------------------------

const KEY_PARTS = {
  supplierId: '11111111-1111-4111-8111-111111111111',
  pwItemId: '22222222-2222-4222-8222-222222222222',
  isoWeek: '2026-W33',
};

test('buildDedupeKey: stable, readable, and identical for identical inputs', () => {
  const a = buildDedupeKey(KEY_PARTS);
  const b = buildDedupeKey({ ...KEY_PARTS, lineSupplier: null });
  const c = buildDedupeKey({ ...KEY_PARTS, lineSupplier: '   ' });
  assert.equal(a, `price_watch:${KEY_PARTS.supplierId}:${KEY_PARTS.pwItemId}:2026-W33`);
  assert.equal(b, a, 'an absent market agent must not change the key');
  assert.equal(c, a, 'a whitespace-only market agent is absent');
});

test('buildDedupeKey: a market agent makes it a different series, appended after the core', () => {
  const withAgent = buildDedupeKey({ ...KEY_PARTS, lineSupplier: 'Botha Roodt & Kie' });
  const plain = buildDedupeKey(KEY_PARTS);
  assert.notEqual(withAgent, plain);
  assert.ok(withAgent.startsWith(plain), 'the documented core must remain the key prefix');
  assert.equal(withAgent, `${plain}:Botha Roodt & Kie`);
  // Two agents on the same statement are two series, so two keys.
  assert.notEqual(
    buildDedupeKey({ ...KEY_PARTS, lineSupplier: 'C L De Villiers' }),
    withAgent,
  );
});

test('buildDedupeKey: the week is part of the identity', () => {
  assert.notEqual(
    buildDedupeKey({ ...KEY_PARTS, isoWeek: '2026-W34' }),
    buildDedupeKey(KEY_PARTS),
  );
});

test('parseDedupeKey: round-trips both shapes — this is how open findings suppress re-fires', () => {
  assert.deepEqual(parseDedupeKey(buildDedupeKey(KEY_PARTS)), {
    ...KEY_PARTS,
    lineSupplier: null,
  });
  const withAgent = { ...KEY_PARTS, lineSupplier: 'Botha Roodt & Kie' };
  assert.deepEqual(parseDedupeKey(buildDedupeKey(withAgent)), withAgent);
});

test('parseDedupeKey: refuses keys it cannot read rather than half-reading them', () => {
  assert.equal(parseDedupeKey(''), null);
  assert.equal(parseDedupeKey('price_watch:only:three'), null);
  assert.equal(parseDedupeKey('other_agent:a:b:2026-W33'), null);
  assert.equal(parseDedupeKey('price_watch::b:2026-W33'), null);
});

test('buildDedupeKey: a colon inside an agent name cannot break the key format', () => {
  const key = buildDedupeKey({ ...KEY_PARTS, lineSupplier: 'Weird:Agent' });
  assert.deepEqual(parseDedupeKey(key), { ...KEY_PARTS, lineSupplier: 'Weird Agent' });
});

// ---------------------------------------------------------------------------
// Env list parsing (the org allowlist / digest recipients)
// ---------------------------------------------------------------------------

test('parseEnvList: unset or empty means an EMPTY list, never "everything"', () => {
  assert.deepEqual(parseEnvList(undefined), []);
  assert.deepEqual(parseEnvList(null), []);
  assert.deepEqual(parseEnvList(''), []);
  assert.deepEqual(parseEnvList('   '), []);
  assert.deepEqual(parseEnvList(',,'), []);
});

test('parseEnvList: trims and drops blanks', () => {
  assert.deepEqual(parseEnvList('a, b ,,c '), ['a', 'b', 'c']);
});

// ---------------------------------------------------------------------------
// Dry run must be completely free of side effects
//
// REGRESSION TEST for the 2026-08-14 incident: a backfill believed to be a dry
// run wrote 56 pw_items and 115 pw_item_matches rows to production. The
// original smoke test asserted "0 writes" by COUNTING calls on a stub that
// happily accepted them — a stub that says yes can only ever prove the code
// took the path it happened to take that day. These tests use a stub that
// THROWS on every write method, so a leak cannot be counted and shrugged off:
// it fails the run.
// ---------------------------------------------------------------------------

interface StubTables {
  [table: string]: Record<string, unknown>[];
}

/** Chainable read-only Supabase stub. Every write method throws. */
function throwingStub(tables: StubTables): { client: unknown; writeAttempts: string[] } {
  const writeAttempts: string[] = [];
  const thrower = (table: string, method: string) => () => {
    writeAttempts.push(`${method} ${table}`);
    throw new Error(`stub: ${method} on ${table} must never be called`);
  };
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit', 'not', 'returns', 'maybeSingle']) {
        chain[m] = () => chain;
      }
      for (const m of ['insert', 'upsert', 'update', 'delete']) {
        chain[m] = thrower(table, m);
      }
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: tables[table] ?? [], error: null });
      return chain;
    },
  };
  return { client, writeAttempts };
}

/** A statement with one priced line, dated via summary.statement_date. */
function statementDoc(
  id: string,
  supplierId: string,
  statementDate: string,
  description: string,
  unitPrice: number,
): Record<string, unknown> {
  return {
    id,
    supplier_id: supplierId,
    document_type: 'statement',
    status: 'extracted',
    archived_at: null,
    created_at: `${statementDate}T08:00:00.000Z`,
    filename: `${id}.pdf`,
    extracted_data: {
      fields: [],
      summary: { statement_date: statementDate },
      line_items: [
        {
          description,
          quantity: '100',
          unit: 'kg',
          unit_price: String(unitPrice),
          weight: '1',
          total_kg: '100',
        },
      ],
    },
  };
}

/** Matcher stub: confidently picks the first shortlisted candidate, or proposes
 *  a new item when the shortlist is empty (mirroring a real "none of these"). */
const pickFirstCandidate = async (prompt: { system: string; user: string }): Promise<string> => {
  const payload = JSON.parse(prompt.user) as { candidates: { id: string }[] };
  const first = payload.candidates[0];
  return JSON.stringify(
    first
      ? { pw_item_id: first.id, confidence: 0.97, reason: 'same product' }
      : { pw_item_id: null, confidence: 0.4, reason: 'no candidates' },
  );
};

const cannedObservation = async () =>
  JSON.stringify({ observation: 'Canned observation.', recommended_action: 'Canned action.' });

test('runPriceWatch dry run: completes against a stub whose writes THROW, and reports planned counts', async () => {
  // Empty catalogue → every description is a new-item proposal, which is
  // exactly the write path that leaked in production.
  const { client, writeAttempts } = throwingStub({
    pw_items: [],
    suppliers: [{ id: 'sup-1', name: 'JHB Fresh Produce Market' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: [
      statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20),
      statementDoc('doc-2', 'sup-1', '2026-07-01', 'ONIONS BROWN', 12),
    ],
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    dryRun: true,
    matchCall: pickFirstCandidate,
    observeCall: cannedObservation,
  });

  assert.deepEqual(writeAttempts, [], 'a dry run must not call a single write method');
  assert.equal(summary.dryRun, true);
  // It still did the work and can say what it WOULD have done.
  assert.equal(summary.documentsSeen, 2);
  assert.equal(summary.linesSeen, 2);
  assert.equal(summary.itemsCreated, 2, 'two new items would be proposed');
  assert.equal(summary.reviewQueueAdds, 2);
  assert.equal(summary.linesAwaitingReview, 2, 'proposals are never price points');
  assert.equal(summary.pricePointsUpserted, 0);
});

test('runPriceWatch dry run: an auto-linkable catalogue plans points and findings without writing', async () => {
  // Four statements over 60+ days with a jump at the end: enough for detect.ts
  // to fire, so the findings write path is exercised too.
  const docs = [
    statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20),
    statementDoc('doc-2', 'sup-1', '2026-06-20', 'TOMATOES SALADETTE', 21),
    statementDoc('doc-3', 'sup-1', '2026-07-10', 'TOMATOES SALADETTE', 20),
    statementDoc('doc-4', 'sup-1', '2026-08-01', 'TOMATOES SALADETTE', 30),
  ];
  const { client, writeAttempts } = throwingStub({
    pw_items: [{ id: 'item-tom', name: 'Tomatoes Saladette', base_unit: 'kg' }],
    suppliers: [{ id: 'sup-1', name: 'JHB Fresh Produce Market' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: docs,
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    dryRun: true,
    matchCall: pickFirstCandidate,
    observeCall: cannedObservation,
  });

  assert.deepEqual(writeAttempts, [], 'a dry run must not call a single write method');
  assert.equal(summary.pricePointsUpserted, 4, 'four points would be written');
  assert.equal(summary.findingsDetected, 1);
  assert.equal(summary.findingsWritten, 1, 'reported as planned, not actually inserted');
  // The dry run uses the deterministic template rather than spending the
  // writing model, and says so.
  assert.equal(summary.observationFallbacks, 1);
  assert.ok(summary.sampleFindings[0].dedupeKey.startsWith('price_watch:sup-1:item-tom:'));
});

test('runPriceWatch dry run: in-memory proposals still converge two suppliers onto ONE item', async () => {
  // The pending-item logic keeps proposals in memory during a dry run. This
  // asserts they are still visible to the matcher, so the same new product
  // arriving from a second supplier does NOT propose a duplicate item — while
  // still refusing to auto-link to an item no human has confirmed.
  const { client, writeAttempts } = throwingStub({
    pw_items: [],
    suppliers: [
      { id: 'sup-1', name: 'Supplier One' },
      { id: 'sup-2', name: 'Supplier Two' },
    ],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: [
      statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20),
      statementDoc('doc-2', 'sup-2', '2026-06-02', 'TOMATOES SALADETTE', 21),
    ],
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    dryRun: true,
    matchCall: pickFirstCandidate,
    observeCall: cannedObservation,
  });

  assert.deepEqual(writeAttempts, []);
  assert.equal(summary.itemsCreated, 1, 'the second supplier reuses the in-memory proposal');
  assert.equal(summary.reviewQueueAdds, 2, 'but each supplier still gets its own review row');
  assert.equal(summary.pricePointsUpserted, 0, 'an unconfirmed item never yields price points');
});

// ---------------------------------------------------------------------------
// The normalization basis seam (2026-08-14 completion): normalizeLine's
// rejection reason reaching its own counter, basis threaded through to
// detection, content-level dedupe, and the total-model-outage warning.
// ---------------------------------------------------------------------------

test('runPriceWatch: a sub-kg pack with no plausible box grouping is parked, not guessed into a price', async () => {
  // 300g punnets, no units_per_box at all — normalizeLine cannot tell what a
  // "box" of these is, so this must be REJECTED ('sub_pack_unresolvable'),
  // never fall through to unit_price / weight (which is exactly how
  // "Lettuce R400/kg" got manufactured in the live backfill).
  const docWithUnresolvableLine = {
    id: 'doc-1',
    supplier_id: 'sup-1',
    document_type: 'invoice',
    status: 'extracted',
    archived_at: null,
    created_at: '2026-07-20T09:15:00.000Z',
    filename: 'invoice-1.pdf',
    extracted_data: {
      fields: [{ label: 'Invoice Date', value: '2026-07-20' }],
      line_items: [
        {
          description: 'STRAWBERRIES PUNNET',
          quantity: '5',
          unit: 'punnets',
          unit_price: '20',
          weight: '0.3',
          total_kg: '1.5',
          units_per_box: '',
        },
      ],
    },
  };

  const { client, writeAttempts } = throwingStub({
    pw_items: [{ id: 'item-straw', name: 'Strawberries', base_unit: 'kg' }],
    suppliers: [{ id: 'sup-1', name: 'Supplier One' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: [docWithUnresolvableLine],
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    dryRun: true,
    matchCall: pickFirstCandidate,
    observeCall: cannedObservation,
  });

  assert.deepEqual(writeAttempts, []);
  assert.equal(summary.linesSkippedUnnormalisable, 1);
  assert.equal(summary.linesSkippedNoPrice, 0, 'this is a distinct signal from "no price at all"');
  assert.equal(summary.pricePointsUpserted, 0);
});

test('runPriceWatch: content-identical points from two documents collapse to one before detection', async () => {
  const docs = [
    statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20),
    // Same purchase, re-printed on a second same-day statement — the exact
    // 2026-08-14 diagnosis case (54/381 live points were duplicates like this).
    statementDoc('doc-2', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20),
    statementDoc('doc-3', 'sup-1', '2026-07-10', 'TOMATOES SALADETTE', 21),
  ];
  const { client, writeAttempts } = throwingStub({
    pw_items: [{ id: 'item-tom', name: 'Tomatoes Saladette', base_unit: 'kg' }],
    suppliers: [{ id: 'sup-1', name: 'JHB Fresh Produce Market' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: docs,
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    dryRun: true,
    matchCall: pickFirstCandidate,
    observeCall: cannedObservation,
  });

  assert.deepEqual(writeAttempts, []);
  assert.equal(
    summary.pricePointsUpserted,
    3,
    'all three lines still count as planned writes — dedupe is only a detection-input concern',
  );
  assert.equal(
    summary.pointsDeduped,
    1,
    'the re-printed same-day duplicate collapses to one point before detection',
  );
  assert.equal(
    summary.detect.seriesBelowPointFloor,
    1,
    'two unique points is below the 3-point history floor once the duplicate is removed',
  );
  assert.equal(summary.findingsDetected, 0, 'a duplicate-inflated series must not manufacture a finding');
});

test('runPriceWatch: a total match-model outage is loudly warned about, even on a dry run', async () => {
  // Reproduces the 2026-08-14 incident shape: the injected call always throws
  // (an unresolvable import outside Next's bundler). A dry run still calls the
  // MATCHER for real for a genuinely new description — only the write of its
  // result and the separate observe call are skipped — so the outage must be
  // visible here, not hidden behind "well, it was only a dry run".
  const alwaysThrows = async (): Promise<string> => {
    throw new Error("Cannot find module '@/lib/ai/anthropic'");
  };
  const { client, writeAttempts } = throwingStub({
    pw_items: [{ id: 'item-tom', name: 'Tomatoes Saladette', base_unit: 'kg' }],
    suppliers: [{ id: 'sup-1', name: 'JHB Fresh Produce Market' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: [statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20)],
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    dryRun: true,
    matchCall: alwaysThrows,
    observeCall: cannedObservation,
  });

  assert.deepEqual(writeAttempts, []);
  assert.equal(summary.matchModelCalls, 1);
  assert.equal(summary.matchModelFailures, 1);
  assert.equal(summary.modelOutage, true);
  assert.ok(
    summary.warnings.some((w) => w.includes('model outage')),
    'a total outage must be a loud, specific warning, not just a silent counter nobody reads',
  );
});

test('runPriceWatch: with no matchCall/observeCall injected at all, the built-in missingModelCall default reproduces the same loud outage', async () => {
  // This IS the 2026-08-14 regression shape: a caller (the cron route, the
  // backfill CLI) that forgets to pass matchCall/observeCall must fail exactly
  // like a real transport outage — loud and counted — not throw uncaught or,
  // worse, look like a quiet zero-findings run.
  const { client, writeAttempts } = throwingStub({
    pw_items: [{ id: 'item-tom', name: 'Tomatoes Saladette', base_unit: 'kg' }],
    suppliers: [{ id: 'sup-1', name: 'JHB Fresh Produce Market' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: [statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20)],
  });

  const summary = await runPriceWatch(client as never, 'org-1', { dryRun: true });

  assert.deepEqual(writeAttempts, []);
  assert.equal(summary.matchModelCalls, 1);
  assert.equal(summary.matchModelFailures, 1);
  assert.equal(summary.modelOutage, true);
  assert.ok(
    summary.warnings.some((w) => w.includes('model outage')),
    'omitting the injection must be exactly as loud as a real transport outage',
  );
});

test('readOnlyClient: every write method throws, reads pass through', async () => {
  const { client } = throwingStub({ pw_items: [{ id: 'x' }] });
  const guarded = readOnlyClient(client as never);

  for (const method of ['insert', 'upsert', 'update', 'delete'] as const) {
    assert.throws(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (guarded.from('pw_items') as any)[method]({}),
      /dry run attempted to/,
      `${method} must be blocked before it reaches the database`,
    );
  }
  // A read still works through the guard.
  const { data } = await guarded.from('pw_items').select('id');
  assert.deepEqual(data, [{ id: 'x' }]);
});

// ---------------------------------------------------------------------------
// The pw_price_points write payload
//
// REGRESSION TEST for the 2026-08-17 Meridian cron run: 0 points upserted, 49
// errors, "Could not find the 'basis' column of 'pw_price_points' in the schema
// cache". PricePointDraft deliberately carries `basis`/`packsPerBox` for
// detect.ts's series-consistency gate, and the write loop handed the draft
// straight to PostgREST, so those in-memory-only keys were sent as columns.
// The expected list below is derived BY HAND from the DDL in
// `supabase/agents-price-watch.sql` (the `create table pw_price_points (...)`
// block plus its `alter table … add column if not exists line_supplier` upgrade
// line), minus `id` and `created_at`, which have defaults and are never sent.
// If a column is genuinely added to that table, this list changes with it —
// which is the point: the payload can no longer drift from the schema silently.
// ---------------------------------------------------------------------------

const PW_PRICE_POINT_DDL_COLUMNS = [
  'org_id',
  'supplier_id',
  'pw_item_id',
  'line_supplier',
  'document_id',
  'line_index',
  'unit_price',
  'quantity_base',
  'invoice_date',
];

/** Chainable stub that ACCEPTS writes and records each payload by table. */
function recordingStub(tables: StubTables): {
  client: unknown;
  upserts: { table: string; rows: Record<string, unknown>[] }[];
} {
  const upserts: { table: string; rows: Record<string, unknown>[] }[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit', 'not', 'returns', 'maybeSingle']) {
        chain[m] = () => chain;
      }
      chain.insert = () => ({ then: (r: (v: unknown) => void) => r({ data: null, error: null }) });
      chain.upsert = (rows: Record<string, unknown>[]) => {
        upserts.push({ table, rows });
        return { then: (r: (v: unknown) => void) => r({ data: null, error: null }) };
      };
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: tables[table] ?? [], error: null });
      return chain;
    },
  };
  return { client, upserts };
}

test('runPriceWatch: upserted pw_price_points rows carry EXACTLY the DDL columns', async () => {
  const docs = [
    statementDoc('doc-1', 'sup-1', '2026-06-01', 'TOMATOES SALADETTE', 20),
    statementDoc('doc-2', 'sup-1', '2026-07-01', 'TOMATOES SALADETTE', 21),
  ];
  const { client, upserts } = recordingStub({
    pw_items: [{ id: 'item-tom', name: 'Tomatoes Saladette', base_unit: 'kg' }],
    suppliers: [{ id: 'sup-1', name: 'JHB Fresh Produce Market' }],
    pw_item_matches: [],
    pw_price_points: [],
    agent_findings: [],
    documents: docs,
  });

  const summary = await runPriceWatch(client as never, 'org-1', {
    matchCall: pickFirstCandidate,
    observeCall: cannedObservation,
  });

  assert.equal(summary.pricePointErrors, 0, 'the schema-cache failure must not recur');
  assert.equal(summary.pricePointsUpserted, 2);

  const pointRows = upserts
    .filter((u) => u.table === 'pw_price_points')
    .flatMap((u) => u.rows);
  assert.equal(pointRows.length, 2, 'both price points reached the write');

  for (const row of pointRows) {
    assert.deepEqual(
      Object.keys(row).sort(),
      [...PW_PRICE_POINT_DDL_COLUMNS].sort(),
      'the row must contain every DDL column and nothing else — no basis, no packsPerBox',
    );
  }
});
