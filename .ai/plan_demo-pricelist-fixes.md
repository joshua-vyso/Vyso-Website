# Plan: Demo-day fixes — Doc-U header overlap + price-list picker with order-wide re-pricing

Date: 2026-08-04 (demo today — keep changes surgical, no refactors)

## Goal
Three fixes visible in today's demo (Meridian Food Co. / Fresh Valley demo org):

1. Doc-U line-items editor: "UNITS/BOX" and "UNIT PRICE" column headers no longer collide.
2. Doc-U order-review screen ("from list" unit-price fields) actually offers the org's price
   lists in a picker.
3. Selecting a price list on ANY line applies that price list to the ENTIRE order: every line
   that can be matched to a product is re-priced from that list. Also surface an order-level
   price-list picker in OrderFlow's own order editing (builder / OrdersView), defaulting to the
   customer-derived list, with the same re-price-all behavior on change.

## Acceptance criteria
- [ ] In Doc-U document capture (invoice line-items editor, `ExtractionEditor.tsx`), all seven
      headers render with visible gaps at the panel's real width. No text overlap.
- [ ] In Doc-U order review (`OrderReviewEditor.tsx`), each line's unit-price cell exposes a
      dropdown listing ALL `pl_price_lists` rows for the org (name shown), plus manual numeric
      entry still works exactly as before.
- [ ] Picking a list in any line's dropdown sets one order-level selected price list and
      immediately re-prices ALL lines whose description matches a product (same matching the
      server uses in `orderflow-from-doc.ts`), via `resolvePrice(product, list, overrides)`.
      Unmatched lines keep their current value. A manually-typed price entered AFTER the list
      was applied is kept for that line (typing does not clear the order-level selection).
- [ ] The selected price list is persisted so it survives save/confirm (store `price_list_id`
      in the document's extracted order payload; `syncOrderFromDocument` must prefer it over
      the customer-derived list when filling blank prices — small, guarded change).
- [ ] In OrderFlow order editing (`builder.tsx` "Pricing from …" area and the OrdersView edit
      flow), the read-only pricing label becomes a `<select>` of all org price lists,
      initialized to `customerPriceList(...)`; changing it re-prices lines using the existing
      `pickCustomer`-style loop (skip lines with manual override notes, same as today).
- [ ] `npx tsc --noEmit` passes; `npm run lint` (if configured) passes; `npm run build` succeeds.

## Files to modify (no new files except this plan / implementation notes)
1. `components/platform/ExtractionEditor.tsx`
2. `app/app/docu/[id]/page.tsx`
3. `components/platform/docu/DocumentDetailPanel.tsx`
4. `components/platform/docu/OrderReviewEditor.tsx`
5. `lib/platform/orderflow-from-doc.ts` (export the existing product-matching helper for client
   reuse if needed; honor persisted `price_list_id`)
6. `components/platform/orderflow/builder.tsx`
7. `components/platform/orderflow/OrdersView.tsx`
8. `lib/platform/orderflow-data.ts` ONLY if the builder context doesn't already carry all price
   lists (report says it does — `priceLists: CdPriceList[]`).

## Constraints / do NOT touch
- No schema/SQL changes. `pl_price_lists`, `pl_overrides`, and demo seeds
  (`supabase/demo-fresh-valley/8-pricepilot-seed.sql`) already exist and are correct.
- No changes to `lib/platform/coredata.ts` logic (`customerPriceList`, `resolvePrice`) beyond
  imports/exports.
- Do not restyle anything beyond the header-collision fix. Match existing Tailwind idioms
  (fixed-track grids, `text-[11px] uppercase tracking-[0.06em]`, etc.).
- Keep the "from list" placeholder semantics: an empty price still reads "from list".

## Ordered implementation steps

### Step 1 — Header collision (Bug 1)
File: `components/platform/ExtractionEditor.tsx`
- Line ~23: `const COLS = 'grid grid-cols-[1fr_64px_48px_70px_56px_76px_88px_24px] gap-2 items-center';`
- Widen the 5th track (Units/box) from `56px` to `80px` (1fr Description column absorbs it).
- Add overflow protection to the header spans (lines ~195–204): `min-w-0` on each span plus
  `overflow-hidden text-ellipsis whitespace-nowrap` (or `truncate`) so any future tight column
  degrades to an ellipsis instead of colliding.
- Verify the corresponding data-row cells (lines ~206–236) still align.

