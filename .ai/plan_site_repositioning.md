# Plan: vyso.co.za repositioning overhaul

Status: DRAFT, awaiting owner approval. Do not implement until approved.
Architect: Fable 5. Implementers: Claude subagents per phase assignments below.
Source brief: owner's "overhaul vyso.co.za" brief, 2026-08-27. If this plan and the brief conflict, the brief wins; if either conflicts with the codebase, stop and ask.

## Goal

Reposition the marketing site from "Finch, fixed-price product" to "Vyso builds operational automation for SA SMEs, priced per system, hotels first". No product/app changes. Finch becomes a subpage. New home router, new /industries/hotels flagship, new /how-we-work, rewritten /pricing, Orbit becomes a waitlist page.

## Acceptance criteria

1. Site map matches brief section 3 exactly (plus resolutions to the open questions below).
2. All 8 new 301 redirects live in `next.config.ts`; deleted routes removed from `app/sitemap.ts`; robots untouched.
3. Header nav: Industries, How we work, Pricing, Finch, CTA "Book your audit". No Learn/Orbit/Log in in header. Footer per brief section 4.
4. Final grep of customer-facing source (scope defined below) returns zero for: "COO", "tenth of the cost", "per location", "R6,000", "everything included", "OrderFlow", "PricePilot", "ProcurePulse", "SupplySync", "ServiceDen", "Service Den", "Vyso Core", em dash, en dash. "Doc-U" zero except (optionally) inside the /finch demo UI mock. "ZAR" zero in visible copy (JSON-LD `priceCurrency` exception, see edge cases).
5. `npm run build` and `npm run lint` pass after every phase. One commit per phase.
6. Every placeholder (`[TNS_NUMBER]`, `[CONFIRM_FOUNDING_OFFER]`, `[CONFIRM_NOTICE_PERIOD]`) listed in the final report.

## Repo facts implementers must respect

- Next.js 16.2.7 App Router, React 19, TypeScript strict, Tailwind v4 (CSS-first config in `app/globals.css`, marketing tokens under `.finch-site` prefixed `--fn-*`). npm. **Read `AGENTS.md` and the guides in `node_modules/next/dist/docs/` before writing Next-specific code; Next 16 has breaking changes vs training data.**
- Marketing copy lives in `lib/marketing/**` data files rendered by `components/finch/**` and pages under `app/`. No CMS/MDX.
- OG images are `opengraph-image.tsx` files per segment using `lib/og/render.tsx` (`renderOgImage`).
- Sitemap: `app/sitemap.ts` (note: `learnDate()` throws if learn slugs drift; do not touch learn content).
- JSON-LD: root graph in `app/layout.tsx` pulls prices from `components/finch/pricing/pricing-data.ts` (`PRICE`). Changing pricing data cascades into JSON-LD by design; update both coherently.
- Forms: single `app/api/contact/route.ts` (Resend, rate-limited) with `variant` field incl. existing `"orbit"` waitlist variant, plus `components/orbit/WaitlistForm.tsx`. Reuse this; do not add a third-party form service.
- Integrations that may be named in copy (the only ones): Xero, WhatsApp Business, Yoco, Sage, Loyverse, QuickBooks, Gmail, Outlook, Notion, n8n, SimplePay.

## Constraints: files and areas NOT to touch

- `app/app/**`, `app/login/**` (except: remove "Log in" from header, add to footer — those are nav components, not the login page), `app/onboarding/**`, `app/api/**` other than possibly extending `app/api/contact/route.ts` for the Orbit waitlist fields, `lib/platform/**`, `components/platform/**`, `supabase/**`, auth, anything product.
- `app/privacy`, `app/terms`, `app/popia`: banned-phrase scrub only, no restructuring.
- `app/robots.ts`: untouched.
- `/learn` content (`lib/marketing/learn-articles.ts`, glossary): banned-phrase scrub only; do not add/remove slugs (sitemap guard throws).
- The uncommitted free-scan feature files (untracked) and any pre-existing uncommitted modifications: never stage or revert them (see open question 1).
- Internal module names inside product code stay: the ban applies to customer-facing marketing copy only.

## Scope definition for the banned-phrase scrub

