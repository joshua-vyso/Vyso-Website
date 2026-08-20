/**
 * Honest product matching for an uploaded customer ORDER's line items.
 *
 * WHY THIS EXISTS. A three-page NebulaPOS purchase order from Bakubung Bush
 * Lodge was read, matched and invoiced at R25,958.95 against a paper total of
 * R13,457.60. Not one figure had been misread: every wrong line multiplied out
 * perfectly, because the arithmetic is done downstream from the product. The
 * products were what went wrong.
 *
 *   • "FF - GRAPES WHITE BOX" was invoiced as a second Avocado line — the
 *     document's own Avocado line was already there, so one product carried two
 *     paper rows and the grapes vanished.
 *   • "Mix Vegetables 2 pkt" became "Cabbage".
 *   • "PATTY PAN YELLOW" became a second "Tomato-Yellow Cocktail".
 *   • "Sweet Corn" became "Baby Sweet Corn" — a different product at a
 *     different price (R46.40 a unit on the paper, R375 on ours).
 *
 * Each of those is the same failure: something *near* the paper text existed in
 * the catalogue, so the line was assigned to it, priced from it, and invoiced —
 * silently, with the paper's own words thrown away at the moment of the rewrite.
 * There was no way for the human reviewing the order to see that
 * "FF - GRAPES WHITE BOX" had become "Avocado (box)", because by then the raw
 * text no longer existed anywhere.
 *
 * SO THE RULES HERE ARE:
 *
 *  1. Match against the RAW PAPER TEXT, never against a name the extractor has
 *     already rewritten. A rewrite is a suggestion, not evidence.
 *  2. Auto-assign only on effective identity (`AUTO_MATCH_FLOOR`). A near miss
 *     is not a match; it is a question for a human, and it goes to review
 *     carrying the raw text and NO price.
 *  3. A qualifier the two names disagree on — colour, size, form, variety —
 *     means a DIFFERENT product, whatever the string similarity says. White
 *     grapes are not black grapes and baby corn is not corn.
 *  4. Two paper lines may never land on one product. If they do, BOTH go to
 *     review — we cannot know which row was the real one, and merging them
 *     loses a line the customer ordered.
 *
 * Everything a refused line nearly matched is kept as a `suggestion`, so review
 * is one click rather than a retype.
 *
 * PURE. No I/O, no Supabase, no model calls. `lib/platform/orderflow-from-doc.ts`
 * is the caller; `tests/docu-order-line-match.test.ts` runs this document
 * through it verbatim.
 *
 * `.ts`-suffixed relative imports: `node --test` strips types but resolves
 * neither extensionless ESM specifiers nor the `@/` alias.
 */
import { diceCoefficient, normalizeName } from '../procurepulse/matching.ts';

// --- thresholds -------------------------------------------------------------

/**
 * Similarity at/above which a line is assigned to a catalogue product with no
 * human involved.
 *
 * 0.9 is deliberately near-identity. Dice over produce names is coarse — two
 * two-token names sharing one token score 0.5, and a three-token name that
 * loses one token to a two-token name scores 0.8 — so anything below 0.9 is
 * "the same words plus or minus a qualifier", which is precisely the band every
 * failure on the Bakubung order sat in ("Sweet Corn" → "Baby Sweet Corn" = 0.8,
 * "Patty Pan Yellow" → "Patty Pan" = 0.8). Those must be questions, not answers.
 */
export const AUTO_MATCH_FLOOR = 0.9;

/**
 * Similarity at/above which a refused line still carries what it nearly matched,
 * so review offers a one-click fix instead of a blank field. Below this the
 * catalogue simply has nothing to say about the line.
 */
export const SUGGEST_FLOOR = 0.5;

// --- qualifier guards -------------------------------------------------------

/**
 * Tokens that IDENTIFY a distinct product rather than describe one.
 *
 * When both names carry a qualifier from the same group and the two sets are
 * disjoint, they are different products no matter how similar the strings look
 * — "Grapes White" vs "Grapes Black" scores 0.5 on shared tokens and is simply
 * not the same thing. This document alone carries Peppers Green, Peppers Red
 * and Peppers Yellow as three separate lines; without this guard they are three
 * candidates for one another.
 */
