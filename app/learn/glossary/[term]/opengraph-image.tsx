/* One OG image per glossary term. The headword is the title and the first
   sentence of the definition is the lead, which is the whole job of a
   definitional page — an engine or a person should be able to stop reading at
   the preview. `firstSentence` is the glossary's own helper, so the sentence
   here is the sentence the hub shows. The card is the term's `example`. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { firstSentence, getGlossaryTerm, GLOSSARY_TERMS } from "@/lib/marketing/glossary";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Vyso glossary — operations terms, defined";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ term: string }> }) {
  const { term: slug } = await params;
  const term = getGlossaryTerm(slug);

  if (!term) {
    return renderOgImage({
      eyebrow: "GLOSSARY",
      title: "Operations terms, defined.",
      finding: {
        agent: "VYSO GLOSSARY",
        observation: "Short definitions that would be correct on any site, with a worked example each.",
        impact: `${GLOSSARY_TERMS.length} terms`,
        evidence: "vyso.co.za/learn/glossary",
      },
      state: null,
    });
  }

  return renderOgImage({
    eyebrow: "GLOSSARY",
    title: term.term,
    lead: firstSentence(term.definition[0]),
    finding: {
      agent: term.example.agent,
      observation: term.example.observation,
      impact: term.example.impact,
      evidence: term.example.evidence,
      meta: term.example.meta,
    },
    caption: "ILLUSTRATIVE EXAMPLE",
  });
}
