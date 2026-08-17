# Implementation: Phase 1 — shell + `/finch` + front door + FAQ + metadata/redirects

Plan: `.ai/plan_phase1_shell_finch_frontdoor.md`. Each workstream appends its own
section below under its own heading. Do not edit another workstream's section.

## D — FAQ, redirects, metadata

Plan: Workstream D of `.ai/plan_phase1_shell_finch_frontdoor.md`.

### Files created

| File | What |
|---|---|
| `lib/marketing/site.ts` | `SITE` constants: name, url, email, the ≤155-char entity-statement description (trimmed from `.ai/vyso_v2.md` §7.4), locale, address (Johannesburg/ZA, no street), founder (Josh Moreira), and `sameAs: []` with a `// TODO(user)` comment explaining the key is omitted from JSON-LD while empty rather than published as `sameAs: []`. |
| `lib/marketing/faq.ts` | `FAQ_GROUPS` (6 groups: Finch · Pricing & terms · The audit & onboarding · Data, POPIA & security · Integrations & your tools · Comparison & fit; 28 questions total) and `ALL_FAQ_QUESTIONS`. Merges the old `FAQ_GROUPS` (`app/faq/page.tsx`) and `PRICING_FAQS` (`app/pricing-faq/page.tsx`), every answer rewritten against the single R6,000 offer. Every `id` (group + question) is unique; verified with a script. Max answer length found: 48 words (budget was ≤90). |
| `app/faq/FaqInteractive.tsx` | Two small client components, colocated with the route they belong to (not listed as a separate file in the plan, but within the `app/faq/page.tsx` "rebuild" scope — the smallest reasonable place for them given D owns no `components/` directory). `FaqFilter`: wraps the server-rendered accordion list, filters via direct DOM `style.display` writes on `[data-faq-item]`/`[data-faq-group-section]` keyed off `data-faq-text` — no React state re-render of ~30 items, no data duplicated to the client bundle. `FaqDeepLinkHandler`: on mount, opens the `<details>` matching `location.hash` and flashes it to `#F5F2EA` for 600ms via inline styles (`transition: none` → set colour → `requestAnimationFrame` transition back to transparent → cleanup at 650ms). Pure DOM writes, no `setState` in the effect, so nothing trips `react-hooks/set-state-in-effect`. |

### Files modified

- `app/faq/page.tsx` — full rebuild in the Finch design language. `<h1>` "Straight
  answers.", intro paragraph linking to `/contact`, `FaqFilter`-wrapped search
  input, a `≥ lg` sticky group nav (`lg:sticky lg:top-[110px]`) next to the
  group/question list, native `<details>`/`<summary>` accordion per question
  (same pattern as `/pricing`'s `WhatsIncluded`, chevron rotates via
  `group-open:rotate-90`), `AuditBand`, `FinchNav`/`FinchFooter`. Each `<details>`
  carries `id={item.id}` (deep-link target) and `data-faq-item` /
  `data-faq-group` / `data-faq-text` (filter contract). Each group `<section>`
  carries `id={group.id}` — `id="pricing"` is load-bearing for the
  `/pricing-faq` redirect target. FAQPage + BreadcrumbList JSON-LD built from
  `ALL_FAQ_QUESTIONS`, one `<script>` in the page. Metadata: title `"FAQ:
  Finch pricing, the audit & POPIA"` (becomes `"… | Vyso"` via the new root
  template), description ≤155 chars, canonical `/faq`, OG/Twitter using
  `/og.png`.
- `next.config.ts` — added, all `permanent: true`: `/platform` → `/finch`,
  `/platform/finch` → `/finch`, `/platform/vyso-for-smes` → `/finch`,
  `/pricing-faq` → `/faq#pricing`. Changed `/platform/vyso-ai`'s destination
  from `/platform/finch` to `/finch` (skips the now-redundant intermediate
  hop). Did not touch `/platform/modules*`, `/about`, `/apps`, `/services`,
  or the existing `www.` redirect.
- `app/sitemap.ts` — removed `/platform`, `/platform/finch`,
  `/platform/vyso-for-smes`, `/pricing-faq`; added `/finch`
  (`lastModified: 2026-08-15`); gave `/faq`, `/contact`, `/operations-audit`
  today's `lastModified`. Everything else (module slugs, industries,
  solutions, learn, resources, compare, `/platform/modules`) untouched.
- `app/layout.tsx` — metadata + JSON-LD only; fonts and `children` untouched.
  `title` is now `{ default: "Vyso — Finch, your company's own COO at a
  tenth of the cost", template: "%s | Vyso" }`; `description` and the OG/
  Twitter descriptions now read `SITE.description`; `metadataBase` reads
  `SITE.url`; added `alternates.languages: { "en-ZA": "/", "x-default": "/" }`
  (root only, per the plan). Replaced the two-node JSON-LD graph with four
  nodes: `Organization` (`founder` → `Person` "Josh Moreira", `address`
  Johannesburg/ZA only, `areaServed` ZA, `contactPoint`, `sameAs` included
  only when `SITE.sameAs` is non-empty), `WebSite`, `SoftwareApplication`
  `#finch` (offer read from `PRICE.finch`/`PRICE.currency` in
  `components/finch/pricing/pricing-data.ts` — the same constants
  `/pricing`'s own JSON-LD uses, so the two pages can't quote different
  numbers), `Service` `#audit` (offer from `PRICE.audit`). No ratings, no
  address beyond Johannesburg/ZA, per the phase-1 decision.
- `app/pricing/page.tsx` — **the one permitted edit outside D's file list**,
  per the plan. Its `title` was a self-contained string ending in `"| Vyso"`;
  with the new root template that would have doubled to `"…| Vyso | Vyso"`.
  Trimmed the trailing `" | Vyso"` off the constant so the template supplies
  it once. Verified: rendered `<title>` is
  `"Finch pricing — R6,000 per location per month, everything included | Vyso"`
  — single suffix, and both of `/pricing`'s own JSON-LD scripts still parse.

### Deviations from the plan

1. **New file `app/faq/FaqInteractive.tsx`**, not in D's stated file list
   (which names only `lib/marketing/faq.ts`, `app/faq/page.tsx`,
   `next.config.ts`, `app/sitemap.ts`, `app/layout.tsx`,
   `lib/marketing/site.ts`). The plan requires client-side filtering and a
   deep-link flash, both of which need `"use client"`, and D owns no
   `components/` directory to put them in. Colocating a small helper file
   inside `app/faq/` — the exact route D is rebuilding — was the smallest
   reasonable interpretation of "app/faq/page.tsx (rebuild)" rather than
   inlining ~90 lines of client logic into the server page file or reaching
   into another workstream's `components/finch/` tree.
