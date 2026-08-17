import type { Metadata } from "next";

import { PortedComparisonPage } from "@/components/finch/compare/PortedComparison";
import { ERP } from "@/lib/marketing/compare";

/* 47 chars before the sitewide "| Vyso" template. */
const title = "Finch vs an ERP for South African SMEs";
/* 153 chars. */
const description =
  "An ERP records what your business did. Finch reads it and flags what changed, for R6,000 per location per month. An honest comparison for South African SMEs.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ERP.canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: ERP.canonical,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

/* Ported from `/compare/vyso-vs-erp-systems`, which now 301s here. The grounded
   content — the strengths, the four breakdowns, the table, the four steps and
   the FAQs — survives; what changed is the language (Vyso the company, Finch
   the product) and the pricing rows, which used to describe a per-workflow
   scope that predates the single R6,000 offer. */
export default function FinchVsErpPage() {
  return (
    <PortedComparisonPage
      spec={ERP}
      trail={[
        { label: "Home", href: "/" },
        { label: "Compare", href: "/compare" },
        { label: "Finch vs an ERP", href: `/compare/${ERP.slug}` },
      ]}
      tableLabel="A traditional ERP compared with Finch"
      faqTitle="Before you buy the programme."
      secondary={{ label: "See the pricing", href: "/pricing" }}
      sideLinks={[
        { label: "Finch vs hiring a COO", href: "/compare/finch-vs-hiring-a-coo" },
        { label: "Finch vs spreadsheets", href: "/compare/finch-vs-spreadsheets" },
        { label: "All three comparisons", href: "/compare" },
        { label: "What Finch connects to", href: "/integrations" },
        { label: "Fit & alternatives FAQ", href: "/faq#fit" },
      ]}
    />
  );
}
