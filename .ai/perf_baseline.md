# Phase 4, Workstream D — SEO / accessibility baseline

Lighthouse (mobile, headless Chrome) against the **dev server**
(`http://localhost:3000`), categories `seo,accessibility,best-practices`
only. `performance` was deliberately excluded from every run — dev serves
unminified, unbundled, uncached assets, so a dev-mode performance score
would not reflect anything real. **Performance must be re-measured against
a production build** (`npm run build`) once that build is unblocked (it is
currently blocked by the untracked WhatsApp-ingest files — see the phase-4
standing rules). Raw JSON for every run is in the scratch dir as
`lh-before-<page>.json` / `lh-after-<page>.json`.

## Scores

| Page | SEO (before→after) | Accessibility (before→after) | Best Practices (before→after) |
|---|---|---|---|
| `/` | 100 → 100 | **91 → 96** | 100 → 100 |
| `/pricing` | 100 → 100 | 96 → 96 | 100 → 100 |
| `/operations-audit` | 100 → 100 | 97 → 97 | 100 → 100 |
| `/industries/food-suppliers` | 100 → 100 | 96 → 96 | 100 → 100 |
| `/compare/finch-vs-hiring-a-coo` | 100 → 100 | 97 → 97 | 100 → 100 |
| `/learn` | 100 → 100 | 96 → 96 | 100 → 100 |
| `/faq` | 100 → 100 | **96 → 100** | 100 → 100 |

SEO was already 100 on all seven pages before this workstream touched
anything — no SEO fix was needed. Accessibility is now **≥ 96 on all seven**
(target was ≥ 95). Best Practices is 100 everywhere except one audit
(`valid-source-maps`) that is unrelated to any file in this workstream's
scope — see "Not fixed" below.

Some scores (pricing/audit/industry/compare/learn) show no numeric movement
even though real violations were fixed: Lighthouse's `color-contrast` audit
is pass/fail per page (not per violating element), so a page that still has
*any* contrast violation left — after this workstream removed most of
them — still shows the audit as failing and the score doesn't move. The
underlying violation count dropped sharply on every page; see per-page
detail below.

## Top findings per page (before fixing)

Every page in scope had at most two failing audits under
`seo,accessibility,best-practices` (SEO was already clean everywhere, so
there is nothing to report there). Listed in the order they mattered:

1. **`/` (home)** — `button-name` (an icon-only Send button inside the Brief
   product-mockup scored 0 for having no accessible name); `color-contrast`
   (nav CTA, hero CTA, `--fn-muted` labels, `--fn-faint` labels, and one
   hard-coded mockup gray, `#8A8E86`, all under 4.5:1).
2. **`/pricing`** — `color-contrast` only (`--fn-muted` text at 9–20px on
   both `--fn-bg` and `--fn-surface`; nav + hero CTA orange).
3. **`/operations-audit`** — `color-contrast` only (`--fn-muted` labels on
   `--fn-surface`; nav CTA orange).
4. **`/industries/food-suppliers`** — `color-contrast` only (`--fn-muted`
   and `--fn-faint` labels on `--fn-bg`; nav + hero CTA orange).
5. **`/compare/finch-vs-hiring-a-coo`** — `color-contrast` only (`--fn-muted`
   text; three CTA buttons at three different sizes, all the same orange).
6. **`/learn`** — `color-contrast` only (`--fn-muted` labels on `--fn-bg`;
   `--fn-faint` labels on `--fn-surface`; nav + hero CTA orange).
7. **`/faq`** — `color-contrast` only (`--fn-muted` text on `--fn-bg`; nav
   CTA orange). Fully resolved — this page has neither `--fn-faint` nor the
   mockup-gray usage that the others do.

`best-practices` failed one audit on every page both before and after:
`valid-source-maps` ("Missing source maps for large first-party JavaScript")
— a dev-server artifact, not caused by anything in this workstream's file
scope (see "Not fixed").

## What was fixed

