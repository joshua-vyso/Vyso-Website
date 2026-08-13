# Vyso Design System

Vyso (**vyso.co.za**) is a South African operations software and automation company for
SMEs, starting with food businesses — restaurants, food suppliers, farms, caterers,
wholesalers, hospitality. It replaces WhatsApp threads and spreadsheets with a
configurable operations platform, implemented hands-on.

> "We build automation systems and simple custom apps for food businesses — so owners
> spend less time managing chaos and more time running their business."

**What Vyso is not:** a generic software agency, enterprise software, or an accountant.

## Surfaces in this system

| Surface | What it is | Visual world |
| --- | --- | --- |
| **vyso.co.za** | Marketing site: homepage, platform, pricing, industries, solutions, learn/resources, ROI calculator, operations audit, contact | Barlow Condensed + DM Sans, white, **burnt orange `#BE5D23`**, sharp corners, frosted glass panels, full-page WebGL shader background |
| **The platform** (`/app`) | Signed-in operations platform: nine modules behind a top bar + module switcher | Instrument Sans + Space Grotesk numerals, cool blue-grey wash, **blue `#1F5FA8`** actions, 10–20px radii, hairline cards |
| **Finch** | The in-app AI assistant sub-brand | Light-blue animated gradient, its own bird mark |
| **/login, /onboarding** | Auth + guided setup | Warm `#f4f1ec` split editorial layout, Inter, ink `#141310` CTA |

The nine platform modules (`lib/platform/modules.ts`): **Doc-U** (documents),
**ProcurePulse** (stock intelligence), **PricePilot** (pricing), **PlanWise**
(budgeting & forecasting), **WasteWatch** (wastage), **ShiftBoard** (labour),
**SupplySync** (suppliers), **InsightGen** (reporting), **OrderFlow** (orders).

### Two palettes, one brand — the rule that matters most
Orange is the **brand** colour (wordmark, marketing accents, focus rings on the site).
Blue is the **platform action** colour. Never put an orange primary button inside a
module screen, and never put a blue `#1F5FA8` button on a marketing page.

## Sources

- **Codebase:** `Vyso Website/` — Next.js 15 App Router monorepo (marketing site +
  platform + API routes + Supabase). Read locally via the mounted folder; not vendored here.
  Key paths: `app/globals.css`, `app/layout.tsx`, `components/ui/*`,
  `components/sections/*`, `components/platform/*`, `lib/platform/tokens.ts`,
  `lib/platform/modules.ts`.
- **Brand brief:** `Vyso Website/vyso-design-brief.md` (2024 brief — note its accent is
  blue `#3375AE`; the shipped site moved to orange `#BE5D23`, and **the code wins**).
- **Figma:** `lib/platform/tokens.ts` cites the "Vyso tokens" variable collection,
  Figma file `atJsUrf10rEPEinSqe62EC`. Not accessible in this run — values were taken
  from the code mirror of that collection.
- **Assets:** `Vyso Website/public/*` (logos, module glyphs, app-icon sprite, product
  screenshots) — copied into `assets/`.

---

# CONTENT FUNDAMENTALS

**Voice: direct, confident, clean. No startup fluff, no jargon.** Written for an
exhausted business owner, not a tech buyer. If a sentence could appear on any SaaS
site, it is wrong.

- **Person.** "We" for Vyso, "your" for the reader's business. Never "I". Never "our
  customers" — "you".
  - *"We audit your current ops and identify what is breaking."*
  - *"Vyso diagnoses your operational chaos, automates the work, and builds your team a
    tool they'll actually use."*
- **Sentence shape.** Short declaratives. Fragments are allowed and used as punchlines:
  *"That ends here."* · *"One place. Full history."* · *"Documents in. Clean data out."*
- **The problem→answer construction** is the brand's signature move. Name the old way
  bluntly, then answer it in fewer words: *"Stock levels guessed, not tracked." →
  "Real-time stock visibility, automated."*
- **Casing.** Sentence case for headlines and buttons ("Join Waitlist" and "Log in" are
  the exceptions — product-name-like CTAs). UPPERCASE only for eyebrows, KPI labels and
  footer column heads, always with wide tracking (0.08em–0.22em). Never all-caps a
  sentence.
