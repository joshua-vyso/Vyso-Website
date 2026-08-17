# Plan — 6b fixes (round 2): nav on route change, breathing room, audit tools split

Josh's second review (2026-08-17). Standing rules unchanged. Reference:
`.ai/vyso_v3_design.md`, `.ai/implementation_phase6.md` (6b + 6b fixes
sections). Dev server :3000; front the tab; NO long browser sampling loops
(single `getBoundingClientRect`/`getComputedStyle` reads only, hard timeouts).

## 1. Nav inversion doesn't update on route change (pricing → home → pricing)
`components/finch/NavGround.tsx` only re-evaluates on IntersectionObserver
callbacks; on client-side navigation the new page's first band is already in
view and no intersection fires, so `/pricing`'s ink hero renders with dark
nav text on ink (unreadable) until the user scrolls, and `/` keeps inverted
text on paper. Fix: re-run the ground computation on `usePathname()` change
AND after `RouteFade` completes (whichever is later), plus on `resize`; compute
from the band that currently contains the nav's vertical centre (query
`[data-ground]` rects, no observer dependency for the initial value); default
to `paper` when none. Also handle the first paint on a hard load of a page with
an `underNav` dark hero (SSR: set `data-ground` on the hero band's parent so
the nav's initial server-rendered class is already inverted — no flash). Verify
the exact sequence pricing → home → pricing → operations-audit → compare (COO)
→ home with zero scrolling: nav text colour correct on arrival each time; and
a hard reload of `/pricing` and the COO page shows the inverted nav on first
paint.

## 2. Breathing room before dark bands
Rule: when a paper section is followed by a dark band WITHOUT a straddling
element, the paper section keeps its full bottom padding (≥ 96px desktop /
64 mobile) and the dark band starts after it — no overlap eating the space.
Fix the two Josh flagged and audit the rest of the four pages for the same:
- `/`: the orbit/Senses section → Roberto ink band (currently squished).
- `/pricing`: Academy card → CTA ink band.
- Check: `/` under-the-hood → CTA band; `/operations-audit` FAQs/last paper →
  footer; COO table/"person" section → CTA band. Report before/after gaps.
Where a straddle IS intended (pricing terms plate, margin card, audit header,
cost bars) leave the overlap but ensure the receiving band still has ≥ 48px of
clear ground above the straddler's top edge on the dark side.

## 3. Split the audit page's two tools into their own pages
- New routes: `/operations-audit/score` (the 10-question self-assessment,
  `OperationsAudit`) and `/operations-audit/calculator` (`RoiCalculator`).
  Each: `FinchNav` (no active), a compact paper hero (eyebrow `BEFORE YOU BOOK
  · SELF-ASSESSMENT` / `· CALCULATOR`, `<h1>` "Ten questions. One finding." /
  "What is manual work costing you?", the existing one-line sub), the tool in
  its white card at full 1160 width (single column — they no longer share a
  row), a "‹ Back to the audit" link, and the closing `AuditBand` (default
  variant, → `/operations-audit#book`). Metadata: indexable, titles like
  "Operations self-assessment — score your business in a minute | Vyso" and
  "What is manual work costing you? Calculator | Vyso", descriptions ≤ 155,
  canonical, `BreadcrumbList` (Home › Operations Audit › …); the tools' own
  JSON-LD if any moves with them. Add both to the sitemap. Add `NEXT_PUBLIC`-
  free client gating exactly as today (both tools already client components).
- `/operations-audit`: keep the blue "how the week runs" band and its
  straddling white card, but the card's content becomes: eyebrow `BEFORE YOU
  BOOK`, H2 "Two ways to see it before we start.", the sub sentence, then TWO
  buttons side by side (≥ md; stacked mobile): "Score your operation →" (`/operations-audit/score`)
  and "Run the numbers →" (`/operations-audit/calculator`) — secondary style
  (white, hairline border, ink text, magnetic), each with a small mono caption
  under it (`10 QUESTIONS · 1 MINUTE` / `YOUR NUMBERS · AN ESTIMATE`). Remove
  the two embedded widgets from this page (`AuditTools` becomes the button
  card). Then the ink "R2,000. Credited. Whether you sign or not." statement
  band as-is, then FAQs, footer.
- Anchors: `#score` and `#calculator` on `/operations-audit` no longer exist —
  update `next.config.ts` redirects: `/roi-calculator` → `/operations-audit/calculator`;
  add `/operations-audit/score` nothing needed. Grep for `#score`/`#calculator`
  links across `app components lib` and retarget them (FindingCard actions in
  the assessment "Book the audit" → `/operations-audit#book`; any "Start over"
  stays in-page).
- `/llms.txt` + `/llms-full.txt` pick up the two new pages automatically if
  they're built from the sitemap/data — verify; else add them to `lib/marketing/llms.ts`.
- OG images: give both new pages a one-line `opengraph-image.tsx` re-export of
  the audit page's generator (or the root) so they aren't imageless.

## Verification
tsc (3 known), eslint on touched paths, `/operations-audit`, `/operations-audit/score`,
`/operations-audit/calculator`, `/`, `/pricing`, COO 200 with one `<h1>`; the
nav colour sequence test above; the gap measurements before/after; sitemap
includes the two new URLs; `/roi-calculator` 308 → `/operations-audit/calculator`;
`grep -rn "#score\|#calculator" app components lib` → 0 stale; console clean.
Append "## 6b fixes — round 2" to `.ai/implementation_phase6.md`.
