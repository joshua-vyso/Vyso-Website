/**
 * CUSTOMER-SCOPED CONDITIONAL UOM RULES.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT `cd_customer_item_aliases`. An alias
 * answers "which catalogue product does this customer's wording mean" — a
 * question about the PRODUCT. This module answers a narrower, later one:
 * given a line whose product is already settled, which OPERATIONAL UNIT does
 * this customer's printed unit actually mean. A customer whose paper always
 * prints KG for a line that is, in fact, sold and picked by the punnet is not
 * naming a different product — it is misdescribing the same product's pack,
 * consistently, forever, because that is what their POS prints. Confirming it
 * once and applying it to every later order from THAT customer is exactly the
 * shape of `cd_customer_item_aliases`'s own justification (see
 * customer-item-alias.ts), applied to a different fact.
 *
 * SCOPED TO ONE COUNTERPARTY, for the identical reason aliases are: "KG means
 * punnet" is true of one customer's paper, not of the produce.
 *
 * RIDER 2 (plan_customer_uom_rules.md, NON-NEGOTIABLE 2), REPEATED HERE
 * BECAUSE IT IS THE PART MOST LIKELY TO GET "FIXED" LATER: when two rules at
 * the same specificity tier both match a line and disagree about the target
 * unit, `applyCustomerUomRules` returns a conflict and the line keeps its
 * printed unit. There is NO tiebreak — not by `created_at`, not by row order,
 * not by id, not "the first one found". Any of those would silently pick a
 * unit nobody actually confirmed for that exact situation, which is the same
 * failure this whole feature exists to prevent one layer up (see
 * order-line-match.ts's own docblock on the Bakubung misbillings).
 *
 * RIDER 1: `deriveUomRuleCondition` is the ONE function that turns a
 * (description, printed unit, chosen unit) triple into a rule condition, and
 * both the inline suggestion the reviewer reads and the row that gets saved
 * are built from its return value — never two independently-worded copies of
 * the same fact that can drift apart.
 *
 * PURE. No React, no Supabase imports. `.ts`-suffixed relative imports:
 * `node --test` strips types but resolves neither extensionless ESM
 * specifiers nor the `@/` alias.
 */
import { aliasKey } from './customer-item-alias.ts';
import { normaliseUnit, type OrderLineRecord } from './order-line-match.ts';

// --- normalisation ------------------------------------------------------

/**
 * Lowercase + collapsed whitespace — the exact fold `cd_customer_item_aliases`
 * keys its rows on (`aliasKey`). Reused rather than reimplemented: two
 * normalisers that are meant to agree and are maintained separately is how
 * "Punnet" quietly stops matching "punnet " in one code path but not the
 * other. This is the fold for free text (a description); `printed_unit` and
 * `target_unit` go through `normaliseUnit` instead, because a unit word has
 * its own spelling variants ("pkt"/"packet"/"pack") that free-text lowercasing
 * does not fold.
 */
export const normaliseRuleText = aliasKey;

// --- packaging tokens -----------------------------------------------------

/**
 * The packaging words a rule's condition is allowed to key on, closed list.
 *
 * A closed list beats a free regex on purpose: every entry here is something
 * a human can read on the suggestion card and recognise ("contains 'punnet'"),
 * and the set of words a condition can ever be built from is exactly what is
 * printed here — no surprise token nobody reviewed starts steering orders
 * because it happened to appear in one description. Extending it is a
 * one-line, reviewable change; a regex that "detects packaging-like words"
 * is not.
 */
export const PACKAGING_TOKENS: readonly string[] = [
  'punnet', 'packet', 'tray', 'box', 'bag', 'bunch', 'crate', 'tub', 'carton',
  'pack', 'each', 'dozen', 'doz', 'sachet', 'bottle', 'jar', 'tin', 'can',
];

/** Word-boundary containment of `word` in an already-normalised `text`. */
function containsWord(text: string, word: string): boolean {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(text);
}

/** True when `token`'s folded form is (or prefixes / is prefixed by) the
 *  reviewer's chosen unit — the loose match that lets "punnet" in the
 *  description line up with a chosen unit of "punnets". */
