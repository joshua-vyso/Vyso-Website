/**
 * CUSTOMER-SCOPED CONDITIONAL UOM RULES.
 *
 * Ground truth is Capital's real PO POPAR-0017754: their POS prints KG next
 * to lines that are, in fact, punnets — "Grapes Black Punnet" prints KG, not
 * because the produce is weighed, but because that is what their system
 * always prints. A reviewer rules on it once; every later Capital order
 * carrying the same condition should apply it without asking again — and a
 * different customer's identical-looking KG line must never be touched by it.
 *
 * The two riders this file exists to hold down:
 *   RIDER 1 — the object `deriveUomRuleCondition` returns is BOTH what the
 *     inline suggestion is rendered from and what gets saved. There is no
 *     second, independently-worded copy to drift from it.
 *   RIDER 2 — two equal-specificity rules that disagree produce a conflict,
 *     never a silently-picked winner. No tiebreak, of any kind, ever.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKAGING_TOKENS,
  applyCustomerUomRules,
  carryForwardUomAudit,
  deriveUomRuleCondition,
  describeUomAppliedLine,
  describeUomRuleCondition,
  displayUnitForLine,
  indexUomRulesForCustomer,
  normaliseRuleText,
  removeFirstUomAuditMatch,
  ruleMatchesLine,
  sameRuleCondition,
  type CustomerUomRuleLite,
  type UomCarryForwardRecord,
  type UomDisplayRecord,
} from '../lib/platform/docu/customer-uom-rules.ts';

const ORG = 'org-1';
const CAPITAL = 'cust-capital';
const OTHER = 'cust-other';

/** Capital's real ruling: printed KG + description contains "punnet" → punnet. */
const PUNNET_RULE: CustomerUomRuleLite = {
  id: 'rule-punnet',
  org_id: ORG,
  customer_id: CAPITAL,
  match_kind: 'token',
  description_condition: 'punnet',
  printed_unit: 'kg',
  target_unit: 'punnet',
};

// ---------------------------------------------------------------------------
// deriveUomRuleCondition — rider 1: one derivation, display and save both read it
// ---------------------------------------------------------------------------

test('deriveUomRuleCondition prefers the packaging token that matches the chosen unit', () => {
  const cond = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'punnet');
  assert.deepEqual(cond, {
    match_kind: 'token',
    description_condition: 'punnet',
    printed_unit: 'kg',
    target_unit: 'punnet',
  });
});

test('deriveUomRuleCondition folds a plural chosen unit onto the singular token', () => {
  // The dropdown may offer "punnets"; PACKAGING_TOKENS carries the singular.
  const cond = deriveUomRuleCondition('Strawberry 250gr Punnet Packet', 'TRY', 'punnets');
  assert.equal(cond.match_kind, 'token');
  assert.equal(cond.description_condition, 'punnet');
  assert.equal(cond.printed_unit, 'tray'); // TRY folds to tray via normaliseUnit
  assert.equal(cond.target_unit, 'punnet');
});

test('deriveUomRuleCondition falls back to the first known token when none matches the chosen unit', () => {
  // Chosen unit is "each" but nothing in PACKAGING_TOKENS matching "each" is in
  // the text — the description does carry "box", so that becomes the condition
  // even though it disagrees with what was chosen. Still a real, checkable
  // condition; just not provably the reviewer's own reasoning.
  const cond = deriveUomRuleCondition('Mixed Veg Box', 'KG', 'each');
  assert.equal(cond.match_kind, 'token');
  assert.equal(cond.description_condition, 'box');
});

test('deriveUomRuleCondition falls back to exact_description when no token is present', () => {
  const cond = deriveUomRuleCondition('Genuine Loose Produce', 'KG', 'kg');
  assert.deepEqual(cond, {
    match_kind: 'exact_description',
    description_condition: 'genuine loose produce',
    printed_unit: 'kg',
    target_unit: 'kg',
  });
});

test('deriveUomRuleCondition normalises case and whitespace on every field', () => {
  const cond = deriveUomRuleCondition('  Grapes  Black   PUNNET ', '  Kg ', ' Punnet ');
  assert.equal(cond.description_condition, 'punnet');
  assert.equal(cond.printed_unit, 'kg');
  assert.equal(cond.target_unit, 'punnet');
});

test('PACKAGING_TOKENS is the closed list the derivation is confined to', () => {
  assert.ok(PACKAGING_TOKENS.includes('punnet'));
  assert.ok(PACKAGING_TOKENS.includes('tray'));
  // A word that is not on the list can never become a token condition, however
  // pack-like it reads — only exact_description can capture it.
  const cond = deriveUomRuleCondition('Strawberries Clamshell', 'KG', 'clamshell');
  assert.equal(cond.match_kind, 'exact_description');
});

