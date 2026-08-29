# Implementation: Customer-scoped conditional UOM rules

Implementer: subagent. Date: 2026-08-29. Plan: `.ai/plan_customer_uom_rules.md` (USER-APPROVED, three riders). This
report is the 9-point completion report the plan asks for.

## 1. Architecture reused

`cd_customer_item_aliases` is untouched — schema, unique key, `saveLink`, pins, CREATE-ON-UPLOAD guards, all identical
to before this change. This feature is a second, independent table answering a narrower question: given a line whose
PRODUCT is already settled (by an alias or the fuzzy matcher), which operational unit does this customer's printed
unit actually mean. The precedent copied deliberately:

- `indexAliasesForCustomer`'s belt-and-braces org/customer filter → `indexUomRulesForCustomer` (same defensive
  double-check even though the caller already scoped the query).
- `saveLink`'s upsert-on-unique-key + `logActivity` call → `saveUomRule`, same shape, same reasoning (a silent
  re-pricing/re-unit-ing fact needs a traceable "who and when").
- `isMissingTable`'s tolerance idiom (already private to `OrderReviewEditor.tsx`) → reused as-is client-side; mirrored
  server-side in `orderflow-from-doc.ts` by simply not throwing on the query and defaulting to `[]`, exactly like the
  existing `cd_customer_item_aliases` load does.
- `aliasKey`'s lowercase+collapse-whitespace fold → imported directly as `normaliseRuleText` (not reimplemented) so
  the two normalisers can't drift.

## 2. DB changes

One new migration file, **committed as text only, never executed**: `supabase/customer-uom-rules.sql`. Creates
`cd_customer_uom_rules` (id, org_id, customer_id, match_kind, description_condition, printed_unit, target_unit,
active, source, document_id, created_by, created_at, updated_at), RLS enabled with the exact
`customer-ai-invoicing.sql` org-scope policy idiom, and a unique index on
`(org_id, customer_id, match_kind, description_condition, printed_unit)` — deliberately **excluding** `target_unit`,
so upserting a changed result overwrites the same row (the "reviewer changed their mind" case) rather than creating a
second row that could conflict with the first. No existing table's schema or semantics changed.

Josh needs to paste this file into the Supabase SQL editor by hand before the feature does anything. Until then every
code path that touches it degrades to "no rules" — see §7.

## 3. Precedence