function tokenMatchesChosenUnit(token: string, chosenNorm: string): boolean {
  if (!chosenNorm) return false;
  const tokenNorm = normaliseUnit(token) ?? token;
  return tokenNorm === chosenNorm || chosenNorm.startsWith(tokenNorm) || tokenNorm.startsWith(chosenNorm);
}

// --- the condition, derived once and shared by display + save -------------

/** One rule's condition + result, in the exact shape both the inline
 *  suggestion card and the saved `cd_customer_uom_rules` row are built from —
 *  see the RIDER 1 note above. */
export interface UomRuleCondition {
  match_kind: 'token' | 'exact_description';
  description_condition: string;
  printed_unit: string;
  target_unit: string;
}

/**
 * The condition a reviewer's unit change implies, given the line's own words.
 *
 * Preference order:
 *  1. A packaging token whose folded form matches the CHOSEN unit AND is
 *     present in the description — the rule reads "when the description says
 *     punnet, it's a punnet", which is the reviewer's own reasoning made
 *     explicit.
 *  2. Failing that, the first known packaging token present at all — still a
 *     real, checkable condition, just not provably the one the reviewer had
 *     in mind.
 *  3. Failing that, the full normalised description verbatim
 *     (`exact_description`) — the rule then means exactly the one line it was
 *     confirmed on, no broader, which is the correct fallback when nothing on
 *     the closed list appears: a narrow true rule beats a broad guessed one.
 *
 * `printedUnit`/`chosenUnit` are folded through `normaliseUnit` so the saved
 * condition and the line's printed unit are compared on the same terms
 * `ruleMatchesLine` and the rest of the matcher already use.
 */
export function deriveUomRuleCondition(
  description: string | null | undefined,
  printedUnit: string | null | undefined,
  chosenUnit: string | null | undefined,
): UomRuleCondition {
  const normDescription = normaliseRuleText(description);
  const normPrintedUnit = normaliseUnit(printedUnit) ?? '';
  const normChosen = normaliseUnit(chosenUnit) ?? normaliseRuleText(chosenUnit);

  let token: string | null = null;
  for (const t of PACKAGING_TOKENS) {
    if (tokenMatchesChosenUnit(t, normChosen) && containsWord(normDescription, t)) {
      token = t;
      break;
    }
  }
  if (!token) {
    for (const t of PACKAGING_TOKENS) {
      if (containsWord(normDescription, t)) {
        token = t;
        break;
      }
    }
  }

  if (token) {
    return { match_kind: 'token', description_condition: token, printed_unit: normPrintedUnit, target_unit: normChosen };
  }
  return {
    match_kind: 'exact_description',
    description_condition: normDescription,
    printed_unit: normPrintedUnit,
    target_unit: normChosen,
  };
}

/**
 * True when two conditions are the same row under the migration's unique key
 * — (match_kind, description_condition, printed_unit), the org/customer scope
 * assumed equal by the caller. Deliberately ignores `target_unit`: two
 * conditions that agree on everything else but name a different result are
 * not a duplicate, they are the "reviewer changed their mind" case the
 * upsert is supposed to overwrite (see OrderReviewEditor's "Update rule"
 * action) — not a fresh row and not a fresh suggestion either.
 */
export function sameRuleCondition(a: UomRuleCondition, b: UomRuleCondition): boolean {
  return (
    a.match_kind === b.match_kind &&
    a.description_condition === b.description_condition &&
    a.printed_unit === b.printed_unit
  );
}

/**
 * The reviewer-facing sentence for a condition:
 *   "When the printed UOM is KG and the description contains "punnet""
 *   "When the printed UOM is KG and the description is exactly "…""
 *
 * RIDER 1: this reads the SAME `UomRuleCondition` object that gets upserted
 * into `cd_customer_uom_rules` — there is no second, hand-written copy of the
 * sentence that could describe one thing while the saved row means another.
 * Never a vague "KG → Punnet": every exact condition, spelled out.
 */
export function describeUomRuleCondition(condition: UomRuleCondition): string {
  const descriptionPart =
    condition.match_kind === 'token'
      ? `contains "${condition.description_condition}"`
      : `is exactly "${condition.description_condition}"`;
  return `When the printed UOM is ${condition.printed_unit} and the description ${descriptionPart}`;
}

// --- matching a line against a rule ----------------------------------------

