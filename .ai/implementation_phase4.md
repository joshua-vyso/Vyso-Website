# Phase 4 implementation log

Derived from `.ai/plan_phase4_search_ai_visibility.md`. One section per
workstream, appended by each agent.

---

## A — crawl surface

Files touched: `app/robots.ts`, `app/sitemap.ts`, `next.config.ts` (added
`rewrites()` only — `redirects()` untouched), `app/layout.tsx` (added
`metadata.verification` only, after the existing `twitter` block), new
`lib/marketing/llms.ts`, new `app/llms.txt/route.ts`, new
`app/llms-full.txt/route.ts`, new `lib/seo/indexnow.ts`, new
`app/api/indexnow/route.ts`, new `app/api/indexnow/key/route.ts`, new
`.env.example`, new `docs/seo-operations.md`.

### What changed

1. **`robots.ts`** — `*` still gets `allow: "/"` with
   `disallow: ["/api/", "/app/", "/login", "/onboarding"]`; ten AI/answer-
   engine crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
   anthropic-ai, PerplexityBot, Google-Extended, Bingbot, Applebot-Extended,
   CCBot) get their own identical rule rather than falling through `*`,
   per `.ai/vyso_v2.md` §7.4 ("let the bots in… decide consciously"). Same
   `sitemap`/`host`.
2. **`lib/marketing/llms.ts`** — builders for `/llms.txt` and
   `/llms-full.txt`, reading every fact from the data files listed at the top
   of the plan (`site.ts`, `pricing-data.ts`, `industries.ts`, `solutions.ts`,
   `compare.ts`, `modules.ts`, `integrations.ts`, `faq.ts`, `glossary.ts`,
   `learn-articles.ts`, `resources.ts`, `founding.ts`). Nothing is hand-typed
   except plain page labels for the handful of routes with no data file of
   their own (about, academy, contact, case studies, south-africa) — see the
   file's own top comment for why that's not an honesty risk. `/llms.txt` is
   the short index (entity statement, what Finch is, price, audit, the full
   page list, settled facts, contact). `/llms-full.txt` adds the full FAQ,
   every glossary definition, per-industry "what Finch watches" lines,
   per-solution summaries, per-module taglines, integration statuses, and the
   three compare-page answers plus the salary citation. Both served via
   `route.ts` handlers, `force-static`, `Cache-Control: public, max-age=3600`.
3. **`sitemap.ts`** — every one of the 70 entries now carries a
   `lastModified`. Learn articles read their own real `dateModified`
   (`lib/marketing/learn-articles.ts`, itself git-log-derived). Every section
   whose data file carries no date of its own (solutions, industries,
   modules, integrations, resources, south-africa, founding-client,
   case-studies, privacy) gets a single shared `CONTENT_LAST_MODIFIED`
   constant dated today, commented — see that constant's comment for the
   reasoning (multiple genuinely-untracked data files vs. a few tracked ones
   whose page.tsx has a real but likely-stale git date; one honest "today"
   beats picking through inconsistent history). Existing dated entries
   (home, pricing, faq, contact, terms, popia, about, academy, glossary,
   operations-audit, compare) are untouched.
4. **IndexNow** — `lib/seo/indexnow.ts` exports `submitUrls()`, posting to
   the real IndexNow endpoint (never called in this verification pass — see
   below). `next.config.ts` gained one `rewrites()` function: `/:key.txt` →
   `/api/indexnow/key?key=:key`. Array rewrites are checked after the
   filesystem, so `/robots.txt`, `/llms.txt`, `/sitemap.xml` all still
   resolve to their own routes untouched (verified — see below).
   `app/api/indexnow/key/route.ts` (GET) only serves the key when `?key=`
   matches `INDEXNOW_KEY`; anything else 404s. `app/api/indexnow/route.ts`
   (POST) is admin-token protected via the `x-indexnow-admin-token` header
   and submits every sitemap URL.
