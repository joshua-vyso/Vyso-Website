import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  businessEffectForType,
  documentBusinessEffect,
  financialEffectForType,
  isCreditDocumentType,
  isFinancialOnly,
} from '../lib/platform/docu/business-effect.ts';
import { hubdocEligibility } from '../lib/platform/hubdoc-shared.ts';
import { DOC_TYPES, DOC_TYPE_LABEL, DEFAULT_FOLDER_NAMES, documentTypeLabel } from '../lib/platform/documents.ts';
import { decideClassificationRouting } from '../lib/platform/docu/classification-policy.ts';
import { isOrderAmendmentDocument } from '../lib/platform/docu/order-amendment.ts';
import type { DocumentType } from '../lib/platform/types.ts';

// ---------------------------------------------------------------------------
// A R643.10 restaurant slip and a R643.10 EFT confirmation are not the same row.
//
// THE BUG THIS CLOSES. components/platform/orderflow/PaymentsView.tsx attached
// proof of payment by inserting a `documents` row with document_type 'receipt'
// — a value in no `DocumentType` union anywhere, and (verified by a read-only
// probe against production) REFUSED by documents_document_type_check. Every
// attach threw 23514 and surfaced as "Could not save the receipt."; production
// holds ZERO rows of it, so there is nothing to migrate.
//
// AND THE OBVIOUS FIX WAS WRONG. `expense_receipt` means the business consumed
// something and paid for it, and IS the record of that expense — nothing else
// in Vyso recognises it. A payment proof is evidence for a payment the org
// RECEIVED, whose amount, method, date and reference already sit in
// `of_payments`. Reusing the expense type would recognise an expense for a
// customer's payment.
// ---------------------------------------------------------------------------

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The source with its comments removed — these files NAME the things they
 *  refuse to do, and a plain substring search finds the prose that promises a
 *  property and mistakes it for a violation of it. */
