# Implementation log: Vyso redesign 2026, Phase 2b

Plan: `.ai/plan_vyso_redesign_2026.md` §7.6. Brief: `.ai/brief_redesign_2026_copy.md`.
Branch: `redesign/operations-2026` (verified before starting, not created). Scope:
`/about`, `/faq`, `/contact`, `/south-africa`, on the `--vy-*` system built in
Phase 0/1. Three other agents worked the same branch in parallel on disjoint
files (homepage, `/how-it-works` + `/operations-audit`, solutions/industries/
integrations/case-studies); nothing outside this phase's four pages and their
own new `components/vyso/company/*` files was touched.

---

## Files created

| Path | What it is |
|---|---|
| `components/vyso/company/TrustPoints.tsx` | Shared 3-up trust grid (POPIA awareness, plain-language data handling, humans approve actions), used by `/about` and `/south-africa` |
| `components/vyso/company/company-jsonld.ts` | Fresh `buildContactSchema()` / `buildSouthAfricaSchema(faqs)` — deliberately NOT importing `components/finch/company/company-jsonld.ts`, which pulls in `lib/marketing/founding.ts` (slated for Phase 4 deletion) just to reuse one unrelated builder |
| `.ai/implementation_redesign_2026_phase2b.md` | This file |

## Files modified

