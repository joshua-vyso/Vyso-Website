import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceOrderExtraction } from '../lib/ai/order-prompt.ts';
import { applyRowArithmeticToLines } from '../lib/platform/docu/row-arithmetic.ts';
import { buildReviewLines, attachRecords } from '../lib/platform/docu/order-review-lines.ts';
import { syncOrderFromDocument } from '../lib/platform/orderflow-from-doc.ts';
import type { OrderLineRecord } from '../lib/platform/docu/order-line-match.ts';
import type { DocuExtractedData } from '../lib/platform/docu/types.ts';

// ---------------------------------------------------------------------------
// AN UNTYPED UPLOAD MUST COME OUT OF THE ORDER LANE WITH `order_lines` ON IT.
//
// On 23 Aug 2026 a Bakubung purchase order dropped into the chat reached the
// review screen with 22 correct line items, the right customer, the right
// reader stamp — and not one annotation: no "Paper said … → not matched", no
// learned-link chip, no price provenance. Every one of those is rendered from
// `extracted_data.order_lines`, which only `syncOrderFromDocument` writes, and
// that call had been killed by the route's 60s budget after the third of its
// three sequential model calls. The document looked perfectly matched because a
// row with no record renders exactly like a row that matched.
//
// `docu-order-review-lines.test.ts` walks a real model response as far as the
// editor's opening rows and stops there, which is precisely why it stayed green
// through this: it never asks whether anything wrote the provenance those rows
// are supposed to carry. This file continues that walk THROUGH THE SYNC — the
// same function `/api/ai/extract` calls, on the same persisted `extracted_data`
// — and asserts that what comes out the other end pairs onto every row.
//
// The database is a fake. The matcher, the pricer, the record builder and the
// pairing are all the real thing.
// ---------------------------------------------------------------------------

/* -------------------------------------------------------------------------
 * A minimal PostgREST-shaped fake: chainable, thenable, filters on `eq`/`in`.
 * Enough for `syncOrderFromDocument` and deliberately no more — anything it
 * cannot answer returns empty, which is how the real client behaves for a
 * table an org has nothing in.
 * ---------------------------------------------------------------------- */
type Row = Record<string, unknown>;

interface UpdateCall {
  table: string;
  payload: Row;
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  updates: UpdateCall[] = [];
  private seq = 0;

  constructor(seed: Record<string, Row[]>) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map((r) => ({ ...r }));
  }

  rows(table: string): Row[] {
    this.tables[table] ??= [];
    return this.tables[table];
  }

  nextId(): string {
    this.seq += 1;
    return `id-${this.seq}`;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc() {
    return { data: 'INV-TEST-1', error: null };
  }
}

