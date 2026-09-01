# Primary Reference Research — Premium AI-Automation-Agency Redesign

Captured 2026-09-01 via Firecrawl (`firecrawl_scrape` + `firecrawl_map`). Each site: homepage scraped in full (markdown + screenshot where available), plus 1–3 internal pages. Vyso's current live site (vyso.co.za) is included as the "before" record for the redesign this research supports.

---

## 1. COSMOQ — https://cosmoq.framer.website/

**URLs inspected:** `/` (home), `/pricing`, `/about`, `/ai-solutions`

**Context:** This is explicitly a **Framer template for sale** ("COSMOQ - Automation and AI Agent Template", designed by Jitu Raut / fremix.design, with a "Buy Now" checkout link in the footer). Content is placeholder/generic AI-startup copy, not a real operating company — team names (Ethan Cole, Sofia Andersson, etc.) and testimonials (Daniel Reyes/LuminaTech, Sarah Mitchell/Nexora) read as template filler. Treat as a **visual/structural** reference only, not a credible copy or positioning reference.

### Navigation structure
Top nav: AI Solutions · About · Pricing · Contact · [Get Started] CTA (goes to `/pricing`). Footer nav split into Navigation / Documentation / Other Pages / Social Connect columns — fairly standard SaaS template footer.

### Hero headline + subhead (verbatim)
- Headline: "Next‑gen enterprise with AI Agents" (rendered as squished/kerned "Next-genenterprisewithAIAgents" in scrape — a Framer text-animation artifact)
- Subhead: "Accelerate the speed of business with the COSMOC Platform and our AI solutions for work, service, and process." (note: typo "COSMOC" instead of "COSMOQ" in the live subhead)
- Announcement bar above hero: "Beta Version is launching on 12th September"
- Primary CTA: **Get Started** → `/pricing`

### Section sequence (homepage)
1. Top announcement bar ("Beta launching...")
2. Hero (headline, subhead, CTA, large product screenshot)
3. Logo strip (client/partner logos, looping)
4. "EXCEPTIONALITIES" — What sets COSMOQ apart (Speed / Deep capabilities / Control / Flexibility, each with a full-bleed image + one-line claim)
5. Secondary CTA band ("Ready to get started?" — Get Started / Get in touch)
6. "FEATURES" — All-in-one AI for enterprise (3 tabbed feature blocks: AI Agent for work, Alpha Technology, Enterprise data sources — each with a screenshot and "See Uses / Explore Tech / Start Setup" link)
7. "PRODUCTS" — Multiple Products (tabbed: Automation / Banking / Recruitment, plus 4 icon-tiles: Healthcare, Marketing, Ecommerce, Development)
8. "STEPS TO USE" — 3 Steps to Kickstart (numbered 01/02/03 with screenshots: sign-in, choose agent, prompt or automate)
9. "DATA AND PRIVACY" — Multi-Layer Security (stacked device screenshots)
10. "TESTIMONIALS" — Trusted by customers (looping carousel, 3 unique quotes repeated ~4x)
11. "PRICING" — Flexible Plans (Monthly/Yearly toggle, 30% off yearly; 3 tiers: Sonic $49/mo, Supersonic $99/mo, HyperSonic "Contact Us")
12. "FAQ" — Curious About Cosmoq? (8 accordion questions, collapsed)
13. "INTEGRATION" — Smart Versatile Agent-driven Integration (icon grid + Know More link)
14. Final CTA band — "Step Into COSMOQ" + Get Started
15. Footer (4-column nav + social + Framer credit + cookie banner)

### Conversion paths / CTAs
- **Get Started** (nav, hero, mid-page, final band) → all point to `/pricing`
- **Get in touch** → `/contact`
- **See Uses / Explore Tech / Start Setup** → deep-link to feature sub-pages
- **Contact Us** (pricing tiers) → `/contact` (no self-serve checkout despite "Get Started" language — everything funnels to a contact/pricing page, not an actual signup flow)
- Pricing page also has a **Comparison** table (Basic/Standard/Enterprise) that doesn't match the 3 named tiers above it (Sonic/Supersonic/HyperSonic vs Basic/Standard/Enterprise) — an internal inconsistency worth noting as an anti-pattern.