test('the derived condition round-trips: what would render is what gets saved', () => {
  const a = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'punnet');
  const b = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'punnet');
  assert.deepEqual(a, b, 'same inputs must derive the same object — the UI saves exactly what it displayed');
});

// ---------------------------------------------------------------------------
// describeUomRuleCondition — RIDER 1: the exact sentence the suggestion card
// renders, built from the exact object that gets saved. Never "KG → Punnet".
// ---------------------------------------------------------------------------

test('describeUomRuleCondition names every exact condition for a token rule', () => {
  const condition = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'punnet');
  assert.equal(
    describeUomRuleCondition(condition),
    'When the printed UOM is kg and the description contains "punnet"',
  );
});

test('describeUomRuleCondition reads "is exactly" for the exact_description fallback', () => {
  const condition = deriveUomRuleCondition('Genuine Loose Produce', 'KG', 'kg');
  assert.equal(
    describeUomRuleCondition(condition),
    'When the printed UOM is kg and the description is exactly "genuine loose produce"',
  );
});

// ---------------------------------------------------------------------------
// sameRuleCondition — the duplicate-equivalence check the UI uses
// ---------------------------------------------------------------------------

test('sameRuleCondition ignores target_unit — a changed target is "update", not "new"', () => {
  const a = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'punnet');
  const b = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'tray'); // reviewer changed their mind
  assert.ok(sameRuleCondition(a, b));
});

test('sameRuleCondition is false when the condition itself differs', () => {
  const a = deriveUomRuleCondition('Grapes Black Punnet', 'KG', 'punnet');
  const c = deriveUomRuleCondition('Grapes Black Box', 'KG', 'punnet');
  assert.equal(sameRuleCondition(a, c), false);
});

// ---------------------------------------------------------------------------
// ruleMatchesLine
// ---------------------------------------------------------------------------

test('a token rule matches a line whose printed unit and description both agree', () => {
  assert.equal(
    ruleMatchesLine(PUNNET_RULE, { raw_description: 'Grapes Black Punnet', unit: 'KG' }),
    true,
  );
});

test('"Cucumber English kg" printed BOX does not match the punnet rule — wrong printed unit', () => {
  assert.equal(
    ruleMatchesLine(PUNNET_RULE, { raw_description: 'Cucumber English kg', unit: 'BOX' }),
    false,
  );
});

test('a genuine KG line with no packaging token in the description does not match', () => {
  assert.equal(
    ruleMatchesLine(PUNNET_RULE, { raw_description: 'Loose Tomatoes', unit: 'KG' }),
    false,
  );
});

test('a token condition is word-boundary matched, not a bare substring', () => {
  const rule: CustomerUomRuleLite = { ...PUNNET_RULE, description_condition: 'try' };
  assert.equal(ruleMatchesLine(rule, { raw_description: 'Industry Grapes', unit: 'kg' }), false);
  assert.equal(ruleMatchesLine(rule, { raw_description: 'Grapes TRY', unit: 'kg' }), true);
});

test('an exact_description rule requires the FULL normalised description to match', () => {
  const rule: CustomerUomRuleLite = {
    ...PUNNET_RULE,
    match_kind: 'exact_description',
    description_condition: 'genuine loose produce',
  };
  assert.equal(ruleMatchesLine(rule, { raw_description: 'Genuine Loose Produce', unit: 'kg' }), true);
  assert.equal(ruleMatchesLine(rule, { raw_description: 'Genuine Loose Produce Extra', unit: 'kg' }), false);
});

test('ruleMatchesLine reads the SOURCE description, never a reviewer rewrite', () => {
  assert.equal(
    ruleMatchesLine(PUNNET_RULE, {
      raw_description: 'Grapes Black Punnet',
      description: 'Grapes Black (rewritten to something with no punnet in it)',
      unit: 'KG',
    }),
    true,
  );
});

// ---------------------------------------------------------------------------
// applyCustomerUomRules — specificity, agreement, and rider 2's conflict
// ---------------------------------------------------------------------------

const LINE = { raw_description: 'Grapes Black Punnet', unit: 'KG' };

test('one matching rule applies, carrying its id and a count of 1', () => {
  const out = applyCustomerUomRules([PUNNET_RULE], LINE);
  assert.deepEqual(out, { kind: 'applied', unit: 'punnet', ruleId: 'rule-punnet', count: 1 });
});

