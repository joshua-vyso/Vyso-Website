# Implementation log: Vyso redesign 2026

Plan: `.ai/plan_vyso_redesign_2026.md` (approved 2026-08-27). Branch: `redesign/operations-2026`,
cut from local `main`. Nothing is pushed, merged or deployed by any agent.

---

## Phase 0

Foundation: the branch, the forms dev gate, the `--vy-*` token set, and every primitive in
`components/vyso/`. Reviewable in one place at `/design/vyso`.

### Files created

| Path | What it is |
|---|---|
| `components/vyso/Shell.tsx` | `.vyso-site` wrapper: Nav + `<main id="main">` + Footer |
| `components/vyso/Nav.tsx` | Five links, quiet log in, ink CTA. Exports `VYSO_NAV_LINKS`, `VysoNavSection` |
| `components/vyso/MobileMenu.tsx` | `"use client"` hamburger + full-screen sheet below `lg` |
| `components/vyso/Footer.tsx` | CTA row, four columns, brand line |
| `components/vyso/Section.tsx` | Eyebrow + two-tier heading + lead, section rhythm, dark-ground switch |
| `components/vyso/Button.tsx` | primary / secondary / quiet, three sizes, optional typed analytics |
| `components/vyso/Card.tsx` | `Card` and `Pill` (the only two radii in the system) |
| `components/vyso/Reveal.tsx` | `"use client"` calm scroll reveal, 12px transform-only default |
| `components/vyso/stagger.ts` | `stagger()` in a directive-free module so server components can call it |
| `components/vyso/Wordmark.tsx` | The black Vyso wordmark, alone (no lockup, one brand) |
| `components/vyso/demo/ChromeFrame.tsx` | `ChromeFrame` (window / whatsapp) + `WhatsAppBubble` |
| `components/vyso/demo/FindingCard.tsx` | The finding card, three states, accent on `alert` only |
| `components/vyso/demo/EventTimeline.tsx` | `"use client"` typed `TimelineScript` feed |
| `app/design/vyso/page.tsx` | Noindex, prod-gated kitchen sink using the §7.1 hero script |
| `.ai/implementation_redesign_2026.md` | This file |

Server components except the three marked `"use client"` (`MobileMenu`, `Reveal`,
`EventTimeline`). `Button`, `Card`, `Section`, `Shell`, `Nav`, `Footer`, `Wordmark`,
`ChromeFrame` and `demo/FindingCard` are all server-rendered; where a CTA needs a click event it
renders the existing client `TrackedLink` rather than crossing the boundary itself.

### Files modified

- **`app/globals.css`** — appended one block at the end. Purely additive: no existing token,
  rule or `@theme` entry was edited, reordered or removed. `--fn-*`, `--pf-*`, `--ob-*` are
  untouched.
- **`app/api/contact/route.ts`** — the dev gate (§9).

Nothing else in the repo was touched. `lib/marketing/site.ts` is unchanged, as instructed.

### Tokens added (all on `:root`, all new names)

Grounds: `--vy-bg` `#FAFAF7`, `--vy-surface` `#FFFFFF`, `--vy-surface-2` `#F3F3EF`
Ink ramp: `--vy-ink` `#101010`, `--vy-ink-2` `#3D3D3A`, `--vy-ink-3` `#6E6E68`, `--vy-ink-4` `#9C9C95`
Hairlines: `--vy-line` `#E7E7E2`, `--vy-line-2` `#D9D9D3`
Accent: `--vy-accent` `#E05E1F`, `--vy-accent-ink` `#A8410C`, `--vy-accent-on-dark` `#FFB27A`, `--vy-accent-tint` `#FBEDE4`
Dark band: `--vy-dark-bg` `#101010`, `--vy-dark-surface` `#1B1B19`, `--vy-dark-line` `#2A2A27`, `--vy-dark-text` `#FAFAF7`, `--vy-dark-text-2` `#B4B4AD`, `--vy-dark-mono` `#8C8C85`
Shape: `--vy-radius` `10px`, `--vy-radius-pill` `999px`, `--vy-shadow-float`
Layout: `--vy-content` `1120px`, `--vy-gutter` `20px`
Focus: `--vy-focus`, `--vy-focus-dark`
Faces: `--vy-font-display` (Instrument Sans), `--vy-font-body` (Inter), `--vy-font-mono` (IBM Plex Mono)

