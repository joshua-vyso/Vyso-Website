# Implementation — Stock & Suppliers: the real page

**Plan:** `.ai/plan_stock_suppliers_page.md` (parent: `PLAN.md` §2.1 Page 1; directive from Josh 2026-09-01 — the
stub's links-to-old-modules approach rejected, build a brand-new UI).
**Worktree:** `.claude/worktrees/phase0-teardown-shell`, branch `feature/phase0-teardown-shell`, base = Phase 0
commit `0b401de`.
**Status:** all three agents' work complete. **Nothing committed.**

Built by three agents: A1 (layout + Dashboard + Stock + Manufacturing), A2 (Market sheet + Suppliers + the category
route), A3 (Uploads + `[id]` detail + rewiring + redirects + verification + this document).

All four verification commands pass (details at the end).

---

## Route map as shipped

| Tab | Route | Page file |
|---|---|---|
| Dashboard | `/app/stock` | `app/app/stock/page.tsx` |
| Market sheet | `/app/stock/market` | `app/app/stock/market/page.tsx` |
| Stock | `/app/stock/levels` | `app/app/stock/levels/page.tsx` |
| Suppliers | `/app/stock/suppliers` | `app/app/stock/suppliers/page.tsx` |
| Manufacturing | `/app/stock/manufacturing` | `app/app/stock/manufacturing/page.tsx` |
| Uploads | `/app/stock/uploads` | `app/app/stock/uploads/page.tsx` |
| — document review | `/app/stock/uploads/[id]` | `app/app/stock/uploads/[id]/page.tsx` |

Exactly the plan's six tabs, nothing more. `app/app/stock/layout.tsx` is the shared chrome: `ModuleHeader`
("Stock & Suppliers") + `SubNav`, default `--pf-accent`, modelled on `app/app/orderflow/layout.tsx`. **No layout data
provider** — every page server-fetches and passes props, per the house rule stated in `lib/platform/orderflow-data.ts`.
The module identity is hard-coded rather than read from `MODULE_META`, because there is no `stock` module key and the
existing entries still describe the old ProcurePulse/SupplySync modules.

`SubNav` prefix-matches, so `/app/stock/uploads/<id>` keeps the Uploads tab underlined.

---

## Files

### Created

**Data layer**
- `lib/platform/stock-data.ts` (400 lines) — the narrow server fetchers the merged module needs and the old module libs
  don't already provide. Pure row-building (`buildStockRows`, `lowStockFirst`, `effectiveLowThreshold`) plus
  `fetchSupplierSummary`, `fetchOpenSupplierCredits`, `fetchRecentPriceChanges`, `fetchRecentStockDocuments`,
  `fetchUploadedDocuments`, `fetchBatches`, `fetchBatchIngredients`. Every read degrades to `[]`/zero on a missing
  table. `procurepulse-queries.ts` keeps owning the `pp_*` catalogue reads and is reused unchanged.

**Pages**
- `app/app/stock/layout.tsx`, `app/app/stock/levels/page.tsx`, `app/app/stock/manufacturing/page.tsx`,
  `app/app/stock/market/page.tsx`, `app/app/stock/suppliers/page.tsx`, `app/app/stock/uploads/page.tsx`,
  `app/app/stock/uploads/[id]/page.tsx`

**Components** — all new, all in `components/platform/stock/`, all on `module-ui.tsx` primitives + `--pf-*` tokens
- `DashboardCards.tsx`, `StockLevelsTable.tsx`, `ManufacturingView.tsx`, `LogBatchForm.tsx` (A1)
- `MarketSheet.tsx`, `MarketSupplierCategories.tsx`, `SupplierDirectory.tsx`, `SupplierProfilePanel.tsx` (A2)
- `UploadDropZone.tsx`, `UploadDocumentsTable.tsx` (A3)

**API**
- `app/api/stock/supplier-category/route.ts` (78 lines) — PATCH `ss_suppliers.category` under the caller's own RLS
  session, `getPlatformSession()` + `canSeeMoney` owner/admin gate, no service role, no ownership lookup (the
  `org_id` predicate makes another org's supplier a 404).

### Edited

- `app/app/stock/page.tsx` — PhaseStub replaced by the real dashboard.
- `components/platform/shell/UploadButton.tsx` — `href` → `/app/stock/uploads`, docblock rewritten to say why it moved.
- `lib/platform/agent-findings.ts`, `app/app/finding/[id]/page.tsx`, `components/platform/brief/EvidenceList.tsx` —
  straggler links (see below).
- 20 page files + 3 layouts under `app/app/procurepulse/**` and `app/app/suppliers/**` — now redirects/passthroughs.

Net: **229 insertions, 1461 deletions** across the tracked files, plus ~3,500 lines of new untracked module code.

---

## Fetcher and source decisions

**Market sheet price source: `pp_item_suppliers`, not `ss_supplier_pricing`.** The plan left this to whichever table
had real coverage, and only one does. `ss_supplier_pricing` has **no production write path** — the only inserts in the
repo are `supabase/demo-all-in-one.sql` and `supabase/demo-fresh-valley/*` — so on a live org it is empty and a market
sheet built on it renders a perfect, blank table. `pp_item_suppliers` is written by the document feed on every scan
(`lib/platform/procurepulse-feed.ts` upserts the seller's latest price per item and recomputes
`pp_stock_items.cheapest_supplier`). It is one row per (item, supplier) holding the latest price — the shape the sheet
needs. Read through the existing `fetchPrices`/`fetchStock`.

**Recent price changes: `ss_supplier_pricing` after all — because it is the only table that can express a delta.**
The two decisions are not in conflict. `pp_item_suppliers` is upserted **in place**, so it holds a current price and no
history at all; a "change" cannot be derived from it without a movements-style ledger that does not exist.
`ss_supplier_pricing` stores `previous_price` beside `current_price`, which is exactly what the dashboard card prints.
So: current prices from the feed's table, deltas from the tracked one, each labelled on screen.

**Suppliers list: both supplier tables, merged, with the third case added.** `suppliers` (core — what a filed document
points at) and `ss_suppliers` (the SupplySync profile) are bridged by `ss_suppliers.supplier_id`
(`supabase/supplysync-link.sql`), the way `lib/platform/supplysync-data.ts` already reads them. The new page merges the
same way and then adds the case that fetcher has no reason to care about: **a core supplier with no profile yet still
gets a row, marked as such** — "who do we buy from" must not depend on whether the feed has invented a profile.
`getSupplySyncData` does not expose `supplier_id`, so the bridge is read alongside it (three columns, one query) rather
than widening a type the whole SupplySync module depends on.

**Thresholds: whole rows go back.** `POST /api/procurepulse/thresholds` upserts complete rows and nulls any column the
body omits, so `StockRow.thresholdRow` carries par level, lead time and freshness through the page purely so the inline
editor can hand them back untouched. A save that sent only `low_threshold` would silently wipe somebody's settings.

**Manufacturing batches: server fetchers, not the client API.** ProcurePulse read `pp_batches` from the browser through
`GET /api/procurepulse/batch`, which a server page cannot call — hence `fetchBatches`/`fetchBatchIngredients` in
`stock-data.ts`. Ingredient lines are scoped to the batch ids just read rather than the whole org.

**Uploads table: all types, and `extracted_data` deliberately not selected.** `fetchUploadedDocuments` is a separate
fetcher from `fetchRecentStockDocuments` (which filters to `STOCK_DOCUMENT_TYPES` for the dashboard card) because this
table is the receipt for "did my upload land?" — hiding the expense receipt somebody just dropped, on the grounds that
it isn't a stock document, reads as a lost file. Type is a column instead. `extracted_data` is left out of the
projection: fifty documents' worth of line items is a large RSC payload for one string per row, so the type column
prints the built-in `DOC_TYPE_LABEL` and a user's `custom_type` shows correctly on the detail page one click away.
`superseded_at is null` matches every live Doc-U list.

**Uploads KPIs reuse `computeKpis`** from `lib/platform/documents.ts` rather than recounting, so "awaiting review" and
"needs attention" cannot come to mean two different things on two screens. Its `awaiting` (extracted + pending) is
*split* into "Being read" (pending) and "Awaiting review" (extracted) rather than shown alongside a pending count —
this tab is asked "is my upload still being read?" more than anything else, pending and extracted are opposite answers
to it, and splitting means no document is counted in two tiles. Every tile counts the fifty on screen and says so.

---

## Uploads — the tray, and what it reuses

`app/app/stock/uploads/page.tsx` is a new shell: KPI strip → "Add documents" `SectionCard` holding `UploadDropZone` →
`UploadDocumentsTable`. **The upload path underneath is entirely existing code** — `useUploadBatch` from
`components/platform/docu/UploadStagingTray.tsx`, over `uploadDocument`/`startExtraction` in
`lib/platform/docu/upload-client.ts`, hitting the existing `/api/ai/extract`. No second copy of "Storage object, then a
`pending` documents row, then kick extraction" was written; that duplication is exactly what that file's header exists
to prevent, and the `/api/ingest` unification is a later task.

Two behavioural differences from `app/app/docu/upload/page.tsx`, both deliberate:

1. **It does not navigate away.** Doc-U's uploader pushes to `/app/docu/recent` because that is where its documents
   become visible; here the list is on the same screen, so a finished batch calls `router.refresh()` and the new rows
   appear in place.
2. **Refresh is a button, not a subscription.** Extraction is fired and abandoned (`startExtraction` with `keepalive`),
   so a row is `pending` until the server finishes. Doc-U's inbox subscribes to `documents` *and* polls; putting a
   second realtime channel on this screen was not worth it when its main event already refreshes the page. The button
   covers the minute after an upload and says what it does.

**Deviation (documented):** the staging-tray **rows** are Doc-U's `UploadStagingTray` component, mounted unchanged,
rather than a token-styled rebuild — the one place the module's "new JSX on `--pf-*` tokens" rule is not honoured
literally. Its palette (`#EAEDF2`, `#1F5FA8`, `#174C87`, `#8A8E86`, `#A0A49C`) is byte-for-byte what `--pf-border`,
`--pf-accent-strong`, `--pf-accent-deep`, `--pf-text-muted` and `--pf-text-faint` resolve to in `app/globals.css`, so a
copy would render identically while giving "Uploading…" two places to be wrong. The drop zone around it — the part that
is actually this module's — is written in tokens.

`app/app/stock/uploads/[id]/page.tsx` is `app/app/docu/[id]/page.tsx` rehomed, almost line-for-line: the same twelve
parallel reads, the same typeahead catalogue assembly, the same Hubdoc gate, and **`DocumentDetailPanel` rendered
unchanged** so all five review arms (order / receipt / credit / amendment / generic extraction editor) behave
identically. Nothing under `components/platform/docu/` was modified. Two intentional differences: the not-found escape
hatch and the back link point at `/app/stock/uploads`, and the page does **not** wrap itself in
`h-full overflow-y-auto` — Doc-U's copy is the whole route, this one renders inside the stock layout's header and tab
row, and its own scroll container would strand the tabs above a second scrollbar.

The fan-out is duplicated rather than factored into a shared helper on purpose: the later ingestion-spine task collapses
the two doors into `/api/ingest`, and extracting a lib function now would be refactoring something about to move. Both
copies read the same tables in the same order, so a schema change breaks them together and loudly.

`DocumentDetailPanel`'s own internal links still point into `/app/docu/*`, and that is left alone as instructed —
Doc-U is not one of the modules this restructure replaced, and those screens are still there.

---

## Redirects

Every page under `app/app/procurepulse/**` and `app/app/suppliers/**` is now a five-line `redirect()` with a one-line
why-comment. `redirect()` from `next/navigation` per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`
— 307/replace, **not** `permanentRedirect`: a 308 cached in every browser is not something to hand out while the IA is
still moving.

| Old route | → |
|---|---|
| `/app/procurepulse` · `/products` · `/reorder` · `/counts` · `/intelligence` · `/alerts` · `/notifications` · `/settings` | `/app/stock` |
| `/app/procurepulse/stock` · `/stock/[id]` | `/app/stock/levels` |
| `/app/procurepulse/recipes` · `/recipes/[id]` · `/recipes/batches` | `/app/stock/manufacturing` |
| `/app/suppliers` · `/list` · `/performance` · `/pricing` · `/credits` · `/risk` · `/history` | `/app/stock/suppliers` |

**Three layouts became passthroughs** (`return children`): `app/app/procurepulse/layout.tsx`,
`app/app/procurepulse/recipes/layout.tsx`, `app/app/suppliers/layout.tsx`. Necessary, not cosmetic — the ProcurePulse
layout drew a nine-tab `PpSubnav` pointing at routes that now only redirect, and the SupplySync layout ran
`getSupplySyncData` (ten queries) to fill a seven-tab chrome, which would have made the slowest screen in the platform
out of one that no longer draws anything.

**Kept, as the plan requires:** every file under `components/platform/procurepulse/` and
`components/platform/supplysync/`, every `/api/procurepulse/*` route, and `lib/platform/supplysync-*.ts` — the new
screens reuse the APIs and the lib. The directories themselves are kept so old bookmarks, emailed links and findings
hrefs forward instead of 404ing. The two `loading.tsx` files are untouched (they are neither pages nor layouts, and
`redirect()` answers a hard navigation with a 307 before any HTML is streamed).

---

## Straggler sweep

`grep` for `/app/procurepulse` and `/app/suppliers` across `app/`, `components/`, `lib/`.

**Fixed (live surfaces):**
- `lib/platform/agent-findings.ts:422` — the Brief's stock-evidence href was `/app/procurepulse/stock/<id>`, now
  `/app/stock/levels`. The restructure gave the catalogue one searchable tab and no per-product screen.
- `app/app/finding/[id]/page.tsx:197` — the same href on the finding detail page, same target.
- `components/platform/brief/EvidenceList.tsx:37` — docblock example updated to match.

**Found and deliberately left (reported, not changed):**
- `lib/platform/modules.ts` — `screens.desktop` for the procurepulse and supplysync registry entries still reads
  `/app/procurepulse` and `/app/suppliers`. Two live consumers: `firstOpenableModuleHref` (where a member bounced off
  the Brief lands) and `components/platform/docu/RoutingCard.tsx`'s "Synced ✓" link. Both now land on a redirect, so
  both work. Not changed because the same field also drives `moduleForPathname` (FinchBubble's header), the public
  `/platform/modules/[slug]` marketing pages and `lib/platform/docu/routing.ts`, and the plan explicitly keeps routes
  and nav-config out of scope. **This is the one place a user-visible link still traverses a redirect.**
- `components/platform/docu/RoutingCard.tsx` — renders that href; frozen (`components/platform/docu/` is off-limits
  this task).
- `lib/ai/finch/module-route.ts` and `tests/finch-module-route.test.ts` — frozen chat/Finch code, Phase 0 rule.
- `components/platform/procurepulse/*` and `components/platform/supplysync/*` (`ui.tsx`, `Chrome.tsx`,
  `ManufacturingSubnav.tsx`, `LiveStockView.tsx`, `RecipeEditor.tsx`, `RecipesView.tsx`, `Overview.tsx`, `Pricing.tsx`,
  `CompareDrawer.tsx`) — kept on disk per the plan and now unmounted; nothing renders their hrefs.

No link or button in the six new pages navigates to `/app/procurepulse` or `/app/suppliers` (plan acceptance
criterion 3).

---

## Deviations

1. **Staging-tray rows reuse `UploadStagingTray`** rather than being rebuilt on tokens — see the Uploads section for
   the reasoning (identical rendered output, one state machine).
2. **Batch date rides in `notes`.** `POST /api/procurepulse/batch` has no date field — `pp_batches.created_at` is
   stamped server-side — so `LogBatchForm` records a back-dated run in its note rather than silently filing it as today
   with no trace. The plan allowed shipping the batch views read-only if the API's contract was awkward; the mutation
   was shipped instead, with this one honest compromise.
3. **`LogBatchForm`'s quantity means batches, not output units.** The recipe states what one batch consumes and
   produces, so a batch count is the one input that cannot contradict it; an output quantity would leave ingredient
   amounts to be reverse-engineered from a divide that breaks whenever `output_qty` is null.
4. **`fetchUploadedDocuments` was added to `lib/platform/stock-data.ts` by A3**, i.e. into a file A1 created. Purely
   additive — no existing fetcher was changed. It is the only edit A3 made to another agent's file; no integration
   fixes to A1's or A2's code were needed.
5. **No feature gate on the stock module.** The layout gates on the session alone. Gating the Uploads tab on `docu`
   (whose extraction it uses) or the others on `procurepulse` would turn tabs of one live module into dead ends; the
   queries are RLS-scoped and degrade to empty instead.

---

## Verification

Run in the worktree, 2026-09-01.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **clean**, no output |
| `npm run lint` | **81 problems (44 errors, 37 warnings)** — one *below* the 82-problem baseline (a deleted ProcurePulse page carried one); **no new problems**, nothing in `app/app/stock/**`, `components/platform/stock/**`, `app/api/stock/**` or `lib/platform/stock-data.ts` |
| `npm test` | **1514 / 1514 pass**, 0 fail |
| `npm run build` | **succeeds** — `✓ Compiled successfully`; all seven `/app/stock*` routes and all 20 redirect routes present as `ƒ` (dynamic) |

`.env.local` in the worktree is already a symlink to the main checkout's (created with the dev preview at 09:20, before
this task). It was left in place rather than removed, because the dev server on port 51110 is running out of this
worktree and depends on it. **The main checkout was not modified.**

**Read-only preview checks** against the running dev server on port 51110, unauthenticated (`curl`, no login, no
mutation, no extraction triggered):

```
/app/stock                          307 → /login
/app/stock/levels                   307 → /login
/app/stock/market                   307 → /login
/app/stock/suppliers                307 → /login
/app/stock/manufacturing            307 → /login
/app/stock/uploads                  307 → /login
/app/stock/uploads/<uuid>           307 → /login
/app/procurepulse                   307 → /login
/app/procurepulse/stock             307 → /login
/app/procurepulse/recipes           307 → /login
/app/procurepulse/products          307 → /login
/app/suppliers                      307 → /login
/app/suppliers/credits              307 → /login
/app/docu/upload                    307 → /login
```

Every route compiles and renders (a compile error would be a 500). The `/login` target is the proxy's auth guard, which
runs ahead of the page — so these checks confirm compilation and reachability, **not** the redirect targets, which
cannot be observed without a session. The targets are verified by reading the twenty redirect files and by the build's
route manifest.

**Not verified, and needs Josh's eyes on a logged-in TnS session:** acceptance criteria 1, 2 and 4 — that the dashboard
shows TnS's real numbers (~800 products, actual suppliers), that all six tabs render live data, and that an upload runs
end-to-end from `/app/stock/uploads` through extraction to the correct review arm on the detail page. No agent logged
in and no extraction was triggered, per the live-data rule.

---

## Addendum (2026-09-01) — the global Upload button gets its own page

**Plan:** `.ai/plan_global_uploads_page.md`. **Directive from Josh:** the shell's global Upload button must not land on
Stock's uploads tab — it needs a standalone page for all things ingestion, decoupled from any one module. Stock keeps
its `/app/stock/uploads` tab exactly as shipped above; it becomes the domain-scoped view once `documents.domain` lands
with the spine.

### Files

**Created**
- `app/app/uploads/page.tsx` — standalone list page. Own `ModuleHeader` (icon `docu`, title "Uploads") since the route
  has no `layout.tsx` of its own; everything below the header is the Stock Uploads composition unchanged (KPI strip via
  `computeKpis`, `UploadDropZone`, `UploadDocumentsTable`), reading `fetchUploadedDocuments` the same way.
- `app/app/uploads/[id]/page.tsx` — standalone document-review page. Back-link and not-found link both point to
  `/app/uploads`. Uses an `h-full overflow-y-auto px-8 py-7` wrapper (the Doc-U pattern), not the Stock copy's bare
  `<div>` — this route sits directly under the shell's `<main>` with no layout header/tabs to strand.
- `lib/platform/document-detail.ts` — new shared loader, `loadDocumentDetail(supabase, session, id)`. See "Sharing
  approach" below.

**Edited**
- `app/app/stock/uploads/[id]/page.tsx` — gutted to call `loadDocumentDetail` instead of carrying its own copy of the
  twelve-query fan-out. Its own not-found screen, back-link (`/app/stock/uploads`) and bare-`<div>` wrapper (no local
  scroll container, so the stock layout's tabs don't get stranded above a second scrollbar) are unchanged.
- `components/platform/stock/UploadDocumentsTable.tsx` — added an optional `detailHrefBase` prop (default
  `'/app/stock/uploads'`, so the existing Stock call site is unchanged); a row's link is now
  `` `${detailHrefBase}/${d.id}` `` instead of a hard-coded `/app/stock/uploads/${d.id}`. The global page passes
  `detailHrefBase="/app/uploads"`.
- `components/platform/shell/UploadButton.tsx` — `href` changed from `/app/stock/uploads` to `/app/uploads`; docblock
  rewritten to explain the second move (Stock's tab → global page) and why the button now points at neither Stock nor
  Doc-U.

**Untouched, as required:** `components/platform/docu/DocumentDetailPanel.tsx` and everything else under
`components/platform/docu/`; `app/app/docu/[id]/page.tsx` still carries its own independent copy of the fan-out (see
below for why); `app/app/stock/uploads/page.tsx` (the list page) — no changes at all, not even the table's default
prop, since the new prop's default preserves its existing call site verbatim.

### Sharing approach for the `[id]` loader

The plan flagged this as a judgement call: `app/app/stock/uploads/[id]/page.tsx` is ~270 lines, of which roughly 200 is
a twelve-query parallel fan-out (sibling documents, folders, `pp_movements`, units, OrderFlow customers, linked order,
catalogue, name aliases, company profile, VAT settings, billed customer, signed preview URL) plus the typeahead-catalogue
assembly and the Hubdoc-eligibility check that follows it — all of it existing purely to build `DocumentDetailPanel`'s
props. Duplicating that a second time for `/app/uploads/[id]` would have made it a *third* copy in the codebase
(Doc-U's `[id]` page already carries the same fan-out independently), so it was extracted into
**`lib/platform/document-detail.ts`**, a new small module — not folded into `lib/platform/stock-data.ts`, because that
file's own docblock scopes it to "the narrow server fetchers the merged [Stock & Suppliers] module needs," and this
loader isn't stock-specific: it's a generic document-review loader now shared between Stock's `[id]` route and the
global Uploads `[id]` route.

`app/app/docu/[id]/page.tsx` was deliberately **left with its own copy**, not folded into the shared loader. Its own
docblock already explains why: the plan behind it treats that duplication as temporary, dissolving once the ingestion
spine unifies the two upload doors behind `/api/ingest`, and refactoring it now would mean refactoring code that's
about to move anyway. That reasoning doesn't extend to a fresh second-and-third copy being added today for two routes
with no such pending unification, so `loadDocumentDetail` has exactly two callers (Stock's `[id]` and the new global
`[id]`) and Doc-U's route is untouched.

`loadDocumentDetail(supabase, session, id)` returns `DocumentDetailData | null` (`null` = not found, matching each
page's own not-found screen) — everything `DocumentDetailPanel` needs except `doc` folded separately for the
not-found check and `features`, which every caller already has on hand via `session.features` before it needs to
render anything.

### Verification

All four commands pass, plus the two new curl checks:

```
npx tsc --noEmit        clean
npm run lint            81 problems (44 errors, 37 warnings) — identical to the stated baseline; none in touched/new files
npm test                1514 pass, 0 fail
npm run build           exit 0; /app/uploads and /app/uploads/[id] both listed as ƒ (dynamic) routes
```

```
/app/uploads                                    307 → /login
/app/uploads/00000000-0000-0000-0000-000000000000   307 → /login
```

Both against the running dev server on port 51110, unauthenticated, no login attempted, no mutation, no extraction
triggered.
