/**
 * Price Watch — pure normalisation helpers. No I/O, no Supabase, no Claude:
 * everything here is deterministic and unit-testable in isolation.
 *
 * Three independent jobs live in this file (plan `.ai/plan_price_watch_agent.md`,
 * acceptance criterion 3 + the "Post-pilot amendments" section):
 *
 *   1. normalizeLineUnitPrice — turn a raw Doc-U line item into a price
 *      expressed in a stable base unit (kg where possible, else the printed
 *      counting unit), so a pack-size change alone can never look like a
 *      price move.
 *   2. buildSupplierAliasMap — fold truncated/duplicate per-line market-agent
 *      names ("Botha Roodt & Ki" vs "Botha Roodt & Kie") onto one canonical
 *      spelling, so a price series doesn't fork in two because Doc-U didn't
 *      de-truncate a name consistently.
 *   3. itemDescriptionKey — the comparison key Price Watch's (out-of-scope-
 *      here) Claude matcher will use to shortlist canonical pw_items
 *      candidates for a raw line description.
 */

// Relative imports (not the '@/' alias used elsewhere in lib/platform/…):
// this module is loaded directly by `node --test`, which has no tsconfig
// "paths" resolution — only Next.js/tsc understand '@/'. Matches the
// existing pattern for other directly-tested pure modules (e.g.
// serviceden-email.ts's `from './serviceden'`).
import { parseAmount } from '../docu/extract.ts';
import { kgTo, unitDimension } from '../procurepulse/units.ts';
import { normalizeName } from '../procurepulse/matching.ts';

// ---------------------------------------------------------------------------
// 1. Unit-price normalisation
// ---------------------------------------------------------------------------

/** The subset of ExtractedLineItem (lib/ai/anthropic.ts) this function needs.
 *  All fields are the raw strings Doc-U extracts — parsed here, not upstream. */
export interface LineForNormalization {
  description?: string;
  quantity?: string;
  unit?: string;
  unit_price?: string;
  weight?: string;
  total_kg?: string;
  /** Packs per box on a punnet/tray line — but a fruit COUNT CODE on a carton
   *  line. normalizeLine decides which by the box weight it implies; see
   *  PLAUSIBLE_BOX_MIN_KG. */
  units_per_box?: string;
}

export type BaseUnit = 'kg' | 'unit';

/**
 * HOW a line's per-kg price was arrived at. Threaded through run.ts onto every
 * price point and enforced by detect.ts, which refuses to compare a series whose
 * points were derived different ways.
 *
 * This is load-bearing, not metadata. The 2026-08-14 diagnosis proved it
 * experimentally: a series that is mis-scaled but CONSISTENTLY mis-scaled still
 * reports honest percentages and rand impacts (the scale factor cancels in both
 * (latest-median)/median and delta x volume). A series that MIXES bases is what
 * explodes — correcting sub-pack lines without this gate produced a fresh
 * R1.8m broccoli artifact where a 12-punnet box was compared against a loose kg.
 */
export type NormalizationBasis =
  /** Row was already priced by weight ("unit" is kg/g/...). */
  | 'weight_unit'
  /** Box of N sub-kg packs: price is per BOX, weight is per PACK. */
  | 'sub_pack'
  /** Ordinary pack with a real per-pack weight (>= 1kg). */
  | 'pack_weight'
  /** No weight survived extraction — price is per printed counting unit. */
  | 'count';

export interface NormalizedUnitPrice {
  /** Unit price expressed in baseUnit terms (rand per kg, or rand per the
   *  printed counting unit when kg conversion wasn't possible). */
  unitPriceBase: number;
  /** Quantity for this line expressed in baseUnit terms. */
  quantityBase: number;
  baseUnit: BaseUnit;
  /** How this price was derived — see NormalizationBasis. */
  basis: NormalizationBasis;
  /** Packs per box, ONLY for basis 'sub_pack'. Part of the series identity: a
   *  supplier that switches from 12-packs to 8-packs has changed what a "box"
   *  means, and the two are not comparable prices even though both are per-kg. */
  packsPerBox: number | null;
}