Customer-facing = anything rendered on marketing routes: `app/*` marketing pages + their `opengraph-image.tsx` + metadata, `components/finch/**`, `components/orbit/**`, `components/ContactForm.tsx`, `lib/marketing/**`, `lib/orbit/**`, `lib/og/**`, `lib/marketing/llms.ts` (llms.txt output). NOT: code comments, `app/app/**`, `lib/platform/**`, `components/platform/**`, tests, planning docs. Em/en dashes: remove from rendered copy strings in scope; code comments may keep them.

Edge cases:
- JSON-LD `priceCurrency` must remain ISO "ZAR" (schema.org requirement); the ban on "ZAR" applies to visible prose only. Call this out in the final report.
- Numeric ranges rendered with en dash become "to" ("2 to 10 days").
- Roberto quote text is kept verbatim per brief.
- "platform"/"ERP"/"agency": remove from customer-facing prose; internal file paths and directory names (`lib/platform/**`) stay.

## Owner decisions (2026-08-27, plan APPROVED)

1. Dirty tree: stash pre-existing tracked modifications (`git stash push`, untracked free-scan files stay in place and must NEVER be staged — implementers stage files explicitly, never `git add -A`/`git add .`).
2. Orbit subpages: delete all, 301 each to /orbit. Trim OrbitNav links to deleted pages.
3. /solutions (+ [slug]): delete, 301 to /industries.
4. /free-scan: leave the feature completely untouched; drop its footer link.
5. /operations-audit/calculator and /score: keep as-is.
6. Em-dash ban scope: rendered customer-facing copy only, as defined above. Confirmed.

Sequencing note: the /industries/hospitality -> /industries/hotels redirect lands in PHASE 3 (when the hotels page exists), not Phase 1; hospitality stays live (scrubbed) until then. /finch and /how-we-work get minimal stub pages in Phase 1 so nav links resolve.

## Original open questions (resolved above, kept for record)

1. **Dirty working tree.** `main` has uncommitted modifications to `next.config.ts`, `components/finch/FinchFooter.tsx`, `components/finch/HomeHero.tsx`, `components/ContactForm.tsx`, `app/api/contact/route.ts` and others, plus the whole untracked free-scan feature. These are exactly the files this overhaul edits, so "one commit per phase" would sweep your in-progress work into my commits. Options: (a) you commit/stash your changes first (recommended), (b) I commit the pre-existing changes as one separate "wip" commit before Phase 1, (c) I proceed and accept mixed commits.
2. **Orbit subsite.** Brief says /orbit becomes one waitlist page. /orbit currently has subpages: /orbit/for, /orbit/for/[trade], /orbit/how-it-works, /orbit/pricing, /orbit/faq, /orbit/compare/[slug], /orbit/learn, /orbit/learn/[slug], /orbit/waitlist. Recommend: delete all, 301 each to /orbit. Confirm.
3. **/solutions and /solutions/[slug].** Exists but is absent from the brief's site map. Recommend: delete, 301 to /industries. Confirm.
4. **/free-scan.** Uncommitted in-progress feature, absent from the brief's site map, linked from the current footer. Recommend: leave the feature untouched, drop it from the new footer, keep the route as-is. Confirm.
5. **/operations-audit/calculator and /score.** Keep as-is under the kept /operations-audit (recommended), or fold/remove?
6. **Existing redirect `/finch -> /` must be deleted** to create the real /finch page. Permanent redirects are browser-cached, so some returning visitors may bounce to / for a while. No action needed, just confirming you accept this. Related: repoint `/platform/finch -> /finch` and fix the `/apps` redirect chain to point at `/` directly.

## AMENDMENT 1 (owner, 2026-08-27, mid-Phase-3): no pricing on the site; audit is free

Supersedes brief section 8 and every price mention elsewhere in the brief.

