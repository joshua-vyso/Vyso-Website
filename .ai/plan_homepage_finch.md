# Plan: Homepage rebuild — Finch launch (`/`)

Parent plan: `.ai/plan_site_rebrand.md` (approved by user 2026-08-15 for this scope:
**homepage only, run on localhost, make it look up to scratch**). Other pages,
redirects, deletions, OG images and the sitewide glass sweep are LATER passes and
must NOT be started here.

Design source of truth (already on disk, read these first, in this order):
1. `.ai/design/uploads/claude_design_brief_finch_site.md` — brand rules + judging bar
2. `.ai/design/Homepage.dc.html` — desktop homepage, pixel-level styles + the
   scroll-sequence maths in the `<script>` at the bottom (`tick()`)
3. `.ai/design/FindingCard.dc.html` — the atomic component + tilt logic
4. `.ai/design/Mobile.dc.html` — mobile homepage (static beats, reveal-on-scroll)
5. `.ai/design/assets/finch-bird.svg`, `.ai/design/assets/vyso-wordmark.svg`
`support.js` is the Claude Design runtime — ignore it (only shows what
`style-hover`, `dc-import`, `sc-for` mean: hover styles, component import, loop).

Repo facts (verified 2026-08-15):
- Next.js **16.2.7** app router at repo root (`app/`, no `src/`), React 19.2, TS
  strict, alias `@/*`. `AGENTS.md`: read `node_modules/next/dist/docs/` before
  writing route code — APIs differ from training data.
- Tailwind **v4** CSS-first (`app/globals.css`, `@theme inline`), no tailwind.config.
- `motion` ^12.40 IS installed (import from `"motion/react"`). framer-motion is
  NOT to be added. No other new deps.
- Fonts via `next/font/google` in `app/layout.tsx`; `Instrument_Sans` already
  loaded as `--font-instrument` (400–700).
- Homepage today: `app/page.tsx` (`"use client"`), imports BounceDot, Navbar,
  HeroSection, IntegrationsMarquee, SystemsShowcase, HowItWorks, AppsShowcase,
  TrustStrip, ContactSection, SiteFooter, WebGLShaderBackground. All of that is
  being replaced on `/`. `Navbar`/`SiteFooter` are shared with other pages —
  DO NOT edit them; the new homepage gets its own nav/footer.
- Root layout renders `<LiquidGlassFilter />` and `<GlobalPixelTrail />` globally.
- Contact/waitlist form: `components/ContactForm.tsx` → `POST /api/contact`
  (Resend). `tier` is optional server-side (`app/api/contact/route.ts:54`).
- Branch `feat/ui-brief-reskin`; working tree has UNRELATED uncommitted WhatsApp
  work (`app/api/whatsapp/`, `lib/platform/whatsapp-*`, `supabase/whatsapp-ingest.sql`,
  `tests/whatsapp.test.ts`, `vercel.json`, `docs/whatsapp-ordering.md`,
  `public/serviceden-logo-concept.svg`). Do not touch, stage, revert or commit any
  of it. Do not commit at all — user reviews on localhost first.

## Goal

Replace `/` with a faithful Next.js implementation of `Homepage.dc.html`
(desktop) + `Mobile.dc.html` (≤ lg), using the design's exact copy, colours,
type, spacing and motion, with the finding card as a reusable component and the
five-beat scroll sequence as the centrepiece. Zero glassmorphism on the page.

## Acceptance criteria

1. `/` renders the design's sections in order: Nav · Hero (H1/sub/CTA + FindingCard
   "ILLUSTRATIVE EXAMPLE") · section intro "From paper to a decision…" · Scroll
   sequence (5 beats) · "What Finch watches" (5 agent cards) · "We put your current
   tools into Finch" (5 rows) · Roberto quote · "Under the hood" (4 cols) · dark
   CTA band · footer. Copy verbatim from the design file — no rewording.
