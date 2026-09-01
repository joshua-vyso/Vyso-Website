# Plan: Stock & Suppliers — the real page (restructure Phase 1, UI portion)

**Parent:** `PLAN.md` §2.1 Page 1. **Directive from Josh (2026-09-01):** the stub's links-to-old-modules approach is rejected. Build a brand-new UI; the listed subpages are the ONLY pages for stock and suppliers. One task at a time — the ingestion-spine backend work (`/api/ingest`, domains, effects ledger) is NOT in this task.

**Worktree:** `.claude/worktrees/phase0-teardown-shell` (continue on `feature/phase0-teardown-shell`; Phase 0 commit 0b401de is the base). Dev preview is live on port 51110 against the REAL TnS Supabase — implementing agents must not mutate live data; verification is read-only page loads.

## Goal

Clicking "Stock & Suppliers" lands on a real dashboard headed "Stock & Suppliers", with tabs, all newly built on the platform design language (`--pf-*` tokens + `components/platform/module-ui.tsx` primitives), backed by the existing data layer. No link anywhere in the new page leads to `/app/procurepulse` or `/app/suppliers` — those old routes redirect INTO the new page.

## Route map (exactly these, nothing more)

| Tab | Route | Content |
|---|---|---|
| Dashboard | `/app/stock` | landing view |
| Market sheet | `/app/stock/market` | supplier price sheet + supplier categorisation |
| Stock | `/app/stock/levels` | stock levels |
| Suppliers | `/app/stock/suppliers` | supplier list + profiles incl. supplier credit notes |
| Manufacturing | `/app/stock/manufacturing` | warehouse-made products (recipes + batches) |
| Uploads | `/app/stock/uploads` (+ `/app/stock/uploads/[id]` detail) | upload + extraction-edit |

`app/app/stock/layout.tsx`: `ModuleHeader` (title "Stock & Suppliers") + `SubNav` with the six tabs (accent: default `--pf-accent`), mirroring the OrderFlow layout pattern (`app/app/orderflow/layout.tsx`) — server component, pages server-fetch and pass props (NO layout data provider, per the house rule in `lib/platform/orderflow-data.ts`).

## What each page shows (reuse the data layer, not the old screens)

**Dashboard (`/app/stock`)** — `KpiStrip`: stock items count + low-stock count (from `pp_stock_items` vs thresholds), active suppliers (`ss_suppliers`/`suppliers`), open supplier credits (`ss_supplier_credits`), spend MTD if cheaply available. Below, three `SectionCard`s: "Low stock" (worst N items, on-hand vs threshold), "Recent price changes" (`ss_supplier_pricing` or `pp_item_suppliers` latest deltas — whichever the existing fetchers serve most directly), "Recent stock documents" (latest `documents` of types invoice/delivery_note/price_list/statement, linking to `/app/stock/uploads/[id]`). Reuse fetchers from `lib/platform/procurepulse-queries.ts`, `supplysync-data.ts`, `supplysync-credits.ts`, `documents.ts`; missing tables degrade to empty (`db-errors.ts` pattern).

**Market sheet (`/app/stock/market`)** — one `DataTable`: product/item rows × latest price per supplier (source: `ss_supplier_pricing` joined to supplier names; fall back to `pp_item_suppliers` where that is the richer source — implementer reads both fetchers and picks the one with real coverage, documenting the choice). Columns: item, best price + supplier, latest price per top suppliers, trend. Plus a "Suppliers by category" section: group `ss_suppliers` by the existing `category` column (text, not null — no migration needed) with inline category re-assignment (PATCH via a new thin route `app/api/stock/supplier-category/route.ts` that updates `ss_suppliers.category` under RLS with `getPlatformSession()` + owner/admin check; keep it ~40 lines, following an existing small route like `app/api/procurepulse/thresholds`).

**Stock (`/app/stock/levels`)** — `DataTable` over `pp_stock_items`: name, category, pack/unit, on-hand, threshold, avg price, cheapest supplier; low-stock rows badged (`Badge` tone warning/critical). Threshold edit reuses `POST /api/procurepulse/thresholds`. Search/filter client-side. Counts/adjustments beyond thresholds are OUT of scope (no new mutation surfaces this task).

**Suppliers (`/app/stock/suppliers`)** — supplier `DataTable` (`ss_suppliers` merged with `suppliers` the way `supplysync-data.ts` already does): name, category, status, rating/score, last order, spend MTD. Row click opens a NEW profile panel (build fresh; do not mount the old `SupplierProfileDrawer`) showing contacts, pricing history for that supplier, and a **Supplier credit notes** section fed by `ss_supplier_credits` (+ documents of type `supplier_credit_note` linking to `/app/stock/uploads/[id]`). Read-only except nothing — fully read-only this task.