class FakeQuery {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] = {};
  private filters: [string, unknown][] = [];
  private ins: [string, unknown[]] | null = null;

  private db: FakeDb;
  private table: string;

  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }

  select() {
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.ins = [col, vals];
    return this;
  }
  not() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  returns() {
    return this;
  }

  private matched(): Row[] {
    return this.db.rows(this.table).filter(
      (r) =>
        this.filters.every(([c, v]) => r[c] === v) &&
        (!this.ins || this.ins[1].includes(r[this.ins[0]])),
    );
  }

  private run(): { data: Row[]; error: null } {
    if (this.op === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) => ({
        id: this.db.nextId(),
        ...r,
      }));
      this.db.rows(this.table).push(...rows);
      return { data: rows, error: null };
    }
    if (this.op === 'update') {
      this.db.updates.push({ table: this.table, payload: this.payload as Row });
      const hit = this.matched();
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit, error: null };
    }
    if (this.op === 'delete') {
      const keep = this.db.rows(this.table).filter((r) => !this.filters.every(([c, v]) => r[c] === v));
      this.db.tables[this.table] = keep;
      return { data: [], error: null };
    }
    return { data: this.matched(), error: null };
  }

  async maybeSingle() {
    const { data } = this.run();
    return { data: data[0] ?? null, error: null };
  }
  async single() {
    const { data } = this.run();
    return data[0]
      ? { data: data[0], error: null }
      : { data: null, error: { message: 'no rows' } };
  }
  then<A, B>(
    onFulfilled?: ((v: { data: Row[]; error: null }) => A | PromiseLike<A>) | null,
    onRejected?: ((r: unknown) => B | PromiseLike<B>) | null,
  ) {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

/* -------------------------------------------------------------------------
 * The reader's own output — the same excerpt `docu-order-review-lines.test.ts`
 * uses, because it is a verbatim bench response rather than a fixture written
 * to agree with us.
 * ---------------------------------------------------------------------- */
const READER_RESPONSE = JSON.stringify({
  customer_name: 'Bakubung Bush Lodge',
  customer_confidence: 92,
  line_items: [
    {
      raw_description: 'FF - APPLES TOP RED BOX',
      description: 'Apples Top Red',
      quantity: '1', unit: 'Box', bulk_quantity: '1', bulk_unit: 'Box',
      unit_quantity: '', unit_price: '569.90', raw_amount: '569.90', confidence: 88,
    },
    {
      raw_description: 'FF - AVOCADO BOX',
      description: 'Avocado',
      quantity: '4', unit: 'Box', bulk_quantity: '4', bulk_unit: 'Box',
      unit_quantity: '48', unit_price: '15.75', raw_amount: '756.00', confidence: 85,
    },
    {
      raw_description: 'VEG - MIX VEGETABLES PACK',
      description: 'Mix Vegetables',
      quantity: '20', unit: 'Pack', bulk_quantity: '20', bulk_unit: 'Pack',
      unit_quantity: '', unit_price: '66.90', raw_amount: '1338.00', confidence: 80,
    },
  ],
  overall_confidence: 84,
});

const ORG = 'org-1';
const DOC = 'doc-1';

/**
 * Everything `/api/ai/extract` persists to `extracted_data` on the order branch,
 * built the way the route builds it: the reader's coercion, the row arithmetic
 * its provider wrapper applies, and nothing else. Note what is NOT here —
 * `order_lines`. The route writes this first and the sync adds them after.
 */
function persistedByExtraction(): DocuExtractedData {
  const extraction = coerceOrderExtraction(READER_RESPONSE);
  return {
    fields: [],
    line_items: applyRowArithmeticToLines(extraction.line_items),
    customer_name: extraction.customer_name,
    customer_confidence: extraction.customer_confidence,
    extraction_model: 'anthropic/claude-sonnet-4-6',
  };
}

function seededDb(extracted: DocuExtractedData): FakeDb {
  return new FakeDb({
    // `document_type` is seeded because `syncOrderFromDocument` now reads it and
    // refuses any row that is not an order — its own last line of defence, added
    // with the financial-document lane. The fixture always MEANT an order; it
    // simply never had to say so while nothing asked.
    documents: [{ id: DOC, org_id: ORG, document_type: 'order', extracted_data: extracted }],
    of_orders: [],
    of_order_items: [],
    of_customers: [],
    pp_stock_items: [
      { id: 'sku-apple', org_id: ORG, name: 'Apples Top Red', unit: 'box', avg_unit_price: 560, on_hand: 0 },
      { id: 'sku-avo', org_id: ORG, name: 'Avocado', unit: 'box', avg_unit_price: 15, on_hand: 0 },
    ],
    pl_price_lists: [],
    pl_overrides: [],
    cd_customer_item_aliases: [],
    pp_movements: [],
    of_invoices: [],
    of_invoice_items: [],
    of_settings: [],
  });
}

/** The `documents.extracted_data` the sync wrote back, if it wrote one. */
function writtenOrderLines(db: FakeDb): OrderLineRecord[] | null {
  const call = db.updates
    .filter((u) => u.table === 'documents' && u.payload.extracted_data)
    .pop();
  if (!call) return null;
  return ((call.payload.extracted_data as DocuExtractedData).order_lines ?? null) as OrderLineRecord[] | null;
}

/* ------------------------------------------------------------------ tests */

test('the order lane writes one order_lines record per paper row', async () => {
  const extracted = persistedByExtraction();
  const db = seededDb(extracted);

  // The matching agent is injected and returns nothing, so every verdict below
  // is the deterministic matcher's. In production this is one network call; the
  // point of the seam is that the audit trail does not depend on it.
  const result = await syncOrderFromDocument(db as never, {
    documentId: DOC,
    orgId: ORG,
    matchAgent: async () => [],
  });

  assert.equal(result.ok, true);
  const records = writtenOrderLines(db);
  assert.ok(records, 'the sync never wrote extracted_data.order_lines — this is the bug');
  assert.equal(records.length, (extracted.line_items ?? []).length);
});

test('every record carries the fields the review screen renders', async () => {
  const extracted = persistedByExtraction();
  const db = seededDb(extracted);
  await syncOrderFromDocument(db as never, { documentId: DOC, orgId: ORG, matchAgent: async () => [] });

  const records = writtenOrderLines(db)!;
  for (const r of records) {
    // The paper's words — the "Paper said …" half of every annotation.
    assert.equal(typeof r.raw_description, 'string');
    assert.ok(r.raw_description.length > 0);
    // Why it matched or did not — the amber bubble's sentence.
    assert.equal(typeof r.match_reason, 'string');
    // Where the price came from — "Priced from your price list" / "Price read
    // off the document". A record without this renders a row with no provenance
    // line at all, which is the state that looks like a feature nobody built.
    assert.ok(['document', 'price_list', 'custom', 'base', 'none'].includes(r.price_source));
    assert.equal(typeof r.matched, 'boolean');
  }
});

test('the records pair onto every row the editor opens with', async () => {
  const extracted = persistedByExtraction();
  const db = seededDb(extracted);
  await syncOrderFromDocument(db as never, { documentId: DOC, orgId: ORG, matchAgent: async () => [] });
  const records = writtenOrderLines(db)!;

  // THE JOIN, END TO END. `buildReviewLines` pairs by the paper's own words, so
  // the two sides only meet if the sync stored the raw name VERBATIM — no
  // prefix strip, no normalisation. `strip_order_prefixes` defaults on for a
  // known customer (and this document creates one), so a sync that stored the
  // stripped name would silently un-annotate every prefixed line — which is
  // every line on a Turn 'n Slice order.
  let n = 0;
  const rows = buildReviewLines({ ...extracted, order_lines: records }, () => `k${n++}`);
  assert.equal(rows.length, (extracted.line_items ?? []).length);
  for (const row of rows) {
    assert.ok(row.record, `no record paired onto "${row.raw}"`);
    assert.equal(row.record.raw_description, row.raw);
  }
});

test('no order_lines means every row opens unannotated — the state the banner exists for', () => {
  const extracted = persistedByExtraction();
  let n = 0;
  const rows = buildReviewLines(extracted, () => `k${n++}`);
  assert.equal(rows.length, (extracted.line_items ?? []).length);
  // Exactly what the live document showed: perfect rows, zero provenance. The
  // editor's `noMatchPass` is this predicate.
  assert.equal(rows.some((r) => r.record), false);
});

test('attachRecords re-pairs onto edited rows without disturbing the edits', () => {
  const rows = [
    { raw: 'FF - AVOCADO BOX', description: 'Avocado — reviewer typed this', record: null as OrderLineRecord | null },
    { raw: 'VEG - MIX VEGETABLES PACK', description: 'Mix Vegetables', record: null as OrderLineRecord | null },
  ];
  const records = [
    { raw_description: 'VEG - MIX VEGETABLES PACK', name: 'Mixed Veg', matched: true } as OrderLineRecord,
  ];
  const out = attachRecords(rows, records);
  assert.equal(out[0].record, null);
  assert.equal(out[0].description, 'Avocado — reviewer typed this');
  assert.equal(out[1].record?.name, 'Mixed Veg');
  // A row whose paper text matches nothing keeps whatever it had: a partial
  // write can add annotations, never strip them.
  const again = attachRecords(out, []);
  assert.equal(again[1].record?.name, 'Mixed Veg');
});

/* ===========================================================================
 * CUSTOMER-SCOPED CONDITIONAL UOM RULES — END TO END THROUGH THE REAL SYNC.
 *
 * `tests/docu-customer-uom-rules.test.ts` proves the pure module in isolation.
 * This block proves the WIRING: that `syncOrderFromDocument` actually loads
 * `cd_customer_uom_rules`, evaluates it in the stated precedence order against
 * the paper's own printed unit, and writes the result onto the record the
 * review screen reads — using the same fake Postgres harness (and the same
 * "a record with no annotation looks exactly like a perfectly matched line"
 * stakes) as the rest of this file.
 *
 * Ground truth: Capital's real PO POPAR-0017754.
 * ========================================================================= */

const CAP_ORG = 'org-capital';
const CAP_DOC = 'doc-capital';
const CAPITAL = 'cust-capital';

/** Capital's real ruling: printed KG + description says "punnet" → punnet. */
function punnetRule(id: string, targetUnit = 'punnet') {
  return {
    id,
    org_id: CAP_ORG,
    customer_id: CAPITAL,
    match_kind: 'token',
    description_condition: 'punnet',
    printed_unit: 'kg',
    target_unit: targetUnit,
    active: true,
  };
}

function capitalExtracted(lineItems: Record<string, unknown>[]): DocuExtractedData {
  return {
    fields: [],
    customer_name: 'Capital',
    customer_confidence: 100,
    line_items: lineItems as never,
  };
}

/** A FakeDb seeded for Capital, with whatever `cd_customer_uom_rules` /
 *  `cd_customer_item_aliases` rows a test wants. Both tables are omitted from
 *  the seed unless a test passes rows for them — a table this seed never
 *  mentions is exactly the "migration not run yet" case the fake reproduces
 *  the same way real Postgres would: nothing to read, no rows, no crash. */
function seededCapitalDb(
  extracted: DocuExtractedData,
  opts: { uomRules?: Record<string, unknown>[]; aliases?: Record<string, unknown>[] } = {},
): FakeDb {
  return new FakeDb({
    // See the note on the fixture above: an order document must now say it is one.
    documents: [{ id: CAP_DOC, org_id: CAP_ORG, document_type: 'order', extracted_data: extracted }],
    of_orders: [],
    of_order_items: [],
    of_customers: [{ id: CAPITAL, org_id: CAP_ORG, name: 'Capital' }],
    pp_stock_items: [],
    pl_price_lists: [],
    pl_overrides: [],
    cd_customer_item_aliases: opts.aliases ?? [],
    cd_customer_uom_rules: opts.uomRules ?? [],
    pp_movements: [],
    of_invoices: [],
    of_invoice_items: [],
    of_settings: [],
  });
}

async function syncCapital(db: FakeDb): Promise<OrderLineRecord[]> {
  const result = await syncOrderFromDocument(db as never, {
    documentId: CAP_DOC,
    orgId: CAP_ORG,
    customerId: CAPITAL, // explicit, like a reviewer's pick — deterministic in a test
    matchAgent: async () => [],
  });
  assert.equal(result.ok, true, `sync failed: ${JSON.stringify(result)}`);
  const records = writtenOrderLines(db);
  assert.ok(records, 'sync did not write extracted_data.order_lines');
  return records!;
}

test('UOM: a token rule applies — punnet, rule id recorded, KG preserved as the source unit', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, { uomRules: [punnetRule('rule-punnet')] });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, 'rule-punnet');
  assert.equal(record.uom_rule_count, 1);
  assert.equal(record.uom_source_unit, 'KG'); // the paper's own printed unit, verbatim
  assert.equal(record.uom_target_unit, 'punnet');
  assert.equal(record.uom_conflict_rule_ids, undefined);
  assert.equal(record.raw_description, 'Grapes Black Punnet'); // untouched

  // The actual billed unit lives on `of_order_items`, not the audit record —
  // confirm the sync wrote the rule's target there too.
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'punnet');

  // SOURCE PRESERVATION: the document's own extracted_data.line_items — what
  // the paper said — is never rewritten by this pass. Only order_lines (the
  // audit trail) and of_order_items (the billed values) change.
  const doc = db.rows('documents')[0] as { extracted_data: DocuExtractedData };
  assert.equal((doc.extracted_data.line_items as { unit: string }[])[0].unit, 'KG');
});

