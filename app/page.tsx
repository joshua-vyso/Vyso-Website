import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/site/SiteChrome";
import { Hero } from "@/components/site/home/Hero";
import { ProblemTable } from "@/components/site/home/ProblemTable";
import { OperationsSection } from "@/components/site/home/OperationsSection";
import { AutomationScale } from "@/components/site/home/AutomationScale";
import { IntegrationExperience } from "@/components/site/home/IntegrationExperience";
import { ClosingCta } from "@/components/site/home/ClosingCta";
import { TestimonialsSection } from "@/components/site/home/Sections";

export const metadata: Metadata = {
  title: { absolute: "Vyso — Automate the work that keeps you losing time and money" },
  description:
    "Vyso is a Johannesburg AI automation agency. From an automated inbox to custom systems that run entire operations — built around the tools you already use, with humans approving what matters.",
  alternates: { canonical: "/" },
};

/* Homepage (dark redesign, 2026-09 — `.ai/plan_home_dark_2026.md`):
   hero → problem → capabilities → automation scale → integrations climax →
   reviews → conversion. The hero and reviews sections are locked designs;
   everything between them lives on the near-black sheet that scrolls over the
   hero exactly as before. */
export default function Home() {
  return (
    <div className="vy-site vy-home-dark">
      <SiteNav />
      <main id="main">
        <div className="vy-hero-wrap">
          <Hero />
        </div>
        <div className="vy-sheet vy-sheet-overlap vy-sheet-ink">
          <ProblemTable />
          <OperationsSection />
          <AutomationScale />
          <IntegrationExperience />
          <TestimonialsSection />
          <ClosingCta />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
