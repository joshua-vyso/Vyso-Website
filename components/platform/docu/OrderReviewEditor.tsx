'use client';

import { useMemo, useState } from 'react';
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
import { buildReviewLines } from '@/lib/platform/docu/order-review-lines';
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
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  countGrossMismatches,
  grossMismatch,
  lineGross,
  orderSubtotal,
  toPrintableLines,
} from '@/lib/platform/docu/order-line-totals';
import { PrintSheetOverlay } from './PrintSheetOverlay';
import { ProductSuggestInput } from './ProductSuggestInput';
import type { ProductOption } from '@/lib/platform/docu/product-suggest';
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
  /** The paper's own words, carried through edit and re-save untouched. The
   *  reviewer may rewrite `description` to whatever they like; the record of
   *  what the customer actually wrote must not be a casualty of that. */
  raw: string;
  /** The LINE TOTAL as printed in the paper's own amount column, read verbatim
   *  and never edited here. It is the independent witness the Amount column is
   *  checked against — see `grossMismatch`. Empty on the many orders that print
   *  no amounts at all. */
  raw_amount: string;
  /** This line's match + price provenance, when the order has been synced once.
   *  Null on a document synced before provenance existed, or a hand-added line. */
  record: OrderLineRecord | null;
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

function sanitizeDecimal(s: string): string {
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
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
  customers,
  linkedOrder,
  orgUnits = [],
  products = [],
  printContext,
}: {
  documentId: string;
  extractedData: DocuExtractedData | null;
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
  const initialCustomer =
    (linkedOrder?.customer_id ? customers.find((c) => c.id === linkedOrder.customer_id) : null) ?? null;

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

  const subtotal = orderSubtotal(lines);

  // Lines the matcher refused to claim it identified. Counted for the banner so
  // the reviewer knows before scrolling that this order is not ready to invoice.
  // A line the reviewer has since confirmed no longer counts: the banner is a
  // list of open questions, and one that keeps counting an answered one teaches
  // people to ignore it — which is the only way this banner can fail.
  const unmatched = lines.filter((l) => l.record && !l.record.matched && !confirmations.has(l.key)).length;

  // Rows whose quantity × unit price does not equal the amount printed beside
  // them on the paper. A DIFFERENT failure from an unmatched product — the
  // product may be perfectly right and a digit in the price wrong — so it gets
  // its own count and its own sentence rather than being folded into the one
  // above. This is the check that would have caught "Apple Top Red @ 560.90"
  // against a printed 569.90 the moment the page rendered.
  const mismatched = countGrossMismatches(lines);

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
      { key: newKey(), description: '', quantity: '', unit: '', unit_price: '', raw: '', raw_amount: '', record: null },
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
          // The paper's own line total survives the round-trip for exactly the
          // reason `raw_description` does: it is evidence, not a working value,
          // and a re-save that dropped it would silently disarm the cross-check
          // on every subsequent open of this document.
          raw_amount: l.raw_amount.trim(),
          // The gross the reviewer actually saw and signed off. The order sync
          // re-derives it from qty × unit_price anyway (of_order_items carries
          // the two factors, and every total downstream is `docTotals` over
          // them), so this is the document's record rather than an input to the
          // invoice — which is why it can never drift from what was on screen.
          amount: lineGross(l).toFixed(2),
          confidence: 100,
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
          <p className="py-6 text-center text-[13px] text-[#8A8E86]">No items read — add what the customer ordered.</p>
        ) : (
          <div className="space-y-2" ref={gridRef} onKeyDown={onGridKeyDown}>
            {lines.map((l, i) => {
              const r = l.record;
              const gross = lineGross(l);
              const off = grossMismatch(l);
              // Show the paper's words whenever the billed name is not simply
              // them. A line we matched correctly still gets the "→" so the
              // reviewer can check the rewrite rather than trust it.
              const showPaper = !!r && r.raw_description.trim().toLowerCase() !== l.description.trim().toLowerCase();
              // What this row is asking, or answering. `r ? r.matched : null` —
              // no record is not "not matched": an unsynced document has made no
              // claim about the line, and painting it amber would invent one.
              const bubble = bubbleState(r ? r.matched : null, confirmations.get(l.key) ?? null);
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
                    <input className={`${cell} of-num text-right`} inputMode="numeric" data-grid-cell={gridCell(i, 1)} value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value.replace(/[^0-9.]/g, '') })} />
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
                  {/* The cross-check, on the row it belongs to. Both figures,
                      no correction: we cannot know whether the quantity, the
                      price or the amount is the misread one, and picking for
                      the reviewer is how a wrong number becomes a confident
                      one. "1 × 560.90 ≠ 569.90" is a question, and a question
                      is what should appear here. */}
                  {off ? (
                    <p className="mt-1 px-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                      Doesn’t add up — paper shows{' '}
                      <span className="of-num font-medium">{zar2(off.paper)}</span> for this line, this row comes to{' '}
                      <span className="of-num font-medium">{zar2(off.gross)}</span>. Check the qty, the price or the
                      amount against the document.
                    </p>
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
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#EEF1F5] pt-3 text-[13px]">
          <span className="text-[#8A8E86]">Subtotal (excl. VAT) · blank prices fill from the price list</span>
          <span className="of-num text-[16px] font-semibold text-[#171A17]">{zar2(subtotal)}</span>
        </div>
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
