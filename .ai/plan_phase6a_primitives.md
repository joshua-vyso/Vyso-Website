# Plan — Phase 6a: design-depth primitives, findings library, `/design` kitchen sink

Source: `.ai/vyso_v3_design.md` (read ALL of it first — §2 grounds, §3 living
backgrounds, §4 text motion, §5 finding library, §9 budgets, §11 decisions) +
`.ai/research/awwwards-motion-design.md` §4–5. Standing rules from `vyso_v2.md`
still hold (no glass, honesty, reduced motion, SSR-safe, one `<h1>`, no git).
This phase touches NO marketing page except the flagship-magnitude change and
mounting the two global bits (nav ground observer, route fade). Pages get
recomposed in 6b/6c after Josh reviews `/design`.

## Deliverables

### 1. Tokens (`app/globals.css`, Finch block only — append, don't reorder)
`--fn-blue-900:#163F7A; --fn-blue-700:#1F5FA8; --fn-blue-500:#2F6FAE;
--fn-blue-300:#3E7BC4; --fn-blue-text:#FAF9F6; --fn-blue-text-2:#BFD3EE;
--fn-blue-mono:#8FB0DC; --fn-ink:#14120E; --fn-ink-2:#1B1915; --fn-ink-line:#2A2722;
--fn-ink-text:#FAF9F6; --fn-ink-text-2:#B9B3A3; --fn-ink-mono:#8A8474;
--fn-orange-on-ink:#FFB27A;` + `@theme inline` colour aliases; a
`--fn-grain` data-URI (inline SVG `feTurbulence`, baseFrequency .9, 2 octaves,
rendered at 6–8% opacity via a `::before` on ink bands — static, no blur).

### 2. `components/finch/ground/`
- `Band.tsx` — `ground: "paper"|"blue"|"ink"`, `seam?: boolean` (24px top
  radius + −48px margin overlap + z-index so the previous band's card can sit
  across), `device?: ReactNode` (the living background slot, absolutely
  positioned, `aria-hidden`), `padding` presets per ground (§4 of the earlier
  rhythm: paper 110, blue 96/120, ink 120/140), sets `data-ground` for the nav
  observer, `content-visibility:auto` + `contain-intrinsic-size` reserve.
- `OscillatingGrid.tsx` (client, canvas 2D) — props `mode:"dots"|"squares"`,
  `color` (token name), `pitch=24`, `speed=0.6`, `cursor?:boolean`,
  `maskRef?: RefObject<HTMLElement>` (dims cells within 80px of that element's
  rect, 40%). IO-mounted via `next/dynamic` in a tiny wrapper, DPR ≤ 1.5, rAF
  ~30fps with delta clamp, pause on `document.hidden`/off-screen, `resize`
  handled, `useReducedMotion` → draw one static frame at t=0.
- `WaveField.tsx` (client, canvas 2D) — `lines=10`, `amplitude=16`, `speed=0.5`,
  `color`, `opacity=.35`; exposes its clock + wave function through a small
  context (`WaveClockProvider`) so `WaveText` can ride the same sine; static
  frame under reduced motion; footer uses `static` prop.
- `FacetPlane.tsx` (SVG) — deterministic seeded triangulation (no `Math.random`
  at render — seed prop) of the band into 24–40 facets between `--fn-blue-900`
  and `--fn-blue-500`, each facet `motion.polygon` drifting 1–3px on a 10–14s
  loop with per-facet phase; parallax 1.08× via `useScroll` on the band; static
  under reduced motion.
- `Glow.tsx` — CSS radial gradient (orange 18% / blue 14%), 240–320px, drifting
  on a 12s loop (`motion` on `x/y`), static under reduced motion.
- `GradientRibbon.tsx` (client, canvas 2D) — flowing orange→blue mesh
  (Perlin/simplex noise implemented inline — no dep — driving 4 moving colour
  stops across a 320px strip), same gating; reduced motion → the static
  hairline. Note in a comment that `three` is the escalation path only if
  Josh judges the canvas version insufficient.

### 3. `components/finch/text/`
- `Statement.tsx` — STIX 500 72/1.0 desktop (52 mobile), ≤ 5 words, optional
  `italicWord`, colour from ground; `SplitReveal` built in (words rise 10px,
  30ms stagger, 500ms ease-out on enter, once; instant under reduced motion).
- `WaveText.tsx` — wraps a heading; reads the `WaveClock`; per-word `y = 5·sin(x_c·k + t·ω)`
  (x_c measured per word once on mount + resize); off under reduced motion or
  when no clock.
- `Parallax.tsx` — `speed` prop (0.94 / 1.00 / 1.10) using `useScroll` on the
  nearest band + `useTransform`; off under reduced motion.
- `MagneticButton.tsx` — wraps a button/link; ≤ 10px pull within 120px radius,
  spring back; disabled on coarse pointers + reduced motion.