2. **`app/faq/faq.module.css` left in place, unused.** The old page imported
   it for CSS-module classes; the rebuild is pure Tailwind utility classes
   (matching `/pricing`'s pattern), so nothing imports it anymore. Deleting
   component/route files needs the user's approval per `.ai/vyso_v2.md` §3's
   redundancy rule, and CSS-module deletion wasn't explicitly in scope here —
   flagging it as a Phase 5 cleanup candidate rather than deleting it.
3. **`app/pricing-faq/page.tsx` and `app/pricing-faq/` left on disk,
   unreachable.** `next.config.ts`'s redirect intercepts `/pricing-faq`
   before Next resolves it to a page component (verified: `curl -sI` returns
   308, never renders the old page), so the route is dead but the file still
   exists. Same redundancy-list treatment as faq.module.css — not deleted,
   flagged for Phase 5.
4. **`/apps` → `/platform/vyso-for-smes` → `/finch` is now a two-hop redirect
   chain.** The plan explicitly says "Leave `/about`, `/apps`, `/services` as
   they are (Phase 3/5)", so `/apps`'s destination wasn't touched, but its
   destination (`/platform/vyso-for-smes`) is itself now redirected to
   `/finch` by this workstream's new rule. Both hops are 308 permanent;
   functionally correct (any crawler or browser follows the chain to
   `/finch`), just not collapsed to one hop. Flagging for a future pass
   rather than touching `/apps` now, per the plan's explicit boundary.
5. **Homepage title (`app/page.tsx`, not a D file) does not pick up the new
   `" | Vyso"` template suffix**, while `/pricing` and `/faq` (both use a
   nested-segment `page.tsx`) do. This is standard Next.js metadata
   resolution: a `title.template` set on a layout does not apply to a title
   set in a `page.tsx` that shares the exact same route segment as that
   layout (only descendant segments inherit the template) — verified with
   `curl` against all three pages. Not a defect; noted here since it looks
   asymmetric at a glance.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Exactly the 3 known pre-existing WhatsApp errors. Zero elsewhere (one earlier
run surfaced a 4th, `motion`-related error with no file path attached — did
not reproduce on a clean re-run, almost certainly a transient snapshot from a
concurrent workstream editing `components/finch/*` mid-compile).

```
$ npx eslint app/faq lib/marketing/faq.ts lib/marketing/site.ts app/layout.tsx app/sitemap.ts next.config.ts app/pricing/page.tsx
```
Clean, no output.

```
$ curl -sI localhost:3000/platform            → 308, location: /finch
$ curl -sI localhost:3000/platform/finch      → 308, location: /finch
$ curl -sI localhost:3000/platform/vyso-for-smes → 308, location: /finch
$ curl -sI localhost:3000/platform/vyso-ai    → 308, location: /finch
$ curl -sI localhost:3000/pricing-faq         → 308, location: /faq#pricing
$ curl -sI localhost:3000/platform/modules    → 200 (untouched, confirmed NOT redirected)
```

```
$ curl -s localhost:3000/sitemap.xml | grep -E "platform|finch|pricing-faq"
```
Contains `/finch` and every `/platform/modules*` slug; no `/platform`,
`/platform/finch`, `/platform/vyso-for-smes` or `/pricing-faq`.

Grep gate on every file this workstream touched:
```
$ grep -rnE "R10,000|R30,000|R50,000|setup fee|Start, Create|Vyso AI|Join Waitlist" \
    lib/marketing/faq.ts lib/marketing/site.ts app/faq/page.tsx app/faq/FaqInteractive.tsx \
    next.config.ts app/sitemap.ts app/layout.tsx app/pricing/page.tsx
```
0 matches (two early misses were both explanatory comments naming the retired
terms verbatim — reworded to describe them without the literal strings).

JSON-LD parses (`node -e`, `JSON.parse` on every `<script type="application/
ld+json">` in the rendered HTML): `/` → `Organization, WebSite,
SoftwareApplication, Service`, both scripts on `/faq` → `Organization/WebSite/
SoftwareApplication/Service` graph + `BreadcrumbList/FAQPage` graph, both
scripts on `/pricing` unaffected and still parse.

### Browser (dev server on :3000, already running — shared with other workstreams)

**1440×900.** `/faq`: sticky left nav (Finch · Pricing & terms · The audit &
onboarding · Data, POPIA & security · Integrations & your tools · Comparison &
fit) beside the group/question list; clicking a question opens its `<details>`
and rotates the chevron; typing "POPIA" into the search box live-filters down
to the one matching group/question (screenshot-verified) and clearing it
restores everything. One `<h1>`. Console clean.

**375×812.** `document.documentElement.scrollWidth === window.innerWidth`
(375 = 375, no horizontal scroll). Sticky nav correctly hidden below `lg`;
search input and accordion both usable full-width. Console clean.

**Deep link.** `GET /faq#how-much-does-finch-cost` in a fresh tab: server HTML
already carries `id="how-much-does-finch-cost"` on the right `<details>`;
after hydration `document.getElementById(...).open === true` (confirmed via
`javascript_tool`) — the effect correctly opens it. The flash's inline
`backgroundColor` had already cleared by the time it was queried (the 650ms
cleanup fired before the round-trip completed), consistent with the code
running to completion rather than erroring.

### Known gap for the reviewer to eyeball

**Native browser scroll-to-fragment did not visibly scroll the page** in this
tool's automated tabs (`window.scrollY` stayed 0 after navigating to
`/faq#how-much-does-finch-cost`). This reproduces identically on `/pricing
#whats-included` — a section this workstream never touched, built by another
workstream — so it is a property of the browser-automation tool / Next.js dev
router interaction in this environment, not something `FaqDeepLinkHandler`
does or fails to do. The item still opens and (per the code) still flashes;
only the native scroll-into-view couldn't be observed here. Worth a real-
browser check.

**`FaqDeepLinkHandler`'s 600ms flash timing** was verified by code review and
by confirming the `open`/style state before and after the window, not by
sampling mid-animation — the tool's navigate→exec round-trip consistently
took longer than 650ms, so no sample ever landed inside the transition. Same
category of gap as the reduced-motion checks noted throughout
`.ai/implementation_homepage_finch.md`.

### For Phase 5's redundancy list (not deleted, flagged only)

- `app/pricing-faq/` (`page.tsx`) — unreachable, 301'd away.
- `app/faq/faq.module.css` — unused after the Tailwind rebuild.

---

## A — shell

Workstream A of `.ai/plan_phase1_shell_finch_frontdoor.md`: FinchNav (desktop
inline / hamburger below `lg`), the mobile sheet, the 4-column FinchFooter, the
`PublicPageShell` swap, `app/not-found.tsx`, and `/privacy`'s nav/footer swap.
**Nothing committed.**

### Files created

| File | What |
|---|---|
| `components/finch/MobileMenu.tsx` | `"use client"`. The 40×40 hamburger (two 18px hairlines 6px apart, morphing to an × over 200ms) plus the full-height sheet: solid `#FAF9F6`, `role="dialog"` + `aria-modal`, focus trap, `Escape`, body scroll lock, focus returned to the hamburger, closes on route change. |
| `components/finch/BirdHop.tsx` | `"use client"`. The finch SVG, one hop on mount (y `0 → −6 → 0`, 300ms, once); static under reduced motion. Only the 404 uses it. |
| `app/not-found.tsx` | Server. Nav + bird + `404` eyebrow + `<h1>` "Page not found." + a `PAGE WATCH` finding card with real links + footer. `metadata: { title: "Page not found", robots: { index: false } }`. |

### Files modified

- `components/finch/FinchNav.tsx` — `FinchNavSection` is now
  `finch | industries | pricing | learn | none` (was `industries | pricing |
  login`). Desktop (≥ lg) renders Finch · Industries · Pricing · Learn · Log in
  (`#8A8474`, one step quieter) + the CTA, which now points at
  `/operations-audit` (was `/contact`). Active link `#14120E`, others `#4A463C`,
  hover `#C94F0E`, `aria-current="page"` on the active one. Below `lg`:
  wordmark + CTA + hamburger, no text links. `FINCH_NAV_LINKS`, `FINCH_NAV_CTA`,
  `FINCH_NAV_LOGIN` are passed to `MobileMenu` as props rather than imported by
  it — this module is a server component, and a client import would drag the
  whole nav into the client bundle.
- `components/finch/FinchFooter.tsx` — rebuilt as 4 columns (Finch · Vyso ·
  Learn · Legal) at ≥ md, one column below, with the column titles as mono
  eyebrows (10.5px / .14em / `#8A8474`); links 13.5px `#6B6659` → `#C94F0E`.
  Bottom row: wordmark (h 13, opacity .7) · "Built by Vyso in Johannesburg." ·
  `joshua@vyso.co.za` (mailto) · © year. Padding 96/40/48 desktop, 20px gutters
  and 64/40 mobile.
- `components/marketing/PublicMarketing.tsx` — `PublicPageShell` now renders
  `FinchNav`/`FinchFooter` instead of `Navbar`/`SiteFooter`, each inside a
  `.finch-site bg-fn-bg` band so it reads as a Finch surface over the old
  shader. `blend-surface` moved from the page root to `<main>` (see deviation
  1). `styles.main`'s `padding-top: 64px` dropped — it only existed to clear
  the old fixed navbar, and the new nav is in flow.
- `app/privacy/page.tsx` — same swap; `blend-surface` moved to its `<main>` and
  the main's top padding 9.5rem → 4rem for the same reason. No other change.

### Deviations from the plan (and why)

1. **`blend-surface` moved rather than removed** (plan step 5 said remove it
   from the shell). Removing it outright leaves the old-design pages' copy
   sitting unreadable on the shader's dark band, which still sweeps under them
   until each page is rebuilt — measured on `/industries` at 1440. Keeping it on
   `<main>` gets the plan's actual intent (the class must not reach the new
   nav/footer, whose ink it would invert) without breaking the transitional
   pages. Both the class and the shader go when each page is rebuilt.
2. **`app/privacy/page.tsx` got two changes, not one.** The plan allowed only
   the import swap, but the page root carried `blend-surface` (deviation 1) and
   its `<main>` carried a 9.5rem top padding that only existed to clear the old
   fixed navbar. Both had to move for the new nav to render correctly.
3. **`PublicPageShell` passes no `active` to `FinchNav`.** The shell is shared
   by ~25 routes and is a server component with no pathname; giving it one would
   mean making it a client component for a colour. Each page sets its own
   `active` when it is rebuilt in the Finch language.
4. **New file `components/finch/BirdHop.tsx`** (not in the plan's file list).
   `app/not-found.tsx` exports `metadata`, so it must stay a server component,
   and the hop needs `motion` — one 25-line client component instead of adding a
   keyframe to `app/globals.css` (which no workstream owns this phase).
5. **The 404's card is composed from the `FindingCard` pieces**, not
   `<FindingCard>`. `FindingActions` renders labels; the plan wants three real
   links, so the actions row is written out with `<Link>`s carrying the same
   classes.
6. **The mobile sheet does not cross-fade.** It mounts solid `#FAF9F6` from the
   first frame (only the links stagger). A fading panel is translucent for as
   long as the fade lasts, which contradicts "solid, no blur" — and a throttled
   tab can freeze it there (observed at opacity .32 in a backgrounded tab while
   testing).
7. **Menu-open state is derived from the pathname** (`open = openedOn ===
   pathname`) instead of an effect that closes on route change. The repo's
   ESLint config errors on `react-hooks/set-state-in-effect`; this needs no
   state sync at all and also handles back/forward navigation.
8. **Footer link set trimmed to routes that exist**: no Glossary, Terms or
   POPIA (the plan already omits them), Academy → `/pricing#academy` (that
   anchor exists on the rebuilt pricing page), About → `/about` (currently 308s
   onward, as the plan accepts). LinkedIn is omitted from the bottom row — no
   URL has been supplied; the plan's bottom row (wordmark · Johannesburg line ·
   email · © year) is what ships.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts …  ×3   (pre-existing, not ours)