Tailwind theme keys (`@theme inline`): `--color-vy-*` for every colour above, plus
`--font-vy-display` / `--font-vy-body` / `--font-vy-mono`.

Type-scale classes, in `@layer components` so a utility can still override one:
`.vy-display`, `.vy-h1`, `.vy-h2`, `.vy-h3`, `.vy-body-lg`, `.vy-body`, `.vy-small`,
`.vy-label`, `.vy-mono`.

Scope rules added: `.vyso-site` (paints its own ground, since `html, body` are transparent),
`[data-vy-ground="dark"]` (re-points the ramp for a dark band + its own focus ring), the
`.vyso-site a` link reset in `@layer base`, `::selection`, the `overflow-x: clip` sticky fix,
the mobile gutter restatement, and a `prefers-reduced-motion` block that kills every animation
and transition on the surface.

### Deviations from the plan, and why

1. **`Shell` does not render a `SkipLink`.** The task asked for one; `app/layout.tsx` already
   mounts `components/finch/SkipLink` above every route and it targets `#main`. A second one
   would put two identical "Skip to content" tab stops in front of every keyboard user on every
   Vyso page. What `Shell` owes the global one instead is the `id="main"` it jumps to, which is
   why that id lives in `Shell` rather than in each page. Verified working on `/design/vyso`.
   If the Finch surface is ever deleted and the global mount goes with it, the skip link moves
   into `Shell`. Noted in `Shell.tsx`'s docblock.

2. **Three accent tokens, not one.** §4 names `--vy-accent: #E05E1F` "darkened toward AA on
   light ground". Measured, it is 3.63:1 on `--vy-bg`: fine for a dot, a rule or a large bold
   figure, and a fail for anything smaller. Rather than change the plan's hue, the system splits
   the role the way the Finch ramp already had to: `--vy-accent` is a FILL, `--vy-accent-ink`
   (`#A8410C`, 5.9:1) is accent TEXT on paper, and `--vy-accent-on-dark` (`#FFB27A`, 8:1) is
   accent text on the dark band. `--vy-accent-tint` is the chip/alert ground.

3. **`--vy-ink-4` is documented as non-text.** 2.7:1 on `--vy-bg`. It is in the ramp because
   rules, disabled glyphs and large mono labels want it; the token's comment says to reach for
   `--vy-ink-3` the moment it is a sentence.

4. **`EventTimeline`'s stagger is 550ms, not the system's 80ms cap.** Plan §4 caps *grid*
   stagger at 80ms and §7.1 asks for ~600ms per event on the hero timeline. These are different
   things: a grid of four cards is one idea arriving in four pieces; the timeline is five things
   happening one after another over a morning. `Reveal` and `stagger()` keep the 80ms ceiling
   (`stagger()` clamps its own step so a caller cannot exceed it). `interval` is a prop.

5. **The timeline's row content animates on transform only.** `motion` serialises a rest
   variant into the server HTML, so an `opacity: 0` rest state would ship a demo that is
   invisible until JavaScript arrives, which is the trade `components/finch/site/Reveal.tsx`
   refused. Verified in the served HTML: every row's text carries only
   `style="transform:translateY(14px)"`. The dot (`opacity: 0`) and the rail (`scaleY(0)`) do
   fade and grow, because they are decoration and their absence costs a reader nothing.

6. **The WhatsApp chrome is green.** Two local constants in `ChromeFrame.tsx`
   (`#075E54` header, `#DCF8C6` out-bubble), deliberately NOT `--vy-*` tokens. Colour on this
   site lives inside the product, and a grey WhatsApp header communicates nothing to the one
   audience that has to recognise it instantly. Keeping them local stops them being reused as
   decoration.

