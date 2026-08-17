/**
 * Doc Watch — the pure detector. One document's extracted data in, one small
 * card out (or nothing).
 *
 * WHAT IT IS FOR, in Josh's words: *"when a caterer scans an invoice, or a
 * wholesaler scans a market sheet, it'll brief 'Market sheet 0168 scanned this
 * morning. Here's where {{company}} spent the most'."* Every other agent is a
 * threshold — it says something only when something is wrong. This one is a
 * receipt: every document Vyso reads gets acknowledged, because the acknowledge-
 * ment is what makes the product feel like it is paying attention.
 *
 * WHICH IS WHY IT COUNTS FOR NOTHING. A Doc Watch finding is INFORMATIONAL: no
 * `rand_impact`, no `recommended_action`, and the Brief deliberately does not
 * count it toward "N things need your attention" (see `INFORMATIONAL_AGENTS` in
 * lib/platform/agent-findings.ts). Twelve invoices read overnight is not twelve
 * problems, and a greeting that said so would train the owner to ignore the
 * number that matters.
 *
 * NO MODEL CALLS — the cheapest possible thing that works. Every sentence below
 * is a template over numbers the extractor already produced, because the numbers
 * ARE the value here: nobody needs prose to be told what they spent the most on.
 * If a future version wants prose, it belongs on the Haiku tier
 * (ANTHROPIC_AGENT_MODEL), never above it: this fires once per document, all day,
 * for every customer.
 *
 * SAY NOTHING RATHER THAN SOMETHING EMPTY. A document with no line items and no
 * total produces no card at all. "Vyso read a document" with nothing in it is
 * noise, and noise on the Brief is the one thing that would make the owner stop
 * reading it.
 */

import { rand } from '../procurepulse.ts';
import { sastDay, sastDayDiff, sastHour } from '../sast.ts';
import { DOC_WATCH_AGENT, buildDocWatchDedupeKey, parseDocWatchDedupeKey } from '../agents/dedupe-keys.ts';

/** The agent slug written to `agent_findings.agent`. */
export const AGENT_NAME = DOC_WATCH_AGENT;

export { buildDocWatchDedupeKey, parseDocWatchDedupeKey };

/** Document types this agent has something to say about. Anything else — a
 *  delivery note, a customer order, an unclassified scan — is read by other
 *  parts of the product and gets no card here. */
export const WATCHED_DOC_TYPES = ['invoice', 'statement', 'price_list'] as const;
export type WatchedDocType = (typeof WATCHED_DOC_TYPES)[number];

export function isWatchedDocType(t: string | null | undefined): t is WatchedDocType {
  return !!t && (WATCHED_DOC_TYPES as readonly string[]).includes(t);
}

/** How many lines a card names. Three is the number a person reads without
 *  deciding to; a fourth turns a sentence into a table. */
const TOP_LINES = 3;

/** One `extracted_data.fields[]` entry (lib/ai/anthropic.ts → ExtractedField). */
export interface DocWatchField {
  label?: string | null;
  value?: string | null;
}

/** One `extracted_data.line_items[]` entry (→ ExtractedLineItem). */
export interface DocWatchLine {
  description?: string | null;
  quantity?: string | null;
  unit?: string | null;
  unit_price?: string | null;
  amount?: string | null;
}

export interface DocWatchExtracted {
  fields?: DocWatchField[] | null;
  line_items?: DocWatchLine[] | null;
}

export interface DocWatchInput {
  documentId: string;
  /** `documents.document_type`. */
  documentType: string | null;
  /** The resolved counterparty, or null when the document names none. */
  supplierName: string | null;
  /** The org's own name — used only by the statement template's "{org} spent the
   *  most on …". Null simply drops that half of the sentence. */
  orgName: string | null;
  extracted: DocWatchExtracted | null;
  /** When the paper landed — `documents.created_at`, ISO. */
  createdAt: string;
  /** The instant the card is being written. */
  now: Date;
  /** For a price list: how many priced lines differ from this supplier's
   *  previous list. Null when there is no previous list to compare against, in
   *  which case the clause is omitted rather than guessed. */
  priceListChanges?: number | null;
}