| Path | What changed |
|---|---|
| `lib/marketing/faq.ts` | Full rewrite to the brief's FAQ question set (5 groups, 22 questions). Kept the `pricing` group id (load-bearing: `/pricing-faq` 301s to `/faq#pricing`). Kept `FaqItem`/`FaqGroup`/`ALL_FAQ_QUESTIONS` shapes so `/faq`'s JSON-LD wiring and `/south-africa`'s quoted subset both still work unchanged in type. |
| `app/faq/page.tsx` | Rebuilt on `Shell`, hand-rolled `FaqHero` (h1 + search needs a slot `Section` doesn't have), then the same sticky-nav + `<details>` accordion structure restyled to `--vy-*`. Native `<details>`, works with JS off. Added a closing dark-band CTA. New metadata + JSON-LD (unchanged shape, new copy). |
| `app/faq/FaqInteractive.tsx` | Class-name swap only (`--fn-*` → `--vy-*`); the DOM contract (`data-faq-item`/`data-faq-text`/`data-faq-group`) and every `track()` call are byte-identical to before. |
| `app/faq/opengraph-image.tsx` | Now imports `renderVysoOgImage` from `lib/og/vyso.tsx` instead of the retired `renderOgImage`. Counts still read live off `lib/marketing/faq.ts`. |
| `app/about/page.tsx` | Full rewrite on `Shell` + `Section` + `TrustPoints`. Founder story expanded (4 paragraphs, distinct prose from `HomeFounder`'s condensed version, same facts), one-cohesive-company section, South African identity section, trust section, honest "first real proof case" framing for Turn 'n Slice, dark closing CTA. Kept `buildAboutSchema()` from `components/finch/about/about-jsonld.ts` unchanged — it only ever asserted a `Person` node from `lib/marketing/site.ts`, nothing Finch-specific to fix. |
| `app/about/opengraph-image.tsx` | Fixed the flagged line ("The company behind Finch.") — rebuilt on `renderVysoOgImage`. |
| `app/contact/page.tsx` | Full rewrite: hero, three-intent card row (start an audit → `/operations-audit`; ask a question / talk about a problem → both anchor to the same form), contact info panel, `ContactForm` `variant="general"` composed inside a `Card` (NOT rewritten — see deviation 1). |
| `app/contact/opengraph-image.tsx` | Was a re-export of the site-wide image; now its own `renderVysoOgImage` render. |
| `app/south-africa/page.tsx` | Full rewrite: honest AEO-first hero ("Yes, Vyso is a South African company..."), six local-reality cards (WhatsApp, Excel, Sage/Xero honesty, rand/VAT/EFT, informal processes, local support), one grounded local vignette (a VAT-rate mismatch on a supplier invoice, `ChromeFrame` + `FindingCard`), `TrustPoints`, a 5-question FAQ subset quoted by id from `lib/marketing/faq.ts`, dark closing CTA. Dropped the old `SouthAfricaMap` and industry-specific cross-links (see deviation 2). |
| `app/south-africa/opengraph-image.tsx` | Was a re-export of the site-wide image; now its own `renderVysoOgImage` render themed on the page's own VAT vignette. |

Nothing else was touched: no shared `components/vyso/*.tsx` (root level), no
`app/layout.tsx`, no `lib/marketing/site.ts`, no solutions/industries/
integrations/case-studies files, no `next.config.ts`, no untracked free-scan
work.

---

## Deviations from the brief/plan, and why

1. **`ContactForm` is composed, not restyled.** Per the task's own instruction,
   its internals (`components/ContactForm.tsx`) were left untouched — it's
   shared with `/operations-audit`, `/academy` and a resources page, none of
   which this phase owns. Its `--fn-*` field styling (`--fn-line: #E7E3DA`,
   `--fn-surface: #FFFFFF`) is close enough to `--vy-line`/`--vy-surface` that
   the two systems don't visibly clash inside the `Card` wrapper; the one
   visible seam is the submit button, which keeps `MagneticButton`'s default
   burnt-orange fill rather than `--vy-ink`. Confirmed by browser screenshot,
   not disqualifying: orange reads as this system's accent colour, not a
   foreign one.

2. **`/south-africa` links to `/industries` (the index) rather than specific
   industry slugs.** The old page linked `/industries/food-suppliers`,
   `/industries/farms`, `/industries/restaurants`; plan §5 retitles/trims
   these to `food-suppliers`/`wholesale`/`hospitality`, and that trim is
   Phase 2d's job, running concurrently on the same branch. Linking to
   specific slugs risked a broken link if 2d's rename landed differently.
   The index route is stable regardless, so cross-links point there instead.
   Same reasoning for the closing CTA's secondary button ("See who we build
   for" → `/industries`).

3. **No `SouthAfricaMap` on the new `/south-africa`.** It was a Finch-styled
   SVG decoration with no factual content of its own; the new page spends its
   visual budget on the local-reality card grid and the grounded VAT vignette
   instead, consistent with plan §4's "no illustration that doesn't carry a
   claim" spirit already established on the homepage.

4. **The "better spreadsheet" honesty line (copy rule §3.8) is not on any of
   these four pages.** The rule asks for it once, "operations-audit or faq."
   `/operations-audit` is a more natural home for it (it's literally about
   the audit's own honesty), and that page is Phase 2a's file, running
   concurrently — duplicating the line onto `/faq` risked it landing twice
   site-wide. Left out here; worth Fable confirming 2a placed it once.

5. **`/faq`'s FAQPage JSON-LD wiring is structurally identical to before**
   (`BreadcrumbList` + `FAQPage` reading `ALL_FAQ_QUESTIONS`), just re-derived
   inline in the rebuilt page rather than imported from a separate file —
   there was no separate schema file for `/faq` before either.

6. **Added a question beyond the brief's literal FAQ list**: "How is Vyso
   different from hiring another admin employee?" in the `fit` group. The
   task explicitly asked for "ERP/Zapier/admin-hire differentiation" on
   `/faq`; the brief's own question list only names Zapier/Make and ERP, so
   this one was written fresh, in the same voice, to satisfy the explicit
   instruction.

---

## Verification

- **`npx eslint app/about app/faq app/contact app/south-africa
  components/vyso/company lib/marketing/faq.ts`** — clean, zero output.
- **`npx tsc --noEmit`** — the run has pre-existing errors, all outside this
  phase's files: 29 in Josh's untracked free-scan work (documented since
  Phase 0), plus a large batch in `components/finch/solutions/**`,
  `app/industries/page.tsx`, `app/solutions/page.tsx` and
  `app/solutions/[slug]/opengraph-image.tsx` — all from Phase 2c/2d's
  concurrent, mid-flight rewrite of `lib/marketing/solutions.ts` on the same
  branch (confirmed via `git status`: those files are modified/deleted by
  someone else's session, not this one). Filtering the full error list to
  this phase's paths (`grep -E "^app/about|^app/faq|^app/contact|
  ^app/south-africa|^components/vyso/company|^lib/marketing/faq"`) returns
  **zero matches**.
- **Copy-rule sweep** — `grep -nE "[—–]"` over the four pages, `FaqInteractive.tsx`,
  `TrustPoints.tsx` and `lib/marketing/faq.ts`: every hit is inside a `/*
  block comment */` (developer-facing, same house style as Phase 0/1's own
  files); zero hits in rendered strings after one fix (see below). Banned
  phrases, module codenames, "COO", "founding client", "Academy" and the
  `R[0-9]` price regex: zero hits anywhere in rendered content (comments that
  narrate what was REMOVED — "the old page said Finch, OrderFlow..." — are
  developer-facing and match existing house convention).
  - **One real violation found and fixed**: `components/vyso/company/
    TrustPoints.tsx`'s POPIA point originally read "...on its own — that
    still depends..." with an em dash in customer-facing copy. Rewritten to
    two sentences.
- **Dev server**: could NOT start an independent instance on port 3102.
  Next.js 16 added a project-wide dev-server lockfile
  (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`:
  "a lockfile mechanism prevents multiple `next dev` or `next build`
  instances on the same project"), keyed off `distDir` regardless of `-p`
  port, and another concurrent agent already held it (`next dev -p 3101`,
  same working tree). `next dev -p 3102` bootstrapped, then exited cleanly
  on the lock conflict (confirmed no orphaned process afterward). Editing
  `next.config.ts` to give this session its own `distDir` was out of scope
  (shared file, explicitly off limits). Used the browser tool's own
  registered dev preview (`localhost:3000`, same repository checkout, same
  live file watcher) for all QA instead — every distinctive string checked
  below is proof it was serving this session's edits, not stale content.
- **Browser QA, `/about`**: desktop (1440) and mobile (375) screenshots
  correct — hero, founder story, "one company"/"South Africa"/trust/proof
  sections, one dark closing band with correctly inverted button colours.
  `scrollWidth === 375` at mobile, one `<h1>`, one `data-vy-ground="dark"`.
- **Browser QA, `/faq`**: desktop and mobile screenshots correct; clicked
  "What is Vyso?" and the accordion opened natively; navigated to
  `/faq#pricing` and it landed scrolled to the "Pricing and how it works"
  group (confirmed by screenshot). `scrollWidth === 375` at mobile.
- **Browser QA, `/contact`**: desktop and mobile screenshots correct, three
  intent cards render, `ContactForm` composes cleanly inside a `Card`.
  **Form dev-gate proven directly against the running server**: `curl -X
  POST /api/contact` with the same field shape `ContactForm` sends for
  `variant: "general"` → `200 {"success":true}`; server log:
  `[contact] dev gate: not sent. variant=general name=12ch business=16ch
  challenge=46ch email=***@example.com whatsapp=(none) — set
  ALLOW_REAL_SENDS=1 to send for real.` No real email sent. (An in-browser
  submit attempt was also made but the shared Browser pane lost focus
  mid-interaction in this multi-agent session — see note below — so the
  curl proof is the authoritative check here, exercising the exact route
  and payload shape the form uses.)
- **Browser QA, `/south-africa`**: title, full page text and structural
  checks (`scrollWidth === 375` at mobile, one `<h1>`, one
  `data-vy-ground="dark"`) all confirmed via `get_page_text` and
  `javascript_exec` after the Browser pane stopped compositing screenshots
  mid-session ("the Browser pane is not displayed" — an environment-level
  side effect of sharing one browser tool across four concurrent agents'
  sessions, not a page defect). Every section's rendered text matches the
  authored copy exactly, including the VAT vignette and the quoted FAQ
  subset.
- **Console**: no hydration warnings, no uncaught errors on any of the four
  pages. The only errors are the known PostHog `/ingest` 404s (Josh's
  untracked `instrumentation-client.ts`, out of scope, documented since
  Phase 0/1). One PostHog error log's BODY happened to contain the site's
  own `not-found.tsx` page HTML (still on the pre-redesign Finch nav/footer,
  with "Academy"/"Founding client" links) — this is Next.js inlining a
  prefetch-miss for one of `Footer.tsx`'s three not-yet-built solution
  slugs (Phase 0's own documented deviation #8: `/solutions/
  whatsapp-order-automation` etc. 404 until Phase 2c ships them), not
  content emitted by any of this phase's four pages. Verified by grepping
  each page's own rendered text for "Finch"/"Academy"/"COO"/"founding
  client": zero hits outside that one unrelated prefetch artifact and
  developer comments.
- **No dev server of this session's own was left running** (it never
  successfully bound; see above). The shared server used for QA belongs to
  another concurrent agent and was left exactly as found — not stopped.

---

## What Fable/Phase 3 should know

- `lib/marketing/faq.ts`'s group ids are now `vyso`, `fit`, `pricing`,
  `tools`, `trust` (previously `finch`, `pricing`, `audit`, `data`,
  `integrations`). Anything outside this phase that referenced the old ids
  or specific question ids (e.g. `/pricing-faq`'s redirect target, which only
  needs the `pricing` GROUP id and still resolves) should be checked, but
  the FAQ page itself and `/south-africa`'s subset are self-consistent.
- `/south-africa`'s FAQ subset picks 5 ids from the new `lib/marketing/
  faq.ts` (`where-is-vyso-based`, `does-vyso-work-outside-south-africa`,
  `can-vyso-work-with-whatsapp`, `can-vyso-connect-to-sage`,
  `is-our-data-secure`) — if `lib/marketing/faq.ts` is edited again later,
  keep those ids or update the `ids` array in `app/south-africa/page.tsx`'s
  `southAfricaFaqs()`, which throws loudly on a missing id rather than
  failing silently.
- `components/vyso/company/TrustPoints.tsx` is now shared between `/about`
  and `/south-africa`. If a future page also needs the same three trust
  facts, reuse it rather than re-typing the copy a third time.
- The Next.js 16 dev-server lockfile is project-wide, not per-port. Any
  future multi-agent phase running dev servers concurrently on this branch
  will hit the same wall unless agents coordinate on one shared server or
  someone adds a per-session `distDir` to `next.config.ts` (which nobody
  should do unilaterally, since it's shared).