7. **The nav CTA is visible at 375px**, at a new `size="sm"` (13px). Hiding the site's single
   conversion target behind a hamburger on phones would be the wrong economy; `sm` is what makes
   the row fit. Verified at 375px: no horizontal overflow (`document.scrollWidth === 375`).

8. **The Footer's Solutions column links to three routes that do not exist yet**
   (`/solutions/whatsapp-order-automation`, `/invoice-automation`, `/inventory-automation`).
   Phase 2c creates them. They 404 until then. Listing them now is deliberate so the footer's
   real shape is reviewable; Phase 2c must not rename these slugs without updating `Footer.tsx`.

9. **The `/design/vyso` sample copy uses "Thyme and Basil" as a demo customer.** That is the
   house demo name already in use on the live homepage, inside a mockup, and it is not a claimed
   client. Rand figures in the script are operational (R18,420 order, R91/kg supplier price),
   never a Vyso fee. Phase 1 should keep this distinction.

### Verification

- **`npx tsc --noEmit`** — 29 errors, ALL pre-existing and ALL in Josh's untracked free-scan
  work (`components/finch/scan/**`, `tests/free-scan-content.test.ts`): that code emits
  `free_scan_*` analytics events that `lib/analytics.ts` does not declare. Zero errors in any
  file touched by this phase (`npx tsc --noEmit | grep -v free-scan` returns nothing). Not
  fixed: plan §10 puts those files off limits.
- **`npm run build`** — FAILS, for the same pre-existing reason. Turbopack reports
  `✓ Compiled successfully in 11.0s`, then `Failed to type check` at
  `components/finch/scan/scan-content.ts:447` on `"free_scan_viewed"`. Compilation of this
  phase's code is therefore proven; the type-check gate is blocked by untracked work outside the
  redesign's scope. **Phase 1 will hit the same wall** — either Josh adds the `free_scan_*`
  events to `lib/analytics.ts`, or build verification stays "compiles, type-check blocked
  upstream" for the whole redesign.
- **`npm run lint`** — 50 errors / 40 warnings, ALL pre-existing, ALL in `app/app/**`,
  `components/platform/**`, `lib/platform/**`, `.ai/design/**` and untracked free-scan files
  (mostly `react-hooks/set-state-in-effect`). `npx eslint components/vyso app/design/vyso
  app/api/contact` is clean.
- **Dev server** (`next dev -p 3100`; port 3000 was occupied by the Claude desktop app).
  `GET /design/vyso` → **200**, 148,953 bytes. Every string checked in the served HTML:
  the hero script's six events, "Supplier A has butternut at R91 per kg", "You are 9 boxes
  short", R18,420, `class="vyso-site"`, `data-vy-ground="dark"`, `id="main"`,
  `aria-label="Primary"`, the wordmark, "Johannesburg, South Africa", "Play again",
  `<meta name="robots" content="noindex">`. All demo copy is real DOM text.
- **Console** — no application errors. The only errors are PostHog `/ingest` 404s, which are
  local-config noise from Josh's untracked `instrumentation-client.ts` (plan §15 lists the
  `/ingest` rewrite as his scope). No hydration warnings.
- **Browser** — desktop and 375px screenshots correct: nav row, wordmark, two-tier headline,
  type scale, ink CTA. No horizontal overflow at 375px. Scrolling could not be driven inside
  the Browser pane; confirmed environmental, not a CSS regression, by reproducing the same
  frozen scroll on the existing `/about` page in the same session.
- **Copy sweep** — `[—–]` over the RENDERED page text: 0 hits. No banned phrases, no module
  codenames, no prices for Vyso's fees in `components/vyso` or `app/design/vyso`.
- **Forms dev gate** — proven against the running dev server:
  - valid audit submission → `200 {"success":true}`, no mail, no rate-limit RPC. Server log:
    `[contact] dev gate: not sent. variant=audit name=11ch business=14ch challenge=43ch
    email=***@example.com whatsapp=***000 — set ALLOW_REAL_SENDS=1 to send for real.`
  - missing fields → `400 {"error":"Missing required fields."}`
  - malformed email → `400 {"error":"Please enter a valid email address."}`
  The gate sits AFTER validation (so local QA still exercises every 400) and the rate-limit call
  is guarded as `if (!devGate && !(await rateLimitAllowed(...)))`, so in production `devGate` is
  `false`, `!devGate` short-circuits to the original call, and the path is unchanged.