const QUALIFIER_GROUPS: string[][] = [
  // Colour — the Bakubung order's grapes, peppers, tomatoes and patty pans.
  ['red', 'green', 'white', 'black', 'yellow', 'purple', 'pink', 'brown', 'golden', 'gold', 'orange'],
  // Size / form — "Sweet Corn" vs "Baby Sweet Corn" is a 8× price difference.
  ['baby', 'mini', 'small', 'medium', 'large', 'jumbo', 'giant'],
  // Cut / preparation — a cut product is a different SKU at a different price.
  ['whole', 'cut', 'sliced', 'diced', 'cubed', 'quartered', 'shredded', 'grated', 'peeled'],
  // Variety / pack identity.
  ['mixed', 'cocktail', 'cherry', 'plum', 'roma', 'iceberg', 'navel', 'valencia'],
];

/** Token spellings that mean the same qualifier, folded before comparison. */
const QUALIFIER_ALIASES: Record<string, string> = { mix: 'mixed', gold: 'golden', lge: 'large' };

/** The qualifiers a normalised name carries, grouped by index. */
function qualifiersOf(normalised: string): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const token of normalised.split(' ')) {
    const t = QUALIFIER_ALIASES[token] ?? token;
    for (let g = 0; g < QUALIFIER_GROUPS.length; g += 1) {
      if (!QUALIFIER_GROUPS[g].includes(t)) continue;
      const set = out.get(g) ?? new Set<string>();
      set.add(t);
      out.set(g, set);
    }
  }
  return out;
}

/**
 * True when the two names disagree about a qualifier they BOTH speak to — the
 * signal that they name different products.
 *
 * Both sides must carry a qualifier from the group. A name that is silent about
 * colour is not thereby a different colour; it is merely less specific, which
 * `AUTO_MATCH_FLOOR` already handles by refusing it the auto-assign.
 */
export function qualifiersConflict(aNormalised: string, bNormalised: string): boolean {
  const a = qualifiersOf(aNormalised);
  const b = qualifiersOf(bNormalised);
  for (const [group, aSet] of a) {
    const bSet = b.get(group);
    if (!bSet) continue;
    let shared = false;
    for (const t of aSet) if (bSet.has(t)) shared = true;
    if (!shared) return true;
  }
  return false;
}

// --- scoring ----------------------------------------------------------------

/**
 * A leading category code a POS prints in front of every product name
 * ("FF - GRAPES WHITE BOX", "VEG - CARROTS", "PSAL - MIXED LEAF"). It is filing
 * metadata, not part of the produce identity.
 */
export function stripCategoryPrefix(name: string): string {
  return (name ?? '').replace(/^[A-Za-z]{2,5}\s*-\s*/, '').trim() || (name ?? '').trim();
}

/**
 * How nearly two product names are the same product, 0–1. 1 means identical
 * after normalisation; 0 means the qualifiers rule it out or nothing is shared.
 */
export function scoreCatalogueMatch(
  rawName: string,
  catalogueName: string,
  opts: { stripPrefix?: boolean } = {},
): number {
  const a = normalizeName(opts.stripPrefix === false ? rawName : stripCategoryPrefix(rawName));
  const b = normalizeName(catalogueName);
  if (!a || !b) return 0;
  if (qualifiersConflict(a, b)) return 0;
  return diceCoefficient(a, b);
}

// --- shapes -----------------------------------------------------------------

/** Just enough of a `pp_stock_items` row to match against. */
export interface CatalogueItem {
  id: string;
  name: string;
  unit?: string | null;
}

/** The best candidate the catalogue offers for a name, gated or not. */
export interface CatalogueCandidate<T extends CatalogueItem> {
  item: T;
  score: number;
}

/**
 * Why a line did not get a product. Every value except `matched` sends the line
 * to review with its raw text intact and no price.
 */
export type OrderMatchReason =
  | 'matched'
  /** The catalogue's best offer was a near miss, not the same product. */
  | 'low_confidence'
  /** Best offer disagreed on colour / size / cut / variety — a different SKU. */
  | 'variant_conflict'
  /** Another line on this same document already took this product. */
  | 'duplicate'
  /** Nothing in the catalogue is close; this is a product the org may not sell. */
  | 'no_candidate';

/** One extracted order line, as it arrives from the reader. */
export interface OrderLineInput {
  /**
   * The product text EXACTLY as printed on the paper. The extractor is asked
   * for this separately from `description` precisely so a rewrite can never be
   * the only surviving record of what the customer wrote.
   */
  raw_description?: string | null;
  /** What the reader proposed — often a catalogue name it resolved to. */
  description?: string | null;
  quantity?: string | null;
  unit?: string | null;
  unit_price?: string | null;
}

