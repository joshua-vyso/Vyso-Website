# vyso_v3_design.md — depth, contrast, living backgrounds, moving type

Status: PLAN (2026-08-16, Fable; supersedes the earlier "paper/ledger" draft,
which is withdrawn). Research basis:
`Vyso Website/.ai/research/awwwards-motion-design.md` (Awwwards SOTD/tag
sweep, 11 deep-scraped sites incl. Cerebrium, HydraDB, Prolibu, Linearity,
Botblox, Illoca; cross-checked against Linear, Vercel, Attio, Stripe, Folk;
15-technique table; palette evidence). `vyso_v2.md` (page tree, SEO, honesty
rules) stays binding.

## 0. What Josh asked for, in one paragraph

Not paper. **Deep contrast**: sections in deep blue and near-black, some with
**dynamically moving backgrounds** — oscillating grids in burnt orange or deep
blue, waves/oscillation fields; **text that subtly moves with what's behind
it**; **scroll-triggered sections**; **real variety in the Finch cards** (not
the butternut card everywhere) with impacts that are worth acting on
(**R80,000/yr, not R4,200**); design ideas drawn from the best of Awwwards.

## 1. What the research says (the calibration)

1. Every reference-bar site (Linear, Vercel, Attio, Stripe, Folk) spends its
   hero motion budget on **exactly one device** — a glow, a shape, a gradient
   corner, a ribbon. None run a full-field grid/particle system in the hero.
   → **We keep the hero warm-white with one device, and put the black/blue
   living-background bands in the sections below and the closing CTA.**
2. Black + burnt orange reads "premium AI tool" (HydraDB, Linearity.ai) when
   orange is one accent, not a wash. Deep blue can be the *dominant* colour
   of a section (Prolibu) if it has geometric structure (facets/grid), not a
   flat gradient or blob. Warm-white → blue → black transitions work when the
   in-between band carries texture (Illoca, Folk).
3. Restraint = one motion device per section; grid + glow + particles at once
   is the "crypto landing page" failure mode.
4. Everything Josh wants is buildable with `motion` + canvas 2D/SVG/CSS.
   `gsap` is fully replaceable; `three` only if a true WebGL gradient ribbon
   proves necessary (default: canvas 2D). Smooth scroll (Lenis, ~2KB) is used by
   4 of 6 custom Awwwards sites — recommended, needs a dep approval.

Guardrails that still hold: no glass/blur cards, no 3D blobs, no stock photos,
honesty rules, reduced motion → static, CLS 0, Lighthouse perf ≥ 90 on prod.

## 2. Palette & bands (the ground)

Three grounds + one accent discipline. Adjacent bands never share a ground.

| Ground | Fill | Text | Accents | Living background (pick ONE per band) |
|---|---|---|---|---|
| **paper** | `#FAF9F6` | `#14120E` | orange CTA; blue evidence | none, or a single soft blue/orange radial glow at 10–15% drifting slowly (hero only) |
| **blue** | `#163F7A → #1F5FA8` (deep, not electric) — vertical gradient | `#FAF9F6`, secondary `#BFD3EE`, mono `#8FB0DC` | orange `#FF7727` on exactly one element (a CTA, a data point, a stamp) | **faceted plane** (SVG polygons, slow parallax) *or* **oscillating grid** in lighter blue `#3E7BC4` at 25–40% |
| **ink** | `#14120E` (+2% grain via inline SVG turbulence, static) | `#FAF9F6`, secondary `#B9B3A3`, mono `#8A8474` | orange as glow/line/dots; blue for evidence chips | **oscillating grid** in orange `#FF7727` at 20–35% *or* **wave field** in orange/blue *or* **one glow** — never two |
| **seam** | — | — | the orange→blue hairline (once per page) | 24px top-corner radius on the dark slab; the slab overlaps the paper band above by 48px so a card/plate straddles the seam |

Contrast: white on `#1F5FA8` = 6.6:1; white on `#14120E` = 17:1; `#8FB0DC` mono
on blue passes for ≥ 12px; orange `#FF7727` on ink is for glows/lines, not
body text (use `#FFB27A` for orange *text* on ink, 8:1).

