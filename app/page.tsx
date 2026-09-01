import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/site/SiteChrome";
import { Hero } from "@/components/site/home/Hero";
import { BriefDemo } from "@/components/site/home/BriefDemo";
import {
  CapabilitiesSection,
  FaqSection,
  FinalCtaSection,
  IndustriesSection,
  IntegrationsSection,
  ProblemSection,
  ProcessSection,
  SectionHead,
  TestimonialsSection,
} from "@/components/site/home/Sections";
import { HOME_FAQ } from "@/components/site/content";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: { absolute: "Vyso — AI automation for the work that slows your business down" },
  description:
    "Vyso is a Johannesburg AI automation agency. We design, build and run custom AI workflows around the tools you already use — documents read, numbers checked, follow-ups chased, and a daily brief your team approves.",
  alternates: { canonical: "/" },
};

/* Visible-FAQ JSON-LD only — the questions rendered by FaqSection. */
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE.url}/#faq`,
  mainEntity: HOME_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Home() {
  return (
    <div className="vy-site">
      <SiteNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
      />
      <main id="main">
        {/* Dark cinematic hero → the paper sheet slides over it (§ transition). */}
        <div className="vy-hero-wrap">
          <Hero />
        </div>
        <div className="vy-sheet vy-sheet-overlap">
          <ProblemSection />
          <CapabilitiesSection />
          <section className="border-t border-line py-24 md:py-32" aria-labelledby="brief-heading">
            <div className="mx-auto max-w-[1200px] px-6">
              <SectionHead
                eyebrow="Proof, not promises"
                title={
                  <span id="brief-heading">
                    What a Vyso automation looks like{" "}
                    <em className="vy-serif font-normal italic">inside your business.</em>
                  </span>
                }
                lead="One document's journey through a build we run in production today — from a PDF in an inbox to an approved action in the morning brief."
              />
              <div className="mt-14">
                <BriefDemo />
              </div>
            </div>
          </section>
          <ProcessSection />
          <IntegrationsSection />
          <IndustriesSection />
          <TestimonialsSection />
          <FaqSection />
          <FinalCtaSection />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