5. **Verification (`app/layout.tsx`)** — added
   `metadata.verification = { google: …, other: { "msvalidate.01": … } }`,
   each key present only when its env var is set (never an empty
   `content=""` tag). Nothing else in the metadata block touched.
6. **`.env.example`** (new file — none existed before) — the four new vars
   with comments: `NEXT_PUBLIC_GSC_VERIFICATION`, `NEXT_PUBLIC_BING_VERIFICATION`,
   `INDEXNOW_KEY`, `INDEXNOW_ADMIN_TOKEN`. `.env.local` untouched.
7. **`docs/seo-operations.md`** (new) — GSC/Bing verification steps,
   IndexNow key generation + the post-deploy submission command, directory/
   local-listing checklist, and the monthly LLM-citation log template with
   15 prompts derived from `.ai/vyso_v2.md` §7's intent-cluster list.

### Verification performed

- `npx tsc --noEmit` — only the 3 pre-existing `whatsapp-ingest.ts` errors,
  nothing new.
- `npx eslint app/robots.ts app/sitemap.ts app/llms.txt app/llms-full.txt app/api/indexnow lib/marketing/llms.ts lib/seo next.config.ts app/layout.tsx` — clean.
- `curl localhost:3000/robots.txt` — 200, shows the `*` rule and all ten
  named crawlers, each with the four-path disallow, plus `Host`/`Sitemap`.
- `curl localhost:3000/llms.txt` — 200, `text/plain; charset=utf-8`, all
  sections present and populated (Product, Pages, Facts, Contact).
- `curl localhost:3000/llms-full.txt` — 200, same content type, 14 sections,
  470 lines.
- Extracted every `https://vyso.co.za/...` URL from `/llms-full.txt` (68
  unique), rewrote to `localhost:3000` and curled each — **all 200**.
- `curl localhost:3000/sitemap.xml`, parsed with `xml.etree.ElementTree` —
  70 `<url>` entries, **0 missing `<lastmod>`**.
- `curl -X POST localhost:3000/api/indexnow` (no header) → **401**
  `{"error":"unauthorized"}`. Same with a wrong token.
- `curl localhost:3000/abc123fakekey.txt` (rewrite target, `INDEXNOW_KEY`
  unset in dev) → **404** `Not found` — confirms the rewrite fires and the
  route's key check works.
- `curl localhost:3000/robots.txt` and `/llms.txt` again after adding the
  rewrite → still **200** from their own routes, confirming the generic
  `/:key.txt` rewrite does not shadow them.
- Did **not** call the real IndexNow API, and could not exercise the
  200/400 paths of `POST /api/indexnow` or the 200 path of
  `GET /api/indexnow/key` end-to-end, because `INDEXNOW_KEY` /
  `INDEXNOW_ADMIN_TOKEN` aren't set in `.env.local` (out of scope to add —
  see deviations).

### Deviations / things the user should know