/** What one line resolved to. */
export interface OrderLineResolution<T extends CatalogueItem = CatalogueItem> {
  index: number;
  /** The paper's own words — always populated, always preserved. */
  rawName: string;
  /**
   * The name to bill under: the catalogue product when matched, and otherwise
   * the RAW paper text. Never a name we merely suspected.
   */
  name: string;
  item: T | null;
  matched: boolean;
  /** 0–100, the gate's own score — not the reader's opinion of itself. */
  confidence: number;
  reason: OrderMatchReason;
  /** What it nearly was, for one-click review. Null when nothing was close. */
  suggestion: { id: string; name: string; confidence: number } | null;
}

/** How `resolveOrderLines` should behave for this document's customer. */
export interface ResolveOptions<T extends CatalogueItem> {
  /**
   * Line index → the catalogue row a confirmed customer alias pins it to. These
   * bypass scoring (a human already ruled) but not the duplicate pass.
   */
  pins?: Map<number, T>;
  /**
   * Strip a leading POS category code ("FF - ", "VEG - ") before matching.
   * Mirrors `of_customers.strip_order_prefixes`; default on.
   */
  stripPrefix?: boolean;
}

// --- resolution -------------------------------------------------------------

/**
 * The catalogue's best offer for a name, with its score. Ungated — callers
 * decide what the score entitles the line to.
 */
