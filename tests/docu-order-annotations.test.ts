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
    documents: [{ id: DOC, org_id: ORG, extracted_data: extracted }],
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
