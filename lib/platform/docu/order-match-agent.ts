/**
 * The MATCHING AGENT: a second, independent model call whose only job is to say
 * which catalogue product one order line is — or that none of them is.
 *
 * WHY A SECOND CALL. Until now one call did both jobs: transcribe three pages of
 * a purchase order AND decide, per row, which of several hundred catalogue names
 * each row denotes. Those are different skills and they compete for the same
 * attention, and the reading is what suffered — "MUSHROOM GABLE 445.50" came
 * back as "Mushroom Garlic Box 443", "BRINJALS" as "Cabbage", "MIX VEGETABLES
 * 66.90" as "Beetroot 66.50". A reader that is also holding a catalogue in mind
 * starts seeing catalogue words on the page. So the reader now only reads, and
 * the matching happens afterwards, once per line, against a shortlist, with the
 * paper's own words in front of it and nothing else to do.
 *
 * WHAT THE AGENT IS ALLOWED TO DECIDE. Exactly one thing: which of the
 * candidates it was handed, if any, is this line. It cannot invent a product, it
 * cannot rename one, it cannot price anything, and it cannot make a line match
 * that the deterministic gate has already settled. Everything else in this file
 * is the machinery for making sure it cannot do more than that.
 *
 * THE INVARIANTS SURVIVE IT. This module is a proposer; `order-line-match.ts`
 * remains the judge. Every decision the agent returns is re-checked here against
 * the same rules the deterministic matcher enforces, in code, not in the prompt:
 *
 *   1. A product it names must be ON THAT LINE'S OWN SHORTLIST. An id from
 *      another line, or an id it made up, is discarded.
 *   2. A candidate whose colour / size / cut / variety disagrees with the paper
 *      is REFUSED even if the agent chose it. "Grapes White" may not become
 *      "Grapes Black" because a model was confident. `qualifiersConflict` has
 *      the last word, not the prompt's plea.
 *   3. Pack/unit compatibility. A line the paper counts in BOXES may not be
 *      matched to a product sold by the KILOGRAM — the price means a different
 *      thing and the invoice would be wrong by whatever a box weighs.
 *   4. `none` produces an unmatched row carrying the raw paper text and NO
 *      price, exactly as a refused deterministic match does, and it still blocks
 *      the auto-invoice.
 *   5. The document-wide duplicate pass RE-RUNS over the agent's output. Two
 *      lines landing on one product is the original Bakubung failure, and a
 *      per-line agent cannot see it any more than a per-line matcher could.
 *
 * AND IT NEVER GETS THE EASY ONES. A line the deterministic matcher settled at
 * or above `AUTO_MATCH_FLOOR` (0.9 — effective identity) BYPASSES the agent
 * entirely. Asking a model to re-decide "VEG - PEPPERS GREEN" → "Peppers Green"
 * buys nothing and risks something.
 *
 * PURE. Prompt in, decisions in, resolutions out. The transport lives in
 * `lib/ai/order-match-call.ts`; a failed call means the deterministic result
 * stands untouched. `.ts`-suffixed relative imports because `node --test`
 * resolves neither extensionless ESM specifiers nor the `@/` alias.
 */
import { diceCoefficient, normalizeName } from '../procurepulse/matching.ts';
import {
  AUTO_MATCH_FLOOR,
  effectiveUnit,
  normaliseUnit,
  packFromName,
  qualifiersConflict,
  refuseDuplicateProducts,
  sharesOnlyQualifiers,
  stripCategoryPrefix,
  unitsCompatible,
  type CatalogueItem,
  type OrderLineResolution,
} from './order-line-match.ts';

/**
 * How many candidates one line's shortlist may carry.
 *
 * Six. Enough that the right product is nearly always among them; few enough
 * that the agent is choosing rather than searching, and few enough that a
 * three-page order stays one modest request per line.
 */
export const SHORTLIST_SIZE = 6;

/**
 * The similarity floor for appearing on a shortlist at all.
 *
 * DELIBERATELY MUCH LOWER than `SUGGEST_FLOOR` (0.5). The shortlist is not a
 * recommendation — it is the set of things the agent is permitted to consider,
 * and a floor tuned for "worth showing a human" hides the right answer from a
 * reader that could have recognised it. "MUSHROOM GABLE" against "Mushrooms
 * Portabellini" scores far below 0.5 and is nevertheless the sort of pairing
 * only a reader can settle. Relaxing the shortlist costs nothing, because the
 * agent's choice is re-gated on the way back out.
 */
