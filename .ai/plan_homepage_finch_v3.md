# Plan: Homepage v3 — scroll-driven showcase demo, copy tweaks, integrations orbit

Builds on v1/v2 (`.ai/plan_homepage_finch.md`, `_v2.md`, report
`.ai/implementation_homepage_finch.md`). Same constraints as before: `motion`
only, no new deps, no commits, don't touch shared Navbar/SiteFooter/api/lib/
supabase/untracked WhatsApp files, zero glassmorphism, SSR-safe, exactly one
`<h1>`. Dev server runs on :3000 with HMR — don't start another.

## Part 1 — PlatformShowcase: scroll-direction-driven demo (desktop ≥ lg)

Replace the play-once `useInView` trigger with a bidirectional, scroll-
direction-driven controller. Behaviour:

- Track the section's visibility (IntersectionObserver or `useInView` with
  `amount: 0.4`) and the scroll direction (compare `scrollY` per scroll event;
  a direction only "counts" after ≥ 24px cumulative movement that way — this is
  the hysteresis that stops trackpad jitter flapping).
- Rule: while the frame is ≥ 40% visible:
  - direction **down** and view is `1a` and no demo playing → play the
    **forward** demo (existing: cursor in → to "Show 6-month trend" → press →
    1c → chart draws → cursor out).
  - direction **up** and view is `1c` and no demo playing → play the
    **reverse** demo: cursor fades in near the top-left of the frame (~(120,140)
    frame coords), travels ease-out to the measured centre of "‹ Back to
    today's brief" (~0.9s), presses (same 120ms scale-down + a brief text-colour
    change on the link to `#BE5D23`), 1c fades out (opacity 1→0, y 0→8, 260ms)
    while 1a fades in (opacity 0→1, scale .985→1, 320ms), cursor fades out. The
    1a cards' entrance is subtle: the three feed cards stagger in
    (y 10→0, opacity, 60ms apart) so the return has life.
- The demo can play many times (down → forward, up → reverse, down → forward
  …). Debounce: after a demo finishes, ignore triggers for 400ms.
- Real clicks still work and set the view; they cancel any playing demo. But
  unlike v2 they do NOT permanently disable the scroll trigger — the next
  direction change that matches the rule plays again. (A user who scrolls up
  after clicking Back themselves sees nothing extra because view is already 1a.)
- Keyboard: `Escape` while the frame has focus cancels the demo.
- Reduced motion: same rule but instant view swaps (no cursor, chart pre-drawn).
- Mobile (< lg): unchanged tap flow (no scroll trigger — the mobile mock is
  static and the user taps).
- The chart re-draw on every forward entry is fine; make sure motion values
  reset to 0 at the start of forward and end at 1 (don't leave half-drawn
  paths when a reverse interrupts — reset on view change).

Implementation notes: keep one imperative controller (`useRef` state machine:
`idle | forward | reverse`, `view: '1a'|'1c'`, `lastY`, `accum`), and one
`useAnimate` scope; expose `cancel()` that stops the running sequence and
hides the cursor. Attach the scroll listener with `{ passive: true }` and only
while the section is mounted; remove on unmount. Never read `window` during
render.

## Part 2 — copy

- `WhatFinchWatches.tsx` H2: `Five agents on shift, all day, every day.` →
  `Custom agents on shift, all day, every day.`
- `PlatformShowcase.tsx` H2: `This is what Finch looks like when you open it.`
  → `Finch is ready to go, whenever you need it.` Sub-copy stays.

## Part 3 — Senses section → radial auto-cycling integrations orbit

Section `components/finch/Senses.tsx` keeps its left column (eyebrow
`SENSES, NOT INTEGRATIONS`, H2 `We put your current tools into Finch.`, the
paragraph). The right column's five text rows are replaced by
`components/finch/IntegrationsOrbit.tsx` (`"use client"`), inspired by
folk.com's hero widget — read `.ai/research/integrations-orbit.md` FIRST for the
observed mechanics and for the logo files + status verbs; follow what it found
where it's specific, and use the spec below where it isn't.

Widget spec (logical canvas 560×420, scaled to the column width via
`aspect-ratio` + a `scale` transform, transform-origin top left; layout reserved):
- **Capsule** (the "dock"): a horizontal pill on the lower-middle of the canvas,
  width 380, height 156, radius 78, background `#F5F2EA`, border 1px `#E7E3DA`,
  inset shadow-free (flat). Left end holds the **Finch circle** (d 120, white,
  border 1px `#E7E3DA`, shadow `--fn-shadow-card`; content: `finch-bird.svg`
  40px + word "Finch" in STIX 20px beneath? — no: keep it clean: bird 44px
  centred, mono label `FINCH` 10px .14em `#8A8474` below the circle, outside).
  A thin animated ring around the Finch circle when a swap happens: 2px, colour
  `#FF7727` at 45% opacity, scale 1→1.12 fade — the ONLY orange in the widget
  (agent-activity pulse). Right end holds the **active integration circle**
  (d 120, white, same border/shadow) with the logo at ~56px.
