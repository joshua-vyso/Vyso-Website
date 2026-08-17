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

export const metadata: Metadata = {
  title: "Finch by Vyso — your company's own COO, at a tenth of the cost",
  description:
    "Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI agents watch your invoices, stock, suppliers and margins — catch money leaking, and tell you what to do about it. Built by Vyso for South African food businesses.",
};

/* The homepage is a server component: only the finding card, the scroll
   sequence and the pieces they own need the client. `.finch-site` scopes the
   Finch tokens and opts the page out of the site-wide blend surface. */
export default function Home() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <FinchNav />
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
