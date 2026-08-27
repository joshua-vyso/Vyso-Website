import type { Metadata } from "next";

import { AuditToolPage } from "@/components/vyso/audit/AuditToolPage";
import { SCORE_CANONICAL_URL } from "@/components/vyso/audit/audit-content";
import { buildAuditToolSchema } from "@/components/vyso/audit/audit-jsonld";
import OperationsAudit from "@/components/marketing/OperationsAudit";

const NAME = "Operations self-assessment";
const title = "Operations self-assessment: score your business in a minute";
/* 148 chars. Says what it does, what it costs you (a minute, nothing else) and
   what it is not: the honesty rule the tool itself repeats on screen. */
const description =
  "Ten questions about how your operation runs today, scored out of 100 with the one thing worth fixing first. A minute, nothing sent anywhere, not the audit.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: SCORE_CANONICAL_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: SCORE_CANONICAL_URL,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

/* `/operations-audit/score` — the ten-question self-assessment, which used to
   be a widget halfway down `/operations-audit`. It is a page now because it is
   a minute of somebody's attention and a result they might want to send to a
   partner, and neither of those survives being an anchor two thirds of the way
   down a booking page.

   Everything structural lives in `AuditToolPage` (the shell both tool pages
   share); this file is the copy, the metadata and the widget. `OperationsAudit`
   is a client component and brings its own white cards, so there is no wrapper
   card here — see `AuditToolPage`'s header for why.                           */
export default function OperationsAuditScorePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildAuditToolSchema({ url: SCORE_CANONICAL_URL, name: NAME }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <AuditToolPage
        eyebrow="BEFORE YOU BOOK · SELF-ASSESSMENT"
        title="Ten questions. One finding."
        sub="A warm-up, not the audit. Answer ten questions about how the operation runs today and it hands back the one thing worth looking at first."
      >
        <OperationsAudit />
      </AuditToolPage>
    </>
  );
}