### Copy tone and density
Generic, confident, buzzword-forward SaaS marketing voice: "Accelerate," "Unlock efficiency, automation, and innovation across every workflow," "Smarter, faster, and more adaptive than traditional AI solutions." Headlines are short (3–6 words); body copy is one sentence per section. Very low information density — this is a template meant to be swapped with real content.

### Typography / imagery observations
- Uses Framer's default web fonts (not identifiable from markdown; screenshot shows a clean geometric sans, dark background, high contrast white/off-white text).
- Dark theme throughout (`color-scheme: light dark` present in meta, screenshot shows near-black background).
- Heavy use of full-bleed product screenshots and abstract line-art SVG overlays (decorative wireframe polygon patterns behind feature blocks — visible in the raw SVG paths embedded in the markdown, e.g. dashed/solid geometric line art at low opacity).
- Numerous small icon/logo placeholders (integration icons, security icons) — generic icon-grid pattern used repeatedly for "integrations," "security," "products."

### Interaction / motion cues in markup
- Framer-generated, so heavy reliance on scroll-triggered reveals and animated counters (implied by the site being built on Framer, a motion-native tool) — not directly visible in markdown but inferable from the "Framer 625f89c" generator tag and the animated-counter-style "Key facts" pattern seen on Trionn (same template family of interactions).
- Testimonial carousel with prev/next arrow controls.
- Pricing toggle (Monthly/Yearly) is a stateful UI control.
- FAQ section uses accordion pattern (questions listed with no visible answers in scrape — collapsed by default).

### Screenshot
https://storage.googleapis.com/firecrawl-scrape-media/screenshot-cb62b9c9-c948-4bb1-96f1-216a1eaca0f9.png (expires ~2026-09-06; re-scrape if needed later)

### Strongest transferable principle
**The tabbed feature-block pattern** (Feature name + one-line value prop + 4 short capability bullets + a real screenshot + one clear "explore" link, repeated 3x for distinct product pillars) is a clean, scannable way to present multiple product surfaces without a wall of text. Also: keeping every CTA in the page funneling to exactly one place (`/pricing` or `/contact`) avoids decision paralysis, even if here it's done sloppily.

### Problems / anti-patterns to avoid
- Pricing tiers named one way (Sonic/Supersonic/HyperSonic) but the comparison table below uses different tier names (Basic/Standard/Enterprise) — broken internal consistency.
- "Get Started" CTA doesn't start anything — it's a disguised "Contact Us," which erodes trust once a visitor clicks through twice and lands on a contact form both times.
- Placeholder testimonials/team bios that are obviously fake (stock photos, generic exec titles) — this actively damages credibility; never ship recognizable "template filler" content live.
- A typo in the hero subhead ("COSMOC" instead of "COSMOQ") — sloppy proofreading on the most-viewed line of the site.
- Testimonial carousel repeats the same 3 quotes ~4x in the DOM — bad for both users and SEO/accessibility (screen readers announce duplicate content).

---

## 2. TRIONN — https://trionn.com/

**URLs inspected:** `/` (home), `/services`, `/about`, `/work`

**Context:** An independent, award-winning (Awwwards, FWA, CSS Design Awards, GSAP, Orpetron, CSS Winner) digital studio based in Rajkot, Gujarat, India, est. 2012, founded by Sunny Rathod. Positions itself as AI-powered creative/dev studio for branding, web, product design, and "AI & Intelligent Automation." This is the closest of the three references to a **premium creative agency** aesthetic and voice.

### Navigation structure
Top-left: logo. Top-right: Work · Services · About · Contact, plus a distinct "✦ The TRIONN name Story" link and a persistent "let's talk" CTA button. A slide-out/overlay panel (visible in the raw markdown duplication) carries Business Enquiry contact info (email, phone), social links (LinkedIn, Facebook, Dribbble, Instagram), and "Est. 2012 · 14+ years shaping digital direction" — this appears to be a side drawer/menu that duplicates in the markdown because it renders twice (closed + open states).

