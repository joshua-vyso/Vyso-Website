import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CREDIT_DOCUMENT_TYPES,
  businessEffectForType,
  documentBusinessEffect,
  financialEffectForType,
  isCreditDocumentType,
  isCustomerSideCredit,
  isFinancialOnly,
} from '../lib/platform/docu/business-effect.ts';
import { decideClassificationRouting } from '../lib/platform/docu/classification-policy.ts';
import { hubdocEligibility } from '../lib/platform/hubdoc-shared.ts';
import { reviewDocumentTask } from '../lib/platform/review-queue-shared.ts';
import { DOC_TYPES, DOC_TYPE_LABEL } from '../lib/platform/documents.ts';
import type { DocumentType } from '../lib/platform/types.ts';
import type { DocuExtractedData } from '../lib/platform/docu/types.ts';

// `routing.ts`, `search.ts` and `flags.ts` all import through the `@/` alias,
// which `node --test` does not resolve — so their properties are asserted
// against their SOURCE, exactly as tests/docu-business-effect.test.ts does for
// the allow-lists it cannot import either. The assertions are written verbatim
// so a future edit has to come past them.

// ---------------------------------------------------------------------------
// A refund is not a purchase.
//
// Eat Your Greens CRN0012368: the email classifier called it a credit_note at
// confidence 99, the document layer had no credit type, so it was coerced to
// `invoice` at 92 with a POSITIVE +335.00 line, supplier_id null and no
// ss_supplier_history row. And 'invoice' is a member of EVERY operational
// allow-list there is.
//
// Montecasino Credit Request 6275: stored as `invoice`, direction "outgoing —
// you invoiced Montecasino", line 154.42 lifted from the EXPECTED column, while
// the paper said Credit Request 6275, PO 144426, original invoice 105177, Nett
// CR −52.58 incl VAT.
//
// EVERY FIXTURE BELOW IS SYNTHETIC. The shapes are the ones that failed.
// ---------------------------------------------------------------------------

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The source with its comments removed. These files explain themselves at
 *  length and NAME the things they refuse to do — "never Math.abs", "no
 *  of_credit_notes auto-creation" — so a plain substring search over the whole
 *  file finds the prose that promises the property and mistakes it for a
 *  violation of it. */
