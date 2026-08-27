/* One OG image per glossary term, on the `--vy-*` template (`lib/og/vyso.tsx`,
   Phase 1) — import only, per `.ai/plan_vyso_redesign_2026.md` §7.6. The
   headword is the title and the first sentence of the definition is the
   lead, which is the whole job of a definitional page: an engine or a person
   should be able to stop reading at the preview. `firstSentence` is the
   glossary's own helper, so the sentence here is the sentence the hub shows.
   The card is the term's `example`, shown as a two-row feed. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";
import { firstSentence, getGlossaryTerm, GLOSSARY_TERMS } from "@/lib/marketing/glossary";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Vyso glossary: operations terms, defined";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ term: string }> }) {
  const { term: slug } = await params;
  const term = getGlossaryTerm(slug);

  if (!term) {
    return renderVysoOgImage({
      eyebrow: "GLOSSARY",
      title: "Operations terms,",
      continuation: "defined.",
      lead: "Short definitions that would be correct on any site, with a worked example each.",
      frameTitle: "Glossary",
      feed: [{ time: `${GLOSSARY_TERMS.length}`, text: "Terms, one sentence each." }],
    });
  }

  const example = term.example;
  return renderVysoOgImage({
    eyebrow: "GLOSSARY",
    title: term.term,
    lead: firstSentence(term.definition[0]),
    frameTitle: "As a finding",
    feed: [
      { time: example.meta ?? example.evidence ?? "OBSERVED", text: example.observation },
      {
        time: "IMPACT",
        text: `${example.impact}, illustrative example`,
        accent: true,
        label: "VYSO NOTICED",
      },
    ],
  });
}