export const SHORTLIST_FLOOR = 0.2;

// The pack/unit guard itself lives in `order-line-match.ts`, beside the
// qualifier guard and for the same reason: it is a rule about what a match IS,
// enforced on the deterministic path as well as this one. Re-exported here
// because the shortlist and the decision check are its other two callers.
export { effectiveUnit, normaliseUnit, packFromName, unitsCompatible };

/** One candidate offered to the agent for one line. */
export interface ShortlistCandidate {
  id: string;
  name: string;
  /** The pack this product is sold in, as far as the catalogue says. */
  unit: string | null;
  /** Raw string similarity, 0–1 — shown to the agent as a hint, never a verdict. */
  similarity: number;
}

/**
 * The catalogue rows this line is permitted to be matched to.
 *
 * Scored on RAW dice — deliberately not `scoreCatalogueMatch`, which zeroes a
 * qualifier conflict. A conflicting variant BELONGS on the shortlist: showing
 * the agent "Grapes Black" next to a paper that says GRAPES WHITE is how it
 * learns to answer `none`, and hiding it would leave the agent guessing at what
 * the catalogue contains. The conflict is enforced on the way back out instead,
 * where a prompt cannot argue with it.
 *
 * Pack-incompatible rows are excluded outright rather than shown-and-refused:
 * unlike a variety, a unit mismatch is decidable here with certainty, and an
 * option the agent may not take is only a way to waste its attention.
 */
export function shortlistFor<T extends CatalogueItem>(
  rawName: string,
  lineUnit: string | null | undefined,
  items: T[],
  opts: { stripPrefix?: boolean; limit?: number; floor?: number } = {},
): ShortlistCandidate[] {
  const limit = opts.limit ?? SHORTLIST_SIZE;
  const floor = opts.floor ?? SHORTLIST_FLOOR;
  const a = normalizeName(opts.stripPrefix === false ? rawName : stripCategoryPrefix(rawName));
  if (!a) return [];

  const scored: ShortlistCandidate[] = [];
  for (const item of items) {
    const b = normalizeName(item.name);
    if (!b) continue;
    const pack = effectiveUnit(item);
    if (!unitsCompatible(lineUnit, pack)) continue;
    const similarity = diceCoefficient(a, b);
    if (similarity < floor) continue;
    scored.push({ id: item.id, name: item.name, unit: pack, similarity: round3(similarity) });
  }
  return scored
    .sort((x, y) => y.similarity - x.similarity || x.name.localeCompare(y.name))
    .slice(0, limit);
}

/** One line as the agent sees it: the paper's own words and its own packing. */
export interface MatchAgentLine {
  /** The line's position in the document. The agent echoes it back. */
  index: number;
  /** The product text EXACTLY as printed. The only description it is given. */
  raw_description: string;
  /** The counting unit the paper used ("Box", "Each", "kg"), or "". */
  unit: string;
  /** The outer pack unit where the row prints one ("Box"), or "". */
  bulk_unit: string;
  candidates: { id: string; name: string; unit: string | null }[];
}

/** What the agent decided for one line. */
export interface MatchAgentDecision {
  index: number;
  /** A candidate id, or null for "none of these is this product". */
  productId: string | null;
  /** 0–100, the agent's own confidence. Advisory; never a gate on its own. */
  confidence: number;
  reason: string;
}

/**
 * The system prompt.
 *
 * It says `none` is a good answer four different ways on purpose. Every failure
 * this module exists to stop was a model preferring a wrong answer to no answer:
 * BRINJALS became Cabbage, MIX VEGETABLES became Beetroot, PATTY PAN YELLOW
 * became a tomato. None of those is a near miss — they are what happens when
 * something must be chosen.
 */
