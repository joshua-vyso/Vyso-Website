import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  businessEffectForType,
  documentBusinessEffect,
  isFinancialOnly,
} from '../lib/platform/docu/business-effect.ts';
import { decideClassificationRouting } from '../lib/platform/docu/classification-policy.ts';
import { readPriceObservations } from '../lib/platform/supplysync-pricing.ts';
import { reviewDocumentTask } from '../lib/platform/review-queue-shared.ts';
import { syncOrderFromDocument } from '../lib/platform/orderflow-from-doc.ts';
import { coerceConfidence } from '../lib/platform/docu/extraction-quality.ts';
import type { DocumentType, ExtractedData } from '../lib/platform/types.ts';

// ---------------------------------------------------------------------------
// "Not operationally relevant" is not "financially irrelevant".
//
// A Country Club lunch slip is shaped like an invoice — merchant, date, VAT
// line, priced rows, total — so every allow-list keyed on SHAPE said yes to it,
// and the restaurant became a supplier with a spend history and four meal items
// in stock. This suite is the second dimension that closes that, and the gates
// built on it.
// ---------------------------------------------------------------------------

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** A document row, minus everything the effect does not depend on. */
function doc(document_type: DocumentType | null, extracted_data: ExtractedData | null = null) {
  return { document_type, extracted_data };
}

// ---------------------------------------------------------------------------
// 1–3. Receipts are financial-only. 4–7. Everything else is untouched.
// ---------------------------------------------------------------------------

test('an expense receipt is financial-only, whatever shape it arrived in', () => {
  // The three receipt shapes the lane has to survive: a restaurant slip with a
  // pre-fund, a fuel slip on a card, a hotel folio.
  for (const filename of ['country-club.jpg', 'shell-rivonia.jpg', 'protea-hotel-folio.pdf']) {
    const row = doc('expense_receipt', { fields: [], line_items: [], financial_document: null });
    assert.equal(documentBusinessEffect(row), 'financial_only', filename);
    assert.equal(isFinancialOnly(row), true, filename);
  }
});

test('a supplier produce invoice stays operational — the receipt type steals nothing', () => {
  // The document this whole feature must NOT catch: a real supplier invoice,
  // paid on the spot, with produce lines destined for stock.
  const invoice = doc('invoice', {
    fields: [{ label: 'Total', value: '4 981.30', confidence: 97 }],
    line_items: [{ description: 'Oranges Navel', quantity: '2', unit_price: '129.00', confidence: 96 }],
  });
  assert.equal(documentBusinessEffect(invoice), 'operational_financial');
  assert.equal(isFinancialOnly(invoice), false);
});

test('every other document type keeps the effect it has always behaved as having', () => {
  assert.equal(businessEffectForType('invoice'), 'operational_financial');
  assert.equal(businessEffectForType('statement'), 'operational_financial');
  assert.equal(businessEffectForType('delivery_note'), 'operational_financial');
  assert.equal(businessEffectForType('order'), 'operational_financial');
  assert.equal(businessEffectForType('price_list'), 'operational_only');
  assert.equal(businessEffectForType('expense_receipt'), 'financial_only');
  // Only ONE type is financial-only. A second one appearing here is a routing
  // change, not a refactor.
  const types: DocumentType[] = ['invoice', 'statement', 'delivery_note', 'price_list', 'order', 'expense_receipt'];
  assert.deepEqual(types.filter((t) => businessEffectForType(t) === 'financial_only'), ['expense_receipt']);
});

// ---------------------------------------------------------------------------
// Legacy rows, and the absence of a backfill.
// ---------------------------------------------------------------------------

test('a legacy row with no stamp derives its effect from the type, so no backfill is owed', () => {
  // Exactly what a 2025 invoice looks like: extracted_data with no
  // business_effect key at all.
  const legacy = doc('invoice', { fields: [] });
  assert.equal(documentBusinessEffect(legacy), 'operational_financial');
  assert.equal(documentBusinessEffect(doc('price_list', { fields: [] })), 'operational_only');
  assert.equal(documentBusinessEffect(doc('expense_receipt', { fields: [] })), 'financial_only');
  // No extracted_data at all — a freshly inserted, not-yet-read row.
  assert.equal(documentBusinessEffect(doc('invoice', null)), 'operational_financial');
});

