import type { Metadata } from "next";

import { PortedComparisonPage } from "@/components/finch/compare/PortedComparison";
import { SPREADSHEETS } from "@/lib/marketing/compare";

/* 44 chars before the sitewide "| Vyso" template. */
const title = "Finch vs spreadsheets for South African SMEs";
/* 154 chars. */
const description =
  "Where spreadsheets still win, where they quietly break down, and what changes when Finch reads the source documents instead. An honest comparison.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: SPREADSHEETS.canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: SPREADSHEETS.canonical,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

/* Ported from `/compare/vyso-vs-spreadsheets`, which now 301s here. The four
   breakdowns, the table, the four steps and the FAQs are the old page's; the
   framing moved from "one shared operational record" (a system you move into)
   to "Finch reads the source documents" (a reader beside what you already do),
   which is what the product actually is. */
export default function FinchVsSpreadsheetsPage() {
  return (
    <PortedComparisonPage
      spec={SPREADSHEETS}
      trail={[
        { label: "Home", href: "/" },
        { label: "Compare", href: "/compare" },
        { label: "Finch vs spreadsheets", href: `/compare/${SPREADSHEETS.slug}` },
      ]}
      tableLabel="Spreadsheets compared with Finch"
      faqTitle="Before you close the workbook."
      secondary={{ label: "Book your free audit", href: "/operations-audit" }}
      sideLinks={[
        { label: "Finch vs hiring a COO", href: "/compare/finch-vs-hiring-a-coo" },
        { label: "Finch vs an ERP", href: "/compare/finch-vs-erp" },
        { label: "All three comparisons", href: "/compare" },
        { label: "What Finch connects to", href: "/integrations" },
        { label: "Fit & alternatives FAQ", href: "/faq#fit" },
      ]}
    />
  );
}