1. There is NO published pricing anywhere on the site. No ladder, no rand amounts for build/run, no R2,000 audit fee. Prices are given privately after an audit: "we go in, see exactly what they need, then provide a price."
2. The audit is FREE: a sit-down conversation of about an hour to understand exactly what the business needs from Vyso. It is no longer a paid week and nothing is "credited against your first build". Output remains a roadmap where every item has a fixed build price and a monthly run price, delivered to the customer directly.
3. /pricing: DELETE, 301 -> /operations-audit. Repoint every existing redirect that targeted /pricing (/compare, /compare/:slug, /founding-client, /services, the vyso-vs aliases) to /operations-audit. Remove /pricing from sitemap, footer, nav, and every in-copy link ("see pricing" lines become links to /operations-audit, e.g. "start with a free audit").
4. /operations-audit absorbs the pricing page's non-price content: "A system is a job you would otherwise hire someone to do" (input/output/owner framing), the counts/does-not-count columns (no rand amounts), "anything we have not built before is quoted first, built once, and becomes a standard system for the next business", "fixed price agreed before we start", "50% on signing, 50% on go-live" (terms are fine, amounts are not).
5. Header nav: Industries, How we work, Finch, CTA "Book your free audit" -> /operations-audit. Footer Vyso column: Home, How we work, About, Contact (Pricing removed).
6. Copy sweep consequences: home hero primary button "Book your free audit" (no amount); home close and hotels close reframed around the free hour sit-down (no "one-week", no "R2,000", no "credited"); how-we-work step 1 rewritten (free, about an hour, roadmap output, take it or walk away); steps 3/4 keep fixed-price-before-we-start and one-monthly-fee framing without amounts. Hotels founding offer (20% off build, run fee frozen 12 months) survives with [CONFIRM_FOUNDING_OFFER].
7. [CONFIRM_NOTICE_PERIOD] is dropped (its FAQ died with the pricing page).
8. pricing-data.ts / JSON-LD: remove all monetary offers; audit Service becomes free (price "0" or offer removed, whichever renders valid schema.org). Scrub "R2,000" and ladder amounts from faq.ts, glossary, learn data, operations-audit calculator copy, llms.ts.
9. Final grep additions: "R2,000", "R5,000", "R12,000", "R20,000", "credited against", 'href="/pricing"' must all be zero in customer-facing scope.

## AMENDMENT 2 (owner, 2026-08-27, after Phase 3 review): visual richness restored

Supersedes brief section 13's "no gradients, no decorative illustration" reading. The owner reviewed the new pages and rejected the flat look ("boring, AI slop"). Required direction, in the owner's words: deep blues, burnt oranges, beautiful orange-blue gradients, the folk.com-inspired integration wheel we had, dynamic background, scroll triggers, visual sequences, kinso.com / attio.com energy, the scroll-triggered Vyso demo already in the site.

