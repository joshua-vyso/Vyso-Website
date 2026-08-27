# Phase 5 — QA sweep + calculator/score restyle

Branch: `redesign/operations-2026` (verified, unchanged). Dev server reused on
port 3000 throughout, left running at the end per instructions.

Status: **PASS**. The one open accessibility contrast finding from the
original sweep (`--vy-ink-4` failing AA as text) was resolved in a follow-up
pass — see "Follow-up: ink-4 contrast" at the end of this report. A short
list of off-limits/out-of-scope items remains documented for Josh below.

---

## Part A — build work

### 1. `/operations-audit/calculator` and `/operations-audit/score` restyle

Both routes were still rendering the pre-redesign shell: `FinchNav` /
`FinchFooter` inside `.finch-site`, via `components/finch/audit/AuditToolPage.tsx`.
Per the plan, the calculator/score *logic* (`components/marketing/RoiCalculator.tsx`,
`components/marketing/OperationsAudit.tsx`) was wrap-and-restyle only, not
rebuilt — and it didn't need to be: `--fn-bg`/`--fn-surface`/`--fn-line`
(`#FAF9F6`/`#FFFFFF`/`#E7E3DA`) sit close enough to `--vy-bg`/`--vy-surface`/`--vy-line`
(`#FAFAF7`/`#FFFFFF`/`#E7E7E2`) that both widgets already read correctly
against the new page chrome with zero changes to their white cards.

**New:** `components/vyso/audit/AuditToolPage.tsx` — the `--vy-*` replacement
for the shared tool-page shell (`Shell`, eyebrow/H1/sub header, back-to-audit
link, one dark closing `Section` pointed at `/operations-audit#book`).

**Changed:**
- `app/operations-audit/calculator/page.tsx` — imports switched to the new
  `components/vyso/audit/*` (was `components/finch/audit/*`); fixed an em
  dash in the page's `sub` copy.
- `app/operations-audit/score/page.tsx` — same import switch; the page
  `<title>` had an em dash (`"...assessment — score your business..."`),
  rewritten with a colon per copy rule §3.2 (59 chars, still well under 60).
- `components/vyso/audit/audit-content.ts` — added `SCORE_CANONICAL_URL` /
  `CALCULATOR_CANONICAL_URL` (derived from the existing `AUDIT_PATH`, not
  duplicated string literals).
- `components/vyso/audit/audit-jsonld.ts` — added `buildAuditToolSchema`
  (the `BreadcrumbList`-only schema these two pages need), so both tool
  pages stop importing from the otherwise-being-retired `components/finch/audit/*`
  tree for their JSON-LD.

Verified live: both routes return 200, exactly one `<h1>`, zero
`.finch-site`/`FinchNav`/`FinchFooter` markup, and the calculator/self-assessment
both render and submit correctly (see Part B §8 and the transcript above).

### 2. Fixes made from the QA sweep (Part A item 2 — unambiguous, in-scope)

All of these were found *by* the Part B sweep below; listed together here
with the fix, file, and why it was judged unambiguous rather than
"document, don't fix":

| # | Finding | Fix | File(s) |
|---|---|---|---|
| 1 | **Vyso-fee price on the live calculator.** `RoiCalculator`'s payback copy stated a specific Vyso price: *"Based on Vyso's Start tier (R 10 000 once-off + R 8 000/month)..."* — a direct violation of copy rule §3.1 (no price for Vyso's own fees, anywhere), live on `/operations-audit/calculator`. | Rewrote the three payback-text branches to describe a "typical starting build and monthly run cost" with no figure stated; the underlying `START_TIER_SETUP`/`START_TIER_MONTHLY` constants stay as internal, never-displayed inputs to the payback-framing heuristic (no logic rebuild, text-only). | `components/marketing/RoiCalculator.tsx` |
| 2 | **Site-wide 404 page still on the old brand.** `app/not-found.tsx` was never touched by Phases 0–4: `.finch-site` chrome, `FinchNav`/`FinchFooter`, a "See how Finch works" link to the retired `/finch#agents` anchor, an on-page sentence naming Finch directly ("...or it moved when we rebuilt around Finch"), the Finch bird mascot (`BirdHop` → `/finch/finch-bird.svg`), and an em dash. Because Next embeds the 404 boundary's RSC payload on every route, `finch-site` and "Finch" were present in the rendered HTML of every page on the site, not just on an actual 404 hit. | Rewrote onto the `--vy-*` `Shell`; dropped the Finch mascot (personality comes from the copy, not a mascot the rebrand doesn't have); three real links (`/`, `/how-it-works`, `/operations-audit`); no dash, no brand mentions. | `app/not-found.tsx` |
| 3 | **Skip link didn't move focus.** `<a href="#main">` (root `SkipLink`) correctly changes the URL hash and scrolls, but `<main id="main">` had no `tabindex`, so keyboard/AT focus stayed on `<body>` after the jump — confirmed live: after the jump, `document.activeElement` was `BODY`, not `#main`. | Added `tabIndex={-1}` to `Shell`'s `<main id="main">` so the fragment jump can also move focus, without adding it to the normal tab order. One-line, zero-risk, applies sitewide via the one shared `Shell`. | `components/vyso/Shell.tsx` |
| 4 | **Em dashes in live copy**, found by the crawl's copy sweep (see Part B §2 for the full before/after list): 2 question/finding strings + 1 decorative "—" bullet in the self-assessment; 2 form placeholders + 1 success heading + 1 dead-code select option in `ContactForm`; 8 `"...–AUG"` date-range meta strings + 3 observation/impact strings in `findings.ts` (the shared finding-card data feeding the homepage, solutions, industries, and the glossary). | Rewrote each with a comma, full stop, or colon (per rule §3.2); the 8 date-range dashes were normalized to the plain hyphen the same pattern already uses correctly in `lib/marketing/solutions.ts` and `lib/marketing/learn-articles.ts`. | `components/marketing/OperationsAudit.tsx`, `components/ContactForm.tsx`, `lib/marketing/findings.ts` |
| 5 | **Stale redirect-indirection links.** The self-assessment's results panel (client-side only, so the pure-HTML crawl in §1 below never saw it) linked `solutionHref: "/solutions/operations-dashboard"` for 3 of its 10 questions — a slug retired and 301'd to `/solutions/reporting-automation` in Phase 4. Two of the three also still said `solutionLabel: "Operations dashboard"`, a page name that no longer exists (the live page is titled "Reporting automation"). | Repointed all 3 to `/solutions/reporting-automation` directly (no redirect hop) and relabelled to "Reporting automation". Verified end-to-end by completing the self-assessment in the browser: the results panel now links directly, confirmed via the accessibility tree (`href="/solutions/reporting-automation"`, no 308 in between). | `components/marketing/OperationsAudit.tsx` |