### Step 2 — Fetch price lists + products for Doc-U order review (Bug 2 prerequisite)
File: `app/app/docu/[id]/page.tsx` (parallel fetch block, lines ~52–89)
- Add org-scoped queries for `pl_price_lists` and `pl_overrides` (mirror
  `lib/platform/orderflow-data.ts:153` pattern), and for the same product table
  `orderflow-from-doc.ts` matches lines against (read that file, lines ~250–330, to identify
  the exact table + fields; fetch only the fields matching needs: id, name(s), price fields).
- Pass `priceLists`, `overrides`, `products` down to `DocumentDetailPanel`.

File: `components/platform/docu/DocumentDetailPanel.tsx` (props ~34–53, pass-through ~144–149)
- Extend props and forward the three new arrays to `OrderReviewEditor`.

### Step 3 — Per-line price-list dropdown + order-wide re-price (Bugs 2 + 3, Doc-U)
File: `components/platform/docu/OrderReviewEditor.tsx`
- Add props: `priceLists: CdPriceList[]`, `overrides`, `products`.
- Add state: `priceListId: string | null` (initialize from persisted
  `extractedData.price_list_id` if present, else null).
- Unit-price cell (line ~299): keep the numeric input; add a compact native `<select>`
  (styled like existing cells, chevron on the right of the cell or an adjacent narrow select —
  implementer's choice, must not break the row grid) with options: "from list" (empty value)
  + one option per price list name. All lines' selects reflect the single order-level
  `priceListId`.
- On select change:
  - set `priceListId`;
  - re-price ALL lines: match each line's `description` to a product using the SAME
    normalization/matching the server uses in `orderflow-from-doc.ts` (export that helper from
    the lib file rather than duplicating it — pure string/product logic only, safe for client
    import; if the helper is entangled with server-only imports, extract just the pure matcher
    into the same file and export it);
  - for matched products: `unit_price = resolvePrice(product, selectedList, overrides).price`;
  - unmatched lines: leave `unit_price` untouched.
- Manual typing in the numeric input continues to call `updateLine` as today and does NOT
  reset `priceListId`.
- Persist: include `price_list_id: priceListId` in the extracted-order payload the editor
  saves (find the existing save path in this component / `DocumentDetailPanel`).

### Step 4 — Honor persisted price list on server sync
File: `lib/platform/orderflow-from-doc.ts` (~318–329)
- When the document's extracted payload carries `price_list_id`, use that list (looked up from
  the already-fetched `plRows`) instead of `customerPriceList(...)` when filling blank prices.
  Fall back to current behavior when absent or not found. Two–five lines, guarded.

### Step 5 — Order-level price-list picker in OrderFlow editing
Files: `components/platform/orderflow/builder.tsx`, `components/platform/orderflow/OrdersView.tsx`
- builder.tsx (~416–420): replace the read-only "Pricing from `<name>`" label with a `<select>`
  over `priceLists` (already in builder context), initialized to the customer-derived list id.
  Changing it updates the `priceList` used by `LineItemsEditor` (~254–279) and re-prices lines
  with the exact loop pattern from `OrdersView.tsx:1172–1190` (skip lines with non-empty
  `override_note`, skip lines without `stock_item_id`).
- OrdersView.tsx (~1163): replace the pure `useMemo` customer-derived `priceList` with state
  that defaults to the customer-derived list (and resets when the customer changes, preserving
  today's `pickCustomer` behavior) but can be overridden by the new select. Reuse — do not
  duplicate — the re-price loop (factor a tiny local `repriceLines(list)` if useful).

### Step 6 — Verification (run all; report output verbatim in implementation notes)
```bash
cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website"
npx tsc --noEmit
npm run lint --if-present
npm run build
```
Manual check list (dev server if feasible): Doc-U invoice doc → headers spaced; Doc-U order doc
→ per-line dropdown lists Fresh Valley demo price lists; picking one re-prices matched lines;
OrderFlow → order edit shows price-list select and re-prices on change.

## Edge cases
- Org has zero price lists → dropdown renders with only the "from list" empty option; no crash.
- Line description matches no product → price untouched, no error.
- Customer changes AFTER a manual list selection (OrderFlow): customer pick resets the list to
  the new customer's derived list (today's behavior wins — simplest, predictable for demo).
- `resolvePrice` returns null/none source → leave the line's existing price rather than
  writing an empty value over a user-entered one.
- Persisted `price_list_id` referencing a deleted list → treated as absent.

## Data/API/interface changes
- Extracted order payload gains optional `price_list_id?: string` (additive, backward
  compatible — older docs simply lack it).
- Component prop additions listed in Steps 2–3. No DB, no route, no schema changes.

## Outcome reporting
Write results, deviations, and verification output to `.ai/implementation.md` (append a dated
section; do not overwrite prior content).
