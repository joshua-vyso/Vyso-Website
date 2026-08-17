# Plan — Phase 4: search & AI-visibility infrastructure + analytics

Derived from `.ai/vyso_v2.md` §7.1–7.4, §7.7. Read §7 first. Standing rules:
no new deps EXCEPT the two analytics packages in Workstream C (recommended
default, user said "let's go phase 4" — treat as approved; record it), no git
commands, SSR-safe, honesty (no invented sameAs URLs, verification tokens or
addresses — read them from env / `lib/marketing/site.ts`), dev server on :3000
(don't start another; front your browser tab). `npm run build` is still blocked
by the untracked WhatsApp files — verify with tsc/eslint/curl; where a feature
only exists in production builds (OG image routes DO work in dev), say so. Four
workstreams, disjoint files; each appends "## <letter> — …" to
`.ai/implementation_phase4.md`. Content sources for machine-readable outputs
are the data files: `lib/marketing/{site,faq,industries,solutions,compare,
integrations,glossary,learn-articles,resources,modules,founding}.ts`,
`components/finch/pricing/pricing-data.ts`, `components/finch/integrations.ts`,
`components/finch/agents/agents-data.ts`.

---

## Workstream A — crawl surface: robots, llms.txt, sitemap dates, IndexNow, verification (Sonnet)

Files: `app/robots.ts`, `app/sitemap.ts`, new `app/llms.txt/route.ts`, new
`app/llms-full.txt/route.ts`, new `lib/marketing/llms.ts` (builders), new
`app/api/indexnow/route.ts` + `app/[indexnow-key].txt` equivalent (see 4), new
`lib/seo/indexnow.ts`, `app/layout.tsx` (ONLY `metadata.verification` +
`metadata.other` for Bing/Google — read from env), `.env.example` (add the new
vars with comments; do NOT touch `.env.local`), `docs/seo-operations.md` (new).

1. **robots.ts** — allow `/` for `*`; explicit `allow: "/"` rules for
   `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`,
   `PerplexityBot`, `Google-Extended`, `Bingbot`, `Applebot-Extended`, `CCBot`
   with `disallow: ["/api/", "/app/", "/login", "/onboarding"]` for everyone;
   `sitemap` + `host` unchanged. Comment the intent (we want to be cited).
2. **`/llms.txt`** (Markdown, `text/plain; charset=utf-8`, cache 1h): H1 "Vyso
   — Finch, your company's own COO", the verbatim entity statement from
   `SITE`, then sections with one-line entries + canonical absolute URLs:
   Product (what Finch is, price, audit), Pages (home, pricing, operations
   audit, industries ×8, solutions ×4, compare ×3, modules ×10, integrations,
   faq, about, academy, case study, south-africa, learn hub, glossary hub,
   resources), Facts (R6,000/location/month everything included; audit R2,000
   credited; founding terms; 30 days' notice; expanded mandates on scope;
   Johannesburg; en-ZA), Contact. **`/llms-full.txt`**: the same plus the full
   FAQ (Q + A), glossary definitions, per-industry "what Finch watches" lines,
   per-solution summaries, per-module taglines, integration statuses — all
   generated from the data files, never hand-typed; regenerate = redeploy.
   Add `<link rel="alternate" type="text/plain" href="/llms.txt">`? — not a
   standard; skip. Mention both files in `robots.txt`? Not standard either;
   skip. Just serve them.
3. **sitemap.ts** — real `lastModified` per entry from data where it exists
   (learn `dateModified`, glossary/solutions/industries/modules: use a
   `CONTENT_LAST_MODIFIED` constant per data file, set to today's date and
   commented "bump when content changes"); `changeFrequency`/`priority`
   sensible (home 1.0 weekly, pricing/audit 0.9, verticals/solutions 0.8,
   learn 0.6…); keep the exclusions.
4. **IndexNow** — `lib/seo/indexnow.ts` (`submitUrls(urls: string[])` posting to
   `https://api.indexnow.org/indexnow` with `key` from `process.env.INDEXNOW_KEY`,
   `keyLocation: https://vyso.co.za/${key}.txt`), a route `app/[key].txt` is
   awkward in Next — instead `app/indexnow-key/route.ts`? No: the key file must
   be at `/{key}.txt`. Implement `app/[[...slug]]`? Too invasive. Use
   `next.config.ts` `rewrites` from `/:key.txt` → `/api/indexnow/key` ONLY when
   `:key` equals the env key (check in the route; 404 otherwise) — single
   minimal edit to next.config; route returns the key as text. Plus
   `app/api/indexnow/route.ts` POST (protected by `INDEXNOW_ADMIN_TOKEN` header)
   that submits the sitemap's URLs. Document in `docs/seo-operations.md`
   (how to set the key, how to ping after deploy, GSC/Bing setup steps, the
   monthly LLM-citation log template with the 15 prompts from §7.4).
5. **Verification** — `metadata.verification = { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION, other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION } }`
   omitting undefined; `.env.example` entries.

Verify: tsc/eslint; `curl /robots.txt` shows the bot rules; `curl /llms.txt`
and `/llms-full.txt` 200 with the expected sections and only real URLs (crawl
every URL they list → 200); sitemap parses with dates; IndexNow route 401
without token / 400 without key (don't hit the real API in dev).

## Workstream B — per-page OG images (Opus)

Files: new `lib/og/*` (renderer + font loading + card mock), new
`app/opengraph-image.tsx` (root), and per-segment `opengraph-image.tsx` for:
`app/pricing`, `app/operations-audit`, `app/industries/[slug]`,
`app/solutions/[slug]`, `app/compare/[…]` (three static segments — one file
each or a shared helper), `app/platform/modules/[slug]`, `app/learn/[slug]`,
`app/learn/glossary/[term]`, `app/about`, `app/faq`, `app/integrations`; every
page's `metadata.openGraph.images` / `twitter.images` that hard-code `/og.png`
must be removed so Next's file-convention image is used (edit ONLY those
metadata lines in the page files; the pages themselves are other workstreams'
in the past — coordinate by editing just the metadata block; A also edits
`app/layout.tsx` metadata — you edit only its `openGraph.images`/`twitter.images`
lines, re-read before editing).

Design (Finch, 1200×630): warm-white `#FAF9F6`, wordmark top-left (inline SVG
paths from `public/finch/vyso-wordmark.svg`), page title in STIX Two Text 500
(load the TTF once via `fetch` from Google Fonts CSS → woff/ttf URL at request
time and cache in module scope; fall back to system serif if fetch fails —
never crash), a FindingCard mock on the right (agent label mono, observation,
orange impact, blue evidence chip) with page-specific content from the data
files (industry deck[0], solution exampleFinding, glossary example, learn
`endFinding`, module: a "used by" line, pricing: "R6,000 / location / month",
audit: "One week. Where the money leaks."), mono footer line `vyso.co.za ·
Built by Vyso in Johannesburg`. Alt text = title. `runtime = "nodejs"` (edge
not required). Reduce to ≤ 300KB.

Verify: tsc/eslint; `curl -sI localhost:3000/opengraph-image` and each dynamic
one (e.g. `/industries/food-suppliers/opengraph-image`) → 200 `image/png`;
save 3 samples to the scratch dir and confirm dimensions with `file`; every
page's `<meta property="og:image">` points at the generated route (grep the
SSR HTML of 6 pages) and no page still emits `/og.png` except as an explicit
fallback nowhere.

