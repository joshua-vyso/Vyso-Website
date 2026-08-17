# Integrations orbit — research

Two-part research task: (1) reverse-engineer folk.com's radial-integrations hero
mechanic, (2) source logo assets for Vyso's integration roster. No source files
were modified; new assets were written under `public/finch/integrations/` and
this file under `.ai/research/`.

---

## Part 1 — folk.com radial-integrations hero

Scraped `https://www.folk.com/` (2026-08-15) with Firecrawl (markdown, html,
rawHtml, screenshot). **Important finding first:** folk.com is no longer a CRM
product — it's now "folk — the friend in your texts", a personal AI-assistant
product (Poke/OpenClaw-style). The radial widget described in the brief
("always on, all yours" copy + orbiting integration logos + a "Checking X"
status chip) is real and still on the page — the mechanic matches exactly —
but the roster and framing are for this assistant product, not a CRM. All
findings below are backed by the live rendered DOM and by the actual
(un-minified-by-hand but readable) Next.js JS/CSS bundles, not guesswork,
except where explicitly marked "**inference**".

The hero section headline is literally `"always on, all yours"`, confirming
this is the right widget:

```
the reason folk can fight for your money and stay on your goals: it runs
on its own computer 24/7, connected to your bank, gmail, calendar, and
the open web. you ask once - it keeps working while you live your life.
```

### DOM structure

Simplified tree of the widget (real class names, from rendered `rawHtml`):

```html
<div class="pointer-events-none absolute inset-x-0 top-0 mx-auto h-full max-w-[1680px] overflow-hidden">
  <div class="capability-orbit-frame absolute ... [breakpoint size/position utility classes]">
    <div class="capability-orbit-vmask absolute inset-0">     <!-- fade mask -->
      <div class="absolute inset-0 rotate-90 transform-gpu lg:rotate-0"> <!-- portrait-safe rotation wrapper -->
        <!-- rim ring (faint circle) -->
        <div aria-hidden="true" class="absolute ... rounded-full opacity-70"
             style="width:var(--orbit-ring-size,630px);height:var(--orbit-ring-size,630px);
                    box-shadow:var(--orbit-rim-shadow)"></div>
        <!-- capsule / "track pill" the folk circle sits inside -->
        <div aria-hidden="true" class="absolute top-1/2 -translate-y-1/2 rounded-full opacity-90"
             style="left:calc(50% + var(--track-pill-offset,-20px));
                    width:var(--track-pill-length,414px);
                    height:var(--track-pill-thickness,144px);
                    box-shadow:var(--orbit-rim-shadow)"></div>
        <!-- thin radial connector line -->
        <div aria-hidden="true" class="absolute ... h-[1px] opacity-50"
             style="width:var(--orbit-line-length,720px);
                    background:linear-gradient(90deg,transparent,var(--orbit-line-color) 38%,
                                var(--orbit-line-color) 62%,transparent)"></div>
        <!-- central "folk" pill (with a pulsing conic-gradient glow + wordmark) -->
        <div class="absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center
                     rounded-full bg-[var(--color-cream)] text-[var(--color-ink)]"
             style="left:calc(50% + var(--folk-offset,58px));
                    width:var(--folk-pill-size,120px);height:var(--folk-pill-size,120px);
                    box-shadow:var(--orbit-folk-shadow)">
          <!-- pulse glow div (conic-gradient, keyed by activeIndex) -->
          <!-- <svg aria-label="folk">folk</svg> wordmark -->
        </div>
        <!-- 11 orbit item tiles, one per visible slot (offset -5..+5 around active) -->
        <div class="absolute left-1/2 top-1/2 transform-gpu will-change-[transform,opacity,filter]"
             style="width:var(--orbit-size-active,120px);height:var(--orbit-size-active,120px);
                    transform:translate(-50%,-50%) rotate({angle}deg)
                              translateY(var(--orbit-radius,-315px)) rotate({-angle}deg)
                              scale({scale});
                    opacity:{opacity};filter:blur({blur}px);
                    transition:transform 650ms cubic-bezier(.22,1,.36,1),
                               opacity 750ms cubic-bezier(.22,1,.36,1),
                               filter 750ms cubic-bezier(.22,1,.36,1)">
          <div class="flex h-full w-full items-center justify-center overflow-hidden rounded-full p-[3px]
                       -rotate-90 transform-gpu backface-hidden lg:rotate-0"
               title="Gmail" aria-label="Gmail"
               style="background:var(--tile-bg-default,var(--color-cream));
                      box-shadow:var(--orbit-card-shadow)"> <!-- or *-active for the docked one -->
            <svg>...brand mark...</svg>
          </div>
        </div>
        <!-- × 11 -->
      </div>
    </div>
  </div>
</div>

<!-- Separate from the orbit visual, in the LEFT copy column next to the CTA button: -->
<div data-status-pill class="card-emboss ... rounded-[14px] bg-[var(--color-cream)] py-1.5 pl-4 pr-5 ...">
  <span class="relative h-6 w-full overflow-hidden"><!-- crossfading icon + "Checking Gmail" text --></span>
</div>
```

