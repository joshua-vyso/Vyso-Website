# Implementation log: Vyso redesign 2026, Phase 2a

Plan: `.ai/plan_vyso_redesign_2026.md` §7.2 and §7.3. Copy source:
`.ai/brief_redesign_2026_copy.md`. Branch: `redesign/operations-2026`. Nothing pushed, merged or
deployed. Phases 0 and 1 are logged in `.ai/implementation_redesign_2026.md`; this file is the
2a scope only (`/how-it-works` new, `/operations-audit` rewritten) because three other agents were
working the same branch in parallel and a shared log file is a shared merge conflict.

---

## Files created

| Path | What it is |
|---|---|
| `app/how-it-works/page.tsx` | The new route: metadata, JSON-LD mount, nine sections in `Shell` |
| `app/how-it-works/opengraph-image.tsx` | `--vy-*` OG on the page's own headline and demo |
| `components/vyso/how/HowHero.tsx` | h1, the AEO direct answer, two CTAs |
| `components/vyso/how/HowDefinition.tsx` | What Vyso is, and the explicit NOT list |
| `components/vyso/how/HowAutomation.tsx` | The first half: four stages + the approval card |
| `components/vyso/how/HowProactive.tsx` | The second half: `EventTimeline`, supplier-invoice script |
| `components/vyso/how/HowExisting.tsx` | Connected today / designed around / what you change |
| `components/vyso/how/HowLoop.tsx` | Audit, diagnose, build, monitor, and back again |
| `components/vyso/how/HowPricing.tsx` | Pricing philosophy, no figures, `#pricing` |
| `components/vyso/how/HowDifferences.tsx` | ERP / Zapier or Make / another admin hire |
| `components/vyso/how/HowClose.tsx` | The page's one dark band |
| `components/vyso/how/how-jsonld.ts` | `BreadcrumbList` + the canonical URL constant |
| `components/vyso/audit/AuditHero.tsx` | h1, direct answer, and the booking form at `#book` |
| `components/vyso/audit/AuditForm.tsx` | `"use client"`. Five fields, same POST, `--vy-*` |
| `components/vyso/audit/AuditSteps.tsx` | The brief's five steps, `#step-01…05` |
| `components/vyso/audit/AuditOutcomes.tsx` | Six outcomes + one example `FindingCard` |
| `components/vyso/audit/AuditHonesty.tsx` | Diagnosis first, and the better-spreadsheet line |
| `components/vyso/audit/AuditTools.tsx` | Doorways to `/score` and `/calculator` |
| `components/vyso/audit/AuditClose.tsx` | The page's one dark band |
| `components/vyso/audit/audit-content.ts` | The strings the page AND its schema read |
| `components/vyso/audit/audit-jsonld.ts` | `Service` · `HowTo` · `BreadcrumbList` |
| `.ai/implementation_redesign_2026_phase2a.md` | This file |

## Files modified

- **`app/operations-audit/page.tsx`** — replaced whole. Was the Finch shell (`FinchNav`,
  `FinchFooter`, `components/finch/audit/*`); is now `Shell` plus six `components/vyso/audit/*`
  sections, with new title, description, canonical, OG block and JSON-LD.
- **`app/operations-audit/opengraph-image.tsx`** — was `renderAuditOgImage` (the Finch template);
  is now `renderVysoOgImage`.

Nothing else was touched. No shared primitive in `components/vyso/*.tsx`, no `app/layout.tsx`, no
`lib/marketing/faq.ts`, no `lib/marketing/*` file at all, no `lib/og/*` file (`lib/og/vyso.tsx` is
imported, not edited), no `next.config.ts`, no route belonging to another 2b/2c/2d agent, and none
of Josh's untracked work.

Server components throughout except `AuditForm` (state and a POST), and the `EventTimeline` /
`Reveal` leaves that were already client components. Every heading, sentence, timestamp and rand
figure on both pages is plain HTML in the first response.

## The unenforced rules, and where they are spent

| | `/how-it-works` | `/operations-audit` |
|---|---|---|
| One `h1` | `HowHero` | `AuditHero` |
| One dark `Section` | `HowClose` | `AuditClose` |
| The ambient shadow | `ChromeFrame` in `HowProactive` | unspent: no chrome on the page |
| Accent | the timeline's two rows, and nothing else | one `FindingCard` in `AuditOutcomes` |

