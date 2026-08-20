/**
 * Which way does this document point — did somebody invoice US, or did WE
 * invoice somebody?
 *
 * WHY THIS EXISTS. A photographed Turn 'n Slice invoice — TnS letterhead, TnS
 * logo, "Invoice To: Investec Bank Limited" — was filed as a SUPPLIER invoice
 * with "Turn n Slice HQ (Pty) Ltd" created as the supplier. The org became its
 * own vendor: its own selling prices went into supplier price history, its own
 * sales counted as spend, and the customer it had actually invoiced appeared
 * nowhere.
 *
 * `resolveSupplierProfile` already refuses to make a supplier out of the org's
 * own name, but only on EXACT normalised equality. The org is registered as
 * "Turn 'n Slice"; the letterhead reads "Turn n Slice HQ (Pty) Ltd". After
 * normalisation that is "turn n slice" vs "turn n slice hq" — one token apart,
 * so the guard did not fire. Exact equality is the right rule for "is this
 * string literally us"; it is the wrong rule for "is this letterhead ours".
 *
 * THE RULE (Josh's): anything with the org's own identity in the ISSUER
 * position is FROM the org TO a customer. So read the counterparty off the
 * page, match it against the org's existing customers, and link it if — and
 * only if — exactly one customer clearly matches. Never invent a customer,
 * never auto-create one, never fall back to the org itself.
 *
 * CONSERVATIVE BY CONSTRUCTION. Every uncertain case returns 'unknown', which
 * means "behave exactly as before". A document wrongly called outgoing loses
 * its supplier link; a document wrongly called incoming is the bug above. Both
 * are worse than saying nothing, so this module only speaks when the org's own
 * identity is recognisably in the issuer position and the other side is not.
 *
 * PURE. No I/O, no Supabase, no model calls — identity and customers come in as
 * plain values, a verdict comes out. The data reads live in
 * `lib/platform/document-ingest.ts`; the wiring lives at the two extraction
 * call sites.
 *
 * `.ts`-suffixed relative import: `node --test` strips types but does NOT
 * resolve extensionless ESM specifiers or the `@/` alias, and this module is
 * loaded directly by tests/docu-document-direction.test.ts.
 */
import { diceCoefficient } from '../procurepulse/matching.ts';

export type DocumentDirection = 'incoming' | 'outgoing' | 'unknown';

/**
 * How close a name must sit to the org's own before we call the document ours.
 *
 * 0.85 on token-set Dice is one extra token on a three-token name
 * ("turn n slice" vs "turn n slice hq" = 0.857) and no more. It deliberately
 * does NOT reach the case the supplier guard's comment warns about — org
 * "Fresh Valley Produce" vs supplier "Valley Produce" scores 0.8 and stays a
 * legitimate supplier.
 */
export const ORG_IDENTITY_DICE = 0.85;

/**
 * How close the "Invoice To" name must sit to an existing customer before we
 * link it. Looser than the identity threshold because the cost is different:
 * a wrong identity call mis-files the whole document, whereas a wrong customer
 * link is one visible field a human corrects in the review pane. Still high
 * enough that "Investec Bank Limited" cannot land on "Investment Holdings".
 */
export const COUNTERPARTY_DICE = 0.75;

/** Two candidates this close together are not a winner and a runner-up. */
const AMBIGUOUS_MARGIN = 0.01;

/** Below this many characters a normalised name is too thin to identify anyone. */
const MIN_IDENTITY_CHARS = 3;

/** Below this many digits a "VAT number" is not one. SA VAT numbers are 10. */
const MIN_VAT_DIGITS = 8;

/** The sentence the review screen shows when we know we issued it but not to whom. */
export const OUTGOING_UNMATCHED_NOTE = 'Outgoing invoice — customer not recognised';

/**
 * Comparison key for a business name. Mirrors `normalizeSupplierName`
 * (lib/platform/supplysync-feed.ts) — lowercase, drop parentheticals, drop
 * punctuation, drop legal suffixes — and is written here rather than imported
 * because that module reaches for the `@/` alias, which the test runner cannot
 * resolve. Any change to one belongs in both.
 *
 * "&" folds to "and" so "Dice & Dine" and "Dice and Dine" agree, and the result
 * is space-separated so `diceCoefficient` can split it into tokens.
 */