## Workstream C — analytics + event taxonomy (Sonnet)

Files: `package.json` (add `@vercel/analytics` and `@vercel/speed-insights`
— run `npm install` for exactly these two; report the versions), `app/layout.tsx`
(mount `<Analytics />` + `<SpeedInsights />` — single minimal edit near the
existing global components; A and B also edit layout metadata — re-read first),
new `lib/analytics.ts` (typed `track(event, props)` wrapper around
`@vercel/analytics`'s `track`, no-op on server / when the module isn't ready;
event names + prop schema as constants), and the smallest possible edits in:
`components/finch/FinchNav.tsx` + `MobileMenu.tsx` (CTA → `book_audit_click
{page:"nav"}`), `HomeHero.tsx`, `AuditBand.tsx`, `components/finch/pricing/AuditCta.tsx`,
`components/finch/industries/*` (CTA carries `data-vertical` → `book_audit_click
{page, vertical}`), `components/ContactForm.tsx` (`audit_form_submit {variant}`
on success), `components/finch/PlatformShowcase.tsx` (`demo_played
{direction}` once per direction per pageview), `components/finch/IntegrationsOrbit.tsx`
(`orbit_hover` once per pageview), `components/finch/FindingCard.tsx`
(`finding_card_action_click {agent, action}` for interactive cards only),
`app/faq/FaqInteractive.tsx` or the details toggles (`faq_open {id}`),
`app/resources/[slug]/page.tsx` or its form (`resource_request {slug}`),
`components/finch/academy/*` (`academy_interest`), `FinchFooter.tsx` outbound
(`outbound_click {href}`). Do NOT add analytics to `/app/**` product routes.
No PII in props (never email/name/business). Where a component is a server
component, wrap the interactive element in a tiny client `TrackedLink`
(`components/finch/TrackedLink.tsx`) rather than converting the whole file.

Verify: tsc/eslint; `npm ls @vercel/analytics @vercel/speed-insights`; in the
browser, `window.va` or the `track` calls fire (stub `navigator.sendBeacon`/
fetch or read the Vercel debug log in dev — `@vercel/analytics` logs in
development mode) for: nav CTA click, a FindingCard action, showcase forward,
FAQ open; no events on `/app`; console clean.

## Workstream D — SEO/a11y audit + quick wins (Sonnet)

Files: read-only mostly; may edit `app/layout.tsx` fonts (preload/subset —
re-read first, minimal), image `alt`s in `components/finch/**`, heading-order
fixes, `lang`/`dir`, skip-link (`components/finch/SkipLink.tsx` + mount in the
`.finch-site` wrapper — coordinate: add it in `app/layout.tsx` body top,
minimal edit), focus-visible styles in `globals.css` (Finch block only).

1. Run `npx lighthouse http://localhost:3000/<path> --only-categories=seo,accessibility,best-practices --form-factor=mobile --quiet --output=json --output-path=<scratch>/lh-<name>.json` for `/`, `/pricing`, `/operations-audit`, `/industries/food-suppliers`, `/compare/finch-vs-hiring-a-coo`, `/learn`, `/faq`. (Performance category is meaningless on the dev server — record it but say so; production numbers wait for the build unblock.)
2. Fix every SEO/a11y failure that is ours (missing alt, contrast on the
   greys — check `#8A8474` on `#FAF9F6` for small text and bump to `#7A745F`
   in the token if it fails AA at its sizes; label/name for icon buttons;
   heading order; link names; tap targets 24px; `<html lang="en-ZA">`).
   Report anything you deliberately did not change (design tokens are shared —
   change a token only if the contrast failure is real and note it).
3. Write `.ai/perf_baseline.md`: scores per page per category, the top 5
   opportunities per page, and what was fixed.

Verify: re-run Lighthouse on the fixed pages; SEO 100 and a11y ≥ 95 on all
seven; tsc/eslint clean.

---

## Phase-level verification (architect)

robots/llms/sitemap curls; OG image sample review; analytics dep versions +
one event observed; Lighthouse SEO/a11y numbers; grep gates; tsc.
