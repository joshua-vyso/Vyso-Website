# Plan: Customer-scoped conditional UOM rules (lean build)

Author: Fable (architect). Implementer: subagent. Date: 2026-08-28. USER-APPROVED with three riders (see NON-NEGOTIABLES). Audit basis: the Phase-1 architecture audit (reported in-session; key citations repeated below).

## Scope decision (approved)

- REUSE `cd_customer_item_aliases` UNCHANGED for product learning. Do NOT create a second product-rule system, do NOT alter its schema, key semantics, or `saveLink`/pins behavior.
- BUILD only the missing layer: customer-scoped conditional UOM rules ("printed UOM = KG AND description contains 'punnet' → operational UOM punnet"), applied deterministically before matching, never silently created, never mutating source values.
- Plus one global spelling fix: `TRY → tray` in `UNIT_ALIASES` — test-first (see NON-NEGOTIABLE 3).

## NON-NEGOTIABLES (user riders)

1. The inline rule suggestion MUST display, before saving: the exact customer name, every condition (normalized printed UOM AND the description condition — token or exact text), and the resulting UOM. Never a vague "KG → Punnet". The saved row must equal what was displayed.
2. Equal-specificity conflicting rules (same specificity tier, different targets, both matching a line) MUST fail to human review: the line keeps its printed UOM and carries a visible conflict note. NEVER resolve by created_at, DB row order, or any arbitrary tiebreak.
3. Write the `TRY → tray` regression test FIRST using the Capital ground-truth values (printed UOM "TRY" on tray/punnet-packet lines), confirm it fails against current `normaliseUnit`, THEN add the mapping and confirm it passes.

## Established architecture facts (do not re-derive; verify line numbers before editing)

- `syncOrderFromDocument` (`lib/platform/orderflow-from-doc.ts`) is the single matching function for all three lanes; customer_id is already resolved on the document before it runs; `cd_customer_item_aliases` rows are loaded (~:341-354) and pin lines BEFORE `resolveOrderLines` and the AI agent; `alias.unit` already overrides the printed unit for exact-alias lines (~:486-493); per-line provenance is written to `documents.extracted_data.order_lines` (`OrderLineRecord`, `lib/platform/docu/order-line-match.ts:638-671`).
- `OrderReviewEditor.tsx`: per-line annotation area (~:968-1035) renders alias badges/pack notes; `saveLink` (~:342-387) is the precedent for direct client-side Supabase upsert + `of_activity` logging; `isMissingTable/isMissingColumn` guards (~:84-94) are the migration-tolerance pattern.
- `normaliseUnit`/`UNIT_ALIASES` (`order-line-match.ts:197-215`) folds unit spellings; "try" is currently unmapped.
- Source values (`raw_description`, `raw_amount`, `raw_unit_price`) are already preserved and never reviewer-overwritten; extraction line model needs no change.
- The matcher's pack-compatibility guard on unpinned lines is DELIBERATELY dormant (`orderflow-from-doc.ts` ~:429-434) — do not arm it.
- Migrations are loose hand-pasted `.sql` files; RLS idiom to copy is in `supabase/customer-ai-invoicing.sql:70-74`.

## 1. Migration file (created in repo; Josh pastes it by hand — do NOT run it)

`supabase/customer-uom-rules.sql`, idempotent, with the standard org RLS idiom:

```sql
create table if not exists cd_customer_uom_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  customer_id uuid not null,
  -- Condition (all values stored NORMALIZED: lowercase, collapsed whitespace;
  -- printed_unit normalized via the same folding the matcher uses).
  match_kind text not null check (match_kind in ('token','exact_description')),
  description_condition text not null,
  printed_unit text not null,
  -- Result
  target_unit text not null,
  active boolean not null default true,
  -- Provenance (mirrors cd_customer_item_aliases)
  source text not null default 'review_confirm',
  document_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, customer_id, match_kind, description_condition, printed_unit)
);
-- + enable RLS + the exact using/with-check org-scope policy idiom.
```

Notes: `printed_unit` is NOT NULL by design — v1 rules always condition on the printed UOM (narrowest deterministic condition; blanket "any printed unit" rules are explicitly out). The unique key makes "duplicate equivalent rule" a DB-level impossibility; upsert on it means update-target = same row (newer ruling wins, like aliases).

## 2. Pure module `lib/platform/docu/customer-uom-rules.ts`

House convention: pure, no React/Supabase imports, testable with node --test. Export:

