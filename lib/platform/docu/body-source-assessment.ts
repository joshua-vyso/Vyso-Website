/**
 * WHAT THIS EMAIL BODY ACTUALLY IS, and whether an order may be built from it.
 *
 * Three questions that used to be one, and conflating them is what put 97
 * fabricated lines in front of a customer:
 *
 *   INTENT      — is this message asking us to supply goods?  (classification,
 *                 lib/platform/microsoft-graph-ingest-core.ts)
 *   CONTENT KIND— what does the body physically contain: prose, a table, or a
 *                 link to somewhere else?                      (this module)
 *   USABILITY   — can a canonical order be built from it at all? (this module)
 *
 * The two production failures this exists to answer:
 *
 *   BELAIR — a 100-row × 4-column Outlook order form, of which 8 rows carried an
 *            order quantity. Exchange flattened it to one cell per line before
 *            Vyso ever saw it; the reader, handed a column-less list, produced 97
 *            lines with 92 of them quantity-less (0.95 unresolved). With the
 *            original HTML now fetched the table is RECOVERABLE, and a recovered
 *            table with blank order cells is a perfectly usable order — the blank
 *            rows simply were not ordered. Only the FLATTENED shape, where no row
 *            structure survives at all, is unsafe to infer from.
 *
 *   FOUR SEASONS — a 1.4KB body carrying property, buyer PO number and a
 *            SendGrid-wrapped link to the customer's procurement portal. There is
 *            no order in it and there never was. That is not a parse failure and
 *            must not be reported as one; it is an order whose details live
 *            elsewhere, and the honest output is a review document holding the PO
 *            reference and the link — which is NEVER FOLLOWED.
 *
 * PURE. No IO, no network, no `server-only`; `URL` parsing only, which resolves
 * nothing. Every threshold below is named, and named after the evidence.
 */
import type {
  BodyContentKind,
  BodyParseStatus,
  BodySourceSignals,
  CanonicalOrderStatus,
  ExtractedLineItem,
  ExternalOrderSource,
} from '../types.ts';
import type { NormalizedEmailHtml, NormalizedTable } from './email-html-normalizer.ts';

// The vocabulary lives in the canonical model file beside the row it is stored
// on; it is re-exported here because this is the module that decides it.
export type {
  BodyContentKind,
  BodyParseStatus,
  BodySourceSignals,
  CanonicalOrderStatus,
  ExternalOrderSource,
};

export interface BodySourceAssessment {
  body_content_kind: BodyContentKind;
  body_parse_status: BodyParseStatus;
  canonical_order_status: CanonicalOrderStatus;
  external_source?: ExternalOrderSource | null;
  detected_line_signals?: BodySourceSignals | null;
}

/**
 * A table is "recoverable structure" when it is a GRID, not a layout box.
 *
 * ≥3 rows and ≥2 columns is the Belair order form (100 × 4) with room to spare,
 * and it excludes the single-cell spacer and address boxes that HTML email is
 * built out of. The modal-column test rather than a uniform one is the
 * BirchStreet purchase order's doing: its line grid prints ten heading cells,
 * eleven-cell product rows and four-cell footer rows in ONE table, and demanding
 * uniformity would classify a real printed PO as unstructured.
 */
export const STRUCTURED_TABLE_MIN_ROWS = 3;
export const STRUCTURED_TABLE_MIN_COLUMNS = 2;
/** Half the rows must agree on a shape before we call it a grid. */
export const STRUCTURED_TABLE_MIN_MODAL_ROW_SHARE = 0.5;

/**
 * THE FLATTENED-FRAGMENT HEURISTIC — deliberately narrow, and NOT the definition
 * of "malformed".
 *
 * It describes ONE observed regression: a table shredded into one fragment per
 * line, where the row relationships are gone and any quantity the reader attaches
 * to any product is a guess. The Belair flattened body measured 97 product-like
 * lines with 92 carrying no quantity — 0.95 unresolved — so the gate is set well
 * below that at fifteen lines and 0.7.
 *
 * IT ONLY RUNS WHEN NO TABLE STRUCTURE WAS RECOVERED. Quantity coverage on its
 * own must never condemn a structurally coherent source: an order form's blank
 * order cells mean "not ordered", not "unreadable", and a coherent row that is
 * merely missing a PRICE is a normal order (prices are optional on most of them).
 * Structure first, coverage second — that ordering is the whole point.
 */
