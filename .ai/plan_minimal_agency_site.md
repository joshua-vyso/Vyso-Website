# Plan: minimal agency site (SUPERSEDES plan_site_repositioning.md)

Owner directive 2026-08-27 (final, approved, execute immediately): minimal pages. Home, designed product pages (Finch, Orbit), positioning for any SME to reach out, minimal SEO/AEO/GEO pages, POPIA and privacy. Positioning: AI automation agency. Keep the existing design language and add onto it. Rank for "AI automation agency South Africa" type searches. The site must feel alive: Kinso, Attio, folk.com energy, scroll triggers, the gradients and deep blue / burnt orange grounds the old site had.

## Positioning

Vyso is an AI automation agency in Johannesburg for South African SMEs. We build operational automation around the way a business already works: supplier invoices, orders, stock, quotes, debtors, watched daily. Free audit: we sit with you for about an hour, understand exactly what your business needs, then give you a fixed price for each system, privately. Finch (catering and wholesale) and Orbit (trades, waitlist) are the productised experiences.

Words: "agency" is now ALLOWED and wanted (it is the search target). Still banned: COO, tenth of the cost, per location, R6,000, everything included, module codenames (OrderFlow, PricePilot, Doc-U, ProcurePulse, SupplySync, ServiceDen), Vyso Core, any rand amount anywhere, em/en dashes in copy, "ZAR" in prose (JSON-LD priceCurrency exempt), invented client numbers ([TNS_NUMBER] placeholders stand). SA spelling, sentence case, "ERP"/"platform" still avoided in prose.

## Site map (final, minimal)

KEEP:
- /            rebuilt: the agency page (see below)
- /finch       keep as is (it is the design reference); align its intro line to agency positioning if needed
- /orbit       designed waitlist page (old brief section 10 spec: headline "Jobs, quotes and invoices, from the WhatsApp you already use.", honest "not live yet" line, three chat bubbles, waitlist form name/trade/team size/WhatsApp via existing /api/contact orbit variant, no pricing, own OG image); design it to the same standard as home
- /contact     keep (the reach-out page; scrubbed already)
- /about       keep, tighten copy to agency positioning (entity SEO)
- /faq         keep, rework top entries toward AEO answers ("What does an AI automation agency do?", "Who is Vyso?", "What does it cost?" -> free audit then fixed prices privately)
- /south-africa keep, rework toward GEO/local intent ("AI automation agency in South Africa / Johannesburg")
- /learn, /learn/* keep untouched apart from already-done scrub (SEO)
- /privacy, /terms, /popia keep
- /login untouched, /app/** untouched, robots untouched, llms.txt updated to new positioning

DELETE + 301 (add to next.config.ts; keep every already-shipped redirect, retarget any that point at deleted pages):
- /industries and /industries/* -> /
- /how-we-work -> /
- /operations-audit (+ /calculator, /score) -> /contact
- /case-studies (+ turn-n-slice) -> /
- /integrations -> /finch
- /free-scan stays untracked-owner-WIP; not linked, not deleted
Sitemap: prune to the keep-list. [TNS_NUMBER]/[CONFIRM_FOUNDING_OFFER] placeholders survive only where their pages survive (home proof if used).

## Home page (/) — the centrepiece

Copy is drafted by the implementer in the approved voice (headline retained if it fits: "Your business is running on WhatsApp and spreadsheets. That ends here."), structured roughly:
1. Hero: agency positioning, alive (gradient/ground treatment, morning-brief mock or scroll sequence as visual), CTA "Talk to us" -> /contact and secondary to /finch.
2. What we automate: orders, supplier invoices, stock, quotes, debtors, in the customer's vocabulary; any SME can see itself here (not vertical-gated).
3. How it works: audit (free, an hour, roadmap with fixed prices given privately) -> map -> build -> run. Compact, visual sequence.
4. Proof: FreshCo invoice-to-decision scroll sequence (Vyso-labelled, no bird) + Roberto quote + [TNS_NUMBER] line.
5. Products: two designed cards, Finch (live, catering and wholesale) and Orbit (waitlist, trades).
6. Close: talk to us.

## Design mandate

Keep and extend the `.finch-site` `--fn-*` language: deep blues (--fn-blue-900..300), burnt orange (--fn-orange, --fn-orange-cta), orange-blue gradients (--fn-grad), ink ground bands with NavGround inversion, grain, STIX display type, Lenis scroll, ScrollSequence, the folk-inspired integration wheel, hover-lift cards (1px border, 12px radius). References: kinso.com, attio.com, folk.app. Reduced-motion fallbacks per existing idiom. Mobile holds at 375px. No new component library or fonts.

## SEO / AEO / GEO

- Root title: "Vyso, AI automation agency in South Africa" (template "%s | Vyso"); description repositioned accordingly.
- JSON-LD: Organization stays, description "AI automation agency in Johannesburg..."; keep free-audit Service offer (price 0 ZAR); Finch SoftwareApplication stays.
- Target queries: "AI automation agency South Africa", "AI agency Johannesburg", "AI automation for small business South Africa". Weave naturally into home, about, south-africa, faq; no keyword stuffing.
- llms.txt/llms-full.txt regenerated from new positioning. IndexNow infra untouched.
- Every kept page: own title/description; og:site_name "Vyso"; default OG regenerated with agency line; /finch and /orbit keep own OG images.

## Execution (single Opus implementer, work in the live repo so HMR shows progress, two commits)

Commit 1 "site: minimal agency structure": redirects, route deletions, sitemap, nav (Vyso wordmark, Finch, Orbit, About, CTA "Talk to us" -> /contact), footer (minimal: Vyso: Home, About, Contact / Products: Finch, Orbit / More: Learn, FAQ, South Africa, Log in / Legal: Privacy, Terms, POPIA; line "Vyso. Built in Johannesburg." + email), root metadata + JSON-LD + llms, faq/south-africa/about copy alignment.
Commit 2 "site: agency home and orbit, alive design pass": home rebuild, orbit page, design polish, screenshot-verified desktop + 375px.
Gates: npm run build && npm run lint (zero new errors) before each commit. Never stage untracked files (.ai/, free-scan, instrumentation-client.ts, lib/posthog-server.ts); stage by explicit path. Do not front or navigate the owner's "seed" browser tab; use your own background tab for screenshots.
