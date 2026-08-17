# Plan — Phase 6b: recompose the four money pages with the depth system

Source: `.ai/vyso_v3_design.md` (§2 grounds, §3 devices, §4 text motion, §5
library, §7 matrix rows for these pages, §9 budgets) + `.ai/plan_phase6a_primitives.md`
+ `.ai/implementation_phase6.md` (what exists: `components/finch/ground/*`,
`text/*`, `lib/marketing/findings.ts`, FindingCard variants, `CyclingFinding`,
`FindingStack`, `NavGround`, `RouteFade`, `SmoothScroll`, `/design`). Josh's
review verdicts (2026-08-16): **Lenis stays — make it default ON** (still off
under reduced motion; `/design` toggle now toggles it off); everything else per
the plan defaults: facets for blue bands, orange dots for ink, ribbon in canvas.
Josh wants "more design nuance and upgrades per page" — every page below must
end up *unmistakably different* from the others while sharing the system.

Standing rules: one living device per band; ≤ 2 moving things per viewport
(use `motion-budget` — the counter must never exceed 2 on these pages); seams
overlap 48px with 24px radius on the dark slab; orange = agent activity/CTA/
glow lines (`--fn-orange-on-ink` for orange *text* on ink); blue evidence only;
cards from `lib/marketing/findings.ts` by id only, no card repeated across the
four heroes; honesty rules; SSR-safe (bands render their static ground on the
server, canvases mount via `Deferred`); CLS 0 (bands reserve height); reduced
motion → static; no glass; no new deps; no git. Dev server :3000; front your
browser tab; if the pane is hidden use the CDP approach 6a documented. Each
agent appends "## 6b — <pages>" to `.ai/implementation_phase6.md`.

## Shared (Workstream A does these first, in its first 15 minutes, so B can rely on them)
- `components/finch/SmoothScroll.tsx`: default ON (ignore the localStorage flag
  unless it is explicitly `"0"`), off under reduced motion, `data-lenis` on
  `<html>` for CSS; keep the `/design` toggle working as an OFF switch.
- `Band` gets `overlap?: "up" | "down"` helpers if not already there, and a
  `hairline?: boolean` (the orange→blue seam hairline drawn on enter) — used at
  most once per page.
- `FinchNav` inversion verified over blue/ink (already built by 6a).

## Workstream A — `/` and `/pricing` (Opus)

### `/` (files: `app/page.tsx`, `components/finch/{HomeHero,SequenceIntro,ScrollSequence,PlatformShowcase,WhatFinchWatches,Senses,FoundingQuote,UnderTheHood,AuditBand}.tsx` — edit, don't rewrite; new wrappers welcome under `components/finch/home/`)
Ground sequence: **paper (hero) → paper (sequence) → blue (showcase) → paper
(agents) → paper (orbit) → ink (quote) → paper (under the hood) → ink (CTA)**.
1. **Hero** — `CyclingFinding` (ids: butternut-price-watch, short-delivery-
   crates, debtors-60-days) replaces the static card; one soft orange `Glow`
   drifting behind the left copy (10–14%); cursor parallax 3px on the card,
   opposite direction on the glow; H1 gets `SplitReveal` on load (once, 30ms
   stagger); the two CTAs become `MagneticButton`s. Nothing else moves.
2. **Sequence** — unchanged mechanics; the beat-4 card and brief bubbles already
   read R58,000 from the library. Add the seam: the sequence's last 48px sit
   over the blue band's top radius so the phone appears to rest on the seam.
3. **Showcase → blue band** with `FacetPlane` behind the frame; the frame's own
   shadow becomes `0 30px 80px -20px rgba(6,20,45,.55)`; the eyebrow/H2 go
   `--fn-blue-text`; the demo copy unchanged. Only device: facets (the demo
   itself is the second moving thing — so the facets must be **static drift
   only when the demo is not playing**: pause facet drift while `demo_played`
   is running; the budget counter must read ≤ 2).
4. **Agents** — paper; cards get a hover lift; the honesty line stays.
5. **Orbit** — paper; unchanged (it's already the page's second signature).
6. **Quote → ink band** with `WaveField` (orange, 10 lines, amplitude 16):
   Roberto's quote becomes a `Statement`-scale block (STIX 400 44px, italic
   off) wrapped in `WaveText` so it rides the crest; the bird SVG above in
   `--fn-orange-on-ink`; attribution mono in `--fn-ink-mono`. Grain on.