### Hero headline + subhead (verbatim)
- Headline (letter-spaced, animated per-character): "Designed to mean something."
- Micro-CTA row: "Discuss Your Project" / "[Book a 30-minute call]" (Calendly link)
- Directly under hero: "Est. 2012 — 14+ years shaping digital direction. Websites, AI products, brands, and systems built for clarity, scale and impact."

### Section sequence (homepage)
1. Hero — animated headline "Designed to mean something," tagline, dual CTA (Discuss Your Project / Book a 30-min call), decorative "hold to blast / dare to touch the lines" interactive Easter egg copy
2. About blurb — "Trionn is an independent digital studio crafting meaningful brand experiences through strategy, design, and technology" + "We design for longevity... clarity first, craft always, built to scale" + mission statement + "more about us" link
3. "Key facts" — animated counters: 050+ projects completed, 90% repeat-client rate, 020+ team members, business partner logos
4. "Selected work & explorations" — 3 featured case study cards (MyWorker AI, Pulse Studio, Loftloom) each with one-line description + "Explore project" + "view all projects"
5. Services teaser grid — 6 one-line service names (AI & Intelligent Automation, Web Development, Product Design, Website & Mobile Design, WordPress Development, Branding) → "view services"
6. "Client stories" — 5 real named testimonials with founder/CEO attributions and country (USA, UAE) — feels credible vs. COSMOQ's fake ones
7. "Design in motion" — Dribbble exploration teaser, "View on Dribbble"
8. Cookie consent banner (Decline/Accept)
9. Final CTA — "Ready to build something bold?" + live local time display ("IST → 12:19") + Discuss Your Project / Book a call
10. Footer — contact, social, full inline contact form (name, email, service dropdown, budget dropdown $ ranges, message, reCAPTCHA)

### Conversion paths / CTAs
- Primary: **"let's talk"** (persistent header button) and **"Discuss Your Project"** (hero + footer) — both open/scroll to the inline contact form
- Secondary: **"Book a 30-minute call"** → Calendly (`calendly.com/hello-trionn/30min`) — a real scheduling link, lower-friction than a form
- Tertiary: **"more about us" / "view services" / "view all projects" / "Explore project"** — internal deep-links to relevant pages
- The footer contact form asks for **budget range** (Under $5K / $5K–15K / $15K–30K / $30K–60K / $60K+ / Not sure yet) and **service type** — this pre-qualifies leads before a human ever responds, which is a strong pattern for an agency selling custom work.

### Copy tone and density
Confident, editorial, slightly poetic/aspirational ("Designed to mean something," "True growth is not about adding more, but about becoming more," "We don't chase trends. We shape ideas that add real value"). Uses short punchy fragments and a lot of white space implied by heavy letter-spacing. Not overly technical — sells feeling and craft over feature lists. Includes a distinctive **"Who we're not for"** section (on /about) — explicitly repels bad-fit clients ("We don't do disposable design, endless revisions without direction, or work that exists only to look good"), which is a strong positioning/premium-brand signal.

### Typography / imagery observations
- Extreme letter-spacing on headlines is a recurring device — used both for animation-in effects and stylistic flourish (seen throughout in the raw markdown as space-separated single characters, e.g. "D e s i g n e d t o").
- Dark background (`theme-color: #040508`), image-forward: full-bleed project thumbnails, team photography, award badges (many SVG/webp award logos — Awwwards, FWA, CSS Design Awards, Orpetron, GSAP, CSS Winner, Codrops, Muzli).
- "Drag a member to identify" team section — a playful, interactive team display rather than a static grid.
- Consistent card format for case studies: image → project name → one-line description → "Explore project."

### Interaction / motion cues in markup
- Sound toggle ("sound on / Hover the lines," a footer "blast" icon) — the site has ambient audio/sound design, unusual and distinctive for a B2B site.
- "Drag the strips with sound on" and "Dare the Lion 🦁" — playful, interactive hero/about elements (likely WebGL/canvas drag interactions, consistent with their stated GSAP/WebGL/Three.js tech stack).
- Live IST clock displayed in the footer CTA band ("IST → 12:19") — small but effective "we're a real, active studio" signal.
- Animated per-character text reveals throughout (inferred from the letter-by-letter markdown spacing).
- Looping/infinite marquee for partner logos and "Inspire Innovate Impact" repeated taglines.
- reCAPTCHA on the contact form (anti-spam, standard).

