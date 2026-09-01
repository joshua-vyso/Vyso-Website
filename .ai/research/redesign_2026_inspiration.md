# Vyso Redesign Research — Inspiration Sites + Live Site Inventory

Methodology note: each inspiration site was scraped (markdown + rendered HTML + full-viewport screenshot at 1920×1080) via Firecrawl. Colour hexes below were sampled directly from pixels in the captured screenshots (not from CSS source, which is obfuscated/atomic-class in all three sites and not recoverable from the rendered DOM). Treat hexes as "close to the real token, within anti-aliasing tolerance" rather than exact brand-file values. Font-family names could not be extracted from any of the three sites' shipped HTML (all strip `<head>`/use CSS-in-JS or atomic classes with no literal `font-family` string) — typography notes below are visual character assessments from zoomed crops, with a best-guess family stated where the visual evidence is strong.

---

## Polar

**Screenshot reference:** dark hero, "Meet Polar / The billing stack for the intelligence era."

**Layout & pacing (homepage, top to bottom):**
1. Thin dark announcement strip ("Introducing the Polar Startup Program →") — full-width, sits above the main nav, not inside it.
2. Main nav: logo left, center-aligned text links (Features, Docs, Blog, Company), Sign in + solid "Get Started" pill button right. Nav has no visible bottom border in the hero state — it blends into the dark body background.
3. Hero: two-line display headline ("Meet Polar" in white, then a second, longer line in mid-grey — "The billing stack for the intelligence era"), single pill CTA below, generous top/bottom whitespace, everything left-aligned (not centered) against a huge dark canvas.
4. Immediately under the hero: a 4-up row of nearly-square dark cards, each with a single thin white-stroke line illustration (concentric circles, a zigzag, +/×/○/✳ glyphs) representing product pillars (Usage billing / Subscriptions / Seats / Credits). No copy-heavy cards — icon + one line of caption.
5. Alternating "product story" sections: an eyebrow label (e.g. "Platform"), a two-line display statement split across a bold clause and a lighter continuation clause ("The brains of a finance team" / "in the body of an API"), then a supporting sentence, then a realistic product UI vignette (meter readout, checkout card, payout card) — each vignette is a single focused widget, not a full dashboard screenshot.
6. A repeating 4-step "how it works" mini-sequence (Measure → Aggregate → Calculate → Bill) as small stacked cards.
7. Testimonial strip: quote cards with headshot, name, company, and a linked tweet/story — plain white-on-dark cards, no star ratings or logos-only wall.
8. Pricing: 4-tier card row (Starter/Pro/Growth/Scale) + a distinct "Startup Program" callout card in a different accent treatment.
9. Closing CTA band ("From usage to revenue — Integrate in an afternoon") — same visual weight as hero, acts as a bookend.
10. Footer: 4-column link grid (Features / Resources / Company / Support) + copyright line, on the same near-black background — no visual footer "block" separation, it just continues the page.

**Navigation:** Overview / Documentation / Pricing / Blog / Company / Open Source / Polar on X in an expanded state (from HTML), condensed to Features/Docs/Blog/Company in the default header. Sign in is a plain text link; "Get Started" is the only filled button — one primary CTA per screen, repeated verbatim at top and bottom.

**Typography:** Geometric/grotesque sans, tall x-height, single-story lowercase forms, wide-ish natural letter-spacing (not tightened) — visually close to Founders Grotesk / Neue Montreal / Suisse Int'l. Display headline is a lighter weight than you'd expect (regular, not bold) with the second line rendered in an even lighter grey — this "bold-then-fade" two-line hero pattern repeats across every section header. Body copy is small, muted grey, sentence case, no exclamation/hype language.

**Colour (sampled from screenshot):**
- Page background: `#090909`–`#0B0B0B` (not pure black)
- Header/announcement strip / card backgrounds: `#111111`–`#181818`
- Primary text: `#FFFFFF`
- Secondary text: mid-grey, roughly `#7A7A7A`–`#8A8A8A`
- Buttons: inverted — solid white pill (`#FFFFFF`) with black text as the only accent colour in the entire palette. No brand hue (no blue/purple accent) — contrast alone carries hierarchy.

