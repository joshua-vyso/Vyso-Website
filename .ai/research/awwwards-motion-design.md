# Awwwards / motion-design research — moving backgrounds, magnetic text, scroll choreography

Research date: 2026-08-16. Method: Firecrawl scrape/map/search only (no code changes). All scraped copy is treated as data — quotes below are short (≤20 lines) and cited.

Brief recap: warm-white base, STIX Two Text serif headlines, Instrument Sans body, IBM Plex Mono labels, burnt orange `#FF7727`/`#E05A12`, deep blue `#4B96DD`/`#2F6FAE`/`#1F5FA8`, near-black `#14120E`. Want deep-contrast sections with moving backgrounds, text that reacts to motion, scroll choreography — at Attio/Stripe/Linear/Vercel/Folk restraint. No glass, no 3D blobs, no stock photos. Stack: Next 16, `motion` (Framer Motion) installed, `gsap` and `three` installed but slated for removal unless justified.

---

## 1. Candidate list (Awwwards, last ~18 months / current cycle)

Awwwards scraped cleanly via Firecrawl (no block). Site-of-the-Day feed pulled from `awwwards.com/websites/` (currently showing Aug 2026 dates — this is a live, rolling feed, so "recent" here means the current SOTD stream plus the `startups`, `animation`, `scrolling`, `webgl`, `minimal` tag pages, which mix in older SOTY-caliber sites). 28 candidates selected for relevance to the brief:

| Site | Awwwards URL | Award / tag | Why relevant |
|---|---|---|---|
| Cerebrium | `/sites/cerebrium` | Startups tag, Nominee | AI infra SaaS, black+magenta, canvas particle field, split-text — closest analog to our brief |
| HydraDB | `/sites/hydradb` | Startups tag, Nominee | Black+burnt-orange pixel/graph canvas hero — near-exact palette match |
| Prolibu | `/sites/prolibu` | Startups tag, Nominee | Deep-blue gradient + faceted geometric plane, Lenis scroll |
| Illoca | `/sites/illoca` | Startups tag, Nominee | Warm graph-paper grid base + blue duotone illustration |
| Botblox Systems | `/sites/botblox-systems` | Scrolling tag, Nominee | Black canvas dot-grid loading reveal, HUD/crosshair motif |
| Canopy | `/sites/canopy-1` | Startups tag, Nominee | Light blue organic-blob background — useful negative example (edges toward "blob") |
| Cofounder | `/sites/cofounder-2` | Startups tag, Nominee | Playful pixel-art parallax scene — useful negative example (too illustrative) |
| Skanvi | `/sites/skanvi` | Startups tag, Nominee | E-commerce, stock photography — excluded, confirms what to avoid |
| Anidachi | `/sites/anidachi` | Startups tag, Nominee | Not deep-dived; canvas present per DOM scan |
| PartnerProp | `/sites/partnerprop` | Animation tag, Nominee | Light-mode, JP SaaS — low relevance, mostly static |
| Scale & Form | `/sites/scale-form` | Animation tag, Nominee | Agency site, black bg, serif display, navigable "3D scene" (WASD) — useful over-the-top counter-example |
| Linearity.ai | `/sites/linearity-ai` | Scrolling tag, Nominee | AI design tool, black bg, orange-accent prompt UI, close palette match |
| Made With Gsap | `/sites/made-with-gsap-1` | SOTD Aug 2026 | Explicit GSAP showcase — useful if GSAP retention is being evaluated |
| Serotoninn | `/sites/serotoninn` | SOTD Aug 2026 | Recent SOTD, likely dark/experimental |
| TRIONN | `/sites/trionn-2` | SOTD Aug 2026 | Recent SOTD |
| NORMAL IS BORING | `/sites/normal-is-boring` | SOTD Aug 2026 | Recent SOTD, typographic name suggests restraint irony |
| Obys® Experiment Space | `/sites/obys-r-experiment-space` | SOTD Aug 2026 | Obys is a known scroll/WebGL studio benchmark |
| Noomo Showcase | `/sites/noomo-showcase` | SOTD Aug 2026 | Agency showcase, WebGL tag |
| L.I.S.A. | `/sites/l-i-s-a` | Animation tag | Studio site with strong motion identity |
| deck.gallery | `/sites/deck-gallery` | Animation tag | Gallery/portfolio, scroll-heavy |
| Kervan | `/sites/kervan` | Animation tag | Agency, animation-tagged |
| ULTRAGRID | `/sites/ultragrid` | Animation tag | Name signals literal grid-motion technique |
| The grid to the page | `/sites/the-grid-to-the-page` | Animation tag | Grid-motion technique in the title |
| Generative 3D-Configurator | `/sites/generative-3d-configurator` | Animation tag | WebGL/three.js generative background candidate |
| STILL. | `/sites/still` | Minimal + Scrolling tags | Minimal-tagged, useful restraint reference |
| SLY | `/sites/sly` | Minimal + Scrolling tags | Minimal-tagged |
| Active Theory v4 | `/sites/active-theory-v4` | Sites of the Year alumni | Active Theory is a top WebGL/scroll studio — technique benchmark |
| Igloo Inc | `/sites/igloo-inc` | Sites of the Year alumni | SOTY-caliber, dark/interactive |