### Screenshot
https://storage.googleapis.com/firecrawl-scrape-media/screenshot-71cfe96e-be82-4ffc-8e38-715fa5db4a27.png (expires ~2026-09-05)

### Strongest transferable principle
**Budget + service-type qualification built directly into the primary contact form**, paired with an explicit "who we're not for" statement — this is the single most premium-agency-coded move seen across all three references: it filters for serious, well-resourced clients and signals confidence/scarcity rather than "please, anyone, buy from us." Also strong: real, attributed, geographically-diverse testimonials build far more trust than COSMOQ's fabricated ones.

### Problems / anti-patterns to avoid
- Extremely animation/JS-heavy (per-character text spacing, drag interactions, sound) — beautiful but a real accessibility and performance risk if over-applied to Vyso's more information-dense, ops-tool content; the letter-spacing artifacts made even markdown extraction messy (e.g. "InspireinnovateImpact" with no word breaks), which hints the underlying markup may hurt screen readers/SEO if not handled carefully.
- Case study links in the "Selected work" section are thin — one line of description, no outcome/results metric shown on the homepage card (have to click through to learn anything concrete).
- The nav/drawer content is duplicated in the DOM (closed-state + open-state both present) — same accessibility/SEO concern as COSMOQ's repeated testimonials.

---

## 3. PODIUM — https://podium.global/

**URLs inspected:** `/` (home — a single-page site; "about" and "contact" are anchors/panels, not separate routes, confirmed via `firecrawl_map`), `/projects/deviate` (representative case-study/project page)

**Context:** A Montreal-based creative direction & production studio for **sports brands and athletes** (Puma, Nike, Salomon, On Running, The North Face, Garmin, etc.) — not an AI/automation company at all. Relevant here purely as a **portfolio-presentation and motion/visual-craft** reference, not for positioning or product copy.

### Navigation structure
Minimal top bar: work · about · contact (all anchors on the single homepage) + social icons (Instagram, Vimeo) + a hamburger "Menu." No traditional multi-page IA — everything (services, clients, athlete roster, contact emails) lives on one long-scroll homepage plus individual `/projects/[slug]` case pages.

### Hero headline + subhead (verbatim)
- Headline: "We offer creative direction & production for athleticism."
- "Scroll Down" prompt beneath it — no button-style CTA in the hero at all; the hero is purely a statement + an immediate project grid.
- No separate subhead line; the studio's positioning statement appears slightly further down the page instead: "We help sports brands tell stories through fieldwork, narrative, and creative research, with deep production expertise." (under the "Available Worldwide" label)

### Section sequence (homepage)
1. Hero — headline + "Scroll Down" cue
2. Featured project grid (8 numbered projects /001–/008: Deviate·Puma, 80 Winters·Auclair, Milimani·Salomon, Not Quite Gone·Le Braquet, Western States·Salomon, Life Edition·Ciele, Summer Nights·Ciele, Jay Du Temple) — a toggleable grid/list view ("View toggle icon")
3. "Available Worldwide" statement — "We help sports brands tell stories through fieldwork, narrative, and creative research, with deep production expertise."
4. "Behind the scenes" — large photo/video-thumbnail gallery (mixed image + Mux video thumbnails)
5. "We've worked with sports brands and athletes worldwide" — three-column list: Services (Creative Direction, Video Production, Post-Production, Photography, VFX) / Clients (12 named brands) / Athletes (long named list, ~20 elite athletes)
6. Closing CTA — "Not the finish line. Let's build your vision — [Work with us] It's step one." → `/#contact`
7. Footer — "Available worldwide" map graphic, studio address (Montreal), 4 role-based contact emails (Commercial/Film/General/Invoicing), social links, "Website by San Rita" credit

### Conversion paths / CTAs
- Single primary CTA: **"Work with us"** → `#contact` anchor (opens the footer contact block)
- No form at all — instead, **role-routed email addresses** with a one-click "Copied" clipboard action per email (Commercial, Film, General, Invoicing) — an unusually low-friction, high-trust B2B contact pattern (no gatekeeping form, just "email the right person directly").
- Project cards are themselves a conversion path of sorts — each links to a full case study that ends in the same footer contact block.

