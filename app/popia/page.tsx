import type { Metadata } from "next";

import { buildLegalSchema } from "@/components/finch/legal/legal-jsonld";
import { DraftChip, LegalCrossLinks, LegalHeader, LegalSection, LegalShell } from "@/components/finch/legal/LegalReading";

/* TODO(user): first draft, built only from facts already on `/privacy` (the
   POPIA compliance statement, the Information Regulator reference, the
   request/complaint process) plus the two facts this page adds: who the
   Information Officer is and that a PAIA manual is available on request —
   per `.ai/vyso_v2.md` §2.3 ("a short POPIA/PAIA information page"). Review
   before removing the `DRAFT · UNDER LEGAL REVIEW` chip or the noindex. */

const TITLE = "POPIA & PAIA | Vyso";
const DESCRIPTION =
  "Vyso's Information Officer, how POPIA requests are handled, and how to request the PAIA manual. Under legal review.";

export const metadata: Metadata = {
  // `absolute`: TITLE already ends in "| Vyso" — see `/privacy`'s comment.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/popia" },
  robots: { index: false, follow: true },
};

const CONTACT_EMAIL = "joshua@vyso.co.za";
const INFORMATION_OFFICER = "Josh Moreira";

export default function PopiaPage() {
  return (
    <LegalShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildLegalSchema({ path: "/popia", name: "POPIA & PAIA", description: DESCRIPTION }),
          ).replace(/</g, "\\u003c"),
        }}
      />

      <LegalHeader
        eyebrow="Legal"
        title="POPIA & PAIA"
        meta="Draft — not yet in force. See the notice below."
        chip={<DraftChip />}
      />

      <p className="m-0 mb-[8px] max-w-[560px] text-[14.5px] leading-[1.65] text-fn-ink-3">
        This page is a working draft. It is under legal review — treat it as an early statement of
        intent, not a finished compliance document.
      </p>

      <LegalSection title="1. Information Officer">
        <p>
          Vyso&rsquo;s Information Officer is {INFORMATION_OFFICER}, reachable at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for any question, request or
          complaint about how Vyso processes personal information.
        </p>
      </LegalSection>

      <LegalSection title="2. Our commitment to POPIA">
        <p>
          Vyso processes personal information lawfully and in accordance with the Protection of
          Personal Information Act 4 of 2013 (&ldquo;POPIA&rdquo;). The full detail of what we
          process, why, who we share it with, and what rights you have is set out on the{" "}
          <a href="/privacy">Privacy Policy</a> — this page sits alongside it rather than repeating
          it.
        </p>
      </LegalSection>

      <LegalSection title="3. Exercising your rights">
        <p>
          To confirm what personal information Vyso holds about you, request access, correction or
          deletion, object to processing, or withdraw consent, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If your information sits inside a
          Vyso customer&rsquo;s workspace rather than with Vyso directly, contact that customer first
          — see <a href="/privacy#10-your-rights-and-choices">Privacy Policy §10</a> for how that
          works.
        </p>
      </LegalSection>

      <LegalSection title="4. PAIA manual">
        <p>
          A Promotion of Access to Information Act (PAIA) manual is available on request. Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to ask for a copy.
        </p>
      </LegalSection>

      <LegalSection title="5. Complaints">
        <p>
          If you are not satisfied with how a request was handled, you may lodge a complaint with the
          South African Information Regulator.
        </p>
      </LegalSection>

      <LegalCrossLinks current="popia" />
    </LegalShell>
  );
}