const code = (path: string) =>
  src(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** The Eat Your Greens credit, as the new schema stores it — signs as printed. */
const supplierCredit: DocuExtractedData = {
  fields: [],
  line_items: [{ description: 'Baby Spinach 200g', quantity: '10', unit_price: '33.50', amount: '-335.00', confidence: 94 }],
  supplier: 'Fernvale Greens Company',
  business_effect: 'operational_financial',
  financial_effect: 'reduces_payable',
  credit_document: {
    credit_reference: 'CRN0012368',
    original_invoice_reference: 'INV0044120',
    po_reference: '',
    reason: 'Short delivered — 10 punnets not received',
    net_amount: '-291.30',
    tax_amount: '-43.70',
    total_amount: '-335.00',
    currency: 'R',
  },
};

/** Credit Request 6275, as the new schema stores it. */
const customerCreditRequest: DocuExtractedData = {
  fields: [],
  line_items: [],
  bill_to: 'Riverbend Casino Resort',
  business_effect: 'operational_financial',
  financial_effect: 'pending_credit_request',
  credit_document: {
    credit_reference: 'Credit Request 6275',
    original_invoice_reference: '105177',
    po_reference: '144426',
    reason: 'Price difference against contracted rate',
    net_amount: '-45.72',
    tax_amount: '-6.86',
    total_amount: '-52.58',
    currency: 'R',
  },
};

// ---------------------------------------------------------------------------
// 10–12. The types exist, carry the right dimensions, and the direction is
//        deterministic.
// ---------------------------------------------------------------------------

test('10. the three credit types exist and are recognised as credits', () => {
  assert.deepEqual([...CREDIT_DOCUMENT_TYPES], [
    'supplier_credit_note',
    'customer_credit_request',
    'customer_credit_note',
  ]);
  for (const type of CREDIT_DOCUMENT_TYPES) assert.equal(isCreditDocumentType(type), true);
  for (const type of ['invoice', 'statement', 'order', 'expense_receipt', 'price_list', 'delivery_note'] as DocumentType[]) {
    assert.equal(isCreditDocumentType(type), false, type);
  }
  assert.equal(isCreditDocumentType(null), false);
});

test('11. the financial effect is derived from the TYPE and from nothing a reader said', () => {
  assert.equal(financialEffectForType('supplier_credit_note'), 'reduces_payable');
  assert.equal(financialEffectForType('customer_credit_request'), 'pending_credit_request');
  assert.equal(financialEffectForType('customer_credit_note'), 'reduces_receivable');
  // NULL on everything else — an invoice's effect is the ordinary one every
  // module already assumes, and stamping a value would invite a gate to switch
  // on this key instead of on the allow-list it should be using.
  for (const type of ['invoice', 'statement', 'order', 'expense_receipt', 'price_list', 'delivery_note', null] as (DocumentType | null)[]) {
    assert.equal(financialEffectForType(type), null, String(type));
  }
  // A REQUEST IS NOT A CREDIT. This is the value that must never quietly become
  // 'reduces_receivable': Credit Request 6275 had a blank approval block.
  assert.notEqual(financialEffectForType('customer_credit_request'), 'reduces_receivable');
});

test('12. credits are operational_financial, NOT financial_only — they belong on a profile', () => {
  for (const type of CREDIT_DOCUMENT_TYPES) {
    assert.equal(businessEffectForType(type), 'operational_financial', type);
    assert.equal(isFinancialOnly({ document_type: type, extracted_data: null }), false, type);
  }
  // `financial_only` would switch off the SupplySync feed too, and a supplier
  // credit note belongs on the supplier's timeline — CRN0012368 having no
  // ss_supplier_history row is half of what went wrong with it.
  assert.equal(documentBusinessEffect({ document_type: 'supplier_credit_note', extracted_data: supplierCredit }), 'operational_financial');
});

// ---------------------------------------------------------------------------
// 13–15. Supplier credit: lookup-only resolution, SupplySync, spend exclusion.
// ---------------------------------------------------------------------------

test('13. a supplier credit note resolves a supplier by LOOKUP and never creates one', () => {
  const ingest = src('lib/platform/document-ingest.ts');
  // The non-creating variant exists and contains no insert of any kind.
  const lookup = ingest.slice(
    ingest.indexOf('export async function lookupSupplierProfile('),
    ingest.indexOf('export async function loadOrgIdentity('),
  );
  assert.ok(lookup.length > 0, 'lookupSupplierProfile exists');
  for (const write of ['.insert(', '.upsert(', '.update(', 'resolveSupplierId(', 'ensureSupplySyncProfile(']) {
    assert.equal(lookup.includes(write), false, `lookupSupplierProfile must not call ${write}`);
  }
  // And the credit branch uses it — before the creating branch, so the creating
  // one can never be reached for this type.
  assert.match(
    ingest,
    /documentType === 'supplier_credit_note'\) \{[\s\S]{0,400}?lookupSupplierProfile\(supabase, orgId, parties\.supplierName\)/,
  );
  assert.ok(
    ingest.indexOf("documentType === 'supplier_credit_note'") <
      ingest.indexOf('supplierId = await resolveSupplierProfile(supabase, orgId, parties.supplierName)'),
  );
  // The manual-upload lane makes the same refusal.
  const route = src('app/api/ai/extract/route.ts');
  assert.match(route, /documentType === 'supplier_credit_note'[\s\S]{0,500}?lookupSupplierProfile\(/);
});

test('14. a supplier credit note gets a NAMED SupplySync event, not the generic fallback', () => {
  const feed = src('lib/platform/supplysync-feed.ts');
  assert.match(feed, /supplier_credit_note: 'credit_note_received',/);
  assert.match(feed, /supplier_credit_note: 'Credit note',/);
  // The customer-side ones are deliberately absent: there is no supplier
  // profile for them to land on, and a label implying one would be a claim
  // about a relationship that does not exist.
  assert.equal(feed.includes("customer_credit_request: '"), false);
  assert.equal(feed.includes("customer_credit_note: '"), false);
});

test('15. ANALYTICS: no credit type appears in ANY operational allow-list', () => {
  // Every one of these is a hand-maintained list. Each is asserted verbatim, so
  // a future widening that adds a credit type has to come past this test.
  const lists: Array<[string, RegExp]> = [
    // Stock received.
    ['lib/platform/procurepulse-feed.ts', /FEED_TYPES = new Set\(\['invoice', 'statement', 'delivery_note'\]\)/],
    // Spend rollups — the R335.00 that would have inflated the very figure the
    // credit exists to reduce.
    ['lib/platform/supplysync-feed.ts', /SPEND_DOC_TYPES = \['invoice', 'statement'\] as const/],
    // Price observation, both copies.
    ['lib/platform/supplysync-pricing.ts', /PRICED_DOC_TYPES = new Set\(\['invoice', 'price_list', 'statement'\]\)/],
    ['lib/platform/price-watch/run.ts', /PRICED_DOC_TYPES = \['invoice', 'statement', 'price_list'\] as const/],
    // Doc Watch.
    ['lib/platform/doc-watch/detect.ts', /WATCHED_DOC_TYPES = \['invoice', 'statement', 'price_list'\] as const/],
    // The sync-all route's own copy of FEED_TYPES.
    ['app/api/procurepulse/sync-all/route.ts', /FEED_TYPES = \['invoice', 'statement', 'delivery_note'\]/],
    // Hubdoc's supplier inbox.
    ['lib/platform/hubdoc-shared.ts', /HUBDOC_DOCUMENT_TYPES: readonly string\[\] = \['invoice', 'statement'\]/],
  ];
  for (const [path, pattern] of lists) {
    const text = src(path);
    assert.match(text, pattern, path);
    for (const type of CREDIT_DOCUMENT_TYPES) {
      const listLine = pattern.exec(text)?.[0] ?? '';
      assert.equal(listLine.includes(type), false, `${path} must not list ${type}`);
    }
  }
});

test('15b. Hubdoc is ALREADY type-gated, so the three credit types are refused by construction', () => {
  // The plan asked the implementer to read `hubdocEligibility` and add an
  // explicit exclusion IF it is not type-gated. It is: test 2 of four is an
  // allow-list (`HUBDOC_DOCUMENT_TYPES`), so no code change was needed and this
  // asserts the property instead of adding a redundant second gate.
  for (const type of CREDIT_DOCUMENT_TYPES) {
    const verdict = hubdocEligibility({
      documentType: type,
      status: 'extracted',
      supplierId: 'sup-1',
      storagePath: 'org/credit.pdf',
    });
    assert.equal(verdict.ok, false, type);
    assert.match(verdict.ok === false ? verdict.reason : '', /supplier invoices and statements/);
  }
  // The control: an invoice in the same state is still eligible.
  assert.equal(
    hubdocEligibility({ documentType: 'invoice', status: 'extracted', supplierId: 'sup-1', storagePath: 'org/inv.pdf' }).ok,
    true,
  );
});

// ---------------------------------------------------------------------------
// 16–19. Customer credit: no supplier resolution, customer resolution, no post.
// ---------------------------------------------------------------------------

test('16. a customer-side credit runs NO supplier resolution at all', () => {
  assert.equal(isCustomerSideCredit('customer_credit_request'), true);
  assert.equal(isCustomerSideCredit('customer_credit_note'), true);
  assert.equal(isCustomerSideCredit('supplier_credit_note'), false);
  assert.equal(isCustomerSideCredit('invoice'), false);

  const ingest = src('lib/platform/document-ingest.ts');
  // The branch is FIRST in the ladder and its body is empty of resolution —
  // running the supplier chain over a Montecasino credit request would put the
  // org's own customer into its vendor list.
  assert.match(ingest, /if \(customerSideCredit\) \{\n\s*\/\/ Deliberately nothing\. See above\.\n\s*\} else if/);
  const route = src('app/api/ai/extract/route.ts');
  assert.match(route, /\} else if \(customerSideCredit\) \{/);
  assert.ok(route.indexOf('} else if (customerSideCredit) {') < route.indexOf('resolveSupplierProfile(supabase, doc.org_id'));
});

test('17. a customer-side credit resolves a CUSTOMER, read-only, on every lane', () => {
  const ingest = src('lib/platform/document-ingest.ts');
  assert.match(ingest, /if \(customerSideCredit\) \{\s*\n\s*try \{\s*\n\s*creditCustomerMatch = await resolveExistingCustomerForOrg\(/);
  // NOT gated on deferCommit, unlike supplier resolution — because this
  // resolution creates nothing at all and so has no human-approval boundary to
  // protect. `resolveExistingCustomerForOrg` can only return a row that already
  // exists and has no mutation API.
  const block = ingest.slice(ingest.indexOf('let creditCustomerMatch = null;'), ingest.indexOf('const extractedData = {', ingest.indexOf('let creditCustomerMatch = null;')));
  assert.equal(block.includes('deferCommit'), false);
  const matcher = src('lib/platform/docu/customer-match.ts');
  for (const write of ['.insert(', '.upsert(', '.update(', '.delete(']) {
    assert.equal(matcher.includes(write), false, `customer-match must never ${write}`);
  }
  // documents.customer_id IS the plumbing — the customer profile page already
  // lists documents by that column, so no new table and no second surface.
  assert.match(ingest, /\.\.\.\(creditCustomerMatch \? \{ customer_id: creditCustomerMatch\.customerId \} : \{\}\),/);
  assert.match(src('app/api/ai/extract/route.ts'), /\.\.\.\(creditCustomerMatch \? \{ customer_id: creditCustomerMatch\.customerId \} : \{\}\),/);
});

test('18. NOTHING IS POSTED. No credit note, no claim, no AR/AP, no Xero, no email', () => {
  const ingest = code('lib/platform/document-ingest.ts');
  const route = code('app/api/ai/extract/route.ts');
  const card = code('components/platform/docu/CreditReviewCard.tsx');
  for (const table of ['of_credit_notes', 'of_credit_note_items', 'ss_supplier_credits', 'ss_supplier_credit_claims']) {
    assert.equal(ingest.includes(table), false, `${table} must not be written by ingest`);
    assert.equal(route.includes(table), false, `${table} must not be written by the extract route`);
    assert.equal(card.includes(table), false, `${table} must not be written by the review card`);
  }
  // The card's only network call is the ordinary review commit every other type
  // uses — no separate approval path to drift out of step.
  assert.equal((card.match(/fetch\(/g) ?? []).length, 1);
  assert.match(card, /'\/api\/docu\/review'/);
  // And it says so, in words, on the screen where the decision is made.
  assert.match(card, /does\s*\n?\s*not post a credit, adjust an invoice, or change what is owed/);
});

test('19. a credit request is presented as a CLAIM, not as a settled credit', () => {
  const card = src('components/platform/docu/CreditReviewCard.tsx');
  assert.match(card, /A request — nothing is credited until you agree it/);
  assert.match(card, /Reduces what you owe this supplier/);
  assert.match(card, /Reduces what this customer owes you/);
});

// ---------------------------------------------------------------------------
// 20–23. Verbatim figures, review surfaces, search, flags.
// ---------------------------------------------------------------------------

test('20. the credit figures are stored verbatim, signs and all — no Math.abs anywhere', () => {
  // The Credit Request 6275 shape: the credit is −52.58, and 154.42 (the
  // EXPECTED column) is not in this block at all.
  assert.equal(customerCreditRequest.credit_document?.total_amount, '-52.58');
  assert.equal(customerCreditRequest.credit_document?.po_reference, '144426');
  assert.equal(customerCreditRequest.credit_document?.original_invoice_reference, '105177');
  assert.equal(supplierCredit.credit_document?.total_amount, '-335.00');

  for (const path of [
    'lib/ai/anthropic.ts',
    'lib/platform/document-ingest.ts',
    'components/platform/docu/CreditReviewCard.tsx',
    'lib/platform/docu/business-effect.ts',
  ]) {
    assert.equal(code(path).includes('Math.abs'), false, `${path} must not Math.abs a credit`);
  }
  // The coercion keeps strings and does nothing else: no parse, no sign
  // normalisation, no derived total.
  const anthropic = src('lib/ai/anthropic.ts');
  const coercion = anthropic.slice(
    anthropic.indexOf('function coerceCreditDocument('),
    anthropic.indexOf('/** Parse a PDF or image document'),
  );
  for (const forbidden of ['parseLocaleNumber', 'Number(', 'replace(', '+ ']) {
    assert.equal(coercion.includes(forbidden), false, `coerceCreditDocument must not ${forbidden}`);
  }
});

test('21. the prompt can SAY the credit types, and tells the reader a credit is never an invoice', () => {
  const anthropic = src('lib/ai/anthropic.ts');
  // The union AND the prompt enum are two separate hand-maintained lists, and a
  // type missing from either is a type the model can never emit — which is
  // exactly why `credit_note` came back as "invoice" for CRN0012368.
  for (const type of CREDIT_DOCUMENT_TYPES) {
    assert.ok(anthropic.includes(`| '${type}'`), `ExtractedDocType is missing ${type}`);
    assert.ok(anthropic.includes(`| "${type}"`), `the prompt enum is missing ${type}`);
  }
  assert.match(anthropic, /A DOCUMENT THAT CALLS ITSELF A CREDIT IS NEVER AN INVOICE/);
  assert.match(anthropic, /KEEP THE SIGN THE PAPER PRINTS/);
  assert.match(anthropic, /A COMPARISON COLUMN IS NOT AN AMOUNT/);
});

test('22. credits are findable: tiles, labels, review pile, search, and no push-to menu', () => {
  for (const type of CREDIT_DOCUMENT_TYPES) {
    assert.ok(DOC_TYPE_LABEL[type], `${type} has a label`);
    // NOT compile-forced — `DOC_TYPES` is a plain array, so a missing type is a
    // credit note that exists in the database, is excluded from every
    // operational query exactly as intended, and cannot be found by the person
    // looking for it. CRN0012368 was mis-typed AND unfindable.
    assert.ok(DOC_TYPES.some((t) => t.key === type), `${type} has a tile/folder/filter chip`);
    // Its own review pile — a credit filed under "Invoices to approve" tells
    // the reviewer they are approving a bill while approving a refund.
    assert.equal(reviewDocumentTask({ status: 'extracted', document_type: type }), 'docu:credits');
  }
  // EMPTY ROUTES, AND THE EMPTINESS IS THE FEATURE. There is no module a credit
  // can be pushed into without lying: ProcurePulse would take its lines as
  // stock received, PricePilot its rates as a price observation.
  const routing = src('lib/platform/docu/routing.ts');
  for (const type of CREDIT_DOCUMENT_TYPES) assert.match(routing, new RegExp(`${type}: \\[\\],`));
  // The `Record<DocumentType, …>` is what forced the question to be answered.
  assert.match(routing, /RULES: Record<DocumentType,/);
});

test('22b. search can name each credit type, and a bare "credit notes" still guesses nothing', () => {
  const search = src('lib/platform/docu/search.ts');
  assert.match(search, /\[\/supplier\\s\*credit\\s\*\(\?:notes\?\|memos\?\)\/, 'supplier_credit_note'\],/);
  assert.match(search, /\[\/customer\\s\*credit\\s\*requests\?\/, 'customer_credit_request'\],/);
  assert.match(search, /\[\/customer\\s\*credit\\s\*\(\?:notes\?\|memos\?\)\/, 'customer_credit_note'\],/);
  // A BARE "credit notes" names no side, and the three types differ by exactly
  // which side they are on. It keeps its pre-existing keyword-flag behaviour
  // and finds all three rather than guessing one — and a precise type filter
  // must NOT also be ANDed with that keyword guess.
  assert.match(search, /else if \(!parsed\.docType && \/credit\/\.test\(lower\)\) parsed\.flag = 'credit_note';/);
  // The specific phrases are asked BEFORE the generic ones — this list stops at
  // the first match, the same ordering rule "expense receipts" already relies on.
  assert.ok(search.indexOf("'supplier_credit_note'") < search.indexOf("'delivery_note'"));
});

test('23. ANALYTICS: a credit never raises "unusual spend"', () => {
  // "Above the usual range for this supplier" said about a REFUND is the exact
  // inversion this feature exists to stop, wearing a warning badge — `docTotal`
  // sums the lines as printed, so CRN0012368's R335.00 coming back would read
  // as R335.00 going out.
  const flags = src('lib/platform/docu/flags.ts');
  assert.match(
    flags,
    /const total =\s*\n\s*doc\.document_type === 'order' \|\| isCreditDocumentType\(doc\.document_type\) \|\| isFinancialOnly\(doc\)/,
  );
  // The existing two exclusions are still there beside it — this extended the
  // gate, it did not replace it.
  assert.match(flags, /doc\.document_type === 'order'/);
  assert.match(flags, /isFinancialOnly\(doc\)/);
});

test('23b. the credit block reaches the row on BOTH lanes, with the direction stamped beside it', () => {
  for (const path of ['lib/platform/document-ingest.ts', 'app/api/ai/extract/route.ts']) {
    const text = src(path);
    assert.match(text, /credit_document: isCredit \? (cls|result)\.credit_document : null,/, path);
    assert.match(text, /financial_effect: financialEffect,/, path);
  }
  // And the block is gated on the TYPE in the reader, so a `credit_document`
  // filled on an invoice — a statement about the reader's confusion, not about
  // the invoice — is dropped rather than stored.
  assert.match(
    src('lib/ai/anthropic.ts'),
    /const creditDocument = CREDIT_TYPES\.has\(parsed\.document_type \?\? ''\)\s*\n\s*\? coerceCreditDocument\(parsed\.credit_document\)\s*\n\s*: null;/,
  );
  // A shape check on the fixtures, so the two blocks above are known to be the
  // ones the review card renders.
  assert.equal(typeof supplierCredit.credit_document?.credit_reference, 'string');
  assert.equal(customerCreditRequest.financial_effect, 'pending_credit_request');
});

test('23c. a credit is NEVER escalated to the order lane — not even carrying a PO number', () => {
  // Credit Request 6275 prints "PO 144426" on its face, because naming the
  // purchase order behind the original invoice is WHAT A CREDIT REQUEST IS FOR.
  // `hasOrderCue` therefore fires on essentially every well-formed credit, and
  // an escalation the order lane won would retype the document 'order', build
  // an OrderFlow order and draw an invoice number from the shared counter — out
  // of a document asking for money back.
  for (const type of CREDIT_DOCUMENT_TYPES) {
    assert.equal(
      decideClassificationRouting({
        document_type: type,
        overall_confidence: 41,
        supplier: 'Riverbend Casino Resort',
        bill_to: null,
        fields: [{ label: 'PO', value: 'PO 144426' }],
        structure_audit: { status: 'needs_review' },
      }),
      'accept',
      type,
    );
  }
  // The controls: the arms either side of it are untouched. An unknown-type
  // read that looks order-shaped still earns its second opinion, and a receipt
  // still escalates on evidence alone.
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: 41,
      structure_audit: { status: 'needs_review' },
    }),
    'escalate_order',
  );
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 41,
      fields: [{ label: 'Ref', value: 'purchase order 991' }],
      structure_audit: { status: 'needs_review' },
    }),
    'escalate_order',
  );
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 41,
      structure_audit: { status: 'needs_review' },
    }),
    'accept',
  );
});

test('23d. the mailbox tags an amendment as EVIDENCE and never suppresses it', () => {
  const graph = src('lib/platform/microsoft-graph-ingest-core.ts');
  assert.match(graph, /if \(AMENDMENT_REQUEST_RE\.test\(combined\)\) evidence\.push\('message:order-amendment-request'\);/);
  // NOT on `excludedIntent` — those tags mean "file nothing", and suppressing
  // the PO 144583 message would lose it entirely: the reviewer would never see
  // that the customer asked for Wednesday.
  const excluded = /const excludedIntent = ([^;]+);/.exec(graph)?.[1] ?? '';
  assert.ok(excluded.length > 0);
  assert.equal(excluded.includes('amendment'), false);
  // And the mailbox stays GET-only: no Graph write verb was added.
  for (const verb of ['PATCH', 'DELETE', 'POST /me/messages', 'sendMail', 'move']) {
    assert.equal(graph.includes(`'${verb}'`), false, verb);
  }
});