**Manufacturing (`/app/stock/manufacturing`)** — recipes list (`pp_recipes` + ingredients) and batches log (`pp_batches` + `pp_batch_ingredients`), newly rendered with `SectionCard`/`DataTable`. Batch logging reuses the EXISTING API (`POST /api/procurepulse/batch`) with a new simple form (item = recipe, quantity, date) — do NOT mount the old `BatchLogger` (it has chat coupling). If the batch API's contract is awkward for a simple form, ship the read-only views and report the mutation as a deviation rather than forcing it.

**Uploads (`/app/stock/uploads`)** — the upload tray + recent documents, rehomed: reuse `lib/platform/docu/upload-client.ts` (`useUploadBatch`, `uploadDocument`, `startExtraction` → existing `/api/ai/extract`; the `/api/ingest` unification is a later task) with a NEW page shell (drop zone + file list + status), then a documents table (latest 50, all types) with status/confidence pills (`StatusPill`, `ConfidenceText`). Row click → `/app/stock/uploads/[id]` — a new page hosting the EXISTING `DocumentDetailPanel` (the five review arms: OrderReviewEditor/ReceiptReviewCard/CreditReviewCard/AmendmentReviewCard/ExtractionEditor) exactly as `app/app/docu/[id]/page.tsx` does — copy that page's data loading, render DocumentDetailPanel unchanged. Signed URLs via the existing pattern.

## Rewiring & redirects

- `components/platform/shell/UploadButton.tsx`: href → `/app/stock/uploads`.
- `app/app/procurepulse/**`: replace EVERY page with `redirect()` — `stock`→`/app/stock/levels`, `stock/[id]`→`/app/stock/levels`, `recipes*`→`/app/stock/manufacturing`, everything else→`/app/stock`. Delete the procurepulse layout's SubNav rendering or keep layout as passthrough (simplest: make `app/app/procurepulse/layout.tsx` return children and each page a redirect). Keep `components/platform/procurepulse/*` and all `/api/procurepulse/*` routes (APIs are reused).
- `app/app/suppliers/**`: same — `credits`→`/app/stock/suppliers`, everything→`/app/stock/suppliers`. Keep `components/platform/supplysync/*` and lib.
- Delete `app/app/stock/page.tsx`'s PhaseStub usage (replaced by dashboard). `PhaseStub.tsx` stays for the other pages.
- Do NOT touch the other stubs, `/app/docu`, `/app/orderflow`, chat, or nav-config (routes unchanged).

## Constraints

- New UI files live in `components/platform/stock/` (new dir). Use `module-ui.tsx` primitives + `--pf-*` tokens; NO hardcoded hexes beyond what module-ui itself uses; house "why" comments.
- Server components by default; `'use client'` only for interactive leaves (tables with search, forms, upload tray).
- No schema changes, no SQL to paste, no service-role usage, no new heavy deps.
- Live TnS data: read-only verification. Never trigger mutations against prod in testing (no threshold saves, no batch posts, no category writes during verification).
- Chat code stays frozen (Phase 0 rule continues).

## Acceptance criteria

1. `/app/stock` = real dashboard with live numbers (TnS org shows its ~800 products, actual suppliers).
2. All six tabs render real data; empty tables degrade gracefully (`EmptyState`-style message, not a crash) for org states with missing tables.
3. No link/button in the new pages navigates to `/app/procurepulse` or `/app/suppliers`; those URLs redirect into `/app/stock/*`.
4. Upload works end-to-end from `/app/stock/uploads` (tray → extract → document appears → detail page opens with the correct review arm).
5. `npx tsc --noEmit` clean · `npm run lint` no new errors vs 82 baseline · `npm test` all pass · `npm run build` succeeds.

## Ordered steps

1. Agent 1: layout + Dashboard + Stock levels + Manufacturing (ProcurePulse data half). Creates `app/app/stock/layout.tsx` FIRST.
2. Agent 2 (parallel): Market sheet + Suppliers + supplier-category route (SupplySync data half). Owns only its files; does not touch layout.
3. Agent 3 (after 1+2): Uploads + `[id]` detail + UploadButton retarget + old-route redirects + full verification + `.ai/implementation_stock_suppliers_page.md`.

## Verification commands

```
npx tsc --noEmit
npm run lint
npm test
npm run build
```
Plus read-only preview checks on port 51110 (Josh is logged in as TnS): each tab loads, dashboard numbers non-zero, old URLs redirect.