Optional upgrade after the first pass: interpolate the page `--bg` between
grounds on scroll (technique #15) instead of hard cuts. Start with hard cuts +
seam overlap — that's already the Illoca pattern and it's safer.

## 3. The living backgrounds (four primitives, canvas/SVG, no three.js)

All: `IntersectionObserver`-mounted (`dynamic import`, mount when ≤ 1 viewport
away), DPR capped at 1.5, ~30fps rAF with delta clamp, paused when the tab is
hidden or the band is off-screen, `prefers-reduced-motion` → render one static
frame (no loop), `content-visibility: auto` on the band. Colours come from CSS
tokens read once at mount so the same component serves blue and ink.

1. **`OscillatingGrid`** (canvas 2D) — a lattice of squares (or dots) at 22–28px
   pitch. Each cell's opacity/scale = `0.5 + 0.5·sin(t·ω + dist(cell, origin)·k)`
   with a slow ω (≈ 0.6 rad/s) so a wave rolls across the field every ~8s. Two
   modes: `dots` (2px, calm — the default) and `squares` (grid lines that
   brighten in a wave — bolder, ink CTA band only). Optional **cursor
   attraction**: the wave origin eases toward the pointer (spring 0.08) so the
   field responds without following. Text over it gets a **soft mask**: cells
   within 80px of the headline's bounding box are dimmed 40% so type stays
   crisp (this is also what makes text feel *in* the field). Orange on ink,
   light-blue on blue.
2. **`WaveField`** (canvas 2D or SVG paths) — 8–14 horizontal sine lines across
   the band, each `y = base_i + A·sin(x·k + t·ω + φ_i)` with A 12–24px, ω 0.5,
   slight per-line phase; stroke 1px orange at 35% on ink (the ghost of the
   old shader, but disciplined) or blue on blue. **Text rides it**: see §4.
3. **`FacetPlane`** (SVG) — 20–40 large low-poly triangles tiling the blue
   band, fills stepped between `#163F7A` and `#2F6FAE`, each facet drifting
   1–3px on a slow loop and parallaxing at 1.08× on scroll. Static, structured
   depth — the Prolibu move. No motion beyond drift; this band's "device".
4. **`Glow`** (CSS/`motion`) — one radial gradient (orange 18% or blue 14%)
   240–320px, drifting on a 12s ease-in-out loop, behind hero text or a CTA.
   Never combined with 1–3 in the same band.

Plus **`GradientRibbon`** (canvas 2D, Stripe-style flowing orange→blue mesh,
confined to a 320px-tall strip) — used on **one** band sitewide (the homepage
closing CTA) as *the* orange→blue moment; falls back to the static hairline
under reduced motion. Prototype in canvas 2D; escalate to `three` only if the
quality bar demonstrably isn't met (Josh decides after seeing it).

Budget: **max two moving things in any viewport** (a background + one text/
card motion). A band's background counts as one.

## 4. Text that moves with what's behind it

Five mechanisms, each subtle (never > 8px displacement), all `motion` values,
all off under reduced motion:

1. **Wave-riding headline** — on `WaveField` bands the headline's `y` follows
   the field's own sine at the headline's x-centre: `y = 5·sin(x_c·k + t·ω)`.
   Same clock as the canvas, so type and lines breathe together. Optional
   per-word: split the headline into words and offset each by its own x
   (2–4px difference between first and last word) — the line visibly *lifts*
   as the crest passes.
2. **Depth parallax** — on scroll, the background layer moves at 1.10×, the
   headline at 0.94×, the card at 1.00× (`useScroll` + `useTransform`), so the
   three planes separate by ~20px across a viewport. Applies to every dark band
   and the heroes.
3. **Grid mask coupling** — on `OscillatingGrid` bands the cells under the text
   dim (see §3.1); as the headline reveals word-by-word, the dimmed mask grows
   with it — the field makes room for the words.
4. **Split-word band reveal** — when a dark band enters, its Statement words
   rise 10px with a 30ms stagger and 500ms ease-out; the band's hairline draws
   in the same 500ms.
5. **Magnetic CTA + cursor parallax** — primary buttons pull ≤ 10px toward the
   pointer within a 120px radius (spring), snap back on leave; on paper heroes
   the card and the glow drift 2–4px opposite the pointer.

Never: text warping/skewing, per-letter jitter, text following the cursor.

## 5. The finding library — variety and magnitude

Single source of truth: `lib/marketing/findings.ts`. Every FindingCard on the
site (heroes, sequence, showcase, brief bubbles, day strip, industry decks,
solutions, OG images) draws from it by id — no inline card copy anywhere.

**Magnitude rule.** Impacts are annualised at a stated volume so they're
believable *and* worth acting on. Every card carries the basis in its mono
meta (`6 × 20L/DAY · 26 DAYS`, `18 PALLETS/MO`, `R2.1M/MO PURCHASES`). Range for
the flagship examples: **R38,000 – R240,000 / yr**; small ones (R4,200) exist
only as "resolved" or "minor" cards for contrast. Illustrative label stays.

**The flagship example stays butternut — at a real magnitude** (Josh, 2026-08-16:
"change the butternut pricing to 58k a year instead of 4.2k"). Everywhere the
butternut card appears (homepage hero, sequence beat 4, showcase 1a/1c, brief
bubble 1, root OG, day strip, `/finch`-era leftovers):
> PRICE WATCH · *Butternut up 12% at FreshCo since June.* · **≈ R58,000/yr at
> current volumes** · 3 invoices ↗ · `FRESHCO · +12% · ≈ 650 BAGS/MO · JUN–AUG`
> · Draft supplier email · Show 6-month trend · Dismiss.
The basis line makes the number believable (12% on ~650 × R62 bags/month ≈
R58k/yr). Showcase 1a's headline becomes "…one is worth R58,000 a year", 1c's
hero stat "≈ R58,000/yr at your current ~6.5t/month", the evening brief
"…one's worth R58,000", the day-strip card and every JSON/OG string update in
one place because they read from the library. Cooking oil (+14% at Umgeni Oils,
≈ R82,000/yr) becomes a *second* Price Watch card, used on other pages.

**Roster (24 cards, grouped):**
- *Price Watch*: butternut R58k (flagship, above) · cooking oil +14% at Umgeni Oils (R82k) · tomatoes Gr.1 seasonal spike (R41k) · packaging film +9% (R28k) · diesel at two depots (R96k, farms/wholesale)
- *Recon*: 20 vs 18 drums (R756 → keep as the "small but real" one) · 40 vs 36
  crates short-delivered weekly (R58k/yr) · invoice priced off last quarter's
  list (R33k) · double-billed delivery fee (R14k)
- *Debtors*: Thyme & Basil day 48 (R23,400 outstanding) · three accounts past
  60 days totalling R187,000 · a customer paying 12 days later each quarter
  (R41k cash-flow cost)
- *Stock Sense*: cooking oil cover 22 days (R9,800 → resolved) · frozen stock
  written off (R64k/yr, restaurants) · overstock ahead of a public holiday
  (R38k tied up)
- *Margin Watch* (new example agent): gross margin 31.4 → 29.3% (R18,600/mo =
  R223,000/yr) · one SKU sold below cost after a supplier increase (R52k/yr)
- *Delivery Watch* (wholesale/farms): route km vs delivery notes (R71k/yr fuel)
- *Waste Watch* (restaurants): 4.2% plate waste on two lines (R47k/yr)
- *Roster Watch* (security, experimental): guard hours billed vs rostered
  (R120k/yr on one contract) · vehicle fuel creep (R39k)
- *Renewals* (insurance, experimental): 11 policies lapsing in 30 days
  (R84,000 commission at risk) · commission statement short by 3 lines (R6,400)
- *The Brief*: the evening/morning summary cards.

**Variety rules.** No two pages' heroes show the same card. Heroes **cycle** 3
findings (crossfade + 6px lift every 6s, pause on hover, reduced motion → the
first only). States vary (NEW / IN PROGRESS / RESOLVED). Card **variants**:
`compact` (bubble-sized), `standard`, `wide` (adds a 120px sparkline or a
two-column diff), `stack` (three fanned — industries), and `ink` (a dark
variant for blue/ink bands: `#1B1915` fill, hairline `#2A2722`, same accents).
Two new example agents (Margin Watch, Delivery Watch) join the homepage's six;
experimental agents appear only on their vertical pages.

## 6. Scroll-triggered sections (catalogue)

Existing and kept: homepage sequence (5 beats), showcase forward/reverse,
COO day strip, checklist, deck, gauge, chart draws. New:

- **Ground transitions** — hard cut with seam overlap on first pass; upgrade
  to scroll-interpolated `--bg` (paper → blue → ink) later.
- **Pinned horizontal strip** — "What Finch watches" on desktop: the six agent
  cards sit in a row wider than the viewport; the section pins for 160vh while
  the row translates left, each card's micro-visual playing as it crosses
  centre; mobile: vertical list. One pinned section per page max (the
  homepage already has two — sequence + showcase — so this goes on
  `/industries/*` or `/solutions` instead, not the homepage).
- **Stat stamps** — big rand numbers stamp when 40% in view (scale 1.3→1),
  never count up (calculators excepted).
- **Band-enter choreography** — split-word Statement + hairline draw +
  background fades from static to live over 600ms as the band reaches 30%.
- **Cursor-aware fields** — grid origin eases toward the pointer (desktop only).
- **Route transitions** — 220ms crossfade of `.finch-site` (View Transitions
  API if stable in Next 16.2; else `motion` presence); nav persists.
- **Smooth scroll** — Lenis (dep approval), disabled under reduced motion.

## 7. Per-page composition (no two adjacent nav pages share a hero device)

| Page | Hero (paper unless noted) — one device | Deep bands & their device | Text motion | Cards |
|---|---|---|---|---|
| `/` | Split hero, **cycling finding card** + soft orange glow drifting | sequence on paper (unchanged) → showcase in a **blue** band, `FacetPlane` behind the frame → agents on paper → orbit on paper → quote in **ink** with `WaveField` (orange) — the quote rides the wave → under-the-hood on paper → CTA in **ink** with `GradientRibbon` | wave-riding quote; split-word reveals; magnetic CTAs; hero cursor parallax | hero cycles butternut / short-delivery / debtors-60-day; sequence = butternut (R58k); brief bubbles = butternut + Thyme & Basil + Umgeni recon (as today, magnitudes from the library) |
| `/pricing` | **Ink hero**: `OscillatingGrid` (orange dots), R6,000 at 96px in warm-white, "Everything included." italic — the price is the drama | founding terms on paper → what's included on paper → straight answers in **blue** (`FacetPlane`, bubbles in ink variant) → Academy on paper → CTA in ink (grid, squares mode) | R6,000 stamps; grid mask under the price | one `wide` card in the FAQ band: margin 31.4→29.3% |
| `/operations-audit` | Split hero (form right) + blue glow | "how the week runs" in **blue** with `OscillatingGrid` (light-blue dots) — 7 day-dots stamp along the grid → assessment + calculator on paper → "R2,000. Credited." Statement in **ink** with `WaveField` → FAQs paper | statement rides the wave; stamps | calculator card; audit card |
| `/industries/*` | Deck hero (3 cards, vertical roster) + soft glow | "what Finch watches" as **pinned horizontal strip** on paper → vertical claim in **blue** (`FacetPlane`) → CTA ink (grid) | split-word claim; deck parallax | vertical-specific ids only |
| `/solutions` + 4 | Checklist hero | symptoms → diagnosis in **ink** (`OscillatingGrid` orange, mask under the generated card) → CTA blue | card assembles inside the field | per-solution ids |
| `/compare/finch-vs-hiring-a-coo` | **Ink hero**: `WaveField` orange, Statement "A COO's day. Done by breakfast." riding the wave; gradient hairline | day strip on paper → cost bars in **blue** (`FacetPlane`) → table paper → CTA ink | wave-riding statement; bar stamps | day-strip cards from the library (butternut R58k, short delivery, debtors 60-day, overstock, brief) |
| other compare + hub | Split hero + glow | table paper → verdict **blue** → CTA ink | — | one `wide` per page |
| `/platform/modules` | Wiring diagram in a **blue** hero (`FacetPlane` behind) | groups paper → CTA ink | diagram lines draw | — |
| `/platform/modules/[slug]` | Split hero, screenshot on paper | features paper → "how Finch uses it" **ink** (grid dots) → CTA blue | — | one card per module |
| `/integrations` | Reading table hero on paper + blue glow | per-tool paper → "nothing to migrate" **blue** (`FacetPlane`) → CTA ink | rows reveal | — |
| `/about` | **Ink hero** with `Glow` (orange) only, "Vyso, the company." | timeline paper → principles **blue** → facts paper → CTA ink | split words | none |
| `/academy` | Split hero + seat grid | curriculum paper → "R500 a seat" **blue** | — | none |
| `/faq` | Paper, calm (chat opener) | accordion paper → CTA **blue** | — | none |
| `/learn`, articles | Editorial paper | related **blue** → end finding **ink** (grid) | hairline | end finding from library |
| glossary | Paper | — | — | example from library |
| `/resources` | Split hero | cards paper → CTA ink | flip | — |
| case study | **Ink hero** with the quote riding a `WaveField` | facts paper → demo paper → CTA blue | wave-riding quote | none (real quotes only) |
| `/founding-client` | Split hero | terms **blue** (stamps) → cohort paper → CTA ink | stamps | — |
| `/south-africa` | Map hero on **blue** (`FacetPlane`) | facts paper → CTA ink | — | — |
| contact / legal / 404 | Paper only, one glow | — | — | 404 card |

Homepage keeps its two pinned sections; every other page has at most one.

## 8. Global

- Nav inverts over blue/ink bands (`data-ground` observer): text → `#FAF9F6`,
  CTA stays orange.
- Footer sits on **ink** with a *static* `WaveField` frame (no loop) and the
  wordmark at 120px / 8%.
- OG images get blue/ink variants for pages whose hero is dark.
- Cursor native. No sound.

## 9. Performance & accessibility budget

- Each canvas: DPR ≤ 1.5, ≤ 1 viewport in size, ~30fps, IO-gated, paused when
  hidden; total main-thread work per frame < 4ms on a mid phone (measure with
  the Performance panel; sample 3 bands).
- CLS 0: bands reserve height; canvases absolutely positioned.
- Reduced motion matrix: grids/waves/facets → one static frame; glow → static;
  wave-riding/parallax/magnetic → off; split reveals → instant; Lenis → off;
  ribbon → hairline; cycling cards → first card.
- Contrast pairs in §2; focus rings visible on dark (`#C9DEF7` 2px).
- Lighthouse: perf ≥ 90 mobile on prod for `/`, `/pricing`, `/operations-audit`;
  a11y ≥ 95; SEO 100 (unchanged).

## 10. Phases (Fable plans, agents build; Josh reviews on localhost)

**6a — primitives + kitchen sink (Opus, one agent):** `components/finch/ground/`
(`Band`, `OscillatingGrid`, `WaveField`, `FacetPlane`, `Glow`, `GradientRibbon`,
`Seam`), `components/finch/text/` (`Statement`, `WaveText`, `SplitReveal`,
`Parallax`, `MagneticButton`), `lib/marketing/findings.ts` + `FindingCard`
variants (`compact/standard/wide/stack/ink`) + `CyclingFinding`, tokens
(`--fn-blue-*`, `--fn-ink-*`, grain), nav ground observer, route fade,
`app/design/page.tsx` (noindex, dev-only kitchen sink: every primitive on every
ground at 1440/375, motion toggles, reduced-motion toggle, FPS meter). Also
the flagship magnitude change (butternut R4,200 → R58,000/yr, with the volume
basis) across hero/sequence/showcase/bubbles/day strip/OG via the library. **Gate: Josh + Fable review `/design` and the homepage before 6b.**
Dep decision needed at 6a start: Lenis (recommended). `three` stays out
unless the ribbon fails the bar.

**6b — money pages (Opus ×2, parallel):** `/`, `/pricing`, `/operations-audit`,
`/compare/finch-vs-hiring-a-coo` per §7.

**6c — the rest (Sonnet ×3 by cluster):** industries + solutions (incl. the
pinned horizontal strip); modules + integrations + compare; about/academy/faq/
learn/glossary/resources/company/legal/404.

**6d — polish:** motion-budget audit (≤ 2 moving per viewport, one device per
band), reduced-motion pass, canvas perf sampling, Lighthouse on prod build
(needs the WhatsApp fix), OG dark variants, Phase 5 deletions (`three`, `gsap`,
old components) once approved.

Definition of done per page: nameable ground sequence with ≥ 1 blue and ≥ 1
ink band; one living background per dark band; one text-motion mechanism;
cards from the library only, none repeated across heroes; passes the
"swap the logo — still obviously Vyso?" test.

## 11. Decisions (taken 2026-08-16)

1. **Lenis** — a ~2KB open-source smooth-scroll library (MIT) that replaces the
   browser's stepped wheel scroll with eased momentum, so scroll-linked
   animations feel continuous; 4 of 6 custom Awwwards sites in the research use
   it. Josh hasn't seen it → 6a installs it **behind a toggle on `/design`**
   (off by default, off under reduced motion) so it can be judged live; keep or
   remove after review.
2. Flagship stays **butternut, ≈ R58,000/yr** (see §5).
3. **Build-first** — 6a builds the kitchen sink; Josh reviews on localhost.
4. **Phase 5 deletions approved** — run before 6a (plan:
   `.ai/plan_phase5_deletions.md`).