export const FLATTENED_FRAGMENT_MIN_LINES = 15;
export const FLATTENED_FRAGMENT_UNRESOLVED_QUANTITY_FRACTION = 0.7;

/**
 * Portal hostnames we can name for a reviewer. Substring on the HOSTNAME only
 * (never the path or query), so a tracking wrapper's own domain cannot borrow a
 * provider's name from a URL parameter.
 */
const PORTAL_PROVIDERS: readonly { match: string; provider: string }[] = [
  { match: 'birchstreet', provider: 'birchstreet' },
  { match: 'coupahost', provider: 'coupa' },
  { match: 'coupa', provider: 'coupa' },
  { match: 'ariba', provider: 'sap_ariba' },
];

export function orderPortalProvider(host: string | null | undefined): string | null {
  const value = (host ?? '').toLowerCase();
  if (!value) return null;
  return PORTAL_PROVIDERS.find((entry) => value.includes(entry.match))?.provider ?? null;
}

/**
 * A quantity+unit on a line of prose — "10kg potatoes", "5 boxes".
 *
 * Kept in step with the classifier's own signal (microsoft-graph-ingest-core.ts):
 * the question here is the same one, asked of the normalized text rather than of
 * whatever Exchange happened to send.
 */
const QUANTITY_UNIT_RE = /\b\d+(?:[.,]\d+)?\s*(?:kg|g|grams?|kilograms?|boxes?|punnets?|bags?|crates?|trays?|bunch(?:es)?|packets?|packs?|pockets?|each|ea|doz(?:en)?|tubs?|cartons?)\b/i;

/** A bare unit token on a line of its own — the fingerprint of a shredded column. */
const BARE_UNIT_LINE_RE = /^(?:kg|kgs|g|gram|grams|unit|units|box|boxes|bag|bags|bunch|bunches|pkt|pkts|packet|packets|punnet|punnets|punet|tray|trays|crate|crates|each|ea|doz|dozen|tub|tubs|carton|cartons|litre|litres|l|ml)$/i;

function modalColumnCount(rows: readonly string[][]): { count: number; share: number } {
  if (rows.length === 0) return { count: 0, share: 0 };
  const tally = new Map<number, number>();
  for (const row of rows) tally.set(row.length, (tally.get(row.length) ?? 0) + 1);
  let count = 0;
  let best = 0;
  for (const [columns, rowsWithColumns] of tally) {
    if (rowsWithColumns > best || (rowsWithColumns === best && columns > count)) {
      best = rowsWithColumns;
      count = columns;
    }
  }
  return { count, share: best / rows.length };
}

/** Is this table a grid Vyso can read rows out of? */
export function isRecoverableTable(table: NormalizedTable): boolean {
  const rows = table.headers ? [table.headers, ...table.rows] : table.rows;
  if (rows.length < STRUCTURED_TABLE_MIN_ROWS) return false;
  const modal = modalColumnCount(rows);
  return modal.count >= STRUCTURED_TABLE_MIN_COLUMNS && modal.share >= STRUCTURED_TABLE_MIN_MODAL_ROW_SHARE;
}

/** A line of body text that reads like a product name rather than furniture. */
function productLike(line: string): boolean {
  const value = line.trim();
  if (value.length < 3 || value.length > 120) return false;
  if (BARE_UNIT_LINE_RE.test(value)) return false;
  if (/^[\d.,%/-]+$/.test(value)) return false;
  return /[a-z]{3}/i.test(value);
}

export interface BodySourceRead {
  kind: BodyContentKind;
  parse_status: BodyParseStatus;
  external_source: ExternalOrderSource | null;
  /** True when at least one table came back as a readable grid. */
  structure_recovered: boolean;
  product_like_count: number;
  /** Lines that are nothing but a unit token — a column that lost its row. */
  bare_unit_line_count: number;
}

/**
 * STAGE ONE — what the body IS, decided before any model reads it.
 *
 * Runs on the normalizer's output, so it sees the same evidence the reader will.
 */