### Copy tone and density
Extremely spare. The entire homepage's prose content is a handful of short lines — no feature lists, no explanatory paragraphs, no FAQ, no pricing. Trust is built almost entirely through **who they've worked with** (brand logos, athlete names) rather than through claims about the studio itself. This is a portfolio-first, proof-over-promises tone appropriate for a high-end creative studio whose buyers already know what they want.

### Typography / imagery observations
- Very large-format photography/video is the actual content — text is secondary. Numbered project index (/001–/008) gives an editorial, print-catalogue feel.
- Light/dark theme-color meta present (`#ffffff` / `#000000`) suggesting the site adapts or has a toggle.
- Grid ↔ list view toggle for the project index — lets visitors switch between big visual browsing and a denser scannable list.

### Interaction / motion cues in markup
- Video thumbnails throughout (Mux-hosted) imply autoplay/hover-preview video reels — standard for a production studio portfolio.
- "Copied" state on email addresses indicates a JS clipboard-copy micro-interaction on click.
- View-toggle icon for the project grid (grid/list switch) is a stateful UI control.
- The project detail page (`/projects/deviate`) is essentially a vertical photo essay: title, one-line brief, 2-sentence creative concept ("The idea was simple: the chase. The camera needed to feel like it was barely keeping up with the runner."), then 5 large sequential images, then a "Next project" link straight to another case study (Life Edition) — a continuous-scroll portfolio-browsing pattern with no dead ends.

### Screenshot
https://storage.googleapis.com/firecrawl-scrape-media/screenshot-27722c58-0b7e-437e-b9b0-d946b0f51779.png (expires ~2026-09-06)

### Strongest transferable principle
**Proof-over-promises minimalism**: no feature grid, no pricing, no FAQ — just work, clients, and a direct way to reach the right human. For a premium positioning play, radical restraint (a handful of lines of copy, huge visual proof) can read as more confident than a page stuffed with persuasion copy. The **role-routed contact emails with one-click copy** is also a genuinely useful, low-friction alternative/supplement to a lead form for a site where the audience already knows they want in.

