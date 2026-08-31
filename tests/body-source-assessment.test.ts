/**
 * The source assessment: what an email body IS, and whether an order may be
 * built from it.
 *
 * The two shapes under test are modelled on real failures and fully ANONYMISED:
 * a standing order form exported by Outlook as one table, and a
 * procurement-portal notification whose body is a wrapped link. Products,
 * people, references and hosts are invented.
 *
 * The invariant these tests exist to hold: STRUCTURE IS WEIGHED FIRST. A grid
 * Vyso can read is usable even when most of its order cells are blank, and rows
 * missing only a price are a normal order. The flattened-fragment heuristic is
 * for sources where no row relationship survived at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessBodySource,
  assessCanonicalOrder,
  assessmentAdmitsZeroLines,
  assessmentRequiresReview,
  FLATTENED_FRAGMENT_MIN_LINES,
  FLATTENED_FRAGMENT_UNRESOLVED_QUANTITY_FRACTION,
  isRecoverableTable,
  orderPortalProvider,
} from '../lib/platform/docu/body-source-assessment.ts';
import { normalizeEmailHtml } from '../lib/platform/docu/email-html-normalizer.ts';
import type { ExtractedLineItem } from '../lib/platform/types.ts';

function line(description: string, quantity = '', extra: Partial<ExtractedLineItem> = {}): ExtractedLineItem {
  return {
    raw_description: description,
    description,
    quantity,
    unit: quantity ? 'boxes' : '',
    confidence: 80,
    ...extra,
  };
}

/** A standing order form: `rows` products, `ordered` of them with a quantity. */
function orderFormHtml(rows: number, ordered: number): string {
  const cells: string[] = [
    '<tr><td><b>Item</b></td><td><b>UNIT</b></td><td><b>stock</b></td><td><b>order</b></td></tr>',
  ];
  for (let i = 0; i < rows; i += 1) {
    const quantity = i < ordered ? String(i + 1) : '&nbsp;';
    cells.push(`<tr><td>Filler Product ${i + 1}</td><td>kg</td><td>&nbsp;</td><td>${quantity}</td></tr>`);
  }
  return `<html><body><table class="MsoNormalTable">${cells.join('')}</table><p>Kind Regards</p></body></html>`;
}

const PORTAL_BODY = `<html><body>Property: Riverbend<br>Reference Buyer PO number: RVB0044219<br><br>Sent By:<br>Dana Kruger<br><br>TO EDIT THE DOCUMENT CLICK THE BELOW LINK<br><a href="https://links.mailer-example.net/ls/click?upn=EXAMPLE-TOKEN-0000">http://riverbend.birchstreet.net</a><img src="https://links.mailer-example.net/wf/open?upn=EXAMPLE-TOKEN-0000" width="1" height="1"></body></html>`;

/** The flattened shape: one cell per line, no row or column delimiter left. */
function flattenedOrderForm(products: number): string {
  const lines: string[] = ['Item', 'UNIT', 'stock', 'order'];
  for (let i = 0; i < products; i += 1) {
    lines.push(`Filler Product ${i + 1}`, i % 2 ? 'kg' : 'BOX');
  }
  return lines.join('\n');
}

function textBody(text: string) {
  return { text, textOutsideTables: text, tables: [], links: [] };
}

test('a Graph text body is read exactly as it always was', () => {
  const read = assessBodySource({
    contentType: 'text',
    normalized: textBody('Hi, please send 10kg potatoes and 5kg carrots tomorrow.'),
    orderIntent: true,
  });
  assert.equal(read.kind, 'plain_text');
  assert.equal(read.parse_status, 'complete');
  assert.equal(read.structure_recovered, false);

  const assessment = assessCanonicalOrder(read, {
    lines: [line('Potatoes', '10'), line('Carrots', '5')],
  });
  assert.equal(assessment.canonical_order_status, 'ready');
  assert.equal(assessment.body_parse_status, 'complete');
  assert.equal(assessmentRequiresReview(assessment), false);
});

