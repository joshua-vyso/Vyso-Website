import type { Metadata } from "next";

import { Shell } from "@/components/vyso/Shell";
import { HowAutomation } from "@/components/vyso/how/HowAutomation";
import { HowClose } from "@/components/vyso/how/HowClose";
import { HowDefinition } from "@/components/vyso/how/HowDefinition";
import { HowDifferences } from "@/components/vyso/how/HowDifferences";
import { HowExisting } from "@/components/vyso/how/HowExisting";
import { HowHero } from "@/components/vyso/how/HowHero";
import { HowLoop } from "@/components/vyso/how/HowLoop";
import { HowPricing } from "@/components/vyso/how/HowPricing";
import { HowProactive } from "@/components/vyso/how/HowProactive";
import {
  HOW_IT_WORKS_CANONICAL_URL,
  buildHowItWorksSchema,
} from "@/components/vyso/how/how-jsonld";
import { SITE } from "@/lib/marketing/site";

/* ── /how-it-works ───────────────────────────────────────────────────────────
   A NEW route (plan §7.2, Phase 2a). It is the destination of the §6 redirect
   map's biggest cluster: `/finch`, `/platform/**`, `/pricing` and every
   `/compare/*` page lands here in Phase 4, so this page has to answer what all
   of them answered — the mechanism, the pricing model, and the three "how are
   you different from X" questions — in one document rather than in nine.

   ── The order, and why ──────────────────────────────────────────────────────
     hero          what we are, in two sentences, before anything else
     definition    what we are, and the three things we are not
     automation    the first half: the work happening by itself
     proactive     the second half: the supplier-invoice morning, on the timeline
     existing      the tools you keep, and which connections are real
     loop          audit, diagnose, build, monitor, and back to diagnose
     pricing       scoped per problem, no figures, never a bare "contact us"
     comparisons   ERP, Zapier or Make, another admin hire (AEO direct answers)
     close         the one dark band, and the audit

   The definition comes before the mechanism on purpose: a reader holding the
   wrong category for us reads the mechanism through it, and then "it connects
   your tools" sounds like a workflow tool no matter how the sentence is
   written.

   ── The three unenforced rules, and where they are spent ────────────────────
   1. ONE `h1`: `HowHero`. Every section below heads at `h2` through `Section`.
   2. ONE dark section: `HowClose`.
   3. The shadow: `ChromeFrame` in `HowProactive`, once. Every `Card` is flat.

   Accent budget: the timeline's two accented rows in `HowProactive`, and
   nothing else on the page is painted. Every server component except the
   timeline and the `Reveal` wrappers, so every sentence, timestamp and rand
   figure is plain HTML in the first response. */

const TITLE = "How Vyso works";

/* 151 characters. Leads with the mechanism (the question the URL asks), then
   the two things this page uniquely carries: the loop and the pricing model. */
const DESCRIPTION =
  "How Vyso automates operational work, then tells you when something needs attention. The audit, the build, the monitoring, and how projects are scoped.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HOW_IT_WORKS_CANONICAL_URL },
  robots: { index: true, follow: true },
  /* Restated in full: Next replaces the layout's `openGraph` rather than
     merging into it. No `images` key — `app/how-it-works/opengraph-image.tsx`
     emits both `og:image` and `twitter:image` through the file convention, and
     a hard-coded array here would override it. */
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: HOW_IT_WORKS_CANONICAL_URL,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function HowItWorksPage() {
  return (
    <Shell active="how-it-works">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildHowItWorksSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <HowHero />
      <HowDefinition />
      <HowAutomation />
      <HowProactive />
      <HowExisting />
      <HowLoop />
      <HowPricing />
      <HowDifferences />
      <HowClose />
    </Shell>
  );
}