Measured in the served HTML: one `<h1>` and one `data-vy-ground="dark"` per page.

## Decisions and deviations

1. **The third "not" does not use the retired job title.** The brief's NOT list is "not a SaaS
   platform, not a Zapier setup agency, not a fractional COO", and plan §2 bans that third phrase
   from the public site. A denial is still a public reference, and a search engine indexes
   "we are not a fractional X" exactly as happily as a claim. So the first two are explicit
   ("Not a software platform you subscribe to", "Not an agency that sets up Zapier or Make") and
   the third says the same thing in the reader's own words: **"Not a person you hire by the
   month"**, with the body making it unambiguous (no seat on the org chart, does not run your team
   or attend your management meetings). The `[no codenames/Finch/COO]` rule was treated as
   absolute, as instructed, and this is the one place the two instructions met.

2. **`components/vyso/audit/AuditForm.tsx` was built rather than wrapping `ContactForm`.** The
   task allowed this if the styling clashed irreparably. It does, in three ways a wrapper cannot
   reach because they are inside the component: its submit is `MagneticButton` (plan §4 rules
   magnetic CTAs off the new surface by name), every input is `--fn-*` with an 8px radius and a
   blue `#C9DEF7` focus ring, and its success state renders the Finch `FindingCard` with the
   pointer tilt. Reaching any of those from outside means a descendant selector overriding another
   component's internals, which breaks silently the next time either file moves. Editing
   `ContactForm` itself was not available: `/contact` and `/academy` render it and both are another
   agent's files this phase.
   **The contract is identical**: same `POST /api/contact`, same field names, same
   `variant: "audit"`. `app/api/contact/route.ts` was not touched.

3. **The form has five fields, not six.** The old audit variant's sixth was a "number of
   locations" select, which exists because pricing used to be per location, a phrase plan §2
   retires from the public site. It is optional on the server, so dropping it changes nothing
   about the request. Plan §7.3 asks for ≤6.

4. **No `FAQPage` on `/how-it-works`.** The three comparison blocks are exactly the shape
   `FAQPage` wants and marking them up would be valid, but brief §41 puts the same three questions
   on `/faq`, and two pages claiming `FAQPage` for the same question text asks Google to choose
   between them for one rich result. `/faq` should win that, so `/faq` gets the markup and this
   page keeps plain crawlable prose, which is what the AEO requirement in plan §8 actually needs.
   Written into `how-jsonld.ts` so 2b knows the markup is theirs. **If `/faq` drops one of the
   three, its markup should move here.**

5. **`/operations-audit` keeps a `HowTo` with a zero `estimatedCost`.** Carried over from the old
   page's schema deliberately: it is the one page whose subject is a free thing, `price: "0"` is
   the valid way to state "free", and losing the `HowTo` on a rewrite of a live URL throws away
   rich-result eligibility the page already had. The five steps and the description are read from
   `audit-content.ts`, which is what the page renders, so schema and page cannot drift. The
   `Service` reuses the sitewide `#audit` @id so the two nodes merge into one entity.

6. **The audit page's closing CTA points at `#book`, not at another page.** The form is already on
   the page; a closing CTA that navigates away from the thing it is asking for is a page arguing
   with itself. Its secondary door is `/how-it-works` rather than `/contact`, because someone who
   reaches the bottom without booking usually has one question left and it is "what would you
   actually build".

7. **`/how-it-works`'s timeline runs the supplier-invoice morning, not the homepage's order.**
   Plan §7.2 asks for a second scenario and the invoice one is the better story for this page: the
   noticing IS the whole event. Two accented rows (one `alert`, one `recommendation`), which is
   the documented cap. Every timestamp is a static string; R4.20 per kg is operational, what a
   supplier charged a distributor.

8. **Both OG images are new pictures, not the homepage's.** They sit beside each other in a search
   result and in a WhatsApp thread, and three identical cards would say the three pages are one
   page. `/how-it-works` shows its own invoice feed; `/operations-audit` shows the findings report
   with `01/02/03` in the mono column. `/operations-audit/score` and `/operations-audit/calculator`
   still render the Finch-era `renderAuditOgImage` through their own segment files, untouched, and
   both were re-checked after this change.