test('a recovered order form is structured_html, and its ordered rows are ready', () => {
  const normalized = normalizeEmailHtml(orderFormHtml(99, 8));
  const read = assessBodySource({ contentType: 'html', normalized, orderIntent: true });
  assert.equal(read.kind, 'structured_html');
  assert.equal(read.structure_recovered, true);
  assert.ok(isRecoverableTable(normalized.tables[0]));

  const assessment = assessCanonicalOrder(read, {
    lines: Array.from({ length: 8 }, (_, i) => line(`Filler Product ${i + 1}`, String(i + 1))),
  });
  assert.equal(assessment.body_content_kind, 'structured_html');
  assert.equal(assessment.canonical_order_status, 'ready');
  assert.equal(assessment.detected_line_signals?.quantity_coverage, 1);
});

test('INVARIANT: a coherent table with blank quantity cells is never unsafe', () => {
  // The same 99-row form, but the reader returned every row including the ones
  // whose order cell was blank. That is a reader that ignored the order-form
  // clause — it is NOT a source whose rows could not be reconstructed, and
  // condemning it would be condemning a perfectly readable grid.
  const read = assessBodySource({
    contentType: 'html',
    normalized: normalizeEmailHtml(orderFormHtml(99, 8)),
    orderIntent: true,
  });
  const lines = Array.from({ length: 97 }, (_, i) => line(`Filler Product ${i + 1}`, i < 5 ? '1' : ''));
  const assessment = assessCanonicalOrder(read, { lines });
  assert.ok(lines.length >= FLATTENED_FRAGMENT_MIN_LINES);
  assert.ok(1 - (assessment.detected_line_signals?.quantity_coverage ?? 0) >= FLATTENED_FRAGMENT_UNRESOLVED_QUANTITY_FRACTION);
  assert.notEqual(assessment.canonical_order_status, 'unsafe');
  assert.equal(assessment.canonical_order_status, 'partial');
  assert.equal(assessment.body_content_kind, 'structured_html');
});

test('INVARIANT: coherent rows missing PRICES stay usable', () => {
  const read = assessBodySource({
    contentType: 'text',
    normalized: textBody('5 boxes tomatoes\n3 bags potatoes\n2 crates apples'),
    orderIntent: true,
  });
  const lines = [
    line('Tomatoes', '5', { unit_price: '', raw_amount: '' }),
    line('Potatoes', '3', { unit_price: '', raw_amount: '' }),
    line('Apples', '2', { unit_price: '', raw_amount: '' }),
  ];
  const assessment = assessCanonicalOrder(read, { lines });
  assert.equal(assessment.canonical_order_status, 'ready');
  assert.equal(assessment.body_parse_status, 'complete');
});

test('the flattened order form is unsafe to infer from, and creates no lines', () => {
  const read = assessBodySource({
    contentType: 'html',
    normalized: textBody(flattenedOrderForm(97)),
    orderIntent: true,
  });
  assert.equal(read.structure_recovered, false, 'nothing survived to recover');
  // 97 product-like lines, 92 of them with no quantity — the measured shape of
  // the regression this heuristic is named after.
  const lines = Array.from({ length: 97 }, (_, i) => line(`Filler Product ${i + 1}`, i < 5 ? '1' : ''));
  const assessment = assessCanonicalOrder(read, { lines });
  assert.equal(assessment.body_content_kind, 'malformed_structured_content');
  assert.equal(assessment.body_parse_status, 'unsafe_to_infer');
  assert.equal(assessment.canonical_order_status, 'unsafe');
  assert.equal(assessment.detected_line_signals?.quantity_coverage, 0.05);
  assert.ok((assessment.detected_line_signals?.product_like_count ?? 0) >= 90);
  assert.equal(assessmentAdmitsZeroLines(assessment), true);
  assert.equal(assessmentRequiresReview(assessment), true);
});

