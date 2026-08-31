'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
// zar2, never zar: this screen exists to expose cent-level misreadings, and
// rounding to whole rands prints 569.90 and 560.90 as the same number.
import { zar2 } from '@/lib/platform/orderflow';
import { InvoiceSheetClassic, type ClassicInvoiceParty } from '@/components/platform/orderflow/InvoiceSheetClassic';
import { mapExtractionToSheet } from '@/lib/platform/docu/invoice-from-extraction';
import type { DocuExtractedData } from '@/lib/platform/docu/types';
import {
  matchReasonLabel,
  priceSourceLabel,
  type OrderLineRecord,
} from '@/lib/platform/docu/order-line-match';
import { attachRecords, buildReviewLines } from '@/lib/platform/docu/order-review-lines';
import {
  ALIAS_SOURCE_REVIEW_CONFIRM,
  aliasKey,
  aliasProvenanceLabel,
  bubbleIsGood,
  bubbleState,
  bubbleText,
  pendingConfirmations,
  type LineConfirmation,
} from '@/lib/platform/docu/customer-item-alias';
import {
  deriveUomRuleCondition,
  describeUomAppliedLine,
  describeUomRuleCondition,
  sameRuleCondition,
  type CustomerUomRuleLite,
  type UomRuleCondition,
} from '@/lib/platform/docu/customer-uom-rules';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  countGrossMismatches,
  grossMismatch,
  lineGross,
  lineSeparatorHint,
  lineTax,
  lineTotal,
  orderSubtotal,
  reconcileDocumentTotals,
  toPrintableLines,
} from '@/lib/platform/docu/order-line-totals';
import { PrintSheetOverlay } from './PrintSheetOverlay';
import { ProductSuggestInput } from './ProductSuggestInput';
import type { ProductOption } from '@/lib/platform/docu/product-suggest';
import type { CustomerInterpretationLinePreview } from '@/lib/platform/types';
import { GRID_CELL_FOCUS, gridCell, useGridNavigation } from '@/hooks/useGridNavigation';
import type { TaxInvoicePrintContext } from './PrintTaxInvoice';

export interface CustomerLite {
  id: string;
  name: string;
}
export interface LinkedOrder {
  id: string;
  status: string;
  invoice_number: string | null;
  customer_id: string | null;
}
interface Line {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  /** Unit price verbatim from the paper, retained beside the editable canonical value. */
  raw_unit_price: string;
  /** The paper's own words, carried through edit and re-save untouched. The
   *  reviewer may rewrite `description` to whatever they like; the record of
   *  what the customer actually wrote must not be a casualty of that. */
  raw: string;
  /** The LINE TOTAL as printed in the paper's own amount column, read verbatim
   *  and never edited here. It is the independent witness the Amount column is
   *  checked against — see `grossMismatch`. Empty on the many orders that print
   *  no amounts at all. NET, on a document that separates net from VAT. */
  raw_amount: string;
  /** The row's own VAT, printed rate, tax code and VAT-INCLUSIVE total, each
   *  verbatim off the paper and never edited here. They are what let a
   *  correctly-read VAT row (net 338.00 + VAT 50.70 = total 388.70) stay silent
   *  instead of going red against its own inclusive total. Empty on every row
   *  that prints a single money column. */
  raw_tax_amount: string;
  tax_rate: string;
  tax_code: string;
  raw_total_amount: string;
  /** How the parser obtained quantity. Derived values are called out beside the
   *  row so a reviewer never mistakes arithmetic for printed evidence. */
  quantity_source: 'printed' | 'derived' | 'unresolved' | '';
  /** The EXTRACTION's confidence for this line, carried through review
   *  UNCHANGED — see the same field on `ReviewLine`. Null on a hand-added row. */
  confidence: number | null;
  /** This line's match + price provenance, when the order has been synced once.
   *  Null on a document synced before provenance existed, or a hand-added line. */
  record: OrderLineRecord | null;
  interpretation: CustomerInterpretationLinePreview | null;
}

let seq = 0;
const newKey = () => `l${++seq}`;

/** A Postgres/PostgREST complaint that a column this write names doesn't exist. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // PGRST204 — PostgREST's schema cache has no such column. 42703 — Postgres'.
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return /column .* (does not exist|of relation)/i.test(error.message ?? '');
}

/** A "relation does not exist" — the customer-ai-invoicing migration hasn't run. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message ?? '');
}

/**
 * Keystroke sanitiser for a Qty/Unit price box: strips only letters and
 * symbols a locale-formatted number could never contain, and leaves both
 * separators alone.
 *
 * FIXED BUG, DO NOT REINTRODUCE: this used to be
 * `s.replace(/[^0-9.]/g, '')` — it deleted every comma the reviewer typed, so
 * fixing a SA supplier's "269,00" by hand produced "26900" on screen, silently
 * turning a two-hundred-and-sixty-nine-rand correction into a twenty-six-
 * thousand-nine-hundred-rand one. Now it only removes what could not possibly
 * be part of a number in ANY format this reads (letters, currency symbols,
 * stray punctuation) and leaves ".", "," and whitespace (a thousands-space
 * grouping, "1 395,00") exactly as typed — interpreting them is
 * `parseAmount`'s job at compute time (via `lineGross`/`grossMismatch`, both
 * given this document's shared separator hint), never this function's.
 */
function sanitizeDecimal(s: string): string {
  return s.replace(/[^0-9.,\s]/g, '');
}

/**
 * Review screen for an uploaded customer ORDER. Confirm the customer (auto-matched
 * from the WhatsApp/email/handwritten name, or pick/create one), tidy the lines,
 * then "Confirm & invoice" → builds/finalises the OrderFlow order (which PricePilot
 * then sees as a sale).
 */