### 4. Findings library + card variants
- `lib/marketing/findings.ts` — the 24 cards from `vyso_v3_design.md` §5 (ids,
  agent, observation, impact string, evidence, meta WITH the volume basis,
  state, actions, `visual?: "sparkline"|"diff"|"bar"|"gauge"|null`, industry
  tags, "small" flag). **Butternut flagship = ≈ R58,000/yr, meta
  `FRESHCO · +12% · ≈ 650 BAGS/MO · JUN–AUG`.** Cooking oil R82k is a second
  Price Watch card. Keep the R756 recon and R9,800 resolved as "small".
- `FindingCard.tsx` — add `variant: "compact"|"standard"|"wide"|"ink"` and
  `finding?: FindingId` (pulls from the library); `wide` renders the mini
  visual (reuse the micro-visual pieces from `components/finch/agents/`);
  `ink` = `--fn-ink-2` fill, `--fn-ink-line` border, same accents. Existing
  callers keep working (props default to today's behaviour).
- `FindingStack.tsx` — three cards fanned (the industries deck already does
  this — extract/reuse, don't duplicate; if the deck is already reusable, skip).
- `CyclingFinding.tsx` — cycles 3 ids (crossfade + 6px lift, 6s, pause on
  hover, first only under reduced motion; SSR renders the first).
- **Flagship magnitude change** across existing content: `BriefPhone`/`ScrollSequence`
  beat-4 card + brief bubble 1 ("…one's worth R58,000"), `showcase/data.ts` (1a
  headline "…one is worth R58,000 a year", 1c stat "≈ R58,000/yr at your
  current ~6.5t/month", recommendation copy adjusted only where the number
  appears), `components/finch/day/day-beats.ts`, `lib/og/*` root card, homepage
  hero card, `HomeHero`/`FindingCard` defaults, `agents-data.ts`. Grep for
  `R4,200` and `4,200` → each occurrence either becomes R58,000 (butternut) or
  is a deliberately small card; report each.

### 5. Global bits (mounted now, safe on every page)
- `components/finch/NavGround.tsx` — IntersectionObserver on `[data-ground]`
  bands; sets `data-ground` on `<html>` (or the nav) so `FinchNav` inverts over
  blue/ink (text `--fn-ink-text`, CTA unchanged); no bands yet on real pages so
  it's inert until 6b.
- Route fade: 220ms crossfade of `.finch-site` on pathname change via
  `motion` `AnimatePresence` in a client `RouteFade` wrapper mounted in
  `app/layout.tsx` (check Next 16.2 docs for `experimental.viewTransition`
  first; use it if stable, else the wrapper). Reduced motion → none.
- **Lenis** — `npm install lenis`; `components/finch/SmoothScroll.tsx` mounts it
  ONLY when `localStorage["fn:lenis"]==="1"` (toggle lives on `/design`) and
  not under reduced motion; default off. This is a preview so Josh can judge
  it — say so in a comment.

### 6. `/design` kitchen sink (`app/design/page.tsx`, `robots: noindex`, and
`notFound()` when `process.env.NODE_ENV === "production"` unless
`process.env.NEXT_PUBLIC_DESIGN_ROUTE === "1"`)
Sections, each labelled with a mono eyebrow and a short "why" line:
1. Grounds: paper → blue (FacetPlane) → ink (OscillatingGrid dots, orange) →
   paper → ink (WaveField + a `WaveText` Statement riding it) → blue
   (OscillatingGrid light-blue) → ink (GradientRibbon strip) → seam demo (a
   `standard` card straddling a paper→ink seam).
2. Text: Statement with italic word; SplitReveal; Parallax planes demo;
   MagneticButton row (primary + secondary).
3. Cards: all 24 findings rendered `standard` in a grid with ids; the four
   variants side by side; `ink` variant on an ink band; `CyclingFinding`;
   `FindingStack`.
4. Controls (client, top-right sticky): toggles for reduced-motion emulation
   (adds a class that forces the static paths), Lenis on/off, cursor
   attraction on/off, an FPS meter (rAF counter) and a "moving things in
   viewport" counter (each device registers itself while animating; the
   counter shows the number — must read ≤ 2 anywhere in the sink except the
   cards grid).
5. Mobile: everything must render at 375 (canvases scale, facets simplify to
   ≤ 16, statements 52px).

## Verification (agent)
tsc (only the 3 known WhatsApp errors), `npx eslint components/finch lib/marketing/findings.ts app/design app/layout.tsx` clean; `/design` 200 at 1440/375 in a **fronted** tab (background tabs freeze rAF): every canvas animating (sample pixel deltas over 1s), reduced-motion toggle freezes them, FPS ≥ 50 on the sink page at 1440 with 3 canvases visible, main-thread per frame sampled (`performance.now()` around the rAF body) < 4ms each; `/` still renders with the R58,000 butternut in hero, sequence, showcase, bubbles; grep `R4,200` report; nav inversion inert on `/`; route fade works between `/` and `/pricing`; console clean. Append "## 6a — primitives" to `.ai/implementation_phase6.md`.

## Gate
Josh + Fable review `/design` on localhost before 6b starts. Josh decides:
Lenis keep/remove; ribbon canvas vs escalate; any device to drop.