export function bestCatalogueCandidate<T extends CatalogueItem>(
  name: string,
  items: T[],
  opts: { stripPrefix?: boolean } = {},
): CatalogueCandidate<T> | null {
  let best: CatalogueCandidate<T> | null = null;
  for (const item of items) {
    const score = scoreCatalogueMatch(name, item.name, opts);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}

/**
 * Resolve every line of one document against the catalogue.
 *
 * Two passes, and the second is the point: a per-line matcher cannot see that
 * it has just assigned the Avocado product for the second time. Duplicates are
 * only visible across the whole document, and when they appear BOTH lines are
 * returned to review — silently keeping the first and dropping the second is
 * how a customer's grapes turned into a second box of avocados.
 */
export function resolveOrderLines<T extends CatalogueItem>(
  lines: OrderLineInput[],
  items: T[],
  opts: ResolveOptions<T> = {},
): OrderLineResolution<T>[] {
  const stripPrefix = opts.stripPrefix !== false;
  const resolved: OrderLineResolution<T>[] = lines.map((line, index) => {
    // The paper first. `description` is the reader's rewrite and is used only
    // when the document predates raw capture, or the reader returned nothing.
    const rawName = ((line.raw_description ?? '').trim() || (line.description ?? '').trim()).trim();
    const base: OrderLineResolution<T> = {
      index,
      rawName,
      name: rawName,
      item: null,
      matched: false,
      confidence: 0,
      reason: 'no_candidate',
      suggestion: null,
    };
    if (!rawName) return base;

    // A customer's confirmed alias (cd_customer_item_aliases) is a human ruling
    // on this exact raw name, so it skips the gate entirely — but NOT the
    // duplicate pass below, because two paper rows collapsing onto one product
    // loses a line whoever decided the mapping.
    const pinned = opts.pins?.get(index);
    if (pinned) {
      return { ...base, name: pinned.name, item: pinned, matched: true, confidence: 100, reason: 'matched' };
    }

    const candidate = bestCatalogueCandidate(rawName, items, { stripPrefix });
    if (!candidate) {
      // Nothing scored — but the catalogue may still hold a same-product-different
      // -qualifier row, which scores 0 by design. Surface it as the near miss so
      // review reads "we refused Grapes Black for GRAPES WHITE" rather than silence.
      const conflicted = nearestConflicting(rawName, items, stripPrefix);
      if (conflicted) {
        return {
          ...base,
          reason: 'variant_conflict',
          suggestion: { id: conflicted.item.id, name: conflicted.item.name, confidence: pct(conflicted.score) },
        };
      }
      return base;
    }

    const confidence = pct(candidate.score);
    if (candidate.score >= AUTO_MATCH_FLOOR) {
      return {
        ...base,
        name: candidate.item.name,
        item: candidate.item,
        matched: true,
        confidence,
        reason: 'matched',
      };
    }
    // Between the two floors it is a near miss worth showing a human; below
    // SUGGEST_FLOOR the catalogue has nothing useful to say about this line.
    const worthSuggesting = candidate.score >= SUGGEST_FLOOR;
    return {
      ...base,
      confidence,
      reason: worthSuggesting ? 'low_confidence' : 'no_candidate',
      suggestion: worthSuggesting
        ? { id: candidate.item.id, name: candidate.item.name, confidence }
        : null,
    };
  });

  // Second pass — one product, one paper line.
  const byItem = new Map<string, number[]>();
  for (const r of resolved) {
    if (!r.matched || !r.item) continue;
    const seen = byItem.get(r.item.id) ?? [];
    seen.push(r.index);
    byItem.set(r.item.id, seen);
  }
  for (const [, indexes] of byItem) {
    if (indexes.length < 2) continue;
    for (const i of indexes) {
      const r = resolved[i];
      resolved[i] = {
        ...r,
        // Back to the paper's words: we no longer claim to know which line this is.
        name: r.rawName,
        item: null,
        matched: false,
        reason: 'duplicate',
        suggestion: r.item ? { id: r.item.id, name: r.item.name, confidence: r.confidence } : r.suggestion,
      };
    }
  }

  return resolved;
}

/** The best catalogue row that a qualifier disagreement — and only that — refused. */
function nearestConflicting<T extends CatalogueItem>(
  name: string,
  items: T[],
  stripPrefix: boolean,
): CatalogueCandidate<T> | null {
  const a = normalizeName(stripPrefix ? stripCategoryPrefix(name) : name);
  if (!a) return null;
  let best: CatalogueCandidate<T> | null = null;
  for (const item of items) {
    const b = normalizeName(item.name);
    if (!b || !qualifiersConflict(a, b)) continue;
    const score = diceCoefficient(a, b);
    if (score < SUGGEST_FLOOR) continue;
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}

function pct(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

/** A human sentence for why a line is sitting in review. */
export function matchReasonLabel(reason: OrderMatchReason): string {
  switch (reason) {
    case 'matched':
      return 'Matched to your catalogue';
    case 'low_confidence':
      return 'Close to a product but not the same one — confirm it';
    case 'variant_conflict':
      return 'A different colour, size or cut to anything in your catalogue — confirm it';
    case 'duplicate':
      return 'Two lines on this document read as the same product — confirm both';
    case 'no_candidate':
      return 'No product in your catalogue matches this line';
  }
}

/**
 * Where the reviewer is told this line's price came from.
 *
 * Pricing an order from the org's OWN list is correct — Turn 'n Slice bills at
 * Turn 'n Slice prices, not at whatever figure a customer's purchase order
 * happens to carry — but on the Bakubung order the screen simply showed a number
 * with no origin, so "R23.80 a box" read as a misreading of "R569.90 a box"
 * rather than as our list price for a product we had matched wrong. Naming the
 * origin is what separates the two for a human.
 */
export function priceSourceLabel(source: OrderPriceSource, listName?: string | null): string {
  switch (source) {
    case 'document':
      return 'Price read off the document';
    case 'custom':
      return listName ? `Your agreed price for this customer (${listName})` : 'Your agreed price for this customer';
    case 'price_list':
      return listName ? `Priced from your price list (${listName})` : 'Priced from your price list';
    case 'base':
      return 'Priced from the product’s own average price';
    case 'none':
      return 'No price yet — this line will not invoice';
  }
}

// --- provenance record ------------------------------------------------------

/** Where a billed line's unit price actually came from. */
export type OrderPriceSource =
  /** The price printed on the customer's own paper. */
  | 'document'
  /** A custom price on the price list that applies to this customer. */
  | 'custom'
  /** The price list's margin (per-product override, or the list default). */
  | 'price_list'
  /** The product's own average unit price — no list applied. */
  | 'base'
  /** No price at all. The line is unpriced and the order cannot auto-invoice. */
  | 'none';

/**
 * One line's full audit trail, stored at `documents.extracted_data.order_lines`
 * (jsonb — no migration, alongside `line_audit` and `direction`).
 *
 * It exists so the review screen can say the two things the Bakubung order could
 * not: what the paper actually said next to what we matched it to, and where the
 * price on the invoice came from. An order priced from the org's own list is
 * correct behaviour — TnS bills at TnS prices, not at whatever a customer's PO
 * happens to carry — but it is only *honest* behaviour if the screen says so and
 * shows the paper's figure beside it.
 */
export interface OrderLineRecord {
  /** The paper's own words, verbatim. */
  raw_description: string;
  /** What the line is billed as: the catalogue product, or the raw text. */
  name: string;
  stock_item_id: string | null;
  matched: boolean;
  match_confidence: number;
  match_reason: OrderMatchReason;
  /** What a refused line nearly matched, for one-click review. */
  suggestion: { id: string; name: string; confidence: number } | null;
  /** The unit price actually billed. Null when the line is unpriced. */
  unit_price: number | null;
  price_source: OrderPriceSource;
  /** The list the price came from, when it came from one. */
  price_list_name: string | null;
  /** The price printed on the customer's paper, whether or not we used it. */
  document_price: number | null;
}
