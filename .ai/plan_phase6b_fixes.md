# Plan — 6b fixes: spacing, cutoffs, stray additions, scroll feel, static quote

Josh's review of 6b (2026-08-17, four screenshots + notes). Fix these before
6c. Standing rules unchanged (no new deps, no git, budgets, honesty, reduced
motion). Reference: `.ai/vyso_v3_design.md`, `.ai/plan_phase6b_money_pages.md`,
`.ai/implementation_phase6.md`. Dev server on :3000; front your tab (or CDP).

## Findings → fixes

1. **`AuditBand` (shared closing CTA on ~18 routes) is now an ink band with the
   `GradientRibbon`, so every page ends in a ~700px near-empty black slab with
   a big gradient strip under it** (Josh's first screenshot, on `/learn`).
   - The ribbon is **homepage-only** (design rule: one ribbon sitewide). Give
     `AuditBand` a `variant` — `default` (paper→ink? no: keep the ORIGINAL dark
     plate: `#14120E` rounded 16px plate inside a paper band, as before 6b) and
     `home` (full-bleed ink band + ribbon, used only by `app/page.tsx`).
   - Band heights: content-driven. Remove any `min-height`/fixed heights on
     `Band` and on the CTA bands; padding presets: paper 110/110, blue 96/104,
     ink 112/120 (mobile ~64/72). No band may exceed content + padding.
   - Where the ribbon strip is used (home CTA), the strip is 240px tall
     directly under the copy, not floating in empty space; total band ≈ copy +
     240 + padding.
2. **Seam-straddling cards get clipped** (pricing: the margin card runs off the
   bottom of the blue band into the Academy section and is cut; the "Full FAQ →"
   link sits oddly above the band). Rule: an element that straddles a seam
   needs the *receiving* band to reserve room (`padding-top` += the overhang)
   and the straddling element must be `position: relative; z-index` above both
   bands with `overflow: visible` on both bands. Audit EVERY straddle on `/`,
   `/pricing`, `/operations-audit`, `/compare/finch-vs-hiring-a-coo`
   (founding-terms plate, margin card, assessment card, cost bars baseline,
   sequence phone → showcase seam) and fix each: nothing clipped at 1440, 1280,
   768, 375. If a straddle can't be made clean, drop the straddle (card sits
   inside its own band) rather than leave a cutoff. Move "Full FAQ →" back
   under the accordion, left-aligned, 24px below it.
3. **Vertical rhythm on the four pages**: walk each page and log every band's
   `(band height − content height)`; anything > 260px on desktop is a bug —
   tighten. Specific: pricing ink hero (price block should sit ~120px below the
   nav, band ends ~120px below the AEO sentence + terms plate); pricing CTA band
   with squares grid (content-height + padding, ≈ 460px total, not 900);
   homepage CTA; audit ink statement band; COO hero (Statement + paragraph +
   CTAs + hairline; ≈ 70vh max, not 100vh).
4. **Roberto's quote: no text motion.** Remove `WaveText` from the quote —
   render it as static centred text on the ink `WaveField` band (the wave lines
   still move; the words don't). Keep `WaveText` on the audit statement and COO
   hero (Josh only objected to the quote) — but reduce their amplitude to 3px
   and make the per-word phase difference ≤ 1.5px so it reads as breathing, not
   warping; verify visually.
5. **Scroll feel — Lenis is floaty.** Tune, don't remove: `lerp: 0.2` (or
   `duration: 0.6` with `easing: t => 1 - Math.pow(1 - t, 3)`), `wheelMultiplier: 1.1`,
   `smoothWheel: true`, `syncTouch: false`, `touchMultiplier: 1.5`. Add a
   `data-lenis-snappy` mode as the default. Verify: a single wheel notch settles
   within ~350ms; sticky sections and anchors still work. Report before/after
   settle time.
6. **General "put together" pass** on the four pages: consistent section
   eyebrow/H2 lockups across bands (same sizes as paper: eyebrow 11px .14em,
   H2 34–38px), the same 1160 column everywhere (the pricing "Straight answers"
   band's content column must align with the accordion above), consistent 24px
   radius on dark slab tops, hairline seams only where specified, no orphan
   links floating between bands, buttons in dark bands use the same magnetic
   button. Screenshot each fixed area at 1440 for the report (fronted tab or
   CDP).
7. Re-check `/design` still renders (it composes the same primitives).

## Verification
tsc (3 known), eslint on touched paths, all four pages + `/learn` + `/faq` +
`/industries/food-suppliers` (AuditBand consumers) 200 with one `<h1>`; band
height audit table (band, content h, band h, delta) for the four pages — all
deltas ≤ 260 desktop; no element clipped at 1440/1280/768/375 (check
`getBoundingClientRect` of straddlers vs their bands' union); motion budget
still ≤ 2; CLS < 0.02; Lenis settle time; console clean. Append "## 6b fixes"
to `.ai/implementation_phase6.md` with the height table and screenshots' paths.