- Dev server stopped.

### What Phase 1 needs to know

**Wear the shell.** A page that forgets `Shell` renders in the old marketing theme. `Shell`
owns `.vyso-site`, `<main id="main">` and the footer.

**Import `stagger` from `@/components/vyso/stagger`, never from `Reveal`.** `Reveal` is
`"use client"`, so a server component importing `stagger` from it gets a client reference and
throws "Attempted to call stagger() from the server" at render. This happened once already
while building `/design/vyso`.

**Component APIs** (exact signatures):

```ts
// components/vyso/Shell.tsx
Shell({ children, active?: VysoNavSection = "none", footer?: boolean = true, className?: string })

// components/vyso/Nav.tsx
type VysoNavSection = "how-it-works" | "solutions" | "case-studies" | "about" | "insights" | "none"
type VysoNavLink   = { section: VysoNavSection; href: string; label: string }
Nav({ active?: VysoNavSection = "none" })
export const VYSO_NAV_LINKS: VysoNavLink[]
export const VYSO_NAV_CTA   = { href: "/operations-audit", label: "Free Operations Audit" }
export const VYSO_NAV_LOGIN = { href: "/login", label: "Log in" }

// components/vyso/Section.tsx
type SectionGround  = "paper" | "dark"
type SectionWidth   = "narrow" | "content" | "wide"      // 720px / 1120px / 1280px
type SectionSpacing = "none" | "tight" | "default" | "loose"
Section({
  children?: React.ReactNode,
  eyebrow?: string,                 // rendered .vy-label
  heading?: React.ReactNode,        // tier one, --vy-ink
  continuation?: React.ReactNode,   // tier two, --vy-ink-3, same heading element
  lead?: React.ReactNode,           // .vy-body-lg, --vy-ink-3
  headingLevel?: 1 | 2 | 3 = 2,     // 1 only for the page's hero
  ground?: SectionGround = "paper", // "dark" sets data-vy-ground="dark"
  width?: SectionWidth = "content",
  spacing?: SectionSpacing = "default",
  divider?: boolean = false,        // hairline ABOVE the section
  align?: "left" | "center" = "left",
  id?: string, className?: string, headerClassName?: string,
})

// components/vyso/Button.tsx
type ButtonVariant = "primary" | "secondary" | "quiet"
type ButtonSize    = "sm" | "md" | "lg"          // sm is the nav's
Button<E extends AnalyticsEvent>({
  href: string,
  children: React.ReactNode,
  variant?: ButtonVariant = "primary",
  size?: ButtonSize = "md",
  event?: E,                        // both event AND eventProps -> renders TrackedLink
  eventProps?: AnalyticsEvents[E],
  arrow?: boolean,                  // defaults true on "quiet"
  className?: string,
})

// components/vyso/Card.tsx
type CardPadding = "none" | "sm" | "md" | "lg"
Card({ children, padding?: CardPadding = "md", interactive?: boolean = false,
       as?: "div" | "li" | "article" | "figure" = "div", id?: string, className?: string })
Pill({ children, accent?: boolean = false, className?: string })

// components/vyso/Reveal.tsx   ("use client")
Reveal({ children, delay?: number = 0, y?: number = 12, fade?: boolean = false,
         as?: "div" | "li" | "figure" = "div", id?: string, className?: string })
// components/vyso/stagger.ts
stagger(index: number, step?: number = 0.07, cap?: number = 5): number   // step clamped to 0.08

// components/vyso/Wordmark.tsx
Wordmark({ size?: "nav" | "sheet" | "footer" = "nav", tone?: "ink" | "paper" = "ink", className?: string })

// components/vyso/demo/ChromeFrame.tsx
type ChromeVariant = "window" | "whatsapp"
ChromeFrame({ children, variant?: ChromeVariant = "window", title?: string,
              meta?: string,        // window bar, right slot
              subtitle?: string,    // whatsapp only, under the name
              flat?: boolean = false,   // drops --vy-shadow-float
              className?: string })
WhatsAppBubble({ children, side?: "in" | "out" = "in", time?: string, className?: string })

// components/vyso/demo/FindingCard.tsx
type FindingState = "alert" | "watching" | "resolved"    // accent on "alert" only
FindingCard({
  source?: string = "VYSO NOTICED",
  state?: FindingState = "alert",
  observation: React.ReactNode,     // required
  impact?: React.ReactNode,
  evidence?: string,
  meta?: string,
  actions?: readonly string[],      // labels, not controls
  className?: string,
})

// components/vyso/demo/EventTimeline.tsx   ("use client")
type TimelineEventKind = "event" | "check" | "alert" | "recommendation"
type TimelineEvent = { time: string; kind: TimelineEventKind; title: string; body?: string; meta?: string }
type TimelineScript = TimelineEvent[]
EventTimeline({
  script: TimelineScript,
  interval?: number = 0.55,         // seconds between events
  replay?: boolean = false,         // "Play again" button; hidden under reduced motion
  label?: string = "Example sequence",   // aria-label; give each instance its own
  className?: string,
})
```

