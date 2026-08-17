import type { Metadata } from "next";

import { buildLegalSchema } from "@/components/finch/legal/legal-jsonld";
import { DraftChip, LegalCrossLinks, LegalHeader, LegalSection, LegalShell } from "@/components/finch/legal/LegalReading";
import { FOUNDING_TERMS, PRICE } from "@/components/finch/pricing/pricing-data";

/* TODO(user): this page is a first draft, assembled only from facts already
   published elsewhere on the site (the R6,000/location/month offer, the
   R2,000 audit credited to month one, 30 days' notice, the founding terms,
   and the POPIA statement from `/privacy`) — per `.ai/vyso_v2.md` §2.3
   ("draft from FACTS ONLY already on the site"). It has NOT been reviewed by
   a lawyer and does not cover liability, warranties, intellectual property,
   indemnity, dispute resolution or anything else a real services agreement
   needs. `robots: noindex` and the `DRAFT · UNDER LEGAL REVIEW` chip below
   stay until Josh (or counsel) signs off — do not remove either without
   that approval. */

const TITLE = "Terms of Service (Draft) | Vyso";
const DESCRIPTION =
  "Draft terms for Finch by Vyso: R6,000/location/month, the R2,000 Operations Audit, founding terms and 30 days' notice. Under legal review.";

export const metadata: Metadata = {
  // `absolute`: TITLE already ends in "| Vyso" — see `/privacy`'s comment.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

const CONTACT_EMAIL = "joshua@vyso.co.za";

/* Same regex-based formatter `compare/CostBars.tsx` uses — guaranteed
   comma-thousands regardless of the runtime's ICU data, rather than trusting
   `toLocaleString("en-ZA")` to be available/consistent everywhere this
   renders. */
const rand = (value: number) => `R${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export default function TermsPage() {
  return (
    <LegalShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildLegalSchema({ path: "/terms", name: "Terms of Service", description: DESCRIPTION }),
          ).replace(/</g, "\\u003c"),
        }}
      />

      <LegalHeader
        eyebrow="Legal"
        title="Terms of Service"
        meta="Draft — not yet in force. See the notice below."
        chip={<DraftChip />}
      />

      <p className="m-0 mb-[8px] max-w-[560px] text-[14.5px] leading-[1.65] text-fn-ink-3">
        This page is a working draft, built only from terms already published on this site. It is
        under legal review and is not a final, signed agreement — nothing here should be relied on
        until that review is complete.
      </p>

      <LegalSection title="1. Who these terms are between">
        <p>
          These are draft terms between Vyso, an operations software and implementation business
          operated by Joshua Moreira as a sole proprietor in South Africa, and a business that
          engages Vyso for the Finch service or the Operations Audit described below.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          Finch is Vyso&rsquo;s AI operations service: agents that watch a customer&rsquo;s invoices,
          stock, suppliers, debtors and margins, and report on them. The published price is{" "}
          {rand(PRICE.finch)} per location per month, everything included — every module and agent,
          activated in priority order from the customer&rsquo;s operations audit, plus a monthly ops
          review with their Vyso lead.
        </p>
      </LegalSection>

      <LegalSection title="3. The Operations Audit">
        <p>
          Engagements typically begin with a one-week Operations Audit, priced at {rand(PRICE.audit)}.
          That amount is credited toward the customer&rsquo;s first month of Finch if they go on to
          sign up. The audit is delivered whether or not the customer proceeds.
        </p>
      </LegalSection>

      <LegalSection title="4. Founding client terms">
        <p>
          While Vyso is taking on its founding cohort, founding clients receive: {FOUNDING_TERMS.join(", ").toLowerCase()}.
          These terms apply for as long as the customer remains on the service, on the basis published
          on <a href="/founding-client">/founding-client</a> at the time they signed up.
        </p>
      </LegalSection>

      <LegalSection title="5. Term and cancellation">
        <p>
          There is no fixed lock-in. Either party may cancel the service with 30 days&rsquo; written
          notice, sent to the email address below (or to the customer&rsquo;s account contact, from
          Vyso&rsquo;s side).
        </p>
      </LegalSection>

      <LegalSection title="6. Your data and POPIA">
        <p>
          Vyso processes personal information in accordance with the Protection of Personal
          Information Act 4 of 2013, as set out in full on the{" "}
          <a href="/privacy">Privacy Policy</a>, which forms part of these terms by reference. See
          also the <a href="/popia">POPIA &amp; PAIA</a> page for the Information Officer and how to
          request the PAIA manual.
        </p>
      </LegalSection>

      <LegalSection title="7. Governing law">
        <p>
          These terms, once finalised, are intended to be governed by the laws of the Republic of
          South Africa.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to these terms">
        <p>
          This draft will change as it moves through legal review, and again as the service itself
          changes. The current version is always the one published at this address.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about these draft terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalCrossLinks current="terms" />
    </LegalShell>
  );
}
