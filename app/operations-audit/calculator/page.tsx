import type { Metadata } from "next";

import { AuditToolPage } from "@/components/finch/audit/AuditToolPage";
import { CALCULATOR_CANONICAL_URL } from "@/components/finch/audit/audit-content";
import { buildAuditToolSchema } from "@/components/finch/audit/audit-jsonld";
import RoiCalculator from "@/components/marketing/RoiCalculator";

const NAME = "Manual work calculator";
const title = "What is manual work costing you? Calculator";
/* 151 chars. The query is the title; this says what you put in, what comes out
   and — the honesty rule the card itself carries — that it is an estimate. */
const description =
  "Put your own hours, wastage and headcount in and see what manual reporting and procurement cost you a month. An estimate from your numbers, not a quote.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: CALCULATOR_CANONICAL_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: CALCULATOR_CANONICAL_URL,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

/* `/operations-audit/calculator` — the margin/time calculator. It was a page
   once (`/roi-calculator`), became a widget on `/operations-audit` in 6b, and
   is a page again: it asks for eight numbers, which is a task, and a task
   embedded under somebody else's booking form is a task nobody finishes. The
   old `/roi-calculator` URL now 308s here rather than to an anchor
   (`next.config.ts`).

   Everything structural lives in `AuditToolPage`. `RoiCalculator` is a client
   component and brings its own white cards.                                   */
export default function OperationsAuditCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildAuditToolSchema({ url: CALCULATOR_CANONICAL_URL, name: NAME }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <AuditToolPage
        eyebrow="BEFORE YOU BOOK · CALCULATOR"
        title="What is manual work costing you?"
        sub="Rough numbers are fine — every figure below can be adjusted, and the estimate updates as you type."
      >
        <RoiCalculator />
      </AuditToolPage>
    </>
  );
}