test('two matching rules agreeing on the target apply, with count 2', () => {
  const dup: CustomerUomRuleLite = { ...PUNNET_RULE, id: 'rule-punnet-2' };
  const out = applyCustomerUomRules([PUNNET_RULE, dup], LINE);
  assert.equal(out?.kind, 'applied');
  if (out?.kind === 'applied') {
    assert.equal(out.unit, 'punnet');
    assert.equal(out.count, 2);
  }
});

test('exact_description beats token on the same line', () => {
  const tokenRule: CustomerUomRuleLite = { ...PUNNET_RULE, target_unit: 'punnet' };
  const exactRule: CustomerUomRuleLite = {
    id: 'rule-exact',
    org_id: ORG,
    customer_id: CAPITAL,
    match_kind: 'exact_description',
    description_condition: 'grapes black punnet',
    printed_unit: 'kg',
    target_unit: 'tray', // disagrees with the token rule — exact still wins outright
  };
  const out = applyCustomerUomRules([tokenRule, exactRule], LINE);
  assert.deepEqual(out, { kind: 'applied', unit: 'tray', ruleId: 'rule-exact', count: 1 });
});

test('RIDER 2 — two token rules at the same tier disagreeing about the target is a conflict, never a tiebreak', () => {
  const toPunnet: CustomerUomRuleLite = { ...PUNNET_RULE, id: 'rule-a', target_unit: 'punnet' };
  const toTray: CustomerUomRuleLite = { ...PUNNET_RULE, id: 'rule-b', target_unit: 'tray' };
  const out = applyCustomerUomRules([toPunnet, toTray], LINE);
  assert.equal(out?.kind, 'conflict');
  if (out?.kind === 'conflict') {
    assert.deepEqual(new Set(out.ruleIds), new Set(['rule-a', 'rule-b']));
  }
});

test('a conflict is order-independent — swapping the input order changes nothing about the verdict', () => {
  const toPunnet: CustomerUomRuleLite = { ...PUNNET_RULE, id: 'rule-a', target_unit: 'punnet' };
  const toTray: CustomerUomRuleLite = { ...PUNNET_RULE, id: 'rule-b', target_unit: 'tray' };
  const forward = applyCustomerUomRules([toPunnet, toTray], LINE);
  const backward = applyCustomerUomRules([toTray, toPunnet], LINE);
  assert.equal(forward?.kind, 'conflict');
  assert.equal(backward?.kind, 'conflict');
});

test('no matching rule is null, not a conflict and not a no-op applied', () => {
  assert.equal(applyCustomerUomRules([PUNNET_RULE], { raw_description: 'Loose Tomatoes', unit: 'KG' }), null);
});

// ---------------------------------------------------------------------------
// indexUomRulesForCustomer — the scope, the whole point (mirrors
// indexAliasesForCustomer's own no-leak test)
// ---------------------------------------------------------------------------

test('a rule set for one customer is invisible to another', () => {
  const forCapital = indexUomRulesForCustomer([PUNNET_RULE], ORG, CAPITAL);
  const forOther = indexUomRulesForCustomer([PUNNET_RULE], ORG, OTHER);
  assert.equal(forCapital.length, 1);
  assert.equal(forOther.length, 0);

  assert.equal(applyCustomerUomRules(forOther, LINE), null);
  assert.deepEqual(applyCustomerUomRules(forCapital, LINE), {
    kind: 'applied', unit: 'punnet', ruleId: 'rule-punnet', count: 1,
  });
});

test('no org/customer resolved yet → no rules at all', () => {
  assert.equal(indexUomRulesForCustomer([PUNNET_RULE], null, CAPITAL).length, 0);
  assert.equal(indexUomRulesForCustomer([PUNNET_RULE], ORG, null).length, 0);
});

test('an inactive rule is dropped', () => {
  const inactive: CustomerUomRuleLite = { ...PUNNET_RULE, id: 'rule-inactive', active: false };
  const out = indexUomRulesForCustomer([inactive], ORG, CAPITAL);
  assert.equal(out.length, 0);
});

test('a row belonging to a different org is dropped even if the customer id matches', () => {
  const wrongOrg: CustomerUomRuleLite = { ...PUNNET_RULE, org_id: 'org-2' };
  assert.equal(indexUomRulesForCustomer([wrongOrg], ORG, CAPITAL).length, 0);
});

// ---------------------------------------------------------------------------
// normaliseRuleText
// ---------------------------------------------------------------------------