export interface DocWatchFinding {
  documentId: string;
  observation: string;
  /** `documents.id` — the one document this card is about. */
  evidenceRefs: string[];
  /** Always null. Informational: nothing is at stake, so nothing is priced. */
  randImpact: null;
  /** Always null. There is nothing to recommend about paper being read. */
  recommendedAction: null;
  dedupeKey: string;
}

// ---------------------------------------------------------------------------
// Reading the extraction
// ---------------------------------------------------------------------------

/**
 * A number out of an extracted string. Extraction returns display text —
 * "R 447 856.00", "1 308.00", "77,440.00" — so the separators (comma, ordinary
 * space, non-breaking space) are stripped before parsing, and a value that is
 * not a number at all becomes null rather than NaN.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[^\d.,\-]/g, '')
    .replace(/,/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** The first field whose label matches, case-insensitively. */
function fieldValue(fields: DocWatchField[], pattern: RegExp): string | null {
  for (const f of fields) {
    if (f?.label && pattern.test(f.label)) {
      const v = (f.value ?? '').trim();
      if (v) return v;
    }
  }
  return null;
}

/**
 * The document's own reference number. Extraction labels it differently per
 * document type ("Invoice number", "Statement number", "Document number"), so
 * all three are tried before giving up — and giving up is fine, the templates
 * below drop the number rather than inventing one.
 */
