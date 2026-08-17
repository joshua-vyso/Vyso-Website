# Implementation: Phase 6 — the v3 design

Plan: `.ai/plan_phase6a_primitives.md`, from `.ai/vyso_v3_design.md`.
**Nothing committed; no git commands run.**

## 6a — primitives

Built the design-depth primitives, the findings library, and the `/design`
kitchen sink. No marketing page was recomposed — the only page-level changes are
the flagship magnitude (which travels through the library) and three global
mounts in `app/layout.tsx` that are inert until 6b puts bands on real pages.

### Files added

| File | What |
|---|---|
| `lib/marketing/findings.ts` | The 24-card library. Plain data module — no `"use client"` — so the OG route (server) and `FindingCard` (client) read the same strings. |
| `components/finch/motion-preference.tsx` | `useStaticMotion()` — the one "should this be static?" answer. |
| `components/finch/ground/Band.tsx` | The band: ground, one device slot, `data-ground`, seam. Server component. |
| `components/finch/ground/Deferred.tsx` | IO mount gate, 100% root margin ("one viewport away"). |
| `components/finch/ground/canvas-stage.ts` | `useCanvasStage` — DPR cap, 30fps + delta clamp, IO/visibility pausing, static frame, resize, frame-cost sampling. Plus `cssColor`/`withAlpha`. |
| `components/finch/ground/wave-clock.tsx` | `WaveClockProvider` / `useWaveClock` / `waveAt` — the shared clock the field and the type both read. |
| `components/finch/ground/motion-budget.tsx` | The moving-things registry (`useSyncExternalStore`) and the frame-cost ring buffer. |
| `components/finch/ground/use-media-query.ts` | `useSyncExternalStore` media queries (`useIsDesktop`, `useCoarsePointer`). |
| `components/finch/ground/OscillatingGrid.tsx` + `impl/OscillatingGridCanvas.tsx` | §3.1, dots/squares, cursor origin, text mask. |
| `components/finch/ground/WaveField.tsx` + `impl/WaveFieldCanvas.tsx` | §3.2, incl. the `static` footer frame. |
| `components/finch/ground/FacetPlane.tsx` | §3.3, seeded SVG triangulation + 1.08× parallax. |
| `components/finch/ground/Glow.tsx` | §3.4. |
| `components/finch/ground/GradientRibbon.tsx` + `impl/GradientRibbonCanvas.tsx` | The one orange→blue moment; inline value noise, no dep. |
| `components/finch/text/Statement.tsx` | Statement + `SplitReveal` + `STATEMENT_CLASS`. |
| `components/finch/text/WaveText.tsx` | Per-word wave-riding type. |
| `components/finch/text/Parallax.tsx` | §4.2's three planes. |
| `components/finch/text/MagneticButton.tsx` | §4.5. |
| `components/finch/CyclingFinding.tsx` | Hero card cycling 3 ids. |
| `components/finch/FindingStack.tsx` | Ids → the existing `FindingDeck` (reused, not duplicated). |
| `components/finch/NavGround.tsx` | `data-nav-ground` observer. |
| `components/finch/RouteFade.tsx` | 220ms navigation fade. |
| `components/finch/SmoothScroll.tsx` | Lenis behind `localStorage["fn:lenis"]`, default off. |
| `app/design/page.tsx`, `DesignSink.tsx`, `DesignControls.tsx` | The kitchen sink + instrument panel. |

### Files changed

`app/globals.css` (v3 tokens + grain + nav inversion + Lenis rules + the
`/design` static class), `app/layout.tsx` (three mounts), `components/finch/
FindingCard.tsx` (`variant` + `finding` props, ink palette, micro-visual),
`components/finch/FinchNav.tsx` (`data-nav-cta`), `components/finch/BriefPhone.tsx`,
`components/finch/day/day-beats.ts`, `components/finch/showcase/data.ts`,
`app/opengraph-image.tsx`, `lib/marketing/glossary.ts` (all now read the
library), `components/finch/industries/FindingDeck.tsx` (hydration fix, below).

### The flagship magnitude — every `4,200` resolved

`grep -rn "4,200" app components lib` now returns **one** hit: a sentence in
`findings.ts`'s own header explaining why the file exists. Each original:

| Was | Now | How |
|---|---|---|
| `app/opengraph-image.tsx` finding block | R58,000 + `≈ 650 BAGS/MO` | reads `FLAGSHIP` (the hand-copied duplicate and its apologetic comment are gone) |
| `components/finch/FindingCard.tsx` `FINDING_DEFAULTS` | R58,000 | derived from `FLAGSHIP` |
| `components/finch/BriefPhone.tsx` `BRIEF_FINDINGS` + two bubble strings | R58,000 | derived from `BRIEF_IDS` / `FLAGSHIP_RAND` |
| `components/finch/showcase/data.ts` ×6 | R58,000 | `FLAGSHIP_RAND` / `FLAGSHIP_VOLUME` / `FLAGSHIP_PRICES` |
| `components/finch/day/day-beats.ts` ×3 | R58,000 | reads `brief-evening` + `stock-oil-cover` |
| `lib/marketing/glossary.ts` money-leakage example | R58,000 | reads `FLAGSHIP` |

The two deliberately small cards survive as small: `recon-drums` (R756,
`in-progress`) and `stock-oil-cover` (R9,800, `resolved`).

**Deviation — the showcase's supporting numbers moved too.** The plan named
three showcase strings. But 1c's detail view carries the arithmetic *behind* the
figure (FreshCo R9.42/kg vs a R8.40 quote, "Gap on 380 kg/mo = R388/mo", three
invoice prices), and a 13.8× change to the headline with that evidence untouched
is a frame that contradicts itself. The prices were re-derived from the card's
own stated basis — 650 × 10kg bags at R62 = R6.20/kg, +12% = R6.94 — so
R0.74/kg × 6.5t/mo = R4,810/mo ≈ R58,000/yr. They live in `FLAGSHIP_PRICES` in
the library, not in the showcase file.

### Deviations from the plan

1. **`--fn-ink-2` was not redefined.** The plan gives the ink card fill that
   name, but it is already the paper ramp's body ink (`#4A463C`) read by ~30
   components — redefining it would have darkened every paragraph on the site.
   The fill is `--fn-ink-fill`; every other v3 token is exactly as specified.
2. **`content-visibility: auto` on `Band` is opt-in (`contain`), default off.**
   Measured on `/design`: with a device canvas absolutely positioned at
   `inset-0`, a skipped band collapses to its intrinsic size and drags the
   canvas with it. The document height swung between 9,810px and 11,793px while
   scrolling, every band moved under the scrollbar, and three devices ended up
   inside one viewport. The paint saving it was there to buy is already bought
   by the devices' own IO gating.