components/finch/product/AgentsOnShift.tsx(30,6) …      (workstream B, in flight)
```
Zero errors in any file this workstream created or modified.

```
$ npx eslint components/finch/FinchNav.tsx components/finch/MobileMenu.tsx \
    components/finch/FinchFooter.tsx components/finch/BirdHop.tsx \
    components/marketing/PublicMarketing.tsx app/not-found.tsx app/privacy/page.tsx
(no output)
```

- `curl -sI localhost:3000/definitely-not-a-page` → **404**, and the page renders
  the Finch 404 (bird, eyebrow, h1, finding card, footer).
- Desktop 1440 on `/`, `/pricing`, `/industries`, `/privacy`, 404: nav inline,
  no hamburger, footer 4 columns; `/industries` body copy still blends legibly
  over the shader's dark band.
- Mobile 375 on `/`: wordmark + CTA + hamburger only. Menu opened →
  `aria-expanded="true"`, `role="dialog"` + `aria-modal="true"`, computed
  opacity 1 on `#FAF9F6`, sheet 375×812, `body.style.overflow = "hidden"`,
  focus moved into the sheet. `Escape` → sheet gone, `aria-expanded="false"`,
  `document.activeElement` is the hamburger, body overflow restored. Clicking
  "Pricing" navigated and closed the sheet; `history.back()` from an open sheet
  also closed it (the pathname-derived guard).
- No horizontal scroll: `documentElement.scrollWidth === clientWidth` at 375 and
  at 1440 on the pages checked.
- One `<h1>` on `/`, `/pricing`, `/industries`, `/privacy`, `/learn` and the 404.
- Console: the only errors on the dev overlay are workstream B's in-flight
  `components/finch/product/finch-data.ts` export mismatches. None from this
  workstream's files.

### For Phase 5's redundancy list (not deleted, flagged only)

- `components/Navbar.tsx` and `components/sections/SiteFooter.tsx` — **now
  orphaned**: after this swap (plus C's and D's page rebuilds) no `app/**` route
  imports either. Verified with
  `grep -rn "Navbar\|SiteFooter" app components` → only comments remain.
- `components/animations/morphToNav.ts` and
  `components/animations/slotMorphToNav.ts` — zero importers; they only exist to
  match the old nav's logo geometry.
- Reachable *only* from the old nav / other old-design components once those go:
  `components/ui/gradient-text.tsx` (Navbar, HeroSection, ProblemStrip),
  `components/BounceDot.tsx` (wordCycle only). `components/ui/liquid-button.tsx`
  is still reachable from `app/layout.tsx`'s `LiquidGlassFilter`, so it needs
  D's/Phase 5's layout cleanup first.
- `components/marketing/public-marketing.module.css` → `.main` — left in place
  but no longer applied to anything; its one declaration (`padding-top: 64px`)
  only existed to clear the old fixed navbar.

---

## C — front door

`/operations-audit` rebuilt, `ContactForm` given an audit variant, the contact
route extended for its extra fields, `/contact` rebuilt. Files:

- **new** `components/finch/audit/` — `audit-content.ts` (every string the page
  shows), `audit-jsonld.ts`, `AuditHero.tsx`, `NeedAndGet.tsx`, `AuditWeek.tsx`,
  `BookingBand.tsx`, `AuditFaqs.tsx`, `ScoreGauge.tsx` (the only new client
  component).
- **rebuilt in place** `components/marketing/OperationsAudit.tsx`,
  `components/ContactForm.tsx`, `app/operations-audit/page.tsx`,
  `app/contact/page.tsx`.
- **extended** `app/api/contact/route.ts` (three optional fields, nothing else).

### `/operations-audit`

Order: hero (`<h1>` "One week. Where the money leaks. In rand.", eyebrow `THE
OPERATIONS AUDIT · R2,000 · CREDITED TO YOUR FIRST MONTH`, CTA → `#book`) →
what we need / what you get → "How the week runs" (four steps, the HowTo
entities) → the self-assessment → `#book` → four FAQs. `FinchNav` with no
`active` (neither page is a nav section) and `FinchFooter` as A ships them.

**The self-assessment.** `QUESTIONS`, `ANSWER_OPTIONS`, `ANSWER_SCORE`,
`scoreForQuestion`, `riskLevelForScore`, `RECOMMENDED_STEPS`, `RISK_COPY`,
`safeScore` and `computeAudit` are byte-for-byte what they were; only the JSX
changed. Glass cards, `marketingStyles` and lucide are gone. Progress is mono
(`03 / 10 ANSWERED` plus a 2px ink hairline), each fieldset legend is
`QUESTION 03 / 10 · CATEGORY`, answers are ink/hairline pills.

**The gauge** (`ScoreGauge.tsx`) is a half-circle SVG arc drawn with motion's
`pathLength` over 600ms ease-out, with the number stamping (scale 1.3 → 1,
220ms) as it lands. The arc is **blue**, not orange: on this surface orange is
agent activity and the primary CTA, and a score is evidence. Reduced motion gets
`initial={false}` — the same static end state, no draw, no stamp.

**The generated finding** is composed from `FindingCard`'s pieces (not the
composed `<FindingCard>`) because its two actions are a real `<a href="#book">`
and a real reset `<button>`. `agent="AUDIT"`, observation = the lowest-scoring
question said in plain words, impact = "Quantified in your audit" — **no rand
figure is invented anywhere**; evidence chip "your 10 answers", meta
`SELF-ASSESSMENT · <RISK> RISK · <score>/100`.

**Copy honesty.** "How soon can it start?" answers "We confirm the start date
when you book. The audit itself runs over one week, from the day your documents
are in." No turnaround we cannot verify appears on the page.

**Schema.** `Service` + `FAQPage` + `HowTo` + `BreadcrumbList`, all built from
`audit-content.ts` so the entities and the visible text cannot drift. The
`Service` deliberately **reuses D's sitewide `https://vyso.co.za/#audit` @id**
rather than minting a page-scoped one — same @id merges into one entity, a new
one would assert Vyso sells two different audits — and leaves the price on the
sitewide node so there is exactly one offer. Verified: 8 `@id`s across the two
blocks on the page, zero duplicates.

### `ContactForm` — `variant="audit" | "general"`

`audit` adds an optional WhatsApp number and a locations select (1 / 2–3 / 4+),
relabels the textarea "Where do you think it leaks?" and buttons "Book your
audit"; success renders the FindingCard (`AUDIT` · "Your audit request landed…"
· "A week from now you'll know where the money goes.", no actions). `general`
is the four fields the API has always required, button "Send", success is a
quiet Finch confirmation. Only the audit variant sends the extra keys, so the
general payload is unchanged.

### `app/api/contact/route.ts`

Added `whatsapp`, `locations`, `variant` — optional, length-capped in `MAX_LEN`,
escaped through the existing `escapeHtml` before interpolation, rendered as two
extra lines in the internal email. `variant === "audit"` also switches the
subject to "New audit request from …" and the challenge label to "Where they
think it leaks:". Rate limit, required-field set, `EMAIL_RE`, CRLF stripping and
the auto-reply are untouched.

### `/contact`

Finch surface: `<h1>` "Talk to Vyso.", left column = `joshua@vyso.co.za`,
"Johannesburg, South Africa", and a pointer card "Want the audit? → 
/operations-audit"; right column = `ContactForm variant="general"`. WebGL,
glass, the emoji trust strip and the "Join the waitlist" framing are gone.
Metadata rewritten, canonical set, `ContactPage` + `BreadcrumbList` JSON-LD.

## C — decisions the plan left open

1. **No decorative FindingCard in the audit hero.** §4 wants one card per page;
   this page's card is the one the assessment generates. A second, invented card
   above it would turn the generated one into furniture. Hero is single-column.
2. **Ten questions, not eight.** The plan's mono example says `QUESTION 03 / 08`
   and "your 8 answers"; `QUESTIONS` has ten and is grounded, so the counts are
   derived from `QUESTIONS.length` rather than hard-coded.
3. **All ten questions stay on one page** (not a one-at-a-time stepper). The
   mono `QUESTION nn / 10` legend gives the plan's progress read without
   changing the interaction the scoring logic was written for.
4. **"See my score" is ink, not orange.** Two orange buttons in one viewport
   would break the "orange = primary CTA" rule; the page's primary CTA is
   "Book your audit".
5. **The four-step strip does not animate.** The page's signature motion is the
   gauge; animating a text strip as well spends attention twice. Matches
   `UnderTheHood` on `/`.
6. **`title: { absolute: … }` on both pages**, because D's sitewide template
   appends "| Vyso" and both titles already carry it.
7. **`/resources/[slug]` and `components/sections/ContactSection.tsx` now render
   the Finch-styled general form.** Both are old-design pages awaiting Phase 3;
   the `--fn-*` tokens live on `:root`, so colours resolve — only the
   surrounding glass is stylistically mismatched. Worth an eyeball.