function documentNumber(fields: DocWatchField[]): string | null {
  return fieldValue(fields, /\b(invoice|statement|document|reference|sheet)\s*(no\.?|number|#)/i);
}

/**
 * The document's stated total. "Total (incl. VAT)" is preferred because it is
 * what the business actually pays; a bare "Total" is the fallback. This is the
 * DOCUMENT's figure, quoted, never a sum this module computed — an invoice's
 * lines are ex-VAT and adding them up would produce a number that appears
 * nowhere on the paper.
 */
function statedTotal(fields: DocWatchField[]): number | null {
  const inclusive = fieldValue(fields, /total.*(incl|inc\.|vat)/i);
  const parsedInclusive = parseAmount(inclusive);
  if (parsedInclusive != null) return parsedInclusive;
  return parseAmount(fieldValue(fields, /\btotal\b/i));
}

interface PricedLine {
  description: string;
  amount: number;
}

/** Lines with a description and a real rand amount, biggest first. A line's own
 *  `amount` wins; quantity × unit_price is the fallback for extractions that
 *  only carried the two. */
function pricedLines(lines: DocWatchLine[]): PricedLine[] {
  const out: PricedLine[] = [];
  for (const l of lines) {
    const description = (l?.description ?? '').trim();
    if (!description) continue;
    let amount = parseAmount(l.amount);
    if (amount == null) {
      const qty = parseAmount(l.quantity);
      const unitPrice = parseAmount(l.unit_price);
      amount = qty != null && unitPrice != null ? qty * unitPrice : null;
    }
    if (amount == null || !(amount > 0)) continue;
    out.push({ description, amount });
  }
  return out.sort((a, b) => b.amount - a.amount || a.description.localeCompare(b.description));
}

/** "Chicken portions R 312 000, Line fish fillet R 77 440" — the top few lines
 *  as one readable run. */
function topLinesPhrase(lines: PricedLine[]): string {
  return lines
    .slice(0, TOP_LINES)
    .map((l) => `${l.description} ${rand(l.amount)}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// When it was read, in the owner's words
// ---------------------------------------------------------------------------

/**
 * "this morning" / "overnight" / "yesterday" / "on 15 August".
 *
 * The plan's template offers `{this morning|overnight}`; those two are the
 * common cases (a scan during the working day, and the nightly sweep picking up
 * paper that arrived by email at 02:00) but they are not the only ones, so the
 * afternoon, the evening and an older document each get an honest phrase rather
 * than being rounded into one of the two.
 */
export function readWhenPhrase(createdAt: string, now: Date): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 'recently';

  const today = sastDay(now);
  const day = sastDay(created);
  const hour = sastHour(created);

  if (day === today) {
    if (hour < 6) return 'overnight';
    if (hour < 12) return 'this morning';
    if (hour < 17) return 'this afternoon';
    return 'this evening';
  }

  const days = sastDayDiff(day, today);
  // Something that landed late last night and is being read before lunch is
  // "overnight" in every sense the owner means it.
  if (days === 1 && hour >= 18) return 'overnight';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return `on ${new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long' }).format(created)}`;
}

// ---------------------------------------------------------------------------
// The detector
// ---------------------------------------------------------------------------

/** "12 lines" / "1 line". */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * One card for one document, or null when there is nothing truthful to say.
 *
 * Deterministic: everything it needs — including "now" — is an argument, so the
 * immediate path (Next's `after()` in app/api/ai/extract/route.ts), the nightly
 * sweep and a test all produce the same sentence for the same document.
 */
export function detectDocWatchFinding(input: DocWatchInput): DocWatchFinding | null {
  if (!isWatchedDocType(input.documentType)) return null;

  const fields = input.extracted?.fields ?? [];
  const lines = input.extracted?.line_items ?? [];
  const priced = pricedLines(lines);
  const total = statedTotal(fields);
  const number = documentNumber(fields);
  const when = readWhenPhrase(input.createdAt, input.now);
  const supplier = (input.supplierName ?? '').trim();

  let observation: string | null = null;

  if (input.documentType === 'invoice') {
    // Nothing priced and no total ⇒ nothing worth a card.
    if (priced.length === 0 && total == null) return null;
    const head = `Invoice${number ? ` ${number}` : ''}${supplier ? ` from ${supplier}` : ''} read ${when}`;
    const totalClause = total != null ? ` — ${rand(total)}` : '';
    const linesClause = priced.length > 0 ? ` Biggest lines: ${topLinesPhrase(priced)}.` : '';
    observation = `${head}${totalClause}.${linesClause}`;
  } else if (input.documentType === 'statement') {
    if (priced.length === 0) return null;
    const head = `Market sheet${number ? ` ${number}` : ''}${supplier ? ` from ${supplier}` : ''} scanned ${when}`;
    // The lines' OWN sum, not the statement's closing balance. A market sheet's
    // stated balance carries last month's opening figure, payments and pallet
    // charges; putting it next to "12 lines" would invite the reader to think
    // the lines add up to it. "N lines worth R x" is a claim this module can
    // actually prove from the numbers in front of it.
    const linesTotal = priced.reduce((sum, l) => sum + l.amount, 0);
    const org = (input.orgName ?? '').trim();
    const spentClause = ` ${org || 'You'} spent the most on ${topLinesPhrase(priced)}.`;
    observation = `${head} — ${count(priced.length, 'line')} worth ${rand(linesTotal)}.${spentClause}`;
  } else {
    // price_list. Items, not rands: a price list is a catalogue, and totalling
    // one would be a number that means nothing.
    const items = lines.filter((l) => (l?.description ?? '').trim()).length;
    if (items === 0) return null;
    const whose = supplier ? `${supplier}'s` : 'A';
    const changed =
      input.priceListChanges != null && input.priceListChanges > 0
        ? `, ${count(input.priceListChanges, 'price')} changed vs the last one`
        : '';
    observation = `${whose} new price list read ${when} — ${count(items, 'item')}${changed}.`;
  }

  return {
    documentId: input.documentId,
    observation,
    evidenceRefs: [input.documentId],
    randImpact: null,
    recommendedAction: null,
    dedupeKey: buildDocWatchDedupeKey(input.documentId),
  };
}