Key correction to the brief's framing: the status chip ("Checking Gmail") is
**not** overlaid on the capsule itself — it's a separate pill rendered in the
hero's left copy column, right next to the "try folk free" CTA button. It's
`hidden` below `lg` (desktop-only). Source (from the JS bundle, function that
builds the hero, chunk `0cq7hjx4i1o64.js`-family, minified var names kept):

```js
x = (0,l.jsx)(S, { status: q, tool: R, className: "hidden lg:flex" })
u = (0,l.jsxs)("div", {
  className: "mt-11 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start",
  children: [p /* CTA button */, x /* status pill */],
})
```

### Motion mechanism — JS state + CSS transitions, not keyframes/GSAP/Lottie

There is no CSS `@keyframes` rotation and no GSAP/Framer Motion driving the
ring's position (Framer Motion — an `o.m.div` / `AnimatePresence`, i.e. the
`framer-motion` library — is used only for the status pill's text crossfade
and width tween, not for the ring). The ring itself is:

- **Discrete steps, not continuous rotation.** A `setInterval` fires every
  **1800ms** and bumps a single `activeIndex` integer by 1 (mod roster
  length). Nothing rotates in between — each tick just re-renders 11 items
  with new inline `transform/opacity/filter` values, and CSS `transition`
  (650ms transform, 750ms opacity/filter, both
  `cubic-bezier(0.22, 1, 0.36, 1)`) animates the change smoothly.

```js
i = () => {
  if (!I) return;                              // I = "section visible" flag
  let e = window.setInterval(() => { $(H) }, 1800);
  return () => window.clearInterval(e);
};
function H(e) { return (e + 1) % y.length }     // y = the 16-tool roster array
```

- **Visibility-gated, not hover/reduced-motion-gated.** `I` combines an
  `IntersectionObserver` (`rootMargin: "320px 0px"`, i.e. keeps running
  slightly before/after the section is in view) and
  `document.visibilityState`/`visibilitychange` (pauses when the browser tab
  is backgrounded). **No `prefers-reduced-motion` check and no
  mouseenter/mouseleave pause were found anywhere in this component** — I
  searched the whole bundle for `reduced-motion`/`useReducedMotion` and the
  only hit is in an unrelated testimonials carousel elsewhere on the page.
  This may be inference-adjacent: it's possible a *global* stylesheet rule
  neutralizes `transition`/`animation` under `prefers-reduced-motion` broadly
  (I didn't find one in the CSS I fetched, but I did not fetch every CSS
  chunk), but at the component level there is no explicit opt-out. **Vyso's
  own marquee (`IntegrationsMarquee.tsx`) already does this better** — it has
  an explicit `prefers-reduced-motion` media-query listener and a fully
  static fallback render.

- **Which item is "docked"/enlarged, and the falloff table.** Each rendered
  item gets `offset = index - activeIndex` (wrapped, range -5..+5, 11 visible
  of 16 total) and an `angle = 90 + 30 * offset` degrees, i.e. items sit 30°
  apart on the ring and the *active* one (offset 0) always renders at 90°
  (visually the right/3-o'clock side of the ring on desktop — the side where
  the capsule/folk-pill live, which is what produces the illusion of a big
  logo "docked" against the folk circle). Size/opacity/blur are a **fixed
  lookup table keyed by `|offset|`**, not a continuous formula:

```js
// size, by |offset|: 0→120px(active), 1→96px, 2→86px, 3+→76px (desktop values)
d = (0===e ? 120 : 1===e ? 96 : 2===e ? 86 : 76) / 120;   // → scale factor
// opacity/blur, by |offset| (0..5): {1,0}, {.9,0}, {.52,.35}, {.24,.75}, {.11,1.1}, {.05,1.5}
```

  Confirmed empirically from the live DOM snapshot (11 of 16 tools visible,
  `Cursor` was the active/docked one at scrape time):