7. **Under the hood** — paper, unchanged.
8. **CTA → ink band** with `GradientRibbon` (the site's single ribbon) as the
   band's top 320px strip; the H2 + CTA sit below the strip on plain ink; the
   button is a `MagneticButton`. Footer follows on ink already? — no: footer is
   paper today; leave it (6c decides the footer).
Meta: none. Verify the two pinned sections still pin correctly with Lenis on
(Lenis + `position: sticky` + `useScroll` — test forward AND reverse showcase
demo, and the sequence at t=0/1).

### `/pricing` (files: `app/pricing/page.tsx`, `components/finch/pricing/*`)
Ground sequence: **ink (hero) → paper (founding terms + what's included) → blue
(straight answers) → paper (Academy) → ink (CTA)**.
1. **Ink hero** with `OscillatingGrid` (dots, orange, cursor attraction on,
   `maskRef` = the price block): eyebrow `ONE OFFER · NO TIERS · NO MATRIX` in
   `--fn-ink-mono`; the price as a `Statement`: **R6,000** at 96px `--fn-ink-text`
   with `/ location / month` at 30px `--fn-ink-text-2`; "Everything included." in
   STIX italic 26px; the AEO direct-answer sentence in `--fn-ink-text-2`; the
   R6,000 **stamps** (scale 1.3→1) after the split reveal; nav inverted.
   The founding-terms strip straddles the ink→paper seam as a white card
   (three cells) — the seam element.
2. **What's included** — paper; the accordion unchanged; each group's summary
   row gets a hover reveal of a mono count ("10 MODULES", "6 AGENTS"…) on the
   right (150ms).
3. **Straight answers → blue band** with `FacetPlane`; H2 `--fn-blue-text`;
   the four Q&As in a 2×2 grid, each answer preceded by a small Finch bird mark
   (the voice), text `--fn-blue-text-2`; ONE `wide` FindingCard (`margin-watch-
   gross-margin`, ink variant) sits at the band's right edge straddling into the
   next paper band.
4. **Academy** — paper, unchanged card.
5. **CTA → ink band** with `OscillatingGrid` in **squares** mode (bolder) — the
   only squares-mode use on the site; H2 + magnetic CTA; the `EXPANDED MANDATES
   PRICED ON SCOPE` mono line under it.
JSON-LD/metadata unchanged (numbers come from `pricing-data.ts`).

## Workstream B — `/operations-audit` and `/compare/finch-vs-hiring-a-coo` (Opus)

### `/operations-audit` (files: `app/operations-audit/page.tsx`, `components/finch/audit/*`, `components/marketing/{OperationsAudit,RoiCalculator}.tsx` presentation only)
Ground sequence: **paper (hero+form) → blue (how the week runs) → paper
(assessment + calculator) → ink (the credited statement) → paper (FAQs)**.
1. **Hero** — keep the header-left/form-right layout; add one blue `Glow`
   (12%) behind the form card; H1 `SplitReveal`; submit button magnetic.
2. **How the week runs → blue band** with `OscillatingGrid` (dots, light-blue
   `--fn-blue-300`, no cursor attraction): the four steps become a horizontal
   **7-day rail** — seven dots on a hairline, Mon→Sun, the four step labels
   anchored to their days; the dots **stamp** in sequence as the band enters
   (80ms apart); text `--fn-blue-text`; the step numbers mono `--fn-blue-mono`.
   The band's bottom seam carries the assessment card (white) straddling into
   paper.
3. **Assessment + calculator** — paper, unchanged mechanics; the calculator's
   result FindingCard already reads from its inputs.
4. **Ink Statement band** with `WaveField` (orange): `Statement` "R2,000.
   Credited. Whether you sign or not." (three sentences as three lines, the
   middle one italic) wrapped in `WaveText`; a mono sub-line `ONE WEEK · IN
   RAND · WITH THE EVIDENCE`; a magnetic "Book your audit" that scrolls to
   `#book`. Grain on.
5. **FAQs** — paper, unchanged.
Verify the gauge draw, calculator tween and form success still work with Lenis
on; anchors `#book #score #calculator` still land (Lenis intercepts hash
scrolls — use `lenis.scrollTo` for in-page links if native anchors break).

### `/compare/finch-vs-hiring-a-coo` (files: `app/compare/finch-vs-hiring-a-coo/page.tsx`, `components/finch/compare/*`, `components/finch/day/*` props only)
Ground sequence: **ink (hero) → paper (day strip) → blue (cost bars) → paper
(table + when to hire) → ink (CTA)**.
1. **Ink hero** with `WaveField` (orange, amplitude 20): `Statement` "A COO's
   day. Done by breakfast." riding the wave (`WaveText`, per-word), the direct-
   answer paragraph in `--fn-ink-text-2`, the orange→blue hairline drawing under
   the Statement (the page's one hairline); nav inverted; grain on. Two
   `MagneticButton`s (Book your audit · See the day).
2. **Day strip** — paper; unchanged (its beats now come from the library:
   butternut R58k, short-delivery, debtors-60-days, overstock, brief — verify
   `day-beats.ts` reads them).
3. **Cost bars → blue band** with `FacetPlane`: bars redrawn on blue — the
   salary bar in `--fn-blue-text-2` and the Finch bar in orange (the band's one
   orange element), rand values **stamp**, the Indeed/PayScale footnote in
   `--fn-blue-mono`; the two bars' baseline sits on the band's bottom seam.
4. **Table + "when you should hire a COO instead"** — paper; row hover
   highlight stays; the honesty section gets a `Statement`-scale pull line
   ("Sometimes the answer is a person.") in STIX 44px.
5. **CTA → ink band** with `OscillatingGrid` (dots, orange); H2 + magnetic CTA.
Verify: the wave headline visibly rides the crest (sample per-word `y` over 2s
in a fronted tab or via CDP); day strip pins correctly with Lenis; budget ≤ 2.

## Verification (both)
tsc (only the 3 known WhatsApp errors); `npx eslint` on touched paths clean;
each page: one `<h1>`, JSON-LD unchanged and parsing, `curl` 200, no
horizontal scroll at 375, nav inverts over the dark bands and returns on paper,
motion-budget counter ≤ 2 at every scroll position (walk the page in 200px
steps and log the max), reduced-motion emulation → all devices static + text
motion off + Lenis off, console clean, Lighthouse a11y ≥ 95 (contrast on blue/
ink pairs), and CLS: measure `layout-shift` entries while scrolling — must be
< 0.02. Report FPS/ms-per-frame per band as 6a did.