**Rules the primitives will not enforce for you:**

- One `headingLevel={1}` per page, and it is the hero's.
- One `ground="dark"` `Section` per page, and it is the closing CTA.
- `--vy-shadow-float` belongs to `ChromeFrame` and the hero demo. `Card` is flat.
- Accent (`Pill accent`, `FindingCard state="alert"`, timeline `alert`/`recommendation`) is the
  signal, not a decoration budget. Roughly one accented thing per section.
- Timeline `time` values are static strings, always.
- The 375px nav row is full at `size="sm"`. A longer CTA label will break it.

---

## Phase 1

The homepage, on the Phase 0 system: nine sections, the new metadata, the first
`--vy-*` OG image, and the JSON-LD repositioning. Reviewable at
`http://localhost:3100/`.

### Files created

| Path | What it is |
|---|---|
| `components/vyso/home/HomeHero.tsx` | H1, support line, two CTAs, and the hero demo in window chrome |
| `components/vyso/home/HomeDifferentiation.tsx` | The differentiator sentence + 01 Automate / 02 Understand / 03 Act |
| `components/vyso/home/HomeExamples.tsx` | The brief's four scenarios, as one WhatsApp vignette and three `FindingCard`s |
| `components/vyso/home/HomeTools.tsx` | Nine logo marks with names, and the integration-honesty line |
| `components/vyso/home/HomeBespoke.tsx` | The inputs → layer → outputs diagram, in HTML |
| `components/vyso/home/HomeProcess.tsx` | Five steps + the audit CTA |
| `components/vyso/home/HomeFounder.tsx` | The founder story, narrow measure, no demo |
| `components/vyso/home/HomeCase.tsx` | Turn 'n Slice, with `[TNS_NUMBER]` intact |
| `components/vyso/home/HomeClose.tsx` | The page's one dark band |
| `lib/og/vyso.tsx` | `renderVysoOgImage` — the `--vy-*` OG template, for Phase 3 to reuse |

Every section is a SERVER component. The only client leaves on the page are
`EventTimeline`, `Reveal` and the nav's `MobileMenu`, so every heading,
sentence, timestamp and rand figure is plain HTML in the first response.

### Files modified

- **`app/page.tsx`** — replaced whole. Composes the nine sections inside
  `Shell`; carries the metadata block.
- **`app/opengraph-image.tsx`** — rebuilt on `lib/og/vyso.tsx`.
- **`lib/marketing/site.ts`** — `SITE.description` only.
- **`app/layout.tsx`** — the JSON-LD graph (§8) and its docblock. The Finch
  `SoftwareApplication` node is gone; a `ProfessionalService` node replaces it;
  `alternateName` moved from "AI automation agency" to "AI operations company".
  Nothing else in the file changed: the fonts, the mounts and the title template
  are untouched.
