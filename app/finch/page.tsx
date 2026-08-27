import type { Metadata } from "next";
import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { FoundingQuote } from "@/components/finch/FoundingQuote";
import { HomeHero } from "@/components/finch/HomeHero";
import { PlatformShowcase } from "@/components/finch/PlatformShowcase";
import { ScrollSequence } from "@/components/finch/ScrollSequence";
import { Senses } from "@/components/finch/Senses";
import { SequenceIntro } from "@/components/finch/SequenceIntro";
import { UnderTheHood } from "@/components/finch/UnderTheHood";
import { WhatFinchWatches } from "@/components/finch/WhatFinchWatches";
import { SITE } from "@/lib/marketing/site";

/* ── /finch ──────────────────────────────────────────────────────────────────
   The page that used to be `/`. `/` is the agency now (`.ai/plan_home_only.md`,
   change 2), and this is the product it is best known for, moved here with its
   composition intact: the same twelve sections in the same order, the same
   components, the bird included.

   Two things were edited on the way across, both because they contradict what
   the rest of the site now says rather than for taste:

   - links to `/pricing` (the page is deleted, change 3) point at
     `/operations-audit`, and
   - the explicit price claims in `HomeHero` and `AuditBand` are rewritten to
     per-scope framing, because pricing is quoted after a free audit now and
     nothing on the site publishes an amount.

   Nothing else on the page moved. The `/finch -> /` redirect that existed for
   the year this page lived at the root is removed from `next.config.ts`.      */

const TITLE = "Finch by Vyso. Operations intelligence for catering and wholesale.";
const DESCRIPTION =
  "Finch's AI agents read every supplier invoice overnight, watch prices line by line and send one morning brief on WhatsApp. Built by Vyso for South African food businesses.";

export const metadata: Metadata = {
  /* `absolute` because the root layout's title template appends " | Vyso" — a
     title that already reads "Finch by Vyso" would ship as "… | Vyso | Vyso". */
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/finch" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/finch`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
    /* No `images`: `app/finch/opengraph-image.tsx` is the nearer generator and
       Next's file convention resolves to it. */
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* Server component, as the home page it was moved from was: only the finding
   card, the scroll sequence and the pieces they own need the client.
   `.finch-site` scopes the Finch tokens and opts the page out of the site-wide
   blend surface. */
export default function FinchPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <FinchNav active="finch" />
      <main id="main">
        <HomeHero />
        <SequenceIntro />
        <ScrollSequence />
        <PlatformShowcase />
        <WhatFinchWatches />
        <Senses />
        <FoundingQuote />
        <UnderTheHood />
        {/* `home` is the only variant that renders the site's one
            `GradientRibbon` (§3). Every other route gets the shared dark plate
            on paper — see `AuditBand.tsx`. */}
        <AuditBand variant="home" />
      </main>
      <FinchFooter />
    </div>
  );
}