- **Orbit**: a faint circular arc (1px `#E7E3DA`, radius 190, centre = centre
  of the active circle) on which the *inactive* integrations sit as smaller
  circles (d 64, white, border `#E7E3DA`, logo ~30px rendered at 55% opacity
  and `filter: grayscale(1)`), evenly spaced by angle over the visible portion
  of the arc (top-left → top → right side; the arc portion below/left of the
  capsule is off-canvas/hidden — same as folk). Icons never overlap the copy
  column.
- **Cycle**: every 3.2s the ring rotates one step (angle step = 360/N,
  ease-in-out 700ms): the next inactive icon glides along the arc into the dock
  position, growing to d 120 and losing the grey filter (100–250ms ease-out
  fades), while the previous active icon shrinks and greys as it moves to the
  next arc slot. Implement with `motion` values: each icon has an angle motion
  value; the "dock" is a fixed angle (e.g. 90° pointing to the capsule end);
  positions derive from angle via `useTransform` (x = cx + r·cos, y = cy − r·sin).
  Simplest robust approach: keep icons on the arc, and treat the dock slot as
  angle 0 with r 0 offset — i.e. items animate along the arc to angle 0, and at
  angle 0 the transform also lerps radius→0 and scale→1.875 (64→120). Use
  `animate()` sequences per step; pause when the tab is hidden
  (`document.visibilityState`) and when the section is out of view
  (`useInView`); pause on hover over the widget; reduced motion → static
  (Xero docked, others on the arc, no cycling).
- **Status chip**: below-left of the capsule (or over its left edge, folk-style):
  white pill, border 1px `#E7E3DA`, shadow `--fn-shadow-card`, radius 999,
  padding 8px 14px, containing the active logo at 18px + text 13.5px/500
  `#4A463C`: `Reading your Xero books` etc. Text crossfades (opacity + y 6px,
  180ms) on each step. Verbs — use these for the core five (matching the copy
  we already had):
  - Xero → `Reading your books in Xero`
  - WhatsApp Business → `Talking to you on WhatsApp`
  - Yoco → `Watching the takings in Yoco`
  - Sage → `Reading the ledger in Sage`
  - Loyverse → `Seeing what leaves the shelf in Loyverse`
  Additional integrations from the research file: use its proposed verbs; keep
  the total ≤ 9 icons so the arc stays airy. Order: Xero first (docked on
  load), then WhatsApp, Yoco, Sage, Loyverse, then the rest.
- Logos: `next/image` from `/finch/integrations/<slug>.(svg|png)` written by the
  research agent; if a logo file is missing/broken, render a fallback circle
  with the integration's initial in mono 14px `#8A8474` — never a broken image.
- Accessibility: the widget is decorative → wrapper `aria-hidden="true"`, and
  render a visually-hidden `<ul>` list of "Integration — verb" for screen readers.
- Mobile (< lg): the widget sits under the copy, full width, scaled from the
  560×420 canvas (aspect-ratio box); check nothing clips at 375 (icons on the
  arc must stay inside the canvas — reduce r/positions if needed).
- Colour discipline: only the pulse ring uses orange; no blue; logos are the
  only saturated colour (that's the point, like folk).

## Files

MODIFY `components/finch/PlatformShowcase.tsx` (+ `showcase/Cursor.tsx`
if the reverse path needs a start-position prop), `components/finch/WhatFinchWatches.tsx`,
`components/finch/Senses.tsx`. CREATE `components/finch/IntegrationsOrbit.tsx`
(+ `components/finch/integrations.ts` data: slug, name, verb, src). Report
section "v3" in `.ai/implementation_homepage_finch.md`.

## Verification

`npx tsc --noEmit` (only the 3 known pre-existing errors), `npx eslint
components/finch app/page.tsx` clean. Browser at 1440×900: scroll down into the
showcase → forward demo; scroll up while it's in view → reverse demo → 1a;
down again → forward again; click Back mid-way → demo cancels; orbit cycles
every ~3.2s, status chip text follows, pauses on hover; 375px: orbit fits, tap
flow of the showcase unchanged; console clean; `scrollWidth === innerWidth`.