/** Why a line produced no price point. */
export type NormalizeRejection =
  /** Unparseable, zero or negative unit price — not a price observation. */
  | 'no_price'
  /**
   * A sub-kg pack weight with no trustworthy box grouping. NOT normalisable:
   * dividing a per-box price by a per-punnet weight is what produced
   * "Lettuce R400/kg" and "Strawberries R1,280/kg" in the live backfill.
   */
  | 'sub_pack_unresolvable';

export interface NormalizeResult {
  value: NormalizedUnitPrice | null;
  rejection: NormalizeRejection | null;
}

/**
 * A plausible produce box, in kg. Used to decide whether `units_per_box` is a
 * PACK MULTIPLIER or a FRUIT COUNT CODE — the polysemy at the heart of the
 * 2026-08-14 artifacts:
 *
 *   - Ginger Processed: weight 1kg, units_per_box 6   -> 6kg box    (multiplier)
 *   - Apples Golden:    weight 18.5kg, units_per_box 135 -> 2,497kg (count code:
 *     135 is the FRUIT COUNT in the carton, an industry size grade)
 *
 * A bare "weight >= 1kg means ignore units_per_box" rule gets ginger wrong
 * (R456/kg instead of the real R76/kg), so the test is the PRODUCT: if
 * weight x units_per_box lands inside a range a human could lift, it is a real
 * box; otherwise the number is not a multiplier at all.
 */
const PLAUSIBLE_BOX_MIN_KG = 2;
const PLAUSIBLE_BOX_MAX_KG = 25;

/**
 * Normalise one Doc-U line item to a base-unit price.
 *
 * Per EXTRACT_INSTRUCTION (lib/ai/anthropic.ts): `weight` is always the
 * PER-PACK weight already converted to kg (e.g. a 300g punnet -> "0.3"), and
 * `total_kg` is that weight × quantity, so both are already kg-denominated —
 * neither needs a unit-string conversion. `unit` is the COUNTING unit
 * (boxes/pockets/punnets/...), or "kg" when the row is priced by weight
 * directly. `unit_price` is always "per whatever `unit` says".
 *
 * Returns null for a line that isn't a usable price observation at all
 * (unparseable or zero/negative unit_price — a credit-note reversal, a
 * "no charge" promo line, or extraction noise; letting a 0 or negative
 * value into a median would silently corrupt every later comparison, so it
 * is rejected here rather than downstream).
 */
export function normalizeLineUnitPrice(line: LineForNormalization): NormalizedUnitPrice | null {
  return normalizeLine(line).value;
}

/**
 * The full form of normalizeLineUnitPrice: the price, or the REASON there isn't
 * one. run.ts needs the reason (a line parked as unnormalisable is a data-quality
 * signal a human should see, and is a different fact from "this line has no
 * price"); everything else just wants the value, and calls the wrapper above.
 */
