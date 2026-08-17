/* ── OG images for the comparison cluster ────────────────────────────────────
   `/compare/finch-vs-hiring-a-coo`, `/compare/finch-vs-erp` and
   `/compare/finch-vs-spreadsheets` are three route segments with one shape, so
   they share this helper rather than three near-identical files. Each page's
   `opengraph-image.tsx` hands over its own spec from `lib/marketing/compare.ts`
   (`COO`, `ERP`, `SPREADSHEETS`) — the same objects the pages render from.

   The caption is the finding's own `note` field ("ILLUSTRATIVE — EXAMPLE
   FINDING"), not a constant typed here: if a comparison ever carries a finding
   that is not illustrative, its note says so and the image follows. */

import { renderOgImage } from "./render";

/** The three fields a comparison spec has to expose. `COO` is not a
    `PortedComparison`, but it carries all three, so this is structural. */
type ComparisonOgSource = {
  eyebrow: string;
  h1: string;
  finding: {
    agent: string;
    observation: string;
    impact: string;
    evidence: string;
    meta: string;
    note: string;
  };
};

export function renderComparisonOgImage(source: ComparisonOgSource) {
  return renderOgImage({
    eyebrow: source.eyebrow,
    title: source.h1,
    finding: {
      agent: source.finding.agent,
      observation: source.finding.observation,
      impact: source.finding.impact,
      evidence: source.finding.evidence,
      meta: source.finding.meta,
    },
    caption: source.finding.note,
  });
}
