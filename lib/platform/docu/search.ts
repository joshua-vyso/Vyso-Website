/**
 * Smart search (feature 8). Parses natural-ish queries into a structured filter
 * and applies it client-side. `parseSearch` is isolated so a future
 * `/api/ai/search` (semantic) can replace it without touching callers.
 */
import type { DocumentType, DocumentWithSupplier } from '@/lib/platform/types';
import type { FlagKind, ParsedSearch } from './types';
import { docTotal } from './extract';

export const SEARCH_EXAMPLES = [
  'Metro invoices above R50k',
  'delivery notes from last week',
  'statements mentioning credit',
  'documents with price spikes',
];

const TYPE_WORDS: [RegExp, DocumentType][] = [
  // THE THREE CREDIT PHRASES GO FIRST, and the ordering is load-bearing exactly
  // as it is for "expense receipts" below: this list stops at the first match,
  // and every one of these phrases contains the bare word `notes?` that
  // `delivery\s*notes?` does not claim but `credit\s*notes?` would lose to if
  // the specific phrase were asked second. "supplier credit note" also contains
  // "credit note", so the two-sided phrases are asked before the bare one.
  [/supplier\s*credit\s*(?:notes?|memos?)/, 'supplier_credit_note'],
  [/customer\s*credit\s*requests?/, 'customer_credit_request'],
  [/credit\s*requests?/, 'customer_credit_request'],
  [/customer\s*credit\s*(?:notes?|memos?)/, 'customer_credit_note'],
  // BEFORE the bare `receipts?` alternative below, which would otherwise claim
  // "payment receipts" for `expense_receipt` — the exact conflation the type
  // exists to prevent, reproduced in a search box.
  [/payment\s*proofs?|proof\s*of\s*payment|payment\s*receipts?|remittance(?:\s*advice)?/, 'payment_proof'],
  [/delivery\s*notes?/, 'delivery_note'],
  [/price\s*lists?/, 'price_list'],
  // BEFORE the bare `receipts?` alternative it shares a suffix with, and before
  // `invoices?` for the same reason the two entries above sit where they do:
  // this list stops at the first match, so the more specific phrase has to be
  // asked first or "expense receipts" would never be reachable.
  [/(?:expense\s*)?receipts?/, 'expense_receipt'],
  [/invoices?/, 'invoice'],
  [/statements?/, 'statement'],
  [/orders?/, 'order'],
];

const OPERATOR_WORDS =
  /(invoices?|statements?|delivery\s*notes?|price\s*lists?|orders?|(?:expense\s*)?receipts?|(?:supplier|customer)?\s*credit\s*(?:notes?|memos?|requests?)|payment\s*proofs?|proof\s*of\s*payment|remittance(?:\s*advice)?|above|over|more\s*than|with|price\s*spikes?|duplicates?|credit\s*notes?|from|last\s*(?:week|month)|mentioning|r?\s*[\d.,]+\s*[km]?)/g;

export function parseSearch(query: string): ParsedSearch {
  const text = query.trim();
  const lower = text.toLowerCase();
  const parsed: ParsedSearch = { text };

  for (const [re, type] of TYPE_WORDS) {
    if (re.test(lower)) {
      parsed.docType = type;
      break;
    }
  }

  const amt = lower.match(/(?:above|over|more than|>)\s*r?\s*([\d.,]+)\s*(k|m)?/);
  if (amt) {
    let n = Number(amt[1].replace(/,/g, ''));
    if (amt[2] === 'k') n *= 1000;
    if (amt[2] === 'm') n *= 1_000_000;
    if (Number.isFinite(n)) parsed.minAmount = n;
  }

  if (/price\s*spikes?/.test(lower)) parsed.flag = 'price_spike';
  else if (/duplicates?/.test(lower)) parsed.flag = 'duplicate_invoice';
  // THE FLAG IS THE FALLBACK, NOT AN ADDITION. `credit_note` is a keyword flag
  // — it fires when the word "credit" appears anywhere in a document's filename,
  // fields or lines — and it existed because there WAS no credit document type
  // to search for. Now that there is one, asking for both would AND a precise
  // type filter together with a keyword guess, and hide a correctly typed
  // supplier credit note whose filename happens to read "CRN0012368.pdf".
  //
  // A BARE "credit notes" STILL LANDS HERE, deliberately: it names no side, and
  // the three types differ by exactly which side they are on. Guessing one of
  // them would be the Doppio mistake in a search box — so the query keeps its
  // pre-existing keyword behaviour and finds all three.
  else if (!parsed.docType && /credit/.test(lower)) parsed.flag = 'credit_note';

  return parsed;
}

/** Free-text remainder once operators are stripped — the "what" of the query. */
function freeTerms(parsed: ParsedSearch): string[] {
  return parsed.text
    .toLowerCase()
    .replace(OPERATOR_WORDS, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/**
 * Apply the parsed query. Flag filtering (`parsed.flag`) is left to the caller,
 * which already computes per-row flags for the table.
 */
export function applySearch(
  docs: DocumentWithSupplier[],
  parsed: ParsedSearch,
): DocumentWithSupplier[] {
  const terms = freeTerms(parsed);
  return docs.filter((d) => {
    if (parsed.docType && d.document_type !== parsed.docType) return false;
    if (parsed.minAmount != null) {
      const t = docTotal(d);
      if (t == null || t < parsed.minAmount) return false;
    }
    if (terms.length > 0) {
      const hay = [
        d.filename,
        d.supplier?.name ?? '',
        ...(d.extracted_data?.fields ?? []).map((f) => `${f.label} ${f.value}`),
        ...(d.extracted_data?.line_items ?? []).map((l) => l.description),
      ]
        .join(' ')
        .toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export type { FlagKind };