const code = (path: string) =>
  src(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const PAYMENTS_VIEW = 'components/platform/orderflow/PaymentsView.tsx';

// ---------------------------------------------------------------------------
// 1–2. It persists as payment_proof, and 'receipt' is gone.
// ---------------------------------------------------------------------------

test('1. PaymentsView persists proof of payment as `payment_proof`', () => {
  const view = code(PAYMENTS_VIEW);
  assert.match(view, /document_type: 'payment_proof',/);
  // Written at status 'reviewed' and linked to the payment it proves — the
  // whole reason this type is not in the classification prompt: the screen
  // already knows which of_payments row the file belongs to.
  assert.match(view, /status: 'reviewed',/);
  assert.match(view, /entity_type: 'payment',/);
  assert.match(view, /entity_id: payment\.id,/);
  assert.match(view, /\.update\(\{ receipt_document_id: inserted\.id \}\)/);
});

test("2. 'receipt' is retired from that path entirely, and never became expense_receipt", () => {
  const view = code(PAYMENTS_VIEW);
  assert.equal(/document_type: 'receipt'/.test(view), false, "'receipt' must be gone");
  assert.equal(
    /document_type: 'expense_receipt'/.test(view),
    false,
    'a payment the org RECEIVED must never be filed as an expense it paid',
  );
  // And nothing anywhere else writes the dead value either.
  for (const path of [
    'lib/platform/document-ingest.ts',
    'app/api/ai/extract/route.ts',
    'components/platform/orderflow/AttachDocuments.tsx',
    'components/platform/orderflow/DeliveryNoteDetail.tsx',
  ]) {
    assert.equal(/document_type: 'receipt'/.test(code(path)), false, path);
  }
});

// ---------------------------------------------------------------------------
// 3. Accepted by the compile-forced maps and the UI lists.
// ---------------------------------------------------------------------------

test('3. every map and list accepts it — and gives it its OWN identity, not the receipt pile', () => {
  assert.equal(DOC_TYPE_LABEL.payment_proof, 'Payment proof');
  assert.notEqual(DOC_TYPE_LABEL.payment_proof, DOC_TYPE_LABEL.expense_receipt);
  assert.equal(documentTypeLabel({ document_type: 'payment_proof', extracted_data: null }), 'Payment proof');

  const tile = DOC_TYPES.find((t) => t.key === 'payment_proof');
  assert.ok(tile, 'payment_proof has a tile, folder and filter chip');
  assert.equal(tile?.label, 'Payment proofs');
  // A separate folder from expense receipts: a bookkeeper hunting for proof of
  // a customer's EFT must not have to read forty lunch slips to find it.
  assert.ok(DEFAULT_FOLDER_NAMES.includes('Payment proofs'));
  assert.ok(DEFAULT_FOLDER_NAMES.includes('Expense receipts'));
  assert.notEqual(tile?.iconBg, DOC_TYPES.find((t) => t.key === 'expense_receipt')?.iconBg);

  // Compile-forced Record sites carry it (a missing member would not compile,
  // but assert the VALUE, which nothing forces).
  assert.equal(businessEffectForType('payment_proof'), 'financial_only');
  const routing = src('lib/platform/docu/routing.ts');
  assert.match(routing, /^\s*payment_proof: \[\],$/m);

  // The agent can search for it.
  assert.match(src('lib/ai/finch/docu-data.ts'), /^\s*'payment_proof',$/m);
  assert.match(src('lib/ai/finch/tools.ts'), /^\s*'payment_proof',$/m);
});

// ---------------------------------------------------------------------------
// 4. It does NOT route as an expense receipt.
// ---------------------------------------------------------------------------

test('4. it does not route as an expense receipt anywhere the TYPE decides', () => {
  // The receipt review card — the screen that asks a reviewer to pick an
  // expense category and states "Financial impact: Expense recognised" — is
  // gated on `expense_receipt` alone. A bank pop must never draw it.
  const panel = code('components/platform/docu/DocumentDetailPanel.tsx');
  assert.match(panel, /doc\.document_type === 'expense_receipt' \? \(/);
  assert.equal(panel.includes("=== 'payment_proof'"), false);
  // The expenses review pile is likewise expense_receipt-only.
  assert.match(
    code('lib/platform/review-queue-shared.ts'),
    /if \(row\.document_type === 'expense_receipt'\) return 'docu:expenses';/,
  );
  // And search does not let "payment receipt" fall through to the expense arm —
  // the conflation this type exists to prevent, reproduced in a search box.
  const search = src('lib/platform/docu/search.ts');
  assert.ok(
    search.indexOf("'payment_proof'") < search.indexOf("'expense_receipt'"),
    'the payment phrases must be asked before the bare receipts? alternative',
  );
  assert.match(search, /payment\\s\*proofs\?\|proof\\s\*of\\s\*payment\|payment\\s\*receipts\?\|remittance/);
});

test('4b. THE PIN: same amount, two documents, two different meanings', () => {
  // A R643.10 restaurant slip. The document IS the expense record — nothing
  // else in Vyso holds that figure.
  const expense = {
    document_type: 'expense_receipt' as DocumentType,
    extracted_data: {
      fields: [],
      business_effect: 'financial_only' as const,
      financial_document: {
        merchant: 'Hillcrest Country Club',
        receipt_reference: 'T-4417',
        receipt_datetime: '2026-08-14 13:22',
        member_or_account: '',
        subtotal: '560.09',
        gratuity: '',
        tax_amount: '83.01',
        total: '643.10',
        currency: 'R',
        payment_method: 'Member account',
        funding_account: '',
        opening_balance: '',
        settlement_amount: '',
        closing_balance: '',
        expense_category: 'Meals & entertainment',
        notes: '',
        // 'unknown', not 'prefund_drawdown': the slip prints no opening or
        // closing balance, so nothing here is evidence of a bank movement on
        // any date. See `CashEffect`.
        cash_effect: 'unknown' as const,
      },
    },
  };
  // A R643.10 EFT confirmation for a customer's payment. `of_payments` already
  // holds the amount, method, date and reference; this file is the paperwork.
  const proof = {
    document_type: 'payment_proof' as DocumentType,
    extracted_data: { fields: [], business_effect: 'financial_only' as const },
  };

  // They agree on the ONE thing the effect dimension is asked: neither moves
  // stock, orders or suppliers. Every reader of that value uses it to refuse
  // work; not one reads it as "therefore an expense exists".
  assert.equal(isFinancialOnly(expense), true);
  assert.equal(isFinancialOnly(proof), true);
  assert.equal(documentBusinessEffect(proof), 'financial_only');

  // And they disagree on everything the TYPE decides.
  assert.notEqual(expense.document_type, proof.document_type);
  assert.notEqual(DOC_TYPE_LABEL.expense_receipt, DOC_TYPE_LABEL.payment_proof);
  // The expense carries the block that recognises it; the proof carries none,
  // because there is no expense here to recognise.
  assert.ok('financial_document' in expense.extracted_data);
  assert.equal('financial_document' in proof.extracted_data, false);
  // A payment proof is not a credit either — it moves nothing in either
  // direction on its own.
  assert.equal(isCreditDocumentType('payment_proof'), false);
  assert.equal(financialEffectForType('payment_proof'), null);
});

// ---------------------------------------------------------------------------
// 5–9. No stock, spend, revenue, order, invoice, customer, supplier, Xero or
//      payment automation.
// ---------------------------------------------------------------------------

test('5. ANALYTICS: payment_proof is absent from every operational allow-list', () => {
  // Mirrors the credit-type assertions exactly, and for the same reason: each
  // of these is a hand-maintained list, so "excluded by default" is a property
  // that has to be re-checked every time somebody widens one.
  const lists: Array<[string, RegExp]> = [
    ['lib/platform/procurepulse-feed.ts', /FEED_TYPES = new Set\(\['invoice', 'statement', 'delivery_note'\]\)/],
    ['lib/platform/supplysync-feed.ts', /SPEND_DOC_TYPES = \['invoice', 'statement'\] as const/],
    ['lib/platform/supplysync-pricing.ts', /PRICED_DOC_TYPES = new Set\(\['invoice', 'price_list', 'statement'\]\)/],
    ['lib/platform/price-watch/run.ts', /PRICED_DOC_TYPES = \['invoice', 'statement', 'price_list'\] as const/],
    ['lib/platform/doc-watch/detect.ts', /WATCHED_DOC_TYPES = \['invoice', 'statement', 'price_list'\] as const/],
    ['app/api/procurepulse/sync-all/route.ts', /FEED_TYPES = \['invoice', 'statement', 'delivery_note'\]/],
    ['lib/platform/hubdoc-shared.ts', /HUBDOC_DOCUMENT_TYPES: readonly string\[\] = \['invoice', 'statement'\]/],
  ];
  for (const [path, pattern] of lists) {
    const text = src(path);
    assert.match(text, pattern, path);
    assert.equal((pattern.exec(text)?.[0] ?? '').includes('payment_proof'), false, `${path} must not list it`);
  }
  // Hubdoc's own verdict, not merely the absence of the string.
  const verdict = hubdocEligibility({
    documentType: 'payment_proof',
    status: 'reviewed',
    supplierId: 'sup-1',
    storagePath: 'org/eft.pdf',
  });
  assert.equal(verdict.ok, false);
});

test('6. the side-effect choke point refuses it before the order branch', () => {
  // `isFinancialOnly` is the FIRST thing runDocumentSideEffects asks — before
  // the order branch, before any feature lookup, before anything can write. So
  // even a payment proof that somehow reached a commit path (a re-typed
  // document, a future caller) creates no order, invoice, stock movement,
  // supplier row or SupplySync history.
  assert.equal(isFinancialOnly({ document_type: 'payment_proof', extracted_data: null }), true);
  const ingest = code('lib/platform/document-ingest.ts');
  const gate = ingest.indexOf("if (isFinancialOnly(doc)) return { skipped: 'financial_only' };");
  assert.ok(gate > 0);
  for (const after of [
    'if (doc.document_type === \'order\')',
    'syncOrderFromDocument(',
    'feedDocumentToProcurePulse(',
    'feedDocumentToSupplySync(',
  ]) {
    const at = ingest.indexOf(after);
    assert.ok(at > 0, after);
    assert.ok(gate < at, `${after} must sit after the financial-only gate`);
  }
});

test('7. no customer, supplier, Xero or payment automation is triggered by the document', () => {
  // SCOPED TO `ReceiptCell`, not the whole file — PaymentModal lives in the
  // same module and legitimately inserts an `of_payments` row when a human
  // records a payment. That is the human recording money; this test is about
  // what ATTACHING A FILE is allowed to do, which is a strictly smaller thing.
  const view = code(PAYMENTS_VIEW);
  const start = view.indexOf('function ReceiptCell(');
  assert.ok(start > 0, 'ReceiptCell exists');
  const cell = view.slice(start);

  // The attach writes exactly three things: the documents row, the link back
  // onto of_payments, and an activity entry. No invoice is settled, no
  // allocation is made, no payment is created or amended from the FILE.
  assert.equal((cell.match(/\.insert\(/g) ?? []).length, 1);
  // TWO `documents` references, and they are different things: the Storage
  // bucket the bytes go into, and the table the row goes into. Asserted apart
  // so the count cannot be satisfied by the wrong one.
  assert.equal((cell.match(/storage\s*\n?\s*\.from\('documents'\)/g) ?? []).length, 1);
  assert.equal((cell.match(/supabase\s*\n?\s*\.from\('documents'\)/g) ?? []).length, 1);
  const updates = cell.match(/\.update\(\{[^}]*\}\)/g) ?? [];
  assert.deepEqual(updates, ['.update({ receipt_document_id: inserted.id })']);
  // Nothing in this path reaches Xero, the ledger, or a supplier/customer write.
  for (const forbidden of ['xero', 'of_invoices', 'of_customers', "from('suppliers')", 'ss_suppliers', 'pp_stock']) {
    assert.equal(cell.toLowerCase().includes(forbidden.toLowerCase()), false, `${forbidden} must not appear`);
  }
  // customer_id is COPIED from the payment, never resolved or created.
  assert.match(cell, /customer_id: payment\.customer_id \?\? null,/);
  // The activity entry is a log line, not a state change.
  assert.match(cell, /event: 'document_attached',/);
});

test('8. it never enters the review queue, and could do nothing if it did', () => {
  // The queue reads status in ('extracted','pending','error'); PaymentsView
  // files at 'reviewed', so a payment proof is never offered for approval.
  assert.match(src('lib/platform/review-queue.ts'), /\.in\('status', \['extracted', 'pending', 'error'\]\)/);
  assert.match(code(PAYMENTS_VIEW), /status: 'reviewed',/);
  // And the belt to that brace: `commitDocument` claims only extracted/pending,
  // and the choke point above refuses a financial-only document regardless. A
  // batch approve that somehow included one is a no-op, not a stock movement.
  assert.match(src('lib/platform/document-ingest.ts'), /reviewClaimableOr/);
});

test('9. it is not an order, not an amendment, and never reaches the order lane', () => {
  assert.equal(isOrderAmendmentDocument({ document_type: 'payment_proof', extracted_data: null }), false);
  // A payment proof carries a payment REFERENCE, which is exactly the shape
  // `hasOrderCue` looks for — but the classifier can never emit this type
  // (deliberately absent from ExtractedDocType and the prompt enum), so no
  // escalation decision is ever made about one. Assert the omission is real.
  const anthropic = src('lib/ai/anthropic.ts');
  assert.equal(anthropic.includes("| 'payment_proof'"), false, 'not in ExtractedDocType');
  assert.equal(anthropic.includes('| "payment_proof"'), false, 'not in the prompt enum');
  // And the omission is EXPLAINED, so the next person does not "fix" it.
  assert.match(anthropic, /`payment_proof` IS THE ONE DELIBERATE OMISSION/);
  // Sanity: the routing policy still behaves for the types it does see.
  assert.equal(decideClassificationRouting({ document_type: 'order', overall_confidence: 20 }), 'accept');
});

// ---------------------------------------------------------------------------
// 10. The expense-receipt lane is untouched.
// ---------------------------------------------------------------------------

test('10. expense_receipt behaviour is byte-for-byte unchanged', () => {
  assert.equal(businessEffectForType('expense_receipt'), 'financial_only');
  assert.equal(DOC_TYPE_LABEL.expense_receipt, 'Expense receipt');
  assert.match(src('lib/platform/docu/routing.ts'), /^\s*expense_receipt: \[\],$/m);
  // Its escalation arm — accept on the two cheap signals' silence, escalate on
  // evidence only — is exactly as it was.
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 41,
      structure_audit: { status: 'needs_review' },
    }),
    'accept',
  );
  assert.equal(
    decideClassificationRouting({
      document_type: 'expense_receipt',
      overall_confidence: 41,
      fields: [{ label: 'Ref', value: 'purchase order 991' }],
    }),
    'escalate_order',
  );
  // Still the ONLY type whose review pile is docu:expenses, and still the only
  // type that draws ReceiptReviewCard.
  const panel = code('components/platform/docu/DocumentDetailPanel.tsx');
  assert.equal((panel.match(/'expense_receipt'/g) ?? []).length, 1);
  assert.match(panel, /<ReceiptReviewCard/);
});
