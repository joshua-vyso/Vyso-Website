import type { Metadata } from "next";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { AcademyCard } from "@/components/finch/pricing/AcademyCard";
import { AuditCta } from "@/components/finch/pricing/AuditCta";
import { PricingHero } from "@/components/finch/pricing/PricingHero";
import { buildPricingSchema } from "@/components/finch/pricing/pricing-jsonld";
import { StraightAnswers } from "@/components/finch/pricing/StraightAnswers";
import { WhatsIncluded } from "@/components/finch/pricing/WhatsIncluded";

/* Root layout now sets `title.template: "%s | Vyso"` (Workstream D, phase 1)
   — this plain string gets " | Vyso" appended automatically, so it no longer
   carries the suffix itself (previously "…| Vyso", which the template would
   have doubled to "…| Vyso | Vyso"). */
const title = "Finch pricing — R6,000 per location per month, everything included";
/* Trimmed from the plan's draft (173 chars) to fit the ≤155 budget the same
   plan sets; the dropped words ("by Vyso", "operations") are both carried by
   the title and the first line of the page. */
const description =
  "Finch costs R6,000 per location per month, everything included. Founding clients: setup waived, first month free, rate locked. Starts with a R2,000 audit.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://vyso.co.za/pricing" },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: "https://vyso.co.za/pricing",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

/* `/pricing` in the Finch design language — one offer, no tiers, no matrix.
   Still a server component: the accordion is native `<details>`, and 6b's only
   client leaf on the page is the hero (it needs a ref to hand the grid its text
   mask) plus the three devices, which mount themselves after the band is within
   a viewport. `.finch-site` scopes the `--fn-*` tokens and opts this route out
   of the site-wide blend surface, exactly as `/` does.

   Ground sequence (§7): **ink** hero → paper (founding terms straddling the
   seam, then what's included) → **blue** straight answers → paper Academy →
   **ink** CTA. Both dark bands carry an `OscillatingGrid`; the blue one carries
   the page's only `FacetPlane`. The JSON-LD and the metadata are untouched —
   every number in both still comes from `pricing-data.ts`.                     */
export default function PricingPage() {
  return (
    <div
      /* §8's inversion, at first paint. `PricingHero` is an `underNav` ink
         band, so the nav sits on ink from pixel one — but `NavGround` can only
         say so after hydration. This is the server's answer, and `globals.css`
         uses it only while `<html>` has no measured `data-nav-ground` yet. */
      data-nav-hero="ink"
      className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildPricingSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="pricing" />
      <main id="main">
        <PricingHero />
        <WhatsIncluded />
        <StraightAnswers />
        {/* The receiving band reserves the straddle. `StraightAnswers` ends
            with a `wide` finding card hanging `STRAIGHT_ANSWERS_OVERHANG` (72px)
            past the band's bottom edge at `lg`; this is that overhang plus the
            56px of clearance the two boxes need, so the card lands on empty
            paper instead of 14px inside the Academy card's own section. */}
        <div className="lg:pt-[128px]">
          <AcademyCard />
        </div>
        <AuditCta />
      </main>
      {/* The design gives this page a deeper footer gap than the homepage. */}
      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
