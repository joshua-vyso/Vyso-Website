# Implementation: Homepage rebuild — Finch launch (`/`)

Plan: `.ai/plan_homepage_finch.md` (steps 1–9). Implemented 2026-08-15 on branch
`feat/ui-brief-reskin`. **Nothing committed** — review on localhost first.

## Files created

| File | What |
|---|---|
| `public/finch/finch-bird.svg` | Copy of `.ai/design/assets/finch-bird.svg`; the mojibake group id replaced with `id="finch-bird"`, everything else byte-identical. |
| `public/finch/vyso-wordmark.svg` | Byte copy of `.ai/design/assets/vyso-wordmark.svg`. |
| `components/finch/FindingCard.tsx` | `"use client"`. `FindingCard` + pieces (`FindingCardFrame`, `FindingHeader`, `FindingObservation`, `FindingImpact`, `FindingEvidence`, `FindingActions`), `FINDING_DEFAULTS`, `FindingState`, and the `useTilt` hook. |
| `components/finch/FinchNav.tsx` | Server. Wordmark · divider · "Finch" + Industries / Pricing / Log in + CTA. |
| `components/finch/FinchFooter.tsx` | Server. Wordmark (opacity .7) + "Built by Vyso in Johannesburg." + Pricing / Industries / Case study / Privacy. |
| `components/finch/HomeHero.tsx` | Server (the card inside is the client component). |
| `components/finch/SequenceIntro.tsx` | Server. |
| `components/finch/InvoiceCard.tsx` | `"use client"`. Full + `compact` variants; highlights accept numbers or MotionValues. |
| `components/finch/BriefPhone.tsx` | `"use client"`. `BriefPhone` (desktop frame, `bubbleStyle` prop) + `BriefPanel` (mobile WhatsApp panel). |
| `components/finch/ScrollSequence.tsx` | `"use client"`. Desktop sticky sequence, static storyboard, mobile storyboard, plus `ExtractedRows`, `PriceChart`, `Captions`, `Reveal`. |
| `components/finch/WhatFinchWatches.tsx` | Server. |
| `components/finch/Senses.tsx` | Server. |
| `components/finch/FoundingQuote.tsx` | Server. |
| `components/finch/UnderTheHood.tsx` | Server. |
| `components/finch/AuditBand.tsx` | Server. |
| `.ai/implementation_homepage_finch.md` | This file. |

## Files modified