- **`lib/og/fonts.ts`** — additive. `loadOgFonts()` keeps its exact signature and
  behaviour; the fetch behind it now takes a stylesheet URL, and
  `loadVysoOgFonts()` is a second entry point on a second cache key.
- **`lib/og/render.tsx`** — one line: `Wordmark` is exported and takes an
  optional `fill` (defaulting to the old value), so the new template draws the
  same mark instead of keeping a second copy of eight path strings.

No other route, no nav or footer file, no other `lib/marketing` file, and none
of Josh's untracked work was touched.

### Section notes

**Hero.** The one section that does not use `Section`'s header, because the
headline and the demo sit BESIDE each other and `Section` stacks its header
above its children in a 760px column. The `h1` is written in the grid instead;
it is still the page's only one and still the two-tier construction. The script
is the brief's §13 verbatim in content: WhatsApp order → captured → invoiced →
stock checked (31 of 40) → 9-box shortage → Supplier A at R91 per kg.

**Differentiation.** No illustration on purpose: the hero above it is the
illustration, and a second demo forty pixels later asks the reader to watch the
same thing twice. This section is the hero's caption, in words.

**Examples.** Four cells, each label + claim + vignette. Cell 1 compresses the
order story (WhatsApp chrome + one `FindingCard`) rather than re-running the
hero's timeline. Cells 2-4 are `FindingCard`s at `watching`, `alert` and
`resolved`.

**Tools.** Nine marks from `public/finch/integrations/`, each with its NAME as
real text under it. `claude`, `gpt`, `n8n` and `notion` are left out: they are
Vyso's own build stack and internal system of record, not the customer's tools,
and this grid answers "will it work with what I run". The honesty line is
grounded in `lib/marketing/integrations.ts`: Xero and WhatsApp Business are the
two real connections, everything else is designed around.

**Bespoke.** HTML, not SVG. The drawing is three lists and two arrows; as HTML
it is three `<ul>`s that reflow into one column on a phone and that a screen
reader can walk, and there is no geometry here that SVG would buy. The arrows
are `aria-hidden` and flip from → to ↓ with the layout; the `<figcaption>` says
in a sentence what the picture says in three columns.

**Process.** An `<ol>`, because the order is the meaning. The step numbers are
`aria-hidden` duplicates of the list's own ordinals.

**Founder.** Narrow measure, three paragraphs, no demo, no photograph (none
exists in the repo, and a stock face under a story about someone's father is
worse than no face).

**Case.** `[TNS_NUMBER]` renders verbatim, with a mono line under it saying the
figures are being confirmed, so a reviewer reads a pending fact rather than a
bug.

**Close.** The page's one `ground="dark"` section, and the last thing on it.

### Deviations, and why

1. **The hero does not use `Section`'s header.** See above. It repeats
   `Section`'s own rhythm constants rather than inventing new ones, and it is
   the only section that does this.

2. **The Examples section carries two accented cards, not one.** The rule of
   thumb is roughly one accented element per section, and it exists so the
   accent stays a signal. This is the one section whose SUBJECT is the signal.
   Two of the four examples are money leaving the building (a shortage, an
   overcharge) and are painted; the margin is a pattern being watched and the
   meeting is already prepared, and both are grey. Four accented cards would be
   the failure the rule guards against; zero would be a section about noticing
   that never shows the notice.

3. **The founder section's "365 hours" line is cut.** Plan §14.4 left this to
   the builder. The brief's own note answers it ("focus on the meaning of the
   time, not the maths") and the arithmetic is the one line in that section that
   reads as a pitch.

4. **A new OG module (`lib/og/vyso.tsx`) rather than a repaint of
   `lib/og/render.tsx`.** Plan §8 says "rebrand template", but thirty routes
   still render through `render.tsx`, `/orbit/**` among them, and plan §10 puts
   Orbit off limits. Repainting it in `--vy-*` would silently restyle every one
   of them mid-migration. `lib/og/orbit.tsx` already set the sibling-module
   precedent. Phase 3 points the remaining rebuilt pages at
   `renderVysoOgImage`, and `render.tsx` dies with the last route that uses it.