test('UOM: "Cucumber English kg" printed BOX — wrong printed unit, no token, unit stays', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Cucumber English kg', description: 'Cucumber English kg', quantity: '3', unit: 'BOX', unit_price: '18.50' },
  ]);
  const db = seededCapitalDb(extracted, { uomRules: [punnetRule('rule-punnet')] });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, undefined);
  assert.equal(record.uom_source_unit, undefined);
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'BOX');
});

test('UOM: a genuine KG line with no packaging token stays kg', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Loose Tomatoes', description: 'Loose Tomatoes', quantity: '10', unit: 'KG', unit_price: '12.00' },
  ]);
  const db = seededCapitalDb(extracted, { uomRules: [punnetRule('rule-punnet')] });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, undefined);
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'KG');
});

test('UOM: a different customer\'s identical rule set never applies — the scope, enforced end to end', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  // The rule row names a DIFFERENT customer_id than the one this sync resolves
  // to — indexUomRulesForCustomer must drop it, exactly like the alias case.
  const db = seededCapitalDb(extracted, {
    uomRules: [{ ...punnetRule('rule-punnet'), customer_id: 'cust-someone-else' }],
  });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, undefined);
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'KG');
});

test('UOM: exact_description beats a token rule on the same line', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, {
    uomRules: [
      punnetRule('rule-token'),
      {
        id: 'rule-exact',
        org_id: CAP_ORG,
        customer_id: CAPITAL,
        match_kind: 'exact_description',
        description_condition: 'grapes black punnet',
        printed_unit: 'kg',
        target_unit: 'tray', // deliberately disagrees with the token rule
        active: true,
      },
    ],
  });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, 'rule-exact');
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'tray');
});