- `app/page.tsx` — full replacement. Server component, exports `metadata`
  (title `Finch by Vyso — your company's own COO, at a tenth of the cost`,
  description = the hero sub-copy's first two sentences + "Built by Vyso for
  South African food businesses."). Renders the `.finch-site` wrapper, nav,
  the nine sections in the plan's order, footer.
- `app/layout.tsx` — added `STIX_Two_Text` (`--font-stix`, weights 400/500,
  styles normal+italic) and `IBM_Plex_Mono` (`--font-plex-mono`, 400/500), both
  `display: "swap"`, both `.variable` classes appended to the `<html>` class
  list. Removed `<GlobalPixelTrail />` and its import (component file untouched
  on disk). `LiquidGlassFilter`, JSON-LD and metadata unchanged.
- `app/globals.css` — appended a delimited "Finch marketing tokens" block:
  `--fn-*` custom properties, a second `@theme inline` with the `fn-*` colour
  and font entries, `@keyframes fn-pulse`, `.finch-site` selection/link rules,
  the mobile `section` padding restatement, the reduced-motion animation kill,
  and the `overflow-x: clip` fix (see deviations). Nothing above the block was
  touched.
- `components/ContactForm.tsx` — AC 11 only: `tier` dropped from
  `INITIAL_STATE`, the tier `<label>` + `<select>` removed, submit label
  "Join Waitlist" → "Book your audit". Nothing else changed.

## Deviations from the plan (and why)

1. **`overflow-x: clip` escape hatch (new CSS rule, not in the plan).**
   `app/globals.css` already had `html, body { overflow-x: hidden }`, which
   makes both elements scroll containers and silently disables
   `position: sticky` inside them. Measured on localhost: the sticky stage
   scrolled straight past the viewport (sticky top read −593px at 22% of the
   sequence). Fixed with `html:has(.finch-site), body:has(.finch-site) {
   overflow-x: clip; overflow-y: visible }` — `clip` gives the same
   "never scroll sideways" guarantee without creating a scroll container, and
   `:has()` keeps every other route on the old rule.
2. **Mobile `section` padding uses `!important` (two declarations).**
   The pre-existing `@media (max-width: 767px) { section { padding-inline: 1rem
   !important } }` rule would have overridden the design's 20px gutter and could
   not be beaten on specificity. Restated as
   `.finch-site section { padding-left/right: 20px !important }`. This is one
   more `!important` than the plan's "reduced-motion only" budget.
3. **Tokens inlined into `app/globals.css`** rather than a separate
   `components/finch/tokens.css` (the plan allowed either; one file keeps the
   Tailwind `@theme` discovery path identical to the existing block).
4. **Mobile type sizes for the desktop-only sections.** `Homepage.dc.html` has
   no mobile spec for the sequence intro, agent roster, senses, quote, under the
   hood or audit band, and `Mobile.dc.html` does not include those sections at
   all. Below `lg` they stack to one column at 20px gutters with proportionally
   reduced headings (H2 38→28px, senses H2 34→26px, quote 32→24px, band H2
   36→28px) and reduced section top padding (110→72px, 130→88px, 120→80px).
   Desktop values are exactly the design's.
5. **Finding card at phone width**: the evidence chip is `whitespace-nowrap
   shrink-0` and the action labels are `whitespace-nowrap` inside a
   `flex-wrap` row. Without this the chip broke its "↗" onto a second line and
   all three action labels were squeezed to two lines each at 375px. Sizes,
   colours and spacing are unchanged.
6. **`FindingActions` gained an `interactive` prop.** The sequence card in
   `Homepage.dc.html` renders its actions as plain 14px-gapped labels with no
   hover affordance, while the standalone card has 6px gaps and a hover chip.
   One prop instead of two components.
7. **`useSyncExternalStore` instead of a `mounted` + `useState` gate** in
   `ScrollSequence`. Behaviour is identical (static storyboard until hydration,
   then desktop/mobile), but the repo's ESLint config errors on
   `react-hooks/set-state-in-effect`, which the `mounted` gate trips.
8. **Nav "Mobile" link → "Log in"** (`/login`), per the plan's nav spec; the
   design file's third link points at its own mobile mock, which has no
   equivalent route here. Footer likewise uses the plan's four links rather than
   the design's "Mobile"/"Desktop site" cross-links.
9. **Hero CTA and nav CTA point at `/contact`**, not `/pricing` as in the design
   file — the plan specifies `/contact` for the nav CTA and the audit is booked
   through the contact form.
10. **`next/font` italic**: `STIX_Two_Text` accepted `style: ["normal",
    "italic"]` with weights 400/500, so the plan's fallback (normal only) was
    not needed.

## Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10): error TS2724: '"@/lib/ai/anthropic"' has no exported member named 'extractOrderFromText'…
lib/platform/whatsapp-ingest.ts(408,36): error TS7006: Parameter 'l' implicitly has an 'any' type.
lib/platform/whatsapp-ingest.ts(589,5): error TS2353: 'whatsappIngestId' does not exist in type 'IngestDocumentInput'.
```
**Three errors, all pre-existing**, all in the untracked WhatsApp work this task
must not touch. Zero errors in any file created or modified here (verified by
`npx tsc --noEmit | grep -v whatsapp-ingest` → empty).

```
$ npm run lint
✖ 94 problems (55 errors, 39 warnings)
```
**All pre-existing** (`components/platform/**`, `lib/**` — mostly
`react-hooks/set-state-in-effect`). Zero findings in `components/finch/**`,
`app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/ContactForm.tsx`
(verified by grepping the lint output for those paths → empty). Baseline before
this task was 94 as well; the one error this work introduced (the `mounted`
gate) was removed — see deviation 7.

```
$ npm run build
> Build error occurred
Error: Turbopack build failed with 1 errors:
./lib/platform/whatsapp-ingest.ts:4:1
Export extractOrderFromText doesn't exist in target module
Import trace: ./lib/platform/whatsapp-ingest.ts → ./app/api/whatsapp/process/route.ts
```
**BLOCKED, not by this work.** The production build fails on the same untracked
WhatsApp route; `lib/**` and `app/api/**` are on the plan's DO-NOT-TOUCH list, so
it cannot be fixed here, and the build aborts before compiling anything else.
Substitute evidence that the homepage compiles and renders:

- `npm run dev` + `curl http://localhost:3000/` → **200**, 66KB of HTML, correct
  `<title>` and `<meta name="description">`, all section copy present, the
  static storyboard server-rendered (so no hydration flash), zero server-side
  errors or warnings in the dev log.
- `curl http://localhost:3000/contact` → **200**, contains "Book your audit",
  no "Select a tier".
- Browser (dev, Chrome): no console **errors**. Only warnings are the
  "preloaded but not used" notices for the root layout's seven font families —
  pre-existing behaviour of the shared layout, now with two more faces.

```
$ grep -rn "backdrop-blur\|backdrop-filter\|glow" components/finch app/page.tsx | wc -l
0
$ grep -rn "R10,000\|R30,000\|R50,000\|Join Waitlist" app/page.tsx components/finch components/ContactForm.tsx | wc -l
0
$ git status --short
 M app/globals.css
 M app/layout.tsx
 M app/page.tsx
 M components/ContactForm.tsx
 M vercel.json                    ← pre-existing (WhatsApp work)
?? components/finch/
?? public/finch/
?? .ai/design/… .ai/plan_…        ← pre-existing
?? app/api/whatsapp/ lib/platform/whatsapp-*.ts supabase/whatsapp-ingest.sql
?? tests/whatsapp.test.ts docs/whatsapp-ordering.md public/serviceden-logo-concept.svg
```
Exactly the plan's CREATE/MODIFY set plus the pre-existing untracked files.

### Browser spot-checks (dev server, 1440×900 / 768×1024 / 375×812)

- Hero, nav, all five sequence beats (invoice → highlights + extracted rows →
  chart draw with orange end dot and R62.00 → card assembly → phone + brief
  bubble), captions lighting 01–05 in turn, agent roster, senses, quote, under
  the hood, audit band, footer — all render as designed.
- 768 and 375 fall to the mobile storyboard (compact invoice → "↓ FINCH READS
  IT" → finding card → WhatsApp panel) with the staggered reveals firing.

## Homepage components now unused by `/` (NOT deleted)

Deletion needs user approval per the parent plan, Step 2.

| Component | Still used elsewhere? |
|---|---|
| `components/BounceDot.tsx` | No route — only `components/animations/wordCycle.ts` references it. |
| `components/HeroSection.tsx` | No route. |
| `components/marketing/IntegrationsMarquee.tsx` | Nothing. |
| `components/sections/SystemsShowcase.tsx` | `app/contact/page.tsx` (CSS/anchors), `ContactSection`. |
| `components/sections/HowItWorks.tsx` | No route. |
| `components/sections/AppsShowcase.tsx` | No route. |
| `components/sections/TrustStrip.tsx` | No route. |
| `components/sections/ContactSection.tsx` | No route. |
| `components/WebGLShaderBackground.tsx` | `components/marketing/LazyShaderBackground.tsx`, `BlendTextMobile.tsx` (used by other marketing pages). |
| `components/GlobalPixelTrail.tsx` | **Nothing** — no longer mounted anywhere after the layout change. |
| `components/Navbar.tsx`, `components/sections/SiteFooter.tsx` | Yes — `/contact`, `/privacy`, `/faq`, `/pricing`, `PublicMarketing`. Untouched. |

`app/globals.css` still carries mobile fix-ups keyed to those components'
section ids (`#apps`, `#pricing`, `#reach`, `#hero`, `#systems`); they are inert
on `/` now but still serve the other marketing routes, so nothing was removed.

## Known gaps for the browser QA pass

1. The production build cannot be run until the untracked WhatsApp route
   compiles (`extractOrderFromText` no longer exists in `lib/ai/anthropic.ts`).
2. Reduced motion was verified by reading the SSR output (the static storyboard
   is what the server renders) but not with an actual
   `prefers-reduced-motion: reduce` browser profile.
3. Tilt/hover states were not exercised with a real pointer.
4. At exactly 375px the mobile eyebrow "01 AN INVOICE COMES IN → 04 A FINDING
   COMES OUT" wraps to two lines; it fits on one at the design's 390px.

## Polish pass (375px)

Three narrow-width fixes, no other behaviour touched. Desktop is byte-identical
in layout (single-line evidence row, `·`-separated actions, unbalanced eyebrow
text — `text-balance` and the hidden separators only engage at the sizes named
below).

1. **`components/finch/FindingCard.tsx`, `FindingEvidence` (~line 195-208).**
   The evidence row (chip + meta label) was `flex items-center gap-[8px]`,
   which let the meta span (`FRESHCO · +12% · JUN–AUG`) wrap mid-word and
   orphan "AUG" at 375px. Changed the row to
   `flex flex-wrap items-center gap-x-[8px] gap-y-[6px]` and added
   `whitespace-nowrap` to the meta `<span>`, so at narrow widths the whole
   meta label drops to its own line intact instead of breaking. At desktop
   width nothing wraps, so it still reads as one line — visually identical.

2. **`components/finch/FindingCard.tsx`, `FindingActions` interactive branch
   (~line 209-254).** Each action was `<span className="flex items-center
   gap-[6px]">` wrapping a *separate* leading `·` `<span>` and the label —
   correct markup already, but the row's `gap-[6px]` applied to both axes,
   and there was no accommodation for very narrow widths, so at 375px the
   wrap could still land a lone `·` at the start of a line depending on where
   the browser broke. Changed the row to `gap-x-[6px] gap-y-[4px]
   max-[399px]:gap-x-[14px]` and each item span to `inline-flex` (was `flex`,
   functionally the sizing hook for "this item is one wrap-atomic unit"), and
   added `max-[399px]:hidden` to the separator `<span>` itself. Below 400px
   the separators disappear and the row gap widens to 14px so the three
   labels just space out on their own; the non-interactive `FindingActions`
   branch (desktop-only sequence-card picture, `interactive={false}`) was
   left untouched since it never renders below `lg`.

3. **`components/finch/ScrollSequence.tsx`, `MobileSequence` (lines 341-343
   and 359-361).** Added `text-balance` to both eyebrow `<div>`s — "01 AN
   INVOICE COMES IN → 04 A FINDING COMES OUT" (line 342) was orphaning "OUT"
   onto its own line at 375px; "05 YOUR MONDAY BRIEF · ON WHATSAPP" (line
   360) didn't wrap at 375px but got the same treatment for consistency at
   narrower widths. `text-wrap: balance` only changes where a wrap already
   happens, so it is a no-op everywhere the text fits on one line.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10): error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5): error TS2353 …
```
Same three pre-existing errors as the original implementation pass, all in the
untracked WhatsApp work. Zero errors elsewhere.

```
$ npx eslint components/finch app/page.tsx
```
Clean — no output, zero problems.

Checked against a running dev server (`:3000`, already up with HMR) at 375px:
evidence row now breaks after the chip with the meta label intact on its own
line; actions row wraps with each label carrying its separator (no leading
`·`), and below 400px the separators drop and labels space out at 14px; both
mobile eyebrows now balance across two lines instead of orphaning a short
last word.

## Architect review (Fable, 2026-08-15) — APPROVED for localhost review

Browser-verified at 1440×900 and 375×812 against `.ai/design/Homepage.dc.html` /
`Mobile.dc.html`: hero, all five scroll beats (invoice → extraction → chart →
finding card assembling → slide into phone + brief), agent cards, senses rows,
quote, under-the-hood, audit band, footer, mobile storyboard + WhatsApp panel.
Console clean. No horizontal scroll at 375. Tilt engages on mousemove and resets
in 250ms ease-out. SSR HTML contains all five beats (static path = reduced-motion
path). `/contact`, `/pricing`, `/industries`, `/login` still 200.

Known / carried forward:
- `npm run build` is blocked by a PRE-EXISTING error in untracked WhatsApp work
  (`app/api/whatsapp/process/route.ts` → `lib/platform/whatsapp-ingest.ts`
  imports `extractOrderFromText`, missing from `lib/ai/anthropic.ts`). Not part
  of this task; not touched. Needs the owner of that work to fix before deploy.
- Reduced-motion not exercised with a real OS profile (tool limitation).
- Old shared `Navbar`/`SiteFooter` still say "Join Waitlist" on other pages —
  sitewide pass.
- Old homepage components (BounceDot, HeroSection, SystemsShowcase, HowItWorks,
  AppsShowcase, TrustStrip, ContactSection, IntegrationsMarquee,
  WebGLShaderBackground, GlobalPixelTrail) are now unused by `/` — NOT deleted;
  deletion list awaits user approval per parent plan Step 2.

---

# v2 — richer brief (beat 5) + platform showcase (1a → 1c)

Plan: `.ai/plan_homepage_finch_v2.md`. Implemented 2026-08-15, same branch,
**nothing committed**. `app/globals.css` was NOT touched: every token the
showcase needed already existed (`.of-num` / `.of-display` for Space Grotesk,
`.vyso-pulse` for the design's `vysoPulse`), and the `--pf-*` block is
documented as the platform's, not the marketing surface's.

## Files created

| File | What |
|---|---|
| `components/finch/PlatformShowcase.tsx` | `"use client"`. Section shell + `useFitScale` + `DesktopShowcase` (view state, cursor motion values, the one cancellable demo timeline) + `MobileShowcase`. |
| `components/finch/showcase/data.ts` | All copy/geometry from the design's frames 1a · 1c · 1e and its `renderVals()` placeholders, plus the `BriefCard` / `MobileCard` types. |
| `components/finch/showcase/BriefHome.tsx` | Frame 1a — rail, feed (4 cards), pinned chat bar. `FeedCard`, `Pill`, `InertButton`. |
| `components/finch/showcase/FindingDetail.tsx` | Frame 1c + the exported `PriceChart` (self-animating: path draw → quote line → end dots → stat row). |
| `components/finch/showcase/BriefMobile.tsx` | Frame 1e content (no phone chrome) + a mobile 1c, own view state, one-shot tap nudge. Exports `MOBILE_W`/`MOBILE_H`. |
| `components/finch/showcase/Cursor.tsx` | `DemoCursor` — 22px arrow, tip-anchored, `pointer-events:none`. |

## Files modified

- `components/finch/BriefPhone.tsx` — added `BRIEF_FINDINGS` (the three
  findings) and one shared `FindingBubble` (`scale: "phone" | "panel"`).
  `BriefPhone` gained `debtorsStyle`, `reconStyle`, `cardSlot`,
  `cardSlotHeight`, `height`. `BriefPanel`'s order is now brief → PRICE WATCH →
  DEBTORS → RECON → green user bubble → "Done. It's in your drafts."
- `components/finch/ScrollSequence.tsx` — `STAGE_H` 660 → 710, new `PHONE_H`,
  `CARD_LAND_X/Y/SCALE`, `CARD_SLOT_H` constants (the landing magic numbers
  now have names), two new motion-value pairs for the DEBTORS/RECON bubbles at
  `seg(.93,.97)` / `seg(.95,.99)`, and the phone gets them + the spacer.
- `app/page.tsx` — `<PlatformShowcase />` between `ScrollSequence` and
  `WhatFinchWatches`.

## Deviations from the plan (and why)

1. **The phone had to grow: 630 → 680px, stage 660 → 710px.** AC1 says
   "nothing clipped at 1160×660". Measured on localhost at 1440×900 the plan's
   own copy at the plan's own type scale does not fit: header 63.5 + gap 14 +
   brief bubble 63 + gap 8.5 + landed card 128.7 + 10 + DEBTORS 166 + 10 +
   RECON 166 + 14 bottom = **643.7px of content in a 604px screen**. Both
   observations wrap to 4 lines at the 222px bubble content width. Shaving
   padding everywhere recovers ~16px, not 40. Growing the phone keeps every
   number the plan specifies (copy, 13/15/10.5px scale, 12×14 padding, bubble
   radius, stage width 1160) and makes the frame *more* phone-shaped
   (300×680 = 2.27 vs iPhone's 2.16). The stage only grows downward — every
   beat is absolutely positioned from the top — so the composition just sits
   ~25px higher on screen; the captions still clear the phone by 11px.
2. **`CARD_LAND_Y` 118 → 74.** With three bubbles the card can no longer sit
   low in the screen. It now lands 10.5px under the greeting bubble, which is
   also a more believable chat gap. `CARD_LAND_X` (336) and the 0.56 scale are
   unchanged, so the 13px / 14.6px side margins the plan asked for are intact.
3. **`BriefPhone` auto-heights outside the sequence.** The static storyboard /
   reduced-motion phone draws the PRICE WATCH bubble itself (there is no card
   flying in) and would need ~700px. Rather than clip it, the frame drops its
   fixed height there and grows to its content — measured 689px, and
   `scrollHeight === clientHeight`, so nothing is cut.
4. **No new `--pf-*` tokens; the mock uses the design file's literal hex.**
   Several design values have no token (`#BE5D23`, `#3E8FE0`, `#FBE9EE` /
   `#B0466A`, `#EFEDE8`, `#F5F3EF`, `#C9CCC4`, `#FBFAF8`) and the existing
   `--pf-*` block is declared for `app/app/**` + `components/platform/**`.
   Mixing half tokens and half hex inside one picture invites drift, so the
   whole frame reads its colours from `showcase/data.ts` + inline classes,
   copied verbatim from the design. The three *shared* helpers that did fit
   (`.of-num`, `.of-display`, `.vyso-pulse`) are reused.
5. **The chart's end dots pop by animating `r`, not `scale`.** The SVG is
   `preserveAspectRatio="none"` (520→~440 wide, 180→190 tall), so a transform
   pop would pop lopsided. Same visual, correct geometry.
6. **Desktop and mobile variants are both in the DOM, switched by
   `hidden lg:block` / `lg:hidden`** instead of a JS media-query hook. It is
   SSR-correct at every width with no hydration branch, and it makes the
   gating free: a `display:none` element never intersects, so the demo only
   runs on desktop and the tap nudge only on mobile, with no width check.
7. **Layout reserved with `aspect-ratio`, not a measured `height`.** Zero CLS
   by construction. Cost: before hydration the inner frame paints once at
   `scale(1)` (a clipped top-left crop). The section is ~6 viewports down, so
   it is not observable in practice — flagged below for review.
8. **Mobile logical frame is 390×812** (the plan gave a width, not a height).
   812 = the design's 844 minus the status bar and home indicator the frame no
   longer needs, and it is the value that leaves the third card clear of the
   chat pill's fade (measured: card bottoms out at 702, pill starts at 712).
9. **Mobile 1c stacks the chart title above the legend** (desktop keeps the
   design's `justify-between` row) — at 390px the title and both legend keys
   cannot share a line without one wrapping mid-label.
10. **Section padding is responsive**: the plan's `110px 40px 0` on desktop,
    `72px 20px 0` below lg — the convention v1 established for every other
    Finch section (v1 deviation 4).
11. **Inert controls use `cursor-default`**, not the design's `cursor:pointer`.
    A pointer cursor on a button that does nothing is a promise the mock can't
    keep. For the same reason the feed cards do **not** take the design's
    `style-hover` border/shadow — they are not clickable.
12. **The DEBTORS card's "2 unpaid invoices ↗" is inert.** The plan names only
    "Show 6-month trend" and (Price Watch's) "3 invoices ↗" as real. It was
    briefly a focusable button with no handler; now it is `tabIndex -1`.
13. **`BriefPhone` and `BriefPanel` share one `FindingBubble`** with a
    `scale: "phone" | "panel"` switch rather than two near-identical blocks.
    Only radius/padding/observation/impact sizes differ between them.

## Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Three errors, total — the same pre-existing ones in the untracked WhatsApp
work. Zero anywhere else.

```
$ npx eslint components/finch app/page.tsx
```
Clean, no output.

```
$ grep -rn "backdrop-blur\|backdrop-filter" components/finch | wc -l
0
$ grep -o "<h1" <(curl -s localhost:3000/) | wc -l
1
```

### Browser (dev server on :3000, Chrome)

**1440×900 — beat 5.** At `scrollYProgress = 1`, measured in the phone screen
(604 → 654px of usable height): header 118–181.5, greeting bubble 195.5–258.5,
reserved card slot 258.5–398.5 with the **landed card at 269–397.7** (13px left
/ 14.6px right margins, inside the slot), DEBTORS 408.5–574.5, RECON
584.5–750.5, screen bottom 772 → **21.5px of clearance, nothing clipped**.
Stage 90–800, phone 100–780, captions 791–806 — no overlap, all inside the
900px viewport.

**1440×900 — showcase.** Frame 1080×750 (scale 0.750, exact 1440:1000).
Autoplay sampled every 200ms from scroll: cursor holds at (980, 780) opacity 0,
fades in and travels (941,725) → (874,630) → (814,544) → (769,480) → (743,443)
→ settles at the measured button centre (738.7, 436.2); press frame shows
`scale 0.914` with the button at `rgb(247,250,253)` = `#F7FAFD`; the view flips
to 1c and the chart draws. **Real clicks**: "Show 6-month trend" → 1c (cursor
hidden), "‹ Back to today's brief" → 1a, both by actual pointer click. **Cancel
path**: a real `pointerdown` on the frame before it scrolled into view meant the
demo never played — 3.5s after it came into view the cursor was still at
opacity 0 and the view was still 1a.
1a geometry (frame coords): rail 0–216 full height, content column 449–1207
(760 wide, centred), cards at 234–475 / 489–731 / 745–961, chat bar 854–999.
1c geometry: content 1–804 inside 1000, column 281–1159, chart 342–781 ×
322–512 (190 tall), stats 545–599, evidence 668–760. Fonts resolve to Space
Grotesk on the headline and every figure; the gradient runs are
`background-clip: text` with transparent colour; the wordmark loads.

**375×812.** Showcase falls to the phone-width mock (335px box, scale 0.854),
1e renders all three cards clear of the chat pill, "6-mo trend" taps through to
mobile 1c (content bottom 808 in the 812 frame) and Back returns. Mobile
`BriefPanel` shows brief → PRICE WATCH → DEBTORS → RECON → "Draft the supplier
email" → "Done. It's in your drafts.". `document.scrollWidth === 375` — no
horizontal scroll.

**Tab order.** Focusable inside the desktop frame: exactly `3 invoices ↗` and
`Show 6-month trend`. Inside the mobile frame: exactly `6-mo trend`. Every
other control is `tabIndex -1` + `aria-disabled`. The
`focus-visible:outline{,-2,-offset-2,-[#C9DEF7]}` utilities are all present in
the generated CSS (2px solid `#C9DEF7`, 2px offset).

**Reduced motion / static path.** Not exercised with a real OS profile (tool
limitation, same as v1). Verified instead by re-rendering the server HTML
unhydrated in a same-origin iframe with scripts stripped — which is exactly
what the reduced-motion visitor gets: the phone grows to 689px and holds
header 64 · greeting 63 · PRICE WATCH 147 · DEBTORS 166 · RECON 166, with
`scrollHeight === clientHeight`. SSR HTML also contains all the showcase copy
(1a + 1e) and no `Back to today` (1c is not the initial view).

**Console.** No errors. Only the pre-existing "preloaded but not used" font
warnings from the root layout.

## For the reviewer to eyeball

1. **The 1a crop.** 1a is 1180 tall in the design and the frame is 1000, so the
   RECONCILIATION card's tail (the "Credit request sent to Umgeni Oils…" note)
   sits in the chat bar's white fade and the resolved Stock card is almost
   entirely below the crop. The plan sanctions this; confirm it reads as
   "the feed continues" rather than as a collision.
2. **Where the card lands in the phone** (deviation 2) and **the taller
   phone/stage** (deviation 1) — the two changes to v1's choreography.
3. **Reduced motion with a real `prefers-reduced-motion: reduce` profile** —
   the desktop showcase should show 1a with no cursor and no autoplay, the
   view switch should be an instant swap, and the chart should be fully drawn.
4. **The pressed style on the exiting 1a.** During the 320ms cross-fade the
   old BriefHome is still mounted and still carries the trend button's
   pressed colours. It fades out with the frame; check it doesn't read as a
   flash.
5. **Pre-hydration frame paint** (deviation 7) — on a hard reload with a very
   slow connection the showcase frame would paint one crop of the mock at 1:1
   before the scale lands. Six viewports below the fold, but worth a look if a
   deep-link to the section is ever added.

## Architect review v2 (Fable, 2026-08-15) — APPROVED for localhost review

Verified in-browser: beat 5 phone holds brief + landed PRICE WATCH card + DEBTORS
+ RECON with clearance at 1440×900; showcase auto-demo sampled over time (1a
holds ~1.75s → cursor fades in ~0.6s and glides to the trend button by ~1.8s →
pressed state #F7FAFD → 1c in by ~2.5s, chart drawn); real "Back" and trend
buttons work; 375px shows the 1e mock, tap "6-mo trend" → mobile 1c → Back;
no horizontal scroll; one <h1>; console clean apart from stale HMR websocket
noise from a dev-server restart. Reduced-motion still only verified via SSR path.
Accepted deviations: phone 630→680 / stage 660→710 (copy needs the height),
card lands higher (CARD_LAND_Y 74).

# v3 (parts 1–2) — scroll-direction-driven showcase demo + copy

Plan: `.ai/plan_homepage_finch_v3.md`, **Parts 1 and 2 only**. Part 3 (the
integrations orbit in `components/finch/Senses.tsx`) is being done separately
after research and was **not touched** here. Implemented 2026-08-15, same
branch, **nothing committed**.

## Files modified

- `components/finch/PlatformShowcase.tsx` — `DesktopShowcase` rewritten around
  a scroll-direction controller; H2 copy.
- `components/finch/showcase/FindingDetail.tsx` — `backRef` / `backPressed`
  props on the "‹ Back to today's brief" link; the reverse demo's exit
  transition needs no change here (it lives in the parent's `AnimatePresence`).
- `components/finch/showcase/BriefHome.tsx` — `staggerCards` prop; the three
  feed cards wrapped in a `motion.div` that deals them back in.
- `components/finch/WhatFinchWatches.tsx` — H2 copy.

Nothing else. No new dependencies, no `app/globals.css`, no shared chrome.

## Part 1 — how the controller works

The whole machine is refs, because the scroll listener fires on every frame of
a flick and must never wait for a re-render to see the truth:

| ref | job |
|---|---|
| `phaseRef` | `idle \| forward \| reverse` |
| `viewRef` | `brief \| detail`, mirrored from the React state by the two setters |
| `runRef` | the cancellation token; bumping it invalidates every beat the running sequence is awaiting |
| `rearmAtRef` | `performance.now()` before which triggers are ignored (400ms) |
| `lastYRef` / `accumRef` | the 24px hysteresis |
| `directionRef` | last committed direction, re-asked when the frame crosses into view |
| `inViewRef` | mirror of `useInView(frameRef, { amount: 0.4 })` |

`consider(direction)` is the whole rule in one place: in view, idle, re-armed,
and then `down + brief → playForward`, `up + detail → playReverse`. It is
called from the scroll listener (`{ passive: true }`, removed on unmount) and
once more from the `inView` effect — a reader who scrolls the frame into place
and *stops* gets no further scroll events, so the crossing itself has to re-ask
the question.

Hysteresis: each scroll event adds `dy` to `accumRef` **unless the sign flips,
in which case the count restarts at `dy`**. Only ±24px of committed travel
commits a direction, and the accumulator resets to 0 when it does.

Sequences are `async` functions rather than arrays of `setTimeout` ids. Each
beat is `await sleep(...)` followed by `if (runRef.current !== run) return;`,
so `cancel()` is a single `runRef.current += 1` and a beat can never land late.

- **Forward** (unchanged timings): 600 cursor in + 1000ms travel → 1750 press
  (`scale [1, .88, 1]`, 240ms; button goes `#F7FAFD`) → 2000 swap to 1c → 2400
  cursor out. The chart keeps its own beats off the swap.
- **Reverse**: cursor placed at frame (120, 140), 300 fade in + 900ms ease-out
  travel to the measured centre of the back link → 1300 press (same pulse; the
  link turns `#BE5D23`) → 1550 swap → 1950 cursor out. 1c exits
  `opacity 1→0, y 0→8` over 260ms while 1a enters `opacity 0→1, scale .985→1`
  over 320ms (`AnimatePresence` default `sync` mode, so they overlap), and the
  three feed cards stagger `y 10→0` + opacity, 60ms apart.

Cancellation: `onPointerDownCapture` on the frame, `Escape` via
`onKeyDownCapture`, and both real controls' `onClick` (which covers keyboard
activation precisely, so no blanket key handler is needed). Cancel hides the
cursor and re-arms after 400ms — it does **not** disable the trigger, so the
next matching scroll plays again.

Reduced motion: same rule, but `playForward` / `playReverse` swap the view and
return immediately; no cursor is mounted, the chart is pre-drawn
(`animateChart={!reduceMotion}`), and `staggerCards` is forced off.

Mobile: untouched. `DesktopShowcase` is still `display:none` below `lg`, so
`useInView` is permanently false there and `consider()` always bails.

## Deviations from the plan (and why)

1. **Two showcase files were touched beyond the plan's list.** The plan names
   `PlatformShowcase.tsx` (+ `Cursor.tsx` "if the reverse path needs a
   start-position prop"), but the reverse demo has to *aim at* and *press* the
   back link, and the return has to stagger 1a's cards — neither is reachable
   from the parent. Both are done the way the forward path already does it:
   `backRef` / `backPressed` on `FindingDetail` mirrors `trendRef` /
   `trendPressed` on `BriefHome`, and `staggerCards` is a single boolean prop.
   `Cursor.tsx` needed **no** change: its position is already driven by motion
   values the parent owns, so "start position" is just a `.set()`.
2. **Reverse beats are tighter than forward (2.2s vs 2.65s).** The plan fixes
   only the travel (~0.9s) and the press. The lead-in is 300ms rather than
   600ms: the reader has already met the pointer once, and a second slow
   introduction reads as lag.
3. **Cancelling also starts the 400ms re-arm.** The plan attaches the debounce
   to "after a demo finishes". Extending it to cancels is the smallest way to
   stop the same gesture that cancelled a demo from instantly starting the
   next one; it never disables anything.
4. **No `useAnimate` scope.** The plan suggests one. Everything animated here
   is a motion value the component already owns (`cursorX/Y/opacity/scale`)
   plus declarative `AnimatePresence` children — a scope would add a selector
   indirection and nothing else. `runRef` + `motionValue.stop()` covers what
   `useAnimate`'s auto-cleanup would have, and an unmount effect bumps `runRef`.
5. **Nothing resets the chart's motion values, because there are none to
   reset.** The plan asks for a reset on view change. 1c unmounts on every
   swap (`AnimatePresence key="detail"`), so each forward entry re-mounts the
   chart and it draws 0 → 1 from scratch; an interrupted draw leaves nothing
   behind. Verified across three forward plays in one session.
6. **1a now has an `initial`/`animate` pair, not just an `exit`.** Needed for
   the "1a fades in" half of the reverse swap. `AnimatePresence initial={false}`
   still suppresses it on first paint, so the section's load behaviour is
   unchanged.
7. **`PRESS_PULSE.times` is annotated `as number[]`.** Hoisting the transition
   out of the call site made `as const` produce a readonly tuple, which
   `animate()`'s keyframe overload rejects. Noted in a comment at the constant.
8. **The scroll listener is attached below `lg` too.** `DesktopShowcase` is
   mounted-but-hidden at every width (v2 deviation 6), so its effect runs on
   mobile. It is one subtraction per scroll event and every trigger path is
   gated behind `inViewRef`, which a `display:none` element can never set.
   Un-mounting the desktop variant on mobile would have cost a width hook and
   an SSR branch — a worse trade.

## Part 2 — copy

- `WhatFinchWatches.tsx`: `Five agents on shift…` → **`Custom agents on shift,
  all day, every day.`**
- `PlatformShowcase.tsx`: `This is what Finch looks like when you open it.` →
  **`Finch is ready to go, whenever you need it.`** Sub-copy unchanged.

## Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Three errors, total — the same pre-existing ones. Zero anywhere else.

```
$ npx eslint components/finch app/page.tsx
```
Clean, no output.

### Browser (dev server on :3000, Chrome, 1440×900)

Frame measures 1080×750 at absolute y 5616.6, so the 40% band is
`scrollY ∈ [5017, 6067]`. All coordinates below are frame coords (1440×1000),
sampled every 120–150ms while the page was scrolled in 40px steps.

**Forward, on scroll down.** Parked at y 4900 (24% visible): cursor opacity 0
at (975, 778), view 1a — no trigger. Stepping down, visibility crosses 0.4 at
y ≈ 4980 and ~600ms later the cursor fades in and travels
(936,722) → (854,606) → (791,517) → (747,453) → **(734, 435)**, the measured
trend-button centre. Button then reads `rgb(247,250,253)` = `#F7FAFD`, view
flips to 1c, cursor fades 1 → 0.44 → 0.03 → 0.

**Reverse, on scroll up while 1c is in view.** From y 5540 stepping up to
5220 (visibility 0.67): cursor is placed at **(117, 139)** ≈ the specified
(120, 140), fades in and travels (218,108) → (301,82) → (361,64) → **(379,
58)**, the measured back-link centre. The link turns `rgb(190,93,35)` =
`#BE5D23`, view flips to 1a, cursor fades out. The three feed cards were
sampled mid-stagger: `opacity 0 / 0 / 0` at `translateY 10px` → `.47 / .19 / 0`
at `5.3 / 8.1 / 10` → `.85 / .66 / .42` → `1 / .94 / .79` → all `1`,
`transform: none`. Correct 60ms cascade, correct 10 → 0 travel.

**Forward again, on the next scroll down.** Third play of the session ran the
full timeline to 1c. The demo is genuinely repeatable.

**Hysteresis.** 14 alternating ±10px scrolls (a stand-in for trackpad jitter)
while 1c was in view produced **no** reverse demo — view still 1c, cursor
still at opacity 0.

**Escape cancels.** Mid-travel at (786, 509) with opacity 1, a `keydown`
`Escape` on the frame froze the cursor at (785, 507) and faded it to 0 within
400ms; the view stayed 1a and no press or swap ever landed. **A later scroll
down replayed the forward demo to 1c** — cancel does not disable.

**Real click mid-demo cancels.** During a reverse demo, a real
`pointerdown` + `click` on the back link stopped the cursor where it was,
faded it out, and the view swap came from the click itself; none of the
demo's remaining beats fired (no `#BE5D23` press state, no second swap).

**375×812.** Desktop variant is `display: none`; the mobile mock renders,
"6-mo trend" taps through to mobile 1c and Back returns; six alternating
±60px scrolls triggered nothing. `document.scrollWidth === 375`.

**Page-level.** Exactly one `<h1>`; `scrollWidth` 1425 vs `innerWidth` 1440
(scrollbar) at 1440×900 — no horizontal scroll. Console: only the React
DevTools notice and `[HMR] connected`. Both H2s read the new copy.

## For the reviewer to eyeball

1. **Reduced motion with a real `prefers-reduced-motion: reduce` profile.**
   Still only verified by code path (no OS-level toggle from the tooling, same
   limitation as v1/v2): both sequences should swap the view instantly with no
   cursor, no card stagger, and a pre-drawn chart.
2. **How the reverse demo feels on a real trackpad**, especially the moment
   the cursor appears at the top-left of 1c — the plan's start point, but a
   pointer materialising in the corner is the one beat that could read as a
   glitch rather than as an actor.
3. **Repeat-play fatigue.** A reader who scrubs up and down deliberately can
   run the demo four or five times in ten seconds. The 400ms re-arm and the
   24px commit are the only brakes; if it feels busy, raising `REARM_MS` is a
   one-line change.
4. **Whether the card stagger should also fire on a real Back click.** It
   currently does (`showBrief` sets `returning` regardless of who called it),
   which felt right — the return should look the same however you got there.

# v3 (part 3 — orbit) — Senses section becomes an integrations orbit

Plan: `.ai/plan_homepage_finch_v3.md`, **Part 3 only**. Research:
`.ai/research/integrations-orbit.md`. Parts 1–2 were done separately and were
**not touched** here (`PlatformShowcase.tsx`, `showcase/*`,
`WhatFinchWatches.tsx` are all untouched by this pass). Implemented
2026-08-15, same branch, **nothing committed**.

## Files

- CREATE `components/finch/integrations.ts` — the 13-tool roster
  (`slug / name / verb / short`).
- CREATE `components/finch/IntegrationsOrbit.tsx` (`"use client"`).
- MODIFY `components/finch/Senses.tsx` — the right column's five text rows are
  replaced by `<IntegrationsOrbit />`; grid alignment `items-start` →
  `items-center` and the mobile gap 32 → 24 (see deviation 6).

No new dependencies, no `app/globals.css`, no shared chrome, no public assets
(the 13 SVGs were already written by the research pass).

## How it works

One integer. `step` advances every 2400ms; `active = step % 13`; every tile
re-renders with a new inline `transform` / `opacity` and a CSS transition does
the travelling (700ms transform, 450ms opacity, `cubic-bezier(.22,1,.36,1)`) —
folk's mechanism exactly as the research documented it, not a rotation
animation. There is no per-tile animation state, so "pause" is just "stop
ticking" and reduced motion is "never tick".

**Arc travel, not chord travel.** folk's transform is kept verbatim:
`translate(-50%,-50%) rotate(φ) translateY(-R) rotate(-φ) scale(s)`. Because it
is the *angle* that interpolates, a tile moving one slot follows the ring
instead of cutting across it; the trailing `rotate(-φ)` keeps it upright the
whole way.

**Geometry is derived, not eyeballed.** Logical canvas 560×460. The capsule is
380×156 at (136, 176); the Finch circle (d 120) sits at its left end (214, 254)
and the dock at its right end (438, 254). The ring centre is then *computed* so
the dock lies on the ring (`RING_CX = DOCK.cx − R·cos θ_dock`, R = 195,
θ_dock = −5°), which is what makes tiles arrive by travelling rather than
flying in from nowhere. Slots are 26° apart, with 6° extra either side of the
dock because the docked tile is 120px against its neighbours' 64px. The arc's
lower-left run passes behind the capsule — that is where the rest of the roster
queues out of sight.

Measured in Chrome at 1440×900 (canvas rendered 558.8×459, i.e. ~1:1), tile
top-left corners relative to the canvas, Xero docked:

```
xero        377.2, 193.6  120px  op 1      ← docked
whatsapp    384.7, 116.2   64px  op .95
yoco        329.4,  50.2   62px  op .80
sage        250.4,  15.6   60px  op .62
loyverse    164.9,  20.6   56px  op .44
quickbooks   89.6,  63.7   52px  op .30
gmail        40.1, 136.5   48px  op .18
outlook      26.9, 224.7   44px  op .10
notion …gpt  (behind the capsule)          op 0
```

Nine tiles carry visible opacity (offsets 0…+7 plus the one leaving), four are
parked at 0 on the hidden run. Every box is inside 0…558.8 × 0…459 — nothing
clips.

**Sizing is CSS-only.** The wrapper is `container-type: inline-size` with
`--u: 0.17857143cqw` (= 100/560 cqw = one canvas pixel), and every coordinate is
`calc(n * var(--u))`. No ResizeObserver, no measured-width state, so the
server's markup is already correct at every width and there is no first-paint
snap. Chip type, chip padding and the `FINCH` label carry a `max(…px, …)` floor
— at 375px the canvas scales to 0.6 and 13.5 canvas-px of chip text would render
at 8px.

**Gating.** `running = inView && tabVisible && !hovered && !reduceMotion`.
`useInView(root, { amount: .25, margin: "160px 0px" })` doubles as the SSR
gate: it is false on the server and on the first client render, so both produce
step 0 (Xero docked) and cycling only starts once the observer fires. That is
why there is no `mounted` state — and it is also what the `react-hooks/
set-state-in-effect` lint rule demanded (see deviation 1).

**Status chip.** All thirteen lines are stacked in one CSS grid cell, so the
pill is as wide as its widest line (287px at 1:1) and never resizes mid-swap;
only opacity and a 6px y-offset cross-fade (180ms). folk animates the pill's
width with a character-count estimate — a chip that grows and shrinks every
2.4s is exactly the thing that would make this section feel busy, so the width
is fixed instead.

**The only orange** is the pulse ring on the Finch circle: 2px
`rgba(255,119,39,.45)`, `scale 1 → 1.12`, `opacity 1 → 0` over 900ms, a
`motion.span` keyed by `step` so it re-plays on every swap and is not rendered
at step 0 (nothing animates on load). Verified in the DOM mid-pulse:
`matrix(1.108…)` at opacity .099 → `matrix(1.12)` at 0.

**Broken-logo fallback.** `onError` on each `next/image` adds the slug to a
`broken` list and the tile renders the tool's initial in mono instead. Not
exercised in practice — all 13 files load (see verification).

## Deviations from the plan (and why)

1. **No `mounted` state.** The plan's house pattern is a mounted gate; the
   repo's ESLint config now fails `useEffect(() => setMounted(true), [])`
   outright (`react-hooks/set-state-in-effect`). `useInView` already provides
   the identical guarantee — false on the server, false on first client render,
   true only after an effect — so the extra state was both redundant and
   un-lintable.
2. **The dock is *on* the ring; tiles do not converge on it.** The plan
   suggested ring centre = centre of the active circle, with items lerping
   `radius → 0` at the dock slot. That makes each tool fly inward and back out
   — it reads as pop-in/pop-out, not as an orbit. Placing the ring so the dock
   is a point on it gives pure arc travel, which is both what folk does and
   what the task's verification asks to see ("tiles glide along the arc and
   swap into the dock").
3. **Canvas is 560×460, not 560×420.** The extra 40px is the bottom band: the
   plan wants a mono `FINCH` label *below and outside* the Finch circle **and**
   the status chip below the capsule. At 420 those two collide.
4. **Step is 2400ms and the visible falloff is ours, not folk's.** Interval per
   the task. The size/opacity table is a Vyso table (120/64/62/60/56/52/48/44
   against 1/.95/.80/.62/.44/.30/.18/.10) rather than folk's, because our arc
   is smaller and our tiles are white cards on cream rather than tiles on a
   dark hero. **No blur is used** — folk dims with `opacity + blur()`, and blur
   is the one thing this surface is not allowed to have.
5. **Inactive logos are `grayscale(1)` at 0.75, not 0.55.** The plan's 0.55
   multiplies with the tile's own opacity (0.95 at the nearest slot), which put
   the next-up logo at ~0.52 — too faint to read as a queue. 0.75 lands it at
   ~0.71.
6. **`Senses.tsx` grid: `items-start` → `items-center`, gap 32 → 24 below
   `lg`.** The copy block is ~200px and the orbit ~460; top-aligned they read as
   two unrelated things stacked in a row. Centring puts the paragraph against
   the capsule. The mobile gap change is because the canvas carries its own
   generous top margin.
7. **The leaving tile fades to 0 rather than lingering at folk's `.9`.** It
   travels down *in front of* the capsule (tiles have to sit above the capsule
   for the docked one to show at all), and a ghost logo drifting across the
   pill reads as a rendering bug. It shrinks 120 → 64 while it goes.
8. **The screen-reader list uses a second string (`short`), not the chip
   verb.** "Xero — Reading your books in Xero" is a bad sentence. `short` is
   the exact role copy the old five-row text list used, so the swap loses no
   words: "Xero — reads your books".

## Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Three errors, total — the same pre-existing ones.

```
$ npx eslint components/finch app/page.tsx
```
Clean, no output.

### Browser (dev server on :3000, Chrome)

**1440×900.** Canvas renders 558.8×459 at x 693.7 — the copy column ends at
~430, so nothing comes near it. The orbit cycles: sampled `whatsapp → sage`
over 6.2s and `quickbooks → outlook` over 6.2s (≈2.6 steps at 2400ms). The
status chip follows the dock exactly (`Reading what lands in Gmail` with a
colour Gmail mark while Gmail is docked; `Watching payday in SimplePay` at
1024). Docked logo is full colour, every other logo greyscale. Tile positions
as tabulated above — all inside the canvas.

**Hover pause.** The Browser pane's `hover` action delivers no mouse events to
this page at all (a `mousemove`/`pointerover` listener on the canvas logged
nothing across three attempts), so this was driven with dispatched
`pointerout`/`pointerover` pairs, which is the exact path React 19 synthesises
`onPointerEnter`/`onPointerLeave` from. Entered: `gpt` docked, still `gpt` 6.3s
later — **paused**. Left: `gpt → xero → whatsapp` over the next 6.3s —
**resumed**.

**Out-of-view pause.** Scrolled to `scrollY 0`: `gmail` docked, still `gmail`
7s later.

**Tab-hidden pause.** Code path only (`visibilitychange` listener); not
driveable from the tooling.

**Assets.** All 27 `<img>` elements report `naturalWidth > 0`; 13 unique
requests to `/finch/integrations/*.svg`, **none** routed through
`/_next/image` — Next serves SVGs from `public/` directly, so the leading XML
licence comment in `outlook.svg` / `gpt.svg` is a non-issue and the plain-`<img>`
escape hatch was not needed.

**375×812.** `document.scrollWidth === 375`. Canvas 335×275 full-width under
the copy; chip 233px wide at canvas-x 78.4 (inside 0…335), bottom 261 of 275.
Chip text holds at its 11px floor and is legible; `FINCH` at its 9px floor.

**1024×800** (narrowest `lg`, the tightest two-column case): canvas 475.75px at
x 493.25 vs the paragraph's right edge at 429.25 — 64px of clear gap.
`scrollWidth 1009` (no horizontal scroll).

**Page-level.** Exactly one `<h1>`. Console: only the React DevTools notice and
`[HMR] connected`, zero errors at any width. Screen-reader list present as
`ul.sr-only` with all 13 "Name — role" items; the canvas itself is
`aria-hidden="true"`.

## For the reviewer to eyeball

1. **Reduced motion with a real `prefers-reduced-motion: reduce` profile.**
   Code path only, same tooling limitation as v1/v2/v3-pt1: expected is Xero
   docked, the rest on the arc, no cycling, no pulse, and `transition: none`
   on every tile.
2. **Hover pause with a real pointer.** Verified via dispatched pointer events
   because the tooling cannot produce real ones; the handler is a plain
   `onPointerEnter`/`onPointerLeave` pair on the canvas, but it is worth one
   real mouse-over.
3. **Whether the queue is too faint.** Offsets +5…+7 sit at .30/.18/.10 and are
   barely there at 1440 — deliberate (folk goes to .05), but the two tables in
   `SLOTS` are a one-line change if it reads as under-rendered.
4. **Claude and GPT in the roster.** The research file flags these as
   "built with" badges rather than data senses; their chip lines are hedged
   ("Doing the reasoning with Claude", "Backing up the thinking with GPT")
   rather than implying a feed, but they still cycle through a section titled
   "senses". Dropping them to an 11-tool roster is a two-line delete.
5. **The 2400ms step.** A full lap is 31s, so a reader who lingers sees maybe
   four or five tools. Faster shows more but reads busier.

## Architect review v3 (Fable, 2026-08-15) — APPROVED for localhost review

Verified in-browser (tab fronted — note: background tabs throttle timers/IO and
made an earlier test look like a failure; not a bug): scroll-direction demo
down→forward→1c, up→reverse→1a, down→forward again; both H2 copy changes live;
integrations orbit renders folk-style capsule + Finch circle + docked tool +
greyed arc tiles + status chip, cycles ~2.4s (Yoco→Sage observed), fits at 375
(scrollWidth 375). Not exercisable with this tooling: hover-pause (pane's hover
delivers no mouse events) and OS reduced-motion — both code-verified only.
Content flag for Josh: Claude/GPT appear in the roster under a "senses" heading
("Backing up the thinking with GPT") — easy to drop from
`components/finch/integrations.ts` if unwanted.

---

# v4 (part A — orbit) — roster trim, ring gone, prompt line replaces the chip

Plan: `.ai/plan_homepage_finch_v4.md`, **Part A only**. Builds directly on v3
part 3 above — same widget, same mechanism, six refinements. Part B
(`/pricing`) was implemented separately, concurrently, and is not covered
here. Implemented 2026-08-15, same branch, **nothing committed**.

## Files

- MODIFY `components/finch/integrations.ts` — dropped `claude`/`gpt` (11 tools
  remain); the `verb` field (status-chip copy) was replaced by `prompt`, the
  "you ask Finch" line copy, verbatim from the plan.
- MODIFY `components/finch/IntegrationsOrbit.tsx` — removed the drawn ring and
  the status chip; re-centred the capsule; shrank the canvas; cut `SLOTS` from
  8 entries to 5 (dock + next 4 only); takes an `onActiveChange` callback.
- MODIFY `components/finch/Senses.tsx` — now `"use client"`; owns the one
  `active` index (`useState`, set from `IntegrationsOrbit`'s callback) and
  renders `IntegrationPrompt` twice off it.
- CREATE `components/finch/IntegrationPrompt.tsx` (`"use client"`) — pure
  presentational "you ask Finch" row, no timer of its own.

## Part 1 — roster (item 1)

`claude` and `gpt` deleted from `INTEGRATIONS`; `N` drops from 13 to 11. Their
SVGs were left on disk per the plan (`public/finch/integrations/claude.svg`,
`gpt.svg` untouched). The array's `verb` field went with the chip it fed;
`prompt` replaces it 1:1, same array position, holding the plan's verbatim
copy including the typographic quotes as literal characters in the string
(not added at render time).

## Part 2 — ring, visible queue, re-spaced arc (items 2–3)

The rim `<span>` (a plain circular border) is deleted outright. The tiles'
geometry is untouched by this — they still travel the same `RING_CX/RING_CY/
RING_R` circle, only the drawn line is gone (plan item 2 is explicit that the
path stays, just not the line).

`SLOTS` shrank from 8 rows to 5 (docked + offsets 1–4), sized/opacity exactly
per the plan's table (64@.95, 60@.8, 56@.6, 52@.4, all still `grayscale(1)` at
0.75 like every non-docked tile before them). `slotFor` still falls through to
`PARKED` for anything past offset 4 — now 5 tools per lap (down from 4) sit
parked at `{ size: 48, opacity: 0 }`, invisible but positioned and still
carrying the same CSS transition as everything else, so a tool fades in the
instant it crosses from offset 5 into the visible offset 4 rather than
popping — the plan's "still transitions" requirement falls out of the existing
mechanism for free; nothing tile-specific had to be added.

Re-spacing: `STEP_ANGLE` opened from 26° to 35° and `DOCK_GAP` from 6° to 4°
(`DOCK_ANGLE` unchanged at −5°) so the 4 visible upcoming tiles land at
rotations 56°, 21°, −14°, −49° from 12 o'clock — roughly 2 o'clock down to
10:30, arcing over the dock's shoulder as the plan asked. Checked against the
canvas bounds at every offset (see geometry below): nothing clips, and the
tightest tile-to-copy-column gap (1024px width) is unchanged from v3 at 64px,
since re-spacing only moved tiles vertically toward 12 o'clock, not further
left.

## Part 3 — centred capsule, trimmed canvas (item 4)

Capsule/Finch/dock did not need new proportions, just re-placement: the plan's
own inset pattern (Finch/dock centres sit 78px in from the capsule's respective
short edge — `TILE_BOX/2 + 18`) was kept, and `CAPSULE.x` was solved so the
380px-wide capsule centres in a 560px canvas: `CAPSULE.x = (560 − 380) / 2 =
90` (was 136). `FINCH.cx` (168) and `DOCK.cx` (392) shifted by the same −46px
— a pure horizontal translation, so `RING_CX` moved with them
and every other relationship (dock-to-Finch spacing, dock's angle on the ring)
is untouched.

Vertically, `CAPSULE.y` (176), `FINCH.cy`/`DOCK.cy` (254) and `LABEL_Y` (344)
are **unchanged from v3** — that headroom above the capsule is what the arc
geometry needs regardless of the chip, and cutting it would have reintroduced
the clipping v3 already solved for. What shrank is only the canvas's *bottom*
band, since there is no chip and its padding to leave room for below the
capsule any more: `CANVAS_H` dropped from 460 to **372** (label bottom ≈358 +
14px breathing room), landing close to the plan's "~560×360" estimate. Measured
in Chrome at 1440×900: canvas renders 558.8×371.2; capsule centre sits at real
x 973.1, canvas centre at real x 973.1 — exact match, confirmed both at the
`lg` two-column layout and at 375px where the canvas is full-width.

## Part 4 — prompt line replaces the chip, lifted state (item 5)

The status chip block (13 stacked lines in one grid cell) is deleted from
`IntegrationsOrbit.tsx` entirely, `CHIP_Y` with it. In its place,
`IntegrationPrompt.tsx` reuses the exact same stacking trick — all 11 lines
rendered in one CSS grid cell (`gridArea: "1 / 1"`), only the active one at
`opacity: 1`, the rest at `0` — so the row's height is fixed to its tallest
line (two lines at mobile width) and nothing reflows as the copy swaps. Style
per the plan: 32px white circle (`border-fn-line`) with the active logo at
20px, not greyed (this is the one place a non-docked-tile-style logo shows
colour, since the row *is* about the docked tool); text 17px/1.45 STIX Two
Text, regular, not italic, `text-fn-ink`; mono eyebrow `YOU ASK · FINCH DOES`
at 10.5px/.14em, `text-fn-muted`. Crossfade is opacity + `translateY(6px→0)`
over 180ms ease-out, `transition: none` under `useReducedMotion()`.

**State lift.** `Senses.tsx` became a client component holding
`const [active, setActive] = useState(0)`. `IntegrationsOrbit` still owns
every gating concern (hover/in-view/tab-visibility/reduced-motion) and the
interval — none of that moved — it just gained one more effect:
```ts
useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
```
This is the plan's explicitly-endorsed second option ("owns the interval and
calls `onActive(index)`"), not a duplicated timer. `active` is itself derived
from `step` (`step % N`), so this isn't "state that could have been computed
during render" from the parent's point of view — the parent has no way to
compute it, since it doesn't own `step`. Crucially, `onActiveChange` is an
opaque prop function, not a `useState` setter recognized within
`IntegrationsOrbit`'s own render, so `react-hooks/set-state-in-effect` — a
React-Compiler-backed rule that tracks *local* `useState`/`useReducer` setters
through the component's own data flow — has nothing to flag here; confirmed
clean by `npx eslint components/finch app/page.tsx`.

`IntegrationPrompt` is rendered twice by `Senses.tsx`, both reading the same
`active` prop, no independent state:
```tsx
<IntegrationPrompt active={active} className="hidden lg:block lg:mt-[28px]" />
...
<IntegrationsOrbit onActiveChange={setActive} />
<IntegrationPrompt active={active} className="mt-[24px] lg:hidden" />
```
The desktop copy lives inside the copy `<div>`, `mt-[28px]` under the
paragraph exactly as specified. The mobile one is a third top-level child of
the section's grid: at `lg:hidden` it renders `display: none` at desktop width
and contributes nothing to the two-column layout; at `<lg` (`grid-cols-1`) it
stacks in source order directly below the orbit, left-aligned with the copy
above it because both are children of the same padded grid with no extra
inset. Confirmed via `curl`: server HTML renders `active=0` (Xero) on both
copies with `opacity:1`/`aria-hidden="false"` on the Xero row and `opacity:0`
on the rest — no client JS required for the correct first paint.

## Part 5 — sr-only list (item 6)

Unchanged mechanism, now iterating 11 items instead of 13 (claude/gpt gone).
Still `Name — short`, still the pre-existing `short` field (untouched).

## Deviations from the plan (and why)

1. **Canvas is 560×372, not ~560×360.** The plan's estimate assumed cutting
   height freely; in practice the top headroom above the capsule (176px) is
   load-bearing for the arc's clipping margin (see v3 deviation 3/this
   report's Part 3) and could not shrink without tiles clipping the canvas
   top at the offsets nearest 12 o'clock. Only the bottom band (chip removed)
   shrank. 372 vs the estimated 360 is a 12px difference — close enough that
   no further tuning seemed warranted after visual and DOM-measured
   verification.
2. **`DOCK_GAP` dropped from 6° to 4°, not removed.** With only 4 visible
   upcoming tiles instead of 7, and `STEP_ANGLE` already opened up to 35°, the
   docked tile (120px) and its immediate neighbour (64px) have ample arc
   distance between them without needing as much extra gap as v3's 8-tile
   layout did.
3. **`IntegrationPrompt` keeps its own `broken`-logo fallback state**, separate
   from `IntegrationsOrbit`'s. This is a plain `onError` handler on a `next/
   image` — an event handler, not an effect — so it doesn't touch the lint
   constraint discussion above; it was duplicated rather than threaded through
   as a prop because the two components render different logo sizes (20px vs
   56px) from what could independently fail to load, and sharing state across
   them would have coupled two components the plan asked to keep only the
   active index in common.
4. **Mobile prompt's top margin is `24px`, not specified by the plan.** The
   plan gives an exact `margin-top: 28px` for the desktop placement but only
   "directly under the widget" for mobile. 24px matches the section's own
   mobile row gap (`gap-[24px]` on the grid), so the prompt reads as another
   row in the same rhythm rather than an arbitrary offset.

## Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Three errors, the same pre-existing ones, nothing new.

```
$ npx eslint components/finch app/page.tsx
```
Clean, no output — including the lifted-state effect discussed above.

### Browser (dev server on :3000, own tab fronted throughout — the pricing
### agent's tab collided with an unscoped `javascript_exec` call once; every
### check below re-confirmed against an explicit `tabId`)

**1440×900.** Exactly 5 tiles carry visible opacity at any time (docked + 4),
DOM-verified against the offset table (e.g. with `yoco` docked: `xero`→
parked/0.4, `whatsapp`→leaving/0, `sage`→+1/.95, `loyverse`→+2/.8,
`quickbooks`→+3/.6, `gmail`→+4/.4, `outlook`/`notion`/`n8n`/`simplepay`→
parked/0). No ring element in the DOM. Capsule centre (real x 973.1) matches
canvas centre (real x 973.1) exactly. The prompt line under the copy paragraph
tracked the dock across four separate docked tools (Sage, WhatsApp, Xero
after a full lap, Yoco) with matching prompt text and logo each time.

**Hover pause / resume.** Dispatched `pointerenter`/`pointerover` on the
canvas (same synthesis path v3 used, since the pane's native `hover` action
still delivers no events to this page): active tile held at `yoco` for 5s+
under hover — paused. Dispatched `pointerleave`/`pointerout`: active advanced
over the following seconds — resumed.

**Out-of-view pause.** Scrolled to `scrollY 0` (section is ~6656px down the
page): active held at `sage` across a clean 6s window — paused. An earlier,
noisier attempt appeared to show it still advancing, but that measurement had
several extra tool round-trips (and their latency) between the scroll and the
check; a tight scroll→wait→check sequence confirmed the pause is correct.

**375×812.** `scrollWidth === innerWidth === 375`. Capsule centre (real x
187.5) exactly matches the viewport centre (187.5). Prompt line renders under
the widget, left-aligned with the copy above, `YOU ASK · FINCH DOES` eyebrow
and matching logo/text pair, no layout shift observed switching between short
and long prompt lines.

**1024×800** (narrowest `lg`). Copy column right edge at 429.25, canvas left
edge at 493.25 — 64px clear gap, unchanged from v3. `scrollWidth 1009` (no
horizontal scroll).

**Page-level.** Console clean (no errors) at 1440, 1024 and 375. SSR/first-
paint verified via `curl localhost:3000/`: server HTML has `active` index 0
(Xero) on both `IntegrationPrompt` renders and the docked tile, no ring
markup present, `SLOTS`/`PARKED` values baked into the inline styles matching
the table above.

## For the reviewer to eyeball

1. **Reduced motion with a real `prefers-reduced-motion: reduce` profile.**
   Same tooling limitation as v1–v3: code path only (`useReducedMotion()` now
   also gates `IntegrationPrompt`'s crossfade, not just the orbit).
2. **Hover pause with a real pointer** — verified via dispatched events per
   above, worth one real mouse-over.
3. **The re-spaced arc's exact angles (56°/21°/−14°/−49°).** These hit
   "roughly 10 → 2 o'clock" within the constraint that the canvas top headroom
   couldn't shrink (deviation 1); if the queue should sweep further toward
   10 o'clock specifically, `STEP_ANGLE` is the one number to raise, but
   raising it further pushes the closest-to-12-o'clock tile nearer the canvas
   top edge and would need `CANVAS_H`/`CAPSULE.y` revisited together.
4. **`IntegrationPrompt`'s 32px circle for the active logo.** It's rendered in
   colour (not greyscale) since the row is specifically about the docked
   tool — worth a glance next to the widget's own docked-tile treatment to
   confirm they read as the same idea in two places.

---

# v4 (part B — pricing) — `/pricing` rebuilt in the Finch design language

Plan: `.ai/plan_homepage_finch_v4.md` **Part B**. Design: `.ai/design/Pricing.dc.html`.
Copy/positioning source: `.ai/plan_site_rebrand.md` Step 4 + AC8 (honesty).
Implemented 2026-08-15. **Nothing committed.** Part A (orbit) was owned by a
concurrent agent — no file it owns was touched here.

## Files created

| File | What |
|---|---|
| `components/finch/pricing/pricing-data.ts` | All page content: `PRICE`, `DIRECT_ANSWER`, `FOUNDING_TERMS`, `INCLUDED_GROUPS` (the five accordion groups), `STRAIGHT_ANSWERS`. Modules and integrations are *derived* from the existing registries, not retyped. |
| `components/finch/pricing/pricing-jsonld.ts` | `buildPricingSchema()` — one `@graph`: Product (3 Offers) + FAQPage + BreadcrumbList, all values read from `pricing-data.ts`. |
| `components/finch/pricing/PricingHero.tsx` | Server. Eyebrow, the `<h1>` price, "Everything included.", the AEO direct answer, founding-terms strip. |
| `components/finch/pricing/WhatsIncluded.tsx` | Server. Native `<details>`/`<summary>` accordion, first group open, CSS-only chevron, `Full FAQ →`. |
| `components/finch/pricing/StraightAnswers.tsx` | Server. The four Q&As as a `<dl>`. |
| `components/finch/pricing/AcademyCard.tsx` | Server. Secondary card: R500 / seat, `COMING SOON`, `Register interest` → `/contact?topic=academy`. |
| `components/finch/pricing/AuditCta.tsx` | Server. Design copy verbatim, orange CTA → `/contact`. |

## Files modified

- `app/pricing/page.tsx` — **full replacement**. Server component; `.finch-site`
  wrapper, `FinchNav active="pricing"`, the five sections, `FinchFooter`. New
  `metadata` (title/description/canonical/robots/OG/Twitter) and the single
  JSON-LD script. The old Navbar / LazyShaderBackground / PricingSection /
  SiteFooter render path is gone from this route.
- `components/finch/FinchNav.tsx` — added the optional `active` prop
  (`"industries" | "pricing" | "login"`), exported as `FinchNavSection`. The
  three text links became a `LINKS` map; the active one gets `text-fn-ink`
  (#14120E) and `aria-current="page"`, the others keep `text-fn-ink-2`
  (#4A463C). `/` passes nothing, so the homepage nav is unchanged visually
  (only the class-attribute ordering differs).
- `app/sitemap.ts` — `lastModified: new Date("2026-08-15")` on the `/pricing`
  entry only. No other entry touched (none of them carries a date).
- `app/globals.css` — **one-rule bug fix**, see deviation 1.

## The exact "What's included" content, with sources

**Group 1 — The platform** (open by default). Generated from
`MARKETING_MODULES` (`lib/marketing/modules.ts` → `module-data/*.ts`), in
registry order, as `name — tagline`:

| Item | Source field |
|---|---|
| OrderFlow — From incoming order to fulfilment and invoicing in one flow. | `orderflow.tagline` |
| Doc-U — Turn incoming documents into reviewable data, not retyped data. | `docU.tagline` |
| ProcurePulse — Buying decisions grounded in real stock movement. | `procurepulse.tagline` |
| PricePilot — Keep selling prices connected to current cost. | `pricepilot.tagline` |
| PlanWise — Set the target. See how the operation is tracking against it. | `planwise.tagline` |
| WasteWatch — Make preventable waste visible to the people who can act. | `wastewatch.tagline` |
| ShiftBoard — Labour deployment, visible alongside the rest of the operation. | `shiftboard.tagline` |
| SupplySync — Supplier history and risk, in one searchable record. | `supplysync.tagline` |
| InsightGen — Cross-workflow data, turned into reports and alerts. | `insightgen.tagline` |
| ServiceDen `LIMITED ROLLOUT` — A connected front office for service businesses. | `serviceden.tagline` + the chip (see deviation 3) |

**Group 2 — The agents.** Copy verbatim from
`components/finch/WhatFinchWatches.tsx`, Title Case instead of mono caps, plus
the AC8 status chips:

| Item | Chip | Source |
|---|---|---|
| Document intelligence (Doc-U) — Invoices, statements and delivery notes read into structured, reviewable line items. | `LIVE` | `module-data/doc-u.ts` description/capabilities; AC8 says Doc-U is the only live one |
| Price Watch — Supplier prices, line by line, against six months of memory. | `ROLLING OUT` | `WhatFinchWatches.tsx` + parent plan AC8 |
| Recon — What was invoiced against what actually arrived at the back door. | `FROM YOUR AUDIT ROADMAP` | `WhatFinchWatches.tsx` |
| Debtors — Accounts quietly thinning before they become bad debt. | `FROM YOUR AUDIT ROADMAP` | `WhatFinchWatches.tsx` |
| Stock Sense — Stock on hand against the orders already on their way. | `FROM YOUR AUDIT ROADMAP` | `WhatFinchWatches.tsx` |
| The Brief — Monday morning on WhatsApp: the three things that matter. | `FROM YOUR AUDIT ROADMAP` | `WhatFinchWatches.tsx` |

**Group 3 — Integrations.** Generated from `INTEGRATIONS`
(`components/finch/integrations.ts`, Part A's 11-tool roster) as
`name — <short, sentence-cased>`: Xero (reads your books) · WhatsApp Business
(where Finch talks to you) · Yoco (watches the takings) · Sage (reads the
ledger) · Loyverse (sees what leaves the shelf) · QuickBooks (keeps the other
set of books) · Gmail (reads what lands in your inbox) · Outlook (watches your
Outlook inbox) · Notion (remembers what's written down) · n8n (runs the
workflows behind the scenes) · SimplePay (watches payday).
Footnote: `More on request — expanded mandates priced on scope.` (parent plan).

**Group 4 — Support.** Three lines only:
- *Monthly ops review* — With your Vyso lead, every month. → parent plan Step 4.
- *Hands-on implementation* — We configure the agreed workflow with your team
  and stay involved after launch. → `app/faq/page.tsx` ("Hands-on
  implementation is part of the Vyso model … remain involved after launch").
- *Cancel with 30 days' notice* — No lock-in. → parent plan Step 4.

**Omitted deliberately:** every "30-day / 60-day / ongoing support period"
claim in `app/faq/page.tsx` and `app/pricing-faq/page.tsx` — they are properties
of the retired Start/Create/Scale tiers. `grep -rn -i "business hours|email
support|WhatsApp support|support during" app components lib` returns **zero
hits**, so the plan's conditional "WhatsApp and email support during business
hours" line was **not** added.

**Group 5 — Onboarding.** The parent plan's sequence, numbered:
1 · Operations Audit (One week, R2,000, credited to your first month) →
2 · The leak report (Where the money is going, in rand, with the evidence
attached) → 3 · Activation (Agents and modules switched on in priority order
from the audit roadmap) → 4 · Your tools connected (Finch reads what you already
run. Nothing to migrate.) → 5 · First ops review (The monthly rhythm starts with
your Vyso lead).

## Deviations from the plan (and why)

1. **`app/globals.css` link-cascade fix (not in Part B's file list).**
   `.finch-site a { color: inherit }` was written unlayered, so it outranked
   every Tailwind utility (utilities are layered, this file is not). Measured on
   localhost: *all five* nav links computed `rgb(20,18,14)` — `text-fn-ink-2`
   was dead, and so was every `hover:text-fn-orange-deep` on a link in the Finch
   surface. Without the fix the plan's "Pricing in the active colour vs #4A463C"
   is unachievable. The rule is now wrapped in `@layer base`; the default still
   applies wherever a link sets no colour. Effect on `/`: nav Industries/Log in
   → #4A463C and footer links → #6B6659, i.e. **closer** to `Homepage.dc.html`,
   plus link hovers now actually work. Verified `/` renders unchanged otherwise.
2. **Metadata description trimmed to 154 chars.** The plan's own draft string is
   173, against its own ≤155 budget. Dropped "by Vyso" (carried by the title
   `… | Vyso`) and "operations" before "audit". Final: *"Finch costs R6,000 per
   location per month, everything included. Founding clients: setup waived,
   first month free, rate locked. Starts with a R2,000 audit."*
3. **ServiceDen carries a `LIMITED ROLLOUT` chip.** The plan asked for every
   marketing module; the copy rules at the top of `lib/marketing/modules.ts` say
   ServiceDen is gated to one internal Vyso account and is described as
   internal/limited-rollout rather than GA. Listing it unqualified under "what
   R6,000 buys" would break AC8, so it gets a chip instead of being dropped.
4. **Agent status chip reads `FROM YOUR AUDIT ROADMAP`**, not the plan's full
   "Activated from your audit roadmap" — the full phrase does not fit a 9px mono
   chip beside a name. Same meaning, and the Onboarding group states the full
   sentence.
5. **Straight answers are a two-column `<dl>` at ≥ md**, one column below. The
   plan specified `<dl>`/heading pairs but no layout; two columns keeps the four
   Q&As on one screen at 1440 without a scroll.
6. **Integrations and modules are imported, not retyped.** The plan said "pull
   real content from the repo"; deriving from `MARKETING_MODULES` /
   `INTEGRATIONS` means the pricing page can never promise something the rest of
   the site has dropped. Only the ServiceDen chip is a local override.
7. **`Register interest` → `/contact?topic=academy`.** `app/contact/page.tsx`
   does not read search params, so the query is inert (verified: `/contact?topic=academy`
   returns 200 and renders normally) — a hint for whoever picks up the enquiry.
8. **Academy JSON-LD offer has no `unitCode: "MON"`.** A workshop seat is not
   billed monthly; it keeps `referenceQuantity { 1, "seat" }` and
   `availability: PreOrder`. The Finch offer keeps `MON` + `"location"`.
9. **Footer gap** is a `pt-[40px] lg:pt-[68px]` wrapper rather than editing
   `FinchFooter` (which already carries `lg:pt-[72px]`), so the homepage footer
   rhythm is untouched. Design's 140px top ≈ 68 + 72.
10. **Mobile type/padding** for sections the design only specifies at desktop:
    section top padding 96→64px / 100→64px / 80→56px, H2 34→28px and 28→24px,
    hero top 110→56px. Desktop values are exactly the design's. Same approach as
    v1 deviation 4.

## Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Three errors, all pre-existing, all in the untracked WhatsApp work. Zero from
anything created or modified here.

```
$ npx eslint app/pricing components/finch      # clean, no output
$ curl -s localhost:3000/pricing | grep -c 'application/ld+json'   # 1
$ node -e '<extract + JSON.parse each block>'
  block 1 (from app/layout.tsx, sitewide): Organization, WebSite
  block 2 (this page):                     Product, FAQPage, BreadcrumbList
  both parse; Product carries 3 Offers (6000/ZAR/MON/location,
  2000/ZAR flat, 500/ZAR PreOrder/seat)
$ grep -o '<h1' | wc -l                        # 1
$ curl -s localhost:3000/sitemap.xml           # /pricing has
                                               # <lastmod>2026-08-15T00:00:00.000Z</lastmod>
$ for u in /faq /contact /contact?topic=academy /industries /login; do curl -o /dev/null -w '%{http_code}'; done
                                               # 200 across the board
```
(The `grep -c` is 1 because the served HTML is one line; there are two script
blocks — the sitewide one from `app/layout.tsx` and this page's. `/` behaves the
same way, so the acceptance check is unchanged in meaning: the page contributes
exactly one.)

### Browser (dev server on :3000, own tab fronted)

- **1440×900** — hero centred, 84px price with the 30px muted unit inline,
  founding strip three-across with `#F0EDE5` vertical hairlines; accordion:
  group 1 open on load, two-column item lists, chevrons `rotate: none` closed /
  `90deg` open with `transition-property: transform, translate, scale, rotate`
  at 150ms (Tailwind v4 animates `rotate`, not `transform` — a `transform`-only
  check reads "none" and looks like a failure); clicking summaries toggles
  `open` correctly; `scrollWidth 1425 ≤ innerWidth 1440`.
- **375×812** — hero 52px, strip stacks with horizontal hairlines, accordion one
  column, Academy card stacks, `scrollWidth === innerWidth === 375`.
- **Colour discipline** — a computed-style sweep for the three orange tokens
  returns exactly five elements: the two `Book your audit` CTAs and the three
  `FOUNDING TERMS` eyebrows. Nothing else on the page is orange.
- **Headings** — one `<h1>`, four `<h2>` (What's included / Straight answers /
  Rather run the playbook yourself? / It starts with a one-week Operations
  Audit.), no `<h3>`, no skipped levels.
- **Console** — React DevTools notice + HMR logs only. No errors, no warnings.
- **Regression** — `/` re-checked after the globals.css fix: renders as before,
  nav/footer link colours now match the design.

## Now unused (NOT deleted)

- `components/sections/PricingSection.tsx` — was the only consumer of the old
  Start/Create/Scale tier data; no longer rendered by any route (remaining
  mentions are comments in `app/globals.css` and `components/sections/ContactSection.tsx`).

## Still carrying retired tier copy (out of scope — the plan's later sweep)

`app/faq/page.tsx`, `app/pricing-faq/page.tsx`, `lib/marketing/learn-articles.ts`
and `components/sections/PricingSection.tsx` still mention R10,000 / R8,000 /
setup fees. The old `/pricing` metadata description was the in-page one and went
with this rewrite.

## Architect review v4 (Fable, 2026-08-15) — APPROVED for localhost review

Orbit: no ring, dock + 4 queued tiles, capsule centred (1440 column and 375
screen), Claude/GPT gone, "YOU ASK · FINCH DOES" prompt line under the copy
(≥ lg) / under the widget (< lg) tracking the dock. /pricing: hero per design,
Pricing active in nav, accordion 5 groups (platform 10 · agents 6 · integrations
11 · support 3 · onboarding 5), Straight answers, Academy secondary card (R500 /
seat, COMING SOON), audit CTA; one <h1>, 4 <h2>; JSON-LD parses (Product/
FAQPage/BreadcrumbList) alongside the sitewide Organization/WebSite; canonical
set; description 154 chars; 375 clean, no horizontal scroll. Accepted the
`@layer base` fix for `.finch-site a` (it was overriding Tailwind link colours
sitewide on the Finch surface — the fix moves `/` closer to the design).
Open for Josh: Academy shown as "coming soon"; Support lines limited to claims
already in repo copy.

## Next: vyso_v2.md (2026-08-15)
Master plan for every remaining marketing route + SEO/AEO/GEO strategy written
to `Software/vyso_v2.md` (copy in `.ai/vyso_v2.md`). Planning only — nothing
implemented. Phases 0–6 and 7 open decisions for Josh are listed there.
