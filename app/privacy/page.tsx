import type { Metadata } from "next";

import { buildLegalSchema } from "@/components/site/legal/legal-jsonld";
import { LegalCrossLinks, LegalHeader, LegalSection, LegalShell } from "@/components/site/legal/LegalReading";

/* `/privacy` reskinned into the shared legal reading layout — the WebGL
   shader, glass panel and old typography are gone, but every sentence of the
   policy below reads identically to the version this replaces: same section
   order, same wording, same effective date. Curly quotes/dashes are written
   as HTML entities (&ldquo; &rsquo; &mdash;) rather than the raw Unicode
   characters the previous file used — the rendered text is the same glyph
   either way, entities are just the safer source form in JSX. Nothing here
   is new copy: this is a markup-only change, per `.ai/vyso_v2.md` §2.3
   ("KEEP+REBUILD light … drop the WebGL, Finch typography"). */

const TITLE = "Privacy Policy | Vyso";
const DESCRIPTION =
  "How Vyso collects, uses, protects and processes personal information under the Protection of Personal Information Act.";

export const metadata: Metadata = {
  // `absolute`: TITLE already ends in "| Vyso" — the root layout's `%s | Vyso`
  // template would otherwise double the suffix (same fix as `/pricing` and
  // `/finch` in earlier phases).
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "22 July 2026";
const CONTACT_EMAIL = "joshua@vyso.co.za";

export default function PrivacyPage() {
  return (
    <LegalShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildLegalSchema({ path: "/privacy", name: "Privacy Policy", description: DESCRIPTION }),
          ).replace(/</g, "\\u003c"),
        }}
      />

      <LegalHeader eyebrow="Legal" title="Privacy Policy" meta={`Effective date: ${EFFECTIVE_DATE}`} />

      <LegalSection title="1. Who we are">
        <p>
          Vyso is an operations software and implementation business operated by Joshua Moreira as a
          sole proprietor in South Africa. In this policy, &ldquo;Vyso&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo; and &ldquo;our&rdquo; mean that business. We are committed to processing
          personal information lawfully and in accordance with the Protection of Personal Information
          Act 4 of 2013 (&ldquo;POPIA&rdquo;).
        </p>
        <p>
          For privacy questions or requests, contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. When this policy applies">
        <p>
          This policy applies to personal information processed through vyso.co.za, the Vyso
          platform, enquiries and implementation or support services. It explains how we handle
          information about website visitors, prospective customers, Vyso users and people whose
          information is included in a customer&rsquo;s account or records.
        </p>
      </LegalSection>

      <LegalSection title="3. Information we process">
        <p>Depending on how you use Vyso, we may process:</p>
        <ul>
          <li>contact and identity information, such as a name, business name, email address, telephone number and job role;</li>
          <li>account and organisational information, including authorised-user details and access roles;</li>
          <li>business-operational information entered into the platform, such as customer and supplier contacts, delivery addresses, quotes, orders, invoices, payments, stock and related records;</li>
          <li>documents, email messages and attachments submitted, forwarded or connected by a customer for processing, including information contained in those materials;</li>
          <li>communications, support requests, feedback and website enquiry information; and</li>
          <li>limited technical and security information needed to operate and protect our services, such as IP address and request data used for abuse prevention.</li>
        </ul>
        <p>
          Please do not provide special personal information&mdash;such as health, biometric,
          religious, political, trade-union or criminal-record information&mdash;unless it is
          necessary for an agreed service and you are authorised to provide it.
        </p>
      </LegalSection>

      <LegalSection title="4. How we collect information">
        <p>
          We collect information directly from you when you contact us, create or use an account,
          request support or provide records for implementation. We also receive information from a
          Vyso customer when that customer adds authorised users or business contacts to its
          workspace, or enables an agreed integration such as email ingestion or a connected Gmail
          inbox.
        </p>
      </LegalSection>

      <LegalSection title="5. Why we use information">
        <p>We process personal information to:</p>
        <ul>
          <li>respond to enquiries, arrange meetings and provide requested information;</li>
          <li>set up, operate, support, secure and improve the Vyso service;</li>
          <li>process documents, emails and business records when a customer has enabled those features;</li>
          <li>communicate about an account, service changes, support and billing;</li>
          <li>prevent fraud, misuse and security incidents; and</li>
          <li>meet legal, tax, accounting and record-keeping obligations that apply to us.</li>
        </ul>
        <p>
          We rely on the grounds allowed by POPIA, including consent where required, performance of
          an agreement, our legitimate interests in operating and securing Vyso, and compliance with
          legal obligations. We do not sell personal information or use a customer&rsquo;s contacts,
          documents or inbox content for Vyso&rsquo;s own marketing.
        </p>
      </LegalSection>

      <LegalSection title="6. Our role and our customers’ role">
        <p>
          For information we collect for our own website, sales, accounts and service operations,
          Vyso is generally the responsible party under POPIA. Where a customer uses Vyso to store or
          process its own employees&rsquo;, customers&rsquo;, suppliers&rsquo; or other
          contacts&rsquo; information, that customer generally determines the purpose and means of
          processing and is the responsible party. Vyso generally acts as its operator and processes
          that information only to provide and support the agreed service, or as otherwise required
          by law.
        </p>
      </LegalSection>

      <LegalSection title="7. Service providers and international processing">
        <p>
          We use carefully selected service providers to run Vyso. Depending on the features used,
          this may include Supabase for authentication, database and file storage; Resend for email
          delivery and inbound email handling; Google for a customer-authorised Gmail connection; and
          Anthropic for AI-assisted extraction, categorisation and summaries. We may also use
          professional advisers and hosting or infrastructure providers where needed to operate the
          service.
        </p>
        <p>
          Some providers may process information outside South Africa. Where this occurs, we take
          reasonable steps to ensure the transfer is permitted by POPIA and that appropriate
          contractual, technical or organisational safeguards apply.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use reasonable technical and organisational safeguards appropriate to the nature of the
          information and service. These include access controls, organisation-level separation of
          platform data, authentication, restricted administrative access, protected service
          credentials, and measures intended to prevent unauthorised access, loss, destruction or
          disclosure. No online service can guarantee absolute security; please use strong, unique
          credentials and notify us promptly if you suspect unauthorised account access.
        </p>
      </LegalSection>

      <LegalSection title="9. Retention and deletion">
        <p>
          We retain personal information only for as long as it is reasonably necessary for the
          purpose for which it was collected, to provide the service, resolve disputes, enforce
          agreements or meet legal obligations. Customer workspace data is retained for the duration
          of the customer relationship and then returned or deleted in accordance with the applicable
          agreement or documented instructions, unless we must retain it by law. We may retain
          de-identified information that no longer identifies a person.
        </p>
      </LegalSection>

      <LegalSection id="10-your-rights-and-choices" title="10. Your rights and choices">
        <p>
          Subject to POPIA and applicable law, you may ask us to confirm whether we hold your
          personal information, request access to it, ask for correction or deletion of inaccurate or
          unnecessary information, object to certain processing, or withdraw consent where processing
          relies on consent. You may also opt out of direct marketing at any time.
        </p>
        <p>
          Send requests to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If your
          information is in a customer&rsquo;s Vyso workspace, please contact that customer first; we
          will assist the customer to respond where appropriate. You may also lodge a complaint with
          the South African Information Regulator.
        </p>
      </LegalSection>

      <LegalSection title="11. Direct marketing">
        <p>
          We will only send direct marketing where permitted by law. Every marketing message will
          identify Vyso and provide a practical way to opt out. Service messages about an existing
          account, security or a requested service are not marketing messages.
        </p>
      </LegalSection>

      <LegalSection title="12. Children">
        <p>
          Vyso is intended for business users and is not directed to children. We do not knowingly
          collect personal information from children for our own purposes. If you believe a
          child&rsquo;s information has been provided to us in error, please contact us so that we
          can assess and address it.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <p>
          We may update this policy as Vyso or the law changes. We will publish the updated version
          here and change the effective date. Where a material change affects an existing
          customer&rsquo;s use of the service, we will provide additional notice where appropriate.
        </p>
      </LegalSection>

      <LegalCrossLinks current="privacy" />
    </LegalShell>
  );
}