test('UOM: RIDER 2 — two same-tier rules disagreeing is a conflict, printed unit kept, no tiebreak', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, {
    uomRules: [punnetRule('rule-a', 'punnet'), punnetRule('rule-b', 'tray')],
  });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, undefined, 'a conflict must never silently pick a winner');
  assert.deepEqual(new Set(record.uom_conflict_rule_ids ?? []), new Set(['rule-a', 'rule-b']));
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'KG', 'the line keeps the printed unit on a conflict');
});

test('UOM: two matching rules agreeing on the target apply, with a count of 2', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, {
    uomRules: [punnetRule('rule-a', 'punnet'), punnetRule('rule-b', 'punnet')],
  });
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_count, 2);
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'punnet');
});

test('UOM: an exact-alias unit stays supreme over a matching UOM rule', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, {
    uomRules: [punnetRule('rule-punnet')],
    aliases: [
      {
        org_id: CAP_ORG,
        customer_id: CAPITAL,
        raw_name: 'Grapes Black Punnet',
        stock_item_id: null,
        invoice_name: null,
        unit: 'each', // a human's ruling on THIS exact line text
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ],
  });
  const [record] = await syncCapital(db);

  // Precedence 1 wins outright — the rule never even gets credited, because it
  // was never the reason the unit is what it is.
  assert.equal(record.uom_rule_id, undefined);
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'each');
});