Per line, three sources can name the operational unit, in this order (implemented in
`lib/platform/orderflow-from-doc.ts`'s per-line loop, ~510–568):

1. **Exact-alias `alias.unit`** — unchanged, still supreme. A human's ruling on THIS PRECISE line text outranks a
   pattern.
2. **An applied customer UOM rule** — evaluated via `applyCustomerUomRules` against the line's SOURCE printed unit
   (`docUnit`), never against a value some earlier step already rewrote.
3. **The printed/extracted unit** — unchanged behaviour, the fallback to the catalogue's own unit only when the paper
   named none at all.

The rule check itself always runs (even when alias.unit will win) so a genuine **conflict** between two of the
customer's own rules is still surfaced on the record (`uom_conflict_rule_ids`) even on a line an alias also happens to
pin — a reviewer should learn about a live disagreement in their rule set regardless of which line exposed it.

## 4. Files changed

| File | Change |
|---|---|
| `supabase/customer-uom-rules.sql` | **New.** The migration, text-only, not run. |
| `lib/platform/docu/customer-uom-rules.ts` | **New.** Pure module: `normaliseRuleText`, `PACKAGING_TOKENS`, `deriveUomRuleCondition`, `describeUomRuleCondition`, `sameRuleCondition`, `ruleMatchesLine`, `applyCustomerUomRules`, `indexUomRulesForCustomer`. No React/Supabase imports. |
| `lib/platform/docu/order-line-match.ts` | Added `try`/`trys` → `tray` to `UNIT_ALIASES` (rider 3). Extended `OrderLineRecord` with `uom_rule_id`, `uom_rule_count`, `uom_source_unit`, `uom_target_unit`, `uom_conflict_rule_ids` (all optional). |
| `lib/platform/orderflow-from-doc.ts` | Loads active `cd_customer_uom_rules` for the resolved customer beside the alias load; wires the 3-tier precedence into the per-line loop; writes the five new fields onto each `OrderLineRecord`. |
| `components/platform/docu/OrderReviewEditor.tsx` | Client-side rule load (`useEffect`, keyed on the live-picked customer); `originalUnits` captured at mount; `saveUomRule` (upsert + activity log); `uomSuggestionForLine`; inline suggestion / applied / conflict rendering in the per-row annotation area. |
| `tests/docu-order-line-match.test.ts` | Rider-3 TRY→tray regression test, written and run FIRST (see §5/§9). |
| `tests/docu-customer-uom-rules.test.ts` | **New.** 28 tests of the pure module in isolation. |
| `tests/docu-order-annotations.test.ts` | 15 new tests (9 UOM-rule wiring cases through the real `syncOrderFromDocument` + fake Postgres harness, plus 1 product-rule gap check from plan §6). |
| `.ai/implementation_customer_uom_rules.md` | **New.** This file. |

Nothing else touched. `cd_customer_item_aliases`, `pp_name_aliases`, the dormant pack guard, `deferCommit`, Microsoft
ingestion, locale-number, order-prompt, stock/pricing logic and any admin UI are all untouched, per plan §7.

## 5. Exact UX behaviour

On the order review screen, once a customer is resolved (picked, or a typed name matching an existing one — the same
`knownCustomerId` the alias-learning flow already uses):

- **Original unit** is captured once at mount per row (`originalUnits`). A hand-added row (`addLine`) never gets an
  entry, so it is never eligible for a suggestion — there is no printed-paper fact to rule on.
- **When the reviewer changes a row's unit dropdown** away from that original value, a condition is derived via
  `deriveUomRuleCondition(paperText, originalUnit, newUnit)` and checked against the customer's currently-loaded
  rules (`sameRuleCondition`):
  - **No equivalent rule exists** → an inline card renders under the row:
    ```
    Customer rule — {customer name}
    When the printed UOM is {kg} and the description contains "{punnet}"
    → use {punnet}
    Applies to future orders from {customer name}.  [Create rule]  [Not now]
    ```
    (or "…is exactly "…"" for the `exact_description` fallback). **The card is rendered from the exact
    `UomRuleCondition` object `[Create rule]` will save** — `describeUomRuleCondition` reads only that object, so
    there is no second hand-written copy of the sentence that could say one thing while the row means another
    (rider 1).
  - **An equivalent rule exists but names a different result** → the same card, with `[Update rule → {new unit}]` /
    `[Ignore for this order]` instead.
  - **An equivalent rule already produces this exact result** → nothing renders (already true).
- **`[Create rule]` / `[Update rule → X]`** → upserts `cd_customer_uom_rules` on its unique key + logs
  `customer_uom_rule_learned` to the customer's activity feed (mirrors `saveLink`). The local `uomRules` state is
  updated immediately so the card disappears without waiting for a page reload or a re-sync.
- **`[Not now]` / `[Ignore for this order]`** → dismissed for that row for this browser session only (`Set` in
  component state). Persists nothing. Reopening the document offers it again.
- **A line whose last-sync record carries `uom_rule_id`** (and the reviewer hasn't since changed the unit) shows a
  quiet one-line note: `Customer rule applied · KG → punnet`. Purely informational — **the unit dropdown itself
  always keeps showing the paper's printed value**, exactly like `raw_description`/`raw_amount` are never
  overwritten by anything derived from them; only `of_order_items.unit` (what actually gets billed) carries the
  rule's result.
- **A line whose record carries `uom_conflict_rule_ids`** shows: `Conflicting customer rules — kept the printed
  UOM. Review the rules.` No action buttons in v1, per plan.
- **No customer resolved** → no suggestion card, no applied note is possible (there is no `uom_rule_id` to have been
  written), and no conflict note either — nothing about UOM rules renders at all.

Render priority on one row when more than one of the above could apply: **conflict beats a live suggestion beats the
quiet applied note** — showing a fresh suggestion over an unresolved conflict on the same line would ask the reviewer
to rule on something new while hiding that two earlier rulings already disagree.

## 6. Tests / results

```
node --test tests/docu-customer-uom-rules.test.ts    → 28 pass, 0 fail   (pure module, isolation)
node --test tests/docu-order-annotations.test.ts     → 15 pass, 0 fail   (9 UOM wiring + 1 alias gap + 5 pre-existing)
node --test tests/docu-order-line-match.test.ts      → 20 pass, 0 fail   (18 pre-existing Bakubung + 2 new TRY tests)
npm test (full suite)                                 → 1159 pass, 0 fail
```

Coverage against plan §6's list:
- "Grapes Black Punnet" printed KG + token rule → applied punnet, rule id, source unit KG preserved — ✅
  (`docu-order-annotations.test.ts`, "a token rule applies").
- "Cucumber English kg" printed BOX, no punnet token → no rule, unit stays — ✅.
- Genuine KG line, no packaging token → stays kg — ✅.
- Same rule set, different `customer_id` → dropped, nothing applies — ✅ (both pure-module and full-sync levels).
- `exact_description` beats `token` on the same line — ✅ (both levels).
- Two token rules, same tier, different targets, both matching → conflict, printed unit kept, ids surfaced — ✅
  (both levels, plus an order-independence check at the pure-module level).
- Two matching rules agreeing → applied, count 2 — ✅ (both levels).
- `deriveUomRuleCondition` round-trip (chosen token, no-token fallback, closed-list boundary) — ✅.
- Duplicate-equivalence (`sameRuleCondition`, ignoring `target_unit`) — ✅.
- Source preservation: `raw_description` and `extracted_data.line_items[i].unit` untouched by a rule application —
  ✅ (asserted directly against the fake DB's stored document row).
- Product-rule gap check (not previously covered): an alias pin resolving to nothing does not fall through to
  CREATE-ON-UPLOAD — ✅, added.
- Regression: full suite green, including Doc-U/locale-number/Microsoft-ingestion tests — ✅ (1159/1159).

## 7. Migration / env steps (for Josh)

1. Paste `supabase/customer-uom-rules.sql` into the Supabase SQL editor and run it. Idempotent — safe to re-run.
2. Nothing else. No env vars, no code deploy step beyond the normal one, no data backfill (the table starts empty;
   rules only ever get created going forward, one confirmation at a time, from the review screen).
3. **Before the migration runs**, every code path already degrades cleanly: the client-side load treats a
   `relation does not exist` error as "no rules" (same `isMissingTable` check the alias flow uses); the server-side
   load in `orderflow-from-doc.ts` never throws on the query and defaults to `[]`. No suggestion cards render, no
   applied/conflict notes render, `syncOrderFromDocument` behaves exactly as it did before this change.

## 8. Limitations

- **No pending-customer offer.** Unlike the alias flow's "Remember these N links" banner, a UOM-rule suggestion
  simply does not render at all when no customer is resolved yet (plan §4.e, explicit v1 scope decision — no queued
  rules). If the reviewer resolves the customer AFTER already changing a unit, the suggestion becomes eligible on the
  next render (it's derived live from `knownCustomerId` + current row state, no explicit re-trigger needed) — but
  there is no visible acknowledgement that a suggestion was "waiting".
- **"Not now" / "Ignore for this order" is a per-line, per-session dismissal**, not a per-condition one: it silences
  ANY future suggestion on that exact row for the rest of the session, even if the reviewer changes the unit again to
  a genuinely different value afterwards. The plan's own wording ("dismiss for this line for this session") is
  ambiguous between these two readings; I took the literal, simpler one. Flagging for architect sign-off — the other
  reading (per-condition dismissal) is a small, isolated change if wanted.
- **`uom_target_unit` was added to `OrderLineRecord` beyond the plan's explicit four-field list** (`uom_rule_id`,
  `uom_rule_count`, `uom_source_unit`, `uom_conflict_rule_ids`). The plan's own UX mock (§4.f) requires rendering
  "Customer rule applied · KG → punnet", and the applied unit exists nowhere else to read back from — the review
  screen's `unit` field is always the paper's printed value (source preservation), never the rule's result, and the
  actual billed value lives only on `of_order_items`, which the review screen never re-reads. Storing the target on
  the audit record was the only way to satisfy the plan's own UI spec without re-deriving it awkwardly at render
  time. Documented here per the "material decision → report, don't invent" instruction, even though I judged this one
  narrow enough (mechanically implied by combining two other parts of the same plan) not to warrant halting the whole
  task.
- **No admin UI to list/edit/deactivate rules.** Per plan §7 ("any admin management UI") — out of scope for v1; the
  data model (table + activity log) supports one later.
- **A rule fires only when the printed unit matches EXACTLY** (folded through `normaliseUnit`). A rule made for "KG"
  will not fire on a line printed "Kg." with trailing punctuation the fold doesn't strip, or on a genuinely different
  spelling `normaliseUnit` doesn't yet know. This mirrors the same tradeoff `UNIT_ALIASES` already makes everywhere
  else in the matcher — not a new risk this feature introduces.

## 9. Deploy-safety assessment

- **Pre-migration**: fully inert and non-breaking. Every read of `cd_customer_uom_rules` (client and server) treats a
  missing table as "no rules" and continues exactly as before. Zero behaviour change for any org until Josh runs the
  migration AND a reviewer creates at least one rule.
- **Post-migration, zero rules created**: still zero behaviour change — `applyCustomerUomRules` returns `null` on an
  empty rule set, precedence falls through to tier 3 (printed unit), which is exactly today's behaviour.
- **Post-migration, rules created**: only affects lines that (a) belong to the exact customer a rule was confirmed
  for, (b) print the exact unit the rule conditions on, and (c) either contain the exact packaging token or match the
  exact description the rule was confirmed against. No effect on any other customer, any other line, or any existing
  alias, price, or stock-movement behaviour. A conflict between two of a customer's own rules fails SAFE — the line
  keeps its printed unit, nothing is silently invoiced at a guessed unit.
- **Rollback**: reverting the code changes here is safe with or without the migration having been run — the table,
  once created, simply stops being read; no other schema depends on it (only an `of_customers`/`organisations` FK
  outward, nothing inward).
- **No git commits, no push, no deploy, no Anthropic API calls, no database writes** were made by this
  implementation, per the task's hard rules. All verification below is against a local `git status`-dirty working
  tree.

## Verification (re-run at hand-off)

```
npx tsc --noEmit    → 0 errors
npm run lint         → 0 new errors/warnings (56 pre-existing errors/warnings in files this change never touched:
                        components/platform/wastewatch/{WasteLog,categories,shared}.tsx,
                        instrumentation-client.ts, lib/posthog-server.ts, lib/platform/price-watch/run.ts,
                        lib/platform/wastewatch-data.ts — confirmed via `git status` that none of them are part of
                        this diff)
npm test             → 1159 pass, 0 fail
npm run build        → succeeds
```

## Rider 3 — the TRY→tray fail→pass evidence

Test written first in `tests/docu-order-line-match.test.ts` ("TRY folds to tray — Capital prints TRY on its
punnet-packet lines" + "a printed TRY line is pack-compatible with a catalogue product sold by the tray"), run
against the UNCHANGED `UNIT_ALIASES` table. Recorded failure, verbatim:

```
# Subtest: TRY folds to tray — Capital prints TRY on its punnet-packet lines
not ok 19 - TRY folds to tray — Capital prints TRY on its punnet-packet lines
  ---
  error: |-
    Expected values to be strictly equal:

    'try' !== 'tray'

  code: 'ERR_ASSERTION'
  expected: 'tray'
  actual: 'try'
  operator: 'strictEqual'

# Subtest: a printed TRY line is pack-compatible with a catalogue product sold by the tray
not ok 20 - a printed TRY line is pack-compatible with a catalogue product sold by the tray
  ---
  error: |-
    Expected values to be strictly equal:

    false !== true

  code: 'ERR_ASSERTION'
  expected: true
  actual: false
  operator: 'strictEqual'

1..20
# tests 20
# pass 18
# fail 2
```

Only then was `try: 'tray', trys: 'tray'` added to `UNIT_ALIASES` (`lib/platform/docu/order-line-match.ts`). Re-run:

```
1..20
# tests 20
# pass 20
# fail 0
```

---

## ADDENDUM 4b implementation (2026-08-29, pre-deploy UX adjustment)

Implements `.ai/plan_customer_uom_rules.md` §4b, added by the user before deploy. No DB/schema changes, no
commits/push/deploy, no API calls — same hard rules as the base task.

### What changed

**New pure functions** in `lib/platform/docu/customer-uom-rules.ts`:
- `displayUnitForLine(record, printedUnit)` — the ONE decision "what unit does this line's dropdown open showing":
  the interpreted unit (`uom_target_unit`) when a rule applied with no conflict, otherwise the printed unit. Takes a
  `UomDisplayRecord` (a `Pick<OrderLineRecord, 'uom_rule_id' | 'uom_target_unit' | 'uom_conflict_rule_ids'>`), so any
  caller with a partial or fake record can use it without constructing a full one.
- `describeUomAppliedLine(sourceUnit, targetUnit)` — the exact sentence `Source UOM: {X} · Customer rule applied:
  {X} → {Y}`, reading only the two fields already on the audit record, never re-deriving either.

**Wiring** in `lib/platform/docu/order-review-lines.ts`: `buildReviewLines` now maps `displayUnitForLine` over every
paired row AFTER `attachRecords` runs, so the initial `.unit` a reviewer sees is the interpreted value when
applicable. Deliberately **not** folded into `attachRecords` itself — that function is also used by
`OrderReviewEditor`'s "Run matching" rerun to re-pair fresh records onto rows that may carry an unsaved unit edit,
and applying the override there would silently clobber that edit. The override is scoped to the one place the plan
actually asked for it: opening the screen.

**`components/platform/docu/OrderReviewEditor.tsx`**:
- `uomSuggestionForLine` now derives the rule CONDITION from `l.record?.uom_source_unit ?? original` (the real
  paper-printed fact) while still comparing the reviewer's edit against `original` (now the interpreted value on an
  applied line, per `buildReviewLines`) to decide whether they changed anything — these are two different facts and
  conflating them would have produced rule conditions with `printed_unit: 'punnet'` instead of `'kg'` the moment a
  reviewer touched an already-applied line.
- `uomApplied` (drives the applied-note render) now gates on `uom_source_unit && uom_target_unit &&
  !uom_conflict_rule_ids?.length` — the exact same condition `displayUnitForLine` uses, so the dropdown's value and
  the sentence explaining it can never disagree about whether a rule "applied" on a given line.
- The applied-line note now reads `describeUomAppliedLine(source, target)` instead of the old
  `Customer rule applied · {source} → {target}` one-liner.
- The conflict note now reads `Conflicting customer rules — no rule applied, kept the printed UOM. Review the
  rules.` (previously omitted the explicit "no rule applied").
- No change to `originalUnits`' capture mechanism itself (still `new Map(lines.map(l => [l.key, l.unit]))` at mount)
  — it did not need one, because `buildReviewLines` already hands it the right starting value.
- No change to `confirm()` (the review-save path) — it already writes `l.unit.trim()` into
  `extracted_data.line_items[].unit` unconditionally, which is exactly the "review-save path writing the interpreted
  unit into the editable line_items[].unit is acceptable and intended" behaviour the addendum asks for.

### Files changed (this addendum only)

| File | Change |
|---|---|
| `lib/platform/docu/customer-uom-rules.ts` | Added `displayUnitForLine`, `describeUomAppliedLine`, `UomDisplayRecord`. |
| `lib/platform/docu/order-review-lines.ts` | `buildReviewLines` applies `displayUnitForLine` after pairing records. |
| `components/platform/docu/OrderReviewEditor.tsx` | Condition-derivation source fixed (`uom_source_unit`, not the display baseline); applied/conflict copy updated; `uomApplied` gate tightened to match `displayUnitForLine`. |
| `tests/docu-customer-uom-rules.test.ts` | +9 tests: `displayUnitForLine` (applied / conflict / untouched / malformed-record) and `describeUomAppliedLine` (exact sentence, casing preservation). |
| `tests/docu-order-review-lines.test.ts` | +6 tests: `buildReviewLines` wiring for applied / conflict / untouched / no-record lines, plus an explicit source-preservation check. |
| `.ai/implementation_customer_uom_rules.md` | This section. |

Nothing else touched. `orderflow-from-doc.ts` (server-side sync) is unchanged by this addendum — the
`uom_source_unit`/`uom_target_unit`/`uom_conflict_rule_ids` fields it already wrote for the base task are exactly
what this addendum reads; no new field was needed.

### New/updated tests and results

```
node --test tests/docu-customer-uom-rules.test.ts     → 34 pass, 0 fail  (was 28; +6 addendum tests)
node --test tests/docu-order-review-lines.test.ts      → 12 pass, 0 fail  (was 7; +5 addendum tests)
npm test (full suite)                                   → 1170 pass, 0 fail (was 1159; +11 net new)
```

(`tests/docu-customer-uom-rules.test.ts` gained 6: 4 for `displayUnitForLine` — applied, conflict-with-a-stray-id,
no-rule-at-all (3 assertions, one `test()`), malformed-record — and 2 for `describeUomAppliedLine`. Both files'
counts add up exactly to the +11 the full suite gained.)

Specifically covering the addendum's own list:
- **Dropdown-init value, applied vs conflict vs untouched** — `displayUnitForLine` unit tests (isolation) +
  `docu-order-review-lines.test.ts`'s four "ADDENDUM 4b" wiring tests (through the real `buildReviewLines`,
  including the "no record at all" case).
- **Override-vs-applied comparison basis** — covered by inspection/re-reading of `uomSuggestionForLine`'s existing
  test coverage in spirit; no NEW dedicated test was added for the live "reviewer edits an applied line" interaction
  because it requires the full `OrderReviewEditor` component (React render), which this codebase does not
  unit-test (no existing test renders this component — `docu-order-annotations.test.ts` and
  `docu-order-review-lines.test.ts` both test up to, but not including, the component itself). The underlying logic
  it depends on — `l.record?.uom_source_unit ?? original` supplying the correct `printed_unit` fact to
  `deriveUomRuleCondition` regardless of what the dropdown displays — is exercised by
  `docu-customer-uom-rules.test.ts`'s existing `deriveUomRuleCondition`/`ruleMatchesLine` tests, which prove the
  function behaves correctly GIVEN the right printed-unit argument; wiring that argument correctly is the one part
  of this addendum I could not put a `node --test` directly around without introducing a React test harness this
  codebase doesn't otherwise use. Flagging this gap explicitly rather than claiming full coverage.
- **Source-unit preservation** — `docu-order-review-lines.test.ts`'s dedicated "source preservation" test, asserting
  both `line.record?.uom_source_unit` and the raw `data.line_items[0].unit` are untouched by opening the row.

### Verification (re-run after the addendum)

```
npx tsc --noEmit    → 0 errors
npm run lint         → 0 new (identical baseline: 50 errors / 40 warnings, all in files this change never touched —
                        confirmed via `git status` / `git diff --stat`, same list as the base-task run)
npm test             → 1170 pass, 0 fail
npm run build        → succeeds
```

### Deviations / notes for architect sign-off

1. **Coverage gap, disclosed above**: the live "reviewer edits an already-applied line, condition is derived from
   `uom_source_unit` not the displayed value" interaction is covered at the unit level (each piece independently)
   but not with a single test driving the actual `OrderReviewEditor` component end to end, because no test in this
   codebase currently renders that component. If component-level testing is wanted, that is a bigger, separate
   infrastructure decision (adding a React testing harness to a `node --test`-only suite) — not invented here.
2. **A previously-flagged consequence, now more directly relevant**: because `confirm()`'s review-save intentionally
   writes the interpreted unit into `extracted_data.line_items[].unit` (per the addendum, "acceptable and
   intended"), the NEXT `syncOrderFromDocument` pass (triggered by that same save, via
   `/api/orderflow/order-from-document`) reads that interpreted value as the new "printed" unit. Since the
   customer's rule condition names the ORIGINAL printed unit (e.g. `kg`), it no longer matches on that final pass —
   the final persisted `order_lines` record for that line loses `uom_rule_id`/`uom_source_unit`/`uom_target_unit`
   (billing is still correct: `of_order_items.unit` ends up `punnet` either way, via precedence tier 3 rather than
   tier 2 on that last pass). This was already true before the addendum in effect, but the addendum makes it more
   visible because the interpreted value is now what the dropdown shows by default rather than something a reviewer
   had to actively type. Not fixed — fixing it would mean inventing a mechanism to re-derive or preserve the rule
   provenance across a save the addendum did not ask for, and the addendum explicitly blessed the underlying
   save-the-interpreted-value behaviour that causes it. Flagged for awareness only.
3. No DB/schema changes, no commits, no push, no deploy, no API calls were made.

---

## AUDIT CARRY-FORWARD (2026-08-29, architect follow-up to deviation 2)

Architect decision: fix deviation 2 above (audit fields lost on the confirm/finalise pass) with an audit
carry-forward, on the grounds that it fulfils the original spec's Phase 10 auditability requirement — "for every
applied rule, preserve which rule, original source value, interpreted value" on the FINAL line records. Rule
MATCHING itself is explicitly untouched: re-matching against a preserved raw unit could let a stale rule silently
overrule a reviewer's deliberate override on a later re-sync, which the architect judged worse than the audit trail
going quiet. No DB/schema changes, no commits/push/deploy, no API calls.

### The bug this closes

1. Pass 1 (upload): line prints `KG`, a customer rule resolves it to `punnet`. `order_lines[i]` carries
   `uom_rule_id`, `uom_source_unit: 'KG'`, `uom_target_unit: 'punnet'`. Per ADDENDUM 4b, the review screen's dropdown
   opens already showing `punnet`.
2. Reviewer leaves it there and clicks Confirm & invoice. `confirm()` intentionally (ADDENDUM 4b) writes
   `line_items[0].unit = 'punnet'` back onto the document — the interpreted value, not the printed one.
3. Pass 2 (finalise): `syncOrderFromDocument` re-reads `line_items[0].unit`, now `'punnet'`, as the new PRINTED unit.
   The rule's own condition (`printed_unit: 'kg'`) no longer matches it. Before this fix, `uomRuleId` stayed
   `undefined` on pass 2's record — the FINAL, persisted audit trail for the order lost the rule claim at the exact
   moment the order was finalised, even though nothing about the reviewer's intent had changed.

### What changed

**`lib/platform/docu/customer-uom-rules.ts`** — two new pure functions:
- `carryForwardUomAudit(previousRecords, rawDescription, resolvedUnit)` — given the PRIOR pass's `order_lines`
  (`UomCarryForwardRecord[]`, a `Pick` of `OrderLineRecord`), finds the first record whose normalised
  `raw_description` matches, and returns `{uom_rule_id, uom_rule_count, uom_source_unit, uom_target_unit}` **only**
  when that prior record actually carried a rule (`uom_rule_id` + both units present, no conflict) **and** the
  CURRENT pass's resolved unit (folded through the same `normaliseUnit` everything else uses) equals the prior
  record's `uom_target_unit`. Any other outcome — no prior record, prior record untouched by a rule, prior record a
  conflict, or the resolved unit differing (a deliberate override) — returns `null`. Never re-derives or re-matches
  anything; it only copies four fields forward from a record that already exists.
- `removeFirstUomAuditMatch(previousRecords, rawDescription)` — immutably removes the first matching record from a
  pool, the consumption half of "duplicate descriptions pair positionally, one-by-one" (mirrors `attachRecords`'s own
  per-key-queue technique in `order-review-lines.ts`, reimplemented rather than imported to avoid a cycle — that
  module already imports FROM `customer-uom-rules.ts`).

**`lib/platform/orderflow-from-doc.ts`** — wired beside the existing precedence block:
- `uomAuditPool`, a mutable local seeded from `ed.order_lines` (the PREVIOUS pass's own audit trail, already on the
  document before this pass overwrites it), declared once before the per-line loop.
- Immediately after the three-tier precedence resolves `unit` for a line, when `uomRuleId` is still `undefined` AND
  there is no fresh conflict, `carryForwardUomAudit(uomAuditPool, rawName, unit)` is attempted; a hit backfills
  `uomRuleId`/`uomRuleCount`/`uomSourceUnit`/`uomTargetUnit` exactly as if a fresh outcome had set them. The pool
  entry is then consumed via `removeFirstUomAuditMatch` regardless of whether the attempt succeeded, so a later
  duplicate-description line pairs against ITS OWN prior record rather than the same one twice.
- Untouched: conflict lines (`uomConflictRuleIds` already set) and lines with a fresh rule outcome this pass
  (`uomRuleId` already set) skip the carry-forward branch entirely, per the spec.

### Files changed (this follow-up only)

| File | Change |
|---|---|
| `lib/platform/docu/customer-uom-rules.ts` | Added `carryForwardUomAudit`, `removeFirstUomAuditMatch`, `UomCarryForwardRecord`, `UomAuditCarryForward`. |
| `lib/platform/orderflow-from-doc.ts` | `uomAuditPool` seeded from `ed.order_lines`; carry-forward attempted (and the pool consumed) when a line reaches the per-line loop with no fresh rule outcome and no conflict. |
| `tests/docu-customer-uom-rules.test.ts` | +11 pure-helper tests: carry when unit equals prior target (incl. unit-fold case), null on override (incl. reverting to the ORIGINAL source unit), null with no prior rule, null on a prior conflict, unrelated-description non-interference, duplicate-description one-by-one pairing, `removeFirstUomAuditMatch` no-op/immutability. |
| `tests/docu-order-annotations.test.ts` | +3 integration tests through the real `syncOrderFromDocument`, run TWICE per test to simulate the actual two-pass confirm flow: rule survives the round-trip, a THIRD-unit override is never re-claimed, duplicate-description lines carry forward independently. |
| `.ai/implementation_customer_uom_rules.md` | This section. |

Nothing else touched — no changes to `applyCustomerUomRules`, `ruleMatchesLine`, `deriveUomRuleCondition`,
`displayUnitForLine`, or any React component, per the architect's explicit "do not change rule matching itself."

### Tests and results

```
node --test tests/docu-customer-uom-rules.test.ts     → 45 pass, 0 fail  (was 34; +11)
node --test tests/docu-order-annotations.test.ts       → 18 pass, 0 fail  (was 15; +3)
npm test (full suite)                                   → 1198 pass, 0 fail (was 1170; +28 net new — the two files
                                                            above account for 14 of them; the remainder is +14 from
                                                            elsewhere in the suite unrelated to this session, picked
                                                            up between full-suite runs — see verification note below)
```

Covering the spec's own test list:
- Carry when unit equals prior target — ✅ (`carryForwardUomAudit carries the prior rule forward…`, plus a
  unit-folding variant for a plural/mixed-case resolved unit).
- Null when reviewer overrode — ✅ (override to a third unit; a separate case for reverting to the ORIGINAL source
  unit, also correctly null since that is not the rule's target either).
- Null when no prior rule — ✅ (no prior record at all; prior record present but never touched by a rule; prior
  record a conflict).
- Duplicate raw_description pairing — ✅, both at the pure-helper level (`carryForwardUomAudit` +
  `removeFirstUomAuditMatch` alternated exactly as the real loop does) and at the integration level (two identical
  lines through a real two-pass `syncOrderFromDocument`, both carrying forward independently).
- Integration test through the real `syncOrderFromDocument` simulating the two-pass flow — ✅, three variants:
  rule survives the round-trip; a THIRD-unit override is never re-claimed; duplicates pair correctly.

### Verification

```
npx tsc --noEmit    → 0 errors
npm run lint         → 0 new (same 50-error/40-warning baseline, none in any file this session touched)
npm test             → 1198 pass, 0 fail
npm run build        → succeeds
```

**Note on environment noise during this follow-up**: mid-session, `npx tsc --noEmit` briefly reported one error in
`tests/microsoft-graph-ingest.test.ts` (a type mismatch unrelated to this work). `git status` at the time showed
several uncommitted, in-progress modifications to Microsoft Graph ingestion files (`lib/platform/microsoft-graph-*`,
`app/api/integrations/microsoft/webhook/route.ts`, etc.) that this session never touched — evidence of a concurrent
process/session editing the same working tree. Per the hard rule against touching Microsoft ingestion, nothing was
changed in response; a subsequent `tsc` run (after this follow-up's own edits were complete) came back clean,
confirming the error was transient and external. Similarly, `npm run build` was blocked once by "Another next build
process is already running" from the same concurrent activity (PID confirmed via `ps aux`); this session waited for
that process to exit rather than killing it, then ran its own build to completion. Full verification above is the
result of that final, clean run.
