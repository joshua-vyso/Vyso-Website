/* One OG image per module. A module has no example finding — it is a surface,
   not an observation — so the card holds what the module page's header holds:
   its tagline, the agents that genuinely read or write its data (the "used by"
   chips, from the module's own `agents` field), and its availability chip. No
   state chip and no ILLUSTRATIVE caption: none of this is a worked example. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { MARKETING_MODULE_BY_SLUG, MARKETING_MODULES } from "@/lib/marketing/modules";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Finch by Vyso — inside the module";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const module_ = MARKETING_MODULE_BY_SLUG[slug];

  if (!module_) {
    return renderOgImage({
      eyebrow: "PLATFORM · MODULES",
      title: "The surfaces Finch’s agents work on.",
      finding: {
        agent: "MODULES",
        observation: "Documents, orders and money, suppliers and stock, people, insight.",
        impact: `${MARKETING_MODULES.length} modules`,
        evidence: "vyso.co.za/platform/modules",
      },
      state: null,
    });
  }

  return renderOgImage({
    eyebrow: "PLATFORM · MODULES",
    title: `${module_.name} — ${module_.role}`,
    finding: {
      /* "MODULE", not the module's name: the name is already the title, and the
         "used by" line below carries agent names — one of which (DOC-U) is
         spelled like a module and is not one. */
      agent: "MODULE",
      observation: module_.tagline,
      /* The "used by" line. Every module has at least one agent; the fallback
         is there so a future module without one still renders a true line. */
      impact:
        module_.agents.length > 0
          ? `Used by ${module_.agents.join(" · ")}`
          : "Part of what the audit roadmap switches on",
      evidence: module_.appUrlLabel,
      meta: module_.status,
    },
    state: null,
  });
}