```
Google Calendar  offset -5  scale .633  opacity .05  blur 1.5
Instagram        offset -4  scale .633  opacity .11  blur 1.1
Figma            offset -3  scale .633  opacity .24  blur .75
PostHog          offset -2  scale .717  opacity .52  blur .35
ChatGPT          offset -1  scale .8    opacity .9   blur 0
Cursor           offset  0  scale 1     opacity 1    blur 0   ← active/docked
Strava           offset +1  scale .8    opacity .9   blur 0
Oura             offset +2  scale .717  opacity .52  blur .35
Outlook          offset +3  scale .633  opacity .24  blur .75
Teams            offset +4  scale .633  opacity .11  blur 1.1
GitHub           offset +5  scale .633  opacity .05  blur 1.5
```

  The active tile also gets an extra warm glow box-shadow layered on:
  `box-shadow: var(--orbit-card-shadow-active), 0 0 0 1px rgba(251,191,36,.10), 0 0 28px -10px rgba(251,191,36,.20)`
  (all others just get `var(--orbit-card-shadow)`) — greyscale/dimming itself
  is achieved with plain `opacity` + a small `blur()` filter, not a CSS
  grayscale filter or a colour swap.

- **Status-chip text.** Verb is looked up per-slug (fallback `"Using"`),
  then `${verb} ${tool.name}`:

```js
switch (R.slug) {
  case "github": c = "Opening";  break;
  case "linear": c = "Updating"; break;
  case "notion": c = "Reading";  break;
  case "gmail":  c = "Checking"; break;
  case "gcal":   c = "Checking"; break;
  default:       c = "Using";
}
let W = c, q = `${W} ${R.name}`;   // e.g. "Checking Gmail", "Opening GitHub"
```

  So `"Checking Gmail"` is a real, literal string this component can produce
  — it happens whenever `activeIndex` lands on the `gmail` roster entry. The
  chip itself (`S` component) is a Framer Motion `motion.div` whose `width`
  animates (`Math.ceil(84 + 7.35 * status.length)`, 280ms tween, same easing)
  to fit the new text, and its inner icon+text swap via
  `AnimatePresence`/`y: 12→0, opacity 0→1, blur(2px)→blur(0)`, 200ms — a
  vertical slide/blur crossfade, keyed by `${slug}-${status}` so it re-plays
  on every tool change.

- **Full roster (16 tools, in array order) and default state:**
  `github, linear, notion, gmail, x, slack, gcal, instagram, figma, posthog,
  chatgpt, cursor, strava, oura, outlook, teams`. Initial React state is
  `useState(11)` → index 11 is `cursor`, which is exactly what the live
  scrape captured as the active/docked item — internally consistent.

### Geometry (from the compiled CSS, both breakpoints — authoritative, not
guessed)

```css
.capability-orbit-frame {           /* base / mobile */
  --orbit-radius: -300px;
  --orbit-ring-size: 600px;
  --orbit-line-length: 680px;
  --track-pill-length: 320px;
  --track-pill-thickness: 152px;
  --track-pill-offset: 55px;
  --orbit-size-active: 132px;
  --orbit-size-1: 108px; --orbit-size-2: 96px; --orbit-size-3: 84px;
  --folk-pill-size: 132px;
  --folk-offset: 130px;
}
@media (min-width: 1024px) {
  .capability-orbit-frame {
    --orbit-radius: -275px;
    --orbit-ring-size: 540px;
    --orbit-line-length: 640px;
    --track-pill-length: 365px;
    --track-pill-thickness: 144px;
    --track-pill-offset: -16px;
    --orbit-size-active: 120px;
    --orbit-size-1: 96px; --orbit-size-2: 86px; --orbit-size-3: 76px;
    --folk-pill-size: 120px;
    --folk-offset: 58px;
  }
}
```

(The inline fallback values seen in the DOM, e.g. `var(--orbit-radius,
-315px)`, are React's SSR safety defaults and don't exactly equal either
breakpoint's real CSS value — that's expected/harmless, the real values above
win once CSS loads.) The frame itself is also edge-masked
(`mask-image: linear-gradient(90deg, transparent 0%, ... , black, ...,
transparent 100%)`) so the ring visually fades out at the left/right edges of
its container rather than hard-clipping — this is what produces the "faint
arc" look for the outermost, most-dimmed logos.

### Summary answers to the specific brief questions

- **Rotating ring where the docked logo swaps?** Yes, but it's a *discrete
  index cycling with CSS-eased interpolation*, not a continuously spinning
  ring. Every 1800ms the "active" slot jumps to the next roster item; the
  smooth-looking sweep you see is 11 independent tiles each transitioning
  their own `rotate()/translateY()/scale()/opacity/blur` over 650–750ms.
- **Timing per step:** 1800ms hold, ~650–750ms CSS-eased transition between
  states, `cubic-bezier(0.22, 1, 0.36, 1)` throughout (an "ease-out-back-ish"
  curve, not a stock ease).