5. **`lib/og/fonts.ts` gained a second loader.** The new template needs
   Instrument Sans and Inter; the old one loads STIX and DM Sans. Two URLs and
   two cache keys, rather than one stylesheet that makes every existing OG image
   pay for the other template's faces. `loadOgFonts()` is behaviourally
   identical, and `/about` and `/orbit` OG images were re-rendered to prove it.

6. **The meta description is the brief's support line minus one adverb.** The
   line as written is 160 characters; dropping "proactively" brings it to 148,
   inside the 155 budget. The ON-PAGE hero support line is the full sentence,
   adverb included.

7. **`canonical` is the absolute `https://vyso.co.za`**, not the layout's `"/"`.
   `metadataBase` resolves `"/"` with a trailing slash, and `app/sitemap.ts`
   publishes the root without one; a canonical that disagrees with the sitemap
   about a trailing slash is a self-inflicted duplicate.

8. **`alternateName` in the Organization node changed.** Not named in the task,
   but it said "Vyso AI automation agency", which is the positioning §2
   explicitly retires. It is now "Vyso AI operations company".

### Verification

- **`npx eslint app/page.tsx components/vyso lib/marketing/site.ts
  app/opengraph-image.tsx lib/og app/layout.tsx`** — clean, zero output.
- **`npx tsc --noEmit`** — 29 errors, all pre-existing, all in Josh's untracked
  free-scan work (`components/finch/scan/**`, `tests/free-scan-content.test.ts`)
  emitting `free_scan_*` events that `lib/analytics.ts` does not declare. The
  file list is byte-identical to Phase 0's. Zero errors in any file this phase
  touched.
- **`npm run build`** — FAILS, same pre-existing wall as Phase 0. Turbopack
  reports `✓ Compiled successfully in 11.2s`, then `Failed to type check` at
  `components/finch/scan/scan-content.ts:447`. Compilation of this phase's code
  is proven; the type-check gate stays blocked upstream until Josh adds the
  `free_scan_*` events to `lib/analytics.ts`. NOT fixed: plan §10.
- **Dev server** `next dev -p 3100` (3000 is the Claude desktop app).
  `GET /` → 200, 169,471 bytes.
- **Served HTML** (`curl`), every string checked and present as real DOM text:
  the six hero events, "Shortage detected: 9 boxes required", "Supplier A has
  sufficient stock", "R91 per kg", "R4.20 per kg over", "8.4% against a 17.8%
  average", "Xero and WhatsApp Business connect directly today", both
  `[TNS_NUMBER]`s, `class="vyso-site"`, `id="main"`, exactly one
  `data-vy-ground="dark"`, exactly one `<h1>`, eight `<h2>`.
- **Metadata** in the response: `<title>Vyso | Automation that knows what
  happens next</title>` (45 chars), the 148-char description, `<link
  rel="canonical" href="https://vyso.co.za"/>`, and og/twitter title,
  description, url, site_name, locale, type plus the file-convention
  `og:image` / `twitter:image` at 1200×630.
- **JSON-LD** parsed from the response: `["Organization", "WebSite",
  "ProfessionalService", "Service"]`. No `SoftwareApplication`, no "Finch"
  anywhere in the document.
- **Copy sweep** over the rendered text: `[—–]` → 0 hits. Banned-phrase and
  codename sweep (transform your business, unlock the power, revolutionary,
  cutting-edge, future-proof, next-generation, harness, leverage, streamline
  everything, seamless, digital transformation, ecosystem, synergy, COO, per
  location, founding client, OrderFlow, PricePilot, ProcurePulse, Doc-U,
  SupplySync, ServiceDen, InsightGen, WasteWatch, ShiftBoard, PlanWise, Academy,
  Finch) → 0 hits. No rand figure on the page is a Vyso fee; every one is
  operational.
- **Desktop 1440** — full-page screenshot correct. `documentElement.scrollWidth`
  1425 against a 1440 viewport: no horizontal overflow.