- **Module names** are single CamelCase words: ProcurePulse, WasteWatch, ShiftBoard,
  SupplySync, PricePilot, PlanWise, InsightGen, OrderFlow. Doc-U keeps its hyphen. Finch
  is sentence case.
- **South African English.** "-ise" (centralised, productised, optimisation),
  "organisation", "labour", "wastage". Currency is ZAR written **R2,000** in marketing
  copy and **R2 000** (space, tabular) in platform figures. VAT-aware, en-ZA dates
  ("29 Jun").
- **Pricing is shown, never hidden.** Real numbers, in the open: Audit R2,000 once-off ·
  Start R10,000 setup + R8,000/mo · Create R30,000 + R10,000/mo · Scale R50,000 +
  R15,000/mo.
- **Honesty markers.** The platform labels illustrative data ("Illustrative — live data
  once connected"), unfinished features ("soon", "✦ auto-generated soon") and plan gates
  ("Unlock") rather than faking them. Keep this habit.
- **Empty states teach.** *"Log your first waste event — or pair a scale on the Devices
  tab — and WasteWatch will start costing it…"*
- **No emoji.** Anywhere. The only glyph-as-ornament in the product is `✦` on AI
  affordances and `›` / `→` / `▲▼` / `✕` as functional marks.
- **Words the brand avoids:** "revolutionary", "seamless AI-powered synergy",
  "empower", "solutions" as a noun-for-everything, exclamation marks.

---

# VISUAL FOUNDATIONS

## Type
- **Barlow Condensed** (`--font-display`) — every headline, tier name, footer column
  head, number-step. 400/500/700/900. Hero `clamp(2.8rem, 7.5vw, 6.4rem)` at 700,
  `line-height: 1`, `letter-spacing: -0.015em`, `text-wrap: balance`. Headlines are
  large and blunt; the type does the work, not decoration.
- **DM Sans** (`--font-body`) — all site prose, nav links, form labels, feature lists.
  400–700, `line-height: 1.6`, generous.
- **Instrument Sans** (`--font-ui`) — every in-app label, row, control. 13–14px body,
  12px uppercase KPI labels at 0.05em.
- **Space Grotesk** (`--font-num`) — numerals only, via `.of-num` (with `tnum`) and
  `.of-display` (module titles, card titles). Money and counts always `.of-num` so
  columns align.
- **Inter** (`--font-inter`) — login and legacy platform chrome only.

All five load from Google Fonts (`tokens/fonts.css`). The production app loads the same
families through `next/font/google`; there are no font binaries in the repo, so nothing
was substituted.

## Colour
White page, near-black ink, **one** accent. Orange is used sparingly — accent words in a
headline, eyebrows, checkmarks, focus rings, the CTA gradient — never as a background
wash. The platform swaps to a cool blue-grey neutral ramp (`#171A17` → `#A0A49C`) with
blue `#3E7BC4`/`#1F5FA8` accents and five fixed semantic tone pairs. Two background
colours per surface, maximum: white + `#fafafa` on the site; white + the
`linear-gradient(180deg,#F3F8FF,#FFFFFF 340px)` wash in the app.

## Backgrounds
- **Site:** no photography, no illustration, no pattern. A full-page WebGL shader
  (`WebGLShaderBackground.tsx`) paints a slow white-on-white sine sweep behind
  everything, and headlines sit on top with `mix-blend-mode: difference` so they invert
  as the line passes. Sections are transparent; `#fafafa` marks the problem strip.
  Optional `MeshBackground` blobs and a `GlobalPixelTrail` cursor trail
  (`hsl(22 69% 44% / 0.45)`, 2px squares).
- **App:** flat. The blue-to-white wash sits on `<main>`; cards are plain white.
- **Imagery:** the only images the brand ships are real product screenshots
  (`assets/imagery/`) — cropped top-left, sharp corners, 1px `#E5E5E5` frame. Neutral
  and cool, no filters, no grain, no stock photography of people.

## Cards, borders, radii
Two card systems, never mixed on one surface:
- **Site glass:** `rgba(255,255,255,0.52)`, `backdrop-filter: blur(22px) saturate(1.9)`,
  `1px rgba(255,255,255,0.68)` border, 14/18/22px radius, inset gleam + soft drop shadow.
- **Site flat:** white, `1px #E5E5E5`, **radius 0** (the site sets `--radius: 0rem` —
  sharp = precise), accent inset ring on hover.
- **Platform:** white, `1px #EAEDF2`, 16px radius, `0 1px 2px rgba(20,24,20,0.03)`,
  hairline `#EEF1F5` header rule, 20px padding. Hover moves the border to `#C9DEF7`
  and the fill to `#F5F9FE`/`#FBFCFE`.

## Shadows
Shadow carries only elevation, never decoration. Platform: flat 3%-alpha card shadow,
a `-10px`-spread lift on hover, `0 16px 50px -12px` menus, `0 30px 80px -20px`
overlays. Site glass: inset white gleam (`inset 0 1.5px 0 rgba(255,255,255,0.88)`) plus
`0 8px 32px rgba(0,0,0,0.08)` — an active pricing card goes to `0 28px 72px` and lifts.
There is no inner-shadow system beyond the glass gleam.

## Transparency and blur
Blur is reserved for **floating chrome over content**: nav mega-menu (30px blur,
saturate 1.9), mobile sheet (28px), pricing/audit panels (22px), CTA buttons (20px),
platform top bar (`rgba(255,255,255,0.9)` + 10px), module-switcher scrim
(`rgba(23,30,40,0.32)` + 3px). Never blur a static section background.

## Motion
Precision over drama. Colour/hover 0.16s ease · fades 0.18s · menus 0.2s
`cubic-bezier(0.2,0.8,0.3,1)` with a `translateY(-6px) scale(0.985)` origin · scroll
reveals 0.65s ease with `translateY(24px)` staggered ~180ms apart · count-ups and
progress rings 0.7s `cubic-bezier(0.22,1,0.36,1)` · the problem-strip rule wipes in
0.55s `cubic-bezier(0.4,0,0.2,1)` at +0.15s, the answer fades up at +0.78s. Continuous
loops exist only for the Finch gradient (6s) and its idle dots (1.2s). Everything
respects `prefers-reduced-motion`.

## States
- **Hover:** site — colour shifts to orange, glass CTA scales `1.03`, flat cards gain an
  inset orange ring; app — border to `#C9DEF7`, fill to `#EAF2FC`/`#F5F9FE`, text to
  `#174C87`, tiles lift 2px.
- **Press:** glass scales `0.97`; shadcn buttons translate down 1px.
- **Focus:** site — orange border + `0 0 0 3px rgba(190,93,35,0.16)`; app — the blue ring.
- **Disabled:** 50% opacity, pointer-events off. Never grey out with a different colour.
- **Selected nav:** `#E6F0FB` fill, ink text.

## Layout
Site: 1160px max content, `clamp(16px,4vw,40px)` gutters, 80–120px between sections
(*breathing room is the design*), fixed 64px transparent nav that hides on scroll-down.
App: fixed 66px top bar, no permanent sidebar (modules live behind the hamburger),
32px/28px page frame, 20px stack gap, 16px grid gap. Mobile-first: bento 4→2→1,
tables scroll, hit targets never below 44px.

---

# ICONOGRAPHY

Four distinct systems, each with a defined job:

1. **Lucide** (`lucide-react`, `strokeWidth 1.8`, 13–19px) — every marketing UI icon:
   nav mega-menu rows, industry lists, resource links. Load from CDN
   (`https://unpkg.com/lucide-static`) or hand-write the same paths; keep 1.8 stroke.
2. **Inline stroke SVGs** (24×24 viewBox, `strokeWidth 1.8`, round caps/joins) — the
   platform's own chrome glyphs: hamburger, bell, feedback bubble, gear, lock, users,
   database, chevrons. Lucide-equivalent geometry written inline in the components.
3. **Module glyph tiles** (`AppIcon`) — seven transparent PNGs in
   `assets/icons-gen/` (docu, proc, margin, waste, shift, supplier, dash), tinted at
   runtime through `mask-image` onto a rounded tinted tile. This is how modules are
   identified inside the app.
4. **Full-colour app icons** (`ModuleTileIcon`) — seven tiles cropped from the
   1600×1000 sprite `assets/app-icons.svg`, used on marketing surfaces. Doc-U, PlanWise
   and "Custom Modules" have gradient placeholders in the site code rather than sprite
   art.

**No emoji, ever.** Unicode is used only functionally: `›` `→` `✕` `▲` `▼` `—` and
`✦` for AI affordances. Do not draw new brand icons — reuse these four systems.

## Logo
`assets/logo.svg` (also `assets/icon.svg`, `assets/vyso-logo-main.png`,
`assets/og.png`): the **VYSO** wordmark — V, Y, S and a filled circle as the O. Black
`#0D0D0D` on marketing, `#D9730D` in platform chrome, `#141310` on login, white on
dark. Also available as the `VysoMark` component (exact SVG geometry). Finch has its own
mark in four variants (`assets/finch-*.svg`).

---

# INDEX

**Root**
- `styles.css` — the single entry point consumers link (`@import` list only)
- `thumbnail.html` — homepage tile
- `SKILL.md` — Agent-Skill wrapper
- `readme.md` — this file

**`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
`radius.css`, `elevation.css`, `motion.css`, `base.css`

**`assets/`** — `logo.svg`, `icon.svg`, `vyso-logo-main.png`, `og.png`,
`app-icons.svg`, `finch-mark.svg` / `finch-mark-mono.svg` /
`finch-mark-on-blue.svg` / `finch-logo-orange-blue.svg`, `icons-gen/*.png` (7 module
glyphs), `imagery/*.png` (module screenshots + how-it-works stills)

**`guidelines/`** — 24 specimen cards: Colors (brand, site neutrals, platform
neutrals, platform blue, semantic tones, module tints, module brand colours, Finch
gradient) · Type (display, body, platform, numerals, labels, scale) · Spacing (site,
platform) · Foundations (radii, elevation, motion, card anatomy, states) · Brand (logo,
Finch, imagery)

**Components**

*`components/brand/`*
- `VysoMark` — the wordmark
- `AppIcon` — tinted module glyph tile
- `ModuleTileIcon` — full-colour module app icon

*`components/marketing/`*
- `Button` — site button, six variants
- `LiquidButton` — glass pill CTA
- `GradientText` — orange gradient clipped to text
- `GlassCard` — frosted marketing panel
- `Badge` — uppercase pill label
- `Input`, `Textarea`, `Label` — form fields
- `ProblemLine` — struck-out problem → Vyso answer

*`components/platform/`*
- `ModuleHeader`, `PrimaryAction`, `SecondaryAction` — screen header + actions
- `KpiStrip`, `Kpi`, `KpiTile` — metric cells
- `SectionCard` — titled panel
- `DataTable` — table shell
- `AreaChart` (+ `Sparkline`), `ProgressRing`, `CountUp` — data display
- `StatusPill`, `ToneBadge`, `ConfidenceText` — status
- `ModuleTile` — module switcher entry

**`ui_kits/`**
- `platform/` — sign-in → module switcher → WasteWatch + Doc-U (interactive)
- `site/` — vyso.co.za homepage: hero, problem strip, how it works, modules, pricing,
  contact, footer (interactive)

## Intentional additions & renames
- **`ToneBadge`** is the codebase's `module-ui` `Badge`, renamed because the marketing
  `Badge` owns that name here.
- **`ProblemLine`** and **`GlassCard`** are extracted from `ProblemStrip.tsx` and the
  inline `GLASS` constants in `PricingSection.tsx`/`Navbar.tsx` — same values, promoted
  to reusable components because both patterns repeat across the site.
- **`ModuleTileIcon`** wraps the seven `AppIcons.tsx` exports behind one `name` prop.

Not built (no counterpart in the source, or too app-specific to generalise): the WebGL
shader background, the coverflow carousels, `gooey-text-morphing`, `CustomCursor`,
`sheet`/`navigation-menu`/`dropdown-menu` primitives (Radix/base-ui wrappers with no
Vyso styling of their own), and the module-specific editors (ExtractionEditor,
OrderFlow composer, ServiceDen).