1. **`.env.example` is gitignored.** The repo's `.gitignore` has a blanket
   `.env*` pattern (line 34, "env files (can opt-in for committing if
   needed)"), which also matches `.env.example` — `git check-ignore -v
   .env.example` confirms it. The file exists on disk with the four new vars
   documented, but it will not be committed as-is. Fixing this means editing
   `.gitignore`, which is outside this workstream's file list — flagging
   for the user/architect to decide (`!.env.example` negation pattern is the
   usual fix).
2. **`CONTENT_LAST_MODIFIED` in `sitemap.ts` is one shared constant**, not
   "one per data file" as the plan's literal wording suggests — see the
   constant's own comment in `app/sitemap.ts` for why (they'd all hold the
   same value today; a data-file-level date belongs in the data file itself,
   which is outside this workstream's file list).
3. **IndexNow's 400 (authorized, no key) and 200 paths are unverified**,
   and the real API was never called, per the plan's own instruction not to
   hit it in dev. Verify these once `INDEXNOW_KEY`/`INDEXNOW_ADMIN_TOKEN` are
   set in the real environment, using the curl commands in
   `docs/seo-operations.md`.
4. The 15 LLM-citation prompts in `docs/seo-operations.md` are a starting
   template built from the intent-cluster list in `.ai/vyso_v2.md` §7's
   opening paragraph (only 3 example prompts exist there) — not a fact about
   Vyso, an operational monitoring template. Flagged as adjustable in the doc
   itself.

### Env vars the user must set (production / real testing)

- `NEXT_PUBLIC_GSC_VERIFICATION` — Google Search Console HTML-tag content value.
- `NEXT_PUBLIC_BING_VERIFICATION` — Bing Webmaster HTML meta-tag content value.
- `INDEXNOW_KEY` — self-generated (`openssl rand -hex 16`).
- `INDEXNOW_ADMIN_TOKEN` — self-generated, separate secret
  (`openssl rand -hex 24`), sent as the `x-indexnow-admin-token` header.

All four are documented with generation instructions in `.env.example` and
`docs/seo-operations.md`.

---

## B — OG images

Per-page Open Graph images, generated at request time by `next/og`, replacing
the one stale `/og.png` ("Operations, connected.") that every page in the site
pointed at.

### What was built

`lib/og/render.tsx` — one renderer behind every image. 1200×630, warm-white
`#FAF9F6`, the wordmark from `public/finch/vyso-wordmark.svg` inlined as SVG
paths, an editorial title in STIX Two Text 500, a FindingCard mock on the right
and the mono footer `vyso.co.za · Built by Vyso in Johannesburg`. Sizes and
colours are the design's (`--fn-*` tokens in `app/globals.css`, the card's own
paddings), stepped up two or three points because a 470px card in a feed
thumbnail is read smaller than a 430px card on the page. Optional fields:
`lead` (a sentence under the title, used by the glossary), `caption` (the
`ILLUSTRATIVE EXAMPLE` line the site puts under every worked card), `state`
(the `NEW` chip — `null` on cards that hold published facts rather than a
finding) and `footerNote` (the standing price; `null` on `/pricing`, which
already says it in the card).

`lib/og/fonts.ts` — STIX Two Text 500, DM Sans 400/600 and IBM Plex Mono 400,
fetched once per server process from the Google Fonts CSS API and cached in
module scope. Never throws: on any failure it logs, returns `[]`, clears the
cache so the next request retries, and `renderOgImage` omits the `fonts` option
so `ImageResponse` uses its own bundled face. The CSS request carries a UA
Google has no modern-format rule for, so it is served TTF (satori cannot parse
WOFF2); any `src` that is not `.ttf`/`.otf` is skipped. 5s timeout per fetch.

`lib/og/comparison.ts` — the three `/compare/*` segments share one renderer;
each page hands over its own spec (`COO`, `ERP`, `SPREADSHEETS`).

**Content is read from the data files, never typed here.** Industry → `deck[0]`,
solution → `exampleFinding`, article → `endFinding`, glossary term → `example`
plus `firstSentence(definition[0])`, comparison → `finding` (and its own `note`
as the caption), module → `tagline` + the "used by" `agents` chips +
`appUrlLabel` + `status`, pricing → `PRICE`/`DIRECT_ANSWER`, audit →
`audit-content.ts`, FAQ → `ALL_FAQ_QUESTIONS.length`/`FAQ_GROUPS.length`,
integrations → the count of `CONNECTED IN ONBOARDING` entries in
`INTEGRATION_DETAILS`, about → `SITE`. So an image cannot claim something its
page does not.

### Routes

Own design (14): root `/`, `/pricing`, `/operations-audit`, `/about`, `/faq`,
`/integrations`, `/industries/[slug]`, `/solutions/[slug]`,
`/platform/modules/[slug]`, `/learn/[slug]`, `/learn/glossary/[term]`, and the
three `/compare/*` pages. Each dynamic route falls back to a hub-level spec on
an unknown slug rather than throwing — the page 404s, the image route still has
to return an image.