export const MATCH_AGENT_SYSTEM = `You match ONE line of a customer's purchase order to a product in a South African fruit & vegetable wholesaler's own catalogue.

You are given, for each line: the product text EXACTLY as printed on the customer's paper, the unit the paper counts it in, and a SHORTLIST of candidate catalogue products. Choose the ONE candidate that is genuinely the SAME product, or null.

NULL IS A CORRECT ANSWER AND OFTEN THE RIGHT ONE. A wrong match is invoiced at another product's price and nobody catches it; a null becomes a question a human answers in five seconds. When you are not sure, answer null. When the shortlist contains nothing that is this product, answer null. You are never required to pick something.

RULES, IN ORDER OF FORCE:
1. A DIFFERENT VARIETY, COLOUR, SIZE, CUT OR GRADE IS A DIFFERENT PRODUCT. Answer null rather than choosing one. "GRAPES WHITE" is not "Grapes Black". "SWEET CORN" is not "Baby Sweet Corn". "PATTY PAN YELLOW" is not any tomato. "BRINJALS" is not "Cabbage". "MIX VEGETABLES" is not "Beetroot" and is not "Cabbage". If the only near candidate differs in one of these ways, that is exactly the case for null.
2. PACK AND UNIT MUST AGREE. The paper's unit tells you which pack was ordered. A line the paper counts in BOXES matches "Avocado (box)", never "Avocado (kg)" — the price of a kilogram and the price of a box are different numbers and the invoice would be wrong by the weight of a box. Where two candidates differ only by pack, the paper's unit decides; where the paper's unit does not match any candidate's pack, answer null.
3. MATCH ON THE PAPER'S WORDS, NOT ON WHAT YOU EXPECT. Category codes a POS prints in front of a name ("FF - ", "VEG - ", "PSAL - ") are filing metadata — ignore them. Spelling, punctuation, abbreviation, plural and pack-suffix differences for the SAME produce ARE matches ("TOMATOES RND" = "Tomatoes Round"). An unfamiliar word is not an invitation to substitute a familiar one.
4. YOU MAY ONLY RETURN AN ID FROM THAT LINE'S OWN CANDIDATE LIST, or null. Never an id from another line, never an invented one, never a name.

Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{ "decisions": [ { "index": <the line's index>, "productId": "<candidate id>" | null, "confidence": <0-100>, "reason": "<short — why this one, or why none>" } ] }
Every line you were given MUST appear exactly once.`;

/**
 * Which lines need the agent, and what it should be told about each.
 *
 * Lines the deterministic gate already settled at effective identity are LEFT
 * OUT — the 0.9 auto-floor bypasses the model entirely. So are lines with no
 * paper text, and lines the catalogue offers nothing at all for: an agent handed
 * an empty shortlist can only answer null, at the cost of a request.
 */
export function buildAgentRequests<T extends CatalogueItem>(
  resolutions: OrderLineResolution<T>[],
  units: (string | null | undefined)[],
  items: T[],
  opts: { stripPrefix?: boolean; bulkUnits?: (string | null | undefined)[] } = {},
): MatchAgentLine[] {
  const out: MatchAgentLine[] = [];
  for (const r of resolutions) {
    if (!r.rawName) continue;
    // Effective identity, already decided. The agent is not consulted, and a
    // customer's confirmed alias (confidence 100) is not second-guessed either.
    if (r.matched && r.confidence >= Math.round(AUTO_MATCH_FLOOR * 100)) continue;
    const lineUnit = units[r.index] ?? null;
    const candidates = shortlistFor(r.rawName, lineUnit, items, { stripPrefix: opts.stripPrefix });
    if (candidates.length === 0) continue;
    out.push({
      index: r.index,
      raw_description: r.rawName,
      unit: (lineUnit ?? '').trim(),
      bulk_unit: (opts.bulkUnits?.[r.index] ?? '').trim(),
      candidates: candidates.map((c) => ({ id: c.id, name: c.name, unit: c.unit })),
    });
  }
  return out;
}

/** The user message for one document's worth of lines. */
export function buildAgentUserMessage(requests: MatchAgentLine[]): string {
  return JSON.stringify({ lines: requests });
}

/**
 * Read the agent's reply into decisions, discarding anything malformed.
 *
 * Never throws. A response we cannot read is a response with no decisions in it,
 * which leaves every deterministic verdict exactly where it was — the correct
 * behaviour for a proposer that failed to propose.
 */