- **Active vs. greyed:** scale 1.0→0.633 and opacity 1.0→0.05 stepped by
  `|offset|` (table above), plus 0–1.5px blur and an extra amber glow
  shadow on the active tile only. No hue/grayscale filter is used.
- **Status chip:** lives beside the CTA button, not on the capsule; text is
  `${verb} ${ToolName}` with a small per-slug verb map, animated via Framer
  Motion width-tween + vertical slide/blur crossfade.
- **Pause on hover?** Not found — no hover handlers on this component.
- **Reduced motion?** Not found at the component level (see caveat above);
  Vyso's existing `IntegrationsMarquee.tsx` already handles this correctly
  and is arguably the better reference implementation for that concern.

---

## Part 2 — integration logos

### What the old site already has

**`components/marketing/IntegrationsMarquee.tsx`** — a self-scrolling "rail"
marquee (rAF-driven, own from-scratch goo/metaball SVG-filter effect, fully
documented in its own header comment). Its roster (`ROSTER` const, all
rendered as `next/image` `<img>` tags pointing at `/integrations/<file>.svg`,
i.e. inline files, not inline `<svg>` and not an icon library):

| Name | File |
|---|---|
| Xero | `xero.svg` |
| WhatsApp Business | `whatsapp.svg` |
| Gmail | `gmail.svg` |
| Yoco | `yoco.svg` |
| QuickBooks | `quickbooks.svg` |
| Notion | `notion.svg` |
| Claude | `claude.svg` |
| n8n | `n8n.svg` |
| Outlook | `outlook.svg` |
| SimplePay | `simplepay.svg` |
| Sage Accounting | `sage.svg` |
| Loyverse POS | `loyverse.svg` |
| GPT | `gpt.svg` |

All 13 files already exist at `public/integrations/*.svg` — every one of
those slugs was already sourced (mostly Simple Icons brand-colour marks, plus
two hand-authored marks and two Wikimedia-sourced marks, per the license
comments already embedded in `outlook.svg`/`gpt.svg`).

**`app/integrations/page.tsx`** — no brand logos at all; it lists generic
*categories* (Accounting software, POS systems, Inventory systems,
Spreadsheets, Communication tools, Supplier systems, Reporting tools, Custom
APIs) with Lucide icons, not vendor marks, and calls out Xero by name as the
one live integration.

**`components/finch/Senses.tsx`** (the new homepage's integrations section,
"SENSES, NOT INTEGRATIONS") — text-only, no logos at all currently:

```tsx
const SENSES: [string, string][] = [
  ["XERO",              "reads your books"],
  ["WHATSAPP BUSINESS", "where Finch talks to you"],
  ["YOCO",               "watches the takings"],
  ["SAGE",               "reads the ledger"],
  ["LOYVERSE",           "sees what leaves the shelf"],
];
```

These are the 5 target integrations named in the task, confirmed live on the
new homepage, with their exact existing status verbs.

### Target set → logo table

Deduplicated union: the 5 new-homepage integrations + the 8 additional ones
from the old marquee (13 total). All 13 already had usable SVGs in
`public/integrations/`; I copied each into `public/finch/integrations/`
(new location, no source files touched) and, for Gmail specifically, replaced
the copy with a genuine full-colour official mark (see note below).