export function normalizeLine(line: LineForNormalization): NormalizeResult {
  const unitPrice = parseAmount(line.unit_price);
  if (unitPrice == null || unitPrice <= 0) return { value: null, rejection: 'no_price' };

  const quantity = parseAmount(line.quantity);
  const weight = parseAmount(line.weight);
  const totalKg = parseAmount(line.total_kg);
  const unitsPerBox = parseAmount(line.units_per_box);
  const unitLabel = (line.unit ?? '').trim().toLowerCase();

  // Case 1: the row is already priced BY WEIGHT ("unit" is kg/g/... per
  // procurepulse/units.ts's WEIGHT_UNITS). kgTo(unit) is "how many `unit`s
  // per 1kg", so unit_price (rand per `unit`) × kgTo(unit) = rand per kg,
  // and quantity (in `unit`) ÷ kgTo(unit) = quantity in kg. total_kg is
  // preferred when present because it's the value Doc-U derived directly
  // rather than one this function has to re-derive.
  if (unitLabel && unitDimension(unitLabel) === 'weight') {
    const factor = kgTo(unitLabel);
    const unitPriceBase = unitPrice * factor;
    const quantityBase =
      totalKg != null && totalKg > 0
        ? totalKg
        : quantity != null && quantity > 0
          ? quantity / factor
          : 0;
    return {
      value: { unitPriceBase, quantityBase, baseUnit: 'kg', basis: 'weight_unit', packsPerBox: null },
      rejection: null,
    };
  }

  // Case 2: a counting unit (boxes, pockets, punnets, ...), or no unit label
  // at all, but a per-pack weight lets us convert box-price -> kg-price. This
  // is the case acceptance criterion 3 exists for: a pack-size change with a
  // flat per-kg price (e.g. 10 x 5kg boxes -> 5 x 10kg boxes, same rand/kg)
  // must normalise to an IDENTICAL unitPriceBase, not register as a "price
  // change" just because the printed per-box price doubled.
  //
  // perUnitWeight prefers the extracted `weight` field; when that's blank
  // but total_kg and quantity both survived extraction, weight = total_kg /
  // quantity is recoverable (total_kg is defined as weight × quantity per
  // the extraction contract) — this is the "... or total_kg" half of "kg
  // when weight/total_kg allow".
  const perUnitWeight =
    weight != null && weight > 0
      ? weight
      : totalKg != null && totalKg > 0 && quantity != null && quantity > 0
        ? totalKg / quantity
        : null;

  if (perUnitWeight != null && perUnitWeight > 0) {
    // Case 2a: SUB-PACK. `units_per_box` is a real pack multiplier when the box
    // it implies is a box a person could carry. Doc-U's extraction contract says
    // unit_price is "per whatever `unit` says" and tells the model NOT to
    // multiply by units_per_box — correct for a loose 10kg carton, wrong for a
    // tray of punnets, where the printed price is per TRAY and the printed
    // weight is per PUNNET. Left uncorrected that inflates the per-kg price by
    // exactly units_per_box (Tomatoes Saladette read R857.14/kg against a real
    // R42.86/kg on a 20-punnet tray).
    const boxKg =
      unitsPerBox != null && unitsPerBox > 1 ? perUnitWeight * unitsPerBox : null;
    if (boxKg != null && boxKg >= PLAUSIBLE_BOX_MIN_KG && boxKg <= PLAUSIBLE_BOX_MAX_KG) {
      // quantity counts BOXES here, so the line's kg is boxes x kg-per-box.
      // total_kg is deliberately NOT used: Doc-U computes it as weight x
      // quantity, which on these lines is punnet-weight x boxes — a number that
      // is neither the pack weight nor the line weight.
      const quantityBase = quantity != null && quantity > 0 ? quantity * boxKg : 0;
      return {
        value: {
          unitPriceBase: unitPrice / boxKg,
          quantityBase,
          baseUnit: 'kg',
          basis: 'sub_pack',
          packsPerBox: unitsPerBox,
        },
        rejection: null,
      };
    }

    // Case 2b: PARK. A sub-kg pack weight with no usable box grouping cannot be
    // normalised at all, and the one thing we must NOT do is fall through to
    // unit_price / weight: a punnet weight under the line's real pack size turns
    // a R100 tray into "R400/kg lettuce". No price point, counted as
    // unnormalisable so the volume of them is visible rather than silent.
    if (perUnitWeight < 1) {
      return { value: null, rejection: 'sub_pack_unresolvable' };
    }

    // Case 2c: ordinary pack with a real per-pack weight. `units_per_box` is
    // IGNORED here by design — on a carton line it is a fruit COUNT CODE
    // (Apples Golden Delicious: 18.5kg, "135" = the count of fruit in the
    // carton, an industry size grade), and multiplying by it would claim a
    // 2.5-tonne box. The plausible-box test above already claimed every case
    // where the number really is a multiplier, including the 1kg-pack boundary
    // (Ginger Processed 1kg x 6).
    const unitPriceBase = unitPrice / perUnitWeight;
    const quantityBase =
      totalKg != null && totalKg > 0
        ? totalKg
        : quantity != null && quantity > 0
          ? quantity * perUnitWeight
          : 0;
    return {
      value: { unitPriceBase, quantityBase, baseUnit: 'kg', basis: 'pack_weight', packsPerBox: null },
      rejection: null,
    };
  }

  // Case 3: no weight information survived extraction at all — fall back to
  // comparing the printed per-counting-unit price as-is. Two lines only
  // genuinely match here when they share the same pack unit; detect.ts's
  // series grouping is by (supplier, item), not by unit, so a supplier that
  // switches from "per box" to "per bag" pricing without a weight figure on
  // either line is a known blind spot for v1 (no data to correct it with).
  return {
    value: {
      unitPriceBase: unitPrice,
      quantityBase: quantity != null && quantity > 0 ? quantity : 0,
      baseUnit: 'unit',
      basis: 'count',
      packsPerBox: null,
    },
    rejection: null,
  };
}