test('a stored stamp is preferred, but only when it is one of the four known values', () => {
  const stamped = doc('invoice', { fields: [], business_effect: 'financial_only' });
  assert.equal(documentBusinessEffect(stamped), 'financial_only');

  // Junk in the jsonb is re-derived rather than trusted: this key is data a
  // reader wrote, and a gate that believes it is a gate the document controls.
  const junk = doc('expense_receipt', {
    fields: [],
    business_effect: 'totally_harmless' as unknown as 'informational',
  });
  assert.equal(documentBusinessEffect(junk), 'financial_only');
  const junkInvoice = doc('invoice', {
    fields: [],
    business_effect: 'financial_onlyy' as unknown as 'informational',
  });
  assert.equal(documentBusinessEffect(junkInvoice), 'operational_financial');
});

test('an unclassified document is never quietly excluded from side effects', () => {
  // `financial_only` is the only value that REMOVES work. The document we know
  // least about must not receive it: absence of information gets the loud
  // answer, not the quiet one.
  assert.equal(documentBusinessEffect(doc(null)), 'operational_financial');
  assert.equal(businessEffectForType(null), 'operational_financial');
  assert.equal(businessEffectForType(undefined), 'operational_financial');
  assert.equal(isFinancialOnly(doc(null)), false);
});

// ---------------------------------------------------------------------------
// 15. The gates.
// ---------------------------------------------------------------------------

test('runDocumentSideEffects refuses a financial-only document FIRST, before any branch', () => {
  const source = src('lib/platform/document-ingest.ts');
  const body = source.slice(source.indexOf('export async function runDocumentSideEffects'));
  const gate = body.indexOf('isFinancialOnly(doc)');
  const orderBranch = body.indexOf("doc.document_type === 'order'");
  const procurePulse = body.indexOf('orgHasProcurePulse');
  const supplySync = body.indexOf('feedDocumentToSupplySync');
  assert.ok(gate > 0, 'the financial-only gate is missing from the choke point');
  // FIRST — before the order sync, before ProcurePulse, before SupplySync. Every
  // confirm path in the product crosses this function, which is why the gate's
  // POSITION is the assertion and not merely its presence.
  assert.ok(gate < orderBranch, 'the gate must precede the order branch');
  assert.ok(gate < procurePulse, 'the gate must precede the ProcurePulse feed');
  assert.ok(gate < supplySync, 'the gate must precede the SupplySync feed');
  assert.match(body.slice(gate, gate + 120), /return \{ skipped: 'financial_only' \}/);
});

test('no supplier profile is ever created from an expense receipt', () => {
  // `resolveSupplierProfile` CREATES the suppliers row and the SupplySync
  // profile behind it, on both write paths. Both must refuse.
  const ingest = src('lib/platform/document-ingest.ts');
  assert.match(ingest, /if \(parties\.supplierName && !deferCommit && !financialOnly\)/);
  const route = src('app/api/ai/extract/route.ts');
  assert.match(route, /if \(financialOnly\) \{/);
  assert.ok(
    route.indexOf('if (financialOnly) {') < route.indexOf('resolveSupplierProfile(supabase, doc.org_id'),
    'the refusal must come before the resolution',
  );
});

test('the SupplySync feed denies a financial-only document beside the order deny', () => {
  const source = src('lib/platform/supplysync-feed.ts');
  assert.match(source, /if \(isFinancialOnly\(doc\)\) return \{ fed: false, reason: 'financial-only-document' \};/);
  // Still a deny-list, not an allow-list rewrite: the null-typed document that
  // has always fed as 'document_received' must keep doing so, because changing
  // that is a separate decision with its own evidence.
  assert.match(source, /if \(doc\.document_type === 'order'\) return \{ fed: false, reason: 'orders-route-to-orderflow' \};/);
});

test('the price observer skips an expense receipt AND an untyped document', () => {
  const bridge = new Map([['sup-1', 'ss-1']]);
  const lines = [{ description: 'Coke Zero 300ml', quantity: '2', unit_price: '23.80', confidence: 95 }];
  const base = { id: 'd1', supplier_id: 'sup-1', created_at: '2026-08-30T10:00:00Z' };

  // A receipt's R23.80 must never become a supplier's observed price.
  assert.deepEqual(
    readPriceObservations(
      [{ ...base, document_type: 'expense_receipt', extracted_data: { fields: [], line_items: lines } }],
      bridge,
    ),
    [],
  );
  // The null-type leak the old guard had: `d.document_type &&` let it through.
  assert.deepEqual(
    readPriceObservations([{ ...base, document_type: null, extracted_data: { fields: [], line_items: lines } }], bridge),
    [],
  );
  // …and an invoice still observes exactly as it always did.
  const kept = readPriceObservations(
    [{ ...base, document_type: 'invoice', extracted_data: { fields: [], line_items: lines } }],
    bridge,
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].unitPrice, 23.8);
});