/** Just enough of an order line to test a rule against. Deliberately reads
 *  the SOURCE fields (`raw_description`/`unit` as extracted), never a
 *  reviewer's rewrite or an already-applied result — a rule about what the
 *  paper says must be evaluated against what the paper says. */
export interface UomRuleLineLike {
  raw_description?: string | null;
  description?: string | null;
  unit?: string | null;
}

/**
 * Does this rule's condition hold for this line?
 *
 * The printed unit must match exactly (folded). The description condition
 * then either has to CONTAIN the token (word-boundary) or EQUAL the full
 * normalised description, depending on `match_kind`.
 */
export function ruleMatchesLine(rule: UomRuleCondition, line: UomRuleLineLike): boolean {
  const linePrintedUnit = normaliseUnit(line.unit);
  if (!linePrintedUnit || linePrintedUnit !== normaliseUnit(rule.printed_unit)) return false;

  const rawText = normaliseRuleText((line.raw_description ?? '').trim() || (line.description ?? '').trim());
  if (!rawText) return false;

  if (rule.match_kind === 'exact_description') {
    return rawText === normaliseRuleText(rule.description_condition);
  }
  return containsWord(rawText, normaliseRuleText(rule.description_condition));
}

// --- applying the rule set to a line ----------------------------------------

/** Just enough of a `cd_customer_uom_rules` row to apply. */
export interface CustomerUomRuleLite extends UomRuleCondition {
  id: string;
  org_id: string;
  customer_id: string;
  active?: boolean | null;
}

export type UomRuleOutcome =
  | { kind: 'applied'; unit: string; ruleId: string; count: number }
  | { kind: 'conflict'; ruleIds: string[] };

/**
 * What this customer's rules say about one line, if anything.
 *
 * SPECIFICITY: `exact_description` is a claim about one exact line; `token`
 * is a claim about a pattern that could also catch a different line. When
 * both tiers have matches, the narrower tier wins outright and the broader
 * tier's matches are not even consulted for agreement/conflict.
 *
 * WITHIN the winning tier: every matching rule agreeing on `target_unit` is
 * simply the same ruling confirmed more than once (`count` says how many) —
 * applied. Any disagreement is a `conflict`: RIDER 2 — NO TIEBREAK OF ANY
 * KIND. Not `created_at`, not row order, not id, not "keep the first match".
 * A silent pick here is exactly the failure this feature exists to prevent
 * one layer up in the matcher (see order-line-match.ts). The line keeps its
 * printed unit and every conflicting rule id is surfaced so a human resolves
 * it, not the code.
 */
export function applyCustomerUomRules(
  rules: CustomerUomRuleLite[],
  line: UomRuleLineLike,
): UomRuleOutcome | null {
  const matching = rules.filter((r) => ruleMatchesLine(r, line));
  if (matching.length === 0) return null;

  const exact = matching.filter((r) => r.match_kind === 'exact_description');
  const tier = exact.length > 0 ? exact : matching;

  const targets = new Set(tier.map((r) => r.target_unit));
  if (targets.size > 1) {
    return { kind: 'conflict', ruleIds: tier.map((r) => r.id) };
  }
  return { kind: 'applied', unit: tier[0].target_unit, ruleId: tier[0].id, count: tier.length };
}

// --- customer scope ----------------------------------------------------

/**
 * One customer's active rules, belt-and-braces filtered by org + customer.
 *
 * Mirrors `indexAliasesForCustomer`'s defensive pattern and its reason: the
 * caller normally already queried with `.eq('customer_id', …)`, but a filter
 * that only exists in a query string is a filter no test can see, and this is
 * the function a test points at to prove that a rule ruled for one customer
 * is invisible to another. A null org/customer id — nothing resolved yet —
 * yields no rules, because "whose paper is this?" has no answer yet.
 */
export function indexUomRulesForCustomer<T extends CustomerUomRuleLite>(
  rows: T[],
  orgId: string | null,
  customerId: string | null,
): T[] {
  if (!orgId || !customerId) return [];
  return rows.filter((r) => r.org_id === orgId && r.customer_id === customerId && r.active !== false);
}

// --- ADDENDUM 4b (plan_customer_uom_rules.md, 2026-08-28): the review
// screen's dropdown ------------------------------------------------------