Rules:
1. This is VISUAL ONLY. Approved copy, routes, structure and placeholders do not change.
2. Reuse the existing craft: the `.finch-site` `--fn-*` system incl. `--fn-grad`, the ink and blue ground bands (`--fn-ink-fill`, `--fn-blue-900..300`), noise grain, STIX display type, Lenis smooth scroll, ScrollSequence, the integration wheel, existing reveal/scroll-trigger idiom. Study /finch (which kept the old home's components) and the repo's design docs (vyso-design-brief.md, .ai/design/**, .ai/research/awwwards-motion-design.md) before designing.
3. Apply to the NEW pages: /, /industries/hotels, /how-we-work, /operations-audit, /industries index. The home page especially must feel like the old home did: alternating light/ink/blue grounds, gradient accents, the scroll-driven proof sequence rather than a static card.
4. Performance and a11y idiom of the existing site (reduced-motion fallbacks as existing components do).
5. Brief rules that STILL apply: sentence case, copy rules, no new component library, mobile-first at 375px.

## Route disposition (complete)

| Route | Action |
|---|---|
| / | Rebuild as router page (Phase 3); current content moves to /finch first (Phase 2) |
| /industries | Edit: 6 tiles, hotels first/largest |
| /industries/hospitality | Replace with /industries/hotels (new slug + full new content), 301 old slug |
| /industries/hotels | NEW flagship (Phase 3) |
| /industries/catering-companies, /restaurants, /food-suppliers, /wholesale, /farms | Keep, light rewrite + scrub, "Priced per system" + /pricing link |
| /industries/security-companies, /insurance-brokers | Delete, 301 to /industries |
| /finch | NEW page holding edited current-home content (Phase 2); remove existing /finch->/ redirect |
| /pricing | Rewrite per brief section 8 |
| /how-we-work | NEW (Phase 3) |
| /operations-audit (+ calculator, score pending Q5) | Keep; audit copy: R2,000 credited against first build |
| /orbit | Convert to waitlist page (Phase 4); subpages per Q2 |
| /learn, /learn/* | Keep, scrub only |
| /about, /contact, /faq, /south-africa, /case-studies (+turn-n-slice), /integrations | Keep, scrub (+ [TNS_NUMBER] placeholders in case studies) |
| /login | Do not touch |
| /privacy, /terms, /popia | Scrub only |
| /academy | Delete, 301 to / |
| /compare (+ finch-vs-erp, finch-vs-spreadsheets, finch-vs-hiring-a-coo) | Delete all, 301 to /pricing |
| /resources (+ [slug]) | Delete, 301 to /learn |
| /platform/modules (+ [slug]) | Delete, 301 to /finch |
| /founding-client | Delete, 301 to /pricing |
| /solutions (+ [slug]) | Pending Q3 |
| /free-scan | Pending Q4 |
| /design, /onboarding, /app/**, /api/** | Untouched (internal) |

Redirects to add (all `permanent: true` in `next.config.ts`): /academy->/, /compare->/pricing, /compare/:slug->/pricing, /resources->/learn, /resources/:slug->/learn, /platform/modules->/finch, /platform/modules/:slug->/finch, /industries/security-companies->/industries, /industries/insurance-brokers->/industries, /founding-client->/pricing, /industries/hospitality->/industries/hotels, plus Q2/Q3 outcomes. Remove /finch->/. Repoint /platform/finch->/finch. Fix /apps chain.

## Phases (one commit each; build + lint must pass before the next phase starts)

### Phase 1 — plumbing and scrub (implementer: Sonnet)
1. `next.config.ts`: redirect changes above.
2. `FinchNav.tsx` + `MobileMenu.tsx`: Industries, How we work, Pricing, Finch, CTA "Book your audit". Remove Learn, Orbit, Log in. (/how-we-work and /finch pages arrive in later phases; linking ahead is acceptable within the same overall change set only if pages exist by the end — so Phase 1 may stub minimal placeholder pages for /how-we-work and /finch, replaced in Phases 2/3, OR nav lands in Phase 3. Implementer: stub pages with correct metadata, simplest option that keeps every phase's build green with no dead links.)
3. `FinchFooter.tsx`: four columns per brief section 4; line "Vyso. Built in Johannesburg." + existing email; Log in moves here.
4. Banned-phrase scrub across every surviving page/data file in scope (list in scope section). Insert `[TNS_NUMBER]` placeholders where TnS numbers existed. Replace per-location pricing mentions with "Priced per system, see pricing" + link.
5. Delete route directories for removed pages; update `app/sitemap.ts` (remove deleted routes; add nothing yet except stubs if created).
6. Root layout metadata: new default title "Vyso" + template " | Vyso", new default description per brief section 12. Update root JSON-LD Organization description; remove Finch SoftwareApplication price claims tied to R6,000 (align to per-system model; final numbers land in Phase 3, so Phase 1 may neutralise rather than perfect).
Verification: `npm run build && npm run lint`; scoped grep for all banned terms shows zero in scope (except /finch stub nothing, product code excluded).

### Phase 2 — move home to /finch (implementer: Sonnet)
1. Create `app/finch/page.tsx` from current home composition (HomeHero, ScrollSequence/BriefPhone, InvoiceCard demo, agents section, UnderTheHood renamed, FoundingQuote, integrations section).
2. Edits per brief section 9: title "Finch by Vyso. Operations intelligence for catering and wholesale."; new headline "Every supplier invoice read overnight. Every price move caught. One morning brief."; intro line "Finch is the catering and wholesale experience built by Vyso. Pricing is per system, see /pricing."; "Under the hood" becomes "How it works" with the four plain-language cards; scrub R6,000/per location/everything included/COO/tenth of the cost; keep bird, demo, brief mock, agents, integrations, Roberto quote. "Doc-U" inside the demo mock: prefer relabel to "document capture"; if kept, call out in report.
3. `app/finch/opengraph-image.tsx` with its own OG image (bird allowed here).
4. Home route: temporary minimal page (replaced in Phase 3) so build stays green.
5. Sitemap: add /finch.
Verification: build + lint + scoped grep.

### Phase 3 — new home, pricing, how-we-work, hotels (implementer: Opus, medium effort; design-sensitive)
Copy for all four pages is specified verbatim in brief sections 5-8; do not paraphrase headlines marked exact.
1. `/` router page per brief section 5: hero (exact headline/sub-line), morning-brief mock reused with "Finch" relabelled "Vyso" on this page only and bird removed, static; router grid of 5 tiles (hotels visually primary, accent border); short how-we-work strip (4 numbered steps); proof section reusing InvoiceCard with the framing line; Roberto quote + [TNS_NUMBER] numbers line; audit close. New default OG image (new hero line, no bird).
2. `/industries/hotels`: new slug in `lib/marketing/industries.ts` (or standalone page if the shared template can't express the brief's structure — implementer decides, prefer data-file consistency); full content per brief section 6 incl. six leak cards, systems list, morning-brief delivery section, founding offer with `[CONFIRM_FOUNDING_OFFER]` code comment, hotel-specific audit close. No PMS/POS names not on /integrations.
3. `/how-we-work` per brief section 7, incl. "What we do not do".
4. `/pricing` rewrite per brief section 8: audit block, ladder table (desktop table, mobile stacked cards), three paragraphs, "what counts as a system" two-column section, 3-question FAQ with `[CONFIRM_NOTICE_PERIOD]`, audit CTA. Update `pricing-data.ts` PRICE model to the ladder (1: R5,000 build / R3,000 run; 2-3: R12,000/R6,000; 4: R20,000/R8,000; +R4,000/+R2,000 after) and let JSON-LD follow; verify pricing-jsonld + layout JSON-LD render sane offers.
5. /industries index: six tiles, hotels first and largest, router lines.
6. Design rules (brief section 13): existing `--fn-*` tokens, more white space, one accent (primary button + hotels tile only), 1px borders, 12px radius cards, no gradients (avoid `--fn-grad` on new pages), sentence case, mobile checked at 375px, no new component library.
Verification: build + lint + scoped grep + manual 375px check via preview.

### Phase 4 — Orbit waitlist, industry light rewrites, meta/OG sweep (implementer: Sonnet)
1. /orbit per brief section 10: single waitlist page, own title/description/OG image, three chat-bubble examples, waitlist form (name, trade select, team size select, WhatsApp number) posting to existing `app/api/contact/route.ts` orbit variant (extend validation for new fields), "Orbit is not live yet" line, no pricing, header links back to /. Subpage deletions + redirects per Q2 answer.
2. Light rewrites of the five kept industry pages in `lib/marketing/industries.ts`.
3. Meta/OG sweep: every surviving page has own title/description; confirm `og:site_name` "Vyso"; regenerate default OG; /finch and /orbit have their own; JSON-LD Organization description final.
4. Sitemap final state; remove all deleted routes.
Verification: build + lint, then the full final grep against **built output** (`.next/server/app`, rendered HTML) for: "COO", "tenth of the cost", "per location", "R6,000", "everything included", "OrderFlow", "PricePilot", "ProcurePulse", "SupplySync", "Service Den", "ServiceDen", "Vyso Core", "Doc-U", em dash, en dash — expecting zero on marketing routes (product routes under /app excluded; Doc-U exception if kept). Produce final report per brief section 14.6.

## Verification commands (every phase)

```
cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website"
npm run build
npm run lint
```
Scoped grep example (adjust term):
```
grep -rn --include="*.ts" --include="*.tsx" -e "R6,000" app components/finch components/orbit lib/marketing lib/orbit lib/og | grep -v "app/app/"
```

## Placeholders to report at the end

- `[TNS_NUMBER]` (home proof section x2, case studies, anywhere else TnS numbers were)
- `[CONFIRM_FOUNDING_OFFER]` (hotels page, code comment)
- `[CONFIRM_NOTICE_PERIOD]` (pricing FAQ)