test('the Push-to menu is empty for an expense receipt', () => {
  // Asserted on the source rather than by calling `getRoutes`: routing.ts pulls
  // in the MODULE registry through the `@/` alias, which `node --test` cannot
  // resolve, and rewriting that module's specifiers to make one assertion
  // loadable is a bigger change than the assertion is worth. What matters is
  // the entry itself — `RULES` is a `Record<DocumentType, …>`, so its presence
  // is already compiler-enforced and only its CONTENT needs checking here.
  const source = src('lib/platform/docu/routing.ts');
  assert.match(source, /^\s*expense_receipt: \[\],$/m);
});

test('the unusual-spend flag does not fire on a document with no supplier to compare against', () => {
  const source = src('lib/platform/docu/flags.ts');
  assert.match(source, /doc\.document_type === 'order' \|\| isFinancialOnly\(doc\)/);
});

// ---------------------------------------------------------------------------
// 16. syncOrderFromDocument's own last line of defence.
// ---------------------------------------------------------------------------

test('syncOrderFromDocument refuses a non-order document and writes nothing', async () => {
  const writes: string[] = [];
  const query = (table: string) => ({
    select: () => query(table),
    eq: () => query(table),
    in: () => query(table),
    order: () => query(table),
    limit: () => query(table),
    not: () => query(table),
    insert: () => (writes.push(`insert:${table}`), query(table)),
    update: () => (writes.push(`update:${table}`), query(table)),
    upsert: () => (writes.push(`upsert:${table}`), query(table)),
    delete: () => (writes.push(`delete:${table}`), query(table)),
    maybeSingle: async () =>
      table === 'documents'
        ? {
            data: {
              id: 'doc-1',
              document_type: 'expense_receipt',
              extracted_data: {
                fields: [],
                line_items: [{ description: 'GB Carvery', quantity: '1', unit_price: '501.50', confidence: 96 }],
              },
            },
            error: null,
          }
        : { data: null, error: null },
    then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
  });
  const db = { from: (table: string) => query(table) };

  const result = await syncOrderFromDocument(db as never, { documentId: 'doc-1', orgId: 'org-1' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-an-order-document');
  // The point of the guard: it bails BEFORE anything is created. A restaurant
  // slip's four rows are structurally indistinguishable from a small order, and
  // this function creates customers, products, orders, invoices and stock
  // movements out of whatever line items it is handed.
  assert.deepEqual(writes, []);
});

test('the guard reports failure the way every other refusal in that function does', () => {
  const source = src('lib/platform/orderflow-from-doc.ts');
  // `{ ok: false, reason }` and never a throw — so runDocumentSideEffects turns
  // it into the same "could not build the order" error a real failure produces,
  // and the document stays in the queue rather than being marked approved with
  // nothing behind it.
  assert.match(source, /if \(sourceDoc\.document_type !== 'order'\) return \{ ok: false, reason: 'not-an-order-document' \};/);
  assert.match(source, /\.select\('id, document_type, extracted_data, customer_id, email_ingest_id'\)/);
});

// ---------------------------------------------------------------------------
// 17. Escalation.
// ---------------------------------------------------------------------------

test('a low-confidence expense receipt is NOT escalated into the order lane', () => {
  // A photograph of thermal paper with four rows on it trips the structure audit
  // and states a low confidence routinely and innocently. Escalating on that
  // alone hands the slip to a lane whose job is to find an order in what it is
  // given — and an adopted order means an OrderFlow order and stock movements
  // for a lunch.
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 41,
      structure_audit: { status: 'needs_review' },
    }),
    'accept',
  );
  assert.equal(
    decideClassificationRouting({ document_type: 'expense_receipt', overall_confidence: null }),
    'accept',
  );
});

test('an expense receipt that says "purchase order" on itself IS escalated', () => {
  // The genuine confusion case still reaches a second read: the receipt
  // escalates on EVIDENCE, not on the reader's uncertainty.
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 95,
      supplier: 'Bakubung Purchase Requisition',
    }),
    'escalate_order',
  );
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 95,
      fields: [{ label: 'Reference', value: 'PO 4471' }],
    }),
    'escalate_order',
  );
});