test('normaliseRuleText folds the same printer noise aliasKey folds', () => {
  assert.equal(normaliseRuleText('  Grapes   Black  Punnet '), 'grapes black punnet');
  assert.equal(normaliseRuleText(null), '');
});

// ---------------------------------------------------------------------------
// ADDENDUM 4b (plan_customer_uom_rules.md, 2026-08-28) —
// displayUnitForLine: what the review screen's dropdown opens showing.
// ---------------------------------------------------------------------------

const APPLIED_RECORD: UomDisplayRecord = {
  uom_rule_id: 'rule-punnet',
  uom_target_unit: 'punnet',
  uom_conflict_rule_ids: undefined,
};

test('displayUnitForLine shows the INTERPRETED unit when a rule applied with no conflict', () => {
  assert.equal(displayUnitForLine(APPLIED_RECORD, 'KG'), 'punnet');
});

test('displayUnitForLine falls back to the printed unit on a conflict, even with a stray rule id', () => {
  // Defensive case: the wiring never actually sets both uom_rule_id AND
  // uom_conflict_rule_ids together, but the helper must not trust that and
  // apply the rule's result anyway — a conflict is explicitly "no rule
  // applied" (rider 2), so this must fail toward the printed unit.
  const conflicted: UomDisplayRecord = { ...APPLIED_RECORD, uom_conflict_rule_ids: ['rule-a', 'rule-b'] };
  assert.equal(displayUnitForLine(conflicted, 'KG'), 'KG');
});

test('displayUnitForLine falls back to the printed unit when no rule applied at all', () => {
  assert.equal(displayUnitForLine(null, 'KG'), 'KG');
  assert.equal(displayUnitForLine(undefined, 'KG'), 'KG');
  assert.equal(displayUnitForLine({ uom_rule_id: undefined, uom_target_unit: undefined, uom_conflict_rule_ids: undefined }, 'KG'), 'KG');
});

test('displayUnitForLine falls back to the printed unit when uom_rule_id is set but no target is on record', () => {
  // Should never happen given how orderflow-from-doc.ts writes the four
  // fields together, but a partial/malformed record must not crash or invent
  // a unit — it must fail toward the one fact that is definitely true.
  assert.equal(displayUnitForLine({ uom_rule_id: 'rule-punnet', uom_target_unit: undefined }, 'KG'), 'KG');
});

// ---------------------------------------------------------------------------
// ADDENDUM 4b — describeUomAppliedLine: the source/audit sentence
// ---------------------------------------------------------------------------

test('describeUomAppliedLine names the exact source and target the record holds', () => {
  assert.equal(
    describeUomAppliedLine('KG', 'punnet'),
    'Source UOM: KG · Customer rule applied: KG → punnet',
  );
});

test('describeUomAppliedLine preserves the source unit\'s own casing — it is the paper\'s verbatim printed value', () => {
  // uom_source_unit is written from the RAW extracted unit, never normalised
  // (see orderflow-from-doc.ts) — "TRY", not "try". The sentence must not
  // silently relabel what the paper actually printed.
  assert.equal(
    describeUomAppliedLine('TRY', 'tray'),
    'Source UOM: TRY · Customer rule applied: TRY → tray',
  );
});

// ---------------------------------------------------------------------------
// AUDIT CARRY-FORWARD — architect follow-up to ADDENDUM 4b (2026-08-29).
//
// The bug this closes: `confirm()`'s review-save writes the INTERPRETED unit
// ("punnet") back into `line_items[].unit`. The next sync then reads
// "punnet" as the new PRINTED unit, the rule's condition ("kg") no longer
// matches, and the audit record for that line loses `uom_rule_id` at exactly
// the moment the order is finalised. `carryForwardUomAudit` closes it by
// reading the PRIOR pass's own record for the same line.
// ---------------------------------------------------------------------------

const PRIOR_APPLIED: UomCarryForwardRecord = {
  raw_description: 'Grapes Black Punnet',
  uom_rule_id: 'rule-punnet',
  uom_rule_count: 1,
  uom_source_unit: 'KG',
  uom_target_unit: 'punnet',
};

test('carryForwardUomAudit carries the prior rule forward when the resolved unit equals the prior target', () => {
  const carried = carryForwardUomAudit([PRIOR_APPLIED], 'Grapes Black Punnet', 'punnet');
  assert.deepEqual(carried, {
    uom_rule_id: 'rule-punnet',
    uom_rule_count: 1,
    uom_source_unit: 'KG',
    uom_target_unit: 'punnet',
  });
});

