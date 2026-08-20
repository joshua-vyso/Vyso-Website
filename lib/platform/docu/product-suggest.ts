/**
 * Product typeahead for Doc-U's line-item description cells.
 *
 * WHY. A reviewer correcting a scanned invoice retypes product names by hand,
 * so the same tomato arrives as "Tomatoes Roma", "TOMATO ROMA 5KG" and
 * "Tomatos-roma". Every spelling variant is a new row in ProcurePulse and a
 * broken price series in Price Watch. Offering the names the org already owns
 * turns a free-text field into a nudge toward the catalogue — without ever
 * *forcing* it: an invoice line is a record of what the paper said, so free
 * text stays legal and nothing here rejects, rewrites or validates a typed
 * value.
 *
 * THE SOURCE is `pp_stock_items` — the single product master (Core Data maps
 * "Products & services → pp_stock_items"; PricePilot's `pl_*` are price lists
 * *over* it, not a second catalogue) — plus the org's confirmed
 * `pp_name_aliases`, so a raw name a human has already ruled on ("Toms Roma")
 * suggests the canonical product it was ruled to be. `pw_items` is deliberately
 * NOT a source: it is Price Watch's derived buy-side catalogue, built from
 * these same document lines, so it would offer the misspellings back.
 *
 * PURE + SYNCHRONOUS. The caller fetches the list once per mount (a few
 * hundred rows) and filters locally on every keystroke — there is no request
 * to debounce, and a dropdown that waits on the network is a dropdown that
 * arrives after the next character.
 *
 * `.ts`-suffixed relative import: `node --test` strips types but resolves
 * neither extensionless ESM specifiers nor the `@/` alias, and this module is
 * loaded directly by tests/docu-product-suggest.test.ts.
 */
import { diceCoefficient, normalizeName } from '../procurepulse/matching.ts';

/** One offerable name: a catalogue product, or an alias pointing at one. */
export interface ProductOption {
  /** `pp_stock_items.id`, or the alias row's id when it links to no product. */
  id: string;
  /** The text written into the description cell when this option is picked. */
  name: string;
  /** The product's counting unit — fills the line's unit when it has none. */
  unit: string | null;
  /** Second line in the dropdown: category, or what the alias resolves from. */
  hint: string | null;
  /**
   * Other names this product answers to — the org's confirmed
   * `pp_name_aliases`. They are MATCHED against but never inserted: typing the
   * messy name a supplier prints is exactly how you find the tidy one the org
   * books it under, and inserting the mess back would defeat the alias.
   */
  aka?: string[] | null;
}

/**
 * Dice floor for a fuzzy (neither prefix nor substring) suggestion.
 *
 * 0.34 is one shared token out of a two-and-three-token pair — enough for
 * "roma tomato" to reach "Tomatoes, Roma Cocktail", and low enough to be
 * useful on a typo, while the scoring below keeps every fuzzy hit strictly
 * beneath every literal one so a real substring match is never buried.
 */
export const FUZZY_FLOOR = 0.34;

/** How many suggestions a dropdown shows. Eight fits without scrolling. */
export const SUGGEST_LIMIT = 8;

/**
 * How well `name` answers what the reviewer has typed: 1 = identical, 0 = do
 * not offer this at all.
 *
 * Tiered on purpose. Literal matches (exact → prefix → word-prefix →
 * substring) all outrank every fuzzy match, because a reviewer who has typed
 * "app" means the thing starting with "app" and would read anything else as
 * the dropdown ignoring them.
 */
export function scoreProductName(name: string, query: string): number {
  const q = query.trim().toLowerCase();
  const lower = (name ?? '').trim().toLowerCase();
  if (!q || !lower) return 0;

  if (lower === q) return 1;

  // Normalised equality — "Apples (Golden) 5kg" vs "golden apples".
  const nName = normalizeName(name);
  const nQuery = normalizeName(query);
  if (nName && nName === nQuery) return 0.98;

  if (lower.startsWith(q)) return 0.95;
  // Any word of the name starting with the query: "gold" → "Apples Golden".
  if (lower.split(/[^a-z0-9]+/).some((t) => t.length > 0 && t.startsWith(q))) return 0.9;
  if (lower.includes(q)) return 0.85;

  if (!nName || !nQuery) return 0;
  const d = diceCoefficient(nName, nQuery);
  // × 0.8 keeps the whole fuzzy band below the 0.85 substring tier.
  return d >= FUZZY_FLOOR ? d * 0.8 : 0;
}

/** An option scores as its best-matching name — canonical or alias. */
export function scoreOption(option: ProductOption, query: string): number {
  let best = scoreProductName(option.name, query);
  for (const alias of option.aka ?? []) {
    if (best === 1) break;
    const s = scoreProductName(alias, query);
    if (s > best) best = s;
  }
  return best;
}

/**
 * The dropdown's contents for what has been typed so far.
 *
 * An empty query offers the head of the catalogue (the caller passes it
 * already sorted by name), which is what focusing a blank description cell
 * should show. Duplicate names — an alias spelled exactly like its product —
 * collapse to the first occurrence, so the caller controls precedence by
 * ordering products ahead of aliases.
 */
export function suggestProducts(
  options: ProductOption[],
  query: string,
  limit: number = SUGGEST_LIMIT,
): ProductOption[] {
  const byName = new Map<string, ProductOption>();
  for (const o of options) {
    const key = (o.name ?? '').trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, o);
      continue;
    }
    // The same name twice: keep the first (the caller lists products ahead of
    // aliases) but inherit the later entry's other names, so collapsing a
    // duplicate row never costs a way of finding it.
    const aka = [...(existing.aka ?? []), ...(o.aka ?? [])];
    if (aka.length > 0) byName.set(key, { ...existing, aka });
  }
  const dedup = [...byName.values()];

  if (!query.trim()) return dedup.slice(0, limit);

  return dedup
    .map((option) => ({ option, score: scoreOption(option, query) }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.option.name.length - b.option.name.length ||
        a.option.name.localeCompare(b.option.name),
    )
    .slice(0, limit)
    .map((s) => s.option);
}