export function OrderReviewEditor({
  documentId,
  extractedData,
  initialCustomerId,
  customers,
  linkedOrder,
  orgUnits = [],
  products = [],
  printContext,
}: {
  documentId: string;
  extractedData: DocuExtractedData | null;
  /** Existing org customer resolved during read-only unattended ingestion. */
  initialCustomerId?: string | null;
  customers: CustomerLite[];
  linkedOrder: LinkedOrder | null;
  orgUnits?: string[];
  /** The org's catalogue (pp_stock_items + confirmed aliases), fetched once by
   *  the page. `ad4b49c` gave the INVOICE editor this typeahead and stopped
   *  there — but an order line is the one that gets matched to a product and
   *  priced from it, so a description typed here that differs from the
   *  catalogue's spelling is the difference between a matched line and an
   *  unpriced one. Empty is fine: the cell degrades to a plain text input,
   *  because free text was always allowed here. */
  products?: ProductOption[];
  /** Seller identity + VAT rate for the printable sheet. Absent → no Print
   *  button, because a sheet with no seller on it is not worth handing anyone. */
  printContext?: TaxInvoicePrintContext | null;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();

  // Unit options for a line: the org's units, plus the line's current value when
  // it isn't one of them (so an extracted unit is never silently dropped).
  const unitOptions = (current?: string): string[] => {
    const cur = (current ?? '').trim();
    if (cur && !orgUnits.some((u) => u.toLowerCase() === cur.toLowerCase())) return [...orgUnits, cur];
    return orgUnits;
  };

  const extractedName = extractedData?.customer_name ?? '';
  const extractedConf = extractedData?.customer_confidence ?? null;
  // Zero lines with a REASON behind them — see the empty-state block below.
  // Absent on every document filed before the source assessment existed, which
  // is why the plain wording stays the default rather than the exception.
  const canonicalOrderStatus = extractedData?.message_order_evidence?.canonical_order_status ?? null;
  const emptyLinesAreExplained =
    canonicalOrderStatus === 'unavailable' || canonicalOrderStatus === 'unsafe';
  const initialCustomer =
    (linkedOrder?.customer_id ? customers.find((c) => c.id === linkedOrder.customer_id) : null) ??
    (initialCustomerId ? customers.find((c) => c.id === initialCustomerId) : null) ??
    null;

  const [customerId, setCustomerId] = useState<string | null>(initialCustomer?.id ?? null);
  const [query, setQuery] = useState(initialCustomer?.name ?? extractedName);
  const [openList, setOpenList] = useState(false);
  // The opening rows come from `lib/platform/docu/order-review-lines.ts` — a
  // pure module, so "does this screen open on post-arithmetic numbers?" is a
  // question a unit test can answer without rendering React. See its docblock.
  const [lines, setLines] = useState<Line[]>(() => buildReviewLines(extractedData, newKey));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [doneInvoice, setDoneInvoice] = useState<string | null>(
    linkedOrder?.status === 'invoiced' ? linkedOrder.invoice_number ?? '—' : null,
  );
  const [orderId, setOrderId] = useState<string | null>(linkedOrder?.id ?? null);
  const [printing, setPrinting] = useState(false);
  /**
   * What the reviewer has confirmed on this screen, keyed by the row's React
   * key rather than its index — a row removed above shifts every index below it
   * and would otherwise hand one line's green receipt to another line.
   */
  const [confirmations, setConfirmations] = useState<Map<string, LineConfirmation>>(() => new Map());
  /** Set while the "Remember these N links" offer is being acted on. */
  const [remembering, setRemembering] = useState(false);

  // This customer's active conditional UOM rules, loaded client-side (see the
  // "CUSTOMER-SCOPED UOM RULES" section below for why this can't be a
  // server-fetched prop like `customers`/`products`: the customer this
  // document is FOR is picked live on this screen and can change without a
  // reload, and a rule set is scoped to exactly one customer).
  const [uomRules, setUomRules] = useState<CustomerUomRuleLite[]>([]);
  /**
   * Each line's unit AS EXTRACTED, captured once at mount — before any edit.
   * A UOM-rule suggestion is offered only off a genuine paper fact ("the
   * printed unit was KG and the reviewer just changed it"), never off a
   * comparison to a value this same render pass already rewrote. A line
   * added by hand (`addLine`) never gets an entry here, and is therefore
   * never eligible — there is no printed unit to have a rule about.
   */
  const [originalUnits] = useState<Map<string, string>>(() => new Map(lines.map((l) => [l.key, l.unit])));
  /** Suggestion cards dismissed ("Not now" / "Ignore for this order") THIS
   *  SESSION. Persists nothing — reopening the document offers it again. */
  const [dismissedUomSuggestions, setDismissedUomSuggestions] = useState<Set<string>>(() => new Set());
  /** Per-line save state for the [Create rule]/[Update rule] action. */
  const [uomRuleSaves, setUomRuleSaves] = useState<Map<string, { status: 'saving' | 'saved' | 'failed'; message?: string | null }>>(
    () => new Map(),
  );

  // Excel-style movement over the rows below. See hooks/useGridNavigation.ts —
  // the whole mechanism is a container keydown handler plus a data attribute per
  // cell, and it defers to anything (the product typeahead) that has already
  // taken the key.
  const { gridRef, onKeyDown: onGridKeyDown } = useGridNavigation<HTMLDivElement>();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    if (customerId && customers.find((c) => c.id === customerId)?.name === query.trim()) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, query, customerId]);

  const exactExists = customers.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase());

  // ONE reading of this order's numeric format, formed from every line at once
  // — never per-row — and reused everywhere on this screen a figure is parsed:
  // the subtotal, the mismatch count, each row's gross and cross-check, and the
  // save handler below. A per-row guess is exactly how one comma document could
  // end up read two different ways on the same screen.
  const lineHint = useMemo(() => lineSeparatorHint(lines), [lines]);

  const subtotal = orderSubtotal(lines, lineHint);

  // Lines the matcher refused to claim it identified. Counted for the banner so
  // the reviewer knows before scrolling that this order is not ready to invoice.
  // A line the reviewer has since confirmed no longer counts: the banner is a
  // list of open questions, and one that keeps counting an answered one teaches
  // people to ignore it — which is the only way this banner can fail.
  const unmatched = lines.filter((l) => l.record && !l.record.matched && !confirmations.has(l.key)).length;

  // NO RECORD ON ANY ROW IS NOT "EVERYTHING MATCHED" — it is "nothing was ever
  // asked". Every annotation on this screen (the paper's words, the amber
  // not-matched bubble, the learned-link chip, the price provenance) is drawn
  // from `extracted_data.order_lines`, which `syncOrderFromDocument` writes. When
  // that pass does not finish, the rows render clean and silent and look exactly
  // like a perfectly matched order — the single most dangerous thing this screen
  // can do, because a reviewer's whole job here is to see what we are unsure of.
  //
  // It happened: the extract route's order lane grew a third model call and ran
  // past its 60s budget, so the write after it never landed. The budget is fixed
  // (maxDuration 300, agent capped at 30s), and this says so out loud for every
  // document already sitting in the database with no pass behind it.
  const noMatchPass = lines.length > 0 && !lines.some((l) => l.record);

  // Rows whose quantity × unit price does not equal the amount printed beside
  // them on the paper. A DIFFERENT failure from an unmatched product — the
  // product may be perfectly right and a digit in the price wrong — so it gets
  // its own count and its own sentence rather than being folded into the one
  // above. This is the check that would have caught "Apple Top Red @ 560.90"
  // against a printed 569.90 the moment the page rendered.
  const mismatched = countGrossMismatches(lines, lineHint);

  // The document's own FOOTER, checked against the rows above it — null on the
  // many orders that print no footer at all, which is why the panel below is
  // drawn conditionally rather than left empty. A footer is a second, whole-page
  // witness: the per-row check catches one transposed digit, and this catches a
  // row we never read at all, which no amount of per-row arithmetic can. Read
  // through the SAME `lineHint` as every other figure on this screen.
  const footer = useMemo(
    () => reconcileDocumentTotals(lines, extractedData?.totals, lineHint),
    [lines, extractedData, lineHint],
  );

  // The sheet the Print button previews: built from the CURRENT rows, not from
  // what is saved. A reviewer who has just corrected 560.90 to 569.90 and not
  // yet pressed Confirm must not be handed the mistake back on paper.
  const printSheet = useMemo(() => {
    const profile = printContext?.companyProfile ?? null;
    const base = mapExtractionToSheet({
      fields: [],
      lineItems: toPrintableLines(lines),
      billTo: query.trim() || extractedName || null,
      supplierName: profile?.company_name ?? printContext?.orgName ?? null,
      defaultVatRate: printContext?.defaultVatRate ?? 0,
      note: profile?.invoice_footer ?? null,
      termsText: profile?.terms ?? null,
    });
    return {
      ...base,
      invoice: {
        ...base.invoice,
        // An order that has been invoiced prints under its real number; one that
        // has not prints without a number, because it does not have one yet and
        // inventing a plausible-looking one is how a document becomes a lie.
        number: doneInvoice && doneInvoice !== '—' ? doneInvoice : '',
        issueDate: new Date().toISOString().slice(0, 10),
      },
    };
  }, [lines, query, extractedName, printContext, doneInvoice]);

  const printCustomer: ClassicInvoiceParty | null = query.trim()
    ? { name: query.trim() }
    : printContext?.customer ?? null;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  /** Taking a suggestion fills the catalogue's name and — only when the line has
   *  no unit of its own — its unit. A unit read off the PAPER is never
   *  overwritten: the customer's own order knows which pack was ordered better
   *  than our catalogue does, and on this screen the pack decides the price. */
  function pickProduct(i: number, option: ProductOption) {
    const current = (lines[i]?.unit ?? '').trim();
    updateLine(i, {
      description: option.name,
      ...(option.unit && !current ? { unit: option.unit } : {}),
    });
    // Picking a product from the typeahead IS confirming one. The dropdown and
    // the "closest: …" button are two doors into the same decision, and only one
    // of them used to teach us anything.
    void confirmProduct(i, { id: option.id, name: option.name, kind: option.kind });
  }

  // -------------------------------------------------------------------------
  // LEARNED, CUSTOMER-SCOPED LINKS
  //
  // The ruling a reviewer makes here — "'VEG - SWEET CORN PKT Each' is Sweet
  // Corn" — used to live exactly as long as the page. It is now written to
  // `cd_customer_item_aliases` keyed on (org, CUSTOMER, the paper's own words),
  // which is the table `orderflow-from-doc.ts` already consults before it
  // consults the matcher. So the next order from THIS customer arrives matched,
  // and the next order from a different customer does not — because nobody has
  // said what that customer means by the same words.
  //
  // Written from the browser, like every other write on this screen: RLS scopes
  // it to the org, and a route would add a hop without adding a check. See
  // `lib/platform/docu/customer-item-alias.ts` for the key and the states.
  // -------------------------------------------------------------------------

  /**
   * The customer this document's links may be stored against, or null.
   *
   * A typed name that IS an existing customer counts — the reviewer has named
   * the counterparty even if they never touched the dropdown. A typed name that
   * is NOT one does not: creating a customer is a side effect nobody asked for
   * when they clicked a product, so those links wait (see `pending`).
   */
  const knownCustomerId =
    customerId ?? customers.find((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase())?.id ?? null;
  const knownCustomerName = knownCustomerId ? customers.find((c) => c.id === knownCustomerId)?.name ?? null : null;

  // -------------------------------------------------------------------------
  // CUSTOMER-SCOPED CONDITIONAL UOM RULES
  //
  // "This customer's paper always prints KG for a line that is, in fact, a
  // punnet" is a fact about the SAME kind of thing an alias is a fact about —
  // this customer's paper, this customer only — but about the UNIT rather
  // than the product. See lib/platform/docu/customer-uom-rules.ts for why it
  // is a second table and not a second product-rule system.
  //
  // Loaded here (not as a server-fetched prop) because it has to react to the
  // customer being picked/changed LIVE on this screen, exactly like the
  // alias-learning flow above reacts to `knownCustomerId` — a suggestion for
  // a rule scoped to "no customer yet" cannot exist.
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!knownCustomerId || !org?.id) {
        setUomRules([]);
        return;
      }
      const supabase = createClient();
      if (!supabase) {
        setUomRules([]);
        return;
      }
      const { data, error } = await supabase
        .from('cd_customer_uom_rules')
        .select('*')
        .eq('org_id', org.id)
        .eq('customer_id', knownCustomerId)
        .eq('active', true);
      if (cancelled) return;
      // Pre-migration (supabase/customer-uom-rules.sql not run yet): no rules,
      // not an error banner — the same tolerance the server-side sync uses.
      setUomRules(isMissingTable(error) ? [] : ((data ?? []) as CustomerUomRuleLite[]));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [knownCustomerId, org?.id]);

  /**
   * Store one UOM rule. Returns the human-readable failure, or null on success.
   *
   * Mirrors `saveLink` above: upserts on the migration's unique key
   * (deliberately excluding `target_unit` — see customer-uom-rules.sql), so a
   * reviewer who changes their mind about the RESULT overwrites the same row
   * rather than creating a second one that could later conflict with itself,
   * and logs to the customer's activity feed for the identical reason —  a
   * rule silently re-units every future order carrying its condition, so who
   * ruled it and when should not be a fact only the database holds.
   */
  async function saveUomRule(cid: string, condition: UomRuleCondition): Promise<string | null> {
    const supabase = createClient();
    if (!supabase || !org?.id) return 'You’re not signed in.';
    const row = {
      org_id: org.id,
      customer_id: cid,
      match_kind: condition.match_kind,
      description_condition: condition.description_condition,
      printed_unit: condition.printed_unit,
      target_unit: condition.target_unit,
    };
    const { data, error } = await supabase
      .from('cd_customer_uom_rules')
      .upsert(
        { ...row, source: ALIAS_SOURCE_REVIEW_CONFIRM, document_id: documentId, updated_at: new Date().toISOString() },
        { onConflict: 'org_id,customer_id,match_kind,description_condition,printed_unit' },
      )
      .select('id')
      .single();
    if (error) {
      return isMissingTable(error)
        ? 'Customer UOM rules aren’t set up yet — run supabase/customer-uom-rules.sql in Supabase.'
        : error.message;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: cid,
      customerId: cid,
      event: 'customer_uom_rule_learned',
      description: `${condition.printed_unit} + “${condition.description_condition}” → ${condition.target_unit}`,
    });
    // Reflect the new/updated rule locally, without waiting for a re-sync —
    // the suggestion card reads `uomRules` to decide whether it has anything
    // left to say, and a reviewer who just clicked "Create rule" should see
    // it go away immediately, not after the next full page load.
    const newId = (data as { id: string } | null)?.id;
    if (newId) {
      setUomRules((prev) => [...prev.filter((r) => !sameRuleCondition(r, condition)), { id: newId, org_id: org.id, customer_id: cid, active: true, ...condition }]);
    }
    return null;
  }

  /** What (if anything) this line's current unit implies about a UOM rule —
   *  a fresh condition nobody has ruled on ('new'), or one that would change
   *  an EXISTING rule's result ('update'). Null when there is nothing to ask:
   *  no customer, no printed-unit fact to compare against (a hand-added
   *  line), no edit, or an existing rule already produces exactly this
   *  result.
   *
   *  ADDENDUM 4b: `original` — the OVERRIDE-DETECTION baseline — is now the
   *  INTERPRETED unit on a line a rule already applied (see
   *  `displayUnitForLine`, `order-review-lines.ts`), so "the reviewer changed
   *  it" correctly means "away from what the dropdown opened showing", not
   *  away from a printed value the dropdown never displayed. The rule
   *  CONDITION itself must still be built from the actual paper-printed
   *  unit, which is a different fact — `l.record?.uom_source_unit` when one
   *  is on record, `original` itself on every line no rule has touched
   *  (where the two facts are the same value). */
  function uomSuggestionForLine(l: Line): { kind: 'new' | 'update'; condition: UomRuleCondition } | null {
    if (!knownCustomerId) return null;
    const original = originalUnits.get(l.key);
    if (original == null) return null;
    const newUnit = l.unit.trim();
    if (!newUnit || newUnit.toLowerCase() === original.trim().toLowerCase()) return null;
    const description = (l.raw || l.description).trim();
    if (!description) return null;
    const printedUnit = l.record?.uom_source_unit ?? original;
    const condition = deriveUomRuleCondition(description, printedUnit, newUnit);
    if (!condition.printed_unit || !condition.target_unit) return null;
    const existing = uomRules.find((r) => sameRuleCondition(r, condition));
    if (existing) {
      // Same condition, same result already ruled — nothing new to offer.
      if (existing.target_unit === condition.target_unit) return null;
      return { kind: 'update', condition };
    }
    return { kind: 'new', condition };
  }

  async function actOnUomSuggestion(key: string, condition: UomRuleCondition) {
    if (!knownCustomerId) return;
    setUomRuleSaves((prev) => new Map(prev).set(key, { status: 'saving' }));
    const failure = await saveUomRule(knownCustomerId, condition);
    setUomRuleSaves((prev) => new Map(prev).set(key, failure ? { status: 'failed', message: failure } : { status: 'saved' }));
  }

  function dismissUomSuggestion(key: string) {
    setDismissedUomSuggestions((prev) => new Set(prev).add(key));
  }

  function setConfirmation(key: string, next: LineConfirmation | null) {
    setConfirmations((prev) => {
      const out = new Map(prev);
      if (next) out.set(key, next);
      else out.delete(key);
      return out;
    });
  }

  /**
   * Store one learned link. Returns the human-readable failure, or null on success.
   *
   * The upsert OVERWRITES on (org, customer, raw_name): a reviewer who links the
   * same paper text to a different product has changed their mind, and the newer
   * ruling is the one that should govern the next order. It is logged to the
   * customer's activity feed for exactly that reason — a link silently re-prices
   * every future order carrying that wording, so who changed it and when should
   * not be a thing only the database knows.
   */
  async function saveLink(
    cid: string,
    rawName: string,
    stockItemId: string,
    productName: string,
  ): Promise<string | null> {
    const supabase = createClient();
    if (!supabase || !org?.id) return 'You’re not signed in.';
    const row = {
      org_id: org.id,
      customer_id: cid,
      raw_name: rawName,
      stock_item_id: stockItemId,
    };
    const conflict = { onConflict: 'org_id,customer_id,raw_name' };
    let { error } = await supabase.from('cd_customer_item_aliases').upsert(
      {
        ...row,
        source: ALIAS_SOURCE_REVIEW_CONFIRM,
        document_id: documentId,
        updated_at: new Date().toISOString(),
      },
      conflict,
    );
    // Pre-migration (supabase/customer-item-alias-learning.sql not run): keep the
    // LINK, lose only the provenance. A reviewer's ruling working without a date
    // beside it beats a ruling that does not work at all — and the screen still
    // tells the truth afterwards, because a row with no `source` renders as
    // "From this customer's order mappings" rather than as a confirmation.
    if (isMissingColumn(error)) ({ error } = await supabase.from('cd_customer_item_aliases').upsert(row, conflict));
    if (error) {
      return isMissingTable(error)
        ? 'Learned links aren’t set up yet — run supabase/customer-ai-invoicing.sql in Supabase.'
        : error.message;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: cid,
      customerId: cid,
      event: 'customer_item_link_learned',
      description: `“${rawName}” → ${productName}`,
    });
    return null;
  }

  /**
   * A reviewer confirmed a product for a line. Set it on the row, then remember
   * it — but only against a customer we can name.
   */
  async function confirmProduct(
    i: number,
    option: { id: string; name: string; kind?: 'product' | 'alias' },
  ) {
    const line = lines[i];
    if (!line) return;
    const rawName = line.raw.trim();
    // Nothing to learn from a hand-added row (no paper behind it), and nothing
    // storable from an alias-only suggestion (its id is not a catalogue row —
    // see ProductOption.kind).
    if (!aliasKey(rawName) || option.kind === 'alias') return;
    const confirmation: LineConfirmation = {
      stockItemId: option.id,
      productName: option.name,
      rawName,
      status: knownCustomerId ? 'saving' : 'pending_customer',
    };
    setConfirmation(line.key, confirmation);
    if (!knownCustomerId) return;
    const failure = await saveLink(knownCustomerId, rawName, option.id, option.name);
    setConfirmation(line.key, { ...confirmation, status: failure ? 'failed' : 'saved', message: failure });
  }

  /**
   * The links held back because nobody had named the customer yet.
   *
   * Offered rather than written automatically. Confirming a product is a
   * statement about THIS order; teaching us a permanent fact about a named
   * counterparty is a bigger one, and it only ended up implicit here because the
   * customer field was still empty at the time. One click, with the customer's
   * name in the sentence, is what makes the scope of the thing visible at the
   * moment it is stored.
   */
  const pending = pendingConfirmations(confirmations, lines.map((l) => l.key));

  async function rememberPending() {
    if (!knownCustomerId || remembering) return;
    setRemembering(true);
    for (const [key, c] of confirmations) {
      if (c.status !== 'pending_customer') continue;
      setConfirmation(key, { ...c, status: 'saving' });
      const failure = await saveLink(knownCustomerId, c.rawName, c.stockItemId, c.productName);
      setConfirmation(key, { ...c, status: failure ? 'failed' : 'saved', message: failure });
    }
    setRemembering(false);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addLine() {
    // A hand-added line has no paper behind it, so `raw` stays empty until save,
    // where it takes the typed description — a human typing a product IS the
    // record for that line, and the resolver needs some raw name to score.
    const nextIndex = lines.length;
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        description: '',
        quantity: '',
        unit: '',
        unit_price: '',
        raw_unit_price: '',
        raw: '',
        raw_amount: '',
        raw_tax_amount: '',
        tax_rate: '',
        tax_code: '',
        raw_total_amount: '',
        quantity_source: 'unresolved',
        // NULL, not 100. Nothing read this row, so there is no reading to
        // report — and claiming a perfect one would make a typed line look
        // like the best-read line on the document.
        confidence: null,
        record: null,
        interpretation: null,
      },
    ]);
    // Land the caret in the new row's product cell, so adding a line by keyboard
    // continues straight into typing it rather than into a hunt for the field.
    requestAnimationFrame(() => document.getElementById(`order-line-desc-${nextIndex}`)?.focus());
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (!supabase || !org?.id) {
      setMsg('You’re not signed in.');
      setBusy(false);
      return;
    }
    try {
      // Resolve the customer: an existing pick, or create one from the typed name.
      let cid = customerId;
      const typed = query.trim();
      if (!cid && typed) {
        const existing = customers.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());
        if (existing) cid = existing.id;
        else {
          const { data: created, error: cErr } = await supabase
            .from('of_customers')
            .insert({ org_id: org.id, name: typed })
            .select('id')
            .single();
          if (cErr || !created) throw cErr ?? new Error('Could not create the customer.');
          cid = (created as { id: string }).id;
        }
      }
      if (!cid) {
        setMsg('Pick or enter a customer first.');
        setBusy(false);
        return;
      }

      // Persist the (possibly edited) lines + confirmed customer name onto the doc,
      // so the order sync re-reads the corrected data.
      // `raw_description` survives the round-trip. The reviewer edits the billed
      // name; the paper's own words are not theirs to overwrite, and the next
      // sync's resolution pass matches on them, so losing them here would put the
      // whole document back to matching against a rewrite.
      const cleanLines = lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          raw_description: l.raw.trim() || l.description.trim(),
          description: l.description.trim(),
          quantity: l.quantity.trim(),
          unit: l.unit.trim(),
          unit_price: l.unit_price.trim(),
          raw_unit_price: l.raw_unit_price.trim() || l.unit_price.trim(),
          // The paper's own line total survives the round-trip for exactly the
          // reason `raw_description` does: it is evidence, not a working value,
          // and a re-save that dropped it would silently disarm the cross-check
          // on every subsequent open of this document.
          raw_amount: l.raw_amount.trim(),
          // The row's VAT evidence survives the round-trip for exactly the
          // reason `raw_amount` does: drop it and the next open of this
          // document compares quantity × unit price against a net it can no
          // longer tell apart from an inclusive total, and a correctly read
          // VAT row goes red again.
          raw_tax_amount: l.raw_tax_amount.trim(),
          tax_rate: l.tax_rate.trim(),
          tax_code: l.tax_code.trim(),
          raw_total_amount: l.raw_total_amount.trim(),
          quantity_source: l.quantity_source || undefined,
          // The gross the reviewer actually saw and signed off. The order sync
          // re-derives it from qty × unit_price anyway (of_order_items carries
          // the two factors, and every total downstream is `docTotals` over
          // them), so this is the document's record rather than an input to the
          // invoice — which is why it can never drift from what was on screen.
          amount: lineGross(l, lineHint).toFixed(2),
          // THE EXTRACTION'S OWN CONFIDENCE, NOT 100.
          //
          // This used to stamp every line 100 on the way out, and that is not a
          // correction — it is the deletion of the only record of how well the
          // model read this document. After one Confirm, a page whose six worst
          // rows came back at 40% was indistinguishable from a page read
          // perfectly, so "was this document hard to read?" stopped being
          // answerable the moment a human touched it, which is precisely when
          // somebody starts asking. A reviewer approving a row does not make
          // the model retroactively certain of it; the reviewer's judgement is
          // recorded by `status: 'reviewed'` on the document, which is the
          // right place for it.
          //
          // 100 for a HAND-ADDED row only (confidence null — nothing read it):
          // a human typing a product IS the record for that line, and it must
          // not read as a low-confidence guess. Same rule, same number, as
          // ExtractionEditor's "+ Add line".
          confidence: l.confidence ?? 100,
        }));
      await supabase
        .from('documents')
        .update({
          status: 'reviewed',
          extracted_data: { ...(extractedData ?? {}), line_items: cleanLines, customer_name: typed || extractedName },
        })
        .eq('id', documentId);

      const res = await fetch('/api/orderflow/order-from-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId, customerId: cid, finalize: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        orderId?: string;
        invoice_number?: string | null;
      };
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not create the order.');
      } else {
        setOrderId(json.orderId ?? null);
        setDoneInvoice(json.invoice_number ?? '—');
        router.refresh();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Run the product-matching pass on a document that never got one.
   *
   * The SAME endpoint the Confirm button uses, with `finalize: false` — this is
   * not a new pass, it is the one extraction should have run, run late. Which
   * means it can do everything extraction would have: create a customer, create
   * products for lines the catalogue has nothing for, and — when the customer is
   * known and every line is matched and priced — invoice the order, exactly as it
   * would have at 08:01. That is not a surprise smuggled in behind a button; it
   * is the outcome that was interrupted, and the screen shows the invoice number
   * the moment it happens.
   *
   * The rows are RE-PAIRED, not rebuilt: anything the reviewer has already typed
   * stays, and `raw` — the paper's own words, which no edit touches — is the join.
   */
  async function runMatchPass() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/orderflow/order-from-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId, customerId: customerId ?? null, finalize: false }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        orderId?: string;
        invoice_number?: string | null;
      };
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not match the products.');
        return;
      }
      setOrderId(json.orderId ?? null);
      if (json.invoice_number) setDoneInvoice(json.invoice_number);

      const supabase = createClient();
      const { data } = (await supabase
        ?.from('documents')
        .select('extracted_data')
        .eq('id', documentId)
        .maybeSingle()) ?? { data: null };
      const records = ((data as { extracted_data?: DocuExtractedData | null } | null)?.extracted_data ?? null)
        ?.order_lines;
      if (!records?.length) {
        // Honest about the one case a green tick would lie about: the order was
        // built, but the audit trail this screen renders still is not there.
        setMsg('The order was built, but no line records came back — nothing below has been checked.');
        return;
      }
      setLines((prev) => attachRecords(prev, records));
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not match the products.');
    } finally {
      setBusy(false);
    }
  }

  // The burnt-orange focus ring (#BE5D23 — globals.css's --accent/--ring) marks
  // the ACTIVE cell, so a reviewer arrowing down a column can always see where
  // they are without hunting for a caret. 150ms, and none of it under
  // prefers-reduced-motion.
  const cell =
    'h-10 w-full rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-[13px] text-[#171A17] outline-none placeholder:text-[#A0A49C] ' +
    GRID_CELL_FOCUS;

  return (
    <div className="flex flex-col rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="border-b border-[#EEF1F5] px-6 py-5">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Customer order</h2>
        <p className="mt-1 text-[13px] text-[#8A8E86]">Confirm the customer and items, then invoice</p>
      </div>

      <div className="px-6 py-5">
        {/* Customer */}
        <div className="mb-5">
          <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Customer</label>
          <div className="relative max-w-md">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCustomerId(null);
                setOpenList(true);
              }}
              onFocus={() => setOpenList(true)}
              onBlur={() => setTimeout(() => setOpenList(false), 150)}
              placeholder="Search customers or type a new name"
              className="h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
            />
            {openList && (matches.length > 0 || (query.trim() && !exactExists)) ? (
              <div className="absolute left-0 right-0 top-[48px] z-20 max-h-[240px] overflow-auto rounded-[14px] border border-[#EAEDF2] bg-white py-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.25)]">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerId(c.id);
                      setQuery(c.name);
                      setOpenList(false);
                    }}
                    className="block w-full truncate px-3 py-2 text-left text-[13px] text-[#171A17] hover:bg-[#F5F9FE]"
                  >
                    {c.name}
                  </button>
                ))}
                {query.trim() && !exactExists ? (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerId(null);
                      setOpenList(false);
                    }}
                    className="block w-full truncate border-t border-[#EEF1F5] px-3 py-2 text-left text-[13px] font-medium text-[#1F5FA8] hover:bg-[#F5F9FE]"
                  >
                    + Create “{query.trim()}”
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {extractedName ? (
            <p className="mt-1.5 text-[12px] text-[#A0A49C]">
              Read from the document: <span className="text-[#6B6F68]">{extractedName}</span>
              {extractedConf != null ? ` · ${extractedConf}% sure` : ''}
              {extractedConf != null && extractedConf < 80 ? ' — please confirm' : ''}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#854F0B]">No customer name was read — pick or create one.</p>
          )}
          {extractedData?.customer_match_method && extractedData.customer_match_method !== 'unresolved' ? (
            <p className="mt-1 text-[12px] text-[#2F6B45]">
              Matched to an existing customer · {extractedData.customer_match_method.replaceAll('_', ' ')}
              {extractedData.customer_match_confidence != null
                ? ` · ${extractedData.customer_match_confidence}%`
                : ''}
            </p>
          ) : extractedData?.customer_match_candidates?.length ? (
            <p className="mt-1 text-[12px] text-[#854F0B]">
              Customer unresolved · review candidates:{' '}
              {extractedData.customer_match_candidates
                .slice(0, 3)
                .map((candidate) => `${candidate.customer_name} (${candidate.score}%)`)
                .join(', ')}
            </p>
          ) : null}
          {/* The read did not go the way it was configured to. Said out loud for
              the same reason the model id is: a document quietly served by the
              fallback provider is a document read by a model nobody chose, and
              last time that took an afternoon of inference to establish. */}
          {extractedData?.extraction_warning ? (
            <p className="mt-1 text-[11.5px] leading-[1.5] text-[#854F0B]">
              {extractedData.extraction_warning}
            </p>
          ) : null}
        </div>

        {/* THE LINKS WAITING ON A NAME.
            A reviewer who confirms products before naming the customer has made
            perfectly good decisions about this order and no decision at all about
            a counterparty — so those links are held, not written, and offered here
            the moment a customer exists to hold them against. One click, with the
            customer's name in the sentence, because "we will remember this" is a
            claim about every future order from that business and the person
            agreeing to it should be able to see who it is about. */}
        {knownCustomerId && pending.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#CFE0F3] bg-[#F5F9FE] px-4 py-3">
            <p className="text-[13px] text-[#174C87]">
              Remember <span className="of-num font-medium">{pending.length}</span>{' '}
              {pending.length === 1 ? 'link' : 'links'} for{' '}
              <span className="font-medium">{knownCustomerName ?? query.trim()}</span>? Their next order will match
              {pending.length === 1 ? ' this line' : ' these lines'} on its own.
            </p>
            <button
              type="button"
              onClick={() => void rememberPending()}
              disabled={remembering}
              className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
            >
              {remembering ? 'Saving…' : 'Remember them'}
            </button>
          </div>
        ) : null}

        {/* NOTHING WAS CHECKED. Above the unmatched banner because it is the
            stronger statement: that one says "3 of these lines are questions",
            this one says "none of them were ever asked". Without it the grid
            below is indistinguishable from an order that matched perfectly. */}
        {noMatchPass ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#F3E2C4] bg-[#FFF9EF] px-4 py-3">
            <div className="min-w-[240px] flex-1">
              <p className="text-[13px] font-medium text-[#854F0B]">Products aren’t matched yet</p>
              <p className="mt-0.5 text-[12px] text-[#8A6A38]">
                No line below has been checked against your catalogue or priced from it, so this screen can’t tell you
                which ones it is unsure of. Matching runs when you confirm — or run it now to see the answers first.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runMatchPass()}
              disabled={busy}
              className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
            >
              {busy ? 'Matching…' : 'Run matching'}
            </button>
          </div>
        ) : null}

        {/* Products we would not claim to have identified. Deliberately loud and
            above the table: this is the state that invoiced a R13,457.60 order at
            R25,958.95, and it used to be invisible because a near-miss match was
            rendered exactly like a certain one. */}
        {unmatched > 0 ? (
          <div className="mb-4 rounded-[12px] border border-[#F3E2C4] bg-[#FFF9EF] px-4 py-3">
            <p className="text-[13px] font-medium text-[#854F0B]">
              <span className="of-num">{unmatched}</span> {unmatched === 1 ? 'line' : 'lines'} could not be matched to a
              product with confidence
            </p>
            <p className="mt-0.5 text-[12px] text-[#8A6A38]">
              They are highlighted below with the paper’s own wording and are left unpriced. Pick the right product (or
              accept the closest) before invoicing — a wrong product is billed at the wrong price.
            </p>
          </div>
        ) : null}

        {/* Rows whose arithmetic disagrees with the paper's own amount column.
            Kept separate from the unmatched-product banner above: that one says
            "we do not know WHAT this is", this one says "we do not trust the
            NUMBERS on it", and a reviewer fixes them in different places. */}
        {mismatched > 0 ? (
          <div className="mb-4 rounded-[12px] border border-[#F3D6D6] bg-[#FDF6F6] px-4 py-3">
            <p className="text-[13px] font-medium text-[#A32D2D]">
              <span className="of-num">{mismatched}</span> {mismatched === 1 ? 'line does' : 'lines do'} not add up to
              the amount printed on the paper
            </p>
            <p className="mt-0.5 text-[12px] text-[#8A5A5A]">
              Quantity × unit price should equal the document’s own amount column. Where it doesn’t, one of the three
              figures was misread — the row says which amount the paper shows.
            </p>
          </div>
        ) : null}

        {/* Lines */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Items (<span className="of-num">{lines.length}</span>)</h3>
            {/* WHO READ THESE ROWS, beside the rows themselves.
                It lived under the customer field until Josh went looking for it
                on a misread order and could not find it — which is the only
                test of a provenance stamp that matters. Every figure below is
                one model's reading of a photograph, and the reviewer deciding
                whether to trust them is entitled to know whose reading it is
                without hunting for it.
                ABSENCE IS RENDERED, NOT SKIPPED. A missing stamp used to look
                exactly like a feature that was never built, and the two mean
                very different things: since the routing fix in
                `app/api/ai/extract/route.ts` an unstamped ORDER means the rows
                came from the invoice reader — no row arithmetic, no customer
                name — which is precisely the document a reviewer should treat
                with suspicion. Saying "reader not recorded" out loud is how
                that becomes visible instead of inferable. */}
            {extractedData?.extraction_model ? (
              <span className="inline-flex items-center rounded-[7px] bg-[#F1F3EF] px-2 py-[3px] text-[11.5px] text-[#6B6F68]">
                Read by <span className="ml-1 font-medium text-[#3F443C]">{extractedData.extraction_model}</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-[7px] bg-[#FFF9EF] px-2 py-[3px] text-[11.5px] text-[#8A6A38]">
                Reader not recorded
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          >
            + Add item
          </button>
        </div>
        <div className="grid grid-cols-[1fr_54px_66px_78px_86px_22px] gap-2 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
          <span>Product</span>
          <span className="text-right">Qty</span>
          <span>Unit</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        {lines.length === 0 ? (
          /* "NO ITEMS READ" IS AN ACCUSATION, AND ON TWO DOCUMENTS IT IS A FALSE
             ONE. When the source assessment says the lines are UNAVAILABLE (they
             live in the customer's own portal — the email carried a PO number and
             a link and no goods at all) or UNSAFE (the row structure did not
             survive, so any quantity attached to any product would be a guess),
             the emptiness is the finding, not a failure to read. The notice above
             says which, in the document's own terms. Adding lines by hand stays
             exactly where it was — the "+ Add item" button above this block is
             untouched — because a reviewer typing in what the portal shows them is
             precisely the workflow this unblocks. */
          emptyLinesAreExplained ? (
            <p className="py-6 text-center text-[13px] text-[#8A8E86]">
              No line items came with this email — see the source note above, then add what the customer ordered.
            </p>
          ) : (
            <p className="py-6 text-center text-[13px] text-[#8A8E86]">No items read — add what the customer ordered.</p>
          )
        ) : (
          <div className="space-y-2" ref={gridRef} onKeyDown={onGridKeyDown}>
            {lines.map((l, i) => {
              const r = l.record;
              const gross = lineGross(l, lineHint);
              const off = grossMismatch(l, lineHint);
              // The row's own VAT and inclusive total, parsed ONCE through the
              // document's shared separator hint — never re-read per usage, and
              // never off `off`, which is null on every correctly-read row and
              // is exactly the row that most needs its three columns shown.
              const rowTax = lineTax(l, lineHint);
              const rowTotal = lineTotal(l, lineHint);
              // Show the paper's words whenever the billed name is not simply
              // them. A line we matched correctly still gets the "→" so the
              // reviewer can check the rewrite rather than trust it.
              const showPaper = !!r && r.raw_description.trim().toLowerCase() !== l.description.trim().toLowerCase();
              // What this row is asking, or answering. `r ? r.matched : null` —
              // no record is not "not matched": an unsynced document has made no
              // claim about the line, and painting it amber would invent one.
              const bubble = bubbleState(r ? r.matched : null, confirmations.get(l.key) ?? null);
              // ADDENDUM 4b: a rule already applied by the last sync — the
              // dropdown above already opened on the INTERPRETED unit (see
              // `displayUnitForLine` in order-review-lines.ts), so this is
              // the source/audit line underneath it, not the only place the
              // rule is visible. Gated exactly like `displayUnitForLine`
              // gates the dropdown itself (no conflict, a real target on
              // record) so the two can never disagree about whether a rule
              // "applied" on this line.
              const uomApplied =
                r?.uom_rule_id && r.uom_source_unit && r.uom_target_unit && !r.uom_conflict_rule_ids?.length
                  ? { source: r.uom_source_unit, target: r.uom_target_unit }
                  : null;
              const uomConflictIds = r?.uom_conflict_rule_ids?.length ? r.uom_conflict_rule_ids : null;
              const uomSuggestion = dismissedUomSuggestions.has(l.key) ? null : uomSuggestionForLine(l);
              const uomSaveState = uomRuleSaves.get(l.key) ?? null;
              return (
                <div
                  key={l.key}
                  className={
                    off
                      ? 'rounded-[12px] bg-[#FDF6F6] p-2 ring-1 ring-[#F3D6D6]'
                      : bubbleIsGood(bubble)
                        ? 'rounded-[12px] bg-[#F3FAF6] p-2 ring-1 ring-[#CDE7DA]'
                        : bubble.kind !== 'none'
                          ? 'rounded-[12px] bg-[#FFF9EF] p-2 ring-1 ring-[#F3E2C4]'
                          : ''
                  }
                >
                  <div className="grid grid-cols-[1fr_54px_66px_78px_86px_22px] items-center gap-2">
                    <ProductSuggestInput
                      id={`order-line-desc-${i}`}
                      ariaLabel="Product"
                      className={cell}
                      options={products}
                      placeholder={products.length > 0 ? 'Start typing a product…' : undefined}
                      value={l.description}
                      onChange={(v) => updateLine(i, { description: v })}
                      onPick={(option) => pickProduct(i, option)}
                      inGrid
                      gridCell={gridCell(i, 0)}
                    />
                    <input
                      className={`${cell} of-num text-right`}
                      inputMode="numeric"
                      data-grid-cell={gridCell(i, 1)}
                      value={l.quantity}
                      title={
                        l.quantity_source === 'derived'
                          ? 'Derived from the printed total divided by unit price — confirm against the document'
                          : l.quantity_source === 'unresolved'
                            ? 'Quantity was not resolved from the document'
                            : 'Quantity as read from the document'
                      }
                      onChange={(e) => updateLine(i, { quantity: sanitizeDecimal(e.target.value) })}
                    />
                    <select
                      className={`${cell} cursor-pointer pr-1`}
                      value={l.unit}
                      data-grid-cell={gridCell(i, 2)}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                      aria-label="Unit"
                    >
                      <option value="">unit</option>
                      {unitOptions(l.unit).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <input className={`${cell} of-num text-right`} inputMode="decimal" placeholder="from list" data-grid-cell={gridCell(i, 3)} value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: sanitizeDecimal(e.target.value) })} />
                    {/* Gross — computed, never typed. It is a read-out of the two
                        editable figures beside it, so an editable box here would
                        only invite a third number that disagrees with both. */}
                    <span
                      className="of-num flex h-10 items-center justify-end px-1 text-[13px] tabular-nums text-[#3E4A57]"
                      title="Quantity × unit price"
                    >
                      {zar2(gross)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      aria-label="Remove item"
                      className="flex h-10 w-6 items-center justify-center rounded-[10px] text-[#A0A49C] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                    >
                      ✕
                    </button>
                  </div>
                  {l.quantity_source === 'derived' ? (
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#854F0B]">
                      Quantity derived from printed total ÷ unit price — confirm it against the document.
                    </p>
                  ) : l.quantity_source === 'unresolved' ? (
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                      Quantity could not be established from the printed row.
                    </p>
                  ) : null}
                  {l.raw_unit_price && l.raw_unit_price !== l.unit_price ? (
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#6B6F68]">
                      Paper unit price: <span className="of-num font-medium">{l.raw_unit_price}</span>
                    </p>
                  ) : null}
                  {/* The row's own three money columns, when it printed three.
                      Shown so a reviewer checking against the paper is looking
                      at the same shape the paper has — the Amount column above
                      is net, always, and on a VAT document that number alone
                      does not match anything printed on the row. Drawn only
                      when a VAT was actually READ and is non-zero: a zero-rated
                      row's "· VAT R 0.00 · Total R125.00" is three figures
                      saying what one already said, and this screen's job is to
                      spend the reviewer's attention only where there is
                      something to see. The rate is printed as transcribed and
                      never applied to anything. */}
                  {rowTax != null && rowTax !== 0 ? (
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#6B6F68]">
                      Amount <span className="of-num font-medium">{zar2(gross)}</span>
                      <span className="mx-1">·</span>
                      VAT <span className="of-num font-medium">{zar2(rowTax)}</span>
                      {l.tax_rate ? <span className="ml-1 text-[#A0A49C]">({l.tax_rate})</span> : null}
                      {rowTotal != null ? (
                        <>
                          <span className="mx-1">·</span>
                          Total <span className="of-num font-medium">{zar2(rowTotal)}</span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {/* The cross-check, on the row it belongs to. Both figures,
                      no correction: we cannot know whether the quantity, the
                      price or the amount is the misread one, and picking for
                      the reviewer is how a wrong number becomes a confident
                      one. "1 × 560.90 ≠ 569.90" is a question, and a question
                      is what should appear here. */}
                  {off ? (
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                      {off.reason === 'vat_total' ? (
                        <>
                          {/* `gross` on a vat_total failure IS net + VAT, so the
                              net is gross − VAT. Derived from the mismatch's own
                              two figures rather than re-parsed off the row, so
                              the sentence can never quote a third number. */}
                          Doesn’t add up — net <span className="of-num font-medium">{zar2(off.gross - (off.tax ?? 0))}</span>{' '}
                          plus VAT <span className="of-num font-medium">{zar2(off.tax ?? 0)}</span> comes to{' '}
                          <span className="of-num font-medium">{zar2(off.gross)}</span>, but the paper’s total for this
                          line is <span className="of-num font-medium">{zar2(off.paper)}</span>. Check the VAT or the
                          total against the document.
                        </>
                      ) : (
                        <>
                          Doesn’t add up — qty × price comes to{' '}
                          <span className="of-num font-medium">{zar2(off.gross)}</span>, the paper shows{' '}
                          <span className="of-num font-medium">{zar2(off.paper)}</span> for this line. Check the qty, the
                          price or the amount against the document.
                        </>
                      )}
                    </p>
                  ) : null}
                  {/* The READ-ONLY counterpart of the record-backed provenance
                      block below, and deliberately just above it: this is what
                      existing customer aliases and UOM rules WOULD say about the
                      line, evaluated without writing a single one of them. It
                      sits after the row's money evidence (amount · VAT · total
                      and the cross-check) so that chain stays unbroken — those
                      three are one argument about one row and reading them apart
                      is reading them wrong. Conflicting rules are drawn in the
                      same red as a mismatch because they mean the same thing:
                      the machine declined to choose, and a human must. */}
                  {l.interpretation ? (
                    l.interpretation.uom_conflict_rule_ids.length ? (
                      <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                        Existing customer UOM rules conflict — kept source UOM {l.interpretation.source_uom || 'blank'} for review.
                      </p>
                    ) : l.interpretation.product_alias_id || l.interpretation.uom_rule_id ? (
                      <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#0F6E56]">
                        Read-only customer preview
                        {l.interpretation.product_alias_id && l.interpretation.interpreted_description
                          ? ` · product → ${l.interpretation.interpreted_description}`
                          : ''}
                        {l.interpretation.uom_rule_id && l.interpretation.interpreted_uom
                          ? ` · UOM ${l.interpretation.source_uom || 'blank'} → ${l.interpretation.interpreted_uom}`
                          : ''}
                      </p>
                    ) : null
                  ) : null}
                  {r || bubble.kind !== 'none' ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11.5px] leading-[1.5]">
                      {showPaper && r ? (
                        <span className="text-[#A0A49C]">
                          Paper said <span className="font-medium text-[#6B6F68]">“{r.raw_description}”</span>
                          <span className="mx-1">→</span>
                          {r.matched ? (
                            <span className="text-[#6B6F68]">{r.name}</span>
                          ) : (
                            <span className="font-medium text-[#854F0B]">not matched</span>
                          )}
                        </span>
                      ) : null}
                      {/* WHY A LINE NOTHING SCORED IS CLAIMING 100%.
                          A line pinned by a learned link matches on no similarity
                          at all — "VEG - SWEET CORN PKT Each" scores 0.8 against
                          Sweet Corn (kg), below every floor in the matcher — so
                          without this sentence the row would show a certainty
                          with no visible basis, which is the exact shape of the
                          failure this whole screen was built to expose. It says
                          whose ruling it is and when it was made. */}
                      {r?.matched && r.alias_source ? (
                        <span className="inline-flex items-center rounded-[7px] bg-[#EFF6F2] px-2 py-[2px] font-medium text-[#0F6E56]">
                          {aliasProvenanceLabel(r.alias_source, r.alias_confirmed_at)}
                        </span>
                      ) : null}
                      {bubble.kind === 'unmatched' && r ? (
                        <span className="text-[#854F0B]">
                          {matchReasonLabel(r.match_reason)}
                          {r.suggestion ? (
                            <>
                              {' · closest: '}
                              <button
                                type="button"
                                onClick={() => {
                                  const pick = r.suggestion!;
                                  updateLine(i, { description: pick.name });
                                  void confirmProduct(i, { id: pick.id, name: pick.name, kind: 'product' });
                                }}
                                className="font-medium text-[#1F5FA8] underline-offset-2 hover:underline"
                              >
                                {r.suggestion.name}
                              </button>
                              <span className="of-num"> ({r.suggestion.confidence}%)</span>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                      {/* The receipt. Green once the link is stored against the
                          customer; amber while it is not, and honest about why. */}
                      {bubble.kind !== 'none' && bubble.kind !== 'unmatched' ? (
                        <span className={bubbleIsGood(bubble) ? 'font-medium text-[#0F6E56]' : 'text-[#854F0B]'}>
                          {bubbleText(bubble)}
                        </span>
                      ) : null}
                      {/* Noticed, not enforced: the human's ruling stands even
                          when the paper's unit has since drifted from the pack
                          they linked it to. Said quietly, because they chose it. */}
                      {r?.pack_note ? <span className="text-[#A0A49C]">{r.pack_note}</span> : null}
                      {r ? (
                      <span className="text-[#A0A49C]">
                        {priceSourceLabel(r.price_source, r.price_list_name)}
                        {/* The paper's own figure, always, whether or not we used
                            it — an order priced from our list is right, but the
                            reviewer must be able to see the gap they're signing
                            off. To the CENT: rounded to whole rands, 569.90 and
                            560.90 both print "R 570", and the one misread this
                            line is here to expose disappears into the rounding. */}
                        {r.document_price != null && r.price_source !== 'document'
                          ? ` · paper shows ${zar2(r.document_price)}`
                          : ''}
                      </span>
                      ) : null}
                    </div>
                  ) : null}
                  {/* CUSTOMER-SCOPED UOM RULE — conflict beats a live
                      suggestion beats the quiet "applied" note: showing a new
                      suggestion card over an unresolved conflict on the same
                      line would ask the reviewer to rule on something while
                      hiding that two earlier rulings already disagree. */}
                  {uomConflictIds ? (
                    // ADDENDUM 4b: must say plainly that no rule fired here —
                    // this is the one line where a rule COULD have applied
                    // and, on purpose, did not.
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                      Conflicting customer rules — no rule applied, kept the printed UOM. Review the rules.
                    </p>
                  ) : uomSuggestion ? (
                    <div className="mt-1 rounded-[10px] bg-[#F4F8FC] px-3 py-2 text-[11.5px] leading-[1.6] text-[#3E4A57] ring-1 ring-[#D7E3F0]">
                      <p className="font-medium text-[#1F5FA8]">
                        Customer rule — {knownCustomerName ?? 'this customer'}
                      </p>
                      {/* RIDER 1 — rendered from the exact object that gets
                          saved: every condition, spelled out, never a vague
                          "KG → Punnet". */}
                      <p>{describeUomRuleCondition(uomSuggestion.condition)}</p>
                      <p>→ use {uomSuggestion.condition.target_unit}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[#8A8E86]">
                          Applies to future orders from {knownCustomerName ?? 'this customer'}.
                        </span>
                        <button
                          type="button"
                          onClick={() => void actOnUomSuggestion(l.key, uomSuggestion.condition)}
                          disabled={uomSaveState?.status === 'saving'}
                          className="font-medium text-[#1F5FA8] underline-offset-2 hover:underline disabled:opacity-60"
                        >
                          {uomSuggestion.kind === 'update'
                            ? `Update rule → ${uomSuggestion.condition.target_unit}`
                            : 'Create rule'}
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissUomSuggestion(l.key)}
                          className="text-[#8A8E86] underline-offset-2 hover:underline"
                        >
                          {uomSuggestion.kind === 'update' ? 'Ignore for this order' : 'Not now'}
                        </button>
                      </p>
                      {uomSaveState?.status === 'saving' ? (
                        <p className="mt-1 text-[#8A8E86]">Saving…</p>
                      ) : uomSaveState?.status === 'failed' ? (
                        <p className="mt-1 text-[#A32D2D]">{uomSaveState.message}</p>
                      ) : uomSaveState?.status === 'saved' ? (
                        <p className="mt-1 font-medium text-[#0F6E56]">Saved.</p>
                      ) : null}
                    </div>
                  ) : uomApplied ? (
                    // ADDENDUM 4b: the dropdown above already opened on
                    // {uomApplied.target} — this line is the audit trail
                    // explaining why, built by `describeUomAppliedLine` from
                    // the exact `uom_source_unit`/`uom_target_unit` on
                    // record, never re-derived.
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#0F6E56]">
                      {describeUomAppliedLine(uomApplied.source, uomApplied.target)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#EEF1F5] pt-3 text-[13px]">
          <span className="text-[#8A8E86]">Subtotal (excl. VAT) · blank prices fill from the price list</span>
          <span className="of-num text-[16px] font-semibold text-[#171A17]">{zar2(subtotal)}</span>
        </div>

        {/* WHAT THE PAPER'S OWN FOOTER SAYS, beside what its rows come to.
            Only drawn when the document printed a footer we could read — most
            orders print none, and an always-present panel reading "—" would be
            four lines of furniture on every one of them.
            BOTH FIGURES, NO CORRECTION, exactly as the per-row check does it:
            we cannot know whether a row was misread or the footer was, and
            picking for the reviewer is how a wrong number becomes a confident
            one. A footer that disagrees is the only signal on this screen
            capable of catching a row that was never read at all. */}
        {footer ? (
          <div className="mt-3 border-t border-[#EEF1F5] pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
              Printed on the document
            </p>
            {footer.checks.map((c) => (
              <div key={c.label} className="flex items-center justify-between py-0.5 text-[12.5px]">
                <span className={c.ok ? 'text-[#6B6F68]' : 'font-medium text-[#A32D2D]'}>{c.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="of-num text-[#8A8E86]">{zar2(c.expected)}</span>
                  <span className="text-[#D3D6D0]">vs</span>
                  <span className={`of-num font-semibold ${c.ok ? 'text-[#171A17]' : 'text-[#A32D2D]'}`}>
                    {zar2(c.actual)}
                  </span>
                </span>
              </div>
            ))}
            {footer.checks.some((c) => !c.ok) ? (
              <p className="mt-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                {footer.checks
                  .filter((c) => !c.ok)
                  .map((c) => c.label.toLowerCase())
                  .join(' and ')}{' '}
                {footer.checks.filter((c) => !c.ok).length === 1 ? 'does' : 'do'} not match the document’s own figure —
                a row may have been misread, or missed entirely. Check the items against the paper.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-[#EEF1F5] bg-white px-6 py-4">
        {doneInvoice ? (
          <div className="mr-auto flex items-center gap-2 text-[13px] font-medium text-[#0F6E56]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
            Invoiced <span className="of-num">{doneInvoice}</span>
            {orderId ? (
              <Link href={`/app/orderflow/orders/${orderId}`} className="ml-1 font-semibold text-[#1F5FA8] hover:underline">
                View order ›
              </Link>
            ) : null}
          </div>
        ) : msg ? (
          <span className="mr-auto text-[13px] text-[#A32D2D]">{msg}</span>
        ) : null}
        {/* Print sits BEFORE the confirm, and works before it too. An order is a
            working document long before it is an invoice: the picker needs a
            sheet to walk the cold room with, and until now the only way to get
            one was to invoice the order first — which is precisely the decision
            the print is meant to help them make. It prints the rows as they
            stand on screen, unsaved edits and all. */}
        {printContext ? (
          <button
            type="button"
            onClick={() => setPrinting(true)}
            disabled={lines.length === 0}
            title="Builds a sheet from the items as they stand right now — then print it or save it as PDF"
            className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
          >
            Print / PDF
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
        >
          {busy ? 'Working…' : doneInvoice ? 'Re-sync order' : 'Confirm & invoice'}
        </button>
      </div>

      {printContext ? (
        <PrintSheetOverlay
          open={printing}
          onClose={() => setPrinting(false)}
          title={doneInvoice ? 'Your tax invoice' : 'This order, on paper'}
          subtitle="Built from the items as they stand on screen, including edits you have not saved yet."
          notes={
            <>
              {!doneInvoice ? (
                <p>
                  This order has not been invoiced, so it has no invoice number yet — it gets one when you press
                  “Confirm &amp; invoice”. Print it as a picking or checking sheet until then.
                </p>
              ) : null}
              {mismatched > 0 ? (
                <p>
                  <span className="of-num">{mismatched}</span> {mismatched === 1 ? 'line does' : 'lines do'} not match
                  the amount printed on the original — those figures will print exactly as they read above.
                </p>
              ) : null}
              {unmatched > 0 ? (
                <p>
                  <span className="of-num">{unmatched}</span> {unmatched === 1 ? 'line was' : 'lines were'} not matched
                  to a product and {unmatched === 1 ? 'is' : 'are'} unpriced — {unmatched === 1 ? 'it' : 'they'} will
                  print at R 0.00.
                </p>
              ) : null}
              {printSheet.vatRateSource === 'default' ? (
                <p>
                  VAT is added at your default rate of <span className="of-num">{printSheet.vatRate}%</span> — an order
                  carries no VAT of its own.
                </p>
              ) : null}
            </>
          }
        >
          <InvoiceSheetClassic
            companyProfile={printContext.companyProfile}
            orgName={printContext.orgName}
            customer={printCustomer}
            invoice={printSheet.invoice}
            lines={printSheet.lines}
            vatTreatment={printSheet.vatRate > 0 ? 'standard' : 'zero_rated'}
            vatRate={printSheet.vatRate}
          />
        </PrintSheetOverlay>
      ) : null}
    </div>
  );
}
