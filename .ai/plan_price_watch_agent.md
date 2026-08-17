# Plan: Price Watch Agent v1 — repo-verified revision

Status: **awaiting user approval**. Reviewed by Fable against the actual repo on 2026-08-13.
Original draft's assumptions corrected below; every path and pattern here was verified in code.
Implementation is delegated to subagents per Claude_Rules.md — see the Delegation map at the end.

## Goal

Build Vyso's first operational AI agent: Price Watch. It reads supplier invoice line items
already extracted by Doc-U (Turn 'n Slice org only), normalises them against a canonical
buy-side item catalogue, maintains per-supplier price history, detects material price
increases, and writes evidence-backed, rand-quantified findings to a new shared
`agent_findings` table. Findings are delivered weekly via an email digest (Resend).
No auto-actions: the agent observes and recommends; humans act.

The findings schema → agent job → evidence links → delivery skeleton is the reusable
pattern every future agent copies.

## What the repo actually looks like (verification results)

These facts override the original draft's assumptions:

1. **No `src/` directory.** Code lives at repo root: `app/`, `lib/`, `components/`,
   `tests/`. Platform logic goes in `lib/platform/…`, AI plumbing in `lib/ai/…`.
2. **No `supabase/migrations/`.** Migrations are loose, idempotent `.sql` files in
   `supabase/`, pasted by hand into the Supabase dashboard SQL editor (CLI is unlinked).
   House style: prerequisite `do $$` guards, `create table if not exists`,
   `drop policy if exists` + recreate, heavy why-comments.
3. **There is no relational line-item table.** Doc-U stores extraction as
   `documents.extracted_data jsonb` with a `line_items[]` array
   (`lib/ai/anthropic.ts` → `ExtractedLineItem`: description, quantity, unit,
   unit_price, amount, weight, total_kg, units_per_box, per-line supplier). The
   draft's `invoice_line_id uuid` FK is impossible; identity is
   `(document_id, line_index)`.
4. **Tenancy column is `org_id`**, not `tenant_id`, referencing `organisations(id)`.
   RLS pattern on every module table (copy exactly, e.g. `supabase/ss-supplier-rebates.sql`):
   ```sql
   create policy <t>_all on <t> for all
     using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
     with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
   ```
5. **Suppliers are relational**: `documents.supplier_id → suppliers(id)`; Doc-U's
   `supplier-match.ts` resolves them at ingest. Per-line `supplier` only appears on
   market statements.
6. **Substantial prior art to REUSE, not duplicate:**
   - `lib/platform/supplysync-pricing.ts` — already reads priced line items off
     documents (`readPriceObservations`), normalises item identity (`itemKey`),
     detects price moves latest-vs-prior, and computes measured/estimated annualised
     rand impact (`measuredAnnualUnits`). Pure functions, render-time only: nothing
     persisted, no dedupe, no digest, no median logic.
   - `lib/platform/procurepulse/matching.ts` — `normalizeName`, `cleanDisplayName`,
     `diceCoefficient` (deterministic name matching, review-queue pattern).
   - `lib/platform/procurepulse/units.ts` — unit dimension (weight vs count), kg
     conversions, org custom units.
   - `lib/ai/anthropic.ts` — server-only Anthropic client; `MATCH_MODEL`
     (`claude-haiku-4-5`) already designated for "pick the right canonical from a
     short candidate list"; `parseAmount` in `lib/platform/docu/extract.ts`.
   - `lib/ai/finch/` — existing in-app agent framework (chat-style). Price Watch is a
     batch job, not a Finch module, but naming/config style should rhyme with it.
7. **Cron pattern exists**: `vercel.json` crons (03:00, 03:30 UTC) hitting routes that
   check `authorization === Bearer ${CRON_SECRET}`, `maxDuration = 300`, service-role
   client via `createServiceSupabase()` (`lib/platform/supabase-service.ts`) with
   mandatory `.eq('org_id', …)` on every query. Copy `app/api/email/process/route.ts`.
8. **Email sending**: Resend is a dependency, `RESEND_API_KEY` configured; send
   patterns in `app/api/contact/route.ts` / `app/api/feedback/route.ts`.
9. **Models (answers draft's D3)**: two-tier pattern is `claude-haiku-4-5`
   (extract/summary/categorise/match) and `claude-opus-4-8` (default `MODEL`), all
   env-overridable. Matching → Haiku tier; observation text → default `MODEL` tier
   via a new `ANTHROPIC_OBSERVE_MODEL` override, defaulting to the existing `MODEL`.
10. **Credit notes**: no `credit_note` document_type (check constraint allows
    invoice/statement/delivery_note/price_list/order). Doc-U raises a derived
    `credit_note` FLAG (`lib/platform/docu/flags.ts`, keyword `/\bcredit\b/`).
    Exclusion rule: skip docs carrying that flag and skip lines with negative or zero
    amounts/prices.
11. **Tests**: `npm run test` = `node --test tests/*.test.ts` — flat files in `tests/`,
    no `__tests__` dirs. No `type-check` script: use `npx tsc --noEmit`.
12. **Next 16 warning** (AGENTS.md): docs differ from training data — the implementer
    MUST read `node_modules/next/dist/docs/` before writing any route handler.
13. **Local env has NO `SUPABASE_SERVICE_ROLE_KEY`** (checked `.env.local` keys; the
    service key exists only in Vercel). Consequence: neither the Step 0 gate check nor
    the backfill script can run locally as-is. See "Gate check" and D5.

## Step 0 — Gate check (HARD GATE, still not run)

Fable could not run this locally (no service key, CLI unlinked). Before ANY
implementation, sample real Turn 'n Slice extraction. Two acceptable ways (D5):

- **(a) Josh pastes this into the Supabase dashboard SQL editor** and shares the output:
  ```sql
  select d.id, d.document_type, d.confidence, s.name as supplier,
         jsonb_array_length(coalesce(d.extracted_data->'line_items','[]'::jsonb)) as lines,
         d.extracted_data->'line_items' as line_items
  from documents d
  join organisations o on o.id = d.org_id
  left join suppliers s on s.id = d.supplier_id
  where o.name ilike '%turn%slice%'
    and d.document_type in ('invoice','statement')
  order by d.created_at desc
  limit 20;
  ```
- **(b) Josh temporarily adds `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`**, and a
  subagent runs a read-only sampling script.

Proceed only if supplier, description, quantity, unit, and unit_price are usable on
most lines. If extraction is document-level or units are junk, STOP and report — the
real task becomes a Doc-U extraction upgrade. Do not improvise around missing structure.
(Demo Fresh Valley data is well-structured, but it is synthetic — it proves the schema,
not TnS reality.)

## Acceptance criteria

1. `agent_findings` table exists with org-scoped RLS matching the house pattern.
2. Canonical buy-side item catalogue (`pw_items`) exists; normalisation maps raw
   Doc-U line descriptions to items with a confidence score. ≥ 0.9 auto-links;
   below that the row lands in `pw_item_matches` with status `review`. Nothing is
   silently guessed.
3. Unit prices are normalised (per kg / per unit / per litre) before comparison. A
   pack-size change alone must NOT produce a finding (explicit test).
4. Price history is backfilled from ALL historical TnS invoices/statements in the DB.
5. A finding fires only when ALL hold for a (supplier, item):
   - current unit price > trailing 60-day median by ≥ 8%
   - estimated annualised impact ≥ R1,000 (delta × trailing 12-week volume, annualised —
     reuse the `measuredAnnualUnits` approach)
   - ≥ 3 historical price points exist
   - no OPEN finding (status new/in_progress) already exists for the same
     (supplier, item, direction) — prevents weekly re-firing while the median catches up
6. Finding rows carry: agent name, plain-language observation, `evidence_refs`
   (source document ids, ≥ 1), `rand_impact`, `recommended_action`, `status='new'`,
   `org_id`, `created_at`.
7. Observation text comes from the Claude API given ONLY structured inputs, and is
   **validated at runtime**: numbers are regex-extracted from the text and compared to
   the structured values; mismatch → one retry → deterministic template fallback.
   Unit tests cover the validator with canned good/bad outputs. (Stronger than the
   draft's test-only check — "never invented numbers" is enforced in production.)
8. Runs as a Vercel Cron (D1) and is idempotent: dedupe on
   `unique(org_id, dedupe_key)`, `dedupe_key = 'price_watch:<supplier_id>:<pw_item_id>:<iso-week>'`
   (plain text, not a hash — debuggable).
9. Weekly digest emails top open findings (max 5, by rand_impact) with evidence links
   via Resend. Plain HTML fine.
10. `verdict` column (`real | known | wrong | trivial`, nullable) exists for tuning,
    settable via SQL for now.
11. `npx tsc --noEmit`, `npm run lint`, `npm run test` all pass; no regressions.

## Files to create or modify (repo-verified paths)

Create:
- `supabase/agents-price-watch.sql` — one idempotent migration file, house style
  (guards, if-not-exists, drop-policy-recreate, indexes, why-comments)
- `lib/platform/price-watch/normalize.ts` — unit-price normalisation (pure; builds on
  `procurepulse/units.ts`) + candidate shortlisting via `procurepulse/matching.ts`
  (`normalizeName`, `diceCoefficient`)
- `lib/platform/price-watch/match.ts` — Claude-assisted canonical matcher using the
  existing `MATCH_MODEL` tier in `lib/ai/anthropic.ts` (extend that module with a
  price-watch match helper if none is generic enough — do NOT create a second client)
- `lib/platform/price-watch/detect.ts` — pure detection (60-day median, R1,000 floor,
  ≥3 points, open-finding suppression). No I/O.
- `lib/platform/price-watch/observe.ts` — observation + recommended_action generation
  and the number-fidelity validator + deterministic fallback template
- `lib/platform/price-watch/run.ts` — orchestrator: load docs → normalise → upsert
  price points → detect → dedupe → write findings. Service client, every query
  `.eq('org_id', …)`.
- `app/api/agents/price-watch/route.ts` — cron entry (copy the CRON_SECRET +
  maxDuration pattern from `app/api/email/process/route.ts`)
- `app/api/agents/digest/route.ts` — weekly digest entry (Resend pattern from
  `app/api/feedback/route.ts`)
- `scripts/backfill-price-watch.ts` — one-off backfill (requires service key; supports
  `--dry-run`; org id passed explicitly, NEVER defaulted, so demo orgs are untouched)
- `tests/price-watch-detect.test.ts`, `tests/price-watch-normalize.test.ts`,
  `tests/price-watch-observe.test.ts` — node:test style matching existing tests

Modify:
- `vercel.json` — add crons: price-watch daily `45 3 * * *` UTC (05:45 SAST, after the
  existing 03:00/03:30 ingest recovery crons); digest Monday `0 4 * * 1` UTC (06:00 SAST)
- `.env.local` / Vercel env — `CRON_SECRET` already in use; optionally
  `ANTHROPIC_OBSERVE_MODEL`

Do NOT touch:
- Doc-U extraction pipeline, existing tables' schemas or RLS, auth, marketing site,
  SupplySync/ProcurePulse modules (import from them; never modify them)

## Data changes (adapted to house conventions)

```sql
-- All tables: org_id uuid not null references organisations(id) on delete cascade,
-- RLS per the ss_* pattern, created_at timestamptz not null default now().

create table if not exists pw_items (          -- canonical BUY-side items
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,                          -- "Tomatoes, Roma"
  base_unit text not null,                     -- 'kg' | 'unit' | 'l'
  category text,
  created_at timestamptz not null default now()
);

create table if not exists pw_item_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  raw_description text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  pw_item_id uuid references pw_items(id) on delete set null,
  confidence numeric not null,
  status text not null default 'auto',         -- auto | review | confirmed | rejected
  created_at timestamptz not null default now(),
  unique (org_id, supplier_id, raw_description)
);

create table if not exists pw_price_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  pw_item_id uuid not null references pw_items(id) on delete cascade,
  line_supplier text,                          -- normalised per-line market agent (null on invoices);
                                               -- series key is (supplier_id, line_supplier, pw_item_id)
  document_id uuid not null references documents(id) on delete cascade,
  line_index int not null,                     -- position in extracted_data->line_items
  unit_price numeric not null,                 -- normalised to base_unit
  quantity_base numeric not null,              -- quantity in base_unit
  invoice_date date not null,                  -- extracted "Invoice date" field, else created_at
  created_at timestamptz not null default now(),
  unique (document_id, line_index)             -- replaces the impossible invoice_line_id FK
);
-- index: (org_id, supplier_id, pw_item_id, invoice_date)

create table if not exists agent_findings (    -- SHARED by all future agents
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  agent text not null,                         -- 'price_watch'
  observation text not null,
  evidence_refs uuid[] not null,               -- document ids
  rand_impact numeric,
  recommended_action text,
  status text not null default 'new',          -- new | in_progress | resolved | dismissed
  verdict text,                                -- real | known | wrong | trivial
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key)
);
-- index: (org_id, agent, status, created_at desc)
```

## Decisions — ALL RESOLVED by Josh, 2026-08-13

- **D1 Scheduling** — ✅ Vercel Cron.
- **D2 Digest recipients** — ✅ Josh + Roberto. Recipients live in an env var
  (`PRICE_WATCH_DIGEST_TO`, comma-separated), not in code; Josh fills Roberto's
  address into Vercel env. WhatsApp deferred to v2.
- **D3 Models** — ✅ matcher on `claude-haiku-4-5` (existing MATCH_MODEL),
  observation on `claude-opus-4-8` (existing MODEL default), both env-overridable.
- **D4 SupplySync overlap** — ✅ coexist for v1; SupplySync untouched; converge in v2
  (SupplySync may later read `pw_price_points`).
- **D5 Gate-check access** — ✅ resolved: `SUPABASE_SERVICE_ROLE_KEY` added to
  `.env.local`. Gate check ran 2026-08-13 → conditional fail on the 2026-06-25 legacy
  statement backlog (no supplier, no date); Josh approved the re-extraction pre-task.
  See `.ai/implementation.md` for the full gate report.

### Approved pre-task (before step 2)

Re-run the CURRENT Doc-U extractor over the 16 legacy statements of 2026-06-25.
Two phases: backup + one pilot doc, architect review, then the rest. Pilot PASSED
2026-08-13 (see `.ai/implementation.md`): supplier attribution, unit, total_kg all
recovered; statement dates were in `summary.statement_date` all along (15/16 docs);
pilot also fixed 14 duplicate lines in the old extraction. Batch running.

### Post-pilot amendments (Josh approved, 2026-08-13)

- **Reviewed docs**: the two status-`reviewed` legacy statements (edda8e8f, b1186349)
  are re-extracted too — their old data carries the duplicate-line over-count. Status
  and review fields untouched; only extracted_data/confidence/supplier_id update.
- **Per-agent granularity**: `pw_price_points.line_supplier text` (nullable) added.
  Market-statement series key = (supplier_id, line_supplier, pw_item_id); plain
  invoices leave it null. Lookup index includes it.
- **Truncation aliasing** (architect decision): extraction returns truncated agent
  names ("Botha Roodt & Ki" vs "Botha Roodt"). `normalize.ts` merges names
  deterministically when one is a ≥12-char prefix of the other (case/punctuation
  folded), keeping the LONGEST observed form as canonical. Unit-tested; no Doc-U
  prompt changes in this plan's scope.
- **Price-point dates**: statements use `summary.statement_date` (format like
  "06/JUN/2026" — parser needed), invoices use the extracted invoice-date field,
  `created_at` only as last resort. Implementer must handle the one doc with a null
  statement_date (fall back to created_at).

## Ordered implementation steps

1. Gate check per Step 0 (blocked on D5). Record the sample in `.ai/implementation.md`.
2. Migration `supabase/agents-price-watch.sql`; Josh pastes it into the dashboard.
3. `normalize.ts` pure functions (+ tests): unit parsing → base-unit price; candidate
   shortlist via existing matching utilities.
4. `match.ts` Claude matcher (+ tests with canned responses): temperature 0, strict
   JSON out (`{ pw_item_id | null, confidence }`); malformed JSON → review queue,
   never guess; no plausible match → propose new item into review queue.
5. Backfill script (dry-run first): all historical TnS priced docs → pw_items (via
   review-queue confirmations), pw_item_matches, pw_price_points. **Pause here** —
   Josh clears the review queue (SQL for v1) before detection goes live.
6. `detect.ts` (+ tests): three rules + open-finding suppression + pack-size test case.
7. `observe.ts` (+ number-fidelity validator tests, canned outputs; no live API in tests).
8. `run.ts` + cron route + vercel.json entry; idempotency verified by double-run.
9. Digest route + Monday schedule + Resend HTML.
10. `npx tsc --noEmit`, `npm run lint`, `npm run test` green. Deviations →
    `.ai/implementation.md`.

## Edge cases (handled or explicitly tested)

- Pack-size change, flat per-unit price → no finding (test).
- < 3 data points → no finding.
- Credit notes: skip docs with the derived `credit_note` flag; skip negative/zero
  prices or amounts (log a warning).
- Duplicate ingest → `unique(document_id, line_index)` blocks double points.
- Same elevated price week after week → open-finding suppression (accept. 5) stops
  duplicate findings beyond the iso-week dedupe.
- Seasonal volatility: 8% + R1,000 is v1's blunt answer; no seasonality modelling;
  `verdict='known'` dismissals feed tuning.
- Malformed matcher JSON → review queue.
- Statements vs invoices covering the same purchases: v1 ingests both doc types but a
  statement's line for an already-pointed invoice period can double-count volume.
  Mitigation: prefer invoices; only take statement lines when the supplier has NO
  invoice-sourced points in that statement's period (implementer must handle; test).
- Docs with `status='rejected'` or archived → excluded.

## Verification commands

```bash
npx tsc --noEmit
npm run lint
npm run test
npx tsx scripts/backfill-price-watch.ts --org <turn-n-slice-org-id> --dry-run
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/agents/price-watch
# select count(*) from agent_findings where agent='price_watch';
# re-run the curl; count must be unchanged (idempotency)
```

## Out of scope for v1

Cross-supplier "switch to X" recommendations · auto-actions · WhatsApp delivery ·
seasonality models · UI (findings feed/chat later) · any org other than Turn 'n Slice ·
touching SupplySync/ProcurePulse.

## Delegation map (per Claude_Rules.md)

| Step | Work | Agent |
|---|---|---|
| 1 | Gate-check sampling script/read | Haiku (or Josh via dashboard) |
| 2 | Migration SQL (mechanical, pattern-copy) | Sonnet |
| 3, 6 | Pure functions + tests (normalize, detect) | Sonnet |
| 4, 7 | Claude prompt design, matcher, observe + validator | Opus (medium) — one-shot quality matters |
| 5 | Backfill script | Sonnet |
| 8, 9 | Cron routes + digest (must read Next 16 docs first) | Opus (medium) — Next 16 divergence risk |
| 10 | Verification run + implementation.md | Sonnet |

Fable reviews each step's diff against this plan before the next step starts.
