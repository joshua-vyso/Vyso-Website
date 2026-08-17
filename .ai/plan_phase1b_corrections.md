# Plan — Phase 1b: user corrections (remove `/finch`, audit page rework)

User feedback 2026-08-15 after Phase 1 review:
1. Don't reuse widgets across pages (the orbit, the brief panel etc. appeared
   again on `/finch`). No dedicated `/finch` page — the homepage IS the product
   page. Keep the "A COO's day" timeline scroll section for reuse elsewhere.
2. `/operations-audit`: H1 → **"One week. Let's find out where you're leaking
   money and time."**; remove the two hero buttons ("See what we need from you",
   "Book your audit") — redundant; move the booking form to the TOP (header +
   text left, form right); keep the self-assessment below; add the margin/time
   calculator (today's `/roi-calculator`) next to it, side by side if it fits.
3. Then Phase 2.

Two workstreams, disjoint files. Standing rules apply (see phase 1 plan). Both
append to `.ai/implementation_phase1.md` under "## Phase 1b — <letter>".

---

## Workstream A — remove `/finch`, keep the day strip, retarget links, upgrade the homepage agents section

Files: `app/finch/**` (delete), `components/finch/product/**` (prune), new
`components/finch/day/**`, `components/finch/FinchNav.tsx`, `MobileMenu.tsx`,
`FinchFooter.tsx`, `next.config.ts`, `app/sitemap.ts`, `app/layout.tsx` (JSON-LD
url only), `components/finch/WhatFinchWatches.tsx`, `app/page.tsx` (only if the
section import changes), `components/finch/AuditBand.tsx` (no), `app/not-found.tsx`
(the "See Finch" link → `/#agents`).

1. **Delete `app/finch/page.tsx`** (and the directory).
2. **Keep the day strip**: move `DayStrip` (+ `day-beats.ts`, `DayBriefPhone`,
   the clock/tick pieces) into `components/finch/day/` and make it
   **parameterisable**: `beats: { time: string; agent: string; card: FindingCardProps }[]`,
   `eveningBrief: { greeting: string; findings: … }`, `captions`, optional
   `title/eyebrow`. Default export keeps today's content. It will be used on
   `/compare/finch-vs-hiring-a-coo` in Phase 2 (a COO's day vs Finch's day) —
   don't wire it anywhere now. Delete the rest of `components/finch/product/*`
   that only `/finch` used (FinchHero, the brief/senses/under-the-hood/how-it-
   starts wrappers, finch-jsonld, finch-data) EXCEPT `AgentsOnShift` (+ its
   micro-visual pieces) which moves to `components/finch/agents/` and replaces
   the homepage's plain five cards (next step). Nothing else may import from
   `components/finch/product/` afterwards — grep to confirm, then remove the dir.
3. **Homepage "Custom agents on shift" upgrade**: `WhatFinchWatches.tsx` renders
   the six-card version with micro-visuals + status chips + the honesty line
   ("Document intelligence (Doc-U) is live today; agents are activated in
   priority order from your audit roadmap.") in place of the plain five cards.
   Same eyebrow/H2 ("Custom agents on shift, all day, every day."), same
   position on `/`. Give the section `id="agents"`. Grid 3×2 at ≥ lg, 2×3 at md,
   1 col mobile. Micro-visuals play once on enter (reduced motion → end state).
4. **Nav/footer/links**: FinchNav desktop links become Industries · Pricing ·
   Learn · Log in · CTA (drop "Finch"; brand → `/`; `active` type loses `finch`).
   MobileMenu same. Footer: "Finch" column → Home `/` · What Finch watches
   `/#agents` · Under the hood `/platform/modules` · Integrations · Pricing ·
   Compare. `not-found`: "See Finch" → "See how Finch works" `/#agents`.
5. **Redirects**: `/platform`, `/platform/finch`, `/platform/vyso-for-smes`,
   `/platform/vyso-ai` → `/` (was `/finch`); add `/finch` → `/` (permanent) in
   case it was shared. **Sitemap**: remove `/finch`. **Root JSON-LD**:
   `SoftwareApplication.url` → `https://vyso.co.za/` (and any `mainEntityOfPage`).
   grep the repo for `"/finch"` and `/finch#` → 0 outside next.config.

Verify: tsc/eslint; `curl -sI /finch` → 308 `/`; `/platform` → 308 `/`; sitemap
has no `/finch`; `/` renders the six-card agents section with micro-visuals at
1440/375; nav has no Finch link; grep `components/finch/product` → 0 importers.

---

## Workstream B — `/operations-audit` rework + calculator merge

Files: `app/operations-audit/page.tsx`, `components/finch/audit/**`,
`components/marketing/OperationsAudit.tsx` (presentation only, if needed for the
side-by-side), `components/marketing/RoiCalculator.tsx` (rebuild presentation
in Finch style — keep its formulas, defaults and assumption text verbatim),
`app/roi-calculator/page.tsx` (becomes a redirect target — see 4),
`next.config.ts` ONLY to add one redirect line (`/roi-calculator` →
`/operations-audit#calculator`) — coordinate: Workstream A also edits
next.config; add your line at the END of the redirects array in a single
minimal edit and re-read the file immediately before editing.

1. **Hero = header + form**: two-column at ≥ lg (1.05fr / 0.95fr, gap 64, like
   the homepage hero): left — eyebrow `THE OPERATIONS AUDIT · R2,000 · CREDITED
   TO YOUR FIRST MONTH`, `<h1>` **One week. Let's find out where you're leaking
   money and time.** (typographic apostrophes: Let’s / you’re), sub (existing
   audit sub-copy, trimmed to ≤ 55 words), and under it the compact
   "what we need / what you get" as two short mono-labelled lists (max 4 bullets
   each) — NO buttons; right — the audit booking form (`ContactForm
   variant="audit"`) in a white card (border `#E7E3DA`, radius 12, padding 28,
   shadow `--fn-shadow-card`) with a mono line above it `ONE WEEK · R2,000 ·
   CREDITED`. Mobile: header then form. Remove the old separate `#book` band
   (the form is now the top; keep `id="book"` on the form card so existing
   `#book` links land).
2. **"How the week runs"** (4 steps) stays under the hero, quieter (padding 80
   top).
3. **Assessment + calculator** (`id="assess"` wrapper): H2 "Two ways to see it
   before we start." sub: "Score your operation in a minute, or put your own
   numbers in — both are estimates; the audit is where we find out for real."
   Then a two-column grid at ≥ xl (1280) — left `OperationsAudit` (self-
   assessment, `id="score"`), right the rebuilt `RoiCalculator` (`id="calculator"`,
   H3 "What is manual work costing you?"), `items-start`, gap 32; each column
   min 520px — if at 1160 that's a squeeze for the assessment's answer pills,
   let pills wrap to two rows and reduce their font to 13px; if it still reads
   cramped, drop to stacked at < 1280 (side by side only ≥ xl). Below `xl`:
   stacked, assessment first. Both widgets in white cards matching the form
   card. The calculator's outputs tween 400ms; its result ends in a compact
   FindingCard ("CALCULATOR · Manual work is costing about X hours a month ·
   ≈ Rx/yr at your numbers · evidence: your inputs · action: Book the audit →
   `#book`") — the rand figure here IS derived from the user's own inputs (that
   is allowed; label it "based on your inputs").
4. **`/roi-calculator`**: 301 → `/operations-audit#calculator`; delete the page
   file after adding the redirect (it's redundant per the user's rule) and
   remove it from the sitemap; keep `components/marketing/RoiCalculator.tsx`
   (now used by the audit page).
5. FAQs + JSON-LD (Service/HowTo/FAQPage) stay; update HowTo if step copy
   moved; metadata title stays; description mention "score yourself or run the
   numbers".

Verify: tsc/eslint; 1440 (side by side or stacked per the rule — state which),
1280, 375; `curl -sI /roi-calculator` → 308; `#book`, `#score`, `#calculator`
anchors exist; form submits (stub fetch — real key present); no orange except
the submit button + finding impacts; console clean.
