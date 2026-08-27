import type { Metadata } from "next";
import Link from "next/link";

import { CaseCard } from "@/components/vyso/case/CaseCard";
import { TURN_N_SLICE } from "@/components/vyso/case/turn-n-slice-data";
import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
import { SITE } from "@/lib/marketing/site";

/* ── /case-studies ───────────────────────────────────────────────────────────
   Plan §7.6, brief §37: honest "our first client" transparency, framed as
   "Built in the real world" (the same phrase Phase 1's `HomeCase` opens with,
   so the homepage teaser and this hub agree on how the company talks about
   its own newness). Vyso is early. Rather than publish a wall of logos, this
   page says so plainly and shows the one real story it has in full. */

const TITLE = "Case studies: built in the real world";
const DESCRIPTION =
  "Vyso is early. One real client story so far, Turn 'n Slice in Johannesburg, documented honestly with what was built and what is still being confirmed.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/case-studies` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/case-studies`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const BREADCRUMB_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE.url}/case-studies#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Case studies", item: `${SITE.url}/case-studies` },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${SITE.url}/case-studies#list`,
      name: TITLE,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: TURN_N_SLICE.company,
          url: `${SITE.url}/case-studies/${TURN_N_SLICE.slug}`,
        },
      ],
    },
  ],
};

export default function CaseStudiesPage() {
  return (
    <Shell active="case-studies">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_JSONLD).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto max-w-[var(--vy-content)] px-[var(--vy-gutter)] pt-[24px] md:px-[40px]">
        <ol className="m-0 flex list-none flex-wrap items-center gap-[6px] p-0 text-[12px] text-[color:var(--vy-ink-3)]">
          <li>
            <Link href="/" className="hover:text-[color:var(--vy-ink-2)]">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[color:var(--vy-ink-3)]">Case studies</li>
        </ol>
      </nav>

      <Section
        headingLevel={1}
        eyebrow="Proof, not promises"
        heading="Built in the real world."
        lead="Vyso is early. Rather than publish a wall of logos, we document what we've actually built, starting with the first client, in Johannesburg."
        width="narrow"
      />

      <Section id="stories" divider>
        <CaseCard data={TURN_N_SLICE} />
      </Section>

      <Section
        id="more"
        eyebrow="What we're building toward"
        heading="More stories, as they become real."
        lead="Every new case study will be a genuine client, with figures and quotes published only once they're confirmed, never a composite or a projection."
        divider
      >
        <ul className="m-0 flex list-none flex-col gap-[12px] p-0 md:max-w-[640px]">
          {[
            "Documented before and after workflows, not just headline numbers.",
            "Figures and quotes published only with the client's approval.",
            "Drawn from the industries Vyso already understands: food distribution, wholesale and hospitality.",
            "Updated as more clients go live.",
          ].map((text) => (
            <li key={text} className="flex gap-[12px] text-[14.5px] leading-[1.6] text-[color:var(--vy-ink-2)]">
              <span
                aria-hidden="true"
                className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--vy-ink-4)]"
              />
              {text}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="Want to be the next story?"
        lead="It starts the same way Turn ’n Slice's did: a free operations audit."
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "case-studies-hub" }}
          >
            Get a free Operations Audit
          </Button>
        </div>
      </Section>
    </Shell>
  );
}
