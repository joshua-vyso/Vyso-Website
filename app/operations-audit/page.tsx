import type { Metadata } from "next";

import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { AuditFaqs } from "@/components/finch/audit/AuditFaqs";
import { AuditHero } from "@/components/finch/audit/AuditHero";
import { AuditStatement } from "@/components/finch/audit/AuditStatement";
import { AuditTools } from "@/components/finch/audit/AuditTools";
import { AuditWeek } from "@/components/finch/audit/AuditWeek";
import { buildAuditSchema } from "@/components/finch/audit/audit-jsonld";
import { CANONICAL_URL } from "@/components/finch/audit/audit-content";

const title = "Operations Audit — one week, R2,000, credited | Vyso";
/* 154 chars. Leads with the thing being searched for, carries the price and the
   credit, then the two things you can do before you book. Those two are pages
   of their own now (`/score`, `/calculator`), and the sentence reads the same
   either way — it describes what is on offer, not where the widget sits. */
const description =
  "A one-week Operations Audit for South African food businesses. R2,000, credited to your first month. Score yourself or run the numbers, then book the week.";

export const metadata: Metadata = {
  /* `absolute` because the sitewide title template appends "| Vyso" — this
     title already carries it, and "| Vyso | Vyso" is how that gets shipped. */
  title: { absolute: title },
  description,
  alternates: { canonical: CANONICAL_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: CANONICAL_URL,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

/* `/operations-audit` — the front door. Every "Book your audit" on the site
   lands here, so the page puts the decision first: the offer and the form share
   the top row, then the week is explained for anyone who wants it explained,
   then the two ways to look at your own operation before you commit. Server
   component apart from the form; `.finch-site` scopes the `--fn-*` tokens as on
   `/` and `/pricing`.

   ── Ground sequence (`.ai/vyso_v3_design.md` §7) ────────────────────────────
   **paper** (hero + form, one blue glow) → **blue** (how the week runs,
   oscillating dots, the 7-day rail) → **paper** (the two-ways card straddling
   the seam) → **ink** ("R2,000. Credited.", the wave field, type riding it) →
   **paper** (FAQs). Adjacent bands never share a ground and no band carries two
   devices.

   ── 6b fixes r2: the tools left ─────────────────────────────────────────────
   The self-assessment and the calculator used to be embedded in `AuditTools`,
   which made this page 5,700px tall and gave neither tool a URL anybody could
   send. They are `/operations-audit/score` and `/operations-audit/calculator`
   now; `AuditTools` keeps the straddling card and becomes the doorway. The
   `#score` and `#calculator` anchors are gone with them — nothing on the site
   links to them any more, and `/roi-calculator` 308s to the calculator's page
   rather than to a fragment on this one.

   The anchors that remain: `#book` (the hero form — every "Book your audit" on
   the site is one of these, including the two inside the tools), `#assess`, and
   the `#step-01…04` targets the HowTo schema points at, which live in
   `WeekRail`'s list, once each.                                               */
export default function OperationsAuditPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildAuditSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />
      <main id="main">
        <AuditHero />
        <AuditWeek />
        <AuditTools />
        <AuditStatement />
        <AuditFaqs />
      </main>
      <div className="pt-[56px] lg:pt-[88px]">
        <FinchFooter />
      </div>
    </div>
  );
}
