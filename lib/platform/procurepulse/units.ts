/**
 * Units of measurement for the product catalogue. A unit is either a COUNT
 * (boxes, bags, punnets…) or a WEIGHT (kg, g). The conversion engine only moves
 * between those two dimensions, using the per-document weights Doc-U extracted.
 */

export const BUILT_IN_UNITS: readonly string[] = [
  'kg', 'g', 'boxes', 'bags', 'ea', 'punnets', 'bunches', 'trays', 'crates', 'pkts', 'L', 'ml', 'units',
];

const WEIGHT_UNITS = new Set(['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'kgs', 'gs']);

export type UnitDimension = 'weight' | 'count';

/** Classify a unit. Anything not recognised as a weight is treated as a count. */
export function unitDimension(unit: string | null | undefined): UnitDimension {
  return WEIGHT_UNITS.has((unit ?? '').trim().toLowerCase()) ? 'weight' : 'count';
}

/** kg → this weight unit (Doc-U extracts weights in kg, where <1 means grams). */
export function kgTo(unit: string): number {
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams' || u === 'gs') return 1000;
  return 1; // kg and everything else weight-ish
}

/** Built-in units plus the org's custom ones, de-duplicated (case-insensitive). */
export function allUnits(custom: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...BUILT_IN_UNITS, ...(custom ?? [])]) {
    const t = (u ?? '').trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/** Does changing fromUnit → toUnit cross the count/weight boundary (→ recalc)? */
export function crossesDimension(fromUnit: string, toUnit: string): boolean {
  return unitDimension(fromUnit) !== unitDimension(toUnit);
}

/**
 * Distinct, sorted unit strings out of a raw list — the vocabulary for a unit
 * `<select>` on Recipes/Batches. Deliberately NOT `allUnits()` above: that one
 * is a fixed conversion-engine list plus an org's opted-in `custom_units`
 * setting, but a recipe/batch unit picker should offer what the org's stock
 * items are *actually* denominated in today, however messy ("pkt", "250gr
 * pkt", "bx" all coexist in real data) — so callers pass `pp_stock_items.unit`
 * values straight through. Deduping is case-insensitive (`"kg"`/`"Kg"` collapse
 * to one option, keeping whichever casing was seen first) so the same unit
 * doesn't show up twice; the result is alphabetically sorted so the list is
 * scannable instead of ordered by table-scan luck.
 *
 * Callers fold a field's current value into the input list before calling
 * this (e.g. `distinctItemUnits([...orgUnits, row.unit])`) so a `<select>`
 * built from the result can always represent what's already saved, even a
 * one-off unit no other stock item uses.
 */
export function distinctItemUnits(units: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>(); // lowercase key -> first-seen casing
  for (const raw of units) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