test('a short quantity-less list is partial, not unsafe — the gate needs both signals', () => {
  const read = assessBodySource({
    contentType: 'text',
    normalized: textBody('tomatoes\npotatoes\napples\npears'),
    orderIntent: true,
  });
  const assessment = assessCanonicalOrder(read, {
    lines: [line('Tomatoes', '5'), line('Potatoes'), line('Apples'), line('Pears')],
  });
  assert.equal(assessment.canonical_order_status, 'partial');
  assert.equal(assessmentRequiresReview(assessment), true);
});

test('an explicitly unresolved quantity does not count as coverage', () => {
  const read = assessBodySource({ contentType: 'text', normalized: textBody('one line'), orderIntent: true });
  const assessment = assessCanonicalOrder(read, {
    lines: [line('Tomatoes', '5', { quantity_source: 'unresolved' })],
  });
  assert.equal(assessment.detected_line_signals?.quantity_coverage, 0);
  assert.equal(assessment.canonical_order_status, 'partial');
});

test('the portal notification is an external link with no lines — and is never fetched', () => {
  const normalized = normalizeEmailHtml(PORTAL_BODY);
  const read = assessBodySource({ contentType: 'html', normalized, orderIntent: true });
  assert.equal(read.kind, 'external_link');
  assert.equal(read.parse_status, 'unavailable');
  // The provider is read from the anchor's DISPLAYED url; the href stays the
  // tracking wrapper the customer actually published, and is only ever stored.
  assert.equal(read.external_source?.provider, 'birchstreet');
  assert.equal(read.external_source?.host, 'riverbend.birchstreet.net');
  assert.match(read.external_source?.href ?? '', /^https:\/\/links\.mailer-example\.net\/ls\/click/);

  const assessment = assessCanonicalOrder(read, { lines: [] });
  assert.equal(assessment.body_content_kind, 'external_link');
  assert.equal(assessment.canonical_order_status, 'unavailable');
  assert.equal(assessmentAdmitsZeroLines(assessment), true);
  assert.equal(assessmentRequiresReview(assessment), true);
});

test('portal providers are inferred from the hostname only', () => {
  assert.equal(orderPortalProvider('riverbend.birchstreet.net'), 'birchstreet');
  assert.equal(orderPortalProvider('acme.coupahost.com'), 'coupa');
  assert.equal(orderPortalProvider('buyer.ariba.com'), 'sap_ariba');
  assert.equal(orderPortalProvider('links.mailer-example.net'), null);
  assert.equal(orderPortalProvider(null), null);
  // A provider name in a QUERY STRING is not a provider — hostname only.
  assert.equal(orderPortalProvider(new URL('https://evil.example/?to=birchstreet.net').hostname), null);
});

test('an attachment order is judged on its own merits, not on the body it arrived with', () => {
  // The Four Seasons shape: a link-only body, and the real purchase order in an
  // attached HTML file. The flattened-body heuristic must not be turned on it.
  const read = assessBodySource({
    contentType: 'html',
    normalized: normalizeEmailHtml(PORTAL_BODY),
    orderIntent: true,
  });
  const lines = Array.from({ length: 20 }, (_, i) => line(`Melon ${i + 1}`, i < 3 ? '6' : ''));
  const withBodyHeuristic = assessCanonicalOrder(read, { lines });
  const asAttachment = assessCanonicalOrder(read, { lines, linesFromAttachment: true });
  assert.equal(withBodyHeuristic.canonical_order_status, 'unsafe');
  assert.equal(asAttachment.canonical_order_status, 'partial');
});

test('a conflict outranks completeness', () => {
  const read = assessBodySource({ contentType: 'text', normalized: textBody('5 boxes tomatoes'), orderIntent: true });
  const assessment = assessCanonicalOrder(read, { lines: [line('Tomatoes', '5')], conflicts: 1 });
  assert.equal(assessment.canonical_order_status, 'conflict');
  assert.equal(assessmentRequiresReview(assessment), true);
});

