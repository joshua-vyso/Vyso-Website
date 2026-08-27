import type { Metadata } from "next";

import { Shell } from "@/components/vyso/Shell";
import { AuditClose } from "@/components/vyso/audit/AuditClose";
import { AuditHero } from "@/components/vyso/audit/AuditHero";
import { AuditHonesty } from "@/components/vyso/audit/AuditHonesty";
import { AuditOutcomes } from "@/components/vyso/audit/AuditOutcomes";
import { AuditSteps } from "@/components/vyso/audit/AuditSteps";
import { AuditTools } from "@/components/vyso/audit/AuditTools";
import { AUDIT_CANONICAL_URL } from "@/components/vyso/audit/audit-content";
import { buildAuditSchema } from "@/components/vyso/audit/audit-jsonld";
import { SITE } from "@/lib/marketing/site";

/* ── /operations-audit ───────────────────────────────────────────────────────
   Rewritten on the `--vy-*` system (plan §7.3, Phase 2a). What stood here was
   the Finch-era booking page: same offer, same URL, same free hour, in the old
   visual language and the old positioning.

   The URL keeps its equity, so the rewrite keeps everything that made it rank —
   the free audit as the page's subject, the `HowTo` steps, the two tool pages
   under it, the `#book` anchor every CTA on the site points at — and changes
   the copy, the design and the form.

   ── The order ───────────────────────────────────────────────────────────────
     hero       the offer, the direct answer, and the form, in one row
     steps      the brief's five, and the ids the HowTo schema points at
     outcomes   what the report contains, and one example of a finding
     honesty    diagnosis first, and the better-spreadsheet line
     tools      the self-assessment and the calculator, both still live
     close      the one dark band, back up to the form

   ── The three unenforced rules, and where they are spent ────────────────────
   1. ONE `h1`: `AuditHero`. The form's own "Book your audit" is an `h2`, which
      is what makes it a peer of the sections below rather than a heading
      floating outside the outline.
   2. ONE dark section: `AuditClose`.
   3. The shadow: nowhere. This page has no window chrome and no hero demo, so
      the system's one ambient shadow goes unspent. The form is a flat `Card`.

   Accent budget: the single `FindingCard` in `AuditOutcomes`, and nothing else.

   ── The old components are left in place ────────────────────────────────────
   `components/finch/audit/**` and `components/marketing/OperationsAudit.tsx`
   are no longer imported by THIS file, but `/operations-audit/score` and
   `/operations-audit/calculator` still render them, and those two routes are
   out of scope this phase. Phase 4 deletes whatever is genuinely orphaned then,
   under the Orbit-grep rule. */

const TITLE = "Free operations audit";

/* 149 characters. The offer, the cost (an hour, nothing else), and the output,
   in the new positioning: the old description sold "a roadmap of what to
   automate first", this one leads with what the audit finds. */
const DESCRIPTION =
  "A free operations audit for South African businesses. About an hour, then a written report of where time and money leak and what to automate first.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: AUDIT_CANONICAL_URL },
  robots: { index: true, follow: true },
  /* Restated in full: Next replaces the layout's `openGraph` rather than
     merging into it. No `images` key — `opengraph-image.tsx` in this segment
     emits both `og:image` and `twitter:image` through the file convention. */
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: AUDIT_CANONICAL_URL,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function OperationsAuditPage() {
  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildAuditSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <AuditHero />
      <AuditSteps />
      <AuditOutcomes />
      <AuditHonesty />
      <AuditTools />
      <AuditClose />
    </Shell>
  );
}