2. Visual fidelity at 1280×800 and 1440×900 vs the design: same palette, fonts
   (STIX Two Text / Instrument Sans / IBM Plex Mono), max-width 1160, spacing
   within ±4px. Reviewer will compare screenshots against the design file.
3. Scroll sequence: sticky 100vh stage, wrapper 480vh, five beats driven by
   scroll progress with the exact segment boundaries below; captions 01–05 light
   up per beat; stage scales to fit viewport (`min(1,(vw-40)/1160,(vh-60)/660)`);
   no CLS (wrapper height reserved, stage fixed 1160×660 before scale).
4. `prefers-reduced-motion: reduce` → no sticky/scroll-linked motion; the five
   beats render as a static stacked storyboard (each beat fully "arrived"). No
   pulse animation, no tilt.
5. Below `lg` (1024px) → the Mobile.dc.html layout: hero stacked, invoice card →
   "↓ FINCH READS IT" → FindingCard (tilt off) → WhatsApp brief panel, each
   revealed once on intersect (opacity/translateY 24px, 500ms ease-out, staggered
   0/150/300ms). Everything else stacks to one column with 20px side padding.
6. FindingCard: cursor-following tilt (±4° via `perspective(900px)`, `translateY(-2px)`),
   hover shadow sharpen, 200–250ms ease-out; disabled when `tilt={false}`, on
   touch/coarse pointers, and under reduced motion. Props exactly:
   `agent, observation, impact, evidence, meta, state ('new'|'in-progress'|'resolved'), tilt, actions: string[]`
   with the design's defaults.
7. Colour discipline: burnt orange (`#E05A12` CTA, `#FF7727` dot/bar, `#C94F0E`
   text) appears ONLY on: CTA buttons, agent pulse dots/bars, rand-impact text,
   "NEW" chip, "+12% vs Jan", chart end-dot/label, hover link colour. Light blue
   (`#4B96DD`, `#2F6FAE`, `#D9E9F8`, `#EDF4FB`) ONLY on: chart line, extracted
   rows, invoice line highlights, evidence chip, "● ONLINE". The orange→blue
   gradient appears exactly once (hero accent bar). Verified by eye + grep.
8. Zero `backdrop-filter`/`backdrop-blur`/translucent card backgrounds/glow in
   any file created or edited by this task. `GlobalPixelTrail` no longer renders.