test('carryForwardUomAudit folds the resolved unit through the same normalisation as everything else', () => {
  // "Punnets" (plural, mixed case) still counts as the same target.
  const carried = carryForwardUomAudit([PRIOR_APPLIED], 'Grapes Black Punnet', 'Punnets');
  assert.equal(carried?.uom_rule_id, 'rule-punnet');
});

test('carryForwardUomAudit returns null when the reviewer overrode the rule to a THIRD unit', () => {
  // The reviewer opened on "punnet" (the rule's own target) and changed it to
  // "tray" — a deliberate override. The rule no longer governs this line and
  // the audit must not claim otherwise.
  assert.equal(carryForwardUomAudit([PRIOR_APPLIED], 'Grapes Black Punnet', 'tray'), null);
});

test('carryForwardUomAudit returns null when the resolved unit reverted to the ORIGINAL printed value', () => {
  // Also an override, just one that happens to land back on the source unit
  // — still not the rule's target, so still not a carry.
  assert.equal(carryForwardUomAudit([PRIOR_APPLIED], 'Grapes Black Punnet', 'KG'), null);
});

test('carryForwardUomAudit returns null when no prior record exists for this line at all', () => {
  assert.equal(carryForwardUomAudit([], 'Grapes Black Punnet', 'punnet'), null);
  assert.equal(carryForwardUomAudit([PRIOR_APPLIED], 'Loose Tomatoes', 'kg'), null);
});

test('carryForwardUomAudit returns null when the prior record never had a rule applied', () => {
  const untouched: UomCarryForwardRecord = { raw_description: 'Loose Tomatoes' };
  assert.equal(carryForwardUomAudit([untouched], 'Loose Tomatoes', 'kg'), null);
});

test('carryForwardUomAudit returns null on a prior CONFLICT record — a conflict is "no rule applied"', () => {
  const conflicted: UomCarryForwardRecord = {
    raw_description: 'Grapes Black Punnet',
    uom_conflict_rule_ids: ['rule-a', 'rule-b'],
  };
  assert.equal(carryForwardUomAudit([conflicted], 'Grapes Black Punnet', 'punnet'), null);
});

test('carryForwardUomAudit is not confused by an unrelated raw_description in the pool', () => {
  const other: UomCarryForwardRecord = {
    raw_description: 'Cucumber English kg',
    uom_rule_id: 'rule-other',
    uom_rule_count: 1,
    uom_source_unit: 'BOX',
    uom_target_unit: 'each',
  };
  const carried = carryForwardUomAudit([other, PRIOR_APPLIED], 'Grapes Black Punnet', 'punnet');
  assert.equal(carried?.uom_rule_id, 'rule-punnet');
});

// --- duplicate raw_description pairing --------------------------------------

test('duplicate raw_description: the pool is consumed one-by-one, positionally', () => {
  const first: UomCarryForwardRecord = { ...PRIOR_APPLIED, uom_rule_id: 'rule-first' };
  const second: UomCarryForwardRecord = { ...PRIOR_APPLIED, uom_rule_id: 'rule-second', uom_target_unit: 'tray' };
  let pool: UomCarryForwardRecord[] = [first, second];

  // Line 1: pairs against the FIRST record in the pool.
  const carriedLine1 = carryForwardUomAudit(pool, 'Grapes Black Punnet', 'punnet');
  assert.equal(carriedLine1?.uom_rule_id, 'rule-first');
  pool = removeFirstUomAuditMatch(pool, 'Grapes Black Punnet');

  // Line 2, same paper text: pairs against the SECOND record now that the
  // first has been consumed — not the first one again.
  const carriedLine2 = carryForwardUomAudit(pool, 'Grapes Black Punnet', 'tray');
  assert.equal(carriedLine2?.uom_rule_id, 'rule-second');
  pool = removeFirstUomAuditMatch(pool, 'Grapes Black Punnet');

  // Pool exhausted — a third identical line has nothing left to pair with.
  assert.equal(carryForwardUomAudit(pool, 'Grapes Black Punnet', 'punnet'), null);
  assert.equal(pool.length, 0);
});

test('removeFirstUomAuditMatch is a no-op (same array) when nothing matches', () => {
  const pool: UomCarryForwardRecord[] = [PRIOR_APPLIED];
  assert.equal(removeFirstUomAuditMatch(pool, 'Nothing Like This'), pool);
});

test('removeFirstUomAuditMatch never mutates its input', () => {
  const pool: UomCarryForwardRecord[] = [PRIOR_APPLIED];
  const next = removeFirstUomAuditMatch(pool, 'Grapes Black Punnet');
  assert.equal(pool.length, 1, 'the original pool is untouched');
  assert.equal(next.length, 0);
});
