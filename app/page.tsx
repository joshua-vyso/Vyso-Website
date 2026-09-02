import type { Metadata } from "next";
import { JsonLd, VxShell, webPage } from "@/components/vx/VxShell";
import { BRAND, FAQ } from "@/components/vx/content";
import { Hero } from "@/components/vx/home/Hero";
import { Ticker } from "@/components/vx/home/Ticker";
import { Systems } from "@/components/vx/home/Systems";
import { Process } from "@/components/vx/home/Process";
import { Industries } from "@/components/vx/home/Industries";
import { Integrations } from "@/components/vx/home/Integrations";
import { Principle } from "@/components/vx/home/Principle";
import { ReviewsHome } from "@/components/vx/home/Reviews";
import { Faq } from "@/components/vx/home/Faq";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: { absolute: "Vyso — AI automation agency, Johannesburg. We build the systems that run your business." },
  description: BRAND.answer,
  alternates: { canonical: "/" },
  keywords: [
    "AI automation agency",
    "AI automation agency South Africa",
    "AI automation Johannesburg",
    "bespoke automation systems",
    "business process automation South Africa",
    "invoice automation",
    "AI workflow automation",
  ],
};

/* Homepage — "The Operating Layer" (worktree awwwards-2026):
   hero plate → ticker → five systems → pinned process → industries →
   integration orbit → principle → reviews → FAQ → closing plate. */
export default function Home() {
  return (
    <VxShell preload>
      <JsonLd data={webPage({ path: "/", name: BRAND.tagline, description: BRAND.answer })} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${SITE.url}/#faq`,
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <Hero />
      <p className="vx-wrap vx-answer" style={{ marginTop: 40 }}>
        {BRAND.answer}
      </p>
      <Ticker />
      <Systems />
      <Process />
      <Industries />
      <Integrations />
      <Principle />
      <ReviewsHome />
      <Faq />
    </VxShell>
  );
}
