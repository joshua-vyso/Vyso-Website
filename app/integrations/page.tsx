import type { Metadata } from "next";
import Link from "next/link";

import {
  DONT_SEE_YOUR_TOOL,
  INTEGRATIONS_FAQS,
  INTEGRATION_DETAILS,
} from "@/lib/marketing/integrations";
import { IntegrationSection } from "@/components/vyso/integrations/IntegrationSection";
import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
import { SITE } from "@/lib/marketing/site";

/* ── /integrations ────────────────────────────────────────────────────────────
   Plan §7.6. One page, no child routes. Per-tool sections with anchor ids
   (`#xero`, `#whatsapp`, `#sage`, `#excel`, `#google-sheets`, `#gmail`, …),
   honest status per tool, sourced entirely from `lib/marketing/
   integrations.ts`, which is where the "connected vs designed around vs
   roadmap" distinction is actually checked against the running product. */

const TITLE = "Integrations: Xero, WhatsApp, Sage, Excel and more";
const DESCRIPTION =
  "Xero and WhatsApp Business connect directly for South African SMEs. Sage, Excel, Google Sheets and more are designed around, or roadmap, scoped in your audit.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/integrations` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/integrations`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const url = `${SITE.url}/integrations`;

const JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Integrations", item: url },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: INTEGRATIONS_FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function IntegrationsPage() {
  return (
    <Shell active="none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto max-w-[var(--vy-content)] px-[var(--vy-gutter)] pt-[24px] md:px-[40px]">
        <ol className="m-0 flex list-none flex-wrap items-center gap-[6px] p-0 text-[12px] text-[color:var(--vy-ink-3)]">
          <li>
            <Link href="/" className="hover:text-[color:var(--vy-ink-2)]">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[color:var(--vy-ink-3)]">Integrations</li>
        </ol>
      </nav>

      <Section
        headingLevel={1}
        eyebrow="Your tools"
        heading="Connect what you already run."
        lead="Nothing to migrate. Xero and WhatsApp connect directly, the rest of your stack is read, not replaced, and only once you say so. What Vyso reads from a connected tool stays yours."
        width="narrow"
      />

      <Section id="tools" eyebrow="Every tool, honestly" heading="What's actually connected today." divider>
        <div className="border-t border-[color:var(--vy-line)]">
          {INTEGRATION_DETAILS.map((integration) => (
            <IntegrationSection key={integration.slug} integration={integration} />
          ))}
        </div>
      </Section>

      <Section id="dont-see-it" divider>
        <Card as="article" padding="lg">
          <h3 className="vy-h3 text-[18px] text-[color:var(--vy-ink)]">Don&rsquo;t see your tool?</h3>
          <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)]">{DONT_SEE_YOUR_TOOL}</p>
        </Card>
      </Section>

      <Section id="faqs" eyebrow="Questions" heading="Frequently asked." divider>
        <dl className="m-0 flex flex-col">
          {INTEGRATIONS_FAQS.map((faq) => (
            <div key={faq.id} className="border-t border-[color:var(--vy-line)] py-[20px] first:border-0">
              <dt className="vy-h3 text-[16px] text-[color:var(--vy-ink)]">{faq.question}</dt>
              <dd className="vy-body mt-[8px] text-[color:var(--vy-ink-3)] text-pretty">{faq.answer}</dd>
            </div>
          ))}
        </dl>
        <p className="vy-small mt-[24px] text-[color:var(--vy-ink-3)]">
          More on data handling and POPIA:{" "}
          <Link
            href="/faq"
            className="text-[color:var(--vy-ink-3)] underline decoration-[color:var(--vy-line-2)] underline-offset-2 hover:text-[color:var(--vy-ink)]"
          >
            see the full FAQ
          </Link>
          .
        </p>
      </Section>

      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="Tell us what you run."
        lead="The audit maps your real tools before anything gets built around them."
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "integrations" }}
          >
            Get a free Operations Audit
          </Button>
        </div>
      </Section>
    </Shell>
  );
}