test('an html body with neither table nor link nor quantities is informational', () => {
  const read = assessBodySource({
    contentType: 'html',
    normalized: normalizeEmailHtml('<html><body><p>Thanks for the delivery yesterday.</p></body></html>'),
    orderIntent: false,
  });
  assert.equal(read.kind, 'informational');
  assert.equal(assessCanonicalOrder(read, { lines: [] }).canonical_order_status, 'unavailable');
});

test('a single-cell layout box is not a grid', () => {
  const normalized = normalizeEmailHtml('<table><tr><td>PO Box 2700</td></tr><tr><td>Riverbend</td></tr><tr><td>ZA</td></tr></table>');
  assert.equal(normalized.tables.every(isRecoverableTable), false);
  const read = assessBodySource({ contentType: 'html', normalized, orderIntent: true });
  assert.equal(read.structure_recovered, false);
});

test('assessing never performs a network call', () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error('the assessment must never fetch anything');
  }) as typeof fetch;
  try {
    const read = assessBodySource({
      contentType: 'html',
      normalized: normalizeEmailHtml(PORTAL_BODY),
      orderIntent: true,
    });
    assessCanonicalOrder(read, { lines: [] });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 0);
});

// ---------------------------------------------------------------------------
// The gates that act on the verdict. These are source assertions: both gates
// live inside Supabase-bound functions, and what matters about them is the
// CONDITION, which is exactly what a source assertion can pin.
// ---------------------------------------------------------------------------

test('the two zero-line gates admit an assessed order and still refuse an empty one', () => {
  const ingest = readFileSync(new URL('../lib/platform/document-ingest.ts', import.meta.url), 'utf8');
  // document-ingest's 422: a zero-line order passes ONLY with an assessment
  // that admits it AND something a human can act on.
  assert.match(ingest, /const assessedZeroLineOrder =/);
  assert.match(ingest, /assessmentAdmitsZeroLines\(extractionMetadata\?\.message_order_evidence\)/);
  assert.match(ingest, /order\.customer_name \|\|\s*order\.purchase_order_number \|\|\s*extractionMetadata\?\.message_order_evidence\?\.external_source/);
  assert.match(ingest, /if \(!assessedZeroLineOrder && !order\.customer_name && order\.line_items\.length === 0\)/);
  // The named-key spread is intact and still protects `totals`.
  assert.match(ingest, /\.\.\.\(extractionMetadata\?\.message_order_evidence/);
  assert.match(ingest, /totals: order\.totals \?\? null/);

  const messageOrder = readFileSync(new URL('../lib/platform/microsoft-message-order.ts', import.meta.url), 'utf8');
  // readBodyOrder returns the assessment instead of throwing, and an UNSAFE
  // read is filed with NO lines rather than with ninety-seven guesses.
  assert.match(messageOrder, /if \(assessmentAdmitsZeroLines\(assessment\) && reviewable\) return result/);
  assert.match(messageOrder, /assessment\.canonical_order_status === 'unsafe'\s*\?\s*\{ \.\.\.order, line_items: \[\] \}/);
  // A body that is a link or a shredded table must not take a good attachment
  // down with it.
  assert.match(messageOrder, /if \(!hasSupplementalEvidence && !assessmentAdmitsZeroLines\(assessment\)\)/);
});

test('the assessment is stored on message evidence, and reaches extracted_data by name', () => {
  const messageOrder = readFileSync(new URL('../lib/platform/microsoft-message-order.ts', import.meta.url), 'utf8');
  assert.match(messageOrder, /extractionMetadata: \{ message_order_evidence: bodyOnlyOrderEvidence\(order, assessment\) \}/);
  assert.match(messageOrder, /attachmentOnlyOrderEvidence\(usable, input\.attachment\.id, assessment\)/);
});