- **Mobile 375** — `scrollWidth === 375`, no horizontal overflow. Nav row fits
  at `size="sm"`. Every grid collapses to one column; the tools grid goes to
  3×3; the bespoke diagram stacks with ↓ arrows.
- **Reduced motion** — emulated by patching `matchMedia` and forcing a
  re-render. Result: the "Play again" button disappears (it should), and all six
  timeline rows settle to `transform: none` and render complete, without
  depending on being scrolled into view. Independently, the SERVER HTML carries
  every row's text with a transform-only rest style, so the demo is readable
  before JavaScript arrives at all.
- **Console** — no application errors and no hydration warnings. The only
  errors are the known PostHog `/ingest` 404s from Josh's untracked
  `instrumentation-client.ts` (four of them; they are the whole of the dev
  overlay's issue count).
- **OG images** — `/opengraph-image` → 200, `image/png`, 1200×630, 83.5 KB, and
  it renders correctly with Instrument Sans, Inter and Plex Mono loaded.
  Regression check on the shared font module: `/about/opengraph-image` → 200 and
  `/orbit/opengraph-image` → 200, both still in the old template, visually
  unchanged.
- Dev server stopped.

### What Phase 2 needs to know

**Compose from `components/vyso/home/*`, do not import them.** They carry
homepage copy. What transfers is the SHAPE, and there are five shapes worth
copying:

1. **Section + eyebrow + two-tier heading + lead, then one child.** Every
   section on the page except the hero is exactly this, and the hairline
   `divider` between neighbours is what makes the page read as a rhythm rather
   than a stack. The first section on a page passes `divider={false}` (the
   default); every one after it passes `divider`.

2. **A claim and one focused vignette, never a dashboard dump.** `HomeExamples`
   is the pattern: a `vy-label`, an `h3` claim, then ONE object (a
   `FindingCard`, a `ChromeFrame`, a short `EventTimeline`). Solution pages want
   this per workflow; industry pages want it per problem.

3. **`EventTimeline` is the site's grammar and every page feeds it a different
   script.** Give each instance its own `label` ("Example: a supplier invoice
   arriving on a Thursday"), keep `replay` for the page's primary demo only, and
   keep every `time` a static string. A script with more than two accented rows
   (`alert` / `recommendation`) has no signal in it.

4. **The three-column HTML diagram** in `HomeBespoke` generalises to any
   in → layer → out story. Copy `Column` and `Flow`; keep the `<figcaption>`,
   because it is what a screen reader gets instead of the arrows.

5. **The dark band closes the page and nothing else.** `HomeClose` is 40 lines
   and every page's closer should be about that long. Buttons need no tone prop
   on it.

**The rules Phase 0 could not enforce still are not enforced.** One
`headingLevel={1}` per page and it is the hero's; one `ground="dark"` per page
and it is the closer; the shadow belongs to `ChromeFrame`; roughly one accented
element per section, and if you exceed it, say why in your report.

**Metadata pattern to copy from `app/page.tsx`:** `title` (plain string, so the
layout's `"%s | Vyso"` template applies — only `/` needs `absolute`), a
description under 155 characters, an explicit `canonical`, and a FULL
`openGraph` object, because Next replaces the layout's rather than merging into
it. Never add an `images` key: the file convention resolves the nearest
`opengraph-image.tsx` and a hard-coded array overrides it.

**New OG images go through `lib/og/vyso.tsx`**, not `lib/og/render.tsx`. Pass a
headline the page actually carries and a feed the page actually shows.

**Two things Phase 1 changed that will surface on other pages, both expected:**

- `SITE.description` is now the new positioning, so every page that has not set
  its own description inherits it. That is the intent of plan §8.
- `app/layout.tsx`'s DEFAULT title and og title still read "Vyso, AI automation
  agency in South Africa". Only `/` sets its own, so that string is the fallback
  for any page without one until Phase 3's plumbing pass. `/about`'s OG image
  still reads "The company behind Finch." — Phase 2b's file, flagged here so it
  is not missed.