9. **`components/finch/audit/**` and `components/marketing/OperationsAudit.tsx` are left in
   place.** `/operations-audit/score` and `/operations-audit/calculator` still import them and
   those two routes are out of scope. Phase 4 decides what is genuinely orphaned, under the
   Orbit-grep rule.

## Cross-links created

Out of `/how-it-works`: `/operations-audit` ×4 (hero, loop, pricing, close), `/integrations`,
`/faq`, `/contact`, and the in-page `#pricing`.
Out of `/operations-audit`: `/operations-audit/score`, `/operations-audit/calculator`, `/#examples`
(the homepage's four example findings), `/how-it-works`, and the in-page `#book`.
Into these pages from Phase 0/1 work already on the branch: the nav's "How it works" and its
"Free Operations Audit" CTA, the footer's audit CTA, and the homepage hero's "See how Vyso works".

## Verification

- **`npx eslint app/how-it-works components/vyso/how components/vyso/audit
  app/operations-audit/page.tsx app/operations-audit/opengraph-image.tsx`** — clean, zero output.
- **`npx tsc --noEmit`** — 29 errors, byte-identical to the Phase 0 and Phase 1 baselines: all in
  Josh's untracked free-scan work (`components/finch/scan/**`, `tests/free-scan-content.test.ts`)
  emitting `free_scan_*` events that `lib/analytics.ts` does not declare. Zero errors in any file
  this phase touched. Not fixed: plan §10 puts those files off limits.
- **Dev server** `next dev -p 3101`. `GET /how-it-works` → **200**, 156,733 bytes.
  `GET /operations-audit` → **200**, 129,116 bytes.
- **Structure, measured in the served HTML.** `/how-it-works`: one `<h1>`, eight `<h2>`, one
  `data-vy-ground="dark"`, one `class="vyso-site"`, one `id="main"`. `/operations-audit`: one
  `<h1>`, six `<h2>` (five sections plus the form card's "Book your audit"), one dark ground.
- **Metadata.** `<title>How Vyso works | Vyso</title>` (21 chars) with a 150-char description and
  `canonical=https://vyso.co.za/how-it-works`; `<title>Free operations audit | Vyso</title>`
  (28 chars) with a 147-char description and `canonical=https://vyso.co.za/operations-audit`. Full
  `openGraph` and `twitter` blocks on both, no `images` key on either, so the file convention
  resolves each segment's own generator.
- **JSON-LD**, parsed from each response: the sitewide graph (`Organization`, `WebSite`,
  `ProfessionalService`, `Service`) plus `["BreadcrumbList"]` on `/how-it-works` and
  `["Service", "HowTo", "BreadcrumbList"]` on `/operations-audit`. The `HowTo`'s five step URLs
  match five `id="step-0N"` anchors that each appear exactly once on the page.
- **OG images.** `/how-it-works/opengraph-image` → 200, `image/png`, 1200×630, 81.7 KB.
  `/operations-audit/opengraph-image` → 200, `image/png`, 1200×630, 81.8 KB. Both rendered and
  read: correct faces, correct palette, one accent box each. Regression check on the routes that
  still use the old template: `/operations-audit/score/opengraph-image` → 200, and both tool pages
  → 200.
- **Copy sweeps over the RENDERED text of both pages** (tags stripped, entities unescaped):
  `[—–]` → **0 hits**. Banned-phrase and codename sweep (Finch, COO, all eleven module codenames,
  Academy, founding client, per location, transform your business, unlock the power, revolutionary,
  cutting-edge, future-proof, next-generation, harness, leverage, streamline everything, seamless,
  digital transformation, ecosystem, synergy) → **0 hits**. The only rand figure on either page is
  `R4.20`, which is operational (a supplier's price per kg). No figure for Vyso's work appears on
  either page, in either OG image, or in either schema graph, except the audit's own zero, which
  lives in the sitewide node.
- **Internal link crawl** of every root-relative `href` inside `<main>` on both pages: `/`,
  `/contact`, `/faq`, `/how-it-works`, `/integrations`, `/operations-audit`,
  `/operations-audit/calculator`, `/operations-audit/score` → **all 200**. The three in-page anchor
  targets (`#pricing`, `#book`, `#examples` on the homepage) all exist.
- **Desktop 1440.** Every section of both pages screenshotted and correct: the two-tier headings,
  the is/is-not columns, the four automation stages, the timeline in window chrome with its accent
  alert and recommendation, the three honesty columns, the loop, the pricing card, the three
  comparison blocks, the dark close, the audit hero with the form beside it, the five steps, the
  outcomes grid with the finding card, the blockquote carrying the better-spreadsheet line, and
  the two tool cards. `documentElement.scrollWidth` 1425 against a 1440 viewport: no horizontal
  overflow.
- **Mobile 375.** `scrollWidth === 375` on both pages, no horizontal overflow. The nav row fits
  with the CTA visible at `size="sm"`. Every grid collapses to one column; the form's paired
  fields stack; the timeline's 52px mono column holds and the accent box does not buckle.
- **Forms dev gate**, proven against the running server. A full UI submission of the new form
  produced, in the server log:
  `[contact] dev gate: not sent. variant=audit name=9ch business=14ch challenge=49ch
  email=***@example.com whatsapp=***000 — set ALLOW_REAL_SENDS=1 to send for real.`
  No mail and no rate-limit RPC, and the page rendered the success state ("REQUEST RECEIVED",
  "That came through. Thank you."). Validation still runs ahead of the gate: a submission missing
  fields → `400 {"error":"Missing required fields."}`, a malformed address →
  `400 {"error":"Please enter a valid email address."}`.
- **Console** — no application errors and no hydration warnings on either page. The only errors are
  the known PostHog `/ingest` 404s from Josh's untracked `instrumentation-client.ts`.
- **Reduced motion.** With `matchMedia` patched to report `prefers-reduced-motion: reduce` and the
  timeline remounted by client navigation, `EventTimeline` drops its "Play again" button (it should:
  there is nothing to play again) and renders all five rows. Independently and more importantly,
  the SERVER HTML carries every row's text with a **transform-only** rest style
  (`style="transform:translateY(14px)"`); the only `opacity:0` inline styles on the page are the
  five decorative dots. So the demo is complete and readable before JavaScript arrives at all,
  which is the property that actually matters.
  **Environmental caveat, same as Phases 0 and 1:** the Browser pane does not run
  `requestAnimationFrame` (a rAF probe timed out at 30s). That is why the page cannot be scrolled
  in the pane and why `motion`'s animations never advance there, so the settled `transform: none`
  end state could not be observed in-browser. Section-by-section screenshots were taken by hiding
  preceding sections in the DOM instead. Verified as environmental, not a regression, by the same
  behaviour on the already-reviewed homepage.
- Dev server stopped; port 3101 free.

## What later phases need to know

- **Phase 3 (plumbing):** `app/sitemap.ts` needs `/how-it-works` added, and `lib/marketing/llms.ts`
  should carry the page (it is the destination of the whole `/finch` + `/platform/**` + `/pricing`
  + `/compare/*` redirect cluster). Neither file was touched here.
- **Phase 4 (deletions):** `app/operations-audit/page.tsx` no longer imports
  `components/finch/audit/*`, but `/operations-audit/score` and `/operations-audit/calculator`
  still do (`AuditToolPage`, `audit-content.ts`, `audit-jsonld.ts`, `audit-og.tsx`), and
  `components/marketing/OperationsAudit.tsx` / `RoiCalculator.tsx` are still theirs. Nothing under
  `components/finch/audit/**` is orphaned yet.
- **Phase 5 (QA):** the two tool routes are still on the Finch shell and are the visible seam in
  this cluster; they are the restyle this phase deliberately did not do.
- **2b (`/faq`):** the `FAQPage` markup for "how is Vyso different from an ERP / from Zapier or
  Make / from hiring another admin person" is yours; `/how-it-works` answers all three in prose and
  deliberately does not mark them up. Its answers open with the same claim, so the two pages agree.