// ---------------------------------------------------------------------------
// 2. Supplier-name (market-agent) aliasing
// ---------------------------------------------------------------------------

/** Fold case + punctuation for comparison only; never used for display. */
function foldSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation ("&", ".", ",") -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/** One folded name is a truncation of the other -> same market agent.
 *  Threshold per the architect decision (plan "Post-pilot amendments"): the
 *  SHORTER folded form must be at least 12 characters. Below that, a prefix
 *  match is too likely to be a coincidence (e.g. two genuinely different
 *  agents that both start "C L "). Exact-fold equality (same name, just
 *  different case/punctuation) always merges regardless of length — that
 *  isn't a truncation guess, it's the same string. */
function isPrefixMerge(foldedA: string, foldedB: string): boolean {
  if (!foldedA || !foldedB) return false;
  if (foldedA === foldedB) return true;
  const [shorter, longer] = foldedA.length <= foldedB.length ? [foldedA, foldedB] : [foldedB, foldedA];
  return shorter.length >= 12 && longer.startsWith(shorter);
}

/**
 * Merge a set of observed per-line supplier (market-agent) names into a
 * name -> canonical map, using deterministic prefix-merging (no AI, no
 * fuzzy scoring — this is specifically the truncation problem Doc-U's
 * extraction leaves behind, e.g. "Botha Roodt & Ki" vs "Botha Roodt & Kie",
 * not a general name-matching problem).
 *
 * Canonical = the LONGEST observed raw form in each merged cluster (the
 * architect decision: prefer more information over less). Ties broken by
 * localeCompare so the result is stable across runs regardless of Set/Map
 * iteration order.
 *
 * Clustering is transitive: A is a prefix of B, B is a prefix of C -> all
 * three land in one cluster, even though A may not itself satisfy the
 * ≥12-char-prefix test against C directly. Implemented as union-find over
 * all pairs — the input is a handful of market-agent names per org, so O(n²)
 * is not a concern.
 */
export function buildSupplierAliasMap(observedNames: Iterable<string>): Map<string, string> {
  const names = [...new Set([...observedNames].map((n) => n.trim()).filter(Boolean))];
  const folded = names.map(foldSupplierName);

  // Union-find.
  const parent = names.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      if (isPrefixMerge(folded[i], folded[j])) union(i, j);
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < names.length; i += 1) {
    const root = find(i);
    const arr = clusters.get(root) ?? [];
    arr.push(i);
    clusters.set(root, arr);
  }

  const out = new Map<string, string>();
  for (const members of clusters.values()) {
    const canonical = members
      .map((i) => names[i])
      .sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
    for (const i of members) out.set(names[i], canonical);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Item description comparison key
// ---------------------------------------------------------------------------

/**
 * Comparison key for a raw Doc-U line description, for shortlisting pw_items
 * candidates before Price Watch's Claude matcher (match.ts, out of this
 * file's scope) picks one — or rejects all of them into the review queue.
 *
 * Two normalizers already exist in the repo and the plan is explicit that a
 * third must not be written:
 *
 *   - supplysync-pricing.ts's `itemKey` — an EXACT-match grouping key,
 *     word-order-preserving, used to fold price OBSERVATIONS that are
 *     already known to be the same item (by construction: same supplier,
 *     same raw description) into one series. It has no fuzzy/scored
 *     companion.
 *   - procurepulse/matching.ts's `normalizeName` — token-SORTED (word order
 *     doesn't matter: "Oranges Navel" == "Navel Oranges"), a wider
 *     NOISE_WORDS list (drops "loose"/"fresh" as well as pack units), and
 *     comes with `diceCoefficient` for scored fuzzy comparison. It exists
 *     specifically to pair a Doc-U-fed name against a catalogue of
 *     candidate names and rank them.
 *
 * Price Watch's job here is exactly ProcurePulse's matching job: take a raw
 * Doc-U description and find the closest candidate(s) in a canonical item
 * catalogue (pw_items), not re-key an observation that's already been
 * assigned to a series. `normalizeName` (+ `diceCoefficient`, used by the
 * out-of-scope matcher) is the fitter tool; reused as-is rather than
 * duplicated.
 */
export function itemDescriptionKey(description: string): string {
  return normalizeName(description);
}