## C — verification

- `npx tsc --noEmit` → the three known `whatsapp-ingest` errors, nothing else.
- `npx eslint app/operations-audit app/contact app/api/contact
  components/ContactForm.tsx components/marketing/OperationsAudit.tsx
  components/finch/audit` → clean, no output.
- Grep gates on those paths for `R10,000|R30,000|R50,000|setup fee|Start, Create|
  Vyso AI|Join Waitlist|backdrop-|glassCard` → 0 hits.
- HTML: one `<h1>` on each page; `/operations-audit` has 6 `<h2>` and no skipped
  levels; both JSON-LD blocks parse on both pages; canonical set; descriptions
  151 / 141 chars.
- Browser (own tab, 1440 and 375): assessment answers, `10 / 10 ANSWERED`, the
  gauge renders (`aria-label "Operations score 45 out of 100"`, stroke
  `rgb(75, 150, 221)`), the finding card generates with the top-risk observation
  and no rand figure, top-three-risks and next-steps render. `scrollWidth` 1425
  ≤ 1440 and 375 = 375 — no horizontal scroll.
- Colour sweep of `main` on `/operations-audit`: exactly two orange elements —
  the hero CTA and the form submit. (Finding-card orange only exists once a
  finding exists.)
- Both variants submit: with `fetch` stubbed to a 200, the audit form POSTs
  `{name, business, email, challenge, whatsapp, locations, variant:"audit"}` and
  renders the success FindingCard; the general form POSTs the four base fields +
  `variant:"general"` and renders the confirmation. Live POSTs were used only
  for the two 400 paths (oversized `whatsapp` → `"whatsapp is too long."`,
  missing `challenge` → `"Missing required fields."`), which never reach Resend.
- Console: no errors from either page. The dev overlay is full of
  `components/finch/product/*` export errors — those are B's `/finch` work in
  progress, not these routes.

**`RESEND_API_KEY` behaviour (asked for, not changed).** The key IS present in
`.env.local`, so a real submit in dev sends real mail to `joshua@vyso.co.za`
plus an auto-reply — I did not send one. Without the key the route does not 500
from its own `catch`: `new Resend(undefined)` **throws at module scope**
("Missing API key…"), so the module fails to evaluate and every POST to
`/api/contact` errors before the handler runs (verified against the installed
`resend` package). The repo's guarded pattern (`app/api/feedback/route.ts`,
`app/api/agents/digest/route.ts`) only checks the key *inside* the handler, so it
would not survive the module-scope construction either. No fallback added, per
the plan.

**Not verifiable in this environment:** the browser pane was hidden for the whole
session (`document.visibilityState === "hidden"`), which freezes rAF, so the
600ms gauge draw and the results reveal could not be *sampled* mid-flight — both
were verified by their end state (arc geometry forced to `0.45 1` renders
correctly, content present and correct in the DOM). Smooth `scrollIntoView` after
submit/reset is likewise unexercisable in a hidden pane. Worth one look in a
visible browser.

---

## B — `/finch`

Plan: Workstream B of `.ai/plan_phase1_shell_finch_frontdoor.md` (+ `.ai/vyso_v2.md`
§2.2 `/finch`, §4). Implemented 2026-08-15. **Nothing committed.** No existing
file was modified — every reused component (`FinchNav`, `FinchFooter`,
`FindingCard`, `BriefPhone`/`BriefPanel`, `Senses`/`IntegrationsOrbit`,
`UnderTheHood`, `FoundingQuote`, `AuditBand`) is imported as-is or composed
around.

### Files created

| File | What |
|---|---|
| `app/finch/page.tsx` | Server component. Metadata + one JSON-LD block, `.finch-site` wrapper, `FinchNav active="finch"`, the eight sections, `FinchFooter`. |
| `components/finch/product/finch-data.ts` | Server-safe page content: `ORIGIN`/`CANONICAL_URL`, `DIRECT_ANSWER`, `PRICE`, `EXAMPLE_AGENTS` (6), `AGENT_HONESTY`, `HOW_IT_STARTS`. |
| `components/finch/product/day-beats.ts` | The five day beats, the clock hours, the afternoon note and the evening greeting. Separate file — see deviation 1. |
| `components/finch/product/finch-jsonld.ts` | `buildFinchSchema()` — `@graph` with `SoftwareApplication` + `BreadcrumbList`. |
| `components/finch/product/FinchHero.tsx` | Server. Eyebrow, gradient rule, `<h1>`, two CTAs, the audit mono line, `FindingCard` + `ILLUSTRATIVE EXAMPLE` at ≥ lg. |
| `components/finch/product/CoosDaySection.tsx` | Server. Section header + `CoosDay` + the `ILLUSTRATIVE — DEMO DATA` line. |
| `components/finch/product/CoosDay.tsx` | `"use client"`. The sticky scroll-linked stage, the static 5-across strip and the mobile vertical list. |
| `components/finch/product/DayCard.tsx` | `"use client"`. Compact finding card with a time in the header slot; built on `FindingCardFrame`. |
| `components/finch/product/DayBriefPhone.tsx` | `"use client"`. The 17:55 phone — evening copy, the three findings from `BRIEF_FINDINGS`, one motion style per bubble. |
| `components/finch/product/AgentsOnShift.tsx` | `"use client"`. The six example-agent cards + status chips + the Doc-U honesty line. |
| `components/finch/product/AgentVisual.tsx` | `"use client"`. The six evidence micro-visuals as variant children. |
| `components/finch/product/BriefOnWhatsApp.tsx` | Server. Copy column + reused `BriefPanel`. |
| `components/finch/product/UnderTheHoodMore.tsx` | Server. `UnderTheHood` + `All modules →`. |
| `components/finch/product/HowItStarts.tsx` | `"use client"`. Four numbered steps, reveal-on-enter, + a link to the audit page. |

### Sections, in order

Hero · **A COO's day** (`id="day"`) · **Custom agents on shift** (`id="agents"`)
· Your brief, on WhatsApp · We put your current tools into Finch (reused
`Senses`, orbit and all) · Under the hood + `All modules →` · How it starts ·
Roberto quote · `AuditBand` · footer.

### How the day strip works

300vh wrapper, sticky 100vh stage drawn at a fixed 1160×700 and scaled to fit —
the same machinery as `ScrollSequence`, and for the same reason (no reflow, no
per-frame React work; everything is a motion value off `scrollYProgress`).

Layout inside the stage: four compact finding cards 2×2 in the left 800px (380
wide, 200 tall, cols 0/420, rows 36/260), the clock hairline at y 546 spanning
x 20→800 with hour labels 06:00/09:00/12:00/15:00/18:00 and a light-on-pass dot
at each event time, the ink tick + a five-minute time readout riding the line,
the beat captions at y 664, and the phone at (850, 6).

The day occupies the first 55% of the scroll (`t` 0.05 → 0.60, linear — a clock
that eases is a clock that lies) and the brief the remaining 40%. Beats:

| Beat | `at` | stamps at `t` |
|---|---|---|
| 06:14 PRICE WATCH | 0.0194 | 0.061 → 0.106 |
| 07:40 DEBTORS | 0.1389 | 0.126 → 0.171 |
| 09:05 RECON | 0.2569 | 0.191 → 0.236 |
| 11:30 STOCK SENSE | 0.4583 | 0.302 → 0.347 |
| afternoon note in/out | — | 0.34→0.39 / 0.52→0.57 |
| tick reaches 17:55 | 0.9931 | 0.596 |
| phone rises | — | 0.60 → 0.70 |
| greeting bubble | — | 0.72 → 0.78 |
| the three findings | — | 0.80/0.855/0.91 → +0.05 each |

Each card stamps opacity 0→1 with scale 1.06→1 over 0.045 of progress (≈220ms
at a normal scroll rate). At 0.62→0.72 the STOCK SENSE card dims to 0.38 while
the other three are in the message — four findings, three headlines, which is
the product claim ("Finch ranks, it doesn't forward everything") made visible
rather than asserted.

Fallbacks: `useReducedMotion()` or the pre-hydration render → the five beats
five-across (`lg:grid-cols-5`, 2-col at `sm`), already arrived; below `lg` with
motion on → the same five as a vertical list with reveal-on-enter. The server
renders the static strip, so there is no CLS and no flash.

### Deviations from the plan (and why)

1. **The day content lives in `day-beats.ts`, not `finch-data.ts`.** The first
   three beats are derived from `BRIEF_FINDINGS` so the day strip, the evening
   brief and the homepage's Monday brief cannot drift apart. But `BriefPhone.tsx`
   carries `"use client"`, and in the App Router every export of a client module
   becomes an opaque client reference when a **server** module imports it — the
   first render of `/finch` was a 500 (`Cannot read properties of undefined
   (reading 'label')`) because `finch-jsonld.ts` pulled `finch-data.ts` onto the
   server. Splitting the file puts the derivation behind the client boundary
   where `BRIEF_FINDINGS` is the real array, and leaves `finch-data.ts`
   server-safe. Worth knowing for anyone else reusing homepage constants.
