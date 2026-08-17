# Plan: Demo MVP — Finch as the COO (Meridian demo org + Loom + prospect self-serve login)

Status: **AWAITING JOSH'S APPROVAL — do not implement beyond Phase A prep.**
Architect: Fable, 2026-08-17. Implementers: subagents per `Claude_Rules.md`, one phase at a
time, commit after every green phase. Every fact below was verified against the repo today
(audit summary in §2); nothing is assumed from older plans.

---

## 0. What the demo has to prove (and what it must not try to prove)

The site now sells **Finch — "your company's own COO"**, R6,000/location/month, founding terms
= first month free after a R2,000 Operations Audit. The prospect wants a case study or demo
before committing to that month. So the demo's job is narrow:

> "A COO read your paperwork overnight and this morning it tells you three things that cost you
> money, with the invoice to prove each one, and you can ask it follow-up questions."

That is **The Brief** (`/app`) + **Finch chat** with evidence-backed findings. The nine modules
are "under the hood" — they must *work* when the prospect clicks into them, but the Loom should
spend ≤ 30 s on them. A module tour is the old Vyso pitch and would undercut the COO framing.

Concretely the demo must show, live, from real rows:
1. The Brief opening on **3–5 findings** across at least **two kinds** (price increase +
   something else — late payer or stock cover), each with a rand line and "3 invoices" evidence.
2. Tapping a finding → Finch explains it and answers "show me the invoices" / "how has this
   supplier moved over the year?" / "who owes me money?" from live data.
3. Under the hood: the invoice the finding came from (Doc-U), the stock line (ProcurePulse),
   the debtor (OrderFlow) — one click each, all reading the same rows.
4. The weekly digest email as the "COO's Monday note".