- `normaliseRuleText(s)`: lowercase + collapse whitespace (same convention as `aliasKey` — cite it in a comment, do not import client code; if `aliasKey` lives in a pure module, import it instead of copying).
- `PACKAGING_TOKENS`: `['punnet','packet','tray','box','bag','bunch','crate','tub','carton','pack','each','dozen','doz','sachet','bottle','jar','tin','can']` (reviewable constant, one comment on why closed-list beats free regex: deterministic, no surprise matches).
- `deriveUomRuleCondition(description, printedUnit, chosenUnit)`: prefer the packaging token in the description whose normalized form equals/starts the chosen unit (e.g. chose "punnet", description contains "punnet"); else the first known packaging token present (word-boundary match on the normalized description); else fall back to `{match_kind:'exact_description', description_condition: normalized full description}`. Returns the condition object used BOTH for display and for the saved row — one source of truth (rider 1).
- `ruleMatchesLine(rule, line)`: normalized printed unit of the line equals `rule.printed_unit` AND (token: word-boundary containment of the token in normalized description; exact: equality with normalized description). Use the line's SOURCE description (`raw_description` falling back to `description`) and the line's printed/extracted unit — never interpreted values.
- `applyCustomerUomRules(rules, line)`: returns `{ kind:'applied', unit, ruleId }` | `{ kind:'conflict', ruleIds }` | `null`. Specificity: `exact_description` beats `token`. Within the winning tier, if all matching rules agree on `target_unit`, apply (record the first id + count); if any disagree → `conflict` (rider 2 — no tiebreak of any kind; add a comment naming the forbidden tiebreaks).
- `indexUomRulesForCustomer(rows, orgId, customerId)`: belt-and-braces filter dropping rows whose org_id/customer_id don't match, mirroring `indexAliasesForCustomer`'s defensive pattern and its why-comment.

## 3. Wiring in `syncOrderFromDocument` (`orderflow-from-doc.ts`)

- Load active rules for the resolved customer right beside the alias load, tolerating a missing table via the existing `isMissingTable` guard pattern (pre-migration deploys must not error — comment it).
- Per line, operational-unit precedence (comment this explicitly at the site):
  1. exact-alias `alias.unit` (existing behavior, unchanged, stays supreme — an exact ruling on this precise line text outranks a pattern),
  2. applied UOM rule,
  3. printed/extracted unit.
- Record on the line's `OrderLineRecord` (additive optional jsonb fields; extend the type in `order-line-match.ts`): `uom_rule_id?: string`, `uom_rule_count?: number`, `uom_source_unit?: string` (the printed unit it replaced), `uom_conflict_rule_ids?: string[]`. On conflict: unit stays printed, `uom_conflict_rule_ids` set.
- Do NOT touch stock-movement/pricing logic, the dormant pack guard, deferCommit, or re-sync idempotency (rules are read-only inputs; re-applying on re-sync is naturally idempotent — same rules, same result).

## 4. Review UI (`OrderReviewEditor.tsx` + `DocumentDetailPanel.tsx` wiring as needed)

a. Load the customer's UOM rules client-side (same place aliases load; tolerate missing table).
b. Capture each line's ORIGINAL extracted unit at mount (before edits).
c. On unit-select change where new ≠ original AND a customer is resolved: derive the condition via `deriveUomRuleCondition`; if an equivalent active rule already exists (same unique key), show nothing (or the applied indicator). Else render an inline suggestion in the annotation area under that row (match existing visual language, no modal):

   "Customer rule — The Capital
    When the printed UOM is KG and the description contains "punnet"
    → use punnet
    Applies to future orders from The Capital. [Create rule] [Not now]"

   For an exact-description fallback the middle line reads: `When the printed UOM is KG and the description is exactly "…"`. The rendered text MUST be produced from the same condition object that will be saved (rider 1).
