# Awwwards-Calibre Reference Sites — Research for Vyso Redesign

Purpose: inform the premium AI-automation-agency redesign (7-page Turn 'n Slice tool, per PLAN.md / vyso-restructure-plan). Seven live sites were scraped directly (homepage markdown via Firecrawl) on 2026-09-01, spanning AI/tech products, automation infrastructure, premium creative agencies, and a frontier-AI lab site with recent Awwwards SOTD pedigree.

---

## 1. Linear — linear.app

**What it is:** Project/product-management system for software teams, now explicitly positioned for human+AI-agent collaborative workflows.

**Hero headline (verbatim):** "The product development system for teams and agents" — with an animated line-by-line rebuild: "The productdevelopmentsystem for teamsand agentsThe product development system for teams and agentsThe product development system for teams and agents" (the markdown capture shows the headline typing/settling through several draft states before landing).

**Homepage section sequence:**
1. Hero + live "product" screenshot (an actual Linear workspace mid-interaction — comments, an agent responding, a PR diff)
2. "Powering the companies building the future" — logo strip
3. "A new species of product tool" — three-pillar value prop (Purpose-built / Powered by agents / Designed for speed), each with its own mini interactive panel ("Fig 0.1 / 0.2 / 0.3")
4. "Intake and integrations" — feature deep-dive with live UI recreation (backlog board, Slack-sourced issue, AI triage labels)
5. "Planning and monitoring" — Gantt/roadmap UI recreation
6. "AI and automations" — chat-style transcript of a user prompting the Linear agent, showing multi-step agent reasoning and issue creation in real time
7. "Build, review, and ship" — code-review/PR UI recreation with a diff and a "before/after" code snippet
8. Changelog feed (dated, shipped features)
9. Customer quotes (OpenAI, Ramp, Opendoor) + "40,000 product teams" stat
10. Final CTA band: "Built for the future. Available today." with four link options (Get started / Contact sales / Open app / Download)

**CTA strategy:** No CTA at all in the hero — the product screenshot IS the pitch. CTAs are deferred to the very end, and even then offered as four low-commitment paths rather than one hard sell. Mid-page sections use soft "Learn more →" links per feature module instead of conversion asks.

**Strongest transferable principle:** *Show the product doing the thing, don't describe it.* Every section is a pixel-accurate, live-feeling recreation of the actual UI performing the exact task the section's headline names (intake → triage happening on screen; agent → literal agent chat transcript with tool calls and a finished PR). For an AI-automation agency, this is the single highest-leverage move: replace "we build AI automations" copy with an animated, believable recreation of an automation actually running (trigger → agent reasoning → result), stitched into the copy's rhythm so the visual IS the proof, not decoration.

**Usability/performance problem to avoid:** Extremely dense, motion-heavy sections (many overlapping animated states, live chat/typing simulations, multiple simultaneous UI recreations) risk major jank and CLS on mid-tier hardware, and the sheer volume of simulated "realtime" content (issue IDs, timestamps, cursors) can overwhelm first-time visitors who don't yet know the product vocabulary (ENG-2088, DRV-364, etc. mean nothing on a cold visit). Don't recreate UI complexity 1:1 for an audience unfamiliar with your product's internal nouns — simplify the demo vocabulary for outsiders.

---

## 2. Vercel — vercel.com/home

**What it is:** Cloud infrastructure/deployment platform, repositioned around "agentic infrastructure" — hosting for AI agents and apps built by them.

**Hero headline (verbatim):** "Build agents on infrastructure that thinks like them" (rotating hero; page also carries the meta-title "Agentic Infrastructure — Vercel" and OG description "The autonomous stack for every app and agent.")

**Homepage section sequence:**
1. Rotating hero band, three swapped headline/proof pairs, each with a real customer logo and a concrete usage stat baked into the sentence:
   - "Build agents on infrastructure that thinks like them" — Notion, "powers millions of agent conversations daily"
   - "Ship apps that scale from zero to millions instantly" — Zapier, "100 million monthly website visits"
   - "Host platforms that serve every customer" — Mintlify, "20,000+ companies"
   Each panel also lists 4 named platform features as a small tag row (Durable Orchestration, Sandboxed Environments, AI Model Gateway, Fluid Compute, etc.)
2. "Recently shipped" — a live terminal-style deploy log (`▲ vercel deploy`, checkmarked build steps, a production URL) functioning as a mini product demo embedded in the page
3. Closing CTA band: "Built by you, or your agents" — "Deploy now" / "Onboard your agent" / "Paste to your agent" (three CTA modes for three audiences: human dev, existing agent, and an agent reading the page itself)

**CTA strategy:** Segmented by *who* is converting — a human developer, an existing AI agent under a person's direction, or an autonomous agent parsing the page. This is a genuinely novel pattern: a CTA literally addressed to non-human visitors ("Paste to your agent").

**Strongest transferable principle:** *Proof-by-customer-logo-plus-number, one per value proposition, not stacked as a wall of logos.* Instead of a generic client logo strip, Vercel pairs exactly one named, recognizable customer with exactly one hero claim and one big number, repeated three times for three distinct value props. This lets each rotation function as a mini case study without needing a separate case-study page — directly applicable to an agency site pitching different automation outcomes (revenue ops, support, fulfillment) each anchored to one client and one number.

**Usability/performance problem to avoid:** The homepage is thin on explanatory copy relative to its ambition — it assumes the visitor already knows what "Durable Orchestration" or "Fluid Compute" mean, with no on-page definition, tooltip, or link context in the scraped markdown. For a category-defining or highly technical automation pitch, jargon-as-decoration without a plain-English gloss will lose visitors who aren't already Vercel-literate.

---

## 3. Raycast — raycast.com

**What it is:** macOS/Windows productivity launcher with built-in AI, extensions marketplace, and automation features (snippets, quicklinks, AI commands).

**Hero headline (verbatim):** "Your shortcut to everything." Sub-line: "A collection of powerful productivity tools all within an extendable launcher. Fast, ergonomic and reliable."

**Homepage section sequence:**
1. Hero with a *live, interactive-looking* recreation of the actual launcher UI directly under the headline (clipboard history, color swatches, quick actions) — not a screenshot, a full markup recreation with real interaction affordances (type-to-filter, category tabs)
2. "Take shortcuts, not detours" — recreates 5-6 more command palette states in sequence (emoji picker, AI ask, app search, window management) as the user scrolls, each a distinct "screenshot-as-live-UI" moment
3. Keyboard visual + three feature callouts overlaid directly on a rendered keyboard graphic: "Fast. Think in milliseconds." / "Ergonomic. Keyboard First." / "Personal, your tools your way." / "Reliable. 99.8% crash-free rate."
4. "There's an extension for that" — filterable extension gallery (Productivity/Engineering/Design/Writing tabs) with ~18 real extension cards (Linear, Spotify, Notion, 1Password, etc.)
5. "Your Mac just got smarter" — AI section with example prompt bubbles ("How do I quit Vim?") and three AI use-case blurbs
6. Social proof wall — ~25 named individual testimonial avatars (CEOs, founders, designers) with role/company, not a generic quote block
7. "Don't repeat yourself" — Snippets/Quicklinks/Hotkeys feature trio, each with its own tiny interactive demo
8. "What else can Raycast do?" — long inline comma-separated feature list styled as a single flowing sentence
9. Community section (Slack/X follower counts) + large embedded YouTube video grid (18 videos)
10. Developer/extension-API pitch with a 5-point feature list
11. Final CTA: "Take the short way. Download and use Raycast for free."
12. Extensive footer sitemap

**CTA strategy:** Single, repeated, low-friction CTA ("Download for Mac") reappears at top and bottom; no pricing pressure on the homepage at all — trust and craft carry the page, conversion is treated as inevitable once belief is established.

**Strongest transferable principle:** *Interface-as-hero.* Raycast doesn't describe the product with marketing copy first — it puts a working recreation of the literal interface at the very top, then keeps re-showing new states of that same interface as you scroll, so scrolling = watching the product be used, feature by feature. Combined with the individually-named social proof wall (real names/roles instead of generic "loved by thousands"), this builds credibility for a technical/power-user audience extremely efficiently. For an automation agency, this argues for a real dashboard/workflow-builder UI recreation as the literal hero visual instead of illustration or stock abstraction.

**Usability/performance problem to avoid:** The page is enormous — dozens of images, an 18-video embed grid, ~25 avatar images, multiple animated UI recreations — which is a lot of payload for a marketing homepage and risks slow initial load on non-cached visits, especially mobile. An agency site should borrow the *rhythm* (screenshot → proof → screenshot) without the sheer asset count.

---

## 4. Lusion — lusion.co

**What it is:** Award-winning 3D/interactive creative studio (agency), known for immersive WebGL/3D storytelling for brands including AI-sector clients (Devin AI, Oryzo AI).

**Hero headline (verbatim):** "We create 3D visual storytelling and interactive web experiences that help brands stand out" with a "scroll to explore" prompt immediately beneath.

**Homepage section sequence:**
1. Full-bleed 3D hero + scroll cue (no visible nav copy captured — pure visual/scroll-driven entry)
2. "Bold Ideas, Brought to Life" statement + "Our Approach" link + "Play Reel" video trigger
3. "Featured Work" — a tag-labeled project grid (each project tagged with its own discipline stack: "concept • web • design • development • 3d • animation"), including named AI-sector clients (Oryzo AI, Devin AI, Synthetic Human)
4. "Where Creative Ideas Become Immersive Experiences" — philosophy/differentiation statement ("We do not chase trends...")
5. A staged scroll-triggered tagline sequence: "Step into a new world / and let your / imagination run wild" — text is clearly built to animate in on scroll, one clause at a time
6. "Is Your Big Idea Ready to Go Wild?" — soft-sell CTA into "Let's work together!"
7. Footer: office address, socials, "General enquiries" / "New business" split emails, newsletter signup, R&D micro-site link (labs.lusion.co)

**CTA strategy:** No hard CTA button language at all in the captured copy — conversion is framed as a question ("Is Your Big Idea Ready to Go Wild?") and routed to two distinct, humanized email addresses (general vs. new business) rather than a form. Extremely low-pressure, portfolio-led.

**Strongest transferable principle:** *Per-project discipline tagging as implicit capability marketing.* Rather than a services page listing "we do web, 3D, animation, dev," Lusion tags each portfolio piece with its exact discipline mix inline in the grid — the capability list emerges from evidence (18+ real projects), which reads as far more credible than a claimed skills list. For an automation agency this maps directly to labeling each case study with the exact stack used (e.g. "trigger • LLM orchestration • CRM sync • Slack notify") instead of a generic "services" page.

**Usability/performance problem to avoid:** Studio/3D-portfolio sites in this genre are notorious for scroll-hijacking and heavy WebGL payloads that stutter on lower-end devices or when JS partially fails (the scrape itself surfaced leftover debug text — "refing something..." — suggesting an in-progress loader/shader string leaking into rendered DOM, a sign these builds can be fragile). Never let experience-layer motion code leak visible artifacts, and always ship a fallback for scroll-jacked pages so non-WebGL or reduced-motion users aren't stranded.

---

## 5. basement.studio — basement.studio

**What it is:** Digital studio/branding powerhouse for VC-backed tech and AI companies (Vercel, Cursor, Linear, ElevenLabs, Scale AI, MrBeast, Daylight among clients).

**Hero headline (verbatim):** "A digital studio & branding powerhouse making cool shit that performs." Sub-line: "We partner with the world's most ambitious startups, scale-ups and brands to unlock their true potential and growth through the convergence of creativity, design, and technology."

**Homepage section sequence:**
1. Hero statement (no imagery captured in markdown — likely a motion/3D hero not represented in static markdown extraction)
2. "Trusted by Visionaries" — an enormous logo wall (30+ real client SVG logos: xAI, Vercel, Next.js, Linear, Cursor, Scale, Eleven Labs, Harvey, Replicate, Base, MrBeast, etc.) — repeated twice in the markdown, suggesting a marquee/scroll-loop animation
3. "Featured Projects" — four large case-study cards (Vercel Ship, Daylight, KidSuper, Shop MrBeast), each with a one-line outcome-oriented blurb and a capability tag list (e.g. "Websites & Features / Marketing Execution / IRL Experience Design")
4. "Capabilities" — four service pillars (Websites & Features / Visual Branding / IRL Experience Design / Marketing Execution), each with a 2-4 item sub-skill list and a link into the filtered case-study grid
5. Contact — direct email, no form; social links

**CTA strategy:** Zero hero CTA button; trust is front-loaded entirely through the logo wall placed immediately after the headline (before any case studies), then a single low-friction "Let's make an impact together" + email at the very end.

**Strongest transferable principle:** *Logo wall as the second thing you see, not the last.* Most sites bury social proof; basement.studio puts an oversized, immediately-recognizable client wall right under the hero statement, functioning as instant credibility before a single project is shown — critical for a premium/high-ticket B2B pitch where trust must be established before persuasion. Also notable: outcome-first project blurbs ("sold out inventory in hours," not "we designed a website") — every case study leads with the business result, not the deliverable.

**Usability/performance problem to avoid:** A 30+ logo wall risks visual noise and slow paint if not virtualized/lazy-loaded, and repeating the full set twice (for a marquee loop) doubles DOM weight for what is essentially decorative motion — worth implementing as a CSS-only or canvas loop rather than duplicated markup.

---

## 6. Obys Agency — obys.agency

**What it is:** EU-based concept-driven design studio, known for strong editorial/typographic systems and storytelling-led case studies (fashion, architecture, biotech, culture clients).

**Hero headline:** Not captured distinctly in markdown — the homepage is dominated by an interactive/filterable project index rather than a single hero statement (the site is portfolio-first, not pitch-first).

**Homepage section sequence:**
1. A large interactive project index — every project (19 total: Makhno, Source Unknown, Autex, Odin's Crow, Glyphic Biotechnologies, Salience Labs, AI Modernism of Kharkiv, Porsche Taycan, etc.) is listed multiple times in different structural forms (marquee text loop, numbered grid, thumbnail grid), each tagged with industry (Architecture, Fashion, Technology, Biotech, Automotive, Culture, Education) and discipline (Creative Direction, Web Design/Dev, Identity, 3D, Concept)
2. Thumbnail grid with full case-study cards, image + title + tags
3. View-mode toggle (Vertical / Horizontal / Grid) — the portfolio itself is presented as an explorable interactive tool, not a static list
4. Footer: copyright, brief studio philosophy statement, single contact email

**CTA strategy:** Almost none — the entire homepage functions as the pitch (the work itself, richly tagged and explorable), with contact reduced to a single email in the footer. This is the most portfolio-maximalist, least sales-copy-driven of all seven sites.

**Strongest transferable principle:** *Taxonomy as storytelling.* Obys tags every project by both industry and discipline simultaneously, and offers multiple ways to browse the same 19 projects (list/grid/marquee), letting a visitor self-select the lens that matters to them (an AI/biotech founder can immediately spot "Salience Labs" and "Glyphic Biotechnologies" tagged Technology/Biotech). For a redesigned agency site, a well-tagged, multi-view case-study index communicates range and relevance far faster than a linear scroll of unlabeled projects.

**Usability/performance problem to avoid:** The same 19 projects are rendered redundantly at least 3-4 times in the DOM (marquee loop, numbered list, full grid) purely for visual/animation variety — this is a real SEO and accessibility cost (duplicate link text, redundant content for screen readers) and a maintenance burden. If borrowing the multi-view browsing idea, render one canonical data set and swap *view*, not duplicate markup per view.

---

## 7. Microsoft AI — microsoft.ai

**What it is:** Frontier AI lab (Mustafa Suleyman's Microsoft AI division) — positioning statement site for foundation models (MAI-Code, MAI-Image, MAI-Voice, etc.) under a "Humanist Superintelligence" thesis. Directly comparable to how a premium automation agency might need to explain "responsible, powerful AI" to a skeptical enterprise buyer.

**Hero headline (verbatim):** "*Humanist* Superintelligence" with sub-line "Responsible AI to empower humanity."

**Homepage section sequence:**
1. Hero manifesto statement (large italic/serif contrast type treatment on "Humanist")
2. Latest model announcement as a full editorial card (MAI-Code-1.1-Flash) with a metric-forward image overlay ("25% Greater Token Efficiency, A Quarter of the Cost")
3. Secondary news grid — 3 more model/product announcements as image+headline+read-time cards
4. "Discover and build with the latest MAI models" — model catalog cards (MAI-Thinking-1, MAI-Code-1.1-Flash, MAI-Image-2.5, MAI-Voice-2, MAI-Transcribe-1.5), each with a soft pastel watercolor icon (deliberately warm/human illustration style contrasting with typical cold "AI blue" tech aesthetics), a one-line plain-English benefit, and a "Learn more" link
5. Mission statement restated ("building the world's most capable AI systems, with humanity at the center of every decision")
6. "Our Values" — six named value pillars (Kindness, Trust, Quality, Simplicity, Safety & Security, Evaluation), each with a short human-readable paragraph, presented twice (compact + expanded) in the markdown, suggesting an accordion/hover-reveal pattern
7. Team photography strip (real people, real offices, candid style — not stock)
8. "Join us" — careers pitch + link
9. "Key Locations" — six offices, each with painterly/illustrated cityscape art and a one-paragraph atmospheric description (not just an address)
10. Closing founder quote block with signature graphic and named CEO attribution (Mustafa Suleyman)

**CTA strategy:** Almost entirely soft "Learn more" and "Explore jobs" links; no product trial/signup CTA on the homepage at all — this is a positioning/trust site, not a conversion funnel, appropriate for a frontier-lab audience that needs to be persuaded of values before product.

**Strongest transferable principle:** *Deliberately warm, human illustration style to counteract "cold AI" perception.* Every model card uses soft pastel watercolor iconography instead of circuit-board/neural-network cliché imagery, and the six values are written in first-person, plain-English paragraphs ("We design for clarity so you can focus on the work, not the technology") rather than corporate jargon. For a premium AI-automation agency this is the most directly applicable lesson: pairing genuinely technical claims (token efficiency, benchmark rank) with warm, human-authored value statements and illustration avoids the sterile-tech-bro aesthetic that most AI marketing defaults to.

**Usability/performance problem to avoid:** The Values section and several other blocks appear duplicated in the scraped markdown (compact list immediately followed by an expanded repeat) — likely an accordion or reveal-on-scroll pattern implemented by rendering both states in the DOM rather than toggling content, which bloats the page and duplicates text for accessibility tools/SEO. Same anti-pattern as Obys — prefer CSS/JS state toggling over DOM duplication for scroll-reveal effects.

---

## Cross-Site Synthesis (for the Vyso redesign)

1. **Show the automation, don't describe it** (Linear, Raycast) — the highest-value pattern for an AI-automation agency is a believable, live-feeling recreation of a workflow actually running (trigger → reasoning/processing → result), placed as the literal hero visual or immediately below it.
2. **Anchor every claim to one named customer + one number** (Vercel) — avoid generic client-logo walls with no context; pair proof points 1:1 with value propositions.
3. **Trust before persuasion, for high-ticket B2B** (basement.studio) — put the client logo wall immediately after the hero, before case studies, when selling premium/high-cost services.
4. **Tag case studies by outcome + discipline stack, not by generic service category** (Lusion, Obys) — lets different buyer personas (ops leader vs. technical evaluator) self-select relevant proof.
5. **Warm, human illustration/copy to offset "cold AI" perception** (Microsoft AI) — technical credibility (benchmarks, efficiency %) paired with plainly-written values copy and non-cliché visual language.
6. **Avoid DOM-duplication anti-patterns for scroll/accordion reveals** (Obys, Microsoft AI) — a recurring implementation smell across ambitious sites; render once, toggle state, don't duplicate markup for animation variety.
7. **Watch payload weight** (Raycast, basement.studio, Lusion) — the most awarded/immersive builds also carry the highest asset weight and are the most likely to show cracks (leaked debug strings, duplicated marquee content) — budget performance explicitly rather than treating it as an afterthought to the visual ambition.

## Sources (scraped 2026-09-01)
- https://linear.app
- https://vercel.com/home
- https://raycast.com
- https://lusion.co
- https://basement.studio
- https://obys.agency
- https://microsoft.ai