/* ---------------------------------------------------------------------------
 * PRODUCT-RULE GAP CHECK (plan_customer_uom_rules.md §6): not a UOM-rule test
 * — cd_customer_item_aliases is untouched by this change — but the plan asks
 * it be covered if it is not already, and no existing suite asserted this
 * particular invariant: an alias whose pin does not resolve to a real
 * catalogue row (a bad `stock_item_id`, or one typed on the settings screen
 * for a product since deleted) must NOT fall through to CREATE-ON-UPLOAD and
 * mint a new product. An alias is a human's ruling that this text means A
 * SPECIFIC existing product; when that product is gone, the honest answer is
 * "unresolved", never "close enough — make a new one".
 * ------------------------------------------------------------------------- */
test('an alias pin that resolves to nothing does not fall through to CREATE-ON-UPLOAD', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, {
    aliases: [
      {
        org_id: CAP_ORG,
        customer_id: CAPITAL,
        raw_name: 'Grapes Black Punnet',
        // Points at a catalogue row that does not exist — pp_stock_items is
        // empty in this fixture, standing in for "since deleted".
        stock_item_id: 'sku-long-gone',
        invoice_name: null,
        unit: null,
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ],
  });
  const before = db.rows('pp_stock_items').length;
  const [record] = await syncCapital(db);

  assert.equal(record.matched, false, 'a dangling pin is not a match — there is no product to claim');
  assert.equal(db.rows('pp_stock_items').length, before, 'no new product was minted for an aliased line');
});

test('UOM: cd_customer_uom_rules missing entirely (pre-migration) degrades to "no rules", never crashes', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  // No `uomRules` key at all — the table is never seeded, standing in for a
  // deploy that hasn't pasted supabase/customer-uom-rules.sql yet.
  const db = seededCapitalDb(extracted);
  const [record] = await syncCapital(db);

  assert.equal(record.uom_rule_id, undefined);
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'KG');
});

/* ===========================================================================
 * AUDIT CARRY-FORWARD — the two-pass confirm round-trip, end to end.
 *
 * `docu-customer-uom-rules.test.ts` proves `carryForwardUomAudit` in
 * isolation. This is the WIRING proof: a SECOND real `syncOrderFromDocument`
 * pass, run against the document exactly as `confirm()`'s review-save leaves
 * it (the interpreted unit written into `extracted_data.line_items[].unit`),
 * still carries the first pass's rule provenance onto the FINAL record —
 * which is the one thing the addendum follow-up exists to fix.
 * ========================================================================= */