/** Just enough of an `OrderLineRecord` to decide what a line's unit dropdown
 *  should open showing. A subset rather than the full type so a caller with
 *  only a partial/fake record (a test, `attachRecords`'s callers) can use it
 *  without constructing one. */
export type UomDisplayRecord = Pick<
  OrderLineRecord,
  'uom_rule_id' | 'uom_target_unit' | 'uom_conflict_rule_ids'
>;

/**
 * Which unit a line's editable dropdown should open showing.
 *
 * A line a customer UOM rule already resolved, with NO conflict, opens on the
 * INTERPRETED unit (`uom_target_unit`) — the dropdown is meant to show what
 * will actually be billed unless the reviewer says otherwise, not force them
 * to notice a rule fired by reading a footnote before they even look at the
 * field. Every other case — no record, no rule, or a conflict — opens on
 * `printedUnit` exactly as before: a conflict is explicitly "no rule
 * applied" (rider 2/ADDENDUM 4b), so the printed value is the only thing on
 * the line anyone has actually confirmed.
 *
 * Pulled out as its own function (rather than inlined where the review rows
 * are built) so "what does this line's dropdown show" is one place, directly
 * `node --test` coverable, and the one thing both `order-review-lines.ts`
 * (initial open) and any future caller read to agree with each other.
 */
export function displayUnitForLine(
  record: UomDisplayRecord | null | undefined,
  printedUnit: string,
): string {
  if (record?.uom_rule_id && !record.uom_conflict_rule_ids?.length && record.uom_target_unit) {
    return record.uom_target_unit;
  }
  return printedUnit;
}

/**
 * The source/audit line rendered under an applied line's dropdown:
 * "Source UOM: KG · Customer rule applied: KG → punnet".
 *
 * Reads `uom_source_unit` (the paper's own printed value, preserved verbatim,
 * never folded/lowercased — see the wiring comment in orderflow-from-doc.ts)
 * and `uom_target_unit` (the rule's result, already normalised) straight off
 * the record — never re-derives either, so this sentence cannot describe a
 * source or a target the audit trail doesn't actually hold.
 */
export function describeUomAppliedLine(sourceUnit: string, targetUnit: string): string {
  return `Source UOM: ${sourceUnit} · Customer rule applied: ${sourceUnit} → ${targetUnit}`;
}

// --- audit carry-forward across the confirm/finalize pass -----------------
//
// Architect decision (plan_customer_uom_rules.md §4b addendum follow-up,
// 2026-08-29): the original spec's Phase 10 auditability requirement is "for
// every applied rule, preserve which rule, original source value, interpreted
// value" on the FINAL line records — the ones written by the pass that
// actually finalises the order, not just the first one. Without this, that
// requirement silently fails on every order a reviewer confirms without
// touching the unit dropdown, which after ADDENDUM 4b is most of them.

/** Just enough of a previous pass's `OrderLineRecord` to decide whether its
 *  UOM-rule provenance survives onto this pass's record for the same line. */
export type UomCarryForwardRecord = Pick<
  OrderLineRecord,
  'raw_description' | 'uom_rule_id' | 'uom_rule_count' | 'uom_source_unit' | 'uom_target_unit' | 'uom_conflict_rule_ids'
>;

/** The four fields carried forward onto the new record, unchanged. */
export type UomAuditCarryForward = Pick<
  OrderLineRecord,
  'uom_rule_id' | 'uom_rule_count' | 'uom_source_unit' | 'uom_target_unit'
>;