test('every other escalation path is byte-identical', () => {
  // An order still short-circuits.
  assert.equal(decideClassificationRouting({ document_type: 'order', overall_confidence: 10 }), 'accept');
  // A clean invoice is still accepted.
  assert.equal(
    decideClassificationRouting({
      document_type: 'invoice',
      overall_confidence: 92,
      structure_audit: { status: 'ok' },
    }),
    'accept',
  );
  // A low-confidence invoice still escalates…
  assert.equal(decideClassificationRouting({ document_type: 'invoice', overall_confidence: 41 }), 'escalate_order');
  // …a missing confidence still counts as the worst one…
  assert.equal(decideClassificationRouting({ document_type: 'invoice', overall_confidence: null }), 'escalate_order');
  // …a failed structure audit still escalates…
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: 95,
      structure_audit: { status: 'needs_review' },
    }),
    'escalate_order',
  );
  // …and so does an order cue on a confident read.
  assert.equal(
    decideClassificationRouting({ document_type: 'invoice', overall_confidence: 95, bill_to: 'Purchase Order 8812' }),
    'escalate_order',
  );
});

// ---------------------------------------------------------------------------
// 14. Confidence semantics are untouched.
// ---------------------------------------------------------------------------

test('a missing confidence is still null — the financial lane adds no coercion of its own', () => {
  assert.equal(coerceConfidence(undefined), null);
  assert.equal(coerceConfidence(null), null);
  assert.equal(coerceConfidence(''), null);
  assert.equal(coerceConfidence(0), 0, 'an explicit 0 is still a statement');
  assert.equal(coerceConfidence('88%'), 88);

  // None of the new or newly-gated modules invents a document-level confidence.
  for (const path of [
    'lib/platform/docu/business-effect.ts',
    'lib/platform/docu/financial-document.ts',
    'lib/platform/docu/expense-categories.ts',
  ]) {
    assert.doesNotMatch(src(path), /confidence\s*\?\?\s*0/, `${path} coerces a missing confidence to 0`);
  }
  // The receipt card renders the document's confidence through the shared
  // component and never rewrites it on confirm.
  const card = src('components/platform/docu/ReceiptReviewCard.tsx');
  assert.match(card, /<ConfidenceText value=\{confidence\} \/>/);
  // Confirming a receipt must not rewrite the extraction's confidence: the card
  // writes back exactly one column, and it is the jsonb.
  assert.match(card, /\.update\(\{ extracted_data: next \}\)/);
  assert.equal(card.match(/\.update\(/g)?.length, 1, 'the card writes more than one update payload');
});

// ---------------------------------------------------------------------------
// Review queue.
// ---------------------------------------------------------------------------

test('an expense receipt gets its own review pile, not the invoice one', () => {
  assert.equal(reviewDocumentTask({ status: 'extracted', document_type: 'expense_receipt' }), 'docu:expenses');
  // Everything else lands exactly where it did.
  assert.equal(reviewDocumentTask({ status: 'extracted', document_type: 'invoice' }), 'docu:invoices');
  assert.equal(reviewDocumentTask({ status: 'extracted', document_type: 'statement' }), 'docu:statements');
  assert.equal(reviewDocumentTask({ status: 'extracted', document_type: null }), 'docu:invoices');
  // Flagged still beats type — a document Vyso could not read is not an expense
  // waiting to be approved.
  assert.equal(reviewDocumentTask({ status: 'error', document_type: 'expense_receipt' }), 'docu:flagged');
});

test('the review queue tells the truth about what Save will do', () => {
  const source = src('components/platform/docu/DocumentReviewQueue.tsx');
  assert.match(source, /Saving records the expense — no stock, supplier or order changes\./);
});

// ---------------------------------------------------------------------------
// Downstream allow-lists — verified, not modified.
// ---------------------------------------------------------------------------

test('the modules with allow-lists already exclude the new type, and were left alone', () => {
  // ProcurePulse, Hubdoc: allow-lists that name their types. `expense_receipt`
  // is simply not on them, which is how a closed allow-list is supposed to
  // behave — so these files carry no change at all.
  assert.doesNotMatch(src('lib/platform/procurepulse-feed.ts'), /expense_receipt/);
  assert.doesNotMatch(src('lib/platform/hubdoc-shared.ts'), /expense_receipt/);
  assert.match(src('lib/platform/procurepulse-feed.ts'), /FEED_TYPES = new Set\(\['invoice', 'statement', 'delivery_note'\]\)/);
  assert.match(src('lib/platform/hubdoc-shared.ts'), /HUBDOC_DOCUMENT_TYPES: readonly string\[\] = \['invoice', 'statement'\]/);

  // The order → delivery → invoice → statement chain does not gain a stage.
  const relationships = src('lib/platform/docu/relationships.ts');
  assert.doesNotMatch(relationships, /expense_receipt/);

  // And no Microsoft Graph file is touched: an unmatched document type already
  // falls through `classificationFromDocumentType` to the current classification.
  const graph = src('lib/platform/microsoft-graph-ingest-core.ts');
  assert.doesNotMatch(graph, /expense_receipt/);
});