Out of scope for this demo (say so on the Loom, don't fake it): Xero/Yoco pulls, drafting
supplier emails from a finding, WhatsApp ordering, mobile. Standing rule holds: **nothing
outbound sends itself; drafts only.**

---

## 1. Decisions (recommendation first; Josh confirms or overrides)

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Which org do we demo? | **Meridian Food Co.** (`supabase/demo-all-in-one.sql`, `demo@vyso.co.za`), not Turn 'n Slice | Meridian was built segment-neutral for exactly this; ~R5.5M/mo, 458 invoices, 34 documents, movements, waste, rosters — every module has depth. TnS data is a real customer's supplier prices; showing it to another operator is a confidentiality problem, and the last live Price Watch run on TnS produced 6 artifacts / 7. Keep TnS as the **case study** (`/case-studies/turn-n-slice` already exists) — narrative + permissioned quotes, not screens of their numbers. |
| D2 | How does the prospect get in? | **One Supabase auth user per prospect** (dashboard-created, `role='admin'`, `profiles.org_id` = Meridian), fresh password, no self-signup | No invite flow exists (`grep invite` = 0). `SIGNUP_ENABLED=false` stays. Per-prospect user (not the shared demo login) so their dismissals/notes don't bleed into the next demo, and so we can revoke one without touching another. `admin` because `canSeeMoney` = owner/admin — a COO demo without money is pointless. `role-enforcement.sql` lets admin write payments; on a throwaway org that's fine, and re-running the seed resets everything. |
| D3 | Second finding kind for the Brief | **Debtors Watch** (late payers) first, **Stock Cover** second, both as thin agents on the Price Watch skeleton writing `agent_findings` | Debtors is nearly free — `overdueInvoices`/`outstandingByCustomer` in `lib/ai/finch/orderflow-data.ts` already compute it; the agent is a cron wrapper + dedupe key. Stock Cover needs a pure detect over `pp_stock_items` + `pp_stock_thresholds` + `pp_movements` (days-of-cover, count-adjustment shrinkage). Both are P3 of `.ai/plan_fractional_coo.md`, pulled forward because a Brief with only price findings looks like a feature, not a COO. |
| D4 | Data freshness | **Extend the seed with an August "refresh" file** (`supabase/demo-refresh-2026-08.sql`): 3 more invoices per price-watched supplier (dated 1–15 Aug, continuing the rise), ~40 August orders/invoices with 4–6 overdue, a stock count adjustment showing shrinkage on two lines, movements to today. Re-runnable, Meridian-scoped delete-first, same UUID scheme. | Seed tops out 2026-07-24; MTD KPIs read thin and Price Watch findings would say "last seen 24 days ago". This also strengthens the price series (6 points instead of 3) so detection is robust to the R1,000 annualised floor. Cheaper and safer than shifting dates across 74 tables. |
| D5 | Where does the demo run? | **Production Vercel (vyso.co.za) on the same Supabase project**, Meridian org only | The prospect must be able to log in from a link. Local/preview would need tunnels and a second DB. Meridian is already in prod DB (`demo@vyso.co.za`). |
| D6 | Loom vs live | **Loom first (day 2), self-serve link second (day 4–5)** | The Loom can be recorded once Phases A–B are done. The link needs C–F so nothing embarrassing is a click away. |
| D7 | Rand-figure honesty | Findings show only what `detect.ts`/`observe.ts` can prove; the Loom voice-over may **not** quote the marketing library's R58k/R82k numbers as if they were this org's | The Brief "only says what it can prove" (`lib/platform/agent-findings.ts` header). Mixing in the `lib/marketing/findings.ts` numbers would be the exact "silently empty brief is a lie" failure in reverse. |

---

## 2. Verified state (2026-08-17 audit; full report in the session, key facts only)

**Working & real:** The Brief (`app/app/page.tsx` ← `lib/platform/agent-findings.ts`, RLS-scoped,
no mocks); the chat-first shell (`components/platform/shell/*`, `GlobalChatDock`, `FinchChatProvider`);
Price Watch end-to-end (`lib/platform/price-watch/{normalize,match,detect,observe,run}.ts`,
148/148 tests, cron route, digest route, backfill CLI `scripts/backfill-price-watch.ts`);
all 9 modules DB-backed (WasteWatch has hardcoded analytics: `lib/platform/wastewatch.ts`
`HEATMAP`/`COST_TIMELINE`/`PREVENTABLE`/`INSIGHTS`); Meridian seed with price-rise invoices
(fish fillet +10.5 %, cooking oil 5L +13.1 %, cheese block +10.4 %, three dated invoices each,
in exactly the `documents.extracted_data.line_items` shape `run.ts:828-871` reads).

**Blockers:**
1. `npm run build` + `npx tsc --noEmit` fail on untracked `lib/platform/whatsapp-ingest.ts:4`
   (`extractOrderFromText` missing). Vercel builds from git so prod is unaffected, but no local
   build gate is possible and the WhatsApp WIP must not be committed as-is.
2. `vercel.json` is modified/uncommitted → the `price-watch` (03:45 UTC) and `digest`
   (Mon 04:00 UTC) crons are **not deployed**.
3. `PRICE_WATCH_ORG_IDS` and `PRICE_WATCH_DIGEST_TO` unset (locally and, as far as the repo
   shows, in Vercel) → cron no-ops, digest 503s.
4. Meridian has **zero** `pw_items`/`pw_price_points`/`agent_findings` rows → the Brief renders
   its empty state on login.
5. Only 4 chat tools on the `brief` module (`docu_find_documents`, `docu_get_document_summary`,
   `orderflow_outstanding_by_customer`, `orderflow_list_overdue_invoices`); no price-history,
   stock, or margin tool. "How has cooking oil moved?" cannot be answered.
6. Only one agent kind exists (price increases). No stock or debtor findings.
7. No invite flow / demo login; `SIGNUP_ENABLED=false`; demo password `1234` in seed header
   (SEC-05); features force-enabled all-true (`supabase-server.ts:156`, SEC-04 — acceptable
   for demo, must be known).
8. **No `/app/*` route has ever been visually verified in a real authenticated session** —
   the shell-w6 screenshots were a harness (`.ai/implementation.md` says so).
9. Local `.env.local` has no `SUPABASE_SERVICE_ROLE_KEY` → the backfill CLI cannot run
   locally; it must run via the deployed cron route with `CRON_SECRET`, or Josh adds the key
   locally for the session (and removes it after).

---

## 3. Phases

Effort is wall-clock for the implementer; "Josh" marks steps only Josh can do (dashboard,
Vercel env, recording). Order matters: each phase's exit gate is the next phase's precondition.

### Phase A — Unblock & deploy the agents (≈ 2 h; day 1 morning)

A1. **Quarantine the WhatsApp WIP** so main builds: `git stash push -u -- app/api/whatsapp
    lib/platform/whatsapp-* supabase/whatsapp-ingest.sql tests/whatsapp.test.ts
    docs/whatsapp-ordering.md` **or** move it to a branch `feat/whatsapp-ordering` (preferred —
    a stash is easy to lose). Do NOT delete. Also stash/branch the untracked
    `.ai/plan_demo-pricelist-fixes.md` + `public/serviceden-logo-concept.svg` and the modified
    `app/api/serviceden/outreach/drafts/route.ts`, `components/platform/serviceden/TodayOutreach.tsx`,
    `lib/platform/outreach-drafts.ts` if they're WIP (Josh confirms — they may be ready).
A2. **Commit `vercel.json` with only the two agent crons** (drop the `/api/whatsapp/process`
    line until that route exists on main). Message: `agents: deploy price-watch + digest crons`.
A3. Gates: `npx tsc --noEmit` clean, `npm run lint` (pre-existing wastewatch/vyso-ai exempt),
    `npm test` 148/148, `npm run build` passes locally.
A4. **Josh — Vercel env:** `PRICE_WATCH_ORG_IDS=01000000-7e5d-4c1a-9b3f-000000000001`
    (Meridian; add TnS's org id only if Josh wants TnS's own findings for TnS's own login),
    `PRICE_WATCH_DIGEST_TO=joshua@vyso.co.za` for now, confirm `CRON_SECRET`, `RESEND_API_KEY`,
    `ANTHROPIC_API_KEY` present. Add both new vars to `.env.example` with one-line comments.
A5. Push to `main` → Vercel deploy. Verify `GET /api/agents/price-watch` with
    `Authorization: Bearer $CRON_SECRET` returns `{ok:true, ran:1, …}` and the response summary
    (`linesSkipped*`, findings written) is sane. **Expected on first run against Meridian: 3
    price findings** (fish fillet, cooking oil, cheese) if the R1,000 annualised floor clears
    with the 44-day span; if 0, the reason is in the summary counters — do not lower thresholds,
    fix data in Phase B instead.

Exit: prod builds from main, crons deployed, Price Watch produces ≥ 1 real finding for Meridian.

### Phase B — Demo data that tells the story (≈ half day; day 1 afternoon)

B1. **`supabase/demo-refresh-2026-08.sql`** (new file, house style: Meridian-scoped delete
    preamble, deterministic UUIDs in a new group prefix, idempotent, no ALTERs):
    - 3 further invoices per price-watched supplier dated 2026-08-01/08/15, continuing the
      series (fish 168→171→174→176; oil 640→648→652→660; cheese 138→140→141→144). Same
      `extracted_data` shape as docs 1–9 (`fields[]` incl. "Invoice date", `line_items[]` with
      description/quantity/unit/unit_price/amount). One of them a **statement**? No — keep
      invoices only; statements were the artifact source on TnS.
    - One supplier that got **cheaper** (so Finch can say "and Cape Dairy dropped 4 % — leave
      them alone"): a 4-point falling series. Verifies detect's sign handling on demo data.
    - ~40 August `of_orders`/`of_invoices` (statuses mixed) so MTD revenue reads ~R2.8M by the
      17th; **5 invoices ≥ 30 days overdue** across 3 customers (one repeat offender with
      R180k+ outstanding — the "Bergsig Wholesale owes you R187k" card the site promises).
    - `pp_movements` to today for all 32 lines; two lines with a `count_adjustment` shrinkage
      (−8 %/−12 %) and one line whose cover drops below its `pp_stock_thresholds` minimum.
    - `sb_*`, `ww_waste_events` light August rows so ShiftBoard/WasteWatch don't look dead.
    Verification: assembler-style static check — every FK resolves to a blueprint id; revenue
    by month printed from the INSERT values; `grep -c 'Fresh Valley' = 0`.
B2. **Josh — paste into Supabase SQL editor** (prod project). Re-run `demo-all-in-one.sql`
    first ONLY if Meridian is in a bad state (it's destructive to Meridian rows only; Fresh
    Valley purge section is already a no-op).
B3. Re-run Price Watch (cron route). Wipe-and-rerun rule from `.ai/implementation.md`
    "Backfill diagnosis" applies if the first run's points are wrong: delete Meridian's
    `pw_price_points` + `agent_findings where agent='price_watch'`, keep `pw_items`/matches.
B4. **Read every finding out loud.** Each must be true against the invoices, sign-correct,
    rand impact defensible, observation text passing the number-fidelity validator (not the
    template fallback — check `observe.ts` path via the run summary). Anything wrong is a
    detector bug to fix, never a row to hand-edit.
B5. Trigger the digest route once → Josh receives the Monday email; screenshot it for the Loom.

Exit: Meridian's Brief shows ≥ 3 correct price findings with evidence links resolving to the
seeded invoices; digest email received; MTD KPIs non-empty.

### Phase C — Two more eyes: Debtors Watch + Stock Cover (≈ 1.5 days; day 2–3)

Both copy the Price Watch skeleton exactly: pure `detect.ts` with tests → `run.ts` writing
`agent_findings` (agent slug `debtors_watch` / `stock_cover`, `dedupe_key` per condition,
`evidence_refs` = the `of_invoices` ids / `pp_movements` ids — **note** `evidence_refs` is
typed as document ids and `agent-findings.ts` resolves them against `documents` for the
"3 invoices" noun; extend the resolver to fall back to `of_invoices` for debtors and to
say "stock line" for stock, rather than lying with "documents") → cron route under
`app/api/agents/<slug>/route.ts` (`CRON_SECRET`, `maxDuration`, service role, org allowlist
reusing `PRICE_WATCH_ORG_IDS` → rename to `AGENTS_ORG_IDS` with a fallback read of the old
name) → `vercel.json` entries → `brief-display.ts` labels/icons for the two new agent slugs.

C1. **Debtors Watch** (`lib/platform/debtors-watch/`): reuse `overdueInvoices` /
    `outstandingByCustomer` data fns from `lib/ai/finch/orderflow-data.ts` (lift the pure
    parts into `lib/platform/orderflow-debtors.ts` so both the chat tool and the agent share
    them). Finding rule: customer with ≥ 1 invoice > 30 days overdue **and** outstanding ≥
    R5,000, or ≥ 3 overdue invoices at any value; rand_impact = outstanding; recommended
    action = "Send a statement / hold further orders" (text only — drafts-only rule). One
    finding per customer, dedupe on `(customer_id, oldest_overdue_invoice_id)`.
C2. **Stock Cover** (`lib/platform/stock-cover/`): pure detect over `pp_stock_items` +
    `pp_stock_thresholds` + last-30-day `pp_movements`. Two rules: (a) days-of-cover < 3 at
    trailing consumption rate → "reorder before Thursday"; (b) `count_adjustment` shrinkage
    > 5 % of throughput on a line in 30 days → "count variance worth a look", rand_impact =
    shrinkage × unit cost. Dedupe on `(stock_item_id, rule, iso-week)`.
C3. Digest already reads all `agent_findings` — confirm it renders mixed kinds (max 5,
    ordered by rand_impact) and its subject line doesn't say "Price Watch".
C4. Tests: `tests/debtors-watch-detect.test.ts`, `tests/stock-cover-detect.test.ts` (pure
    detectors, table-driven, incl. the "no finding" cases). Gates as Phase A.
C5. Deploy, run both crons against Meridian, read every finding out loud (B4 rule).

Exit: the Brief opens on price + debtor + stock findings; all true against the seed.

### Phase D — Finch can answer the follow-ups (≈ 1 day; day 3–4)

Implements `.ai/plan_finch_read_tools.md` P1.2, scoped to what the Loom asks:

D1. `pw_get_price_history` — for an item/supplier name (fuzzy via `name-match.ts` against
    `pw_items`), return the dated `pw_price_points` series (normalised unit, basis) + first/
    last/Δ% + which invoices. Data fn in `lib/ai/finch/price-watch-data.ts`, RLS client.
D2. `pp_get_stock_position` — for a stock line: on hand, threshold, last 30 days movements by
    reason, days of cover. Data fn in `lib/ai/finch/procurepulse-data.ts`.
D3. `pw_margin_exposure` — "how is X impacting my margin": joins the price series to
    `pp_recipe_ingredients`/`pl_targets` where present, else answers with volume × Δprice
    only and *says* margin data isn't linked (truthful degradation, no invented margin).
D4. Add all three + the existing debtors tools to `TOOLS_BY_MODULE.brief`; knowledge doc
    additions in `lib/ai/finch/knowledge.ts` so the model knows what "a finding" is and that
    it must cite document ids it was given, never invent.
D5. Rehearse the four Loom questions (§4) against Meridian in a real session; tune knowledge
    text until answers are correct and cite the right invoices. Keep the 40/hr rate limit; the
    prospect will not hit it.

Exit: the four scripted questions answer correctly from live rows, with evidence.

### Phase E — Prospect access + guardrails (≈ 2 h; day 4)

E1. **Josh — Supabase dashboard:** create auth user `<prospect>@…` (or
    `demo+<prospect>@vyso.co.za`), auto-confirm, strong password; insert `profiles` row
    (`org_id` = Meridian, `role='admin'`, display name). Change `demo@vyso.co.za`'s `1234`
    password (SEC-05) — the seed header documents it and it's on the marketing screenshot chip.
E2. Confirm ServiceDen stays invisible (`SERVICEDEN_ACCOUNT_EMAIL` gate) and Settings can't
    do damage: check what `/app/settings` + `/app/organisation` let an admin change (org name,
    modules?) — decide whether the prospect is `admin` or we add a `viewer`-style read role for
    money. **Recommendation: admin, accept the risk, reset by re-seeding after each prospect.**
E3. Write `docs/demo-runbook.md`: how to (re)seed Meridian, run the three crons, create/revoke
    a prospect user, reset dismissed findings (`update agent_findings set status='new' where
    org_id=…`), the env vars, and the "never show TnS numbers" rule.
E4. Rate limits (`rate-limits.sql`, agent 40/hr) already exist — verify applied in prod via
    `verify-rls-state.sql`. Verify RLS on `agent_findings`, `pw_*` in prod (policies live in
    `agents-price-watch.sql`; Josh confirms it was applied).

Exit: a prospect user can log in, sees only Meridian, lands on a populated Brief.

### Phase F — First real-session verification of `/app/*` (≈ half day; day 4)

Nobody has ever screenshotted the real authenticated app (audit blocker 8). Do it now, in the
in-app browser (front the tab first — memory: screenshots come back black otherwise), logged in
as the prospect user against prod: Brief (desktop 1440 + mobile 390), tap-a-finding chat,
Doc-U document from an evidence link, OrderFlow customer with overdue invoices, ProcurePulse
stock line, PlanWise, one WasteWatch page (hardcoded `INSIGHTS`/heatmap — decide: hide the
Overview insight strip for the demo or leave; recommend hide behind a null-check when
`ww_*` has < N rows so it can't show a fake number), sign-out mid-stream, trial chip state
(Meridian is `tier 'scale'` — TrialGate must not lock). Fix what's broken; log results in
`.ai/verification/demo-mvp/` with real screenshots this time.

Exit: every screen the Loom touches and every screen one click away from it is verified.

### Phase G — Loom + case-study one-pager (≈ half day; day 5, Josh)

G1. Record the Loom per §4 against the prospect login (not `demo@`), 4–5 min.
G2. **Case study**: don't build a new page. Send `/case-studies/turn-n-slice` (public, already
    Finch-styled) + one paragraph on what the Operations Audit found there — with TnS's
    permission for any specific number, else keep it qualitative. Optionally a one-page PDF
    exported from that page.
G3. Send: Loom + case-study link + login (password via a separate channel) + one line: "Log
    in, tap the first card, ask it anything. Nothing in there sends anything — it's read-only
    on your side."

---

## 4. Loom script (≈ 4 min; each beat maps to a verified capability)

0:00 — Land on The Brief. "This is what your COO would hand you at 7am." Three cards visible:
      Riebeek Oils cooking-oil +13 % (≈ R X/yr on your volumes, 6 invoices), Bergsig
      Wholesale R187k > 30 days, Line fish cover 2 days.
0:40 — Tap the oil card. Finch: what happened, when, which invoices. Ask **Q1** "show me the
      three most recent Riebeek invoices" → `docu_find_documents` → click one → Doc-U shows the
      real PDF-shaped record and the line.
1:30 — Ask **Q2** "how has cooking oil moved this year and who else supplies it?" →
      `pw_get_price_history` (+ Cape Dairy fell 4 % as contrast). "It won't email the supplier
      for you — it drafts, you send." (Say it; don't demo it.)
2:15 — Ask **Q3** "who owes me money and how long?" → `orderflow_outstanding_by_customer` →
      one click to OrderFlow → the customer's overdue invoices.
2:50 — Ask **Q4** "what will I run out of this week?" → `pp_get_stock_position` → ProcurePulse
      stock line + count variance.
3:20 — 20 s "under the hood": rail expands, the modules are where the numbers live; PlanWise
      one glance.
3:40 — Monday digest email screenshot. "That's the month-free offer: we set this up on your
      invoices, you decide after 30 days."

Rule for the voice-over: every number said aloud is a number on screen from Meridian rows.

---

## 5. Risks & non-negotiables

- **Never show Turn 'n Slice supplier prices, customers, or invoices to a prospect.** Case
  study = narrative + permissioned quotes.
- **Drafts only.** No demo path may send email/WhatsApp. The digest goes to Josh's inbox only.
- **No hand-edited findings.** If a finding is wrong, the detector is wrong. Fix it or delete
  the row and say the Brief has two cards today.
- **WhatsApp WIP stays off main** until `extractOrderFromText` exists and its tests pass.
- SEC-04 (all modules force-enabled) is *fine* for the demo and *unchanged* by this plan;
  note it in `docs/demo-runbook.md` so nobody thinks module gating protects the prospect.
- Meridian is shared with any other prospect Josh gives access to; re-seed between prospects
  if one dismisses/edits heavily.
- Model spend: Price Watch match/observe calls are bounded by the seed size (< 100 lines);
  Finch chat capped 40/hr/user. Negligible.

---

## 6. Verification gates (every phase)

`npx tsc --noEmit` clean · `npm run lint` (pre-existing wastewatch/vyso-ai exempt) ·
`npm test` all green + new detector tests · `npm run build` passes · for B/C/E: findings read
aloud against source rows and recorded in `.ai/verification/demo-mvp/findings-review.md`
(finding → source invoice/order/movement → verdict) · for F: real screenshots.

---

## 7. Delegation map

| Phase | Who | Model tier |
|---|---|---|
| A1–A3, A5 | subagent (mechanical) | Sonnet/Opus |
| A4, B2, E1, G | **Josh** | — |
| B1 (refresh SQL) | subagent, styled on `demo-all-in-one.sql` sections 15a/13/… | Opus |
| B4, C5 (read findings aloud) | Fable + Josh | — |
| C1, C2, D1–D4 | one subagent per agent/tool set, tests first | Opus |
| F | Fable in the in-app browser | — |

## 8. Minimum-viable cut (if the prospect needs something in 48 h)

A + B + E1 + G with a **price-only** Brief and the existing 4 chat tools: Loom beats 0:00,
0:40, 2:15 (debtors via existing tool), 3:20, 3:40. Skip Q2/Q4. Send the self-serve link only
after C + D + F land — a link into an app that can't answer "how has this moved?" costs more
than it earns.