| Integration | Slug | File (`public/finch/integrations/`) | Source | Colour | Notes |
|---|---|---|---|---|---|
| Xero | `xero` | `xero.svg` (1.8KB) | Simple Icons mark, brand blue `#13B5EA`, reused from repo's `public/integrations/xero.svg` | Single-hue brand colour | — |
| WhatsApp Business | `whatsapp` | `whatsapp.svg` (1.2KB) | Simple Icons mark, brand green `#25D366`, reused | Single-hue brand colour | — |
| Yoco | `yoco` | `yoco.svg` (322B) | Hand-authored (repo original), blue `#00A9E0` + white card glyph, reused | Two-tone (brand blue + white) | Yoco has no public vector brand kit found via search; this is a reasonable custom glyph already in production use |
| Sage | `sage` | `sage.svg` (1.8KB) | Simple Icons mark, brand green `#00D639`, reused | Single-hue brand colour | — |
| Loyverse | `loyverse` | `loyverse.svg` (1.7KB) | Hand-authored (repo original), orange `#f0843d`, reused | Single-hue brand colour | — |
| Gmail | `gmail` | `gmail.svg` (419B) | **New**: official multi-colour Gmail envelope, Wikimedia Commons "Gmail icon (2020)" — `https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg` (public-domain/simple-geometry per Commons file page; Google trademark applies, nominative fair use) | **Full colour** (blue/green/yellow/red) | Replaced the repo's existing single-red-hue Simple Icons Gmail mark per the brief's explicit "prefer full-colour, Gmail-style" instruction |
| QuickBooks | `quickbooks` | `quickbooks.svg` (677B) | Simple Icons mark, brand green `#2CA01C`, reused | Single-hue brand colour | — |
| Notion | `notion` | `notion.svg` (993B) | Simple Icons mark, black `#000000`, reused | Monochrome (Notion's actual wordmark/glyph is black) | Flagged: this is genuinely mono, matching Notion's own brand |
| Claude | `claude` | `claude.svg` (1.9KB) | Simple Icons mark, brand orange/rust `#D97757`, reused | Single-hue brand colour | — |
| n8n | `n8n` | `n8n.svg` (1.6KB) | Simple Icons mark, brand pink/red `#EA4B71`, reused | Single-hue brand colour | — |
| Outlook | `outlook` | `outlook.svg` (13.5KB) | Wikimedia Commons "Microsoft Outlook Icon (2025-present)", reused; licence note embedded in file header | **Full colour**, multi-gradient | File opens with an XML *comment* (license note) before `<svg>` — technically not byte-0 `<svg`/`<?xml`, flagged below |
| SimplePay | `simplepay` | `simplepay.svg` (473B) | Hand-authored (repo original), blue `#335EEA` + white glyph, reused | Two-tone (brand blue + white) | No public SimplePay (SA) vector brand kit found |
| GPT / OpenAI | `gpt` | `gpt.svg` (2.2KB) | Wikimedia Commons "ChatGPT-Logo.svg" (OpenAI blossom mark), reused; licence note embedded | **Monochrome** (black `#000000`) — this is correct/official, OpenAI's blossom mark genuinely has no colour version in common use | Same leading-comment caveat as Outlook |

**File-integrity check** (`file` + byte-0 check, per the brief):

- All 13 files pass `file <path>` as a valid SVG image (or are correctly
  detected as XML/HTML-flavoured text purely because of a leading comment —
  see below), all well under the 200KB cap (largest is `outlook.svg` at
  13.5KB).
- 11 of 13 start with a literal `<svg`. **Two do not**: `outlook.svg` and
  `gpt.svg` both open with an XML comment block (`<!-- Microsoft Outlook
  product icon... -->` / `<!-- OpenAI blossom logomark... -->`) containing
  the source/licence attribution, *then* `<svg>`. This is valid SVG (leading
  comments before the root element are legal XML) and these exact files are
  already live in production at `public/integrations/outlook.svg` and
  `public/integrations/gpt.svg`, so I kept them as-is rather than stripping
  the attribution comment — flagging this as a literal (not functional)
  deviation from the "must start with `<svg` or `<?xml`" check.

### Proposed status verbs for the additional 8 (Finch voice)

Matching the existing pattern (short, present-tense, lowercase, describes
what Finch does with that tool — not the tool's own tagline). These are
**proposed/inferred**, not sourced from any existing copy in the repo:

| Integration | Proposed verb |
|---|---|
| Gmail | "reads what lands in your inbox" |
| Outlook | "watches your Outlook inbox" |
| QuickBooks | "keeps your other set of books" |
| Notion | "remembers what's written down" |
| n8n | "runs the workflows behind the scenes" |
| Claude | "does the reasoning" |
| GPT | "backs up the thinking" |
| SimplePay | "watches payday" |

(Claude/GPT are odd fits for a "senses, not integrations" data-source list —
on the old marquee they read more like "built with"/AI-capability badges than
literal data connections. If they're kept on the new homepage's Senses
component, they'd need a different framing than the other six; flagging this
rather than forcing a verb that implies a fake data feed.)

---

## Files written

- `.ai/research/integrations-orbit.md` (this file)
- `public/finch/integrations/xero.svg`
- `public/finch/integrations/whatsapp.svg`
- `public/finch/integrations/yoco.svg`
- `public/finch/integrations/sage.svg`
- `public/finch/integrations/loyverse.svg`
- `public/finch/integrations/gmail.svg`
- `public/finch/integrations/quickbooks.svg`
- `public/finch/integrations/notion.svg`
- `public/finch/integrations/claude.svg`
- `public/finch/integrations/n8n.svg`
- `public/finch/integrations/outlook.svg`
- `public/finch/integrations/simplepay.svg`
- `public/finch/integrations/gpt.svg`

No files under the old `public/integrations/` or any component/page source
were modified.