1. **`--fn-muted` token** (`app/globals.css`) — `#8A8474` → `#756F59`.
   `#8A8474` on `--fn-bg` (`#FAF9F6`) measured **3.54:1**, failing WCAG AA
   (4.5:1) at every size it's used in (9–20px, always normal weight — never
   large text, so the 3:1 large-text exception never applies). `#756F59` is
   the same hue, darkened, and measures 4.78:1 on `--fn-bg` / 5.03:1 on
   `--fn-surface`.
2. **`--fn-orange-cta` / `--fn-orange-deep` tokens** (`app/globals.css`) —
   `#E05A12` → `#BD4A0E`, `#C94F0E` → `#A8410C`. The CTA button text
   (`#FFF7F0`, used on every "Book your audit" button site-wide) on the old
   `--fn-orange-cta` measured **3.51:1**. This one couldn't be fixed by
   lightening the text — the old background's luminance was high enough
   that no legible foreground colour, including pure white, reaches 4.5:1
   against it (white only gets to 3.72:1). The background had to move.
   Both tokens were darkened by the same factor so the hover state
   (`-deep`) stays visibly darker than the (now darker) resting state
   instead of collapsing into it. New ratios: 4.78:1 / 5.06:1 (cta) and
   5.78:1 / 6.13:1 (deep), against `#FFF7F0` / white text respectively.
3. **Icon-only "Send" button accessible name** — `components/finch/showcase/
   BriefHome.tsx`, `BriefMobile.tsx`, `FindingDetail.tsx`. Each file defines
   its own `InertButton` (the file's own comment: "A control that is part
   of the picture, not part of the page" — these are non-interactive nodes
   inside a screenshot mockup of the product, already `aria-disabled` +
   `tabIndex={-1}`). One of them wraps only an `aria-hidden` SVG icon with no
   text, so it had no accessible name and axe/Lighthouse correctly flagged
   it as a button with no name. Added `aria-hidden` to `InertButton` itself
   in all three files — consistent with the component's own stated intent
   (decorative, not a real control) and removes it from the accessibility
   tree entirely rather than inventing a label for a button that doesn't do
   anything.
4. **Skip link** — new `components/finch/SkipLink.tsx` (a visually-hidden-
   until-focused `<a href="#main">Skip to content</a>`, styled with the
   existing `--fn-*` tokens, no client JS), mounted as the first child of
   `<body>` in `app/layout.tsx`. Added `id="main"` to the `<main>` element on
   the seven audited pages (`app/page.tsx`, `app/pricing/page.tsx`,
   `app/operations-audit/page.tsx`, `app/industries/[slug]/page.tsx` — which
   covers every industry slug, not just food-suppliers —,
   `app/compare/finch-vs-hiring-a-coo/page.tsx`, `app/learn/page.tsx`,
   `app/faq/page.tsx`) so the link has a real target on every page this
   workstream verifies. Lighthouse's own "bypass" audit (WCAG 2.4.1) reports
   `notApplicable` in this run configuration on every page, so this wasn't
   needed to hit the score gate — it was requested directly and is a real
   usability fix for keyboard and screen-reader users regardless.
5. **`<html lang="en-ZA">`** — already present in `app/layout.tsx`; no
   change needed.
6. Heading order, link names, and tap targets — checked; no audit failures
   for any of them on any of the seven pages, before or after. No change
   needed.

## Not fixed (deliberately) — and why