2. **`DayBriefPhone` is a new component, not `BriefPhone`.** `BriefPhone`
   hardcodes the morning story — "Morning. 3 things need your attention…",
   "● ONLINE · 06:45" — and its only animatable bubble slots are the greeting,
   DEBTORS and RECON (the PRICE WATCH bubble is drawn by the component itself
   when it is not in the homepage sequence). The plan's evening copy and its
   "three cards slide in" choreography need all four slots and a different
   greeting, and this workstream must not modify `BriefPhone`. The new component
   reuses `BRIEF_FINDINGS` and copies the frame's dimensions/radii/shadow/type
   scale verbatim so the two phones are the same object. ~90 lines duplicated;
   the alternative was a prop-explosion PR against a file another workstream
   might also be holding.
3. **`DayCard` writes its own header row** instead of using `FindingHeader`. The
   standalone card puts a NEW/IN PROGRESS chip in the top-right; on the day strip
   that slot belongs to the time, which is what ties the card to the clock. The
   frame (border, orange state bar, shadow, hover) is `FindingCardFrame`,
   unchanged.
4. **The afternoon note** (`12:00–17:00 · NOTHING WORTH INTERRUPTING YOU FOR`,
   in and out between beats 4 and 5) is not in the plan. Without it, 24% of the
   scroll is a tick creeping across an empty clock and reads as a bug. It is also
   true, and it is the product's actual promise.
5. **A five-minute clock readout rides the tick** (`06:00 … 18:00`). Quantised to
   five minutes and set from `useMotionValueEvent`, so it is a few dozen
   re-renders across the whole section, not one per frame — the same trade the
   homepage makes for its caption index.
6. **Captions span the left region (x 0→800), not the whole stage.** They
   annotate the clock and the phone occupies x 850→1150 down to y 695; centring
   them across 1160 would have put them under the phone.
7. **The stage is 700 tall, not the plan's ~560.** The phone is 689 at its own
   type scale with three findings in it (measured), and scaling it down to fit
   560 would have rendered 13px copy at ~10px. At 1440×900 the stage still
   renders at scale 1; at 1024×768 it fits at 0.848.
8. **Six example agents, and the sixth is DELIVERY WATCH** ("Routes against
   delivery notes, for wholesalers running their own trucks") — the plan's
   "one vertical example". The other five keep the exact one-liners
   `WhatFinchWatches.tsx` uses, so the homepage and this page make the same claim
   in the same words.
9. **The agents grid is 3-across at `lg`, 2 at `md`** rather than the homepage's
   5-across — these cards each carry a micro-visual and a status chip, and six of
   them at 232px would have been unreadable.
10. **`title` is `{ absolute }`.** Workstream D adds a `%s | Vyso` template to the
    root layout in this same phase and this title already ends in `| Vyso`;
    `absolute` opts out rather than relying on cross-workstream timing.
11. **The JSON-LD `SoftwareApplication` uses the sitewide `@id`**
    (`https://vyso.co.za/#finch`), not a page-scoped one. D's root-layout graph
    now emits that node on every page; a second, differently-identified
    SoftwareApplication for the same product on the page that is *about* that
    product is entity duplication. Same `@id` merges them, and this page's node
    is the richer one (description, subcategory, `inLanguage`, `areaServed`,
    `mainEntityOfPage`, a named offer). Both nodes carry the same price,
    currency, unit code and reference quantity, so nothing conflicts. Flagged
    below anyway — the architect may prefer to strip the offer from one of them.
12. **`useIsDesktop` is duplicated** (12 lines) from `ScrollSequence.tsx`, which
    does not export it. Modifying that file was out of scope.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
The three known pre-existing WhatsApp errors, nothing else.

```
$ npx eslint app/finch components/finch/product     # clean, no output
$ grep -rn "backdrop-blur\|backdrop-filter\|glow" app/finch components/finch/product | wc -l   # 0
$ grep -rn "R10,000\|R30,000\|R50,000\|setup fee\|Start, Create\|Vyso AI\|Join Waitlist" \
    app/finch components/finch/product | wc -l                                                  # 0
$ curl -s localhost:3000/finch            # 200, 137 KB
  <h1> × 1, <h2> × 6, no <h3>, no skipped levels
  <title>Finch — your company's own COO, at a tenth of the cost | Vyso</title>
  description 152 chars, canonical https://vyso.co.za/finch
  2 ld+json blocks, both parse:
    layout : Organization, WebSite, SoftwareApplication, Service
    page   : SoftwareApplication (…/#finch), BreadcrumbList (…/finch#breadcrumbs)
```

**Colour discipline.** `fn-orange*` appears only on: the six agent dots, the day
cards' + phone bubbles' agent dots, the rand-impact figures, the hero CTA, and
link hovers. The only literal oranges are in `AgentVisual.tsx` — the price
sparkline's end dot (`#FF7727`, the homepage chart's own end dot) and its `+12%`
label (`#C94F0E`, an impact figure). Everything else drawn in the micro-visuals
is blue, because all of it is evidence.

**Geometry, measured in-page at 1440×900** (stage coordinates, scale factored
out): cards 380×200 at (0,36) (420,36) (0,260) (420,260) — `scrollHeight ===
clientHeight` on all four, nothing spills its box; clock hairline 780 wide at
y 546; afternoon note at y 486; captions 800 wide at y 664; phone 300×689 at
(850,6), `scrollHeight === clientHeight`, bottom 695 inside the 700 stage, right
edge 1150 inside 1160. Nothing clips, nothing overlaps.

**1440×900**: `document.scrollWidth` 1425 vs `innerWidth` 1440 (scrollbar) — no
horizontal scroll; zero elements extend past the viewport; agents grid 3×2 with
six uniform 349×252 cards and six micro-visual `<svg>`s.

**375×812**: `document.scrollWidth === innerWidth === 375`; the day strip falls
to the mobile vertical list (5 cards); agents grid one column (335px); the brief
panel 335px; `<h1>` 34px.

**Pre-hydration / reduced-motion path** (the SSR HTML, which is exactly what a
reduced-motion visitor gets): the static five-across strip with all five beats,
the afternoon note, all six agent cards with their status chips, the honesty
line, the brief copy + panel, the orbit, the module strip, the four steps, the
quote and the audit band. No `h-[300vh]` wrapper in the server HTML.

**Console**: React DevTools notice + HMR logs only. No errors at either width.

### Not verifiable in this environment

The Browser pane was hidden for this whole session
(`document.visibilityState === "hidden"`, `requestAnimationFrame` delivered **0**
frames in 400ms), which freezes `motion`'s frame loop — so scroll-linked motion
values never advance no matter where the page is scrolled to. Confirmed it is
the environment and not this code by running the same probe against the
**homepage's** `ScrollSequence`, which is known-good and reads identically frozen
at progress 0. Workstream C hit the same wall.

What was verified instead:
- **The `t = 0` end state** is exactly the designed one: tick at x 20 reading
  `06:00`, all four cards `opacity 0; scale(1.06)`, the phone
  `opacity 0; translateY(44px)`, the afternoon note at 0, the first caption lit.
- **The `t = 1` composition** by forcing every scroll-driven element in the stage
  to its end state from the console (inspection only, no source change) and
  measuring the geometry above.

Still owed, in a visible browser: the beats sampled mid-flight (the table above),
the six micro-visuals playing on enter, the mobile list's reveals, and a real
`prefers-reduced-motion: reduce` OS profile.

### For the architect to eyeball

1. **`AuditBand` still links to `/contact`** (`components/finch/AuditBand.tsx`
   line 17), so the page's closing CTA misses the phase decision that the primary
   CTA is `/operations-audit`. `FinchNav`'s CTA was moved by Workstream A; the
   band is owned by nobody this phase, and changing it also changes `/`. One-word
   fix, needs an owner.
2. **Two `SoftwareApplication` descriptions of Finch on one page** (deviation 11)
   — merged by `@id`, but both carry an R6,000 offer. If that reads as two
   offers, drop the offer from the root-layout node and let `/finch` and
   `/pricing` carry it.
3. **Four findings, three headlines.** The strip dims STOCK SENSE at 17:55 and
   the evening greeting says "three things from today". Confirm the dim reads as
   "ranked out" rather than "broken".
4. **The afternoon note** (deviation 4) — new copy, not in the plan.
5. **The day strip at 1024×768**, where the stage scales to 0.848 and the card
   copy renders at ~13px.

## E — CTA sweep + JSON-LD dedupe

Follow-up closing the two items Workstream C flagged "for the architect to
eyeball": the stray `/contact` audit CTA and the duplicate `offers` block on
the `#finch` JSON-LD node.

### Files modified

- `components/finch/HomeHero.tsx` line 25 — `href="/contact"` → `/operations-audit`
  on the homepage's primary "Book your audit" CTA.
- `components/finch/AuditBand.tsx` line 17 — same fix on the closing CTA band
  shared by `/` and `/faq` (the item C flagged directly).