`alt` is the page's title on the static routes. On the dynamic ones it is
segment-level and generic, because `alt` is a module constant and cannot read
`params`; each image's own title is in the picture.

### Deviation 1 — the root image does not cascade the way the plan assumed

The plan expected pages without their own generator to inherit the root
`app/opengraph-image.tsx`. They do not. Next merges metadata per segment and a
page that declares `openGraph` **replaces the parent's whole `openGraph`
object**, including the `images` the file convention contributes at the root
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`,
"Inheriting fields"). Removing `/og.png` from those pages left them emitting no
`og:image` at all — verified in the SSR HTML of `/contact` before the fix.

Fixed by giving each such segment a file of its own that re-exports the
site-wide image:

```tsx
export { default, alt, size, contentType } from "@/app/opengraph-image";
```

— 14 segments: `/academy`, `/case-studies`, `/case-studies/turn-n-slice`,
`/compare`, `/contact`, `/founding-client`, `/industries`, `/learn`,
`/learn/glossary`, `/platform/modules`, `/resources`, `/resources/[slug]`,
`/solutions`, `/south-africa`. The long version of the note lives in
`app/contact/opengraph-image.tsx`. This was preferred to hard-coding
`images: [{ url: "/opengraph-image" }]` back into 15 metadata blocks: it keeps
every image URL under the file convention, and the day a hub earns its own
design, the file it needs is already there.

`/pricing-faq`, `/platform`, `/platform/finch` and `/platform/vyso-for-smes`
deliberately have **no** image file: all four 308 to another URL
(`next.config.ts`), and the redirect target carries the image.

### Deviation 2 — a small addition to the plan's footer

The footer carries the plan's line on the left and `R6,000 / location / month`
on the right. It is the site's published price, on the one surface where a
preview is all a reader sees. `/pricing` passes `footerNote: null` rather than
print it twice.

### Metadata edits

Every `openGraph.images` / `twitter.images` that hard-coded `/og.png` was
removed — 31 page files plus `app/layout.tsx` (only those lines; the layout's
comment explains why there is no `images` key anywhere now). `grep -rn og.png
app/` → 0 hits. `public/og.png` itself was left in place; nothing references it.

### Verification

- `npx tsc --noEmit` → only the three known `lib/platform/whatsapp-ingest.ts`
  errors.
- `npx eslint lib/og $(find app -name opengraph-image.tsx)` → clean. (`npx
  eslint lib/og app` also reports pre-existing `react-hooks/purity` errors in
  `app/app/pricepilot/**` — not this workstream's files, not touched.)
- All 28 image routes return `200 image/png` (every static route curled
  individually; the 6 dynamic segments curled with real slugs — two each for the
  five that carry their own design). Sizes
  57–79 KB, well under the
  300 KB budget; `file` reports `PNG image data, 1200 x 630` on every sample.
- Samples saved and reviewed:
  `<scratch>/og-root.png`, `<scratch>/og-industry-food-suppliers.png`,
  `<scratch>/og-glossary-fractional-coo.png` (plus `og-pricing.png`,
  `og-module-doc-u.png`, `og-compare-coo.png`, `og-learn.png`).
- SSR HTML of `/`, `/pricing`, `/operations-audit`, `/industries/food-suppliers`,
  `/solutions/reduce-money-leakage`, `/learn/glossary/fractional-coo`, `/faq`,
  `/compare/finch-vs-erp` (and 20 more) all carry `og:image` **and**
  `twitter:image` pointing at the generated route for that page.

Production note: the images work in dev, and `next build` (still blocked by the
untracked WhatsApp files) would prerender them as static assets — the font
fetch then happens at build time, with the same fallback if it fails.

## D — SEO/a11y audit

Ran Lighthouse (mobile, headless Chrome, `seo,accessibility,best-practices`
only — `performance` excluded, dev server numbers aren't real) against `/`,
`/pricing`, `/operations-audit`, `/industries/food-suppliers`,
`/compare/finch-vs-hiring-a-coo`, `/learn`, `/faq`. Full detail, scores,
top findings, and what was deliberately left unfixed (with reasons) are in
`.ai/perf_baseline.md`.

**Scores.** SEO was already 100 on all seven pages — nothing to fix there.
Accessibility before: 91 (`/`), 96, 97, 96, 97, 96, 96. After: **96, 96, 97,
96, 97, 96, 100** — every page now clears the ≥ 95 gate. Best Practices
100 everywhere, before and after.

**Fixed:**
- `--fn-muted` token (`app/globals.css`): `#8A8474` → `#756F59`. The old
  value measured 3.54:1 on `--fn-bg`, failing AA (4.5:1) at every size it's
  used (9–20px, never large text). Same hue, darkened; now 4.78:1 / 5.03:1
  on `--fn-bg` / `--fn-surface`.
- `--fn-orange-cta` / `--fn-orange-deep` tokens (`app/globals.css`):
  `#E05A12` → `#BD4A0E`, `#C94F0E` → `#A8410C`. The site-wide CTA button
  text (`#FFF7F0` on `--fn-orange-cta`) measured 3.51:1 — no legible text
  colour reaches 4.5:1 against the old background (even white only gets to
  3.72:1), so the background had to darken. Both tokens moved by the same
  factor so hover stays visibly darker than rest.
- Icon-only "Send" button accessible name: `InertButton` in
  `components/finch/showcase/{BriefHome,BriefMobile,FindingDetail}.tsx` — a
  decorative, `aria-disabled`/non-tabbable node inside a screenshot mockup
  ("a control that is part of the picture, not part of the page," per the
  file's own comment) — got `aria-hidden` added, matching its stated intent
  and removing it from the accessibility tree instead of inventing a label.
- New `components/finch/SkipLink.tsx` (`<a href="#main">`, hidden until
  focused, no client JS), mounted first in `<body>` in `app/layout.tsx`
  (re-read immediately before editing — Workstreams B/C had already landed
  their own layout.tsx changes). Added `id="main"` to `<main>` on the seven
  audited pages, including `app/industries/[slug]/page.tsx` (covers every
  industry, not just food-suppliers).
- `<html lang="en-ZA">` — already present, verified, no change needed.
- Heading order, link names, tap targets — checked, all already passing on
  all seven pages; no change needed.

**Deliberately not fixed** (see `.ai/perf_baseline.md` for full reasoning):
`--fn-faint` (#B9B3A3) still fails AA at its actual sizes, but the only
value that would pass is functionally identical to the new `--fn-muted` —
fixing it the same way would collapse the two-tier grey hierarchy, which is
a design-system decision, not a token tweak; flagged for the architect.
`#8A8E86` (hard-coded, not a `--fn-*` token) in the three showcase mockup
files is a different, intentional palette ("the design file's own platform
palette... we are looking at the app, not at the page" — the files' own
comment) faithfully reproducing the real product's own colours; only
affects `/`, which already clears the bar without it — flagged as a
possible real-product a11y issue, not a marketing-site one. `valid-
source-maps` (best-practices) is a dev-server artifact unrelated to any
file in scope. Hover-only contrast (e.g. `AuditBand.tsx`'s
`hover:bg-fn-orange`) isn't tested by Lighthouse and wasn't touched.
`id="main"` was only added to the seven audited pages' `<main>` — the
remaining ~20 marketing pages need the same one-line addition to make the
site-wide skip link functional everywhere (out of this workstream's file
scope: they aren't `app/layout.tsx`, `globals.css`, or `components/finch/**`).

**Verification:** `npx tsc --noEmit` → only the three known, pre-existing
`whatsapp-ingest.ts` errors. `npx eslint` on every touched file → clean.
All seven pages return 200 throughout. Lighthouse re-run after fixes:
SEO 100 and a11y ≥ 96 on all seven (gate was SEO 100 / a11y ≥ 95).

## C — analytics

`npm install @vercel/analytics @vercel/speed-insights` — exactly these two,
per the user's approval of the recommended default. Installed:
**`@vercel/analytics@2.0.1`**, **`@vercel/speed-insights@2.0.0`**.

### What was built

New **`lib/analytics.ts`** — the typed `track()` every event in this
workstream goes through, instead of components importing
`@vercel/analytics`'s own `track` directly. `AnalyticsEvents` is one map,
one entry per event, whose value type *is* that event's prop shape
(`Record<string, never>` for the two that carry none) — so every call site
is checked against it and a typo in an event name or a missing/extra prop is
a compile error, not a silent miss. `track()` itself is one line of logic:
no-op when `typeof window === "undefined"`. `@vercel/analytics`'s own
`track()` already reacts to being called on the server (warns in production,
throws in development, per `node_modules/@vercel/analytics/dist/index.mjs`),
so this is what keeps every call site from needing its own guard, and what
makes `track()` safe to call unconditionally from an effect, a ref-gated
handler, or deep in a render-time closure.

New **`components/finch/TrackedLink.tsx`** — the reason it exists: most of
the CTAs in this workstream live in server components, and firing `track()`
needs an `onClick`. Rather than convert e.g. `HomeHero.tsx` or the whole
`/industries/[slug]` section tree to `"use client"`, this thin client
component wraps `next/link`'s `<Link>` unchanged (same props, same
prefetch/navigation behaviour) and fires the given event before forwarding
to the caller's own `onClick` if any. Used for every link-shaped CTA in a
server component; components that were already `"use client"` (MobileMenu,
ContactForm, FindingCard, PlatformShowcase, IntegrationsOrbit,
FaqInteractive, AcademyInterest) call `track()` straight from their existing
handlers instead.

**`app/layout.tsx`** — mounted `<Analytics />` (`@vercel/analytics/next`)
and `<SpeedInsights />` (`@vercel/speed-insights/next`) as the last two
children of `<body>`, after `{children}`, with a comment pointing at
`lib/analytics.ts`. Re-read immediately before this edit and again before
finishing, since Workstreams A, B and D all touch this file too — final
state has all four changes coexisting (A's `metadata.verification`, B's
`openGraph`/`twitter` comment, this workstream's two components, D's
`<SkipLink />`).

### Events wired

| Event | Where | File |
|---|---|---|
| `book_audit_click {page:"nav"}` | Nav CTA | `FinchNav.tsx` (`TrackedLink`), `MobileMenu.tsx` (already client, direct `track()` in the sheet CTA's `onClick`, alongside the existing `close()`) |
| `book_audit_click {page:"home"}` | Hero CTA | `HomeHero.tsx` (`TrackedLink`) |
| `book_audit_click {page:"audit-band"}` | Closing band, ~20 pages | `AuditBand.tsx` (`TrackedLink`) |
| `book_audit_click {page:"pricing"}` | `/pricing`'s own CTA | `components/finch/pricing/AuditCta.tsx` (`TrackedLink`) |
| `book_audit_click {page:"industries", vertical}` | Both CTAs on `/industries/[slug]` | `components/finch/industries/IndustrySections.tsx` (`IndustryHero`, `IndustryAudit`) — replaces the `data-vertical` attribute the file already had a comment reserving for this ("No listener reads it yet") |
| `audit_form_submit {variant}` | Any successful `/api/contact` submit | `components/ContactForm.tsx`, right after `setStatus("success")` — fires for all three variants (`audit`/`general`/`academy`) |
| `academy_interest {}` | Academy interest form success specifically | `components/finch/academy/AcademyInterest.tsx`'s `handleSuccess`, alongside the existing `setFilled` |
| `demo_played {direction}` | The scripted scroll-driven showcase demo, once per direction per pageview | `components/finch/PlatformShowcase.tsx` — a `Set<"forward"\|"reverse">` ref gates the call, placed at the top of `playForward`/`playReverse` (fires even under `prefers-reduced-motion`, since the view still changes; does **not** fire on a manual click of the real buttons, which call `cancel()` + `showDetail()`/`showBrief()` directly, bypassing the scripted sequence — that's a real interaction, not "the demo playing") |
| `orbit_hover {}` | First hover of the integrations widget, once per pageview | `components/finch/IntegrationsOrbit.tsx` — a boolean ref gates the call inside the existing `onPointerEnter` |
| `finding_card_action_click {agent, action}` | Interactive `FindingCard` action row only | `components/finch/FindingCard.tsx` — `FindingActions` gained an optional `agent` prop (default `FINDING_DEFAULTS.agent`), threaded from the composed `FindingCard`; the `onClick` is only on the `interactive` branch, so the picture-of-a-card usages (`ScrollSequence.tsx`, `industries/FindingDeck.tsx`, both `interactive={false}`) never fire it |
| `faq_open {id}` | Opening an FAQ `<details>` | `app/faq/FaqInteractive.tsx` — one delegated `toggle` listener on `FaqFilter`'s existing `rootRef`, added in a `useEffect`, capture-phase (`addEventListener("toggle", handler, true)`) so it works regardless of whether `toggle` bubbles in a given browser; fires only when `details.open` is `true`, never on close |
| `resource_request {slug}` | The "Send me the ⟨resource⟩" CTA | `app/resources/[slug]/page.tsx` — the existing `<a href="#request">` became a `TrackedLink`; this is the click on intent-to-request, not the form submit itself (the form below it is `ContactForm`'s existing `general` variant, which already fires its own `audit_form_submit {variant:"general"}` on success — adding `resource_request` there too would have needed a slug-aware client wrapper around `ContactForm` for no clearer signal) |
| `outbound_click {href}` | The footer's one non-internal link | `components/finch/FinchFooter.tsx` — the `mailto:` link became a `TrackedLink` (`Link` forwards `onClick` for any `href`, including `mailto:`, so this works without a separate wrapper) |

No PII in any prop: `page`/`vertical`/`variant`/`agent`/`action`/`id`/`slug`/
`direction`/`href` are all either static UI copy or route segments, never a
name/email/business/phone a visitor typed in.

### Deviations / things the user should know

1. **`<Analytics />`/`<SpeedInsights />` load on `/app/**` too — this is
   forced by the layout structure, not a choice.** The plan says "Do NOT add
   analytics to `/app/**` product routes" and asks the verification to
   "confirm no analytics script on `/app` routes." What I could actually
   verify: `app/app/layout.tsx` has no `<html>`/`<body>` of its own — it is a
   nested layout under the single root `app/layout.tsx`, so there is exactly
   one `<body>` for the whole site and both components render into it
   regardless of route. `curl /app` in dev 307s to `/login` (confirmed —
   `getPlatformSession()` redirects when unauthenticated), so I could not
   render an actual `/app` page to inspect its HTML directly; reasoning from
   the layout tree is what the plan's own verification instruction
   anticipates for exactly this case. No custom `track()` call was added to
   anything under `app/app/**` or `components/platform/**` — only pageview/
   Speed-Insights vitals collection is site-wide, not any of the taxonomy
   events above. Excluding the scripts themselves from `/app/**` would need
   either middleware setting a header the root layout reads, or splitting
   `/app` into its own route-group root layout (its own `<html>`/`<body>`) —
   both outside `app/layout.tsx`, `lib/analytics.ts`, and the component list
   this workstream was scoped to. Flagging for the architect/user to decide
   whether that split is worth doing.
2. **`AuditBand.tsx` and `AuditCta.tsx` get a static `page` value, not the
   real route.** `AuditBand` is rendered by ~20 different pages and takes no
   props today; threading a real `page` value through would mean editing
   every one of those pages, which are outside this workstream's file list.
   Tagged `"audit-band"` (identifies the component, not the URL) instead —
   flagging in case per-page attribution on this specific CTA turns out to
   matter later. `AuditCta.tsx` is only ever rendered by `/pricing`, so
   `"pricing"` there is accurate today but would go stale if the component
   were reused elsewhere.
3. **`orbit_hover` was not live-verified in the browser** (not on the plan's
   required list for this workstream — "nav CTA click, a FindingCard action,
   showcase forward, FAQ open" are — and the widget's root is
   `aria-hidden="true"`, so it never gets an accessibility-tree `ref` to
   drive automated interaction with the tooling available here). The handler
   is the same `onPointerEnter` the widget already had (for `setHovered`),
   with a boolean ref guard added — verified by code review, not by
   triggering it live.

### Verification performed

- `npx tsc --noEmit` — only the three known, pre-existing
  `whatsapp-ingest.ts` errors.
- `npx eslint` on every file touched (`lib/analytics.ts`,
  `components/finch/TrackedLink.tsx`, `app/layout.tsx`, `FinchNav.tsx`,
  `MobileMenu.tsx`, `HomeHero.tsx`, `AuditBand.tsx`, `pricing/AuditCta.tsx`,
  `industries/IndustrySections.tsx`, `ContactForm.tsx`,
  `academy/AcademyInterest.tsx`, `resources/[slug]/page.tsx`,
  `FinchFooter.tsx`, `FindingCard.tsx`, `PlatformShowcase.tsx`,
  `IntegrationsOrbit.tsx`, `app/faq/FaqInteractive.tsx`) — clean.
- `npm ls @vercel/analytics @vercel/speed-insights` — both resolve, no
  extra/duplicate installs.
- Dev server, `window.va` debug log confirmed for every event on the plan's
  required list, with correct payloads:
  - Nav CTA click → `book_audit_click {page:"nav"}`, then real navigation to
    `/operations-audit`.
  - A `FindingCard` action click → `finding_card_action_click
    {agent:"PRICE WATCH", action:"Show 6-month trend"}`.
  - Scrolling the homepage down into the showcase → `demo_played
    {direction:"forward"}`; continued downward scrolling fired it only
    **once** (the per-pageview guard held).
  - Opening an FAQ `<details>` (dispatched with `bubbles:false` specifically,
    to prove the capture-phase listener doesn't depend on bubbling) →
    `faq_open {id:"what-is-finch"}`.
  - Console otherwise clean (no errors) throughout.
- `/app` → confirmed 307 → `/login` in dev (unauthenticated); reasoned about
  script placement from the layout tree per deviation 1 above.

## Architect review — Phase 4 (Fable, 2026-08-16) — APPROVED

Verified: robots.txt with 11 UA blocks incl. the AI crawlers; /llms.txt (4.8KB)
and /llms-full.txt (39KB) 200 and data-generated (A curled all 68 listed URLs →
200); sitemap 70 URLs all with lastmod; 28 OG image routes 200 image/png
57–79KB — root + food-suppliers samples reviewed by eye, on-brand; every
marketing page's og:image/twitter:image → generated route, `og.png` refs 0;
@vercel/analytics 2.0.1 + speed-insights 2.0.0 mounted, events verified live by
C; Lighthouse SEO 100 / a11y ≥ 96 on 7 pages (perf deferred to a prod build);
tsc 3 known. Post-review: `.gitignore` `!.env.example`; `id="main"` now exactly
once on every sitemap route.
Decisions for Josh: (1) D darkened `--fn-orange-cta` #E05A12→#BD4A0E and
`--fn-orange-deep` #C94F0E→#A8410C for AA contrast — brand-visible; revert if
you prefer the design hex and accept the contrast miss. (2) Analytics = Vercel
(recommended default) — swap to Plausible if wanted. (3) OG/industry example
names a real chain ("Kloof Spar") as a short-paying customer — consider a
fictional name. Env to set: NEXT_PUBLIC_GSC_VERIFICATION, NEXT_PUBLIC_BING_
VERIFICATION, INDEXNOW_KEY, INDEXNOW_ADMIN_TOKEN (see docs/seo-operations.md).
