# Plan — 6b fixes (round 3): gradient CTA tiles sitewide + "custom" bullets on pricing

Josh (2026-08-17): "I love the orange and blue gradient. Replace the black
background on the Book-your-audit tiles across the site with that gradient as
the background." + "On the pricing page, in each section, have a custom bullet
point — custom modules, custom agents, custom integrations."

## 1. Gradient CTA tiles (overrides the "one ribbon sitewide" rule — Josh's call)
- `components/finch/AuditBand.tsx`: BOTH variants render the `GradientRibbon`
  canvas as the tile's full background (the plate for `default`; the full-bleed
  band for `home` — the separate 240px strip under the copy goes away; the copy
  sits ON the gradient). Add a `dim` prop to `GradientRibbon` (default 0 for the
  homepage strip today; the tiles use ≈ 0.28) that multiplies the palette
  toward `--fn-ink` so white copy passes AA everywhere on the tile — sample the
  darkest and brightest regions under the H2/paragraph and report the contrast
  (target ≥ 4.5 for body, ≥ 3 for the 36px H2). Keep the same palette family
  Josh liked (burnt orange left → deep blue right).
- Button on the gradient: an **ink** magnetic button (`--fn-ink` fill, `--fn-ink-text`
  text, hover `#1B1915`) — orange-on-orange would vanish; keep orange buttons
  everywhere else. Text `--fn-ink-text` / `--fn-ink-text-2`; the mono line
  (`EXPANDED MANDATES PRICED ON SCOPE` etc.) `--fn-ink-text-2`.
- Also convert the two page-specific closing tiles: `components/finch/pricing/AuditCta.tsx`
  (drop the squares-mode grid; gradient background) and
  `components/finch/compare/CooCta.tsx` (drop the dot grid; gradient) — same
  layout as today, just the ground. Not the audit page's "R2,000. Credited."
  statement band (that's not a book-audit tile).
- Reduced motion → a static CSS gradient with the same stops (no canvas). One
  device per band still holds (the ribbon is the tile's device). Motion budget:
  the tile is IO-gated; ensure ≤ 2 moving in any viewport where a tile is
  visible together with another device (e.g. `/` under-the-hood → CTA; COO
  table → CTA). Report the max.
- Radius: the plate keeps 16px; the homepage full-bleed band keeps its 24px
  top radius seam. Padding content-driven as fixed in round 1.

## 2. Pricing "custom" bullets
In `components/finch/pricing/pricing-data.ts` (+ `WhatsIncluded.tsx` render):
each accordion group gets one final, visually distinct **CUSTOM** row — an
orange 6px dot (agent-activity colour), a mono `CUSTOM` chip, then the text:
- The platform: "Custom modules — built to your workflow when nothing on the
  list fits. Priced on scope."
- The agents: "Custom agents — built around your business in the audit; your
  roster is set from the roadmap, not a catalogue."
- Integrations: "Custom integrations — anything with an API or an export.
  Priced on scope."
- Onboarding: "Custom rollout order — agents and modules activated in the
  priority your audit roadmap sets."
- Support: no custom row (nothing grounded to promise). If Josh wants one,
  he'll say.
Copy must stay honest ("priced on scope" = the expanded-mandates line). Update
the JSON-LD/`llms` only if they enumerate list items (check
`pricing-jsonld.ts` and `lib/marketing/llms.ts`).

## Verify
tsc (3 known), eslint on touched paths; every AuditBand consumer route still
200 (spot 6 + the four money pages); contrast numbers on the tiles; reduced-
motion static gradient; motion budget max ≤ 2 near tiles; `/pricing` accordion
shows the four CUSTOM rows; console clean. Append "## 6b fixes — round 3" to
`.ai/implementation_phase6.md`. No long sampling loops.