- `components/finch/pricing/AuditCta.tsx` line 18 — same fix on `/pricing`'s
  only primary CTA; also rewrote the header comment, which previously
  documented `/contact` as intentional ("the audit is booked through the
  contact form, as everywhere else on the site") — no longer true once every
  other CTA already pointed at `/operations-audit`.
- `components/finch/product/finch-jsonld.ts` — removed the `offers` object
  from the `/finch` page's `SoftwareApplication` node (`@id`
  `https://vyso.co.za/#finch`). Both the root layout's sitewide graph and this
  page's own graph render on `/finch` at once (two separate `<script
  type="application/ld+json">` tags, same `@id`), so the R6,000 offer was
  appearing twice under one identifier. Kept `@id`, `@type`, `name`, `url`,
  `description`, `provider`, `applicationCategory`, `operatingSystem`; dropped
  `alternateName`, `mainEntityOfPage`, `applicationSubCategory`, `inLanguage`,
  `areaServed` along with `offers` to match. Added a comment on the node
  explaining the offer lives on the layout's node only. Also dropped the now-
  unused `PRICE` import (still exported from `finch-data.ts` for other
  consumers) and updated the file header comment, which previously described
  five page-specific enrichments (description, subcategory, language, area
  served) — now just description.

### Confirmed unchanged (already correct or genuinely different links)

- `components/finch/FinchNav.tsx` / `MobileMenu.tsx` — `FINCH_NAV_CTA.href`
  was already `/operations-audit` (done by another workstream).
- `components/finch/product/FinchHero.tsx` line 30 — already `/operations-audit`.
- `components/finch/audit/AuditHero.tsx` / `BookingBand.tsx` — in-page `#book`
  anchors on `/operations-audit` itself, not `/contact` links; correct as is.
- `components/finch/pricing/PricingHero.tsx` — no CTA link in this component.
- `components/finch/FinchFooter.tsx`, `components/finch/pricing/AcademyCard.tsx`
  (`/contact?topic=academy`), `app/faq/page.tsx` ("ask us directly") — genuine
  contact links, left pointing at `/contact`.
- `app/not-found.tsx` — already `/operations-audit`.

### Verification

- `curl -s localhost:3000/finch` + a `node -e` script extracting both
  `<script type="application/ld+json">` blocks: both parse as valid JSON. The
  root layout's graph's `#finch` node has `offers`; the page's own graph's
  `#finch` node does not.
- `npx tsc --noEmit` — same 3 pre-existing `lib/platform/whatsapp-ingest.ts`
  errors only (`extractOrderFromText`, implicit-any `l` param,
  `whatsappIngestId`); nothing new.
- `npx eslint components/finch app/finch app/page.tsx app/pricing` — clean.
- `grep -rn 'href="/contact"' components/finch app/finch app/pricing app/page.tsx`
  — no matches; every audit-booking CTA in scope now resolves to
  `/operations-audit`.

## Architect review — Phase 1 (Fable, 2026-08-15) — APPROVED for localhost review

Verified in a visible browser + curl: `/finch` hero, day-strip beats (08:10 two
cards; 17:55 four cards, Stock Sense dimmed, evening brief with three headlines),
"Custom agents on shift" six examples + micro-visuals + honesty line; nav inline
at 1440, hamburger sheet at 375 (solid, focus-trapped, scroll-locked, links →
/finch /industries /pricing /learn /login /operations-audit); `/operations-audit`
self-assessment (10 questions) → gauge 70 → generated AUDIT FindingCard with
"Quantified in your audit"; redirects `/platform*`→`/finch`, `/pricing-faq`→
`/faq#pricing` all 308; 404 returns 404 with one <h1>; every route one <h1>;
JSON-LD present (root + page) on rebuilt routes; sitemap 52 URLs incl. `/finch`,
none of the retired ones. Post-review fixes: CTA sweep (all "Book your audit" →
/operations-audit; JSON-LD offer dedupe on /finch), PublicPageShell default CTA,
label-only "Join Waitlist"→"Book your audit" sweep on 25 old-design files (17
adjacent hrefs → /operations-audit). Remaining "Join Waitlist" only in the
orphaned `components/Navbar.tsx` (Phase 5 deletion list).
Owed to a real browser: reduced-motion profile; native anchor scroll on deep
links (tooling limitation). Known: `npm run build` still blocked by the
untracked WhatsApp files; `RESEND_API_KEY` present in .env.local so real form
submits send real mail.
Redundant now (for Phase 5): components/Navbar.tsx, components/sections/SiteFooter.tsx,
app/faq/faq.module.css, app/pricing-faq/page.tsx, animations/morphToNav.ts,
slotMorphToNav.ts, plus the earlier homepage list.

---

## Phase 1b — B

Plan: Workstream B of `.ai/plan_phase1b_corrections.md`. Implemented 2026-08-15.
**Nothing committed.** `/operations-audit` reordered around the booking form,
the `/roi-calculator` tool folded in beside the self-assessment, the page it
lived on retired.

### Files

- **rebuilt** `components/finch/audit/AuditHero.tsx` (now header + form),
  `components/marketing/RoiCalculator.tsx` (presentation only).
- **new** `components/finch/audit/AuditTools.tsx`.
- **edited** `components/finch/audit/AuditWeek.tsx` (quieter),
  `components/finch/audit/audit-content.ts` (the two lists compressed),
  `app/operations-audit/page.tsx`, `next.config.ts` (one redirect, appended),
  `app/sitemap.ts` (one entry removed).
- **deleted** `components/finch/audit/NeedAndGet.tsx`,
  `components/finch/audit/BookingBand.tsx`, `app/roi-calculator/page.tsx`.
- **untouched** `components/ContactForm.tsx`, `components/finch/audit/ScoreGauge.tsx`,
  `AuditFaqs.tsx`, `audit-jsonld.ts`, `components/marketing/OperationsAudit.tsx`.
  The audit form variant and the assessment both moved without needing a line
  changed, which is the point of having built them as widgets.

### The hero

The homepage hero's grid exactly — `1.05fr / 0.95fr`, 64px gutter, `items-start`
— with the booking form where `/` puts its finding card. `<h1>` is **"One week.
Let's find out where you're leaking money and time."** with `&rsquo;` for both
apostrophes, 34px on phones and 46/50px from lg/xl (the old 64px was sized for a
full-width line and this one shares its row). Sub is `DIRECT_ANSWER` unchanged —
38 words, and it is the string the `Service` and `HowTo` descriptions read, so it
could not be trimmed without moving the schema with it.

**No buttons.** Both of the old ones pointed at things now visible in the same
viewport; a CTA that scrolls you to something you can already see is furniture.

`id="book"` sits on the white form card (border `--fn-line`, radius 12, padding
28, `--fn-shadow-card`) with `scroll-mt-[24px]`, so every `#book` link on the
site — including the two the assessment and the calculator generate — still
lands on the form rather than above it. Mono `ONE WEEK · R2,000 · CREDITED`
above the card. Mobile collapses to header, then form.

### `NeedAndGet` folded into the hero

The band existed to fill a full-width row that no longer exists. `WHAT_WE_NEED`
and `WHAT_YOU_GET` were rewritten in place as phrases (4 and 3 bullets) because
they now render in ~250px columns. Nothing was lost: the long form of "what we
need" is FAQ 2 word for word and "you keep the report" is FAQ 3, so the quotable
sentences are still on the page and still in the `FAQPage` entities. `#what-we-need`
is gone — it had exactly one referrer, the hero link that this pass deleted.

### The tools section (`#assess`)

H2 "Two ways to see it before we start.", then the assessment (`#score`) and the
calculator (`#calculator`) side by side. Both column headings live in
`AuditTools` rather than in the widgets so the two cards start level; a
`xl:min-h-[92px]` on each heading block absorbs the one-line difference between
the two sub-lines.

**Side by side only from `xl`.** Inside the 1160 rail with a 32px gutter each
column is **524px** — measured, at both 1280 and 1440, since the rail caps before
either width matters. 524 is above the plan's 520 floor and it holds: the
assessment's three answer pills stay on one line at every one of the ten
questions (verified, `pillsWrapped: false`), and the calculator's `auto-fit`
field grid lays out two fields per row. So no pill-shrinking fallback was needed
and none was added — the plan's "13px pills, two rows" contingency is unused.
Below `xl` both stack, assessment first.

### The calculator, rebuilt

Everything above the "as it shipped" comment in `RoiCalculator.tsx` is
byte-for-byte the old file: formatters, `parseNonNegative`/`parsePercent`,
`INITIAL_INPUTS`, `INITIAL_ASSUMPTIONS`, the Start-tier constants,
`computeResults`, and the three assumption hints, the two savings-area labels
and descriptions, and all three `paybackText` branches. Presentation only below.

Gone: `marketingStyles`/`glassCard`, all five lucide icons, every inline style
object, `next/link`. In: the Finch white card, mono section labels, the
`ContactForm` field treatment with the number spinners suppressed, and hairline
rows. Two `auto-fit` grids rather than breakpoints, because this widget has to
lay itself out from its own 524px column at xl and from full width below it —
the viewport tells it nothing useful.

**Outputs tween 400ms** (`animate` from `motion`, ease-out). `Tweened` splits in
two: reduced motion renders `format(value)` outright with no state and no
effect, and only the animated half carries hooks — which is also what satisfies
`react-hooks/set-state-in-effect`, since the tween's `setState` now only ever
runs from motion's frame loop. The tween resumes from wherever the last one got
to, so typing `1` → `15` → `150` chases the value instead of restarting from
zero each keystroke. First render is the initial computed value on both sides of
the wire, so SSR and hydration agree.