Full file list touched this phase (`git status --short`):

```
M app/not-found.tsx
M app/operations-audit/calculator/page.tsx
M app/operations-audit/score/page.tsx
M components/ContactForm.tsx
M components/marketing/OperationsAudit.tsx
M components/marketing/RoiCalculator.tsx
M components/vyso/Shell.tsx
M components/vyso/audit/audit-content.ts
M components/vyso/audit/audit-jsonld.ts
M lib/marketing/findings.ts
?? components/vyso/audit/AuditToolPage.tsx   (new)
```

Nothing under Josh's untracked paths (`app/free-scan/**`, `app/api/free-scan/**`,
`components/finch/scan/**`, `lib/platform/free-scan/**`, `lib/posthog-server.ts`,
`instrumentation-client.ts`, `supabase/free-scan.sql`, `tests/free-scan-*`,
`public/serviceden-logo-concept.svg`, the untracked `.ai/*.md` files) was
staged, edited, or deleted — confirmed by `git status --short` before and
after.

---

## Part B — QA sweep

### 1. Full internal link crawl — PASS

Custom crawler (`node` script, BFS from `/` plus a second seed at `/orbit`
since Orbit is deliberately unlinked from the main nav/footer and a pure
BFS from `/` never reaches it): fetches every page with `redirect: "manual"`,
extracts every same-origin `href` from the rendered HTML, and for any
3xx follows exactly one hop, asserting the destination is 200 and not
itself a redirect (no chains).

- **91 pages crawled** (69 non-orbit + 22 orbit, plus the Next dev static
  assets picked up along the way), **2,418 unique same-origin links
  followed**, **0 failures** — every link resolves 200 or single-hop-308-to-200.
- Spot-checked redirects: `/founding-client` → 308 → `/operations-audit` (200),
  `/finch` → 308 → `/how-it-works` (200), `/insights` → 308 → `/learn` (200).
- One gap this pure-HTML crawler cannot see by construction: links gated
  behind client-side state (the self-assessment's results panel only
  exists after 10 answers + submit). Found and fixed by hand instead — see
  Part A §2 item 5.

### 2. Copy-rule sweep — PASS (with documented, pre-existing exceptions)

Ran the em/en-dash regex, the banned-phrase/codename/Finch/COO/founding-client
list, and a rand-amount scan against the **rendered HTML body text plus
`placeholder`/`alt`/`aria-label`/`title` attribute values** (the first pass
missed attribute text — see below) of every non-orbit page from the crawl.

**Fixed** (detailed in Part A §2): the Vyso-fee price on the calculator, the
Finch mentions and dash on the 404 page, and every em/en dash found in
`OperationsAudit.tsx`, `ContactForm.tsx`, and `findings.ts` (11 rendered
instances total, listed in the Part A table).

**Remaining hits, reviewed individually, none are violations of this
phase's scope:**

| Route | Hit | Verdict |
|---|---|---|
| `/login` | 1 em dash in its "watch your margins — live" blurb; also 0 `<h1>` and a duplicated title suffix (see §3) | **Not touched.** `app/login/**` is explicitly off-limits (plan §10). |
| `/privacy`, `/popia` | 6 em dashes total in the legal prose | **Not touched.** Plan §7.6: these three legal pages get "chrome swap to `Shell` only; legal text untouched." |
| `/terms` | 4 em dashes, plus "Finch" and "Founding client terms" | **Not touched**, matching the exact exception this task's own brief names: "the `/terms` legal section is a known accepted exception." Same finding Phase 4 already flagged and left alone (`DRAFT · UNDER LEGAL REVIEW`, an in-file comment asking not to remove it without Josh's/counsel's sign-off). |
| `/learn/glossary`, `/learn/glossary/operations-audit`, `/learn/glossary/weekly-brief`, `/learn/glossary/fractional-coo` | "COO" flagged by a word-boundary check | **False positive, reviewed.** All four are the `fractional-coo` glossary term's own related-terms links and its definition page, which plan §7.6 explicitly calls for: *"Vyso is not a fractional COO, and it is worth being direct about that here."* Defining and disclaiming the term is the compliant behaviour, not a violation of it. |