/**
 * WHY THIS EXISTS. `confirm()`'s review-save intentionally writes the
 * INTERPRETED unit into the editable `line_items[].unit` (ADDENDUM 4b) — the
 * dropdown showed "punnet" and the reviewer left it there, so "punnet" is
 * what gets saved back onto the document. The NEXT sync pass (the one
 * `/api/orderflow/order-from-document?finalize=true` triggers) then reads
 * "punnet" as the new PRINTED unit; the rule's condition (`printed_unit:
 * "kg"`) no longer matches it, `applyCustomerUomRules` returns nothing for
 * that line, and the audit of WHICH RULE set this unit evaporates at exactly
 * the moment the order is finalised — the one moment it matters most, and
 * the bug class this function exists to close. It carries the PRIOR pass's
 * provenance forward, but only when nothing about the OUTCOME actually
 * changed: the line's resolved unit this pass is still exactly the rule's
 * own target from last time.
 *
 * DELIBERATELY NOT A RE-MATCH. This never calls `ruleMatchesLine` or
 * `applyCustomerUomRules` against the carried-forward source unit — it only
 * copies four fields forward from a record that already exists, gated on the
 * OUTCOME staying the same. Re-matching against a remembered "original"
 * printed unit was considered and rejected: it would let a stale rule
 * silently re-assert itself over a reviewer's DELIBERATE override on some
 * later re-sync (the reviewer picked a THIRD unit, on purpose, and a re-match
 * would have no way to tell that apart from "the rule just needs reapplying")
 * — and reintroducing an invisible override is worse than the audit trail
 * going quiet on a line nobody is disputing. If the resolved unit differs
 * from the prior target, this returns null and the line's audit record
 * simply carries no rule claim, exactly as if no rule had ever touched it —
 * which, as far as the reviewer's override is concerned, is now true.
 *
 * ONE-BY-ONE, POSITIONAL, ON DUPLICATE DESCRIPTIONS. This returns the FIRST
 * record in `previousRecords` whose normalised `raw_description` matches —
 * mirroring `attachRecords`'s own per-key queue in `order-review-lines.ts`
 * (a `Map<string, T[]>`, shifted as rows are paired) without importing it,
 * since that module already imports FROM this one and a reverse import would
 * cycle. A caller pairing several of THIS pass's lines against one
 * previous-records pool (two paper rows printing identical text) MUST remove
 * whichever record it consumes — `removeFirstUomAuditMatch` does exactly that
 * — before the next call, or every line sharing that text would pair against
 * the same first record instead of its own.
 */
export function carryForwardUomAudit(
  previousRecords: readonly UomCarryForwardRecord[],
  rawDescription: string,
  resolvedUnit: string | null | undefined,
): UomAuditCarryForward | null {
  const key = normaliseRuleText(rawDescription);
  if (!key) return null;
  const prior = previousRecords.find((r) => normaliseRuleText(r.raw_description) === key);
  if (!prior) return null;
  // Not a rule the prior pass actually claimed — nothing to carry. (Also
  // catches a conflict line: the wiring never sets `uom_rule_id` on one.)
  if (!prior.uom_rule_id || !prior.uom_source_unit || !prior.uom_target_unit) return null;
  // Defensive belt-and-braces on the same invariant: a hand-edited or
  // otherwise malformed prior record naming BOTH must still be refused.
  if (prior.uom_conflict_rule_ids?.length) return null;
  const resolvedNorm = normaliseUnit(resolvedUnit);
  const priorTargetNorm = normaliseUnit(prior.uom_target_unit);
  // The reviewer overrode it — the rule no longer governs this line, and the
  // audit must not claim otherwise.
  if (!resolvedNorm || resolvedNorm !== priorTargetNorm) return null;
  return {
    uom_rule_id: prior.uom_rule_id,
    uom_rule_count: prior.uom_rule_count ?? 1,
    uom_source_unit: prior.uom_source_unit,
    uom_target_unit: prior.uom_target_unit,
  };
}

/**
 * Remove the FIRST record matching `rawDescription` (normalised) from a
 * previous-records pool, immutably — the consumption half of the "one-by-one,
 * positional" contract `carryForwardUomAudit` documents. Uses the identical
 * matching rule (first hit, normalised key) so a caller alternating
 * `carryForwardUomAudit` / `removeFirstUomAuditMatch` down a line loop always
 * consumes the record it just considered, never a different one.
 *
 * A no-match is a no-op: the pool comes back unchanged, same array reference,
 * so a caller looping over many lines with no duplicates never allocates.
 */
export function removeFirstUomAuditMatch(
  previousRecords: readonly UomCarryForwardRecord[],
  rawDescription: string,
): UomCarryForwardRecord[] {
  const key = normaliseRuleText(rawDescription);
  if (!key) return previousRecords as UomCarryForwardRecord[];
  const index = previousRecords.findIndex((r) => normaliseRuleText(r.raw_description) === key);
  if (index === -1) return previousRecords as UomCarryForwardRecord[];
  return [...previousRecords.slice(0, index), ...previousRecords.slice(index + 1)];
}