9. `app/page.tsx` is a **server component** exporting `metadata` (title
   `Finch by Vyso — your company's own COO, at a tenth of the cost`, description
   = the hero sub-copy first two sentences + "Built by Vyso for South African
   food businesses."). Client boundaries only where needed.
10. `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass. Dev server
    console shows no errors/warnings originating from `/`. No `<img>` lint
    warnings (use `next/image` for the SVGs).
11. `/contact` form: submit button reads "Book your audit", tier `<select>` and
    its label removed, `tier` dropped from `INITIAL_STATE`. Nothing else on that
    form changes.
12. `.ai/implementation_homepage_finch.md` written: files created/modified,
    every deviation from this plan with reason, verification output, and a
    list of now-unused homepage components (NOT deleted — deletion needs user
    approval per parent plan Step 2).

## Files

CREATE
- `public/finch/finch-bird.svg` — copy of `.ai/design/assets/finch-bird.svg`
  (fix the mojibake `id="Gradient Bird â Editable Vector"` → `id="finch-bird"`;
  keep everything else byte-identical).
- `public/finch/vyso-wordmark.svg` — copy of `.ai/design/assets/vyso-wordmark.svg`.
- `components/finch/tokens.css` — Finch design tokens (see Tokens). Imported once
  from `app/globals.css` (`@import "../components/finch/tokens.css";`) — or inline
  the block into `globals.css` under a clearly delimited `/* ── Finch marketing tokens ── */`
  comment; either is fine, pick one, don't do both.
- `components/finch/FindingCard.tsx` — `"use client"`. Exports `FindingCard`
  (default props = design defaults) AND the composable pieces used by the scroll
  sequence: `FindingCardFrame` (white card + orange left bar; accepts `children`,
  `className`, `style`, optional `tilt`), `FindingHeader` (dot + agent label +
  state chip), `FindingObservation`, `FindingImpact`, `FindingEvidence`
  (chip + meta), `FindingActions`. `FindingCard` = Frame(Header, Observation,
  Impact, Evidence, Actions).
- `components/finch/FinchNav.tsx` — server component. Desktop: wordmark (h 15px)
  · 1px divider · "Finch" (STIX 18px) · right: Industries `/industries`, Pricing
  `/pricing`, Log in `/login` (14px/500, `#4A463C`), CTA "Book your audit" →
  `/contact` (bg `#E05A12`, hover `#C94F0E`, 9px 18px, radius 8). Mobile
  (< lg): wordmark(13px)+divider+"Finch"(16px) left, CTA right (8px 14px, 13px).
  No hamburger. Padding 26px 40px desktop / 18px 20px mobile. Max-width 1160.
- `components/finch/FinchFooter.tsx` — server component. wordmark (h 13px,
  opacity .7) · "Built by Vyso in Johannesburg." · right links: Pricing
  `/pricing`, Industries `/industries`, Case study `/case-studies/turn-n-slice`,
  Privacy `/privacy`. Padding 72px 40px 48px (mobile 24px 20px 40px, border-top).
- `components/finch/HomeHero.tsx` — server component except the card. Grid
  1.05fr/0.95fr gap 64, padding 72px 40px 110px; gradient bar 52×3 (`linear-gradient(90deg,#FF7727,#4B96DD)`);
  H1 STIX 500 62px/1.06 -0.025em; sub 17px/1.65 `#4A463C` max-w 520; CTA 14px 26px
  radius 9 15.5px/600 + mono caption `ONE-WEEK OPERATIONS AUDIT · R2,000`
  (11.5px, .06em, `#8A8474`). Right column: `<FindingCard />` + right-aligned
  mono `ILLUSTRATIVE EXAMPLE` (10px, .1em, `#B9B3A3`, mt 12). Mobile per
  Mobile.dc.html: padding 44px 20px 40px, bar 44px, H1 36px/1.1 -0.02em, sub 15px,
  CTA full-width block 15px padding radius 10 16px/600 min-h 44, caption
  centred; the FindingCard is NOT shown in the mobile hero (it appears in the
  mobile sequence instead).
- `components/finch/SequenceIntro.tsx` — server. Border-top `#E7E3DA`, pt 64;
  mono eyebrow `WHAT HAPPENS TO AN INVOICE INSIDE FINCH` (11px .14em `#8A8474` mb 14);
  H2 STIX 500 38px/1.15 -0.02em max-w 620 "From paper to a decision, while you
  serve customers."
- `components/finch/ScrollSequence.tsx` — `"use client"`. Desktop (≥ lg AND
  motion OK): sticky stage per Homepage.dc.html. Reduced-motion (any width):
  static storyboard. < lg: `MobileSequence` (may live in same file or
  `components/finch/MobileSequence.tsx`).
- `components/finch/InvoiceCard.tsx` — the FreshCo invoice used by desktop beat 1
  and mobile; accepts `highlightProgress?: [number,number,number,number]`
  (0–1 per line, drives `scaleX` of the `#D9E9F8` highlight spans) and a
  `compact` variant for mobile (Mobile.dc.html markup: 3 lines shown, first line
  fully highlighted).
- `components/finch/BriefPhone.tsx` — the phone frame (300×630, radius 42, inner
  `#F2EEE6` radius 32) with header (finch-bird 30px in circle, "Finch" 13.5/600,
  mono `● ONLINE · 06:45` 9.5px `#4B96DD`) and the brief bubble (accepts
  `bubbleStyle` for the beat-5 reveal). Mobile variant `BriefPanel` = the
  full-width WhatsApp panel from Mobile.dc.html (header `● ONLINE · MON 06:45`,
  4 bubbles incl. the green `#E8F5E1` user bubble "Draft the supplier email" and
  reply "Done. It's in your drafts.").
- `components/finch/WhatFinchWatches.tsx`, `components/finch/Senses.tsx`,
  `components/finch/FoundingQuote.tsx`, `components/finch/UnderTheHood.tsx`,
  `components/finch/AuditBand.tsx` — server components, markup/copy verbatim from
  the design. Agent cards: 5-col grid gap 16 (lg), 2-col (md), 1-col (sm); card
  white, border `#E7E3DA`, radius 10, padding 22px 20px, hover border `#C9C3B4`
  150ms; dot 6px `#FF7727`; label mono 10.5px .12em `#4A463C`; body 14px/1.5
  `#6B6659`. Senses: grid 0.9fr/1.1fr gap 64 (lg) → 1 col; rows: mono 12.5px/500
  w 170 label + 14.5px `#6B6659`; row padding 15px 4px, border-bottom `#F0EDE5`
  except last. Quote: max-w 860 centred, bird 44px mb 28, blockquote STIX 400
  32px/1.35 -0.015em, attribution mono 11.5px .1em `#8A8474`. Under the hood:
  border-top pt 48, eyebrow mb 32, 4-col gap 40 (lg) → 2 → 1; label mono 11.5px
  .1em `#4A463C` mb 8; body 13.5px/1.55 `#8A8474`. Audit band: bg `#14120E`
  radius 16 padding 72px 64px (mobile 40px 24px, stacked), H2 STIX 400 36px
  `#FAF9F6`, p 15.5px `#B9B3A3`, CTA 16px 30px radius 10 16px/600 hover `#FF7727`.
- `.ai/implementation_homepage_finch.md`

MODIFY
- `app/page.tsx` — full replacement (server component + `metadata`).
- `app/layout.tsx` — add `STIX_Two_Text` (`--font-stix`, weights 400/500 +
  italic 400 → `style: ["normal","italic"]`, weight `["400","500"]`) and
  `IBM_Plex_Mono` (`--font-plex-mono`, `["400","500"]`) via `next/font/google`
  with `display: "swap"`; add their `.variable` classes to the same element the
  existing font variables are on. Remove the `<GlobalPixelTrail />` element and
  its import (leave the component file on disk). Leave `LiquidGlassFilter` (other
  pages' buttons depend on it). Do not change JSON-LD or other metadata here.
- `app/globals.css` — add Finch tokens (below) + `@theme inline` entries so
  Tailwind utilities exist. Do NOT alter existing tokens/blend system (other pages).
- `components/ContactForm.tsx` — AC 11 only.

DO NOT TOUCH
- `components/Navbar.tsx`, `components/sections/SiteFooter.tsx`,
  `components/marketing/PublicMarketing.tsx`, any other route, `app/api/**`,
  `lib/**`, `supabase/**`, `next.config.ts`, `app/sitemap.ts`, the WhatsApp
  files listed above, `package.json` (no new deps).
- Do not delete BounceDot / HeroSection / SystemsShowcase / HowItWorks /
  AppsShowcase / TrustStrip / ContactSection / IntegrationsMarquee /
  WebGLShaderBackground / GlobalPixelTrail — list them as "now unused by `/`" in
  the implementation report.

## Tokens (exact — copy into CSS)

```css
/* ── Finch marketing tokens (homepage redesign, 2026-08) ── */
:root {
  --fn-bg: #FAF9F6;        /* page */
  --fn-surface: #FFFFFF;   /* cards */
  --fn-surface-2: #F2EEE6; /* phone screen */
  --fn-ink: #14120E;       /* text, dark band */
  --fn-ink-2: #4A463C;
  --fn-ink-3: #6B6659;
  --fn-muted: #8A8474;
  --fn-muted-2: #A39D8E;
  --fn-faint: #B9B3A3;
  --fn-line: #E7E3DA;      /* borders */
  --fn-line-2: #F0EDE5;    /* hairlines */
  --fn-line-3: #D8D3C6;    /* dividers */
  --fn-line-hover: #C9C3B4;
  --fn-orange: #FF7727;    /* agent dot / bar / chart dot */
  --fn-orange-cta: #E05A12;
  --fn-orange-deep: #C94F0E; /* impact text, hover CTA */
  --fn-orange-tint: #F3D9C6; /* NEW chip border, ::selection */
  --fn-blue: #4B96DD;      /* chart line, ONLINE */
  --fn-blue-deep: #2F6FAE; /* extracted rows, evidence text */
  --fn-blue-tint: #EDF4FB; /* evidence chip bg */
  --fn-blue-hl: #D9E9F8;   /* invoice line highlight */
  --fn-green-bubble: #E8F5E1;
  --fn-shadow-card: 0 1px 2px rgba(20,18,14,.05), 0 8px 24px rgba(20,18,14,.06);
  --fn-shadow-card-hover: 0 2px 4px rgba(20,18,14,.07), 0 18px 40px rgba(20,18,14,.12);
  --fn-shadow-float: 0 14px 44px rgba(20,18,14,.10);
  --fn-shadow-phone: 0 24px 60px rgba(20,18,14,.12);
  --fn-shadow-invoice: 0 12px 36px rgba(20,18,14,.08);
  --fn-grad: linear-gradient(90deg, #FF7727, #4B96DD);
}
@theme inline {
  --color-fn-bg: var(--fn-bg); --color-fn-surface: var(--fn-surface);
  --color-fn-surface-2: var(--fn-surface-2); --color-fn-ink: var(--fn-ink);
  --color-fn-ink-2: var(--fn-ink-2); --color-fn-ink-3: var(--fn-ink-3);
  --color-fn-muted: var(--fn-muted); --color-fn-muted-2: var(--fn-muted-2);
  --color-fn-faint: var(--fn-faint); --color-fn-line: var(--fn-line);
  --color-fn-line-2: var(--fn-line-2); --color-fn-line-3: var(--fn-line-3);
  --color-fn-line-hover: var(--fn-line-hover); --color-fn-orange: var(--fn-orange);
  --color-fn-orange-cta: var(--fn-orange-cta); --color-fn-orange-deep: var(--fn-orange-deep);
  --color-fn-orange-tint: var(--fn-orange-tint); --color-fn-blue: var(--fn-blue);
  --color-fn-blue-deep: var(--fn-blue-deep); --color-fn-blue-tint: var(--fn-blue-tint);
  --color-fn-blue-hl: var(--fn-blue-hl); --color-fn-green-bubble: var(--fn-green-bubble);
  --font-fn-serif: var(--font-stix), "STIX Two Text", Georgia, serif;
  --font-fn-sans: var(--font-instrument), "Instrument Sans", system-ui, sans-serif;
  --font-fn-mono: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace;
}
@keyframes fn-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,119,39,.5); } 50% { box-shadow: 0 0 0 6px rgba(255,119,39,0); } }
```
Page wrapper: `<div className="finch-site min-h-screen bg-fn-bg text-fn-ink font-fn-sans antialiased">`
with `.finch-site ::selection { background: var(--fn-orange-tint) }` and
`.finch-site a { color: inherit; text-decoration: none }` (links hover
`#C94F0E` only where the design does — nav/footer text links). Do NOT change
`body` background globally. Under `@media (prefers-reduced-motion: reduce)`
`.finch-site * { animation: none !important }` for the pulse.

Sizing: Tailwind arbitrary values are fine (`text-[62px]`, `leading-[1.06]`,
`tracking-[-0.025em]`, `max-w-[1160px]`). Prefer utilities; inline `style` only
for values driven by motion. No `!important` beyond the reduced-motion rule.

## Scroll sequence — exact spec (desktop, ≥ lg, motion OK)

Structure:
```
<div ref={wrap} style={{height: '480vh', position:'relative'}}>
  <div sticky top-0 h-screen overflow-hidden flex items-center justify-center>
    <div stage style={{width:1160,height:660,transform:`scale(${s})`,transformOrigin:'center',flexShrink:0,position:'relative'}}>
      InvoiceCard  (abs left 10 top 40 w 400)
      ExtractedRows(abs left 480 top 110 w 430)
      PriceChart   (abs left 470 top 70 w 580)
      SequenceCard (abs left 480 top 100 w 440, transform-origin top left, z 2)
      BriefPhone   (abs left 790 top 10, 300×630)
      Captions row (abs left 0 right 0 bottom -6, centred, gap 26, mono 10.5px .1em)
    </div></div></div>
```
`s = min(1, (innerWidth-40)/1160, (innerHeight-60)/660)` recomputed on resize
(useState + resize listener, or `useWindowSize`).

Progress: `motion`'s `useScroll({ target: wrap, offset: ["start start","end end"] })`
→ `scrollYProgress` = t ∈ [0,1]. Helper `seg(a,b) = clamp((t-a)/(b-a))`,
`eo(p) = 1-(1-p)^3`. Implement with `useTransform(scrollYProgress, t => …)` per
motion value (fine-grained; no React re-render per frame). Use `motion.div`
with `style={{ opacity, x, y, rotate, scale }}` etc. Segment table:

| element | property | segments |
|---|---|---|
| Invoice | opacity | `min(eo(seg(0,.14)), 1 - eo(seg(.40,.52))*.9)` |
| Invoice | transform | `translateY((1-b1)*70px) translateX(-inv3*80px) rotate(-3+b1*3 deg) scale(1-inv3*.06)` where b1=eo(seg(0,.14)), inv3=eo(seg(.40,.52)) |
| Highlight line i (0..3) | scaleX | `eo(seg(.15+i*.03, .23+i*.03))`, origin left |
| ExtractedRows | opacity | `min(eo(seg(.20,.30)), 1-eo(seg(.38,.46)))` |
| ExtractedRows | x | `(1-rIn)*50 - rOut*40` |
| Chart | opacity | `min(eo(seg(.40,.48)), 1-eo(seg(.58,.66)))` |
| Chart | x | `(1-cIn)*50 - cOut*70` |
| Chart path | pathLength (or strokeDashoffset with pathLength="1", dasharray 1) | draw = eo(seg(.42,.56)) ; dashoffset = 1-draw |
| Chart end dot + label | opacity | `draw > .97 ? 1 : 0` |
| SequenceCard | opacity | `eo(seg(.60,.66))` |
| Card piece i (0..4: header, observation, impact, evidence, actions) | opacity | `p_i = eo(seg(.60+i*.035, .67+i*.035))` |
| Card piece i | transform | i==2: `scale(1.3 - p*.3)` origin left center; else `translateY((1-p)*20px)` |
| SequenceCard | transform | `translate(into*336px, into*118px) scale(1 - into*.44)`, into = eo(seg(.80,.92)) |
| Phone | opacity / y | ph = eo(seg(.78,.86)); y = (1-ph)*60 |
| Brief bubble | opacity / y | br = eo(seg(.90,.97)); y = (1-br)*14 |
| Captions | colour | active idx = t<.15?0 : t<.38?1 : t<.58?2 : t<.78?3 : 4 → `#14120E`, others `#B9B3A3`, transition color 200ms |

Chart SVG (560×300, overflow visible): gridlines y=270 (`#E7E3DA`), 170 and 70
(`#F0EDE5`) x 20→540; path `M 20 180 L 120 196 L 220 164 L 320 148 L 420 108 L 520 52`
stroke `#4B96DD` 2.5 round; end circle (520,52) r 4.5 `#FF7727`; label "R62.00"
at (520,32) mono 12 `#C94F0E` anchor middle; axis labels JAN (20,292) / JUN
(520,292 end) mono 10 `#B9B3A3`. Chart eyebrow above: `BUTTERNUT · R PER 10KG BAG · JAN–JUN 2026`
mono 10.5px .12em `#8A8474` mb 16.

ExtractedRows: white, border `#E7E3DA`, radius 8, padding 20px 22px; eyebrow
`EXTRACTED · 4 LINE ITEMS · 99.2% CONF` mono 10px .12em `#8A8474` mb 14; rows mono
12px `#2F6FAE` gap 10, space-between: `butternut_10kg · 24 @ R62.00` / `+12% vs Jan`
(`#C94F0E`); `tomato_gr1_6kg · 18 @ R89.50` / steady (`#8A8474`);
`cooking_oil_20l · 6 @ R748.00` / `−2% vs Jan`; `onion_10kg · 12 @ R71.00` / steady.

Invoice content (verbatim from design): header `FRESHCO PRODUCE MARKET (PTY) LTD`
mono 12/500 .06em; sub `CITY DEEP FRESH PRODUCE MARKET · JOHANNESBURG` mono 10
`#8A8474`; two grey placeholder bars 90×9 and 60×9 `#E7E3DA` r2; meta row
`TAX INVOICE · INV-38412` / `14 JUN 2026` mono 10.5 `#6B6659` with hairlines;
lines mono 11.5 padding 9px 6px: `Butternut 10kg bag × 24` R 1,488.00 ·
`Tomatoes Gr.1 6kg × 18` R 1,611.00 · `Cooking oil 20L × 6` R 4,488.00 ·
`Onions 10kg × 12` R 852.00; total row `TOTAL INCL VAT` / `R 8,439.00` mono 12/500
border-top 1px `#14120E`. Card: white, border `#E7E3DA`, radius 6, padding
26px 28px, shadow `--fn-shadow-invoice`.

Reduced motion (any width): render, in normal flow with 40px gaps, centred,
max-w 1160: InvoiceCard (highlights fully on) · ExtractedRows · Chart (fully
drawn, dot+label visible) · FindingCard (state new, all pieces visible) ·
BriefPhone with bubble visible. Captions row static, none highlighted. Use the
same `useReducedMotion()` from `motion/react`. Also on the server render (before
hydration) render this static variant to avoid a flash — i.e. `mounted` gate:
static until mounted, then desktop/mobile/reduced decision. Reserve heights so
there is no CLS: the desktop wrapper is 480vh from the first paint whenever
`window.matchMedia('(min-width:1024px)')` is true (compute in a `useLayoutEffect`
guarded for SSR; acceptable to render the static variant on server and swap
after mount — CLS then happens above the fold only if the user has already
scrolled, which is acceptable; document it).

Mobile (< lg, motion OK) — from Mobile.dc.html: section padding 32px 20px 0,
border-top; eyebrow `01 AN INVOICE COMES IN → 04 A FINDING COMES OUT`; compact
InvoiceCard (3 lines, first highlighted); centred `↓ FINCH READS IT` (mono 11
`#8A8474`, py 14); `<FindingCard tilt={false} />` + `ILLUSTRATIVE EXAMPLE`; then
section padding 56px 20px 48px, eyebrow `05 YOUR MONDAY BRIEF · ON WHATSAPP`,
`BriefPanel`. Reveals: `motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}}
viewport={{once:true, amount:.25}} transition={{duration:.5, ease:'easeOut', delay}}`.

## Copy (verbatim — do not edit)

Hero H1: `Meet Finch. Your company's own COO — at a tenth of the cost.`
Hero sub: `Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI agents watch your invoices, stock, suppliers and margins — catch money leaking, and tell you what to do about it. Built by Vyso for South African food businesses. R6,000 per location, everything included.`
CTA: `Book your audit` · caption `ONE-WEEK OPERATIONS AUDIT · R2,000`
Sequence intro eyebrow/H2, agent cards, senses rows, quote, under-the-hood, audit
band, footer — take verbatim from `Homepage.dc.html`. Quote attribution:
`ROBERTO · TURN 'N SLICE · JOHANNESBURG · FOUNDING CLIENT`. Brief bubble:
`Morning. 3 things need your attention — one's worth <strong #C94F0E>R4,200</strong>.`
Use real typographic characters (—, ’ where the design uses them, ×, ≈, ↗, ●, ↓, −).

## Ordered implementation steps

1. Read the five design files + `AGENTS.md` + `node_modules/next/dist/docs/`
   pages on `app/layout`, `metadata`, `next/font`, `next/image` (skim).
2. Assets → `public/finch/`. Fonts + remove GlobalPixelTrail in `app/layout.tsx`.
   Tokens in CSS. Run `npx tsc --noEmit` (should still pass).
3. `FindingCard.tsx` (pieces + composed card + tilt hook `useTilt(enabled)`).
4. `FinchNav`, `FinchFooter`, `HomeHero`, `SequenceIntro`, `WhatFinchWatches`,
   `Senses`, `FoundingQuote`, `UnderTheHood`, `AuditBand`.
5. `InvoiceCard`, `BriefPhone`/`BriefPanel`, `ScrollSequence` (+ mobile + reduced).
6. `app/page.tsx` assembly with `metadata`. Wrapper `.finch-site`.
7. `ContactForm.tsx` AC 11.
8. Verify: `npx tsc --noEmit && npm run lint && npm run build`. Then start dev
   (`npm run dev`, port 3000 — the workspace has a `vyso-dev` launch config;
   if a server is already on :3000 reuse it) and check `/` at 1440×900, 1280×800,
   768×1024, 375×812; scroll through the sequence at desktop and confirm each
   beat; emulate reduced motion; read the browser console. Fix and re-run.
9. Write `.ai/implementation_homepage_finch.md`. Do not commit.

## Edge cases

- `next/font` STIX Two Text: Google name is `STIX_Two_Text`; if `next/font`
  rejects italic config, load weights 400/500 normal only and note the deviation.
- SVG wordmark is pure black; footer needs opacity .7 (not a colour change).
- `finch-bird.svg` has a `clip-path` rect of 1254×1254 in a 610×590 viewBox —
  renders correctly; do not "fix" it.
- Hydration: anything reading `window` (scale, media query, reduced motion) must
  be behind `useEffect`/`useLayoutEffect` with SSR-safe defaults.
- `motion` `useScroll` needs the target ref attached to an element with layout
  height; the 480vh wrapper must be the target.
- Touch devices ≥ lg (iPad landscape): tilt off (`(pointer: coarse)`), sequence on.
- Existing global CSS: `--radius: 0rem` and `.blend-*` rules; the homepage must
  not inherit sharp corners on buttons (use explicit `rounded-[9px]` etc.) and
  must not be wrapped in any `.blend-surface`.
- `body` font is DM Sans globally — the `.finch-site` wrapper sets
  `font-fn-sans`; headings explicitly `font-fn-serif`.
- Lint rule `@next/next/no-img-element` → use `next/image` (`width`/`height`
  props required; SVGs don't need `unoptimized`).

## Verification commands

```bash
cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website"
npx tsc --noEmit
npm run lint
npm run build
grep -rn "backdrop-blur\|backdrop-filter\|glow" components/finch app/page.tsx | wc -l   # expect 0
grep -rn "R10,000\|R30,000\|R50,000\|Join Waitlist" app/page.tsx components/finch components/ContactForm.tsx | wc -l  # expect 0
git status --short   # only the files listed under CREATE/MODIFY plus the pre-existing untracked WhatsApp files
```
Browser: `http://localhost:3000/` — screenshots at 1440w desktop top, mid-sequence
(beats 2, 3, 4, 5), bottom; 375w top + sequence; console clean.