export function assessBodySource(input: {
  /** Graph's declared body content type: 'html' | 'text' | null. */
  contentType: string | null | undefined;
  normalized: NormalizedEmailHtml;
  /** Whether classification found an intent to have goods supplied. */
  orderIntent: boolean;
}): BodySourceRead {
  const { normalized } = input;
  const lines = normalized.text.split('\n').map((line) => line.trim()).filter(Boolean);
  const productLikeCount = lines.filter(productLike).length;
  const bareUnitLineCount = lines.filter((line) => BARE_UNIT_LINE_RE.test(line)).length;
  const quantityLines = lines.some((line) => QUANTITY_UNIT_RE.test(line));
  const recoverable = normalized.tables.filter(isRecoverableTable);
  const externalSource = firstPortalLink(normalized);
  const base = {
    external_source: externalSource,
    structure_recovered: recoverable.length > 0,
    product_like_count: productLikeCount,
    bare_unit_line_count: bareUnitLineCount,
  };

  if (!normalized.text.trim()) {
    return { ...base, kind: 'unknown', parse_status: 'unavailable' };
  }
  // A Graph body Exchange declared as text has no markup to interpret and is read
  // exactly as it always was. This is the unchanged path for every plain-text
  // order in production.
  if ((input.contentType ?? 'text').toLowerCase() !== 'html') {
    return { ...base, kind: 'plain_text', parse_status: 'complete', structure_recovered: false };
  }
  // The Belair order form: a real grid survived, so the order is in the tables.
  if (recoverable.length > 0) {
    return { ...base, kind: 'structured_html', parse_status: 'complete' };
  }
  // The Four Seasons notification: a link, a PO reference, and no goods anywhere.
  // The order exists — in the customer's portal — so this is 'unavailable', which
  // is a different claim from "we failed to read it", and neither claim licenses
  // fetching the link.
  if (externalSource && input.orderIntent && !quantityLines) {
    return { ...base, kind: 'external_link', parse_status: 'unavailable' };
  }
  if (quantityLines) {
    return { ...base, kind: 'plain_text', parse_status: 'complete' };
  }
  return { ...base, kind: 'informational', parse_status: 'complete' };
}

/**
 * The link a reviewer would click, and the only one recorded.
 *
 * A recognised portal wins over an unrecognised host regardless of order,
 * because the Four Seasons body's FIRST href is a SendGrid click-wrapper whose
 * own hostname says nothing — the provider is read from the anchor's visible
 * text when that text is itself an http(s) URL, which on that message is the
 * clean `http://…birchstreet.net` the sender displayed. The wrapper stays in
 * `href` (it is what the customer actually published) and is never dereferenced.
 */
function firstPortalLink(normalized: NormalizedEmailHtml): ExternalOrderSource | null {
  const candidates = normalized.links.map((link) => {
    const displayedHost = displayUrlHost(link.text);
    const provider = orderPortalProvider(link.host) ?? orderPortalProvider(displayedHost);
    return {
      provider,
      host: (displayedHost && provider && !orderPortalProvider(link.host) ? displayedHost : link.host) ?? '',
      href: link.href,
      link_text: link.text,
    } satisfies ExternalOrderSource;
  });
  return candidates.find((entry) => entry.provider) ?? candidates[0] ?? null;
}