Full raw candidate pool (195 unique title/URL pairs collected across the front SOTD feed and the `animation`, `scrolling`, `webgl`, `minimal`, `startups` tag pages) is preserved in the working scrape cache; the table above is the curated, brief-relevant subset. Notably useful discovery: Awwwards' own tag taxonomy includes `startups` (`awwwards.com/websites/startups/`) and `minimal` (`awwwards.com/websites/minimal/`) — both far more aligned with a restrained SaaS brief than the general feed, which skews toward agency/portfolio maximalism (3D showreels, WebVR, unusual navigation).

---

## 2. Deep-dive: 11 candidates

For each: background-motion technique + build method, text/motion relationship, scroll choreography, palette structure, performance signals. Evidence is from rendered DOM (Firecrawl `html`/`rawHtml`), full-page screenshots, and in one case (Cerebrium) literal component filenames leaked through Astro's per-component script bundling.

### Cerebrium — cerebrium.ai
**Stack signal:** Astro (component-scoped `.astro_astro_type_script` bundles expose real file names — this is the strongest evidence gathered in this research). Confirmed component inventory: `BackgroundCanvas`, `InteractiveDots`, `SplitTitle`, `Rail`, `AnimatedChart`, `FeatureCardRangeChart`, `FeatureCardTerminal`, `FeatureCardWorldMapAnimation`, `SegmentedControls`, `HeroHome`. Also carries `data-lenis` (Lenis smooth scroll) and OGL references in the bundle.
- **(a) Background motion:** `BackgroundCanvas` + `InteractiveDots` — a canvas-rendered field of small dots on near-black, with a soft magenta/purple radial glow bleeding in from one side (visible in the hero screenshot as a vignette, not a hard-edged blob). Almost certainly OGL or raw canvas 2D given file size discipline (Astro ships minimal JS per island).
- **(b) Text/motion relationship:** `SplitTitle` component — the hero headline splits words into styled spans; in the screenshot, "scales" renders in a pink→magenta gradient against white for the rest of the line — a per-word/per-character split-and-style pattern, not necessarily scroll-linked, but structurally exactly what `SplitText`-style reveals need.
- **(c) Scroll choreography:** `Rail` component name strongly implies a horizontal-scroll or marquee section further down the page (common "logos rail" or feature-rail pattern). Individual `FeatureCard*` components (RangeChart, Terminal, WorldMapAnimation) are separate Astro islands — i.e., each animated card almost certainly hydrates independently, which is the correct performance pattern (only the visible card's canvas/JS runs).
- **(d) Palette:** near-black (`#0a0a0f`-ish) base, hot pink/magenta (`#ff2ea0`-ish) accent on the gradient text and glow, small orange-red brand mark. Grain/noise texture overlaid on the black (visible speckling in the screenshot) — a cheap, high-value technique for avoiding flat/dead black.
- **(e) Performance:** Astro islands architecture is inherently gating — components only ship JS when they're used, and canvas-heavy pieces (`BackgroundCanvas`, `FeatureCardWorldMapAnimation`) are isolated per-section rather than one giant WebGL scene. This is the single best structural example for how *not* to pay for animation you're not looking at.

### HydraDB — hydradb.com
**Stack signal:** Framer-published site (`framerusercontent.com`, `events.framer.com` analytics). No custom canvas confirmed in rendered DOM, but the hero graphic is almost certainly a canvas/SVG-driven data-viz, not a static image (branching pattern with per-node labels overlaid, screenshot shows floating numeric tags like "12.1x" at fixed graph positions).
- **(a) Background motion:** Pure black background; hero-right graphic is a pixel/mosaic "growing tree" — a branching graph rendered as small orange/amber/cream squares (heatmap-style), with dotted connector lines between highlighted nodes and floating metric labels. Reads as a canvas-rendered generative graph, animated to "grow" outward from the trunk.
- **(b) Text/motion relationship:** Headline "The Graph AI Runs On." set in a blocky monospace/pixel font that echoes the pixel-graph motif — text and background share a visual language rather than one riding on the other.
- **(c) Scroll choreography:** Logo marquee strip directly under the fold (customer logos scrolling horizontally, infinite loop) — a cheap, very common "trust bar" motion pattern.
- **(d) Palette:** Pure black base, warm amber/orange/cream pixel gradient for the data-viz (essentially our burnt-orange family already), white/gray text. This is the single closest palette match to "burnt orange on near-black" found in the whole research set.
- **(e) Performance:** Built on Framer, so animation is Framer's own runtime (motion values / layout animations), not hand-rolled canvas — lower engineering cost, less control. No visible reduced-motion affordance in the static scrape.

### Prolibu — prolibu.com
**Stack signal:** `data-lenis` present → Lenis smooth-scroll. No canvas tag but hero uses a full-bleed SVG/CSS faceted gradient (large low-poly triangle shapes).
- **(a) Background motion:** Deep royal-blue gradient background overlaid with large faceted/low-poly triangle panels in varying blue tones and one warm gray triangle top-right — reads as a static faceted-plane graphic, but the presence of Lenis plus a small pulsing scroll-mouse icon at the fold suggests the facets shift/parallax subtly on scroll.
- **(b) Text/motion relationship:** Headline centered, plain white sans, no visible split/reveal effect captured in the static shot — text sits calmly over the moving facets rather than reacting to them.
- **(c) Scroll choreography:** Animated scroll-cue icon (mouse outline with moving dot) — a small, high-value detail that signals "there's more" without being loud.
- **(d) Palette:** This is the best "deep blue as dominant hero color" reference collected — a saturated royal blue (brighter than our `#2F6FAE`/`#1F5FA8`) with geometric faceting for depth instead of blur/glow. Confirms deep blue + white text + geometric (not blobby) shapes reads clean and premium.
- **(e) Performance:** Lenis smooth-scroll is lightweight (~a few KB); faceted background is likely a single large SVG/CSS gradient rather than WebGL, keeping the technique CSS/SVG-cheap.

### Illoca — illoca.unseen.co
**Stack signal:** `data-lenis` present.
- **(a) Background motion:** Warm cream/beige background with a fine graph-paper grid texture (thin hairlines forming a grid, visible across the whole hero) — this is a static/CSS grid texture, not obviously animated in the capture, but it's the single closest "warm base + literal grid" reference in the set.
- **(b) Text/motion relationship:** Hand-drawn-style annotation labels ("ARCHITECTURAL", "→ NOT SOFTWARE") sit askew next to the serif headline, like sticky-note callouts — a personality device more than a motion device.
- **(c) Scroll choreography:** Large blue-duotone illustration panel directly below the fold, full-bleed — a hard cut between the grid-paper hero and a saturated blue illustration band, i.e. a light→color band transition.
- **(d) Palette:** Warm cream/beige base (structurally identical to our warm-white base) paired with a strong blue duotone image band — good evidence that a warm base can cut hard into a blue section without needing black as the intermediary.
- **(e) Performance:** Grid-paper texture is almost certainly a repeating CSS background — effectively free.

### Botblox Systems — botblox.com
**Stack signal:** Framer-built (`_framer`, Framer analytics). Screenshot caught the site mid-load, which is itself the most useful capture in this research.
- **(a) Background motion:** A dot-matrix/grid of small white squares on black, arranged in a fixed grid, with a subset of dots "cut away" to reveal a silhouette (a robot head, in this case) — a canvas or masked-SVG dot-grid reveal used as a preloader. Corner crosshair marks (`+`) and "LOADING" labels in monospace at all four corners, percentage counter bottom-center.
- **(b) Text/motion relationship:** Loader percentage is the only moving text; otherwise text is static monospace HUD chrome.
- **(c) Scroll choreography:** Not captured (page was still loading), but the crosshair/reticle framing suggests a "viewport as instrument" motif likely continues into the main page.
- **(d) Palette:** Pure black + white dot grid, no color — a strong reference for a **pure oscillating dot-grid** technique in monochrome, before adding a brand accent color.
- **(e) Performance:** A masked dot-grid reveal like this is normally canvas-drawn (draw a grid of squares, sample an image/SVG mask for which ones to hide) — cheap to compute once, then just a fade-out on load complete. Good candidate technique for the site's loading state or a section intro, not persistent runtime cost.

### Scale & Form — scfo.de
**Stack signal:** `data-lenis` present.
- **(a) Background motion:** Black background; a bottom-left control panel literally reads "NAVIGATION," "Change scene" with keyboard hints `T / I / W / S`, plus a `K` "Contact" shortcut — this is a **navigable first-person 3D scene** (almost certainly three.js), not a passive background.
- **(b) Text/motion relationship:** Large serif display headline ("Scale & Form") over the 3D scene; sticky left-rail "on this page" section nav with an animated active-state underline.
- **(c) Scroll choreography:** "SCROLL TO EXPLORE" cue at the fold; sticky in-page nav implies pinned/staged sections keyed to scroll position.
- **(d) Palette:** Black + white/cream serif type, no color accent visible in the hero.
- **(e) Performance / restraint flag:** **This is the clearest "too much" example in the research set.** A WASD-navigable 3D scene as the hero background is a genuinely heavy, novelty-first pattern — the opposite of the Attio/Stripe/Linear/Vercel bar. Flagging explicitly: don't do this. It's useful only as a boundary marker for "how far is too far."

### Linearity.ai — linearity.io
**Stack signal:** Next.js/React SPA, obfuscated bundle; canvas-adjacent DOM markers present but not conclusively fingerprinted.
- **(a) Background motion:** Pure black; no visible background animation in the hero capture — the "hero visual" is a chat-style prompt input box, not a canvas.
- **(b) Text/motion relationship:** Headline is plain white sans, two lines, centered, static in the capture.
- **(c) Scroll choreography:** "Scroll down to explore" cue with a down-chevron under the prompt box — signals a staged reveal below the fold (typical for AI-tool marketing pages: prompt → generated output gallery → use cases).
- **(d) Palette:** Black base with a warm orange→red gradient ring around the prompt-box focus state and on the two CTA buttons (one pure black pill, one orange gradient pill) — **this is the closest "burnt orange accent on near-black" reference found**, closer even than HydraDB for a direct swap-in of our orange.
- **(e) Performance:** Very light hero — most of the "production value" is typographic and one glowing UI element, not a rendering workload. Good evidence that restraint and premium feel aren't in tension.

### Linear — linear.app
- **(a) Background motion:** Near-black base with an extremely subtle radial gradient glow in the upper-middle of the viewport (barely perceptible in the static screenshot — no hard edge, no visible blob shape). No canvas/WebGL detected in the static DOM scan of the hero; Linear's known motion budget (per public design-team commentary and observable behavior) is concentrated in cursor-reactive glow and micro-interactions rather than a persistent animated background.
- **(b) Text/motion relationship:** Plain white sans headline, static in the capture; app-screenshot mockup anchors the fold.
- **(c) Scroll choreography:** Not captured beyond the hero; Linear is broadly known for measured, single-column narrative scroll rather than pinning/horizontal sections.
- **(d) Palette:** Near-black (`#08090a`-ish) with a single soft glow as the only "color" event — everything else is grayscale until UI-screenshot color appears.
- **(e) Performance:** Heaviest asset on the page is the product screenshot, not an animation system — this is the single best "restraint" reference for a near-black hero in the entire set.

### Vercel — vercel.com
- **(a) Background motion:** Warm light-gray base; the entire hero visual is a single black triangle (the wordmark shape) centered with a soft blurred glow beneath it — almost certainly a subtle CSS/WebGL rotation or breathing-scale animation on load, not a field or grid effect.
- **(b) Text/motion relationship:** Headline ("Agentic Infrastructure") static in the capture, plain sans, left-aligned against the centered triangle.
- **(c) Scroll choreography:** Sparse hero with generous whitespace; no visible pinning in the fold.
- **(d) Palette:** Light warm-gray + pure black shape + soft white/gray glow — zero color in the hero. Extreme restraint: one shape, one glow, done.
- **(e) Performance:** Trivial — a single vector shape with a glow filter is near-zero runtime cost. Best reference for "the brand mark itself, animated subtly, is enough."

### Attio — attio.com
- **(a) Background motion:** Warm white base; a very soft blue gradient wash bleeds in from the bottom-left corner only — restrained enough that it reads as ambient light, not a "blob." Two `<canvas>` tags detected elsewhere in the DOM (likely below the fold — probably a data-viz or particle accent tied to a specific feature section, not the hero).
- **(b) Text/motion relationship:** Static in the capture; headline and subhead sit on the plain white area away from the gradient.
- **(c) Scroll choreography:** Hero cuts directly to a static app-screenshot mockup (macOS-style window chrome) — no animated transition visible in the capture.
- **(d) Palette:** Warm white + one soft blue gradient corner + black text/UI chrome — directly validates "warm white base + single soft blue wash" as sufccient for a premium feel without full color sections.
- **(e) Performance:** Gradient wash is CSS-cheap; canvas elements are deferred to specific sections rather than global.

### Stripe — stripe.com
- **(a) Background motion:** White base; Stripe's signature large diagonal ribbon of flowing, blended gradient color (blue→purple→pink→orange) occupies the right third of the hero — this is Stripe's well-known animated gradient-mesh treatment, built on canvas/WebGL with continuously shifting color bands (confirmed via `<canvas>` presence and long-standing public knowledge of Stripe's gradient system; exact shader not recoverable from a static scrape).
- **(b) Text/motion relationship:** Two-tone headline (black main clause, blue-gray secondary clause) static in the capture; a live-updating stat ("Global GDP running on Stripe: 1.69896539%") sits above the headline — a small, continuously-incrementing number is itself a "motion" device that doesn't touch layout.
- **(c) Scroll choreography:** Customer-logo row directly under the fold, static; body copy below introduces further sections — classic single-column narrative, not pinned.
- **(d) Palette:** White base, full-saturation multi-color gradient ribbon as the one moment of maximalism, everything else (text, buttons, logo row) kept to blue/black/gray. This is the reference for "one big saturated gradient moment, otherwise totally calm" — the opposite structural approach to Linear/Vercel's "one small glow," but equally restrained everywhere except that one element.
- **(e) Performance:** A single animated gradient canvas is a well-understood, bounded cost (one shader, one element) rather than a scene — a good model for "spend the whole animation budget in one hero element."

---

## 3. Reference-bar sites — cross-check

| Site | Background motion | Restraint verdict |
|---|---|---|
| **Linear** | Single soft radial glow, near-black, no canvas in hero | Maximum restraint — glow only |
| **Vercel** | One shape (triangle) + glow, light warm-gray base | Maximum restraint — shape only |
| **Attio** | Soft blue corner gradient on warm white, canvas deferred to sections | High restraint — gradient only in hero |
| **Stripe** | One large animated gradient-mesh ribbon (their signature move) | Restrained everywhere *except* one bold canvas element |
| **Folk (folk.com)** | Warm beige/tan base (not blue as older brand memory suggested — folk.com's live product today is an AI texting-assistant, "the friend in your texts that gets stuff done," not the contacts CRM), scattered sticker-style rotated text callouts around a centered phone mockup, no visible canvas/WebGL in the hero | High restraint — motion budget spent on small floating "sticker" labels, not a field/grid background. **New finding**: no prior research file for folk.com exists in this repo, so this scrape is the first record — worth noting the product/positioning may have changed since it was last referenced. |

Pattern across all five: **the hero motion budget is spent on exactly one element** — a glow (Linear), a shape (Vercel), a gradient corner (Attio), a gradient ribbon (Stripe), or floating text stickers (Folk). None of them run a persistent full-viewport animated field/grid/particle system on the marketing homepage hero. That is the single most important calibration point for this project: **the deep-contrast sections with grids/waves/particles should be reserved for secondary sections (feature bands, CTA bands), not stacked directly into the hero**, if the goal is to stay in this company's company.

---

## 4. Technique table — 12–15 applicable techniques for this site

Stack context: Next 16, `motion` (Framer Motion) present; `gsap` and `three` installed but slated for removal unless justified.

| # | Technique | What it looks like | How to build (this stack) | Perf cost | Reduced-motion fallback | Where it fits | Exemplars |
|---|---|---|---|---|---|---|---|
| 1 | **Single ambient glow** | One soft radial gradient blob of brand color, fixed or barely drifting, behind hero text | Pure CSS (`radial-gradient` + `filter: blur`) animated with `motion`'s `animate` on a CSS custom property, or just a slow CSS `@keyframes` | Near-zero | Freeze at a static position; no JS needed at all if CSS-only | Hero, any section | Linear, Attio |
| 2 | **Brand-mark hero shape** | One geometric shape (not a blob) as the entire hero visual, subtle breathe/rotate | `motion.svg` or `motion.div` with a slow `scale`/`rotate` loop, `ease: "easeInOut"`, `repeat: Infinity` | Near-zero | `useReducedMotion()` from `motion` → render static shape | Hero | Vercel |
| 3 | **Oscillating dot/grid field** | Even grid of dots or squares on deep-contrast background, gently pulsing opacity/scale in a wave pattern | Canvas 2D: draw grid once, animate per-cell `sin(time*freq + distance*k)` for opacity — no library needed; **does not require three/gsap** | Low-medium (single 2D canvas, throttle to ~30fps via `requestAnimationFrame` + delta clamp) | CSS `prefers-reduced-motion` → skip the rAF loop entirely, render one static frame | Deep-contrast section background (blue or black) | Botblox (static dot-grid reveal), HydraDB (pixel graph) |
| 4 | **Masked dot-grid reveal (loader/section-intro)** | Grid of dots that reveals a shape/logo as some dots hide, used as a preloader or section-enter animation | Canvas: sample an SVG/image mask to decide which grid cells render; fade in with `motion` | Low (runs once, not continuous) | Skip straight to end state; no animation | Section entry, page loader | Botblox |
| 5 | **Flowing gradient-mesh ribbon** | One large saturated multi-color gradient band, continuously shifting/flowing, confined to part of the viewport | Canvas 2D gradient animation (cheapest) or a small WebGL shader if quality demands it — **this is the one technique that could justify keeping `three`**, since a true flowing mesh gradient benefits from a fragment shader; otherwise a canvas-based Perlin-noise-driven gradient loop is a reasonable CSS/canvas substitute | Medium (if WebGL) / low (if canvas gradient) | Freeze on last frame or swap to a static exported gradient PNG | Hero accent (one element, not full background) | Stripe |
| 6 | **Faceted/geometric plane background** | Large low-poly triangle panels forming a deep-blue backdrop, static or with slow parallax drift | Pure SVG (`<polygon>` grid) or CSS `clip-path` shapes with `motion` parallax tied to scroll (`useScroll` + `useTransform`) | Low (SVG/CSS, no canvas) | Disable the parallax transform, keep static facets | Deep-blue section background | Prolibu |
| 7 | **Sine/wave line field** | A handful of horizontal wave lines (SVG paths) undulating slowly, deep-contrast background | SVG `<path>` with `d` animated via `motion`'s `animate` on a precomputed sine-based path array, or CSS-only via animated `stroke-dashoffset` on a static wavy path | Low | Static path, no animation loop | Section background, transition band | (not directly observed on a scraped site, but structurally identical to technique #3/#6; safe extrapolation from wave/particle category requested in brief) |
| 8 | **Split-text character/word reveal** | Headline splits into words/characters that fade/slide in individually, sometimes gradient-colored per segment | `motion`'s built-in stagger (`variants` + `staggerChildren` on a manually split array of words/spans) — **no need for GSAP SplitText**, `motion` handles this natively in React | Low | Render all text visible immediately, skip stagger | Hero headline, section headers | Cerebrium (`SplitTitle`) |
| 9 | **Scroll-linked parallax text** | Headline or label drifts at a different speed than the background behind it as the user scrolls | `motion`'s `useScroll` + `useTransform` mapping scroll progress to `y`/`x` offset on the text layer | Low | `useReducedMotion()` → clamp transform to 0, text stays static | Hero, feature sections | Structurally implied by Cerebrium/Prolibu's scroll-cue + Lenis pairing; standard `motion` pattern |
| 10 | **Magnetic hover on CTA/nav** | Button or link subtly pulls toward the cursor within a radius, snaps back on leave | `motion`'s `useMotionValue` + `useSpring` reacting to `onMouseMove` offset, capped to a small radius (8–14px) | Near-zero | Disable on touch (no hover) and under reduced-motion, keep default hover state | CTA buttons, nav items | Common in this Awwwards tier generally; not directly captured in a screenshot here, but a standard, cheap `motion` pattern worth adding regardless |
| 11 | **Sticky/pinned stage with staged reveal** | A section pins in the viewport while inner content (steps, cards, chart) advances as the user keeps scrolling | CSS `position: sticky` on the section wrapper + `motion`'s `useScroll({target: ref})` to drive progress into child animations — **achievable without GSAP ScrollTrigger** | Medium (mostly transform/opacity, GPU-cheap if avoiding layout-triggering properties) | Collapse to a normal stacked (non-sticky) section; show all steps expanded | Feature walkthrough, "how it works" | Scale & Form (sticky in-page nav), Illoca's hard section cut |
| 12 | **Smooth-scroll (Lenis)** | Slight momentum/easing on scroll instead of native jump-scroll | `lenis` npm package (~2KB core), wraps native scroll with `requestAnimationFrame`-driven easing; pairs cleanly with `motion`'s scroll hooks | Low | Respect `prefers-reduced-motion` by not initializing Lenis at all (fall back to native scroll) | Global (site-wide) | Cerebrium, Prolibu, Illoca, Scale & Form — 4 of 6 fully-custom sites in this research use it |
| 13 | **Section-level canvas gating (Astro-island pattern)** | Each animated section (chart, map, terminal) ships and runs its own small canvas independently, only when scrolled into view | `IntersectionObserver` wrapping a lazy-mounted component; in React/Next this means dynamic `import()` + mount-on-visible, not a Next-specific API | N/A (this is the *savings* technique, not a visual one) | N/A — applies to all canvas techniques above | Any section with a canvas/WebGL element | Cerebrium (`FeatureCard*` as separate islands) |
| 14 | **Live-incrementing stat/counter text** | A small numeric stat ticks/increments continuously or on scroll-into-view | `motion`'s `animate()` on a `useMotionValue` driving `textContent`, or simple `setInterval` gated behind `IntersectionObserver` | Near-zero | Freeze at final value | CTA band, stat strips | Stripe ("Global GDP running on Stripe: …") |
| 15 | **Section background color/contrast transition on scroll** | Page background shifts from warm-white → deep-blue → near-black (or reverse) as the user scrolls between sections, rather than a hard cut | `motion`'s `useScroll` + `useTransform` interpolating a CSS variable (`--bg`) across an RGB/OKLCH range keyed to scroll progress of the whole page | Low (one interpolated CSS var, GPU-cheap) | Keep the hard section-by-section color cut (no interpolation) — visually acceptable fallback | Between every deep-contrast section boundary | Illoca (hard cut version); interpolated version is a reasonable upgrade not directly observed but standard `motion` pattern |

**Flagged as breaking the "no glass / no blobs / restrained" bar:**
- Scale & Form's WASD-navigable 3D scene (technique-adjacent to #3/#6 but far too interactive/gimmicky for a SaaS marketing site) — do not replicate the *navigation* concept, only the *idea* of a scene-based background.
- Canopy's soft organic blob shapes — even as flat 2D CSS blobs (not 3D), they read close enough to "blobmorphism" that they should be avoided per the brief; facets (Prolibu) or grids (technique #3) are the safer geometric-but-not-organic alternative.
- Cofounder's illustrated pixel-art parallax scene — too cute/game-like for the brand's serif-editorial tone.

**On keeping `three` and `gsap`:** Of the 15 techniques above, only #5 (flowing gradient-mesh ribbon, Stripe-style) plausibly benefits from a real WebGL fragment shader over a canvas 2D approximation — and even that can likely be approximated well enough with canvas 2D gradient + noise for a marketing site's needs. Every other technique (grid/dot fields, wave lines, split-text, parallax, magnetic hover, pinned stages, smooth scroll) is achievable with `motion` + plain canvas 2D/SVG/CSS. Recommendation: prototype technique #3 or #5 in canvas 2D first; only reach for `three` if the visual quality bar genuinely isn't met, and drop `gsap` entirely — `motion`'s scroll hooks and stagger/variants cover every GSAP+ScrollTrigger pattern observed in this research (split-text stagger, pinned/staged reveal, scroll-linked parallax).

---

## 5. Palette advice — warm base + deep blue + black without "dark-mode hacker"

Evidence from the research:

- **Stripe and Attio both prove a warm/white base can carry a single saturated color moment without tipping into "SaaS dark mode."** Attio's blue wash is desaturated and corner-anchored — it reads as *light falling into the room*, not a UI color. Applied to our brand: on warm-white sections, keep deep blue (`#4B96DD`) usage to soft, low-opacity washes (10–20% opacity radial gradients) rather than solid blue shapes; save full-saturation blue for dedicated deep-contrast sections.
- **HydraDB and Linearity.ai both prove burnt orange reads as "premium AI tool" rather than "hazard/warning" specifically because it's paired with near-black and used sparingly** — as a data-viz accent (HydraDB) or a glow/gradient on one CTA and one focus ring (Linearity), never as a fill color across large areas. Direct takeaway: on black/near-black sections, use `#FF7727`→`#E05A12` the same restrained way — one glowing accent (a button, an outline, a data-point), not a background wash.
- **Prolibu proves deep blue can be the *dominant* hero color (not just an accent) if it's given geometric structure (facets) rather than a flat gradient or blob.** For a deep-blue section on this site, consider: `#1F5FA8` → `#2F6FAE` gradient base, faceted or grid-patterned overlay in a slightly lighter/darker blue tint (not white/black overlay, which flattens it), white text, and reserve burnt orange for exactly one CTA or highlight element per section — echoing Stripe's "one bold moment, everything else calm" rule.
- **Linear and Vercel prove near-black (`#14120E` in our system) needs only one small warm/cool glow to avoid feeling like generic "hacker dark mode."** The trap is adding grid lines + particles + glow + gradient all at once — pick one motion device per section. A black section with the oscillating dot/grid technique (#3) should probably *not* also carry a glow gradient; let the grid alone carry the depth.
- **Illoca and Folk both prove the warm-white base itself can carry texture (a fine grid, or small rotated "sticker" text) without needing color at all** — useful for transition sections between a blue section and a black section, so the warm base doesn't feel like a flat "reset" in between.

**Concrete pairing suggestions for this brand:**

| Section type | Background | Text | Accent | Motion device |
|---|---|---|---|---|
| Warm-white section (default) | `#FDFBF7`-ish warm-white | `#14120E` near-black | Deep blue at 10–20% opacity wash only | None or very subtle parallax on headline |
| Deep-blue feature/CTA band | `#1F5FA8` → `#2F6FAE` gradient | White / `#FDFBF7` | Burnt orange `#FF7727` on exactly one CTA/highlight | Faceted plane (Prolibu-style) or oscillating grid, one device only |
| Near-black hero/closing band | `#14120E` | White / warm-white | Burnt orange glow on one element (button, data point, cursor-follow) | Oscillating dot-grid (#3) *or* one ambient glow (#1) — not both |
| Transition/in-between band | Warm-white or very dark near-black | Inverse of background | None or minimal | Hard color cut (Illoca-style) is acceptable and safer than interpolation to start |

The consistent rule across every exemplar in this research: **restraint is achieved by spending the "motion budget" on exactly one technique per section**, not by layering grid + particles + glow + gradient simultaneously. That's the actual mechanism behind why Linear/Vercel/Attio/Stripe/Folk read as premium rather than "dark mode hacker" or "crypto landing page."

---

## Sources

Awwwards: `awwwards.com/websites/` (SOTD feed), `/websites/animation/`, `/websites/scrolling/`, `/websites/webgl/`, `/websites/minimal/`, `/websites/startups/`, `/websites/sites_of_the_year/`, plus individual `/sites/*` profile pages for: cerebrium, hydradb, prolibu, illoca, botblox-systems, canopy-1, cofounder-2, skanvi, anidachi, scale-form, linearity-ai, partnerprop.

Live sites scraped (markdown + rendered HTML + full-page screenshot): cerebrium.ai, hydradb.com, prolibu.com, illoca.unseen.co, botblox.com, forcanopy.com, cofounder.co, skanvi.com, anidachi.com, partner-prop.com, scfo.de, linearity.io, linear.app, vercel.com, attio.com, stripe.com, folk.com.

Search fallback (supplementary, not deep-scraped): "godly.website dark scroll animation SaaS", "best dark landing pages 2026 animated grid background particles".