export function parseAgentDecisions(raw: string): MatchAgentDecision[] {
  let value: unknown;
  try {
    const text = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    value = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = Array.isArray(value)
    ? value
    : Array.isArray((value as { decisions?: unknown })?.decisions)
      ? ((value as { decisions: unknown[] }).decisions)
      : [];
  const out: MatchAgentDecision[] = [];
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const index = typeof r.index === 'number' && Number.isInteger(r.index) ? r.index : null;
    if (index == null) continue;
    const productId = typeof r.productId === 'string' && r.productId.trim() ? r.productId.trim() : null;
    const conf = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? r.confidence : 0;
    out.push({
      index,
      productId,
      confidence: Math.max(0, Math.min(100, Math.round(conf))),
      reason: typeof r.reason === 'string' ? r.reason.slice(0, 200) : '',
    });
  }
  return out;
}

/**
 * Fold the agent's decisions into the deterministic resolutions, refusing
 * anything that breaks an invariant, then re-run the duplicate pass.
 *
 * Read the refusals as the point of the function, not as defensive padding. The
 * agent is a second opinion from a system that cannot be constrained by
 * instruction alone, so every rule the prompt states is also enforced here,
 * where it is not negotiable.
 */
export function applyAgentDecisions<T extends CatalogueItem>(
  resolutions: OrderLineResolution<T>[],
  requests: MatchAgentLine[],
  decisions: MatchAgentDecision[],
  items: T[],
  opts: { stripPrefix?: boolean } = {},
): OrderLineResolution<T>[] {
  const stripPrefix = opts.stripPrefix !== false;
  const byIndex = new Map(decisions.map((d) => [d.index, d]));
  const shortlistByIndex = new Map(requests.map((q) => [q.index, q]));
  const unitByIndex = new Map(requests.map((q) => [q.index, q.unit]));
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const merged = resolutions.map((r) => {
    const request = shortlistByIndex.get(r.index);
    // Not asked about → the deterministic verdict stands, whatever it was.
    if (!request) return r;
    const decision = byIndex.get(r.index);
    // Asked and not answered (a short or malformed reply) → also stands. We do
    // not read silence as "none": that would turn a transport fault into a
    // document-wide refusal.
    if (!decision) return r;

    if (decision.productId == null) {
      // An explicit refusal. The line goes to review with the paper's own words
      // and no price, carrying whatever the catalogue nearly offered so the fix
      // is still one click.
      return {
        ...r,
        name: r.rawName,
        item: null,
        matched: false,
        reason: 'agent_declined' as const,
        // Whatever the deterministic pass nearly offered stays offered: the
        // agent declining does not make the near miss less worth one click.
        suggestion: r.suggestion,
      };
    }

    // INVARIANT 1 — an id from this line's own shortlist, or nothing.
    const allowed = new Set(request.candidates.map((c) => c.id));
    const item = allowed.has(decision.productId) ? itemsById.get(decision.productId) ?? null : null;
    if (!item) return r;

    // INVARIANT 2 — colour / size / cut / variety has the last word, in code.
    // Two clauses, because the two failures are mirror images. `qualifiersConflict`
    // catches names that DISAGREE about a qualifier (white grapes / black grapes).
    // `sharesOnlyQualifiers` catches names whose whole agreement IS a qualifier —
    // "PATTY PAN YELLOW" and "Tomato-Yellow Cocktail" share `yellow` and nothing
    // else, which is how a patty pan became a tomato. A prompt cannot be relied on
    // to refuse either, so neither is left to the prompt.
    const paper = normalizeName(stripPrefix ? stripCategoryPrefix(r.rawName) : r.rawName);
    const catalogueName = normalizeName(item.name);
    if (qualifiersConflict(paper, catalogueName) || sharesOnlyQualifiers(paper, catalogueName)) {
      return {
        ...r,
        name: r.rawName,
        item: null,
        matched: false,
        reason: 'variant_conflict' as const,
        suggestion: { id: item.id, name: item.name, confidence: decision.confidence },
      };
    }

    // INVARIANT 3 — pack/unit compatibility, re-checked rather than trusted.
    if (!unitsCompatible(unitByIndex.get(r.index), effectiveUnit(item))) return r;

    return {
      ...r,
      name: item.name,
      item,
      matched: true,
      // The agent's own confidence, not the string gate's — the two measure
      // different things and reporting the wrong one would mislead a reviewer
      // about what actually decided this line.
      confidence: decision.confidence,
      reason: 'matched' as const,
      suggestion: null,
    };
  });

  // INVARIANT 5 — one product, one paper line. A per-line agent cannot see this.
  return refuseDuplicateProducts(merged);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