### Problems / anti-patterns to avoid
- Zero information architecture beyond "scroll" — fine for a portfolio-only studio with one call to action, but this pattern under-serves any site (like Vyso) that needs to explain pricing, industries, product mechanics, or answer objections; don't over-borrow the minimalism where explanation is actually required.
- `/about` and `/contact` as separate URLs return 404 (confirmed: they're anchors on `/`, not real routes) — any inbound link, bookmark, or share to those "pages" breaks. If Vyso ever adopts a single-page pattern for any section, real routes/deep-links should still resolve.
- No pricing or process information anywhere — appropriate for bespoke sports-brand production, but this would be a mismatch for Vyso where clarity on pricing (R6,000/location) is already a stated brand strength.

---

## 4. VYSO.CO.ZA — the current live site being redesigned ("before" record)

**URLs inspected:** `/` (home), `/pricing`, `/industries`, `/platform` (redirects/serves the homepage — no distinct `/platform` content was returned separately; see note below)

**Context:** Live production site for **Finch by Vyso**, an AI "operations COO" product for South African food-sector SMEs (restaurants, food suppliers, farms, caterers, wholesalers, hospitality). Full site map (via `firecrawl_map`) shows a large IA: home, `/platform/modules` (+10 module sub-pages), `/industries` (+8 vertical pages), `/pricing`, `/orbit` (a second product line for tradespeople, with its own `/orbit/for/[trade]` pages), `/compare/*`, `/learn/*` (8 articles + a 12-term glossary), `/resources/*`, `/case-studies/*`, `/operations-audit/*`, `/academy`, `/faq`, `/about`, `/contact`, `/south-africa`, plus legal pages.

**Note on `/platform`:** the scrape of `https://vyso.co.za/platform` returned the same content as the homepage (metadata `sourceURL` shows `/platform` but the returned canonical `url` and body content matched `/`) — this likely means `/platform` client-side redirects to `/` or is not yet a distinct page in the current build, despite being linked in the footer as "Under the hood" → `/platform/modules`. Worth flagging to Josh as a possible redirect/routing quirk on the current site.

### Navigation structure
Top nav: **Finch** (logo/home) · Industries · Pricing · Learn · Orbit · Log in · **Book your audit** (primary CTA button). Footer is a large 4-column sitemap: Finch (Home, What Finch watches, Under the hood, Integrations, Pricing, Compare) / Vyso (About, Orbit, Operations Audit, Founding client, Academy, Case studies, Contact) / Learn (Articles, Resources, FAQ, South Africa) / Legal (Privacy, Terms, POPIA).

### Hero headline + subhead — VERBATIM CAPTURE (before record)
- **Headline:** "Meet Finch. Your company's own COO — at a tenth of the cost." *(rendered without spaces in raw scrape as "MeetFinch.Yourcompany'sownCOO—atatenthofthecost." — a CSS letter-spacing/animation artifact identical to what was seen on Trionn/COSMOQ, not an actual content bug)*
- **Subhead:** "Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI agents watch your invoices, stock, suppliers and margins — catch money leaking, and tell you what to do about it. Built by Vyso for South African food businesses. R6,000 per location, everything included."
- **Primary CTA:** "Book your audit" → `/operations-audit`, with a supporting eyebrow label: "ONE-WEEK OPERATIONS AUDIT · R2,000"

### Section sequence (homepage) — verbatim structural capture
1. Top nav + hero (headline, subhead, CTA) + animated "Price Watch" notification card overlay (illustrative demo UI) showing a live-feeling finding: "Butternut up 12% at FreshCo since June. ≈ R58,000/yr at current volumes" with Draft supplier email / Show 6-month trend / Dismiss actions
2. "ILLUSTRATIVE EXAMPLE — WHAT HAPPENS TO AN INVOICE INSIDE FINCH" → "## From paper to a decision, while you serve customers." — a detailed simulated invoice (FreshCo Produce Market tax invoice, 4 line items, extraction confidence 99.2%) walking through extraction → price memory → trend chart, ending in the same Price Watch finding card
3. "THE BRIEF · WHAT YOU OPEN EVERY MORNING" → "## Finch is ready to go, whenever you need it." — a full simulated product UI (chat-style morning brief) showing Price Watch / Debtors / Reconciliation / Stock findings, each with rand-denominated impact and inline actions (Draft supplier email, Draft polite reminder, etc.), plus a persistent "Ask Vyso anything about your operation…" input — shown twice at two different fidelities (a wide dashboard mock, then a narrower chat-transcript mock), suggesting responsive/mobile variants captured in one scrape
4. "ILLUSTRATIVE · DEMO DATA" disclosure label
5. "WHAT FINCH WATCHES" → "## Custom agents on shift, all day, every day." — 6 agent cards (Price Watch, Recon, Debtors, Stock Sense, The Brief, Delivery Watch), each tagged LIVE / ROLLING OUT / FROM YOUR AUDIT ROADMAP
6. "SENSES, NOT INTEGRATIONS" → "## We put your current tools into Finch." — conversational integration examples ("Finch, fetch our books from Xero," etc.) across 11 named tools (Xero, WhatsApp Business, Yoco, Sage, Loyverse, QuickBooks, Gmail, Outlook, Notion, n8n, SimplePay)
7. Single customer quote: *"Finch automates our invoicing, ordering, and insight into how our company is actually running."* — Roberto, Turn 'n Slice, Johannesburg, Founding Client
8. "UNDER THE HOOD" — 4 mechanism cards: Extraction, Price Memory, Reconciliation, Brief Composer
9. Closing CTA — "## Start with a one-week Operations Audit." (R2,000, credited to first month) → Book your audit
10. Footer (4-column sitemap as above)

### Conversion paths / CTAs
- **Primary, repeated throughout:** "Book your audit" → `/operations-audit` (nav, hero, closing CTA — same destination every time, very consistent single-funnel design)
- **Secondary:** "Log in" (nav) → `/login`
- Micro-CTAs embedded *inside* the simulated product UI itself (Draft supplier email / Show 6-month trend / Draft polite reminder / Payment history / Dismiss) — these are not real links, they're part of the illustrative product demo, but they make the page feel highly interactive/alive even in a static scrape.
- Pricing page CTA: same "Book your audit" pattern, plus a secondary "Register interest" → `/contact?topic=academy` for Vyso Academy.

### Copy tone and density
Plain-spoken, numbers-forward, South African business vernacular (rand amounts everywhere, WhatsApp/Xero/Yoco as concrete reference points rather than generic "integrations"). Sells via **specific illustrative scenarios** (a real-feeling invoice, a real-feeling morning brief) rather than abstract feature claims — closer to Trionn's "show, don't just tell" instinct but leaning into product-demo realism rather than portfolio/case-study realism. Every claim is heavily disclosed as illustrative ("ILLUSTRATIVE EXAMPLE," "ILLUSTRATIVE · DEMO DATA," "The example figures are worked examples, not client results" on /industries) — an unusually scrupulous honesty pattern, presumably deliberate given compliance/trust concerns for a financial-facing product.

### Typography / imagery observations
- No screenshots of real typography/color could be fully assessed from markdown alone; metadata shows `theme-color` not set distinctly (unlike Trionn's `#040508`) — worth checking the live screenshot directly for palette. (Screenshot captured: see below.)
- Extremely rich inline "fake UI" content — invoice mockups, chat transcripts, notification cards — rendered as structured text/values in the markdown itself (prices, dates, percentages), which is unusual: most competitor sites show this as an image, but Vyso's is real DOM/text, which is good for SEO and accessibility but produces a very dense, numbers-heavy scrape.
- SVG bird logo mark ("finch-bird.svg") used as a recurring avatar/mascot throughout the simulated chat UI — gives the AI agent a lightweight visual identity distinct from generic bot icons.

### Interaction / motion cues in markup
- The repeated near-identical "Price Watch" card (appears 3 times in slightly different contexts: hero overlay, invoice-flow demo, and full brief) suggests a scroll-linked/sticky animation where one UI element persists or morphs as the visitor scrolls through the product story — a specific, deliberate storytelling device (invoice → extraction → pattern → brief) rather than decorative motion.
- Numbered step markers "01 INVOICE IN · 02 EXTRACTION · 03 PRICE MEMORY · 04 THE FINDING · 05 YOUR BRIEF" — an explicit 5-step horizontal/scroll narrative, likely a scrollytelling section.
- Tag badges throughout (NEW, LIVE, ROLLING OUT, FROM YOUR AUDIT ROADMAP, RESOLVED, EXPERIMENTAL) function as a consistent status-taxonomy design system already in place.

### Screenshot
https://storage.googleapis.com/firecrawl-scrape-media/screenshot-49f60220-a492-42bb-8294-700dbcdb6652.png (expires ~2026-09-06)

### /pricing — verbatim capture
- Eyebrow: "ONE OFFER · NO TIERS · NO MATRIX"
- Headline: "R6,000/location/month" — subhead "Everything included."
- Body: "Finch costs R6,000 per location per month, everything included: every module and agent, activated in priority order from your operations audit, a monthly ops review with your Vyso lead, and 30 days' notice to cancel."
- Three "FOUNDING TERMS" badges: Setup waived / First month free / Rate locked
- "What's included" broken into 6 categories with counts: The platform (10 MODULES), The agents (6 AGENTS), Integrations (11 INTEGRATIONS), Support (3 COMMITMENTS), Onboarding (5 STEPS) — each fully enumerated with one-line descriptions and status tags (LIVE / ROLLING OUT / FROM YOUR AUDIT ROADMAP / CUSTOM)
- FAQ mini-block: "BEFORE YOU ASK — Straight answers" (4 Q&As: cost, setup fee, multi-branch/custom, cancellation)
- Embedded "MARGIN WATCH" illustrative demo card (same pattern as homepage)
- Vyso Academy upsell block: "R500 / seat — COMING SOON" → Register interest
- Closing CTA: same Operations Audit pattern

### /industries — verbatim capture
- Eyebrow: "WHO FINCH WORKS FOR"
- Headline: "Built for operations-heavy South African food businesses."
- Body: "Finch does not change per industry — what changes is which agents earn their place first, and in whose vocabulary. These are the operations we understand well enough to be specific about."
- "SIX OPERATIONS WE KNOW WELL" grid: Food suppliers, Farms & producers, Restaurants, Catering companies, Wholesale, Hospitality — each card leads with a **specific illustrative pain-point line** (e.g., "Invoiced for 40 crates. The signed delivery note says 36.") + the relevant agent tags + "What Finch watches →"
- "ALSO WATCHING — Two we are still learning" — Security companies, Insurance brokers, both tagged EXPERIMENTAL, each with its own illustrative pain line and "What Finch would watch →" (careful hedged language for unproven verticals)
- Closing CTA: same Operations Audit pattern

### /platform — see routing note above; returned homepage content, not distinct platform content, at scrape time.

### Strongest transferable principle (already on the current site — preserve/extend, don't lose in redesign)
The **illustrative-but-concrete product storytelling** (a real invoice with real line items, real rand amounts, an explicit 5-step "invoice → decision" narrative) is materially stronger than anything on COSMOQ or Trionn's homepages, and is a genuine differentiator worth protecting through the redesign — it's what makes an abstract "AI agent" product legible to a skeptical SME owner. The consistent single-CTA funnel ("Book your audit," R2,000, credited to first month) and the transparent one-offer/no-tiers pricing page are also strong, premium-coded patterns already in place.

### Problems / anti-patterns on the current site (to fix in redesign)
- `/platform` appears to not resolve to distinct content (redirect/routing gap) despite being a linked footer destination — should be fixed or the link removed/repointed to `/platform/modules`.
- Very high density of repeated near-duplicate "Price Watch" card content across the hero and mid-page sections (3x) risks feeling repetitive on a first cold read, even though it's likely intentional scroll-linked storytelling — worth reviewing whether the repetition reads as intentional narrative progression vs. redundant filler when experienced live (not just in markdown).
- The site currently has very little of Trionn/Podium's "premium creative agency" visual restraint or brand voice — it reads as a solid, trustworthy SaaS product page rather than a distinctive premium agency brand. Given the redesign brief is "premium AI-automation-agency," the biggest gap versus Trionn/Podium is **brand personality and visual craft** (motion, typography as a design element, portfolio-style proof), not product clarity — Vyso's product storytelling is already ahead of both competitor examples; its brand presentation is behind.
- No visible "who this is not for" or scarcity/qualification signal (contrast with Trionn's explicit "Who we're not for" section) — for a premium positioning play this is worth considering, especially paired with the existing R2,000 paid-audit-as-qualifier mechanic, which already does some of this work implicitly.

---

## Cross-site synthesis notes

- **Positioning honesty spectrum:** Podium (pure proof, near-zero copy) → Trionn (confident brand voice + real proof) → Vyso (concrete/numbers-heavy product proof, but generic SaaS brand voice) → COSMOQ (unsubstantiated claims, fake proof). Vyso should move toward Trionn's brand-voice confidence while keeping its own numbers-driven product proof — it should NOT move toward COSMOQ's abstraction.
- **CTA funneling:** all four sites (when done well) point every CTA to one primary destination (Trionn → contact form/Calendly; Podium → role-routed email; Vyso → Operations Audit). Multiple competing CTAs (as seen inconsistently on COSMOQ) should be avoided.
- **Motion as brand, not decoration:** Trionn and Vyso's homepage both use motion/scroll to *tell a specific story* (Trionn: brand philosophy; Vyso: invoice→decision flow) rather than as ambient decoration (COSMOQ's generic scroll-reveals). This is the right model to extend.
- **Real testimonials only, minimal but attributed:** Trionn (5 real, geographically diverse) and Vyso (1 real, named, with company) beat COSMOQ's fabricated volume. Quality/authenticity over quantity.
- **Qualification as a premium signal:** Trionn's budget-range dropdown + "who we're not for" copy, and Vyso's paid R2,000 audit as an implicit filter, both do real work signaling premium positioning — worth leaning into further in the redesign (e.g., making the audit-as-qualifier language more explicit in hero copy).