export function normaliseParty(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pty|ltd|limited|proprietary|cc|inc|bpk|edms|npc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Digits only — VAT numbers are printed with spaces, slashes and prefixes. */
export function normaliseVat(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= MIN_VAT_DIGITS ? digits : '';
}

/**
 * Who the org is, as far as the database knows.
 *
 * `legalName` is `organisations.name` (always present); `tradingName` and
 * `vatNumber` are `cd_company_profile.company_name` / `.vat_number`, which most
 * orgs fill in during onboarding and some never do. Note that OrderFlow's
 * `of_settings` carries numbering and VAT RATES, not the business's identity —
 * the identity lives in Core Data's company profile.
 */
export interface OrgIdentity {
  legalName: string | null;
  tradingName: string | null;
  vatNumber: string | null;
}

/** How the org's own identity was recognised on the page. */
export type IdentityMatchKind = 'legal_name' | 'trading_name' | 'vat_number';

export interface IdentityHit {
  kind: IdentityMatchKind;
  /** Dice score for a name match, or 1 for an exact VAT match. */
  score: number;
}

/**
 * Does this party look like the org itself?
 *
 * A VAT number is checked first and exactly: two businesses cannot share one,
 * so an exact match is proof rather than evidence. Names then fall back to
 * token-set Dice against both the legal and the trading name, whichever reads
 * higher — an org registered as "Turn 'n Slice" that trades as "Turn n Slice
 * HQ" should be recognised under either.
 *
 * `vatNumber` is the VAT number printed against THIS party specifically. It is
 * never the "a VAT number appears somewhere on the page" number: an incoming
 * supplier invoice prints the org's own VAT number in its Bill To block, and
 * treating that as proof of authorship would invert every document the org
 * receives.
 */
export function matchesOrgIdentity(
  name: string | null | undefined,
  vatNumber: string | null | undefined,
  identity: OrgIdentity,
): IdentityHit | null {
  const orgVat = normaliseVat(identity.vatNumber);
  const partyVat = normaliseVat(vatNumber);
  if (orgVat && partyVat && orgVat === partyVat) return { kind: 'vat_number', score: 1 };

  const party = normaliseParty(name);
  if (party.length < MIN_IDENTITY_CHARS) return null;

  let best: IdentityHit | null = null;
  const consider = (candidate: string | null, kind: IdentityMatchKind) => {
    const norm = normaliseParty(candidate);
    if (norm.length < MIN_IDENTITY_CHARS) return;
    const score = diceCoefficient(norm, party);
    if (score < ORG_IDENTITY_DICE) return;
    if (!best || score > best.score) best = { kind, score };
  };
  consider(identity.legalName, 'legal_name');
  consider(identity.tradingName, 'trading_name');
  return best;
}

/** Everything the direction call needs, all of it already extracted. */
export interface DirectionInput {
  /** `ExtractionResult.supplier` — the selling/issuing party, by prompt definition. */
  issuer: string | null;
  /** `ExtractionResult.supplier_vat` — the VAT number printed against the issuer. */
  issuerVatNumber?: string | null;
  /** `ExtractionResult.bill_to` — the party under "Invoice To"/"Bill To". */
  billTo: string | null;
  identity: OrgIdentity;
}

export interface DirectionVerdict {
  direction: DocumentDirection;
  /** How the org was recognised in the issuer position; null unless outgoing. */
  matchedOn: IdentityMatchKind | null;
  /** The identity score behind an outgoing verdict; null otherwise. */
  score: number | null;
  /** One line saying why, for the log and for a human reading the record. */
  reason: string;
}

/**
 * Incoming, outgoing, or don't know.
 *
 * The order of these checks is the whole argument:
 *
 *   1. We do not know who the org is  → unknown. Nothing to compare against.
 *   2. The issuer is not the org      → incoming. The ordinary case, unchanged.
 *   3. Nobody issued it               → unknown. There is no letterhead to read.
 *   4. BOTH sides look like the org   → unknown. An intra-group document, or a
 *      misread — either way this module has no business picking a side.
 *   5. The issuer is the org          → outgoing.
 *
 * Case 2 comes before case 4 on purpose: the common path must not pay for the
 * rare one, and an ordinary supplier invoice never reaches the ambiguity check.
 */
export function resolveDocumentDirection(input: DirectionInput): DirectionVerdict {
  const { identity } = input;
  const hasName =
    normaliseParty(identity.legalName).length >= MIN_IDENTITY_CHARS ||
    normaliseParty(identity.tradingName).length >= MIN_IDENTITY_CHARS;
  if (!hasName && !normaliseVat(identity.vatNumber)) {
    return { direction: 'unknown', matchedOn: null, score: null, reason: 'the org has no name or VAT number on file' };
  }

  const issuerHit = matchesOrgIdentity(input.issuer, input.issuerVatNumber, identity);
  if (!issuerHit) {
    if ((input.issuer ?? '').trim()) {
      return { direction: 'incoming', matchedOn: null, score: null, reason: 'the issuing party is not this org' };
    }
    return { direction: 'unknown', matchedOn: null, score: null, reason: 'no issuing party was read' };
  }

  if (matchesOrgIdentity(input.billTo, null, identity)) {
    return {
      direction: 'unknown',
      matchedOn: null,
      score: null,
      reason: 'both the issuer and the bill-to party look like this org',
    };
  }

  return {
    direction: 'outgoing',
    matchedOn: issuerHit.kind,
    score: issuerHit.score,
    reason: `the issuing party is this org (${issuerHit.kind})`,
  };
}

// ---------------------------------------------------------------------------
// The counterparty on an outgoing document
// ---------------------------------------------------------------------------

/** An `of_customers` row, thinned to what matching needs. */
export interface CounterpartyCandidate {
  id: string;
  name: string;
}

export type CounterpartyMissReason = 'no_name' | 'no_customers' | 'below_threshold' | 'ambiguous';

export interface CounterpartyMatch {
  customerId: string | null;
  /** The CUSTOMER ROW's name (verified), not the string on the paper. */
  customerName: string | null;
  score: number | null;
  /** Why there is no match. Null when there is one. */
  missReason: CounterpartyMissReason | null;
}

const NO_MATCH = (missReason: CounterpartyMissReason): CounterpartyMatch => ({
  customerId: null,
  customerName: null,
  score: null,
  missReason,
});

/**
 * Match the "Invoice To" name against the org's existing customers — one
 * unambiguous winner, or nothing.
 *
 * Deliberately NOT `matchCustomer` from orderflow-from-doc.ts. That function
 * exists to get an uploaded customer ORDER onto a customer, and it is allowed
 * to be generous (it scores containment at 85 and token overlap from 55) —
 * because the very next thing it does, when it fails, is CREATE the customer.
 * Here failure must mean "leave it blank": Josh's rule is that a counterparty
 * is matched or absent, never invented and never auto-created. So this is the
 * strict version — exact name, or a single clear Dice winner, or null.
 *
 * A near-tie is a miss, not a coin flip. If two customers score within
 * `AMBIGUOUS_MARGIN` of each other the answer is 'ambiguous' and a human picks.
 */
export function matchCounterparty(
  rawName: string | null | undefined,
  customers: CounterpartyCandidate[],
): CounterpartyMatch {
  const wanted = normaliseParty(rawName);
  if (!wanted) return NO_MATCH('no_name');
  if (customers.length === 0) return NO_MATCH('no_customers');

  const scored = customers
    .map((c) => ({ c, norm: normaliseParty(c.name) }))
    .filter((r) => r.norm.length > 0)
    .map((r) => ({ c: r.c, score: r.norm === wanted ? 1 : diceCoefficient(r.norm, wanted) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return NO_MATCH('no_customers');
  const top = scored[0];
  if (top.score < COUNTERPARTY_DICE) return NO_MATCH('below_threshold');
  if (scored.length > 1 && top.score - scored[1].score < AMBIGUOUS_MARGIN) return NO_MATCH('ambiguous');
  return { customerId: top.c.id, customerName: top.c.name, score: top.score, missReason: null };
}

// ---------------------------------------------------------------------------
// What gets written onto the document
// ---------------------------------------------------------------------------

/**
 * The verdict as it is persisted, in `documents.extracted_data.direction`.
 *
 * jsonb rather than a column for the same reason `line_audit`, `summary` and
 * `custom_type` live there: no migration, and every consumer already reads
 * `extracted_data`. Only OUTGOING documents carry a record — 'incoming' and
 * 'unknown' are the existing behaviour and write nothing, so an absent
 * `direction` means exactly what it has always meant.
 */
export interface DocumentDirectionRecord {
  direction: 'outgoing';
  /** How the org's identity was recognised on the letterhead. */
  matched_on: IdentityMatchKind;
  /** The issuer exactly as the extractor read it. Audit only — never a supplier. */
  issuer_as_read: string | null;
  /** The "Invoice To" name as printed. UNVERIFIED document text; display with care. */
  counterparty_as_read: string | null;
  /** The `of_customers` row this was linked to, or null. */
  customer_id: string | null;
  /** That row's own name — verified, safe to print. Null when unmatched. */
  customer_name: string | null;
  /** Why no customer was linked. Null when one was. */
  miss_reason: CounterpartyMissReason | null;
  /** The one-line sentence the review screen and the flag show. */
  note: string;
}

/** Assemble the stored record for an outgoing document. */
export function buildDirectionRecord(
  verdict: DirectionVerdict,
  input: Pick<DirectionInput, 'issuer' | 'billTo'>,
  match: CounterpartyMatch,
): DocumentDirectionRecord | null {
  if (verdict.direction !== 'outgoing' || !verdict.matchedOn) return null;
  return {
    direction: 'outgoing',
    matched_on: verdict.matchedOn,
    issuer_as_read: (input.issuer ?? '').trim() || null,
    counterparty_as_read: (input.billTo ?? '').trim() || null,
    customer_id: match.customerId,
    customer_name: match.customerName,
    miss_reason: match.missReason,
    note: match.customerName
      ? `Outgoing invoice — you invoiced ${match.customerName}`
      : OUTGOING_UNMATCHED_NOTE,
  };
}

/** True when a document's stored `extracted_data` says the org issued it. */
export function isOutgoingDocument(
  extracted: { direction?: DocumentDirectionRecord | null } | null | undefined,
): boolean {
  return extracted?.direction?.direction === 'outgoing';
}