test('AUDIT CARRY-FORWARD: the finalise pass still carries uom_rule_id after the review-save round-trip', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, { uomRules: [punnetRule('rule-punnet')] });

  // PASS 1 — the first sync, right after upload. The rule applies normally;
  // this is the same behaviour `docu-order-annotations.test.ts`'s earlier
  // "a token rule applies" test already covers.
  const [pass1] = await syncCapital(db);
  assert.equal(pass1.uom_rule_id, 'rule-punnet');
  assert.equal(pass1.uom_source_unit, 'KG');
  assert.equal(pass1.uom_target_unit, 'punnet');

  // SIMULATE THE REVIEW-SAVE (ADDENDUM 4b): the dropdown opened on "punnet"
  // (the interpreted unit), the reviewer left it there, and `confirm()`
  // writes exactly that back into `extracted_data.line_items[].unit` — never
  // touching `order_lines`, which still holds pass 1's record at this point.
  const doc = db.rows('documents')[0] as { extracted_data: DocuExtractedData };
  (doc.extracted_data.line_items as { unit: string }[])[0].unit = 'punnet';

  // PASS 2 — the finalise sync `/api/orderflow/order-from-document` triggers.
  // The rule's OWN condition (printed_unit: "kg") no longer matches — the
  // printed unit is "punnet" now — so without carry-forward this record
  // would come back with no uom_rule_id at all: the exact bug this closes.
  const [pass2] = await syncCapital(db);
  assert.equal(pass2.uom_rule_id, 'rule-punnet', 'the rule claim survives the finalise pass');
  assert.equal(pass2.uom_rule_count, 1);
  // The ORIGINAL printed value — never overwritten to agree with the new
  // "printed" text just because that's what line_items now says.
  assert.equal(pass2.uom_source_unit, 'KG');
  assert.equal(pass2.uom_target_unit, 'punnet');
  assert.equal(pass2.uom_conflict_rule_ids, undefined);

  // And the line still bills correctly, via precedence tier 3 this time
  // (docUnit is already "punnet"), not tier 2 — same result, different path.
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'punnet');
});

test('AUDIT CARRY-FORWARD: a reviewer override to a THIRD unit is never claimed by the old rule', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
  ]);
  const db = seededCapitalDb(extracted, { uomRules: [punnetRule('rule-punnet')] });

  const [pass1] = await syncCapital(db);
  assert.equal(pass1.uom_rule_id, 'rule-punnet');

  // The reviewer did NOT leave the dropdown on "punnet" — they changed it to
  // "tray" (a deliberate override, e.g. via the [Update rule → tray] flow, or
  // simply picking a different unit and never confirming that suggestion).
  const doc = db.rows('documents')[0] as { extracted_data: DocuExtractedData };
  (doc.extracted_data.line_items as { unit: string }[])[0].unit = 'tray';

  const [pass2] = await syncCapital(db);
  assert.equal(pass2.uom_rule_id, undefined, 'an override must never be re-claimed by the rule it overrode');
  assert.equal(pass2.uom_source_unit, undefined);
  assert.equal(pass2.uom_target_unit, undefined);

  // The override itself still bills correctly — this test is about the
  // AUDIT trail, not the unit actually charged.
  const items = db.rows('of_order_items');
  assert.equal(items[0]?.unit, 'tray');
});

test('AUDIT CARRY-FORWARD: duplicate raw_description lines pair against their OWN prior record on re-sync', async () => {
  const extracted = capitalExtracted([
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', unit_price: '25.00' },
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '3', unit: 'KG', unit_price: '25.00' },
  ]);
  // Two DIFFERENT rules could in principle disagree, but here both lines are
  // governed by the same rule — the point is that BOTH survive the round
  // trip independently, not that they cross-contaminate.
  const db = seededCapitalDb(extracted, { uomRules: [punnetRule('rule-punnet')] });

  const pass1 = await syncCapital(db);
  assert.equal(pass1.length, 2);
  assert.ok(pass1.every((r) => r.uom_rule_id === 'rule-punnet'));

  const doc = db.rows('documents')[0] as { extracted_data: DocuExtractedData };
  for (const li of doc.extracted_data.line_items as { unit: string }[]) li.unit = 'punnet';

  const pass2 = await syncCapital(db);
  assert.equal(pass2.length, 2);
  assert.ok(pass2.every((r) => r.uom_rule_id === 'rule-punnet'), 'both duplicate lines carried forward independently');
  assert.ok(pass2.every((r) => r.uom_source_unit === 'KG'));
});