function displayUrlHost(text: string | null): string | null {
  const value = (text ?? '').trim();
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** A line the reader gave a quantity to. Blank or explicitly unresolved is not one. */
function hasQuantity(line: ExtractedLineItem): boolean {
  if (line.quantity_source === 'unresolved') return false;
  return Boolean((line.quantity ?? '').trim());
}

/**
 * STAGE TWO — may a canonical order be built, and how much of one?
 *
 * Structural evidence is weighed FIRST (Josh, 2026-08-31): a recovered grid is
 * usable even when most of its order cells are blank, and a coherent row missing
 * only a price is a normal order. The flattened-fragment heuristic is the last
 * resort, for sources where no row relationship survived at all.
 */
export function assessCanonicalOrder(
  read: BodySourceRead,
  input: {
    lines: readonly ExtractedLineItem[];
    conflicts?: number;
    /**
     * True when the canonical lines came from an ATTACHMENT rather than from
     * this body. The flattened-fragment heuristic describes a shredded BODY and
     * must not be turned on a printed purchase order that merely happens to
     * arrive beside a link-only message.
     */
    linesFromAttachment?: boolean;
  },
): BodySourceAssessment {
  const lines = input.lines ?? [];
  const withQuantity = lines.filter(hasQuantity).length;
  const coverage = lines.length ? withQuantity / lines.length : 0;
  const signals: BodySourceSignals = {
    product_like_count: read.product_like_count,
    quantity_coverage: Math.round(coverage * 100) / 100,
  };
  const wrap = (
    kind: BodyContentKind,
    parse: BodyParseStatus,
    canonical: CanonicalOrderStatus,
  ): BodySourceAssessment => ({
    body_content_kind: kind,
    body_parse_status: parse,
    canonical_order_status: canonical,
    external_source: read.external_source,
    detected_line_signals: signals,
  });

  // NOTHING TO BUILD FROM. Zero lines is not a failure to be retried — on the
  // Four Seasons message it is the literal truth about the email, and the
  // reviewable document is the PO reference, the customer and the link.
  if (lines.length === 0) {
    return wrap(
      read.kind === 'external_link' ? 'external_link' : read.kind,
      'unavailable',
      'unavailable',
    );
  }

  // A CONFLICT OUTRANKS COMPLETENESS: body and attachment disagreeing is a
  // question for a human no matter how well each half read on its own.
  if ((input.conflicts ?? 0) > 0) {
    return wrap(read.kind, coverage === 1 ? 'complete' : 'partial', 'conflict');
  }

  // STRUCTURE FIRST. A recovered table's blank order cells mean "not ordered" —
  // those rows are omitted by the reader (see the order-form clause in
  // buildTextOrderPrompt), and what remains is usable. Quantity coverage may
  // downgrade it to 'partial'; it may never condemn it.
  if (read.structure_recovered || input.linesFromAttachment) {
    const kind = read.structure_recovered ? 'structured_html' : read.kind;
    return coverage === 1
      ? wrap(kind, 'complete', 'ready')
      : wrap(kind, 'partial', 'partial');
  }

  // THE SHREDDED TABLE. No grid survived AND the reader returned a long list of
  // product-like lines it could not attach quantities to: every line is then a
  // guess about a row relationship that is not in the source. Belair flattened:
  // 97 lines, 92 unresolved (0.95).
  const unresolvedFraction = 1 - coverage;
  if (
    lines.length >= FLATTENED_FRAGMENT_MIN_LINES &&
    unresolvedFraction >= FLATTENED_FRAGMENT_UNRESOLVED_QUANTITY_FRACTION
  ) {
    return wrap('malformed_structured_content', 'unsafe_to_infer', 'unsafe');
  }

  // Coherent prose lines. Missing PRICES are not considered here at all — most
  // customer orders print none, and treating that as damage would flag the
  // ordinary case.
  return coverage === 1
    ? wrap(read.kind === 'informational' ? 'plain_text' : read.kind, 'complete', 'ready')
    : wrap(read.kind === 'informational' ? 'plain_text' : read.kind, 'partial', 'partial');
}

/**
 * Does this assessment mean a human must look before anything is created?
 *
 * 'partial' is included: a line whose quantity could not be established is a
 * question, and the review queue is where questions belong.
 */
export function assessmentRequiresReview(assessment: AssessedStatus): boolean {
  const status = assessment?.canonical_order_status;
  return status === 'unavailable' || status === 'unsafe' || status === 'conflict' || status === 'partial';
}

/** True when the order document must be filed with NO lines rather than rejected. */
export function assessmentAdmitsZeroLines(assessment: AssessedStatus): boolean {
  const status = assessment?.canonical_order_status;
  return status === 'unavailable' || status === 'unsafe';
}

/**
 * Anything carrying a verdict — the assessment itself, or the stored
 * `MessageOrderEvidence` it was folded onto, where every key is optional because
 * rows filed before this feature have none of them.
 */
type AssessedStatus = { canonical_order_status?: CanonicalOrderStatus | null } | null | undefined;
