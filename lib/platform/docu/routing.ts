/**
 * Push-to-module routing (feature 10). Recommends which Vyso modules a document
 * should feed, by document type. Labels come from the shared MODULES registry.
 */
import { MODULE_BY_KEY } from '@/lib/platform/modules';
import type { DocumentType, FeatureKey } from '@/lib/platform/types';
import type { ModuleRoute } from './types';

const RULES: Record<DocumentType, { key: FeatureKey; reason: string; recommended: boolean }[]> = {
  invoice: [
    { key: 'pricepilot', reason: 'Track unit prices and margin', recommended: true },
    { key: 'procurepulse', reason: 'Update stock + spend', recommended: true },
    { key: 'suppliers', reason: 'File on the supplier profile + spend history', recommended: true },
  ],
  statement: [
    { key: 'procurepulse', reason: 'Reconcile stock from market lines', recommended: true },
    { key: 'suppliers', reason: 'File on the supplier profile + spend history', recommended: true },
    { key: 'reportgen', reason: 'Feed spend analytics', recommended: false },
  ],
  delivery_note: [
    { key: 'procurepulse', reason: 'Confirm received stock', recommended: true },
    { key: 'suppliers', reason: 'Log on the supplier timeline', recommended: false },
    { key: 'wastelog', reason: 'Flag shrinkage vs ordered', recommended: false },
  ],
  price_list: [
    { key: 'pricepilot', reason: 'Refresh supplier price benchmarks', recommended: true },
    { key: 'suppliers', reason: 'Track pricing intel on the profile', recommended: false },
  ],
  order: [
    { key: 'orderflow', reason: 'Track the purchase order', recommended: true },
    { key: 'procurepulse', reason: 'Forecast incoming stock', recommended: false },
  ],
  // EMPTY, AND THE EMPTINESS IS THE FEATURE. An expense receipt feeds no module:
  // there is no stock in a lunch, no supplier behind the restaurant, no order to
  // track and no price worth benchmarking. `getRoutes` returns [] and the
  // "Push to…" menu draws nothing, so the screen offers no button whose only
  // possible outcome is the contamination `runDocumentSideEffects` refuses one
  // layer down. `RULES` is a `Record<DocumentType, …>`, so this entry is not
  // optional — which is the point: a sixth document type cannot be added without
  // someone answering this question in writing.
  expense_receipt: [],
  // EMPTY FOR THE SAME REASON, ONE STEP FURTHER ALONG. A credit note is not
  // nothing — it is a real financial document with a real counterparty — but
  // there is no module here it can be PUSHED into without lying. ProcurePulse
  // would take its lines as stock received; PricePilot would take its rates as
  // a price observation; the SupplySync entry it does deserve is written by the
  // feed at commit, not by a person choosing it off a menu. CRN0012368 became a
  // positive 335.00 invoice line precisely because every shape-keyed list said
  // yes to it, and a "Push to…" menu is one more list that would.
  //
  // The reviewer is not left with nothing: `CreditReviewCard` states the credit,
  // its references and which way it points, and the document files against the
  // supplier or the customer like any other. What is refused is the button whose
  // only possible outcome is a credit counted as a purchase.
  supplier_credit_note: [],
  customer_credit_request: [],
  customer_credit_note: [],
  // EMPTY, AND HERE THE EMPTINESS IS ALMOST TAUTOLOGICAL. A payment proof is
  // paperwork behind a payment OrderFlow has already recorded — there is no
  // module left to push it into, because the one module that cares about it
  // already has it, linked by `of_payments.receipt_document_id`. Offering
  // "Push to ProcurePulse" on a bank pop would be offering to turn a customer's
  // EFT into stock.
  payment_proof: [],
};

export function getRoutes(docType: DocumentType | null): ModuleRoute[] {
  if (!docType) return [];
  return (RULES[docType] ?? []).map((r) => ({
    key: r.key,
    label: MODULE_BY_KEY[r.key]?.label ?? r.key,
    reason: r.reason,
    recommended: r.recommended,
  }));
}