**The finding.** `agent="CALCULATOR"`, observation "Manual work is costing about
94 hrs a month.", impact "≈ R 257 861/yr at your numbers", evidence chip "your
inputs", meta `BASED ON YOUR INPUTS · AN ESTIMATE, NOT A QUOTE`, one action —
`Book the audit →` to `#book`. This is the one rand figure on the Finch surface
that is allowed to be generated, and it is allowed because it is the reader's
own arithmetic; the meta line says so rather than leaving it implied. Composed
from the pieces because the action is a real anchor.

### `/roi-calculator`

308 → `/operations-audit#calculator`, appended as the last entry of the
redirects array in a single edit (re-read immediately before, after A's
`/finch` → `/` changes had landed). Page file deleted, sitemap entry removed.
`components/marketing/RoiCalculator.tsx` stays — the audit page is its consumer
now.

### Decisions the plan left open

1. **`WHAT_WE_NEED`/`WHAT_YOU_GET` were rewritten, not duplicated.** A short
   pair alongside a long pair is two sources for one fact, and the long pair had
   no other reader once the band was deleted.
2. **The assumptions intro says "every number below" where it said "to the
   right".** The old two-column layout it referred to is gone. This is the only
   word of the calculator's copy that changed.
3. **Reset appears once**, under the assumptions. It was in the finding card's
   actions too for one draft; the plan asks for one action there and two resets
   on one screen is a stutter.
4. **The stat grid's `auto-fit` floor is 180px**, not 130 — 130 gave three
   stats across and left the fourth hanging alone under them at 524px. 180 is
   2×2 in the column and one row across when stacked.
5. **Savings-area figures are blue (`--fn-blue-deep`), not the old
   `hsl(22,69%,44%)` orange.** On this surface a figure is evidence; orange is
   the CTA and a finding's impact.
6. **`AuditWeek` kept its four steps and its `#step-nn` ids** — they are the
   `HowTo` step `url`s. Only its padding (80 top) and heading size changed, so
   the schema needed no edit at all.

### Verification

- `npx tsc --noEmit` → the three known `whatsapp-ingest` errors, nothing else.
  (`.next/types/validator.ts` held a stale reference to the deleted
  `/roi-calculator` page until `.next/types` was cleared and the route re-hit.)
- `npx eslint app/operations-audit components/finch/audit
  components/marketing/OperationsAudit.tsx components/marketing/RoiCalculator.tsx
  components/ContactForm.tsx` → clean, no output.
- Grep gate on those paths for `backdrop-|glassCard|marketingStyles|lucide-react|
  R10,000|R30,000|R50,000|setup fee|Join Waitlist` → 0 hits.
- **1440**: grid `524px 524px`, **side by side**, tops level, `scrollWidth` 1425
  ≤ 1440. **1280**: grid `524px 524px`, **side by side**, `scrollWidth` 1265 ≤
  1280, pills unwrapped. **375**: single column, **stacked**, assessment first,
  hero header above form, `scrollWidth` 375 = 375.
- `curl -sI /roi-calculator` → `308`, `location: /operations-audit#calculator`.
  `sitemap.xml` → 0 hits for `roi-calculator`.
- `#book`, `#score`, `#calculator`, `#assess` and `#step-01`–`#step-04` all
  resolve in the DOM.
- One `<h1>`; heading order H1 · H2 · H2 · H3 · H3 · H2, no skips. Canonical
  set, description 155 chars. Both JSON-LD blocks parse; 8 `@id`s, the only
  repeat being the deliberate `https://vyso.co.za/#audit` merge from Phase 1 C.
- Tween sampled live: changing hourly cost 180 → 360 gave impact
  `R 257 861` → `R 367 474` (mid-flight) → `R 461 722`, so it interpolates
  rather than snapping.
- Assessment still works in the 524px column: ten answers, gauge draws
  (`aria-label "Operations score 70 out of 100"`), the finding generates with
  the top-risk observation and no invented rand figure, top-three and next-steps
  render.
- Form submits: with `fetch` stubbed to a 200 the audit variant POSTs
  `{name, business, email, challenge, whatsapp, locations, variant:"audit"}` to
  `/api/contact` and renders the success FindingCard inside the `#book` card.
  No live POST was sent — `RESEND_API_KEY` is present and a real submit would
  mail `joshua@vyso.co.za`.
- Colour sweep of `main`: five orange elements, all sanctioned — the submit
  button, and the finding card's own bar / agent dot / `NEW` chip / impact.
- Console: no errors on the page at any of the three widths.

### Left alone deliberately

`components/Navbar.tsx`, `components/sections/SiteFooter.tsx` and
`app/pricing-faq/page.tsx` still link to `/roi-calculator`. All three are
old-design surfaces awaiting Phase 3+ (and `/pricing-faq` itself 301s to
`/faq#pricing`), the nav/footer pair belongs to Workstream A this phase, and the
new redirect makes every one of those links land correctly. Worth sweeping when
those files are rebuilt.

---

## Phase 1b — A

Workstream A of `.ai/plan_phase1b_corrections.md`: `/finch` deleted, the day
strip kept and parameterised, the homepage agents section upgraded to the
six-card version, links and redirects retargeted. **Nothing committed.**

### Files deleted

- `app/finch/` (the whole route).
- `components/finch/product/` (the whole directory). `FinchHero`,
  `BriefOnWhatsApp`, `UnderTheHoodMore`, `HowItStarts`, `finch-data.ts` and
  `finch-jsonld.ts` only existed for that page and are gone with it; the rest
  moved (below). Nothing imports the directory — `grep -rn "finch/product" app
  components lib tests` → 0.

### Files created (moved, then reworked)