**Borders / cards / shadows:** Hairline 1px dividers in near-black (`#111`-ish, barely distinguishable from bg) separate the 4-up icon cards — almost no visible radius (square-cornered cards), no drop shadows anywhere (flat, print-like). Radius shows up only on pill buttons (fully rounded, ~999px).

**Product demonstration:** Small, single-purpose UI "widgets" (a meter, a checkout row, a payout card) embedded directly in the marketing copy rather than full dashboard screenshots — each widget illustrates exactly the one sentence next to it.

**Motion:** Not directly observed via interaction in this pass (static capture only), but the content structure (numeric values like "1.2M tokens", "$20/mo", "+86%") strongly suggests animated counters/tickers on scroll-into-view, consistent with Polar's known billing-metrics aesthetic. Likely subtle: number count-up, no parallax, no large transform animations.

**Footer:** Simple 4-column sitemap + copyright, zero visual separation from the last content section — footer treated as "more of the same page," not a distinct dark/light band.

---

## Attio

**Screenshot reference:** white hero, "Welcome to agentic revenue."

**Layout & pacing (homepage, top to bottom):**
1. Black announcement strip ("Orchestrate revenue agents with Workflows →") with a dismiss (×) — full width, sits above nav.
2. Nav: logo left, dropdown mega-menu items (Platform, Resources) + flat links (Customers, Pricing), Sign in (ghost) + "Start for free" (solid dark) right. The "Platform" dropdown (seen in the scraped HTML) is a full mega-menu grouped into sub-sections: CRM Platform / Agents and automations / Insights / Ecosystem / Get started / Support / Developers / Partners / Company — each item has a small two-tone (light/dark) icon plus a title + one-line description.
3. Hero: centered (unlike Polar/Vyso's left-aligned patterns), large bold black headline, centered grey subhead (2 lines), 3 CTAs of descending visual weight (ghost "Talk to sales", solid black "Start for free", plain-text "Send me a demo").
4. Immediately below: a live-feeling product screenshot in a macOS-style window chrome (traffic-light dots, app sidebar, chat panel with a "Thinking…" state) — this is the single hero visual, not a row of logos first.
5. Customer-story link row directly under the hero screenshot (Granola / Modal / Railway / Taskrabbit), styled as plain text links, not logo marks — an unusual, low-key trust signal placement.
6. A long "sticky-scroll" narrative section: one persistent section headline ("The intelligent system that never sleeps…") with an in-page tab/anchor list (Build pipeline / Convert leads / Run sales motions / Forecast revenue / Retain and expand) — each tab scrolls to a sub-story with its own eyebrow caption, one-line bold takeaway ("Free your reps to sell.", "Agents dig. You close.", "Catch changes to the deal.") and a bespoke UI mockup (kanban pipeline board, enrichment cards, workflow builder diagram, forecasting SQL panel, account-health chart). This is the core "operational storytelling" mechanism — reuses the same visual grammar (small bold headline + one sentence + one focused screenshot) five times in a row, each time with a different but consistent UI chrome.
7. "Universal Context™" section — a distinct sub-brand callout, four short paired statements ("It logs itself." / "Your tools finally talk." / "Gets to know you." / "Ask, and it's there.") laid out as a compact grid, not another giant screenshot — a deliberate pacing break after five heavy visual sections.
8. Integration logo marquee (Claude, Notion, Slack, Linear, etc.) — auto-scrolling row, repeated 3× in the DOM (confirms an infinite-scroll marquee).
9. Stats band: 4 large numbers (2.6M MCP calls/month, 400M API calls/week, etc.) — plain white background, bold numerals, small caption underneath.
10. Customer stories carousel with cover images + stat callout ("83% faster lead triage").
11. Changelog teaser (4 recent entries) + email capture ("Product updates in your inbox").
12. Closing CTA band, identical structure to the hero (headline + 3 CTAs).
13. Footer: 5-column link grid (Platform / Company / Import from / Attio for / Apps / Resources) + social icons + legal links + cookie banner.

**Navigation:** Mega-menu with icon + title + description per item, organized into named sub-groups — far more information-dense than Polar or Kinso. Primary CTA ("Start for free") is a solid near-black pill/rounded-rect; secondary CTA ("Talk to sales") is white with a thin grey border — both same size/weight, difference is fill only.

**Typography:** Bold grotesque sans for display type — tighter letter-spacing than Polar, closer to a modern humanist/grotesk hybrid (visually similar to a Söhne/Neue Haas Grotesk/Inter-Bold character: double-story 'a', straight-cut terminals). Headline weight is consistently heavy/bold (unlike Polar's light hero), body copy and nav are a lighter weight of the same family. Numerals in the stats band are large and tabular.

**Colour (sampled from screenshot):**
- Page background: `#FFFFFF`
- Announcement strip: `#000000` (pure black, only place black is used as a fill)
- Primary heading text: near-black `#232426`
- Secondary/nav text: grey `#545456`–`#BBBDBF` (a full grey ramp is in use for hierarchy, not just one grey)
- Primary button fill: near-black (`~#17181A`) — same near-black family as headings, not pure `#000`
- Secondary button: white fill (`#FCFCFC`) + light grey border (`#CAD0D9`)
- App-mockup chrome: white content (`#FFFFFF`), sidebar `#F6F6F6`, active nav row `#EEEFF1`
- No saturated brand hue is used on the marketing shell itself — colour only appears *inside* the product screenshots (chart lines, status badges), which is a deliberate device: the brand is neutral, the product is colourful.

**Borders / cards / shadows:** App-window mockups use a realistic macOS chrome (colour-dot traffic lights, rounded ~10–12px window corners, soft ambient shadow lifting the window off the white page). Buttons are rounded-rect (~8–10px radius, not full pill). Sidebar items have subtle rounded-rect hover/active states (`#EEEFF1`), 1px hairline borders throughout the mocked app UI to imply a real product, not a mockup.

**Product demonstration:** The dominant device is a realistic, branded fictional company ("Basepoint") running through actual workflows (a deal thread, a Slack-style agent command, a kanban board with real-looking company logos, a chat "Thinking…" state) — every section pairs one plain-English claim with one convincing, narratively-specific screenshot (named people, named companies, real dollar figures). This is "operational storytelling": the product is shown *doing a job in a story*, not shown as a feature-tour screenshot.

**Motion:** Not captured via interaction, but the repeated identical headline+CTA block appearing twice in the markdown (once near the top nav, once mid-page) strongly indicates a sticky/pinned hero that persists while the anchor-tab content scrolls beneath it — a classic "pinned narrative, changing visual" scrollytelling pattern. The "Thinking" and animated chat-bubble language in the scraped DOM also implies looping/typing micro-animations inside the product mockups (not page-level parallax).

**Footer:** Dense 5-column sitemap, small caps section labels, social row, legal line, cookie consent banner overlapping bottom-left corner — much more "enterprise SaaS" footer than Polar's minimal 4-column version.

---

## Kinso

**Screenshot reference:** warm gradient hero, "One inbox, every conversation."

**Layout & pacing (homepage — this is a single, shorter landing page, not a multi-section scroll epic):**
1. No announcement strip. Nav is a floating, rounded pill-shaped bar (not full-width, has visible margin and its own background/shadow separate from the page) — logo (an origami/paper-fold mark in warm terracotta) + About/Features/FAQs + Login (outline pill) + Get Started (solid black pill).
2. Hero: warm gradient background (peach/coral top-left fading to soft blue-teal top-right, fading to white by mid-page), bold black two-line display headline, short grey/dark supporting paragraph, no visible button in the hero itself (CTA sits lower, near the waitlist count) — the hero's real job is the giant dual-device product shot (a browser-style "inbox" mockup plus a floating phone mockup) with small floating notification cards (Gmail/WhatsApp/LinkedIn-branded) overlaid on top, each styled as a little white card with an app icon, sender name, and one-line message preview.
3. Social proof number: "Join 18,969 others on the waitlist" + solid black "Join now" pill — positioned as its own centered mini-section, not tucked into the hero.
4. Integrations bar: horizontal marquee of real app logos (Gmail, Slack, Instagram, WhatsApp, LinkedIn, Outlook) — repeated multiple times in the DOM (confirms infinite scroll here too, same device as Attio's logo row).
5. Three feature blocks, each: a small caps eyebrow (DRAFT RESPONSE / UNIVERSAL SEARCH / CONTEXTUAL ASSISTANT), a bold one-line claim, 1–2 sentences of plain explanation — text-first, screenshots handled separately in an image grid rather than one-per-claim.
6. A restated positioning paragraph in a distinct type treatment (tight letter-spacing, almost run-together — "Whetheryou'recirclingback…") — reads as a deliberate stylistic flourish, unusual and a bit of an outlier vs. the rest of the page's clean setting.
7. FAQ accordion (5 short Q&As + one linked-out question).
8. Footer: logo + tagline, 3 short link columns (Product / Legal / About), social icons (Instagram/TikTok/YouTube — notably consumer-social channels, not LinkedIn/X), copyright + full street address (Sydney, AU).

**Navigation:** Smallest/simplest of the three — 3 links + 2 buttons, floating pill nav rather than an edge-to-edge bar. No mega-menu, no dropdowns.

**Typography:** Bold, rounded/humanist sans with noticeably tight (near-negative) tracking on the display headline — letters visually touch/overlap slightly ("inbox," "conversation."), giving a warm, friendly-but-confident feel distinct from Attio's more clinical tight-tracking bold. Body copy is a plain, comfortable-reading humanist sans (visually close to Inter or a similar default), regular weight, generous line-height. Overall typographic contrast (display vs. body) is the largest of the three sites.

**Colour (sampled from screenshot):**
- Hero background: warm gradient, roughly `#ECD0C5` (peach) → `#BBCFCF` (soft teal), fading to white
- Headline/body text: near-black `#0A0A0A`
- Nav pill background: near-white `#FBFBFB`, floating on the gradient with a soft shadow
- Primary buttons (Get Started / Join now): solid black pill, white text
- Secondary button (Login): white/near-white pill with a thin border
- Logo mark: warm terracotta/coral — the one spot of "brand hue" saturation on the page, echoed in the gradient background

**Borders / cards / shadows:** Soft, visible drop shadows are used more than the other two sites — the floating nav pill, the notification cards, and the phone mockup all sit "above" the page with soft ambient shadow. Radius is generous throughout: full pill on buttons and nav, ~12–16px rounded corners on notification cards and device mockups. This is the "warmest"/most tactile of the three — shadows and gradients do work that Polar and Attio deliberately avoid.

**Product demonstration:** A single big "hero device" shot (inbox + phone side by side) with small floating notification cards layered on top simulating real-time activity — a collage/composite approach rather than Attio's narrative screenshots or Polar's single-purpose widgets. Feature sections below use a separate image grid rather than one bespoke mockup per claim.

**Motion:** Framer-built (confirmed by `<!-- Made in Framer -->` marker in source) — Framer sites overwhelmingly default to on-scroll fade/slide-up reveals per section and a looping/cycling animation on floating notification cards (cards appearing and disappearing to simulate "live" activity). Not confirmed via direct interaction in this pass, but consistent with both the visual design (floating cards clearly built for a loop) and the platform's out-of-the-box behavior.

**Footer:** Warm, small, personal — includes a physical street address and consumer-social icons, reinforcing the "friendly personal-assistant" positioning rather than an enterprise-SaaS footer.

---

## Synthesised design rules

*"Polar's restraint + Attio's operational storytelling + Kinso's warmth" — a shared vocabulary a developer can implement directly.*

1. **One primary action, repeated verbatim.** Every site has exactly one solid/filled CTA style used everywhere (Polar: white pill; Attio: near-black rounded-rect; Kinso: black pill). Do not introduce a second "primary" colour — vary only ghost/outline treatments for secondary actions.
2. **Two-tier headline construction.** Lead with a short, high-contrast clause (bold/white/black) then immediately follow with a longer, lower-contrast continuation clause (lighter weight or lighter colour) — used by all three for hero and section headers. Gives scannable hierarchy without shrinking type size.
3. **Neutral shell, colourful product.** None of the three uses a saturated brand hue on chrome/nav/buttons (Kinso's coral logo mark is the sole exception, and it's tiny). Colour is reserved for what's *inside* the product mockups (charts, status pills, notification icons). Keep Vyso's marketing shell to near-black/near-white/greys; let Finch's actual UI (price deltas, rand figures, status badges) carry the colour.
4. **Pair every claim with one focused visual, not a dashboard dump.** Attio and Polar both show one small, purpose-built UI vignette per sentence (a meter, a kanban card, a chat bubble) rather than one big feature-tour screenshot. Vyso's existing "invoice → extraction → price memory → finding → brief" pipeline (seen on the live homepage) is exactly this pattern already — keep it, and extend it to other modules (ShiftBoard, OrderFlow) with the same one-vignette-per-claim discipline.
5. **Real names, real numbers.** Attio's mockups use named fictional companies/people and specific dollar figures; Vyso's own homepage already does this well (FreshCo, R58,000/yr, Thyme & Basil). This specificity is what makes B2B ops software feel credible — never use generic Lorem-style mockups.
6. **Sticky/tabbed narrative for multi-feature sections.** Attio's five-part "intelligent system" section (one persistent headline + anchor tabs + changing mockup) is the strongest pattern for showcasing Vyso's 10 modules without a flat, repetitive grid. Consider it for the modules page.
7. **Full pill buttons signal "consumer-friendly"; rounded-rect (~8–10px) signals "enterprise tool."** Polar and Kinso (both closer to prosumer/indie) use full pill radius; Attio (enterprise CRM) uses a tighter rounded-rect. Pick one radius family and apply it consistently to buttons, inputs, and cards — don't mix pill nav with rectangular cards.
8. **Card/window chrome sells "real product."** Attio and Kinso both wrap product shots in a recognisable OS/app chrome (macOS traffic lights, browser bar, phone frame) rather than a bare cropped screenshot — this alone reads as "this is a real, running tool," which matters for Vyso's credibility with SME buyers who are skeptical of vapourware.
9. **Shadow and gradient are a warmth dial, not a default.** Polar uses zero shadow/zero gradient (coldest, most confident). Attio uses shadow only under floating app-chrome, on a pure white field (neutral). Kinso uses gradient background + soft shadow on almost every floating element (warmest). Choose deliberately per section: use Kinso-style warmth on top-of-funnel/emotional sections (hero, testimonials) and Polar/Attio-style flatness on data-dense sections (pricing tables, comparison grids).
10. **Grey ramp does the hierarchy work, not size alone.** All three sites use a 3–5-step grey ramp (near-black heading → mid-grey subhead → light-grey caption/border) rather than jumping straight from black to a light accent colour. Define this ramp as CSS variables up front (e.g. `--ink-900/700/500/300`) and use it for every non-CTA text/border decision.
11. **One infinite marquee, used once.** Both Attio and Kinso use exactly one auto-scrolling logo/integration marquee, positioned right after the hero or high in the page — not repeated elsewhere. Vyso already has 12 real integration logos (Xero, WhatsApp, Yoco, Sage, etc.) on the live homepage; keep this as the single marquee moment, don't duplicate the pattern lower on the page.
12. **Footer density should match brand register.** Polar (developer-tool, lean) = 4 columns, no visual separation from body. Attio (enterprise SaaS) = 5+ dense columns, distinct footer band, cookie banner. Kinso (consumer-facing) = short, personal, physical address, consumer-social icons. Vyso is B2B SME software with real ZA compliance needs (POPIA, terms, pricing) — footer density should land between Polar and Attio: comprehensive but not overwhelming, and must surface Privacy/Terms/POPIA prominently given the South African legal context already present in the current sitemap.
13. **Reserve tight letter-spacing for the boldest, shortest headlines only.** Attio and Kinso both tighten tracking specifically on 2–4 word bold display lines; body copy and longer headlines stay at normal tracking. Don't apply a single "tight tracking" rule globally — it only reads well on short, heavy type.
14. **Testimonials as evidence, not decoration.** Polar's testimonial cards pair a real headshot + name + company + a link to the original source (tweet/story) — treat quotes as citable claims, not filler. Vyso's existing Turn 'n Slice quote ("Finch automates our invoicing, ordering...") should get this same full-attribution treatment (photo if available, named founding client, link to the case study page) rather than a bare pull-quote.
15. **Motion should be diegetic, not decorative.** None of the three relies on page-level parallax or big transform animations (based on available evidence); animation lives inside the mockups themselves — a chat bubble "thinking," a notification card appearing, a number ticking up. Any Vyso motion budget should go toward making the Finch brief/agent UI feel alive (numbers counting, a new finding sliding in), not toward hero background effects.

---

## Live vyso.co.za URLs

Source: `https://vyso.co.za/sitemap.xml` (98 URLs, current as of scrape) cross-checked against `firecrawl_map` (same URL set, plus confirms the bare root `https://vyso.co.za`). This list is the canonical basis for a 301 redirect map — **completeness over content** per the task brief.

**Root**
- `/`

**Platform / modules**
- `/platform`
- `/platform/vyso-for-smes`
- `/platform/modules`
- `/platform/modules/orderflow`
- `/platform/modules/doc-u`
- `/platform/modules/procurepulse`
- `/platform/modules/pricepilot`
- `/platform/modules/planwise`
- `/platform/modules/wastewatch`
- `/platform/modules/shiftboard`
- `/platform/modules/supplysync`
- `/platform/modules/insightgen`
- `/platform/modules/serviceden`

**Geography**
- `/south-africa`

**Conversion / offers**
- `/founding-client`
- `/pricing`
- `/contact`
- `/operations-audit`
- `/operations-audit/score`
- `/operations-audit/calculator`

**Industries**
- `/industries`
- `/industries/restaurants`
- `/industries/food-suppliers`
- `/industries/farms`
- `/industries/catering-companies`
- `/industries/wholesale`
- `/industries/hospitality`
- `/industries/security-companies`
- `/industries/insurance-brokers`

**Case studies**
- `/case-studies`
- `/case-studies/turn-n-slice`

**Company / info**
- `/about`
- `/academy`
- `/faq`
- `/integrations`

**Solutions**
- `/solutions`
- `/solutions/reduce-money-leakage`
- `/solutions/procurement-automation`
- `/solutions/reporting-automation`
- `/solutions/operations-dashboard`

**Comparisons**
- `/compare`
- `/compare/finch-vs-hiring-a-coo`
- `/compare/finch-vs-spreadsheets`
- `/compare/finch-vs-erp`

**Learn (blog/articles)**
- `/learn`
- `/learn/why-businesses-lose-money-without-realising-it`
- `/learn/15-signs-your-business-has-operational-chaos`
- `/learn/how-much-time-can-workflow-automation-save`
- `/learn/hidden-cost-of-manual-procurement`
- `/learn/supplier-scorecards-what-to-track-and-why`
- `/learn/why-weekly-reports-are-usually-too-late`
- `/learn/the-real-cost-of-poor-stock-control`
- `/learn/ai-for-small-and-medium-businesses-practical-use-cases`

**Learn / glossary**
- `/learn/glossary`
- `/learn/glossary/fractional-coo`
- `/learn/glossary/operations-audit`
- `/learn/glossary/money-leakage`
- `/learn/glossary/gross-margin-vs-markup`
- `/learn/glossary/debtors-ageing`
- `/learn/glossary/delivery-note-reconciliation`
- `/learn/glossary/price-creep`
- `/learn/glossary/stock-cover-days`
- `/learn/glossary/vat-inclusive-pricing`
- `/learn/glossary/popia`
- `/learn/glossary/weekly-brief`
- `/learn/glossary/invoice-line-item`

**Resources (lead magnets)**
- `/resources`
- `/resources/operations-audit-checklist`
- `/resources/weekly-operations-report-template`
- `/resources/supplier-scorecard`

**Orbit (separate sub-product for trades)**
- `/orbit`
- `/orbit/how-it-works`
- `/orbit/pricing`
- `/orbit/faq`
- `/orbit/waitlist`
- `/orbit/for`
- `/orbit/compare/orbit-vs-job-management-apps`
- `/orbit/compare/orbit-vs-spreadsheets`
- `/orbit/learn`
- `/orbit/for/plumbers`
- `/orbit/for/electricians`
- `/orbit/for/tilers`
- `/orbit/for/painters`
- `/orbit/for/builders`
- `/orbit/for/handymen`
- `/orbit/for/carpenters`
- `/orbit/for/roofers`
- `/orbit/for/solar-installers`
- `/orbit/for/landscapers`
- `/orbit/learn/how-to-track-jobs-on-whatsapp`
- `/orbit/learn/invoice-from-whatsapp-south-african-invoice-requirements`
- `/orbit/learn/why-tradespeople-lose-money-between-the-job-and-the-bank`

**Legal**
- `/privacy`
- `/terms`
- `/popia`

**Not in sitemap.xml but reachable (per firecrawl_map crawl of live links) / login-gated**
- `/login` (linked from homepage nav "Log in" — not in sitemap, likely `noindex` app entry point; confirm before excluding from redirect map)

Total: **98 URLs in sitemap.xml** (root through last Orbit learn article), plus the app-login entry point discovered separately.

---

## Live homepage snapshot

**Important discrepancy for the redesign team:** the site's own `sitemap.xml`/crawl metadata (via `firecrawl_map`) reports the homepage `<title>` as **"Vyso | Operations Software & Automation for SMEs"** with a description about diagnosing "operational chaos" — but a **fresh, uncached scrape of the live homepage** (this session, `cacheState: miss`) shows the actual rendered page is branded **"Finch by Vyso"**, a distinct, narrower product story. This suggests either (a) the map/crawl index is stale relative to a very recent re-launch, or (b) different metadata is served under different conditions. **Recommend the team manually re-verify what vyso.co.za shows live right now before finalizing the redirect map**, since "which version is deployed" directly affects which old sections need 301s.

**What the live-scraped homepage actually contains (as of this scrape):**

- **`<title>`:** "Finch by Vyso — your company's own COO, at a tenth of the cost"
- **Meta description:** "Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI agents watch your invoices, stock, suppliers and margins — catch money leaking, and tell you what to do about it. Built by Vyso for South African food businesses."
- **OG description:** "Vyso is a Johannesburg company whose product, Finch, is an AI operations assistant for South African food and produce SMEs. R6,000 per location per month."
- **Nav items:** logo ("Finch" wordmark, links home) — Industries — Pricing — Learn — Orbit — Log in — **Book your audit** (primary CTA)
- **Hero headline:** "Meet Finch. Your company's own COO — at a tenth of the cost."
- **Hero subhead:** "Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI agents watch your invoices, stock, suppliers and margins — catch money leaking, and tell you what to do about it. Built by Vyso for South African food businesses. R6,000 per location, everything included."
- **Hero CTA:** "Book your audit" button + "ONE-WEEK OPERATIONS AUDIT · R2,000" microcopy alongside it.
- **Hero visual:** an animated-looking "Price Watch" notification card (butternut price up 12% at FreshCo, ≈R58,000/yr impact) plus a "Finch bird" mascot mark — mirrors the "floating notification card over product visual" pattern seen on Kinso.
- **First scroll section:** "From paper to a decision, while you serve customers" — a fully worked example: a real-looking tax invoice from "FreshCo Produce Market," line-item extraction with confidence score (99.2%), and a price-trend chart, i.e. Vyso already practises the "specific, named, numeric" storytelling principle noted above.
- **Second section:** "Finch is ready to go, whenever you need it" — a full daily-brief UI mockup (Price Watch / Debtors / Reconciliation / Stock findings, each with rand-value impact and a "draft email"/"dismiss" action row) — labelled "01 Invoice in → 02 Extraction → 03 Price memory → 04 The finding → 05 Your brief," a five-step sticky-narrative structure directly comparable to Attio's five-tab section.
- **"What Finch watches" section:** module cards for Price Watch, Recon, Debtors, Stock Sense, The Brief, Delivery Watch — most marked "FROM YOUR AUDIT ROADMAP" (i.e., aspirational/rolling-out), with "Document intelligence (Doc-U) is live today" as the one confirmed-live capability.
- **Integrations section:** "We put your current tools into Finch" — 11 real integrations shown (Xero, WhatsApp, Yoco, Sage, Loyverse, QuickBooks, Gmail, Outlook, Notion, n8n, SimplePay), each paired with a natural-language command example ("Finch, fetch our books from Xero").
- **Testimonial:** single quote from "Roberto · Turn 'n Slice · Johannesburg · Founding Client."
- **"Under the hood" section:** four capability labels (Extraction / Price Memory / Reconciliation / Brief Composer).
- **Closing CTA:** "Start with a one-week Operations Audit" — R2,000, credited to first month — repeats the "Book your audit" button.
- **Footer nav groups:** Finch (Home / What Finch watches / Under the hood / Integrations / Pricing / Compare), Vyso (About / Orbit / Operations Audit / Founding client / Academy / Case studies / Contact), Learn (Articles / Resources / FAQ / South Africa), Legal (Privacy / Terms / POPIA).

This confirms the live site is currently positioned around the **"Finch" product name** with Vyso as the parent-company frame, R6,000/location pricing, and a South African food/produce SME focus — worth reconciling with whatever the redesign brief assumes the current brand/product name is before building the new nav and redirect map.