**Price scan:** every `R` amount found in copy-swept pages is an illustrative
demo/example figure (order values, supplier prices, margin figures, the
calculator's own live output labelled "based on your inputs, not a quote") —
none read as a Vyso fee. Re-ran a targeted grep for `"start tier"` / `R
10 000` / `R 8 000` across the full crawl JSON after the fix: zero matches.

**Methodology note:** the first crawl pass stripped every HTML tag
(including its attributes) before scanning for dashes, which silently
dropped `<textarea placeholder="...">` text — that's how the `/contact`
form's placeholder dash escaped the first pass. The script was fixed to
also extract `placeholder`/`alt`/`aria-label`/`title` attribute values as
scannable text; re-running after all fixes found zero *new* hits beyond
the four exception rows above.

### 3. Metadata sweep — PASS (one off-limits exception)

77 non-orbit, non-`/app`, non-query-variant routes checked for unique
title, unique description, exactly one `<h1>`, and canonical presence.
Full table:

| Route | Title | H1 | Canonical | OG image |
|---|---|---|---|---|
| `/` | Vyso \| Automation that knows what happens next | 1 | yes | yes |
| `/about` | The team building Vyso's operational systems \| Vyso | 1 | yes | yes |
| `/case-studies` | Case studies: built in the real world \| Vyso | 1 | yes | yes |
| `/case-studies/turn-n-slice` | Turn 'n Slice case study: replacing invoicing admin \| Vyso | 1 | yes | yes |
| `/contact` | Contact us in Johannesburg \| Vyso | 1 | yes | yes |
| `/faq` | FAQ: pricing, security and how Vyso works \| Vyso | 1 | yes | yes |
| `/how-it-works` | How Vyso works \| Vyso | 1 | yes | yes |
| `/industries` | Industries: who Vyso builds for in South Africa \| Vyso | 1 | yes | yes |
| `/industries/food-suppliers` | Food distributor software for South African SMEs \| Vyso | 1 | yes | yes |
| `/industries/hospitality` | Hospitality operations software for South African SMEs \| Vyso | 1 | yes | yes |
| `/industries/wholesale` | Wholesale operations software for South African SMEs \| Vyso | 1 | yes | yes |
| `/integrations` | Integrations: Xero, WhatsApp, Sage, Excel and more \| Vyso | 1 | yes | yes |
| `/learn` | Operations articles for South African SMEs \| Vyso | 1 | yes | yes |
| `/learn/15-signs-your-business-has-operational-chaos` | 15 Signs Your Business Has Operational Chaos \| Vyso | 1 | yes | yes |
| `/learn/ai-for-small-and-medium-businesses-practical-use-cases` | AI for small businesses: practical use cases \| Vyso | 1 | yes | yes |
| `/learn/glossary` | Operations glossary for South African businesses \| Vyso | 1 | yes | yes |
| `/learn/glossary/debtors-ageing` | Debtors ageing: reading the age analysis properly \| Vyso | 1 | yes | yes |
| `/learn/glossary/delivery-note-reconciliation` | Delivery-note reconciliation: the 3-way match \| Vyso | 1 | yes | yes |
| `/learn/glossary/fractional-coo` | Fractional COO: what it means for an SA business \| Vyso | 1 | yes | yes |
| `/learn/glossary/gross-margin-vs-markup` | Gross margin vs markup: the difference \| Vyso | 1 | yes | yes |
| `/learn/glossary/invoice-line-item` | Invoice line item: why totals are not evidence \| Vyso | 1 | yes | yes |
| `/learn/glossary/money-leakage` | Money leakage: the losses nobody adds up \| Vyso | 1 | yes | yes |
| `/learn/glossary/operations-audit` | Operations audit: what it is and what it produces \| Vyso | 1 | yes | yes |
| `/learn/glossary/popia` | POPIA: what the data law asks of an SA business \| Vyso | 1 | yes | yes |
| `/learn/glossary/price-creep` | Price creep: the supplier increases nobody announces \| Vyso | 1 | yes | yes |
| `/learn/glossary/stock-cover-days` | Stock cover days: how long your stock actually lasts \| Vyso | 1 | yes | yes |
| `/learn/glossary/vat-inclusive-pricing` | VAT-inclusive pricing vs ex-VAT: the difference \| Vyso | 1 | yes | yes |
| `/learn/glossary/weekly-brief` | Weekly brief: the report shape that gets read \| Vyso | 1 | yes | yes |
| `/learn/hidden-cost-of-manual-procurement` | The Hidden Cost of Manual Procurement \| Vyso | 1 | yes | yes |
| `/learn/how-much-time-can-workflow-automation-save` | How Much Time Can Workflow Automation Save? \| Vyso | 1 | yes | yes |
| `/learn/supplier-scorecards-what-to-track-and-why` | Supplier Scorecards: What to Track and Why \| Vyso | 1 | yes | yes |
| `/learn/the-real-cost-of-poor-stock-control` | The Real Cost of Poor Stock Control \| Vyso | 1 | yes | yes |
| `/learn/why-businesses-lose-money-without-realising-it` | Why Businesses Lose Money Without Realising It \| Vyso | 1 | yes | yes |
| `/learn/why-weekly-reports-are-usually-too-late` | Why Weekly Reports Are Usually Too Late \| Vyso | 1 | yes | yes |
| `/login` | **Log in or create account \| Vyso \| Vyso** (see below) | **0** | yes (inherited root) | yes |
| `/operations-audit` | Free operations audit \| Vyso | 1 | yes | yes |
| `/operations-audit/calculator` | What is manual work costing you? Calculator \| Vyso | 1 | yes | yes |
| `/operations-audit/score` | Operations self-assessment: score your business in a minute \| Vyso | 1 | yes | yes |
| `/popia` | POPIA & PAIA \| Vyso | 1 | yes | yes |
| `/privacy` | Privacy Policy \| Vyso | 1 | yes | yes |
| `/resources` | Free operations templates for South African SMEs \| Vyso | 1 | yes | yes |
| `/resources/operations-audit-checklist` | Operations audit checklist for South African SMEs \| Vyso | 1 | yes | yes |
| `/resources/supplier-scorecard` | Supplier scorecard template for South African buyers \| Vyso | 1 | yes | yes |
| `/resources/weekly-operations-report-template` | Weekly operations report template for SME owners \| Vyso | 1 | yes | yes |
| `/solutions` | Solutions: what Vyso automates in your operation \| Vyso | 1 | yes | yes |
| `/solutions/document-processing` | Document processing for South African SMEs \| Vyso | 1 | yes | yes |
| `/solutions/inventory-automation` | Inventory automation for South African SMEs \| Vyso | 1 | yes | yes |
| `/solutions/invoice-automation` | Invoice automation for South African SMEs \| Vyso | 1 | yes | yes |
| `/solutions/procurement-automation` | Procurement automation for South African SMEs \| Vyso | 1 | yes | yes |
| `/solutions/reduce-money-leakage` | Reduce money leakage in your business \| Vyso | 1 | yes | yes |
| `/solutions/reporting-automation` | Reporting automation for South African SMEs \| Vyso | 1 | yes | yes |
| `/solutions/spreadsheet-automation` | Spreadsheet automation for South African SMEs \| Vyso | 1 | yes | yes |
| `/solutions/whatsapp-order-automation` | WhatsApp order automation for South African SMEs \| Vyso | 1 | yes | yes |
| `/south-africa` | Built for South African operations \| Vyso | 1 | yes | yes |
| `/terms` | Terms of Service (Draft) \| Vyso | 1 | yes | yes |

Every title and every description is unique across this table (checked
programmatically — zero duplicates among the 76 non-`/login` rows).

**`/login` is the one exception, and it is off-limits** (`app/login/**`,
plan §10): its title is literally `Log in or create account | Vyso | Vyso`
— `app/login/layout.tsx:4` sets `title: "Log in or create account | Vyso"`,
and the root layout's `title.template: "%s | Vyso"` (`app/layout.tsx`)
appends a second `| Vyso`. It also has 0 `<h1>` and inherits the homepage's
meta description rather than declaring its own. Documented, not fixed.

**OG images:** 70 unique `opengraph-image` URLs declared across the site
(one per route family, e.g. all 8 solutions share a generator instance but
each resolves independently) — **all 70 return 200**.

### 4. JSON-LD — PASS

Parsed every `<script type="application/ld+json">` on all 91 crawled pages:
**zero invalid JSON, zero parse errors.**

- Root (`/`, and every page via the shared graph): `Organization`, `WebSite`,
  `ProfessionalService`, `Service` — present everywhere, as required.
- `BreadcrumbList`: present on every section/detail page (solutions,
  industries, case studies, learn articles + glossary terms, resources,
  the audit cluster, legal pages).
- `HowTo`: `/operations-audit` only, matching its 5-step audit flow.
- `FAQPage`: `/faq`, all 8 `/solutions/*` pages, plus `/integrations`,
  `/south-africa`, and all 3 `/industries/*` pages — each with real,
  page-specific Q&A content (verified `/industries/wholesale` in particular,
  since it initially looked like an outlier: it has the same `FAQPage`
  node as its two siblings). This is **broader** than "only /faq and
  solutions," but matches the plan's actual instruction (§7.4: *"FAQPage
  JSON-LD only where genuinely useful"*) rather than a narrower literal
  reading — flagging as an intentional variance, not a defect.
- `Article` on all 8 learn posts, `DefinedTerm`/`DefinedTermSet` on the
  glossary, `CreativeWork` on the 3 resources, `ContactPage` on `/contact`,
  `ItemList` on every index page, `Person` on `/about`.
- Orbit's own JSON-LD (out of scope, not modified) also parses cleanly.

### 5. Responsive (375 / 768 / 1440) — PASS

All 19 required routes checked at all three widths via
`document.documentElement.scrollWidth` vs `window.innerWidth` (no
horizontal overflow at any width, on any page):

`/`, `/how-it-works`, `/operations-audit`, `/solutions`,
`/solutions/reduce-money-leakage`, `/industries`, `/industries/food-suppliers`,
`/integrations`, `/case-studies/turn-n-slice`, `/about`, `/faq`, `/contact`,
`/south-africa`, `/learn`, `/learn/why-businesses-lose-money-without-realising-it`,
`/learn/glossary/money-leakage`, `/resources`,
`/resources/operations-audit-checklist`, `/privacy`.

- 375px: `scrollWidth === innerWidth === 375` on all 19 pages.
- 768px: `scrollWidth (753) <= innerWidth (768)` on all 19 (the 15px gap is
  the scrollbar-gutter, consistent across every page).
- 1440px: `scrollWidth (1425) <= innerWidth (1440)` on all 19, same pattern.
- **Nav at 375:** confirmed interactively — the hamburger opens a full-screen
  sheet with all 5 nav links (How it works, Solutions, Case studies, About,
  Insights), Log in, and the CTA button; the close (×) control closes it.

**Screenshot note:** the browser pane's screenshot capture was unreliable
in this session (returned solid-black frames on `/contact` at one point
despite the DOM/`get_page_text` confirming correct content underneath —
an environment/rendering-buffer issue, not a site bug). Per this task's own
fallback instruction, the responsive and interaction checks above are
evidenced with `scrollWidth`/`innerWidth` measurements and `get_page_text`
output rather than screenshots for the majority of this pass; a handful of
early screenshots (homepage at 375px) did render correctly and are in the
transcript above.

### 6. Reduced motion — PASS

Homepage hero (`EventTimeline`) and the how-it-works page were checked with
plain `curl` (no JS execution at all) against the dev server: the timeline's
event copy ("09:41", "09:42", "09:43", "Supplier A", "shortage", "invoice",
etc.) is present in the raw server-rendered HTML before any client JS runs.
Confirmed in code: `components/vyso/demo/EventTimeline.tsx` gates its motion
through `useStaticMotion()` (reads both the OS `prefers-reduced-motion`
setting and the `/design` emulation toggle) and `components/vyso/Reveal.tsx`'s
default `initial` is transform-only (`translateY`, not `opacity: 0`), so a
reduced-motion or JS-disabled visitor gets the complete, correctly-ordered
content, not a blank section waiting on an animation.

### 7. Accessibility spot pass

- **Landmarks:** exactly one `<main id="main">` per page (checked via DOM
  query on the homepage; `Shell` is the only place that renders `<main>`
  outside of orbit/`/design`/the untracked free-scan page, none of which
  this phase touches).
- **Skip link:** present ("Skip to content"), first tab stop, visible focus
  ring on real Tab (solid 2px, `rgb(189, 74, 14)`), and — after the fix in
  Part A §2 item 3 — now actually moves focus to `#main` on activation, not
  just the scroll position.
- **Form inputs labelled:** all 4 fields on `/contact`'s form
  (`Your name`, `Business name`, `Email address`, `What is your biggest
  operational challenge?`) have a real `<label for>` association, confirmed
  via the accessibility tree, not just a placeholder.
- **Keyboard:** nav links, the mobile menu button, and the contact form's
  fields all reached and activated correctly via real `Tab`/`Enter`/`.click()`
  interaction in the browser pane.
- **Color-contrast — computed ratios for the requested token pairs**
  (WCAG 2.1 relative-luminance formula, against both page grounds):

  | Pair | On `--vy-bg` (#FAFAF7) | On `--vy-surface` (#FFFFFF) | AA normal text (4.5:1) |
  |---|---|---|---|
  | `--vy-ink-2` (#3D3D3A) | 10.42:1 | — | pass |
  | `--vy-ink-3` (#6E6E68) | 4.91:1 | 5.13:1 | **pass** |
  | `--vy-ink-4` (#9C9C95) | 2.64:1 | 2.76:1 | **fail** (fails even AA-large's 3:1) |
  | `--vy-accent` (#E05E1F) | 3.47:1 | 3.63:1 | fails normal text; **passes** AA-large text and the 3:1 non-text/UI-component threshold |

  Lighthouse's `color-contrast` audit independently caught the same failure
  on the live homepage: the hero demo's mono timestamp ("09:41", 2.76:1) and
  date label ("TUE 26 AUG", 2.48:1 — `--vy-ink-4` on `--vy-surface-2`) both
  rendered below AA for normal-size text.

  **Update: resolved.** WCAG AA is an acceptance criterion (plan §1.6), so
  this was escalated from "documented, not fixed" to a follow-up fix — full
  detail, remedy chosen, files touched, and re-measured ratios are in
  "Follow-up: ink-4 contrast" at the end of this report.

### 8. Forms — PASS

Both live `ContactForm` call sites confirmed against the running dev server
(`ALLOW_REAL_SENDS` unset, `NODE_ENV=development`):

```
POST /api/contact {variant:"general", ...}  → 200 {"success":true}
POST /api/contact {variant:"audit",   ...}  → 200 {"success":true}
```

Dev server log for both requests:

```
[contact] dev gate: not sent. variant=general name=9ch business=5ch challenge=36ch email=***@example.com whatsapp=(none) — set ALLOW_REAL_SENDS=1 to send for real.
[contact] dev gate: not sent. variant=audit name=9ch business=5ch challenge=27ch email=***@example.com whatsapp=(none) — set ALLOW_REAL_SENDS=1 to send for real.
```

Redacted (email masked, everything else reported as a length only), and no
call reaches Resend or the Supabase rate-limit RPC — confirmed by code
inspection of `app/api/contact/route.ts`'s dev gate as well. The success
UI was exercised end-to-end in the browser for the self-assessment
(`components/vyso/audit/AuditForm.tsx`, its own independent client-side
`/api/contact` call) via a full 10-question run through to the results
panel — see the transcript above.

### 9. Performance (Lighthouse) — PASS on stated targets

`npx lighthouse` ran successfully in this environment (Chrome found at
`/Applications/Google Chrome.app`, headless). Six runs: `/`, `/how-it-works`,
one solution page (`/solutions/reduce-money-leakage`), each desktop + mobile,
against the running `next dev` server:

| Page | Perf (desktop) | Perf (mobile) | A11y | Best Practices | SEO |
|---|---|---|---|---|---|
| `/` | **90** | 70 | 96 | 96 | **100** |
| `/how-it-works` | **99** | 80 | 96 | 96 | **100** |
| `/solutions/reduce-money-leakage` | **100** | 83 | 96 | 96 | **100** |

Targets: SEO 100 (met, all 3), a11y ≥ 96 (met exactly, all 3), perf ≥ 90
desktop (met, all 3: 90/99/100). Mobile perf has no explicit numeric target
in this task and is reported as-is.

**Caveat:** this ran against the dev server (`next dev`, Turbopack,
unminified JS/CSS, no production code-splitting), per this task's own
example invocation. `best-practices` docks 4 points sitewide for
`errors-in-console` (the known PostHog `/ingest` 404, see §11) and
`valid-source-maps` (a dev-mode-only gap). Mobile performance is
specifically hurt by LCP (5.9s on the homepage) driven by dev-mode JS/CSS
payload size (Lighthouse's own top opportunities: ~272 KiB of unminified
JS, ~449 KiB of unused JS, ~8 KiB of unminified CSS) — none of that exists
in a production build. Desktop already clears the ≥90 target despite the
dev-mode overhead, which is a good sign for production; if a stricter
mobile-perf read is wanted, re-run against `next build && next start`.

### 10. `npm run test`, `tsc`, `eslint` — PASS

```
npm run test        → 1118 pass, 0 fail   (matches expected 1118)
npx tsc --noEmit     → 29 errors, all in components/finch/scan/**, tests/free-scan-*.test.ts
                       (Josh's untracked free-scan work — the expected, pre-existing 29)
npx eslint components/vyso app/ --no-error-on-unmatched-pattern
                     → errors only in app/app/** (pre-existing, out of scope: react-hooks/purity
                       `Date.now()` calls in server components, unrelated to this phase)
npx eslint components/vyso components/marketing/RoiCalculator.tsx \
    components/marketing/OperationsAudit.tsx app/not-found.tsx app/operations-audit \
    --no-error-on-unmatched-pattern
                     → clean, 0 errors, 0 warnings (every file this phase touched)
```

Ran `tsc`/`eslint`/`test` again after every batch of fixes; final numbers
above are post-fix.

### 11. Console — PASS

Checked `/`, `/how-it-works`, `/operations-audit`, `/operations-audit/calculator`,
`/operations-audit/score`, `/solutions/reduce-money-leakage`,
`/case-studies/turn-n-slice`, `/contact`, `/faq`, and a deliberate 404 hit.
Every console error captured across that whole run is the known PostHog
`/ingest` 404 (and its downstream `[PostHog.js] ... Bad HTTP status: 404`
and `ExceptionAutocapture failed to load script` messages) — Josh's
untracked local PostHog config, explicitly called out as accepted. Zero
other errors.

---

## Scorecard

| # | Check | Result |
|---|---|---|
| 1 | Full internal link crawl | **PASS** — 91 pages, 2,418 links, 0 failures |
| 2 | Copy-rule sweep | **PASS** — 11 rendered dash/price violations found & fixed; remaining hits are documented legal-draft/off-limits/false-positive exceptions |
| 3 | Metadata sweep | **PASS** — 76/77 pages clean; `/login` (off-limits) has a duplicated title suffix, 0 h1, inherited description |
| 4 | JSON-LD | **PASS** — 0 invalid JSON across 91 pages; all expected types present |
| 5 | Responsive 375/768/1440 | **PASS** — 19/19 pages, 0 horizontal overflow; mobile nav confirmed |
| 6 | Reduced motion | **PASS** — timeline content fully present in SSR HTML |
| 7 | Accessibility spot pass | **PASS** — `--vy-ink-4`-as-text contrast finding resolved in follow-up, a11y now 100 on `/`, `/how-it-works`, `/solutions/reduce-money-leakage` |
| 8 | Forms (dev gate) | **PASS** — both variants, redacted log, no real send |
| 9 | Performance (Lighthouse) | **PASS** on stated targets — desktop perf 90/99/100 (99/99/100 after follow-up), a11y 96→100, SEO 100 |
| 10 | `test` / `tsc` / `eslint` | **PASS** — 1118/1118, 29 pre-existing free-scan errors only, 0 new lint issues |
| 11 | Console | **PASS** — only the known PostHog `/ingest` 404 |

---

## Open items for Josh

1. ~~`--vy-ink-4` contrast~~ — **resolved**, see "Follow-up: ink-4 contrast"
   at the end of this report.
2. **`/terms`** still contains "Finch" and a "4. Founding client terms"
   section (Phase 4's own flagged, unresolved item — this phase changes
   nothing here). Needs your or counsel's sign-off on rewrite vs. removal.
3. **`/privacy` and `/popia`** carry em dashes in their draft legal prose.
   Left untouched under the same "legal text untouched" rule as `/terms`;
   they'll keep surfacing on any future copy-rule grep until the legal
   drafts are finalised.
4. **`/login`** (`app/login/**`, off-limits): title renders as `Log in or
   create account | Vyso | Vyso` (double suffix — `app/login/layout.tsx:4`
   already includes `| Vyso`, and the root layout's title template adds a
   second one), has 0 `<h1>`, and inherits the homepage's description
   instead of its own. All three are one-line fixes whenever someone is
   cleared to touch that route.
5. **Newly-orphaned files from this phase's restyle:**
   `components/finch/audit/AuditToolPage.tsx` and
   `components/finch/audit/audit-jsonld.ts` now have zero importers (the
   two routes that used them were migrated to `components/vyso/audit/*`).
   Left in place rather than deleted, matching every prior phase's
   discipline of not deleting files outside their own stated scope.
6. **Pre-existing dead code found while reading (not created by this
   phase, not touched):** `components/finch/audit/AuditHero.tsx` (zero
   importers, itself renders `ContactForm variant="audit"`) and
   `ContactForm`'s entire `variant="academy"` branch (zero call sites since
   `/academy` 301s to `/learn`) both carry pre-redesign copy — "Vyso
   Academy is COMING SOON," "the first cohort," dashes — that never
   renders on any live route today, so it doesn't fail the copy sweep, but
   it's worth a cleanup pass alongside item 5.
7. **FAQPage scope is broader than "only /faq and solutions"** — it's also
   correctly present on `/integrations`, `/south-africa`, and all 3
   `/industries/*` pages, each with genuine page-specific Q&A. This matches
   the plan's actual wording (§7.4: "where genuinely useful"); flagging in
   case the narrower phrasing was intentional and those four should lose
   their `FAQPage` markup.
8. **Lighthouse ran against `next dev`,** not a production build (per this
   task's own example command). Desktop already clears target; if a
   stricter production-representative mobile number is wanted, re-run
   after `next build`.

---

## Verification commands run

```
npm run test
npx tsc --noEmit
npx eslint components/vyso app/ --no-error-on-unmatched-pattern
npx eslint components/vyso components/marketing/RoiCalculator.tsx \
  components/marketing/OperationsAudit.tsx app/not-found.tsx app/operations-audit \
  --no-error-on-unmatched-pattern
node <ad-hoc crawler>.mjs   # BFS link crawl + copy/metadata/JSON-LD sweep, 91 pages
npx lighthouse http://localhost:3000/ [...] --preset=desktop
npx lighthouse http://localhost:3000/ [...] --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate
# (repeated for /how-it-works and /solutions/reduce-money-leakage)
curl -sI http://localhost:3000/founding-client | grep -i location
curl -sI http://localhost:3000/finch | grep -i location
curl -X POST http://localhost:3000/api/contact -d '{"variant":"general",...}'
curl -X POST http://localhost:3000/api/contact -d '{"variant":"audit",...}'
```

Dev server left running on port 3000.

---

### Follow-up: ink-4 contrast

Architect-approved follow-up (WCAG AA is an acceptance criterion, plan
§1.6/brief §47 — not a design call to defer). Resolves the open finding
above: `--vy-ink-4` (#9C9C95) failing AA (2.6–2.8:1) wherever it was used
as text.

**Chosen remedy: reclassify usages, not darken the token.** `app/globals.css`
already documents the intended rule in its own ink-ramp comment (written
when the token was introduced, ahead of this finding):

> `--vy-ink-4   2.7:1   NON-TEXT ONLY: rules, disabled glyphs, hairline
> labels ≥ 24px. It fails AA as body copy on purpose; reach for `--vy-ink-3`
> the moment it is a sentence.`

So the token's own spec already rejects darkening it (failing AA as body
copy is intentional — it's meant to never be read as a sentence) and
already names the fallback. Reclassifying is also the more surgical fix:
`--vy-ink-3` was independently already measured passing (4.9–5.1:1) in the
original sweep, so moving genuine text off `--vy-ink-4` needed no new
colour, no dark-mode recompute, and no risk to the ~50 other things
`--vy-ink-4` is *correctly* used for (hairlines, dots, disabled glyphs) had
the token itself moved instead.

**Classification.** Grepped every `--vy-ink-4` usage across
`components/vyso` and `app` (`app/design/vyso/page.tsx` excluded — the
internal, noindex token-swatch reference page, which must keep showing
each token's *real* colour to be useful as a reference):

- **Text → moved to `--vy-ink-3`:** every `text-[color:var(--vy-ink-4)]`
  and `placeholder:text-[color:var(--vy-ink-4)]` instance where the element
  carries real words a reader is meant to read — eyebrow labels, mono
  timestamps and meta lines, breadcrumbs, `dt`/`dd` pairs, italic quoted
  prompts, form placeholders, and (for extra safety, since WCAG 1.4.11's
  3:1 non-text/UI-component threshold also covers them and the visual cost
  is negligible) two functional SVG icons — the FAQ accordion chevron and
  the FAQ search icon. **62 instances across 36 files.**
- **Non-text → left on `--vy-ink-4`:** solid-fill status/bullet dots
  (`bg-[color:var(--vy-ink-4)]`, 4 places), one input's `hover:border`
  affordance (`AuditForm.tsx`), and one `aria-hidden="true"` decorative
  flow glyph (↓/→ between diagram blocks, `HomeBespoke.tsx`) — none of
  these carry meaning on their own; the content next to them does. **6
  places, unchanged.**

**Files touched (37):**

```
app/about/page.tsx
app/case-studies/page.tsx
app/case-studies/turn-n-slice/page.tsx
app/contact/page.tsx
app/faq/FaqInteractive.tsx
app/faq/page.tsx
app/industries/[slug]/page.tsx
app/industries/page.tsx
app/integrations/page.tsx
app/not-found.tsx
app/solutions/[slug]/page.tsx
components/vyso/audit/AuditForm.tsx
components/vyso/audit/AuditOutcomes.tsx
components/vyso/audit/AuditSteps.tsx
components/vyso/audit/AuditTools.tsx
components/vyso/case/CaseCard.tsx
components/vyso/case/CaseTemplate.tsx
components/vyso/case/PriceListPeek.tsx
components/vyso/demo/ChromeFrame.tsx
components/vyso/demo/EventTimeline.tsx
components/vyso/demo/FindingCard.tsx
components/vyso/home/HomeBespoke.tsx
components/vyso/home/HomeCase.tsx
components/vyso/home/HomeDifferentiation.tsx
components/vyso/home/HomeExamples.tsx
components/vyso/home/HomeFounder.tsx
components/vyso/home/HomeHero.tsx
components/vyso/home/HomeProcess.tsx
components/vyso/how/HowAutomation.tsx
components/vyso/how/HowExisting.tsx
components/vyso/how/HowLoop.tsx
components/vyso/how/HowProactive.tsx
components/vyso/industries/IndustryBody.tsx
components/vyso/industries/IndustryCard.tsx
components/vyso/integrations/IntegrationSection.tsx
components/vyso/solutions/SolutionCard.tsx
components/vyso/solutions/SolutionDemo.tsx
```

(`components/vyso/home/HomeBespoke.tsx` is in this list for the 3 text
usages it also had — its 1 decorative arrow-glyph usage was deliberately
reverted back to `--vy-ink-4` after the bulk pass, per the classification
above.)

**A second, distinct bug this surfaced.** Re-running Lighthouse after the
bulk fix still failed `color-contrast`, on a different element:
`EventTimeline.tsx`'s meta line inside the accent-tint "NEEDS ATTENTION" /
"VYSO RECOMMENDS" boxed cards used `--vy-ink-3` — correct against
`--vy-bg`/`--vy-surface`, but that card's background is `--vy-accent-tint`
(#FBEDE4), a warmer/lighter ground where `--vy-ink-3` only measures
4.47:1 (fails by a hair). Bumped that one instance to `--vy-ink-2`
(9.52:1 on `--vy-accent-tint` — comfortably clears AA). This was the only
place in the codebase where `--vy-ink-3` (or `-4`) sits directly on
`--vy-accent-tint` — every other accent-tint usage (`Card.tsx`'s accent
`Pill`, `FindingCard.tsx`'s accent `chip`) already used `--vy-accent-ink`
(5.35:1 on accent-tint), which is why they didn't also fail.

**Dark-band analogue — verified, no change needed.** `--vy-ink-4` remaps to
`--vy-dark-mono` (#8C8C85) under `[data-vy-ground="dark"]`. Recomputed:
5.62:1 on `--vy-dark-bg` (#101010), 5.10:1 on `--vy-dark-surface` (#1B1B19,
matching the value already documented in `globals.css`) — both clear AA
comfortably as text, so the dark-ground ramp had no equivalent bug to fix.

**Re-measured ratios** (WCAG 2.1 relative luminance, spot-checked against
every ground the fix touches):

| Pair | Ground | Ratio | AA (4.5:1 normal text) |
|---|---|---|---|
| `--vy-ink-3` on `--vy-bg` | #FAFAF7 | 4.91:1 | pass |
| `--vy-ink-3` on `--vy-surface` | #FFFFFF | 5.13:1 | pass |
| `--vy-ink-3` on `--vy-surface-2` | #F3F3EF | 4.61:1 | pass |
| `--vy-ink-3` on `--vy-accent-tint` | #FBEDE4 | 4.48:1 | **fail** → that one instance moved to `--vy-ink-2` |
| `--vy-ink-2` on `--vy-accent-tint` | #FBEDE4 | 9.52:1 | pass |
| `--vy-dark-mono` on `--vy-dark-bg` | #101010 | 5.62:1 | pass |
| `--vy-dark-mono` on `--vy-dark-surface` | #1B1B19 | 5.10:1 | pass |
| `--vy-ink-4` (remaining non-text uses) | n/a | 2.64–2.76:1 | n/a — no longer used as text anywhere in scope |

**Lighthouse a11y, before → after** (desktop, `next dev`):

| Page | a11y before | a11y after | color-contrast audit |
|---|---|---|---|
| `/` | 96 | **100** | 2 failing nodes → 0 |
| `/how-it-works` | 96 | **100** | 2 failing nodes → 0 |
| `/solutions/reduce-money-leakage` (spot-checked, not required) | 96 | **100** | 0 → 0 |

Performance/SEO/best-practices were unaffected by this change (perf desktop
99/99/100 across the three pages on this run; run-to-run dev-server
variance, not attributable to the fix).

**Verification re-run:**

```
npx tsc --noEmit                                    → 29 errors, unchanged (all pre-existing free-scan)
npx eslint components/vyso app --no-error-on-unmatched-pattern
                                                     → same 12 pre-existing app/app/** problems, 0 new
npm run test                                        → 1118 pass, 0 fail
npx lighthouse http://localhost:3000/ --preset=desktop              → a11y 100 (was 96)
npx lighthouse http://localhost:3000/how-it-works --preset=desktop  → a11y 100 (was 96)
```

Screenshot sanity check (homepage at 1440px, in-transcript): the hierarchy
still reads correctly after the change — headline (`--vy-ink`) → body
(`--vy-ink-2`) → timestamps/eyebrows/meta (`--vy-ink-3`, now slightly less
faint than before but still clearly the lightest *readable* tier) → accent
callouts unchanged. Nothing looks flattened; the "NEEDS ATTENTION" /
"VYSO RECOMMENDS" cards remain the most visually distinct elements on the
page.

Committed to `redesign/operations-2026`, not pushed. Dev server left
running on port 3000.