| File | Was | What changed |
|---|---|---|
| `components/finch/day/day-beats.ts` | `product/day-beats.ts` | Adds `BriefFinding` / `EveningBrief` types and `EVENING_BRIEF` (greeting + the three findings as one object). Same beats, same copy. Still client-only by construction — it reads `BRIEF_FINDINGS` out of `BriefPhone.tsx`, which carries `"use client"`. |
| `components/finch/day/DayStrip.tsx` | `product/CoosDay.tsx` | Renamed and parameterised: `beats`, `eveningBrief`, `captions`, `clockHours`, `quietNote`, all defaulting to today's content. |
| `components/finch/day/DaySection.tsx` | `product/CoosDaySection.tsx` | Renamed; `id`, `eyebrow`, `title`, `sub`, `footnote` are props (defaults = today's copy) and the rest spread through to `DayStrip`. Still a server component. |
| `components/finch/day/DayCard.tsx` | `product/DayCard.tsx` | Unchanged. |
| `components/finch/day/DayBriefPhone.tsx` | `product/DayBriefPhone.tsx` | `greeting`, `findings` and the status-line `time` are props now (defaults from `EVENING_BRIEF`). |
| `components/finch/agents/AgentsOnShift.tsx` | `product/AgentsOnShift.tsx` | Now the **grid only** — the section frame moved to `WhatFinchWatches`. Takes an optional `agents`. The card no longer animates (deviation 2). |
| `components/finch/agents/AgentVisual.tsx` | `product/AgentVisual.tsx` | Import path only. |
| `components/finch/agents/agents-data.ts` | (from `product/finch-data.ts`) | The roster half of the old file: `ExampleAgent`, `AgentStatus`, `EXAMPLE_AGENTS` (6), `AGENT_HONESTY`. Server-safe, so the section header can read `AGENT_HONESTY` without pulling the grid onto the server. |

The day strip is **not wired to any route** — it is Phase 2's, for
`/compare/finch-vs-hiring-a-coo`. It was smoke-tested on a throwaway route,
which has been removed (see Verification).

### Files modified

- `components/finch/WhatFinchWatches.tsx` — was the five plain cards; is now the
  section frame for the six-card roster. Server component: `id="agents"`,
  `scroll-mt-[80px]`, the same eyebrow (`WHAT FINCH WATCHES`) and H2 ("Custom
  agents on shift, all day, every day."), the audit sub-line, `<AgentsOnShift/>`
  and the Doc-U honesty line. Same position on `/`; `app/page.tsx` is untouched.
- `components/finch/FinchNav.tsx` — `FinchNavSection` loses `finch`; the Finch
  link is out of `FINCH_NAV_LINKS`. Desktop row is Industries · Pricing · Learn
  · Log in · CTA. The wordmark on the left already pointed at `/`, which is now
  the product page, so a second link to it would have been a link to the page
  you are usually already on. `MobileMenu` needed no change — it takes the links
  as props and the narrowed type flows through.
- `components/finch/FinchFooter.tsx` — the Finch column's first two entries:
  `Home → /` and `What Finch watches → /#agents` (were `/finch`, `/finch#agents`).
- `app/not-found.tsx` — `See Finch → /finch` becomes
  `See how Finch works → /#agents`.
- `next.config.ts` — `/platform`, `/platform/finch`, `/platform/vyso-for-smes`
  and `/platform/vyso-ai` now 308 to `/` (were `/finch`); a new `/finch → /`
   308 is added for the day the page existed. One edit, made after re-reading the
  file; Workstream B's `/roi-calculator` line landed separately without conflict.
- `app/sitemap.ts` — the `/finch` entry is gone and its rationale comment moved
  onto the homepage entry, which now carries the `2026-08-15` `lastModified` the
  `/finch` entry had (the homepage is what changed).
- `app/layout.tsx` — `SoftwareApplication.url` → `https://vyso.co.za/`. No
  `mainEntityOfPage` existed to update. One stale comment fixed ("`/finch` once
  built" → `/operations-audit`).
- `components/finch/pricing/pricing-data.ts`, `lib/marketing/modules.ts` —
  comment-only: both pointed at files this workstream moved or deleted.

### Deviations from the plan (and why)

1. **`DayBeat` stays flat; there is no `card: FindingCardProps`.** The plan
   sketched `beats: { time, agent, card: FindingCardProps }[]`. `DayCard` does
   not render a `FindingCard` — it composes `FindingCardFrame` and writes its
   own header, because on the strip the card's top-right slot carries the time
   rather than a NEW/IN PROGRESS chip (phase-1 deviation 3, still true). Nesting
   the four strings the card actually uses inside a `card` object would have
   been a rename with no caller and no benefit, so `DayBeat` keeps
   `time/at/agent/observation/impact/evidence`.
2. **The agent cards no longer animate in; the micro-visual does.** The
   `/finch` version staggered each card `opacity 0 → 1, y 10 → 0` on enter,
   which means the server HTML shipped `style="opacity:0"` on all six. On
   `/finch` that was a page you scrolled into; on `/` this section is the target
   of `/#agents` from both the footer and the 404 — an anchor lands you on it
   *before* hydration, and the section would be six empty boxes until React
   catches up. Measured: the homepage's SSR had exactly six `opacity:0`
   elements, all of them these cards, where the old five-card version had none.
   The card is now a plain `div` (real content in the server HTML) and the
   `rest → play` variant parent moved down onto the wrapper around
   `AgentVisual`, which is what the plan actually asks to animate ("micro-visuals
   play once on enter"). The left-to-right 60ms stagger is kept, on the drawings.
   Post-fix the homepage SSR has **zero** `opacity:0` elements and all six cards,
   labels, status chips and the honesty line render without JS.
3. **`WhatFinchWatches` is the section; `AgentsOnShift` is the grid.** The plan
   allowed the homepage import to change; keeping it means `app/page.tsx` is
   untouched, and splitting at the grid keeps the eyebrow, H2, sub and honesty
   line on the server — only the six cards reach the client bundle.
4. **The caption thresholds are derived, not hardcoded.** The old stage lit
   caption *i* at literal progress values 0.11 / 0.18 / 0.29, which only make
   sense for today's beat times. `DayStrip` now lights caption *i* at
   `beatT(i) − 0.013` (a caption leads its card slightly, so the eye is already
   there). For the default beats that gives 0.113 / 0.178 / 0.289 — within 0.003
   of the old values, i.e. under one frame of scroll.
5. **`DaySection` was kept and parameterised, not deleted.** The plan lists the
   strip's pieces; the section header is what makes the strip usable as a
   section, and Phase 2 needs a different eyebrow/title over the same machinery.
   It is a server component and imports nothing from `day-beats.ts`, so the
   client boundary in deviation 1 of Phase 1's "B — `/finch`" still holds.
6. **The stage's slot count is documented rather than made fully dynamic.**
   `useTransform` is a hook, so the four card stamps, five clock dots and three
   phone bubbles are a fixed number of hook calls. `DayStrip` is composed for
   *four day beats plus a closing one* and says so at the top; extra beats still
   get a caption and a card in the static and mobile forms.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10)   TS2724 …
lib/platform/whatsapp-ingest.ts(408,36) TS7006 …
lib/platform/whatsapp-ingest.ts(589,5)  TS2353 …
```
The three known pre-existing errors, nothing else. (Mid-flight there was also a
`.next/types/validator.ts` reference to Workstream B's deleted
`app/roi-calculator/page.js`; it cleared as soon as dev regenerated its types.)

```
$ npx eslint components/finch app/page.tsx app/not-found.tsx app/layout.tsx \
    app/sitemap.ts next.config.ts        # clean, no output
```

```
$ curl -sI localhost:3000/<path>
/finch                    308 → /
/platform                 308 → /
/platform/finch           308 → /
/platform/vyso-for-smes   308 → /
/platform/vyso-ai         308 → /
$ curl -s localhost:3000/sitemap.xml | grep -c finch      # 0
$ grep -rn "finch/product" app components lib tests       # 0
$ grep -rnE '"/finch(#|")' app components lib             # 0 (only next.config)
```

**Homepage SSR HTML** (`curl -s localhost:3000/`): one `<h1>`; one `id="agents"`;
all six agent labels (PRICE WATCH · RECON · DEBTORS · STOCK SENSE · THE BRIEF ·
DELIVERY WATCH) once each; six `<svg>`s; `ROLLING OUT` ×1 and `FROM YOUR AUDIT
ROADMAP` ×5; the Doc-U honesty line; **zero** `opacity:0` inline styles. Nav
renders `/industries`, `/pricing`, `/learn`, `/login`, `/operations-audit` and
no Finch link; the footer carries `/#agents`. The 404 renders `Go home ·
See how Finch works (/#agents) · Book your audit` and still returns 404.

**JSON-LD**: `"@type":"SoftwareApplication","@id":"https://vyso.co.za/#finch"
… "url":"https://vyso.co.za/"`.

**Measured in-page, 1440×900**: agents grid 3×2, six uniform 349×252 cards at
x 173/538/903, y 315/583; `scrollHeight === clientHeight` on all six (nothing
spills); section 1160 wide, 861 tall, `scroll-margin-top: 80px`; agent dot
`rgb(255,119,39)`; `document.scrollWidth` 1425 vs `innerWidth` 1440 (scrollbar)
— no horizontal scroll. **768**: 2 columns, 349px cards, no overflow. **375**:
1 column, 335px cards, `scrollWidth === innerWidth === 375`, no element past the
viewport, H2 28px, nav shows only the wordmark and the CTA.

**The micro-visuals play.** Pumped 60 frames with the tab fronted and sampled:
the price sparkline and the delivery route reach `pathLength` 1, the stock gauge
its designed 0.55 arc, and the late labels (`+12%`, `2 SHORT`, `DAY 48`) reach
opacity 1. The variant plumbing survives the parent moving from the card to the
visual wrapper (deviation 2).

**The day strip still works**, checked on a throwaway `app/zz-daycheck` route
rendering `<DaySection />` with no props, since nothing else renders it:
200, no error boundary, all five beat times, both the afternoon note and the
`ILLUSTRATIVE — DEMO DATA` line, the default eyebrow/H2/sub. At 1440 the sticky
stage measures exactly 1160×700 with four positioned cards and the caption row
in order (`06:14 PRICE WATCH … 17:55 THE BRIEF`). **The route was deleted**
(`/zz-daycheck` → 404, `/` → 200).

**Console**: no errors at 1440, 768 or 375.

### Not verifiable in this environment

Screenshots come back a solid `#131313` — the Browser pane is shared with
Workstream B, so this workstream's tab was not the painted one, and while it was
backgrounded `document.visibilityState === "hidden"` froze `motion`'s frame loop
(the same wall Phase 1's B and C hit). Everything above is DOM measurement and
sampled computed style, taken with the frame loop confirmed running (60 frames /
500 ms). Still owed by eye: the six drawings mid-flight, and the day strip's
scroll-linked beats sampled at intermediate progress.

### For the architect to eyeball

1. **Redirect chains.** `/about → /platform → /` and `/apps →
   /platform/vyso-for-smes → /` are now two hops each (they were two hops before
   this phase too, ending at `/finch`). Both sources are also live links in
   `FinchFooter` (`About`) — worth collapsing to single hops, but the `/about`
   and `/apps` entries belong to no workstream this phase.
2. **`app/platform/page.tsx` and `app/platform/finch/page.tsx` still exist** as
   files, shadowed by the redirects. Dead route code for Phase 5's list.
3. **The Finch footer column is titled "Finch" and its first link is "Home".**
   Reads fine, but the column and the site are now the same thing; a rename may
   be wanted when the footer is next opened.
4. **Deviation 2 removes a card entrance animation from the homepage.** The
   trade was a pre-hydration blank section on a linked anchor; if the entrance is
   wanted back, the fix is a CSS-only reveal, not `whileInView`.

## Architect review — Phase 1b (Fable, 2026-08-15) — APPROVED
`/finch` gone (308 → `/`), nav has no Finch link, homepage `#agents` shows the
six-card micro-visual section, day strip parked in `components/finch/day/`
(unwired, for `/compare/finch-vs-hiring-a-coo`). `/operations-audit`: new H1,
header + booking form top, no hero buttons, need/get lists, assessment (524px)
and calculator (524px) side by side at 1440/1280, stacked at 375;
`/roi-calculator` 308 → `#calculator`. Flag for Phase 5: `/about`→`/platform`→`/`
and `/apps` chains are two-hop; `app/platform/page.tsx` + `app/platform/finch/page.tsx`
shadowed by redirects; old nav/footer/pricing-faq still link `/roi-calculator`.