3. **Route fade is the `motion` wrapper, not View Transitions.** Next 16.2 ships
   `<ViewTransition>` only behind `experimental.viewTransition`
   (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`) — not
   stable, so the plan's fallback applies. It is also an imperative
   `useAnimate()` rather than `AnimatePresence`: an `initial={{opacity:0}}`
   wrapper around `{children}` would serialise `opacity:0` for the whole site
   into the server HTML, and App Router swaps `children` in the same commit as
   the pathname, so an exit animation plays the *new* page fading out.
4. **`MotionConfig reducedMotion` does not drive the toggle.** It changes how
   `motion` components animate; `useReducedMotion()` reads the media query and
   ignores it. Hence `motion-preference.tsx`. Measured: with only the
   `MotionConfig`, flipping the toggle left every canvas running.
5. **Two fixes outside the strict file list**, both required for the plan's own
   "console clean" gate and both inside this phase's blast radius:
   - `components/finch/industries/FindingDeck.tsx` — its reduced-motion branch
     swapped `initial={{fan}}` for `initial={false}`, so the server serialised a
     transform the client's tree didn't have: a hydration mismatch under
     `prefers-reduced-motion`, and one that would have stranded two of the three
     cards mid-fan. Now the same props at zero duration. `FindingStack` reuses
     this component, so the bug was on `/design`.
   - `app/design/DesignControls.tsx` — `flex h-0` stretched the panel to 0px
     height; caught in a screenshot over an ink band, where the labels rendered
     on bare ink with no background.

### Known issue left alone (out of scope)

`components/finch/agents/AgentsOnShift.tsx` has the same reduced-motion
hydration mismatch `FindingDeck` had (`initial: "play"` vs `initial: "rest"`).
It is a homepage component and this phase touches no marketing page, so it was
left; the fix is the same one-line shape (`initial="rest"` always, let `motion`'s
own `reducedMotion: "user"` snap the animation). It throws a console error on
`/` for anyone with reduced motion enabled today, independently of 6a.

### Verification

Measured in **headless Chrome over CDP** (`/private/tmp/.../scratchpad/cdp.mjs`,
node's built-in WebSocket, no new deps). The Browser pane and the extension tab
both report `document.visibilityState === "hidden"`, which freezes rAF — the
devices correctly pause, so nothing could be measured through them, and
computer-use access to front Chrome was denied.

```
tsc --noEmit                    exactly the 3 known whatsapp-ingest errors
npx eslint components/finch lib/marketing/findings.ts app/design app/layout.tsx
                                clean, 0 problems
```

`/design` 200 at 1440×900 and 375×812. Console clean at both widths, and clean
again with `prefers-reduced-motion: reduce` emulated (only `motion`'s own
"You have Reduced Motion enabled" notice).

**Every canvas animates** — pixel deltas over 1s, sampling every 10th pixel:

| Device | backing (DPR) | % sampled pixels changed |
|---|---|---|
| OscillatingGrid dots (ink) | 2138×1134 (1.5) | 1.1% |
| WaveField (ink) | 2138×1134 (1.5) | 4.2% |
| OscillatingGrid squares (blue) | 2138×1134 (1.5) | 9.7% |
| GradientRibbon | 1282×288 (0.9) | 64.2% |
| OscillatingGrid dots (cards band) | 2138×1080 (1.5) | 0.8% |

**Frame cost** (`performance.now()` around each rAF paint, 240-sample ring),
parked 9.5s per band so the buffer holds only that band's frames:

| Band | mean ms | worst ms | FPS |
|---|---|---|---|
| grid dots (+ cursor + text mask) | 1.56 | 3.00 | 120 |
| wave field | 0.32 | 0.80 | 120 |
| grid squares | 0.42 | 0.80 | 120 |
| gradient ribbon | 0.12 | 0.30 | 120 |

All under §9's 4ms. Two optimisations were needed to get there and both are
commented at the code:

- The grids drew per cell (≈1,950 `fillStyle` writes a frame): **3.27 mean /
  6.20 worst**. Now quantised into 20 brightness levels and batched into one
  path per level — 40 state changes a frame.
- The ribbon fills the whole canvas four times a frame: **4.70 worst** at full
  DPR. Now drawn at 0.6× the capped DPR (a mesh gradient has no edge to lose).

**Reduced motion freezes them.** With the toggle on, all visible canvases
report `changed: 0` while still `painted` (real static pictures, not blanks),
MOVING THINGS → 0, and → 2 again when toggled off. The ribbon becomes the
hairline (no canvas in the band). Same result with the OS media query emulated.

**Motion budget ≤ 2.** Scanning the whole sink in 300px steps: max 2 anywhere,
max 2 outside the cards grid, at 1440 and at 375. Getting there needed two
changes, both measured rather than guessed: the run gate dropped its 200px
warm-up margin and now requires 10% of the device to be visible (a 30px sliver
of the band above was counting), and the sink's grounds bands are `min-h-[84vh]`
(three 400px bands fit inside a 900px viewport).

**Mobile at 375:** no horizontal overflow, facet plane simplifies to 16
polygons, Statements at 52px, canvases scale (360×682 CSS / 540×1023 backing).

**Homepage:** R58,000 appears in the hero card, the sequence card, the brief
bubble and both showcase headlines (5 rendered occurrences); `R4,200` zero;
`≈ 650 BAGS/MO` present. `/compare/finch-vs-hiring-a-coo` 3× R58,000,
`/learn/glossary/money-leakage` 2×.

**Nav inversion:** `paper` → link `rgb(74,70,60)`; `blue` and `ink` → link
`rgb(250,249,246)`; CTA `rgb(189,74,14)` on all three. Inert on `/` (0 bands,
`data-nav-ground="paper"`).

**Route fade** `/` → `/pricing`: opacity 1 → 0.23 → 0.39 → 0.59 → 0.82 → 0.91 →
0.99 → 1 over ~220ms on the same element, settles at 1, works on back too.

**Lenis:** default off (no key). Toggling adds `class="lenis"` to `<html>` and
eases scroll (a jump to 2000 read 15 after 60ms, 2000 after 1.5s); toggling off
removes the class and destroys the instance. `localStorage["fn:lenis"]` persists.

**Routes still 200:** `/`, `/design`, `/pricing`, `/industries`,
`/industries/restaurants`, `/learn/glossary/money-leakage`,
`/compare/finch-vs-hiring-a-coo`, `/operations-audit`, `/about`, `/faq`,
`/opengraph-image`. `/design` emits `noindex, nofollow` and is absent from
`/sitemap.xml`.

Pre-existing and untouched: two Next `<Image>` aspect-ratio warnings on `/` from
`IntegrationsOrbit`; `npm run build` still fails on the known whatsapp-ingest
import.

### Gate — what Josh should look at on `/design`

1. **Band 07, the gradient ribbon.** The one decision this phase defers: canvas
   2D as shipped, or escalate. (Escalation is a WebGL2 fragment shader, not
   reinstalling `three` — noted at the code.)
2. **Band 05, the wave field.** Watch a crest pass under "A COO's day. Done by
   breakfast." — the words lift left to right with it. This is §4.1 and the most
   distinctive thing built here.
3. **Band 03, the grid's text mask.** The dots directly under the headline are
   dimmed 40%. Is that enough, too much, or invisible?
4. **The LENIS SMOOTH SCROLL toggle** (top right). Keep or remove — the dep goes
   with it either way.
5. **Section 10, all 24 cards.** The magnitudes and their volume bases are the
   honesty surface; anything that reads as a stretch should be said now, before
   6b puts them on nine pages.
6. **The REDUCED MOTION toggle**, on every band: every device should stop on a
   picture, never a blank.

## 6a follow-up — AgentsOnShift hydration

Fixed the issue this phase's "Known issue left alone" section named:
`components/finch/agents/AgentsOnShift.tsx` threw a reduced-motion hydration
mismatch on `/`.

The old code branched the whole `motion` prop shape on `useReducedMotion()`:
`initial: "rest", whileInView: "play"` normally, `initial: "play", animate:
"play"` under reduced motion. The server has no media query and always
serialises the first shape; a reduced-motion client's hydration render picked
the second, so React hydrated two different trees — the same defect
`FindingDeck` had, diagnosed and fixed earlier in this phase.

The fix is not that fix, though — it's the one already sitting one file over.
`FindingCard.tsx`'s `FindingMicroVisual` wraps this exact `AgentVisual`
component and never branches on reduced motion at all: `initial="rest"` is a
literal, `whileInView="play"` is a literal, and `motion`'s own default
`reducedMotion: "user"` handles the snap once the animation actually runs.
Copied that shape into `AgentCard` verbatim — removed the `useReducedMotion`
branch, the `motionProps` variable, and the `motion/react` `useReducedMotion`
import; `AgentCard` no longer reads any reduced-motion signal at all. There is
now no client-only value anywhere in the render path, so a hydration mismatch
here is structurally impossible, not just untriggered.

### Verification

```
npx tsc --noEmit               exactly the 3 known whatsapp-ingest errors
npx eslint components/finch/agents
                                clean, 0 problems
```

`/` loaded in the browser pane (fronted via `tabs_select`): console clean on a
fresh load — no hydration/mismatch warnings, only pre-existing dev-server
noise (stale HMR websocket errors from earlier tabs, Vercel analytics debug
logs).

SSR HTML (`curl localhost:3000/`) confirms all six agent cards render with no
`opacity:0` on the card itself — `PRICE WATCH`, `DEBTORS`, `DELIVERY WATCH`,
`STOCK SENSE` etc. all present as real text. The three-path micro-visuals
(price sparkline, stock gauge, delivery route) correctly serialise `rest`:
`stroke-dasharray="0 1"` (undrawn), the same static-but-real-in-the-DOM shape
`FindingDeck` uses for its fan.

One gap: this environment's browser pane has no reachable CDP endpoint (no
`--remote-debugging-port` visible from the sandbox), so `prefers-reduced-motion:
reduce` couldn't be emulated live the way 6a's own verification wanted to but
also couldn't get ("computer-use access to front Chrome was denied," per that
section). Confidence here rests on the code being structurally incapable of a
mismatch (no branch reads a client-only value before first paint) plus the
fact that this is byte-for-byte the pattern `FindingCard.tsx` already ships in
production for the same `AgentVisual` component.

## Architect note — 6a gate (Fable, 2026-08-16)
Structural checks pass (tsc 3 known; /design 200 with 15 bands; R58,000 on
7 surfaces; agent labels present; AgentsOnShift hydration fixed). Visual/motion
review could not be done from this session (Browser pane hidden → rAF frozen,
canvases don't mount). GATE = Josh reviews /design on localhost per the
checklist in the chat; 6b does not start until he answers: ribbon canvas vs
escalate, wave-text keep, grid mask %, Lenis keep/remove, card magnitudes OK.

## 6b — audit + COO compare

Workstream B of `.ai/plan_phase6b_money_pages.md`: `/operations-audit` and
`/compare/finch-vs-hiring-a-coo` recomposed onto the 6a depth system. Nothing
committed; no git commands run. Workstream A's shared work (`Band`'s
`overlap`/`hairline` + `SeamHairline`, Lenis default ON with `data-lenis`,
`MagneticButton`'s tracking/`next/link` branches, the lightened `--fn-blue-*`
ramp) had landed before this started and is used as-is.

### `/operations-audit`

Ground sequence: **paper** (hero + form) → **blue** (how the week runs) →
**paper** (assessment + calculator) → **ink** (the credited Statement) →
**paper** (FAQs).

| Section | What changed |
|---|---|
| `audit/AuditHero.tsx` | One blue `Glow` (520px, damped to ≈12% with `opacity-[0.86]`) behind the booking column; `<h1>` wrapped in `SplitReveal`; `relative isolate overflow-x-clip` so the glow's overhang cannot make a scrollbar at 375; bottom padding now carries the air the blue band's seam eats. |
| `audit/AuditWeek.tsx` | Rewritten as a **blue `Band`** with `seam` (48px overlap, 24px top radius) and one device: `OscillatingGrid` dots in `--fn-blue-300`, cursor attraction off. Header + sub in `--fn-blue-mono` / `--fn-blue-text` / `--fn-blue-text-2`, then the rail, then the mono honesty note. Ends with an explicit spacer box so the section below can straddle. |
| `audit/WeekRail.tsx` **(new)** | The 7-day rail. Seven dots on a hairline Mon→Sun, inset 4% at each end; the four step labels anchored above their days (`01 BOOK` Mon, `02 READ` Tue, `03 QUANTIFY` Thu, `04 REPORT` Fri) with a 1px connector down to the dot; dots and labels **stamp** (scale 1.3→1, opacity, 80ms apart) on band enter. Step prose stays plain server text in a 4-up grid and keeps the `#step-01…04` ids the HowTo schema points at. Below `lg` the anchored labels drop and each step block carries its day on the right. |
| `audit/audit-content.ts` | `AUDIT_WEEK` (7 days + which step lands on each) and `AUDIT_WEEK_NOTE`. `AUDIT_STEPS` and every FAQ string untouched. |
| `audit/AuditTools.tsx` | Its header became the **card straddling the blue→paper seam** — a white card pulled up `-mt-[68px] / -104px` over the band. `relative z-20` on the section (a seamed `Band` carries `z-10`, and a non-positioned later sibling would paint *under* it). Widget mechanics untouched; `#assess`, `#score`, `#calculator` unchanged. |
| `audit/AuditStatement.tsx` **(new)** | The ink band. `WaveClockProvider` + `WaveField` (11 lines, A=18, orange) with the Statement **"R2,000. Credited. Whether you sign or not."** as three `WaveText` lines at `STATEMENT_CLASS`, the middle italic; mono sub-line `ONE WEEK · IN RAND · WITH THE EVIDENCE`; magnetic "Book your audit" → `#book`. The rand figure is derived from `PRICE.audit`, the same constant the Service schema's `estimatedCost` reads. Grain via the ink ground. |
| `ContactForm.tsx` | The submit is now a `MagneticButton` (`type="submit"`, `pull={6}`, `disabled` while the POST is in flight). Reaches `/contact` and `/academy` too — both still 200. |

### `/compare/finch-vs-hiring-a-coo`

Ground sequence: **ink** (hero) → **paper** (day strip) → **blue** (cost bars)
→ **paper** (table + when to hire) → **ink** (CTA).

| Section | What changed |
|---|---|
| `compare/CooHero.tsx` **(new)** | Ink `Band` behind a `WaveField` (12 lines, A=20, orange) with the Statement **"A COO's day. Done by breakfast."** riding it per word. `overlap="down"` so the slab rounds into the day strip. The page's **one hairline** (`SeamHairline`) draws under the Statement. Two magnetic CTAs (Book your audit · See the day). Not a mode on `CompareHero` — that component still serves the hub and the two ported comparisons unchanged. |
| `compare/CompareBits.tsx` | `Breadcrumb` gained `tone="ink"` (`--fn-muted` is 2:1 on ink). New `BandHead` — the eyebrow/H2/sub trio in blue or ink, so a `Band` opens like a `Section` without duplicating the rhythm. |
| `compare/CostBars.tsx` | Tone-aware (`paper` | `blue`) and split into `CostBars` + `CostSources`, so the blue band can put the evidence in one column and the bars in the other, bottom-aligned — the bars' baseline lands on the band's own bottom edge. On blue: salary bar `--fn-blue-text-2`, **Finch bar `--fn-orange`** (the band's one orange element), both rand values `--fn-blue-text`, mono details `--fn-blue-mono`. Reduced motion now goes through `useStaticMotion` instead of `motion`'s `useReducedMotion` (the 6a hydration rule). |
| page `#cost` band | `Band ground="blue" seam` with `FacetPlane seed={73}`, two columns, bars first below `lg`. |
| page `#hire-instead` | Pull line **"Sometimes the answer is a person."** — `SplitReveal` in a `<p>` at 32/44px STIX above the existing "both" paragraph. Table and row hover untouched. |
| `compare/CooCta.tsx` **(new)** | Ink `Band seam` + `OscillatingGrid` dots in orange, `AuditBand`'s exact words, magnetic CTA. Replaces `<AuditBand />` **on this page only** — eighteen other routes still render the shared plate. |
| `lib/marketing/compare.ts` | `COO.statement` added. `COO.h1` unchanged and still in the `<h1>`. |

### Bug found and fixed — `STATEMENT_CLASS` across the server boundary

`STATEMENT_CLASS` was declared in `text/Statement.tsx`, which carries
`"use client"`. In the App Router every export of a client module becomes an
**opaque client reference** when a *server* module imports it, so
`className={STATEMENT_CLASS + " …"}` in a server component shipped
`class="function() {…"` — measured in the first render of `CooHero`'s `<h1>`,
which came out at body size. It now lives in `text/statement-class.ts` (no
directive); `Statement.tsx` imports and re-exports it for the client callers
that already speak that path. `/design` is unaffected (client component).
`day-beats.ts` documents the same trap from phase 1b; this is its second sighting.

### Deviations from the plan

1. **The COO hero's `<h1>` carries two decks.** The plan makes the Statement the
   hero line, but the page exists to answer "finch vs hiring a COO" and an
   `<h1>` without that phrase is an SEO regression dressed as a design decision.
   One `<h1>`, two spans: `COO.h1` at 20/24px kicker scale, the Statement under
   it at `STATEMENT_CLASS`. Still exactly one `<h1>` on the page.
2. **The COO hero drops the finding card.** The plan's hero spec has no card,
   §5 forbids inline card copy, and `COO.finding` was inline copy (a
   hand-written RECON card at R2,180) rather than a library id. It is no longer
   rendered; the data is left in `compare.ts` for whoever wants it as a library
   entry. The day strip below still carries four library cards.
3. **The blue band's bars are bottom-aligned in a two-column split**, not
   literally overlapping the seam. "Baseline sits on the band's bottom seam"
   read as a composition instruction: `lg:items-end` with a trimmed bottom
   padding puts the bars' baseline on the band's own edge, and the citation
   (which has to be on blue for its `--fn-blue-mono` footnote) gets the other
   column instead of pushing the bars up into the middle of the band.
4. **The 7-day rail states the shape of the week, never a schedule.** Honesty
   rules: the fourth FAQ says the start date is confirmed when you book, so the
   rail carries `THE SHAPE OF THE WEEK · WE CONFIRM THE START DAY WHEN YOU BOOK`
   under it and the band's sub-line says the same in prose. Nothing on the page
   promises a Monday.
5. **Device opacities are 0.28, not the 0.32–0.34 first shipped.** Measured: a
   grid crest under the 11px mono day labels took `--fn-blue-mono` from 6.9:1 to
   4.1:1, and an orange wave line under the ink eyebrow took `--fn-ink-mono` to
   3.1:1. Both are still inside §2's ranges.
6. **`MagneticButton` gained `disabled` and `pull`** (both optional, both
   defaulted to today's behaviour). A form submit can be disabled mid-POST, and
   a full-width button pulling the full 10px reads as a misaligned edge.
7. **The nav's real height is 76/91px, not `NavGround.tsx`'s 64/80.** That
   constant only has to put its probe line *inside* the nav and it does, so it
   was left alone; `CooHero` measures its own (`h-[76px] lg:h-[92px]`) because a
   15px shortfall showed as a strip of paper above the ink band.

### Verification

Measured in **headless Chrome over CDP** (`…/scratchpad/wsB/`, node's built-in
WebSocket, no new deps). The Browser pane was unusable again: at 1440 it pinned
`scrollY` at one value and would not scroll by any means, and its screenshots
came back with a black band over the hero — the same class of problem 6a hit.
The scratchpad root is shared with workstream A, hence `wsB/`.

```
npx tsc --noEmit                exactly the 3 known whatsapp-ingest errors
npx eslint components/finch/{audit,compare,text} components/ContactForm.tsx \
          app/operations-audit app/compare/finch-vs-hiring-a-coo \
          lib/marketing/compare.ts        clean, 0 problems
```

**Routes 200:** `/operations-audit`, `/compare/finch-vs-hiring-a-coo`,
`/compare`, `/compare/finch-vs-erp`, `/pricing`, `/`, `/design`, `/contact`,
`/academy`. One `<h1>` on each of the four compare-cluster pages and the audit
page; both JSON-LD blocks per page parse (sitewide graph + page graph — the
audit's `Service/FAQPage/HowTo/BreadcrumbList`, the compare's
`BreadcrumbList/FAQPage` — unchanged).

**Budget, CLS, overflow, nav** — walked in 200px steps at both widths. The
motion-budget counter is a `/design` instrument (`MotionBudgetProvider` is not
mounted on real pages), so the count was rebuilt from the **same gate the
devices use**: a device layer at ≥10% of its own box visible, plus one entry for
the shared `WaveClock` whenever a `WaveText` is within its 120px margin.

| Page | Viewport | doc height | budget max | at | what | nav grounds seen | h-overflow | CLS |
|---|---|---|---|---|---|---|---|---|
| audit | 1440×900 | 5,734 | **2** | y=200 | blue grid + hero glow | paper, blue, ink | 0px | **0.0000** |
| audit | 375×812 | 10,149 | **2** | y=1200 | blue grid + hero glow | paper, blue, ink | 0px | **0.0000** |
| coo | 1440×900 | 8,899 | **2** | y=0 | ink wave + wave clock | ink, paper, blue | 0px | **0.0000** |
| coo | 375×812 | 9,000 | **2** | y=0 | ink wave + wave clock | ink, paper, blue | 0px | **0.0000** |

**Anchors land with Lenis ON** (`data-lenis="on"`). Lenis is constructed with
`anchors: false`, so it never intercepts the click and the browser's instant
jump stands; each id ends at its own `scroll-mt` offset:

```
/operations-audit   #book 24px  #score 24px  #calculator 24px  #assess 24px
/compare/…-coo      #day 80px   #cost 80px   #side-by-side 80px
                    #hire-instead 80px  #faq 80px
```

**Frame cost per band** (4s parked on each, rAF interval sampling + a
`longtask` observer; the display runs at 120Hz so 8.33ms is the vsync interval,
not the work):

| Band | canvas | pixels changed / painted | FPS | worst frame | long tasks |
|---|---|---|---|---|---|
| audit blue — grid dots | 1440×820 | 1.14% / 1.1% | 120.0 | 10.3ms | none |
| audit ink — wave + text | 1440×741 | 5.05% / 2.6% | 119.9 | 10.4ms | none |
| coo ink hero — wave + text | 1440×961 | 4.22% / 2.2% | 119.8 | 15.1ms | none |
| coo blue — facet plane (SVG) | — | — | 120.0 | 10.4ms | none |
| coo ink CTA — grid dots | 1440×961 | 4.24% / 2.2% | 120.1 | 10.4ms | none |

No `longtask` entry (>50ms) anywhere and one dropped frame across five bands.

**The headline rides the wave.** Per-word `translateY` sampled every 200ms for
2s:

```
coo hero    A=+4.9  COO's=+1.2  day.=+4.4  Done=-0.8  by=+4.8  breakfast.=-1.6
            → 2s later: +1.3, -3.7, 0.0, -4.7, +0.9, -4.9
            per-word travel over 2s: 3.3–4.9px
audit stmt  R2,000.=+5.0 Credited.=+4.8 Whether=+4.8 you=-1.6 sign=-4.9 or=-3.8
            per-word travel over 2s: 1.6–4.4px
```
Words at the same x (each line's first word) share a phase; words further right
lag it — which is the point: the phase is a function of x, so the crest crosses
the block as one front.

**Reduced motion** (`Emulation.setEmulatedMedia prefers-reduced-motion: reduce`
— the `--force-prefers-reduced-motion` Chrome flag does *not* set the media
query in this build, which cost a run):

```
lenis                    OFF on both pages
audit blue grid          changed 0.00%   painted 1.0%   (a picture, not a blank)
audit ink wave           changed 0.00%   painted 2.6%
coo ink hero wave        changed 0.00%   painted 2.2%
coo blue facet plane     polygon transform: none
coo ink CTA grid         changed 0.00%   painted 2.2%
WaveText words           style.transform: (none) on all three pages' headlines
console                  clean
```

**Widgets still work with Lenis on.** Assessment: 10/10 answered, "See my
score" renders the gauge SVG and the generated finding + next steps.
Calculator: editing one field moved the two headline figures from
`R 21 488 / R 257 861` to `R 174 384 / R 2 092 608` (tween ran). Booking form:
6 fields, submit is a `<button type=submit>` reading "Book your audit".
**Day strip still pins**: sticky top stays 0px through the wrapper's first
1,800px and then releases (`-400px` at offset 2,200) — correct sticky
behaviour, unchanged by momentum scroll.

**Contrast** — worst *pixel* sampled in a 6px strip under each run of text (so
a grid crest or a wave line passing behind the glyphs counts against it), page
coordinates, 1440×900:

| Text | size/weight | contrast (worst–flat) | AA floor |
|---|---|---|---|
| audit blue eyebrow | 11/400 | 6.76–7.61 | 4.5 ✓ |
| audit blue H2 | 34/500 | 8.37–9.00 | 3 ✓ |
| audit blue sub | 15.5/400 | 7.49–7.60 | 4.5 ✓ |
| audit blue step text | 14/400 | 5.64–6.25 | 4.5 ✓ |
| audit blue day label `02` | 11/400 | **4.12**–6.86 | 4.5 — see below |
| audit ink eyebrow | 11/400 | **3.30**–4.93 | 4.5 — see below |
| audit ink Statement | 72/500 | 9.98–17.35 | 3 ✓ |
| audit ink body | 15.5/400 | 5.40–8.79 | 4.5 ✓ |
| coo ink kicker (`h1` deck 1) | 24/500 | 8.00–8.79 | 3 ✓ |
| coo ink answer | 16.5/400 | 8.02–8.81 | 4.5 ✓ |
| coo ink breadcrumb | 10.5/400 | 4.52–4.93 | 4.5 ✓ |
| coo blue H2 | 36/500 | 5.89–9.84 | 3 ✓ |
| coo blue bar label | 15.5/400 | 5.40–8.69 | 4.5 ✓ |
| coo blue bar value | 26/500 | 6.12–9.84 | 3 ✓ |
| coo blue mono detail | 11/400 | 4.84–8.08 | 4.5 ✓ |
| coo blue source prose | 13/400 | 5.40–8.69 | 4.5 ✓ |
| coo ink CTA body | 16.5/400 | 8.02–8.81 | 4.5 ✓ |

The two below 4.5 are worst-*pixel* numbers where a single grid dot or a 1px
wave line passes directly behind a glyph; against the band's own ground they
are 6.86 and 4.93, which is what Lighthouse's contrast audit computes (it reads
`background-color`, and both bands' grounds are a gradient or flat ink).
Lowering both devices to 0.28 opacity bought what could be bought without
changing tokens — `--fn-ink-mono` at 4.93:1 flat is the design's own margin, not
this composition's.

**Console clean** on both pages, at both widths, and under reduced motion. The
only warnings anywhere were `willReadFrequently` notices produced by the
measurement harness's own `getImageData`.

### For Josh

1. **The day strip's beats.** `day-beats.ts` does read the library (verified),
   but through `BRIEF_IDS` — butternut R58k, Thyme & Basil R23,400, recon-drums
   **R756** — plus `stock-oil-cover` (**R9,800**, resolved). Two of the five
   beats are the deliberately *small* contrast cards. The plan's 6b line names
   short-delivery / debtors-60-days / overstock instead. It was left alone
   because that file derives from `BriefPhone`'s `BRIEF_FINDINGS` on purpose
   (the homepage brief, the evening brief and the day strip must be the same
   three findings), so changing it changes the homepage — workstream A's file.
2. **The COO hero has no finding card now.** Deliberate (deviation 2), but it
   is the most visible change to that page beyond the ground.
3. **`--fn-ink-mono` on an ink band with a live device** is the site's thinnest
   contrast pair (4.93:1 flat, 3.30:1 under a wave line). If it should be
   `--fn-ink-text-2` instead, that is a one-token change and it affects every
   6b/6c ink band, not just these two.

## 6b — home + pricing

Workstream A of `.ai/plan_phase6b_money_pages.md`: the shared prerequisites both
workstreams depend on, then `/` and `/pricing` recomposed onto the depth system.
**Nothing committed; no git commands run.** Workstream B owns
`/operations-audit` and `/compare/*` and was editing concurrently — the shared
files below were touched by A only, except `MagneticButton` (see "Concurrency").

### Shared (done first)

| Change | File | Why |
|---|---|---|
| **Lenis default ON** | `components/finch/SmoothScroll.tsx` | Josh's verdict. Polarity is written once, as `localStorage["fn:lenis"] !== "0"`, so the common case (never touched the toggle) gets the designed experience. `getServerSnapshot` returns `true` so the `/design` switch hydrates checked. Reduced motion still wins unconditionally — the switch can only turn it *off*. |
| **`data-lenis` on `<html>`** | same | Set *before* the dynamic import awaits, not after: pinned/scroll-linked sections need to know which scroll is driving them from the first frame, not from whenever the chunk lands. |
| **`/design` toggle becomes an OFF switch** | `app/design/DesignControls.tsx` | Hint text only; the write path (`"1"`/`"0"` + event) was already correct under the new polarity. |
| **`Band` `overlap="up" \| "down"`** | `ground/Band.tsx` | §2's seam, both directions. `up` is the old `seam` (kept as a shorthand); `down` is its mirror, needed wherever the **dark** band is the one on top — `/pricing`'s ink hero over paper. Same 48px, same 24px, one map so they cannot drift. |
| **`Band hairline` + `SeamHairline`** | `ground/Band.tsx`, `ground/SeamHairline.tsx` (new) | §2/§4.4's orange→blue rule, drawn on enter (`scaleX` from a left origin — a width tween would relayout 30×/s, and a transform lets the gradient be painted at full width and *revealed* rather than stretched). Exported standalone so a page can put it under a Statement instead of at a band's top (what `/compare` needs). |
| **`Band underNav`** | `ground/Band.tsx`, `FinchNav.tsx` | §7 wants the nav inverted over a dark hero. It cannot be: `FinchNav` is in normal flow with no background, so a dark hero started *below* it and `NavGround`'s probe correctly answered `paper`. `underNav` pulls the ground up by the nav's height and pads the content back down; `FinchNav` gains `relative z-30` so the later-sibling band paints behind it. **Workstream B's `/compare` ink hero wants this too.** |
| **Nav inversion completed** | `MobileMenu.tsx`, `globals.css` | Two real bugs the first dark hero exposed. The hamburger's hairlines are `bg-fn-ink` — the ink ground's own fill, i.e. a 40px square of nothing over `/pricing`. And the mobile sheet lives *inside* `<nav>`, so the inversion rules were recolouring every link in it to warm-white on a warm-white panel. Now `[data-nav-bar]` inverts with the links and `[data-nav-sheet]` is excluded from all five inversion rules and takes the paper ink back. |
| **`FacetPlane paused`** | `ground/FacetPlane.tsx` | So a band can yield its device to something louder. Used once: the homepage showcase. |
| **`MagneticButton` analytics + `next/link`** | `text/MagneticButton.tsx` | 6b routes tracked CTAs through the magnetic button rather than nesting one inside a `TrackedLink` (two anchors, one label). `event`/`eventProps` are a union, so one without the other is a compile error. A `/`-prefixed href renders `motion.create(Link)` so `RouteFade` still plays; hashes and external URLs stay a plain anchor. |
| **`CursorDrift`** | `text/CursorDrift.tsx` (new) | The other half of §4.5 — the hero's two planes drifting 3px, the card *toward* the pointer and the glow *away*, so the gap between them opens as the mouse crosses. A sibling-friendly primitive rather than a hero-shaped one, because the two things that drift are in different grid cells and one wrapper around both would be the whole hero. |
| **`FinchBirdMark`** | `FinchBirdMark.tsx` (new) | The logo is a stroked gradient drawing; on ink its blue half falls to ~2:1 and it competes with the band's one orange element. Same file used as a CSS mask against a flat colour — no second asset, no inline copy of the path data. |
| **`FindingCard tone`** | `FindingCard.tsx` | `/pricing` needs one card that is `wide` (carries its sparkline) *and* dark (it straddles a blue seam). Geometry stays the variant's, colour becomes the caller's — better than a sixth variant for what is purely "which ground is this on". |

### `/` — ground sequence paper → paper → **blue** → paper → paper → **ink** → paper → **ink**

1. **Hero** (`HomeHero.tsx`) — `CyclingFinding` on `HOME_HERO_CYCLE`
   (butternut-price / recon-crates / debtors-past-60) replaces the static
   butternut card; one orange `Glow` at 18% behind the left column, both it and
   the card in `CursorDrift` with opposite directions; the H1 gets `SplitReveal`;
   the gradient rule above it becomes a drawing `SeamHairline` (the page's one
   hairline); the CTA is magnetic. `isolate` on the header — without a stacking
   context the glow's `-z-10` escapes and paints behind `.finch-site`'s
   background, i.e. invisibly.
   *Deviation: the plan says "the two CTAs become MagneticButtons". The hero has
   one CTA and a mono line, and inventing a second CTA is a copy decision, not a
   motion one. The one CTA is magnetic.*
2. **Sequence** — mechanics unchanged. The seam is the showcase band's `seam`
   (below), which rises 48px into the sequence's tail so the phone rests on it.
3. **Showcase → blue band** (`PlatformShowcase.tsx`) — `FacetPlane` (seed 31),
   frame shadow to `0 30px 80px -20px rgba(6,20,45,.55)` (a warm grey drop
   shadow on `#1F5FA8` reads as a dirty edge, not as height), eyebrow/H2/body on
   the blue ramp. **Facet drift pauses while the demo plays**: `playing` state
   lifted out of `DesktopShowcase` into the section, `paused={playing}` on the
   plane. Verified by sampling a facet's computed transform — idle it moves
   (0.960 → 0.914 over 2.5s), during a demo it is byte-identical over 1.6s, and
   it resumes after.
4. **Agents** — paper; cards gain a 3px hover lift + deeper shadow over 180ms,
   transform/shadow only (no relayout), dropped under `motion-reduce:`.
5. **Orbit** — unchanged.
6. **Quote → ink band** (`FoundingQuote.tsx`) — `WaveField` (orange, 10 lines,
   A=16) with the quote in `WaveText` inside a shared `WaveClockProvider`, so
   the words ride the sine the canvas is actually drawing. Bird as a flat
   `--fn-orange-on-ink` mask, attribution `--fn-ink-mono`, grain on. The quote
   sits at the Statement's family and tracking but 44px/400/upright — below
   `STATEMENT_CLASS`'s 72px/500 and without its italic, because it is somebody
   else's sentence, not the site's claim.
7. **Under the hood** — content unchanged; gains a real bottom rest (see below).
8. **CTA → ink band** (`AuditBand.tsx`) — the site's single `GradientRibbon`,
   plus a magnetic CTA. The old rounded ink *card floating on paper* is gone:
   the band is the contrast now, the nav inverts over it, and the grain lands on
   the full width instead of a 64px-inset box.

**Deviation, and the only one that changed a composition rather than an
implementation: the ribbon is the CTA band's bottom strip, not its top.** The
plan says top. Composed, that measured **3 moving things** at y=8,000 — the wave
field, the quote riding it (§4.1's pair is already the budget) and the ribbon,
because the quote band ended at ~8,400 and the CTA band began at ~8,712. No
gating change can fix that; the arithmetic says the strip has to start ~500px
further down, which is 500px of empty paper between two dark bands. Moving the
strip to the bottom of a tall (760px) closing band fixes it and reads better —
the reader arrives on plain grained ink, the offer is the first thing in the
band, and the gradient is the horizon under it, the last graphic before the
footer. `UnderTheHood` also gained a bottom rest (`pb-[130px]` at `lg`): it used
to borrow the next section's padding, which was fine when that section was a
card and is not fine now that it is a full-bleed ink band. Re-measured: max 2.

### `/pricing` — **ink** → paper → **blue** → paper → **ink**

1. **Ink hero** (`PricingHero.tsx`, now a client component — the grid's text
   mask needs a ref) — `OscillatingGrid` dots, orange, cursor attraction on,
   `maskRef` = the price block. Eyebrow `--fn-ink-mono`; **R6,000** at 96px
   `--fn-ink-text` stamping scale 1.3 → 1 after the unit's split reveal;
   `/ location / month` at 30px `--fn-ink-text-2`; "Everything included." STIX
   italic 26px; the AEO sentence `--fn-ink-text-2`. `underNav`, so the nav
   inverts from the first paint. The founding-terms strip is the seam element: a
   white three-cell plate sitting half on ink and half on paper across the
   band's `overlap="down"` join.
   *Two typography fixes found in screenshots: the unit needed its own
   `inline-block` (SplitReveal's `align-bottom` wrappers inside a 96px line box
   dropped it well below the figure's baseline — it read as two lines), and the
   space between figure and unit had to move outside that inline-block, where it
   is not collapsed.*
2. **What's included** — accordion unchanged; each summary row reveals a mono
   count on hover (150ms, opacity only, always in the layout so the chevron
   never shifts). The number is `items.length`; only the noun is authored
   (`countNoun` in `pricing-data.ts`), so the row cannot claim six agents and
   list five.
3. **Straight answers → blue band** (`StraightAnswers.tsx`) — `FacetPlane`
   (seed 53); the four Q&As in the existing 2×2 `<dl>` (same strings, so the
   FAQPage JSON-LD still matches exactly), each answer preceded by a 20px flat
   Finch mark in `--fn-blue-text-2`. One `wide` card, `margin-slip` (the plan's
   "margin-watch-gross-margin" — 31.4 → 29.3%), toned `ink`, at the band's right
   edge hanging ~70px into the paper band below. `/pricing` gained 56px of top
   clearance around `AcademyCard` so the two boxes do not touch.
4. **Academy** — unchanged.
5. **CTA → ink band** (`AuditCta.tsx`) — `OscillatingGrid` in **squares** mode,
   the only squares-mode use on the site; magnetic CTA; the
   `EXPANDED MANDATES PRICED ON SCOPE` line in `--fn-ink-mono`. No cursor
   attraction here — a bold field that also chases the pointer is two effects
   arguing, and the magnetic button is already this band's cursor-reactive part.

Metadata and both JSON-LD blocks are untouched; every number still comes from
`pricing-data.ts`.

### The blue band failed AA. Tokens changed.

§2 claims "#8FB0DC mono on blue passes for ≥ 12px" and treats `#1F5FA8` as "the
contrast reference". Measured on the composed pages, neither held:

| Pair | Was | AA needs |
|---|---|---|
| `--fn-blue-mono` #8FB0DC on #1F5FA8 | **2.89:1** | 4.5 |
| `--fn-blue-text-2` #BFD3EE on #1F5FA8 | **4.22:1** | 4.5 |
| …and the band's real worst case was `FacetPlane`'s lightest step #2F6FAE, where the same pairs fall to **2.35** and **3.44** | | |

Two changes in `globals.css`, both the smallest that reach AA: `--fn-blue-500`
(the lightest facet) `#2F6FAE → #27649F`, so the plane stops overshooting the
gradient it sits on; and the two secondary ramps move up until they pass against
that new worst case — `--fn-blue-text-2 #BFD3EE → #E2ECF9` (5.16:1) and
`--fn-blue-mono #8FB0DC → #D9E4F6` (4.80:1), with primary `#FAF9F6` at 5.85:1.
Note the order: **body copy is now brighter than a mono label**, which is the
correct hierarchy and was inverted before. On blue the three steps are close in
lightness by necessity; the separation is carried by family, size and tracking,
which is how the ink ramp (17.8 / 8.9 / 5.0) never had to. This affects every
blue band on the site, Workstream B's included.

### Verification

Measured in **headless Chrome over CDP** (`scratchpad/cdp.mjs`, `shot.mjs` —
node's built-in `WebSocket`, no new deps). The shared Browser pane worked for
part of this session and then reported `visibilityState: hidden` once Workstream
B fronted its tab, which freezes rAF; the headless harness is contention-free
and reports `visible`, so every number below comes from it.

```
tsc --noEmit    exactly the 3 known whatsapp-ingest errors
                (a 4th, app/compare/…/page.tsx `statement`, is Workstream B's
                 file mid-flight — not on any path this workstream touched)
npx eslint components/finch app/pricing app/page.tsx app/design    clean
```

**Motion budget — walked in 200px steps, whole page, both widths.** A device
counts as moving if its canvas pixels change or its transform changes over a
700ms sample.

| Page | steps | max moving | over budget |
|---|---|---|---|
| `/` | 46 | **2** | none |
| `/pricing` | 15 | **2** | none |

`/` active positions: `glow` (0–400) · `blue/facets` (4,600–5,800, with the gap
at 5,000–5,400 where the demo is playing and the facets are correctly paused) ·
`ink/wavefield + wavetext` (7,200–8,000) · `ink/ribbon` (8,600–9,000). The wave
band stops at 8,400 and the ribbon starts at 8,500 — a clean handover, which is
what the composition change above bought.

**Nav inversion.** `/`: paper → blue@5,400 → paper@6,400 → ink@7,800 →
paper@8,400 → ink@8,800. `/pricing`: **ink from y=0** → paper@600 → blue@1,600 →
paper@2,400 → ink@2,800. Over ink the links, wordmark and hamburger are
`rgb(250,249,246)`; the mobile sheet opened over the ink hero keeps its paper
panel with dark links (`rgb(20,18,14)`) and a dark ×.

**CLS** (`layout-shift` entries, accumulated across the whole scroll):
`/` **0.00093**, `/pricing` **0**. Both < 0.02.

**Frame cost** — every rAF callback on the page timed (the canvas stages draw
inside theirs), parked 7s per band:

| Band | canvas | mean ms | p95 | max |
|---|---|---|---|---|
| `/` ink quote — WaveField | 1425×539 | 0.040 | 0.20 | 0.50 |
| `/` ink CTA — GradientRibbon | 855×192 | 0.042 | 0.20 | 0.70 |
| `/pricing` ink hero — grid dots + cursor + mask | 1425×636 | 0.197 | 0.90 | 1.70 |
| `/pricing` ink CTA — grid squares | 1425×517 | 0.079 | 0.40 | 1.20 |
| both blue bands — FacetPlane | — (SVG, composited) | — | — | — |

All far under §9's 4ms. **120 FPS** parked on every band of both pages, and zero
`long-animation-frame` entries (i.e. no frame anywhere exceeded 50ms).

**Both pinned homepage sections, with Lenis ON.** Driven by dispatched `wheel`
events, because `window.scrollTo` fights Lenis's easing and produces phantom
direction changes — that confound cost an hour and is worth knowing.
- *Sequence*: sticky stage reads `top: 0` for the whole 4,320px wrapper and
  releases at 4,425 exactly as it should. Beats progress forward (t=0 → beat 4's
  card lands at `scale(0.56) translate(336,74)`, its three constants) and unwind
  in reverse (opacities back to `1/0/0/0/0` at t=0).
- *Showcase*: brief → **down** → detail → **up** → brief, and `demo_played`
  fires once per direction. A second down at a position where the frame is no
  longer 40% in view correctly does nothing.

**Reduced motion** (`Emulation.setEmulatedMedia`): Lenis off (`data-lenis`
absent), facets static, every canvas `painted: true, changed: false` (a real
static picture, never a blank), `WaveText` transform `none`, and the homepage
CTA band swaps its ribbon canvas for the static orange→blue hairline.

**375×812**: no horizontal overflow on either page (`scrollWidth ===
clientWidth`). One `<h1>` per page. All JSON-LD blocks parse (`/` 1, `/pricing`
2). `curl` 200 on `/ /pricing /design /operations-audit /compare/… /industries
/about /faq`.

**Console clean.** `/pricing` has zero warnings or errors. `/` has the two
pre-existing `IntegrationsOrbit` `<Image>` aspect-ratio warnings and nothing
else. No page errors on either.

**`/design` still correct** after the shared changes: 200, 15 bands, console
clean, Lenis toggle checked by default, unticking removes the class and the
attribute and writes `"0"`, reticking restores it.

### Concurrency note

`text/MagneticButton.tsx` was edited by both workstreams in the same window —
this one added `next/link` routing and the `event`/`eventProps` union, B added
`disabled` and `pull`. The merged file carries both and lints clean. The other
shared files (`Band`, `SmoothScroll`, `FinchNav`, `MobileMenu`, `FindingCard`,
`globals.css`) were touched by A only.

### What Josh should look at

1. **The homepage closing CTA.** The ribbon moved from the top of the band to
   the bottom for a measured budget reason (above). It now reads as a horizon
   under the offer. If the top strip was the intent, the fix is ~500px more
   paper in "Under the hood", and that is a design call, not a code one.
2. **The blue band's new text colours.** They are lighter than 6a's — this is
   an AA fix, not a preference, but the band reads cooler and flatter than it
   did. If it is too washed, the alternative is a darker blue ground rather
   than darker text.
3. **`/pricing`'s founding-terms plate** across the ink→paper seam, and the
   grid's text mask under R6,000 — the two things this page's hero is built on.
4. **The showcase's paused facets.** Scroll the Brief demo forward and back and
   watch the blue behind it stop and start.

## 6b follow-up — day beats + sweep

Decoupled the day strip (`components/finch/day/day-beats.ts`) from the
homepage's brief. It used to read `BRIEF_FINDINGS` out of `BriefPhone.tsx` (a
client component, which is why the file carried a client-only comment); it now
reads `lib/marketing/findings.ts` directly by id — a plain data module, so the
file no longer crosses a client boundary at all.

**The beat ids now used**, in stage order:

| Time | Id | Why |
|---|---|---|
| 06:14 | `butternut-price` | the flagship, R58,000 |
| 07:40 | `debtors-past-60` | ≈R187,000 — the 60-day debtors card |
| 09:05 | `recon-crates` | ≈R58,000/yr — the shorted-crates recon card |
| 11:30 | `stock-holiday-overstock` | ≈R38,000 tied up — the fourth, dimmed beat |
| 17:55 | derived | the evening card, composed of the three above |

`stock-oil-cover` (R9,800, `resolved`, small) is no longer used here — the
plan named the overstock card, not the small one, and 11:30 now reads
`stock-holiday-overstock` instead. `BriefPhone.tsx`'s own `BRIEF_FINDINGS` /
`BRIEF_IDS` (`butternut-price`, `debtors-thyme-basil`, `recon-drums`) were not
touched — the homepage's morning/evening brief is exactly as it was.

**The derived evening amount is R187,000** — computed, not written out: a
`randFigure()`/`randAmount()` pair reads the leading `Rxxx,xxx` out of each of
the three headline findings' own `impact` strings and picks the largest
(`debtors-past-60`'s R187,000, ahead of butternut's and recon-crates' R58,000
each). The closing beat's `observation` (`"Evening. Three things from today —
one's worth R187,000."`) and `EVENING_GREETING`/`EVENING_BRIEF` all read that
one computed value, so a future edit to any of the three cards' impacts moves
the sentence with it instead of leaving it stale.

Verified on `/compare/finch-vs-hiring-a-coo` via `curl` (fronted CDP/browser
access wasn't available in this session): the four day-strip cards render
"Butternut up 12%…", "Three accounts have crossed 60 days…", "Thursday
deliveries bill 40 crates…" and "…31 days of cover into a week with two public
holidays…"; the evening bubble reads "Evening. Three things from today — one's
worth R187,000."; the closing impact line is `R58,000 · R187,000 · R58,000`;
`stock-oil-cover`'s and `debtors-thyme-basil`'s copy do not appear on the page
at all (the COO hero carries no finding card — 6b's own deviation 2). The
homepage was re-curled as a control: `Thyme & Basil Catering is 18 days…` and
`Umgeni Oils INV-88412…` still render there, and the brief bubble still reads
"one's worth R58,000" — `BriefPhone.tsx` is untouched.

### Whole-repo sweep

```
npx tsc --noEmit     exactly the 3 known whatsapp-ingest errors
npm run lint          90 problems (53 errors, 37 warnings) — same as baseline;
                      none in components/finch, lib/marketing, or any
                      marketing app/ route (checked both by filtering the full
                      run's output and with a targeted eslint pass over
                      components/finch, lib/marketing, app/design,
                      app/layout.tsx, app/page.tsx, app/pricing,
                      app/operations-audit and app/compare/finch-vs-hiring-a-coo,
                      which came back clean)
```

`components/finch/text/MagneticButton.tsx` reads cleanly after the two
concurrent 6b edits — one `disabled`/`pull`/`event`/`eventProps` set on
`MagneticButtonProps`, one `MagneticButton` export, one default export, no
duplication.

**Sitemap crawl**: scripted (`node`, native `fetch`, concurrency 6) — parsed
every `<loc>` out of `http://localhost:3000/sitemap.xml`, rewrote each to
localhost (the sitemap emits the production `https://vyso.co.za` host), and
fetched all of them. **70/70 URLs returned 200 with exactly one `<h1>`.**

`curl` `/design` → 200.

Nothing failing.

## Architect note — 6b (Fable, 2026-08-16) — structurally approved; Josh reviews visually
tsc 3 known; lint 90 = baseline; 70/70 sitemap URLs 200 with one <h1>; motion
budget max 2 on all four pages; CLS ≤ 0.001; worst frames 1.7ms (home/pricing)
/ 15ms (audit/COO — investigate in 6d); Lenis default on, anchors land; nav
inverts over dark bands (two nav bugs fixed); blue tokens corrected for AA by A
(#27649F / #E2ECF9 / #D9E4F6). Deviations accepted: ribbon at the bottom of the
homepage CTA band (top strip broke the 2-moving budget); one hero CTA on `/`.
Josh to eyeball on localhost: `/`, `/pricing`, `/operations-audit`,
`/compare/finch-vs-hiring-a-coo`. Then 6c (rest of the site) and 6d.

## 6b fixes

Plan: `.ai/plan_phase6b_fixes.md` — Josh's review of 6b, four screenshots and
notes, seven findings. **Nothing committed; no git commands run.** Both the
6b-fixes pass proper and this report's own follow-up tightening (the two bands
still over budget when this section was drafted) are covered below.
`components/finch` and the four recomposed pages carry no prior commit in this
repo (the whole v3 redesign is uncommitted), so there is no `git diff` baseline
inside that tree — what follows is read from the current source against the
plan's seven findings and this session's own measurements, the same way the
6a/6b sections above narrate rather than paste diffs. `git diff --stat` on the
three tracked page files (`app/page.tsx`, `app/pricing/page.tsx`,
`app/operations-audit/page.tsx`) only shows the whole phase-6 rewrite against
the pre-Finch `d49e30b` commit, not a 6b-fixes-only slice, for the same reason.

### 1 — `AuditBand` split into `default` / `home`

`components/finch/AuditBand.tsx` now takes `variant?: "default" | "home"`.

- **`default`** — the pre-6b shape restored: a `#14120E` plate, 16px radius,
  inside a **paper** `Band`, not a full-bleed ink band. This is what all
  twenty of the non-home routes that render `<AuditBand />` get: `/about`,
  `/academy`, `/case-studies`, `/case-studies/turn-n-slice`, `/compare`,
  `/faq`, `/founding-client`, `/industries`, `/industries/[slug]`,
  `/integrations`, `/learn`, `/learn/[slug]`, `/learn/glossary`,
  `/learn/glossary/[term]`, `/platform/modules`, `/platform/modules/[slug]`,
  `/resources`, `/resources/[slug]`, `/solutions`, `/solutions/[slug]`,
  `/south-africa`. (`/compare/finch-vs-hiring-a-coo` renders neither shape —
  see below.)
- **`home`** — `variant="home"` on `app/page.tsx`'s call only. Full-bleed ink
  `Band`, `GradientRibbon` as a **240px reserved strip at the band's own
  bottom** (`160px` below `lg`), content-driven height: no `min-h-[760px]`,
  no strip "pinned" absolutely inside a taller box. The strip is *in the flow*
  — a real `aria-hidden` spacer box the canvas paints behind — so the band's
  height is copy + gap + 240, never a guessed minimum.
- `/compare/finch-vs-hiring-a-coo` gets neither: `compare/CooCta.tsx` (new)
  is its own ink `Band seam` with `OscillatingGrid` dots in orange, the exact
  `AuditBand` copy and lockup (serif h2 28/34, body 15/15.5, one magnetic
  button), so the page's ground sequence ends on a band rather than a plate
  without adding a third `AuditBand` mode that seventeen other pages would
  never use.

The one-lockup-three-CTAs rule (`AuditBand`'s `CtaCopy`, `pricing/AuditCta`,
`compare/CooCta`) means all three closing CTAs on the site read identically
save for their ground.

### 2 — Seam straddles: clipping fixed per straddle

Every straddle the plan named, walked and fixed:

| Straddle | Where | Fix |
|---|---|---|
| Founding-terms plate | `/pricing`, ink hero → paper | Already correct going into this pass (`PricingHero.tsx`'s `overlap="down"` + the plate's own `-mt-[8px]`); re-verified, no clipping at 1440/375. |
| Margin card (`margin-slip`) | `/pricing`, blue answers → paper Academy | `StraightAnswers.tsx`: the card was hanging a 190px negative margin over a band whose own top padding was 56px — 14px short, and it also ran 150px past the accordion's right edge (its own centred column, not the shared rail). Now: `STRAIGHT_ANSWERS_OVERHANG = 72` (exported), the card sits right-aligned on the same 1160 rail as everything else, and `app/pricing/page.tsx` wraps `AcademyCard` in `lg:pt-[128px]` (`72` overhang `+ 56` clearance) — one number, exported, used at both ends instead of two magic values that could drift apart. |
| Assessment card header | `/operations-audit`, blue week → paper tools | `AuditTools.tsx`'s header, promoted to a white card pulling `-mt-[68px] lg:-mt-[104px]` over `AuditWeek`'s bottom edge, was already `z-20`/`overflow: visible` going into this pass. What was wrong was the *giving* band: `AuditWeek` reserved 124/180px of bottom room (a 96/104 padding preset stacked under a 60/76 spacer) for a 68/104 overhang — 56–76px of dead blue the card's shadow floated in, which is most of why the band measured 813px against 458px of content. Fixed as part of finding 3, below — same mechanism, so listed once there. |
| Cost bars baseline | `/compare/finch-vs-hiring-a-coo`, blue | Not a straddle in the seam sense — `CostBars.tsx` bottom-aligns the bars inside the blue band's own box (`lg:items-end`), it never crosses into the band below. Confirmed no clipping. |
| Sequence phone → showcase seam | `/`, paper → blue | `PlatformShowcase.tsx`'s `seam` (`overlap="up"`) rises 48px into the sequence's tail; unchanged since 6b, re-verified clean at 1440/1280/768/375. |
| "Full FAQ →" link | `/pricing`, under the accordion | Was reading as an orphan against a hard cut into the blue band below. `WhatsIncluded.tsx` now closes with the link `mt-[24px]`, left-aligned, inside the section's own column — not floating between bands — and the section's own `pb-[64px] lg:pb-[96px]` gives it clearance from the blue band underneath instead of borrowing the band's own top padding. |

No element is clipped at 1440, 1280, 768 or 375 on any of the four pages
(spot-checked via `getBoundingClientRect` on the straddlers listed above, tab
fronted; the pricing and audit straddles are screenshotted below).

### 3 — Vertical rhythm: band-height audit and fixes

Every band's `(band height − content height)` was walked; the two the plan
flagged as still loose after the first fixes pass (in Josh's own review notes
for this follow-up) were `FoundingQuote` and `AuditWeek`, both fixed as part
of writing this report — see the height table below for the numbers.

- **`FoundingQuote.tsx`** — the ink preset (112/120, sized for a full hero
  weight) was overkill for four lines of 44px pull-quote. Own
  `paddingClassName` override rather than touching `PADDING.ink` in
  `ground/Band.tsx` — `AuditStatement` and `CooHero` are still full-weight ink
  bands and keep the shared preset:

  ```
  pt-[64px] pb-[72px] lg:pt-[96px] lg:pb-[104px]
  ```

  511px band / 156px content (Josh's numbers) → **479px / 279px** measured
  here (this report's own content-height convention — see "Measurement
  method" below — reads 200 either side of the change; the padding cut itself
  accounts for the full delta since nothing else in the band moved).

- **`AuditWeek.tsx`** — the real bug was double-reservation, not just a big
  preset. The blue ground's bottom padding (96/104) *and* a separate straddle
  spacer (60/76) were both paying for `AuditTools`' card overhang (68/104),
  which only needs to be paid once. Fix: the band's own bottom padding drops
  to a nominal `pb-[24px]` (both breakpoints — the seam room is no longer
  shared between two mechanisms), and the spacer is resized to the overhang
  exactly (`h-[68px] lg:h-[104px]`, matching `AuditTools`' own `-mt-*` to the
  pixel instead of a rounder number). Total bottom clearance becomes
  `24 + 68 = 92` / `24 + 104 = 128` — the overhang plus a 24px hairline of
  breathing room, once. Top padding also trimmed 96→88 desktop
  (`paddingClassName="pt-[52px] pb-[24px] lg:pt-[88px] lg:pb-[24px]"`).
  Screenshotted below: the "THE SHAPE OF THE WEEK" note now sits with a clean
  24px gap above the straddling card, no clipping, seam radius intact.

- **`/pricing`'s ink hero** — checked, not touched. Raw delta is 570/296 =
  274px, over the 260 line, but `PricingHero.tsx` is `underNav` (91–92px of
  the band's own top is the nav sitting over it, not empty air), and its
  `paddingClassName` (`pt-[44px] pb-[72px] lg:pt-[78px] lg:pb-[104px]`) was
  already hand-tuned in the prior fixes pass with the comment "78 puts the
  price block ~120px below the nav, which is where §7 wants it." Net of the
  nav's own height, the delta is `274 − 91 ≈ 183px` — inside budget. Left
  alone per the plan's own instruction ("if the nav's underNav headroom
  accounts for the extra, leave it").

- **Other bands walked, left alone (already ≤ 260 or explained, not named by
  this pass's scope):** `/` homepage CTA (`551/143`, `+240` is the ribbon's
  own reserved strip, not slack — unchanged, matches the plan's own numbers
  exactly), `/pricing` blue answers (`788/764`, delta 24), COO hero/bars/CTA
  (`748/512`, `719/489`, `375/143` — all already under 260 from the first
  6b-fixes pass).

- **Still over 260, left alone because this pass's scope was the two named
  bands plus the pricing-hero check:** `/pricing`'s ink CTA
  (`AuditCta.tsx`, `471/187` ≈ 284px — uses the shared ink preset unmodified,
  same class of fix as `FoundingQuote` would apply but wasn't asked for) and
  `/operations-audit`'s ink statement (`AuditStatement.tsx`, `713/433` ≈
  280px — same). Both are candidates for the identical per-band
  `paddingClassName` treatment in a follow-up if Josh wants them tightened
  too; neither was named in this round's instructions.

**Measurement method.** `[data-ground]` for band height;
`[data-band-content]`'s children, `aria-hidden` spacers excluded, top of the
first visible child to the bottom of the last, for content height — run as a
single `getBoundingClientRect` pass per page with the tab fronted at
1440×900, no rAF/CDP sampling loops. Numbers above are this method's; Josh's
original notes used a different content-height convention (compare `551/143`
matching exactly on the untouched homepage CTA band — same band, same method,
confirms no drift — against `FoundingQuote`'s `156` vs this pass's pre-fix
equivalent, which would have read closer to `279` under this method since the
gap is convention, not disagreement about what moved).

### Height table

| Page | Band | Ground | Before (band/content, Josh's numbers) | After (band/content, this session, 1440×900) | Δ before → after |
|---|---|---|---|---|---|
| `/` | blue (Platform Showcase) | blue | n/a — pinned demo, not a fixed-height comparison | 1156 / 956 | not in scope |
| `/` | quote | ink | 511 / 156 | **479 / 279 (Δ200)** | fixed |
| `/` | closing CTA | ink | 551 / 143 (+240 ribbon) | 551 / 143 (+240 ribbon) | unchanged, already ≤ 260 of intent |
| `/pricing` | hero | ink | 570 / 252 | 570 / 296 (Δ274 raw, ≈183 net of 91px `underNav`) | left — nav headroom accounts for it |
| `/pricing` | straight answers | blue | 788 / 733 | 788 / 764 (Δ24) | unchanged, already ≤ 260 |
| `/pricing` | closing CTA | ink | 471 / 187 | 471 / 239 (Δ232, raw Δ284 by band−content) | unchanged, not in this round's scope |
| `/operations-audit` | how the week runs | blue | 813 / 458 | **753 / 537 (Δ216)** | fixed |
| `/operations-audit` | ink statement | ink | 713 / 433 | 713 / 481 (Δ232) | unchanged, not in this round's scope |
| `/compare/finch-vs-hiring-a-coo` | hero | ink | 748 / 512 | not re-measured | already ≤ 260, untouched |
| `/compare/finch-vs-hiring-a-coo` | cost bars | blue | 719 / 489 | not re-measured | already ≤ 260, untouched |
| `/compare/finch-vs-hiring-a-coo` | closing CTA | ink | 375 / 143 | not re-measured | already ≤ 260, untouched |

**What remains > 260 and why.** `/pricing`'s closing CTA (`AuditCta.tsx`) and
`/operations-audit`'s ink statement (`AuditStatement.tsx`) both still read
over budget on a raw band-minus-content basis. Both use the shared ink
preset (112/120) unmodified — the identical class of over-generous padding
`FoundingQuote` had — but neither was named in this round's two-band
instruction, and both are full-weight Statement/CTA bands (unlike the quote,
which was deliberately lightened *because* it isn't one), so trimming them
is a design call about how much air a closing CTA or a credited-price
Statement should carry, not a bug fix. Left as-is pending that call.

### 4 — Roberto's quote: static text, wave amplitude down elsewhere

`FoundingQuote.tsx` no longer imports `WaveText` at all — the quote is a
plain `<p>` inside the still-moving `WaveField` band. The file's own comment
block (left in place, since it explains *why* rather than just *what*)
records the reasoning: per-word `y` reads as breathing on a short, wide,
single-sentence Statement, and as *warping* on four lines of somebody else's
prose. The canvas keeps moving; the words don't; the band still holds one
moving thing.

`WaveText` itself (`text/WaveText.tsx`, still used on `AuditStatement` and
`CooHero`) had its default amplitude cut from the 5px 6b shipped to **3px**,
and gained a hard cap on cross-word spread: `MAX_SPREAD_PX = 1.5` — the
component now measures each word's x-centre, computes the field's natural
phase spread across the line, and scales it down until the first and last
word can never differ by more than 1.5px of travel, regardless of amplitude
or line width. 6b's version let a wide headline's natural phase spread reach
~10px end to end, which is what read as warping; capping the *spread* rather
than just the amplitude means a future wider or narrower Statement can't
reintroduce the bug by accident.

### 5 — Lenis tuning: settle time

`components/finch/SmoothScroll.tsx`'s `SNAPPY` config, replacing the
`duration: 1.05` exponential-ease tuning 6b shipped:

```ts
const SNAPPY = {
  lerp: 0.25,
  smoothWheel: true,
  wheelMultiplier: 1.1,
  syncTouch: false,
  touchMultiplier: 1.5,
  anchors: false,
} as const;
```

`data-lenis-snappy="on"` is set on `<html>` alongside `data-lenis`, naming
this a mode rather than an anonymous set of numbers. Settle-time table, from
the file's own comment (measured on `/operations-audit` at 1440, dispatched
wheel events, last frame that moved the page by more than half a pixel):

| lerp | one notch | three | a fling (1200) |
|---|---|---|---|
| 6b (`duration: 1.05`) | 771ms | 898ms | 998ms |
| 0.2 | 449ms | 542ms | 658ms |
| 0.25 | **366ms** | 433ms | 533ms |

0.25 was chosen over the plan's suggested 0.2 because 0.2 still missed the
plan's own ~350ms acceptance line for a single notch; 0.25 hits it (366ms)
while a fling still takes about half a second to arrive — eased, not
instant, which is the part of Lenis worth keeping. `anchors: false` (Lenis's
own default) means every in-page hash still relies on the browser's instant
jump plus the target's `scroll-mt`, unaffected by the retune.

### 6 — General lockup / column / radius pass

- **Eyebrow/H2 lockup made consistent** wherever a section had drifted from
  the site's mono-10/11px-.14em-then-serif-28/38 rhythm: `AuditFaqs.tsx`
  ("used to open on a bare 24/28 H2, which made the page's last section read
  as a footnote"), `StraightAnswers.tsx` ("the blue band used to open on a
  bare 26px H2, which is why `/pricing` read as three pages stapled
  together"). `compare/CompareBits.tsx` gained `BandHead` — the same
  eyebrow/H2/sub trio, parameterised by `blue`/`ink` tone — so a **band** can
  open the way a `Section` does without duplicating the rhythm by hand in
  every band file; used by the COO page's cost band and CTA.
- **1160 rail alignment.** `WhatsIncluded.tsx` and `AcademyCard.tsx` both
  used to centre their own 860px column instead of left-aligning inside the
  shared 1160 rail (`RAIL` from `ground/Band.tsx`) — `WhatsIncluded`'s content
  sat 150px right of the blue band below it, and `AcademyCard`'s right edge
  landed 150px inside the margin card hanging out of the band above. Both now
  use `RAIL` and align left, so the accordion, the Academy card, the ink
  hero and the blue band all share one left edge down the page.
- **`compare/CompareBits.tsx` `Breadcrumb` gained `tone`** (`paper` | `ink`) —
  `--fn-muted` on `#14120E` was 2:1, unreadable on the COO hero; same markup,
  a palette swap, rather than a second breadcrumb component.
- **Radius**: unchanged from 6b — `ground/Band.tsx`'s `OVERLAP` map is still
  the single source for the 24px seam radius in both directions (`up`/`down`),
  so nothing here introduced a second value to drift from it.
- **`UnderTheHood.tsx`'s bottom rest** dropped from 6b's `pb-[130px]` back to
  the paper band's ordinary `110/110` rhythm — the extra 20px was buying
  separation from the `GradientRibbon`, and now that the ribbon lives inside
  its own band's bottom (finding 1) and the quote above it stopped moving
  (finding 4), the two ink bands no longer need a wider gap than any other
  adjacent pair.
- **No orphan links between bands**: covered under finding 2 ("Full FAQ →").

### 7 — `/design` still renders

`curl -s -o /dev/null -w '%{http_code}' localhost:3000/design` → 200; it
composes the same `Band`/`WaveText`/`SmoothScroll` primitives this pass
touched and none of its own files were edited.

### Verification

```
npx tsc --noEmit
  lib/platform/whatsapp-ingest.ts(4,10)   TS2724  (known)
  lib/platform/whatsapp-ingest.ts(408,36) TS7006  (known)
  lib/platform/whatsapp-ingest.ts(589,5)  TS2353  (known)
  — exactly the 3 known errors, nothing else

npx eslint components/finch app/page.tsx app/pricing app/operations-audit \
          app/compare/finch-vs-hiring-a-coo
  — clean, 0 problems
```

Routes, `curl -s -o /dev/null -w '%{http_code}'` against the dev server:
`/` 200, `/pricing` 200, `/operations-audit` 200, `/compare/finch-vs-hiring-a-coo`
200, `/learn` 200.

Visual spot-checks (Browser pane, tab fronted, static screenshots only — no
rAF/CDP sampling loops per this session's constraints): the homepage quote
band shows the wave field's orange lines still moving with the quote text
static and centred, tightened padding, bird mark and attribution intact; the
`/operations-audit` blue→paper seam shows "THE SHAPE OF THE WEEK" with clean
24px clearance above the straddling "Before you book" card, no clipping, 24px
seam radius intact.

Not independently re-verified in this pass (unchanged since the 6b
architect-note gate and outside this round's file list): motion budget ≤ 2,
CLS, `/design`'s 15-band sink beyond the 200 check above, and the
`/compare/finch-vs-hiring-a-coo` band heights (COO hero/bars/CTA — Josh's
numbers already read ≤ 260 and none of that page's files were touched by
this session's two padding fixes).

## Architect note — 6b fixes (Fable, 2026-08-17) — approved for Josh's re-review
Verified live: `/learn` (and the other AuditBand consumers) back to paper-only
closing plate; ribbon on `/` only; grounds `/` blue→ink→ink, `/pricing`
ink→blue→ink, `/operations-audit` blue→ink, COO ink→blue→ink; pricing margin
card straddle clean (72px into paper, no clipping ancestor, 189px clear of
Academy); band chrome deltas now ≤ ~230 on COO, quote 200, week 216; Lenis
lerp .25 (settle ≈ 350ms/notch per the measured table); quote text static;
tsc 3 known; eslint clean; five key routes 200. Remaining >260: AuditCta /
AuditStatement (fold into 6c/6d).

## 6b fixes — round 2

Plan: `.ai/plan_phase6b_fixes2.md` — Josh's second review, three items: the nav
not re-inverting on route change, dark bands with no breathing room above them,
and the two tools stuck inside `/operations-audit`. **Nothing committed; no git
commands run.**

### 1 — Nav inversion, recomputed at every moment it can change

`NavGround.tsx` rewritten. Two bugs, not one:

- **Route changes never fired it.** The component lives in the root layout, so a
  client-side navigation does not remount it, and the incoming page's first band
  is already under the nav — there is no scroll event to notice it with. So
  `/pricing`'s ink hero arrived with dark-on-dark nav text and `/` arrived still
  inverted, warm-white on paper, until the reader scrolled. It now re-runs on
  `usePathname()` change, on the next frame after that commit (the App Router
  restores scroll position *after* the commit), and on a new
  `ROUTE_FADE_END` window event that `RouteFade` dispatches when its 220ms
  crossfade resolves — or immediately under reduced motion, where there is no
  fade to wait for. All three writes are idempotent, so whichever lands last
  wins and none of them can leave a stale answer.
- **A hit test asks the wrong question.** `elementsFromPoint` returns whatever
  paints at a pixel, which over a hero carrying a device canvas, a glow or a
  straddling card is not necessarily the band. The probe is now a rect walk of
  `[data-ground]` against the nav's **vertical centre** (`NAV_H` corrected to
  the measured 76/92, the same numbers `Band`'s `underNav` pulls a dark hero up
  by, instead of the old 64/80 "somewhere inside the nav" line). Document order
  breaks the tie, so a seamed band — always the later sibling, always the one
  carrying `z-10` — wins over the band it overlaps, which is the one the reader
  sees. Zero-height nodes are skipped. Default `paper` when nothing spans it.

**First paint on a hard load** is not that component's to fix: nothing has
hydrated yet. A page whose hero is a dark `underNav` band now declares it on its
own wrapper — `data-nav-hero="ink"` on `app/pricing/page.tsx` and
`app/compare/finch-vs-hiring-a-coo/page.tsx`, the only two `underNav` callers on
the site — and `globals.css`'s inversion block gained a third way in. The whole
condition is written once as an `:is()` prefix shared by all six rules:

```
:is(html[data-nav-ground="blue"] .finch-site,
    html[data-nav-ground="ink"] .finch-site,
    html:not([data-nav-ground]) .finch-site[data-nav-hero]) nav[aria-label="Primary"] …
```

The third arm is scoped by `html:not([data-nav-ground])`, so it stops applying
the instant `NavGround` mounts and writes that attribute — which it does
unconditionally, including for `paper`. The static answer can therefore never
outlive the measured one and the two can never disagree.

**The sequence, zero scrolling, measured by reading `<html data-nav-ground>`
after each click** (clicks dispatched on the real anchors so Next's router
handles them; the Browser pane's synthetic mouse and its `getComputedStyle` are
both unreliable in this session — see "Measurement notes"):

| Step | Path | scrollY | `data-nav-ground` |
|---|---|---|---|
| hard load | `/pricing` | 0 | **ink** ✓ |
| click wordmark | `/` | 0 | **paper** ✓ |
| click Pricing | `/pricing` | 0 | **ink** ✓ |
| click "Book your audit" | `/operations-audit` | 0 | **paper** ✓ |
| click Compare (footer) | `/compare` | 0 | **paper** ✓ |
| click Finch vs hiring a COO | `/compare/finch-vs-hiring-a-coo` | 0 | **ink** ✓ |
| click wordmark | `/` | 0 | **paper** ✓ |

Hard reloads: `/pricing` and the COO page both ship `data-nav-hero="ink"` in the
server HTML (curl), the fallback selector matches the nav and its links
(`Element.matches` with the html attribute temporarily removed), the compiled
CSS carries all six `:is()` rules, and a screenshot of a cold COO load shows the
inverted nav over the ink hero.

### 2 — Breathing room before dark bands

The rule: a paper section followed by a dark band with **no straddling element**
keeps its full bottom rhythm and the band starts after it. Two sections had no
bottom padding at all, so the gap was literally zero.

| Seam | Before (1440 / 375) | After (1440 / 375) | Change |
|---|---|---|---|
| `/` orbit (`Senses`) → ink quote band | **0 / 0** | **110 / 64** | `pb-[64px] lg:pb-[110px]` added |
| `/pricing` Academy card → ink CTA band | **0 / 0** | **110 / 64** | `pb-[64px] lg:pb-[110px]` added |
| `/` under-the-hood → ink CTA band | 131 / — | 110 / 72 | unchanged (already had its rest) |
| `/operations-audit` tools card → ink statement | 104 | 104 | unchanged |
| `/operations-audit` FAQs → footer | 88 | 88 | unchanged — paper→paper, the rule does not apply |
| COO "hire instead"/side links → ink CTA | 104 | 104 | unchanged |
| COO day strip → blue cost band | 104 | 104 | unchanged |

(The two 131 → 110 and 72 numbers on `UnderTheHood` are the same padding read
against the section's own last child rather than its deepest descendant; nothing
in that section changed.)

**Straddles that are meant to straddle**, re-measured against the plan's ≥ 48px
of clear dark ground above the straddler's top edge:

| Straddle | Clear ground above, dark side | Verdict |
|---|---|---|
| `/pricing` founding-terms plate (ink hero → paper) | 56px (plate top sits 48px above the ink edge) | already clear |
| `/pricing` margin card (blue → paper Academy) | 56px | already clear |
| `/operations-audit` "two ways" card (blue → paper) | **24 → 48px** | fixed |
| COO cost bars | n/a — bottom-aligned inside the band, never crosses | not a straddle |

The audit one was the 6b-fixes number (`AuditWeek`'s `pb-[24px]`, "the overhang
plus a 24px hairline"). 24px is a hairline, not a breath; the band's own bottom
padding is now 48 at both breakpoints, so total bottom clearance is `48 + 68`
mobile / `48 + 104` desktop — the clearance plus the overhang, still paid once
each. The card still crosses the seam at 1440 and 375, no clipping, radius
intact.

### 3 — The two tools became two pages

`/operations-audit` was 5,734px tall and carried two interactive widgets in a
row that only fit above 1280. Neither had a URL anybody could send. Both are
pages now; the audit page is **3,781px**.

**New routes.** `app/operations-audit/score/` and
`app/operations-audit/calculator/`, each a page, an `opengraph-image` and
nothing else. The shell they share is `components/finch/audit/AuditToolPage.tsx`
— `FinchNav` with no active section, a compact paper hero (gradient rule,
eyebrow, `<h1>` in `SplitReveal`, the tool's existing one-line sub), the widget
on the shared 1160 rail at full width in a single column, a "‹ Back to the
audit" link **below** the tool, and the shared `AuditBand` plate. Ground
sequence: paper → ink plate, **no device on either page**. These are working
pages; the tool is the moving thing, and a living background under a form
somebody is filling in is §1.3 with extra steps. Neither tool needed a wrapper
card — both already bring their own.

| | `/operations-audit/score` | `/operations-audit/calculator` |
|---|---|---|
| eyebrow | `BEFORE YOU BOOK · SELF-ASSESSMENT` | `BEFORE YOU BOOK · CALCULATOR` |
| `<h1>` | Ten questions. One finding. | What is manual work costing you? |
| title | Operations self-assessment — score your business in a minute \| Vyso | What is manual work costing you? Calculator \| Vyso |
| description | 155 chars | 151 chars |
| canonical | `https://vyso.co.za/operations-audit/score` | `…/calculator` |
| JSON-LD | `BreadcrumbList` (Home › Operations Audit › …) | same |
| doc height @375 | 4,081 | 4,355 |

`buildAuditToolSchema()` in `audit-jsonld.ts` builds the breadcrumb. Deliberately
nothing else: neither tool answers a question in prose (no FAQ to mark up) and
neither is a `SoftwareApplication` in any sense worth telling a crawler about —
they are two forms that do arithmetic in the browser. The parent page's
`Service`/`FAQPage`/`HowTo` stay where they are.

**`/operations-audit` keeps the straddle, loses the widgets.** `AuditTools.tsx`
is now the doorway: the same white card crossing the blue→paper seam, the same
`BEFORE YOU BOOK` / "Two ways to see it before we start." / sub lockup, then two
`secondary` magnetic buttons side by side from `md` (stacked below), each with a
mono caption — "Score your operation →" `10 QUESTIONS · 1 MINUTE` and "Run the
numbers →" `YOUR NUMBERS · AN ESTIMATE`. Secondary, not primary: the page's call
to action is booking, and two orange buttons in the middle of it would argue
with both the form above and the ink band below. Then the ink "R2,000.
Credited." band as-is, FAQs, footer.

**Links retargeted.**

- `next.config.ts`: `/roi-calculator` → `/operations-audit/calculator` (was
  `…#calculator`). A 308 that lands on a page rather than a fragment is also the
  only version a search engine consolidates.
- `OperationsAudit.tsx` and `RoiCalculator.tsx`: the finding cards' "Book the
  audit" was a bare `#book`, which is a dead hash now that the booking form is
  on the parent. Both read `BOOK_HREF` (`/operations-audit#book`) from
  `audit-content.ts`. "Start over" stays a button — that is state, not
  navigation.
- `AuditBand` gained an optional `href` (default `/operations-audit`,
  unchanged for the ~20 routes that render it); the two tool pages pass
  `/operations-audit#book`.
- `grep -rn "#score\|#calculator" app components lib` → one hit, and it is the
  sentence in `app/operations-audit/page.tsx`'s header comment explaining that
  the anchors are gone. Zero live links.

**Indexes.** `app/sitemap.ts` gains both URLs at priority 0.6 (one step below
their parent — they support the page that sells the audit rather than compete
with it). `lib/marketing/llms.ts`'s `buildPageIndex()` gains both by hand: that
index is generated from the content registries, and these are pages, not
registry entries. Both appear in `/llms.txt` and `/llms-full.txt`.

**OG images.** The audit card is now `components/finch/audit/audit-og.tsx`
(`renderAuditOgImage()`), called by all three routes in the cluster. It was
first written as `export { runtime, alt, size, contentType, default } from
"../opengraph-image"` — **Next rejects a re-exported `runtime` outright**
("Next.js can't recognize the exported `runtime` field in route. It mustn't be
reexported"), and the failure is not local: it 500s every route in the app,
including `/`. Worse, Turbopack's compilation-error map held onto it after the
file was fixed, so the dev server had to be restarted before it cleared. Each
route now declares its own four segment exports and imports the picture; `alt`
became `AUDIT_OG_ALT` in `audit-content.ts` so the three copies cannot drift.
All three `/opengraph-image` endpoints return `200 image/png`.

### Deviations from the plan

1. **The two tool buttons are untracked.** The plan does not ask for analytics
   on them, and `lib/analytics.ts`'s taxonomy has no event for "opened a tool".
   Adding one at a call site is how a closed taxonomy stops being one; if Josh
   wants the funnel, the event belongs in `analytics.ts` first.
2. **`AuditWeek`'s bottom clearance went 24 → 48px**, which re-adds 24px to a
   band 6b-fixes round 1 deliberately tightened. The round-2 rule ("≥ 48px of
   clear ground above the straddler's top edge on the dark side") is explicit
   and the other two straddles on the site already sit at 56, so the audit one
   was the outlier, not the standard.
3. **`data-nav-hero`, not `data-ground`, on the page wrapper.** The plan says
   "set `data-ground` on the hero band's parent". That parent is the page's
   `.finch-site` div, which spans the whole document — and `NavGround`'s probe
   now walks `[data-ground]` rects, so a full-height element claiming a ground
   would win every probe on the page. A distinct attribute says the same thing
   without poisoning the measurement.
4. **`/operations-audit` FAQs → footer left at 88px.** The plan lists it to
   check; the receiving element is the paper footer, not a dark band, so the
   ≥ 96 rule does not apply and nothing was changed.

### Verification

```
npx tsc --noEmit      exactly the 3 known whatsapp-ingest errors, nothing else
npx eslint components/finch components/marketing/{OperationsAudit,RoiCalculator}.tsx \
          app/{page.tsx,layout.tsx,pricing,operations-audit,sitemap.ts} \
          app/compare/finch-vs-hiring-a-coo lib/marketing/llms.ts next.config.ts
                      clean, 0 problems
```

Routes (`curl -o /dev/null -w '%{http_code}'`, one `<h1>` each, counted in the
server HTML): `/` 200, `/pricing` 200, `/operations-audit` 200,
`/operations-audit/score` 200, `/operations-audit/calculator` 200,
`/compare/finch-vs-hiring-a-coo` 200. Regression sweep on the shared
`AuditBand`: `/learn`, `/design`, `/faq`, `/compare`, `/academy`, `/contact` all
200.

`/roi-calculator` → **308** → `http://localhost:3000/operations-audit/calculator`.
`/sitemap.xml` lists `/operations-audit`, `/operations-audit/score` and
`/operations-audit/calculator`. Both new pages' JSON-LD blocks parse (sitewide
graph + `BreadcrumbList`), both carry their own canonical, both OG endpoints
return PNG. No horizontal overflow at 375 on any of the three audit-cluster
pages (`scrollWidth === innerWidth`). Console clean on all of them — dev-mode
HMR and Vercel Analytics debug lines only, no warnings, no errors.

**Measurement notes.** Everything above is a single `getBoundingClientRect`
pass per page with the tab fronted, or `curl`. No rAF/FPS/CDP sampling loops.
Two Browser-pane limitations worth recording for whoever comes next: its
`getComputedStyle` returns stale values (an injected `!important` rule on a
simple selector did not move the reported colour), so **colour was verified from
screenshots and from `data-nav-ground`, never from computed style**; and the
pane refuses to scroll the document (`window.scrollTo` and `scrollIntoView` both
leave `scrollY` at 0, with Lenis on *or* off), so mid-page screenshots were
taken by making the viewport tall rather than by scrolling. Rect reads and
`Element.matches` are reliable and are what the numbers come from.

**Not re-verified this pass** (unchanged files, outside the three items): the
motion budget on `/` and `/pricing`, CLS, and `/design`'s band sink beyond its
200. The two new pages carry no device at all, and `/operations-audit` lost two
widgets, so neither can have gained a moving thing.

## Architect note — 6b fixes round 2 (Fable, 2026-08-17) — approved for Josh's re-review
Confirmed: nav ground sequence correct with zero scroll (agent) + SSR
`data-nav-hero="ink"` on /pricing; gaps orbit→quote and Academy→CTA now 110/64;
`/operations-audit/score` + `/calculator` 200 with one <h1>, in sitemap;
`/roi-calculator` 308 → the calculator page; audit page holds the two-button
"Two ways to see it" card + the R2,000 statement band; tsc 3 known; eslint clean.
Note: agent restarted the dev server (Turbopack cached a metadata-route error).

## 6b fixes — round 3

Plan: `.ai/plan_phase6b_fixes3.md` — Josh's third review, two items: "I love
the orange and blue gradient. Replace the black background on the
Book-your-audit tiles across the site with that gradient as the background,"
and a custom bullet per honest group on `/pricing`'s accordion. **Nothing
committed; no git commands run.**

### 1 — The gradient as every closing tile's ground

`GradientRibbon` gained a `dim` prop (`components/finch/ground/GradientRibbon.tsx`,
`ground/impl/GradientRibbonCanvas.tsx`) that linearly mixes every stop —
`--fn-orange`, `--fn-blue-700`, `--fn-blue-300`, and each of the four moving
radial stops — toward `--fn-ink` before it is drawn, in both the base
linear-gradient wash and the `lighter`-composited moving stops. `0` (the
default) is the original 320px accent strip, unchanged, still exercised on
`/design`. `CTA_TILE_DIM = 0.28` is exported from `GradientRibbon.tsx` as the
one number the three closing tiles share (`AuditBand`'s two variants,
`pricing/AuditCta`, `compare/CooCta`), the same "one number, exported"
convention `STRAIGHT_ANSWERS_OVERHANG` set in the first fixes pass.

**Where it landed:**

- `AuditBand.tsx` — **`default`** (the paper-band plate, ~18 routes): the
  plate's flat `#14120E` fill becomes a `-z-10` `GradientRibbon` layer inside
  the same 16px-radius, `overflow-hidden` box, with the existing grain
  `::before` and content painting on top of it (`isolate` added to the plate
  so the negative-z device can't escape the local stacking context and paint
  behind the paper band around it). **`home`** (`/` only): the previous
  full-bleed ink band with a *separate*, absolutely-pinned 240px ribbon strip
  and an `aria-hidden` spacer reserving its height is gone. The ribbon is now
  `Band`'s own `device` — the whole band's background, the same mechanism
  every other living-ground band on the site uses — so the copy sits directly
  on the gradient and the band's height goes back to being the ink padding
  preset plus its content, no reserved strip.
- `pricing/AuditCta.tsx` — drops the `squares`-mode `OscillatingGrid` (until
  now the one reserved bold field on the site) for the same dimmed ribbon.
  The `EXPANDED MANDATES PRICED ON SCOPE` line moves from `--fn-ink-mono` to
  `--fn-ink-text-2`, matching the plan and the paragraph above it — the mono
  ramp reads low-contrast against a gradient in a way it never did against
  flat ink.
- `compare/CooCta.tsx` — drops the `dots`-mode `OscillatingGrid` for the same
  dimmed ribbon. `seam` and the rest of the band are unchanged.

**The button.** `MagneticButton.tsx` gained a third `tone`, `"ink"`
(`tone?: "paper" | "dark" | "ink"`): `bg-fn-ink text-fn-ink-text
hover:bg-fn-ink-fill` — the existing ink ramp's own fill/text/hover-fill
tokens, not a fourth colour decision. All three closing tiles' buttons moved
from `tone="dark"` (orange) to `tone="ink"`; every other CTA on the site
(`AuditStatement`, `CooHero`, `/design`) is unchanged and stays orange —
grepped (`tone="dark"|tone="ink"` across `components/finch` and
`app/design`) to confirm nothing else moved.

**Reduced motion.** The 320px-strip form (`dim === 0`) is unchanged: the
static orange→blue hairline. A tile passing `dim > 0` now gets a full-bleed
static gradient instead — `linear-gradient(90deg, color-mix(in srgb,
var(--fn-orange) 72%, var(--fn-ink)) 0%, color-mix(in srgb, var(--fn-blue-700)
72%, var(--fn-ink)) 55%, color-mix(in srgb, var(--fn-blue-300) 72%,
var(--fn-ink)) 100%)` at `dim = 0.28` — the same stops the canvas' own base
wash uses, mixed toward ink by the same fraction, computed once at layout
with no `app/globals.css` changes needed (no shared static-gradient class was
required — the `color-mix` expression lives inline in `GradientRibbon.tsx`).
Not independently re-verified live: the Browser pane in this session has no
`prefers-reduced-motion` emulation control, so this path was verified by
reading the code and by hand-checking the `color-mix` percentages against the
canvas' own stop order, not by rendering it.

**Contrast.** Measured live on `/pricing#audit` (the `AuditCta` tile, same
`CTA_TILE_DIM` and identical draw code as the other two tiles) via one
`getImageData` pass per sample set — no rAF/CDP sampling loop — reading the
canvas' own RGBA and compositing it over `--fn-ink` by its alpha channel
(the raw canvas buffer is not the on-screen colour; skipping that
composite step gives false near-1:1 contrast readings for translucent
pixels, which is the mistake the first sampling pass in this session made
and corrected before trusting any number below):

| Sample | Text colour | Target | Min | Max |
|---|---|---|---|---|
| H2 row (30 pts across, one moment) | `--fn-ink-text` (`#FAF9F6`) | ≥ 3 (36px/large text) | **12.19** | 16.49 |
| Paragraph row (30 pts across, one moment) | `--fn-ink-text-2` (`#B9B3A3`) | ≥ 4.5 (body) | **6.06** | 8.28 |
| Paragraph, dense grid (6×60 = 366 pts, second moment) | `--fn-ink-text-2` | ≥ 4.5 | **5.67** | — |

`dim = 0.28` clears both targets with comfortable margin (H2 ≈ 4× the floor,
body ≈ 1.25–1.35× the floor across two different animation moments and
sample densities) — no adjustment from the plan's suggested value was
needed. Not exhaustively sampled across every frame of the animation (the
`lighter` composite means simultaneous overlap of multiple stops is
possible and would read brighter than a single-stop sample), but the
per-stop alpha ceiling is time-invariant — only stop *position* animates, not
peak brightness — so the measured margin is expected to hold at any moment,
not just the two sampled.

**Structural check on `/` (home variant).** Doc height ballooned past 40,000px
under a tall-viewport resize (`ScrollSequence.tsx`'s pinned `h-[480vh]` stage
scales with viewport height, so "make the window tall enough to see the
bottom" doesn't work on this page — worth recording since the round-2 fixes
notes recommend exactly that trick), and real wheel-scroll (`computer` tool,
`scroll` action, ~1000px settled per call under Lenis) intermittently timed
out the Browser pane after several calls, consistent with the memory pressure
that later force-restarted the dev server (see Verification). Given that,
the home variant was verified structurally instead of visually: with the
band's `h2` found via DOM query, `data-ground="ink"` is present, the class
list is exactly the ink padding preset (`pt-[60px] pb-[68px]
lg:pt-[112px] lg:pb-[120px]`) plus `fn-ground-grain` — no leftover strip
spacer, no `min-h` — and the device wrapper is `absolute inset-0` (full-band
fill, not the old bottom-pinned box). The draw code is identical to the
`AuditCta` tile already measured above, so the contrast numbers transfer.
`compare/CooCta` **was** reached and screenshotted (that page has no
`480vh` section) — orange glow top-left fading toward ink, warm-white copy,
dark "Book your audit" button, matching the plate's small screenshot on
`/learn`.

**Motion budget.** Read from source rather than sampled live: every
`device=` prop on the site was grepped
(`PlatformShowcase`, `FoundingQuote` — home only; `AuditStatement`,
`AuditWeek` — `/operations-audit` only, and that page never renders
`AuditBand`, per the plan's own exclusion of its "R2,000. Credited." band;
`CooHero` — the COO page's hero, not its closing band; `PricingHero`,
`StraightAnswers` — `/pricing` only). None of the ~20 routes that render
`AuditBand`'s `default` plate carry any other device anywhere on the page, so
the plate is the *only* moving thing on all of them (budget 1). The
homepage's closing band's upstairs neighbour (`UnderTheHood`) and the COO
page's (the cost-bars/table section) both carry no device, so the two seams
the plan names by name (`/` under-the-hood → CTA; COO table → CTA) hold at 1.
The one seam on the site where two devices can be visible together is
`/pricing`: `StraightAnswers` (blue, `FacetPlane`) sits directly above
`AuditCta` (ink, `GradientRibbon`) with no band between them — **max 2**,
at the budget ceiling, not over it.

### 2 — Four `CUSTOM` rows on the pricing accordion

`pricing-data.ts`'s `IncludedGroup` gained an optional `customRow?:
IncludedItem` field — deliberately *not* folded into `items`/`items.length`:
the hover count ("10 MODULES") is a count of the catalogue, and a custom row
is a promise about work that isn't in it, so counting it would make "10
modules" mean nine modules and a promise. Populated verbatim from the plan on
`platform`, `agents`, `integrations` and `onboarding`; omitted on `support`
(no `customRow` field at all, not an empty one) — nothing grounded to
promise there, per the plan.

`WhatsIncluded.tsx` gained `CustomRow`, a sibling to `Item` rather than a
flag on it: an orange 6px dot (`bg-fn-orange`, the same agent-activity colour
`AgentsOnShift`/`BriefPhone`/`DayCard` use elsewhere for "this is live or in
motion," here reused for "this is built for you") instead of `Item`'s grey
5px `bg-fn-faint`; a mono `CUSTOM` chip with an orange-tinted border/text
(`border-fn-orange-tint` / `text-fn-orange-deep`) instead of `Item`'s grey
chip, so a catalogue fact and a bespoke-scope promise don't read as the same
kind of fact; a dashed top rule and `md:col-span-2` so it reads as one row
closing the two-column list rather than one more grid cell in it. Rendered
last inside each group's `<ul>`, after the `.map` of `items`.

`pricing-jsonld.ts` and `lib/marketing/llms.ts` were checked and left alone —
neither enumerates `INCLUDED_GROUPS` or its items (grepped: the only
consumer is `WhatsIncluded.tsx`), so neither could have drifted from the new
copy.

### Verification

```
npx tsc --noEmit
  lib/platform/whatsapp-ingest.ts(4,10)   TS2724  (known)
  lib/platform/whatsapp-ingest.ts(408,36) TS7006  (known)
  lib/platform/whatsapp-ingest.ts(589,5)  TS2353  (known)
  — exactly the 3 known errors, nothing else

npx eslint components/finch app/page.tsx app/pricing app/operations-audit \
          app/compare/finch-vs-hiring-a-coo lib/marketing/llms.ts
  — clean, 0 problems
```

Routes (`curl -s -o /dev/null -w '%{http_code}'`, one `<h1>` counted in the
server HTML): `/`, `/pricing`, `/operations-audit`,
`/compare/finch-vs-hiring-a-coo`, `/learn`, `/faq`,
`/industries/food-suppliers`, `/about`, `/compare` — all 200, one `<h1>` each.

`/pricing`'s SSR HTML (`curl`) contains all four `CUSTOM` chips and their
exact copy — "Custom modules," "Custom agents," "Custom integrations,"
"Custom rollout order" — each paired with `border-fn-orange-tint` /
`text-fn-orange-deep`; `support`'s group has none.

Console: clean after the dev-server restart noted below — HMR/Vercel
Analytics debug lines only, plus one pre-existing warning (`gmail.svg`/
`outlook.svg` width/height mismatch, unrelated file, not touched this pass).

**Dev-server note.** Mid-session the server logged "Server is approaching the
used memory threshold, restarting" and did — almost certainly from this
session's own tall-viewport screenshots and dense `getImageData` sampling
passes, not from the code changes (routes were already passing before the
restart and passed again immediately after, unchanged). Worth recording for
whoever measures contrast this way next: sample from a normal-sized viewport
via an anchor jump (`/pricing#audit`, `AuditCta`'s own `id="audit"`) rather
than resizing the pane to the full document height, and prefer a handful of
targeted samples over a dense grid where a coarser one already clears the
target by a wide margin.

**Not independently re-verified this pass:** the reduced-motion static
gradient's rendered appearance (no media-emulation control in this Browser
pane — verified by code/percentage inspection instead, see §1); the home
variant's live contrast and screenshot (verified structurally instead, see
§1 — the draw code is shared with the tile that *was* measured live); CLS.

## Architect note — 6b fixes round 3 (Fable, 2026-08-17) — approved
Gradient tiles sitewide (AuditBand default + home, AuditCta, CooCta) with
dim 0.28: H2 12.2:1 / body ≥ 5.7:1 measured; ink magnetic buttons on tiles;
reduced motion → static color-mix gradient; four CUSTOM rows on /pricing;
tsc 3 known; routes 200. Josh to eyeball tiles on / and /pricing.