d. [Create rule]: direct Supabase upsert on the unique key + `of_activity` log entry (mirror `saveLink`'s shape and its why-comment about auditability). [Not now]: dismiss for this line for this session; persist nothing.
e. No resolved customer → no suggestion (do not queue pending rules in v1; note limitation in the implementation doc).
f. Applied-rule indicator: when a line's record carries `uom_rule_id`, render a subtle note: "Customer rule applied · KG → punnet". If the reviewer then changes the unit on such a line, do NOT silently mutate the rule; render: "[Update rule → X] [Ignore for this order]" — update = upsert the same condition with the new target + activity log.
g. Conflict indicator: when `uom_conflict_rule_ids` present: "Conflicting customer rules — kept the printed UOM. Review the rules." (no action buttons in v1).
h. Product side: NO changes to the alias flow beyond, if trivial, aligning button copy with "[Create rule] [Not now]" — otherwise leave untouched.

## 4b. ADDENDUM (user-requested UX adjustment, 2026-08-28, pre-deploy)

For a line whose `OrderLineRecord` carries `uom_rule_id` (rule applied, no conflict):
- The editable unit dropdown INITIALIZES to the INTERPRETED unit (`uom_target_unit`), not the printed one.
- Directly beneath, render source/audit context: `Source UOM: KG · Customer rule applied: KG → Punnet` (from `uom_source_unit`/`uom_target_unit`).
- Override detection now compares against the interpreted value: reviewer changing the dropdown away from it keeps the existing [Update rule → X] [Ignore for this order] behavior unchanged.
- Conflict lines are NOT affected: dropdown keeps the printed unit and the conflict note must make clear no rule was applied.
- Source preservation: `uom_source_unit` in the jsonb audit trail is the immutable record of the printed unit (written at sync time, never by the UI); the review-save path writing the interpreted unit into the editable `line_items[].unit` is acceptable and intended — raw/audit fields are the source truth, per the existing model. Do NOT mutate `uom_source_unit`, `raw_*` fields, or the printed value inside `order_lines`.
- No DB/schema changes (all data already persisted). Add/update focused tests for: dropdown-initialization value for applied vs conflict vs untouched lines (pure helper preferred — extract the "display unit for a line record" decision into a testable pure function), override-vs-applied comparison basis, and source-unit preservation. Full verification suite re-run.

## 5. TRY → tray (test-first, rider 3)

1. New test in `tests/docu-order-line-match.test.ts` (or a focused new file) using Capital ground-truth values: `normaliseUnit('TRY') === 'tray'`, plus a pack-compat/`unitsCompatible` case pairing printed `TRY` with a catalogue `tray` product (e.g. "Strawberry 250gr Punnet Packet", printed UOM TRY). Run it, CONFIRM IT FAILS, record the failing output in the implementation doc.
2. Add `try: 'tray'` (and `trys`/`trays` if absent) to `UNIT_ALIASES` with a comment citing the Capital PO. Confirm the test passes. This mapping must not arm the dormant pack guard — it only folds spelling for the paths that already consult `normaliseUnit`.

## 6. Tests (node --test, pure modules; no network, no Supabase)

UOM rules — Capital cases from the real PO (`POPAR-0017754`):
- "Grapes Black Punnet" printed KG + token rule (punnet, KG→punnet) → applied punnet, rule id recorded, source unit KG preserved in `uom_source_unit`.
- "Cucumber English kg" printed BOX (no punnet token) → no rule applied, unit stays.
- Genuine KG line, description without any packaging token → stays kg.
- Same rule set, different customer_id → `indexUomRulesForCustomer` drops the rows; nothing applies.
- exact_description rule beats token rule on the same line.
- Two token rules, same condition tier, different targets, both matching → `conflict`, unit stays printed, ids surfaced (rider 2).
- Two matching rules agreeing on target → applied, count 2.
- `deriveUomRuleCondition`: punnet chosen + "Grapes Black Punnet"/KG → token punnet; no known token → exact_description; the derived object round-trips display ↔ save.
- Duplicate-equivalence: unique-key equality check used by the UI (same normalized condition → treated as existing).
Source preservation: applying a rule leaves `raw_description` and the extracted printed unit untouched (assert on the line object).
Product-rule gaps (only if not already covered — check first): alias for customer A not consulted for customer B; alias pin bypasses fuzzy matcher; no code path creates a product.
Regression: full suite green — Doc-U, locale-number, Microsoft ingestion tests all pass.

## 7. Out of scope / untouched

`cd_customer_item_aliases` schema+semantics; `pp_name_aliases`; the dormant pack guard; deferCommit; Microsoft ingestion; locale-number; order-prompt; stock/pricing logic; any admin management UI (data model supports it later via the table + activity log).

## 8. Verification (implementer runs; architect re-runs before sign-off)

```
npx tsc --noEmit   # zero errors
npm run lint       # zero new
npm test           # green, including the new suites and the pre-fix TRY failure→pass sequence documented
npm run build      # succeeds
```

NO deploy. NO DB writes (the migration file is committed text only — Josh applies it by hand; the code must behave gracefully until he does, via the missing-table guards). Write `.ai/implementation_customer_uom_rules.md` covering the user's 9-point completion report: architecture reused, DB changes, precedence, files changed, exact UX behavior, tests/results, migration/env steps, limitations, deploy-safety assessment.