- **`--fn-faint` token** (`#B9B3A3`) still fails AA (currently 3.49:1 on
  `--fn-bg`, seen on `/`, `/industries/food-suppliers`,
  `/compare/finch-vs-hiring-a-coo`; 3.77:1 on `--fn-surface`, seen on
  `/learn`). The problem: at the sizes it's actually used (9–11.5px mono
  labels, normal weight), the *only* value that clears 4.5:1 on `--fn-bg`
  is `#767368` — which is functionally the same colour as the new
  `--fn-muted` (`#756F59`). Fixing `--fn-faint` in isolation, the way
  `--fn-muted` was fixed, would collapse the site's two-tier muted/faint
  grey hierarchy into one tier — a real design-system change, not a token
  tweak, and outside what "fix the audit failure" calls for on its own.
  Flagging for the architect: either the faint tier needs a size increase
  (14px+ regular clears 4.5:1 well before 9–11px does) or the two tiers
  need to be redesigned together with a colour that isn't warm-grey neutral
  (a muted blue or amber at the same lightness reads as more distinct from
  `--fn-muted` than a darker warm grey does).
- **`#8A8E86` on white** (`components/finch/showcase/BriefHome.tsx`,
  `BriefMobile.tsx`, `FindingDetail.tsx`) — 2.57:1, well under AA. This is
  not a `--fn-*` token; it's a hard-coded colour from a *different* palette
  those three files use on purpose. Their own header comment: "Everything
  here is the design file's own platform palette and type scale
  ... rather than the marketing `--fn-*` ramp — inside the frame we are
  looking at the app, not at the page." It's a faithful reproduction of the
  actual product's (The Brief / OrderFlow) own UI colours, not a marketing
  design choice this workstream owns. Only `/` is affected by it in the
  seven audited pages, and `/` already clears the ≥ 95 bar without touching
  it. Flagging for whoever owns the real product's colour tokens — if
  `#8A8E86` genuinely fails contrast in the live product too, that's a
  product a11y bug, not a marketing-site one.
- **`valid-source-maps`** (best-practices, all seven pages, before and
  after) — "Missing source maps for large first-party JavaScript." This is
  a dev-server build-tooling artifact, not caused by any file in this
  workstream's scope (`app/layout.tsx`, `app/globals.css`,
  `components/finch/**`), and `best-practices` is already 100 on every page
  regardless (Lighthouse doesn't count this specific audit against the
  category score in this run). Not investigated further — likely resolves
  itself under a production build, which is a separate, already-tracked
  blocker.
- **Hover-state contrast** (e.g. `AuditBand.tsx`'s
  `hover:bg-fn-orange hover:text-white`, which goes from the fixed CTA
  orange to the brighter, unfixed `--fn-orange` on hover) — Lighthouse only
  audits the rendered rest state, so this was never flagged, and changing
  a hover-only colour is a design decision the audit doesn't require.
  Left untouched; noting it here since the same button now has a `4.78:1`
  resting state but an unverified hover state.
- **`id="main"` on the remaining ~20 marketing pages** (everything outside
  the seven this workstream audits) — the skip link's `<a href="#main">` is
  mounted site-wide in `app/layout.tsx`, but only the seven audited pages'
  `<main>` got the matching `id="main"` in this pass, since editing every
  other `app/**/page.tsx` file is outside this workstream's file scope.
  Each remaining page needs the same one-line `<main id="main">` change.

## Verification

- `npx tsc --noEmit` → only the three known, pre-existing
  `lib/platform/whatsapp-ingest.ts` errors (unrelated to this workstream).
- `npx eslint` on every touched file (`app/layout.tsx`, `app/page.tsx`,
  `app/pricing/page.tsx`, `app/operations-audit/page.tsx`,
  `app/industries/[slug]/page.tsx`,
  `app/compare/finch-vs-hiring-a-coo/page.tsx`, `app/learn/page.tsx`,
  `app/faq/page.tsx`, `components/finch/SkipLink.tsx`,
  `components/finch/showcase/BriefHome.tsx`,
  `components/finch/showcase/BriefMobile.tsx`,
  `components/finch/showcase/FindingDetail.tsx`) → clean.
- All seven pages still return `200` from the dev server after every edit.
- Re-ran Lighthouse on all seven pages after the fixes: SEO 100 and
  accessibility ≥ 96 on all seven (target was SEO 100 / a11y ≥ 95 — met on
  every page). See the score table above.
