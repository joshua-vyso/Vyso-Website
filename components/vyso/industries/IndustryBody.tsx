import Link from "next/link";

import { getIndustry, type Industry, type SolutionSlug } from "@/lib/marketing/industries";
import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Section } from "@/components/vyso/Section";
import { IndustryDeck } from "./IndustryDeck";

/* ── The industry page body ──────────────────────────────────────────────────
   Plan §7.5. One template, fed by whichever `Industry` the route resolves, so
   `app/industries/[slug]/page.tsx` stays a thin wrapper (metadata, JSON-LD,
   breadcrumb) around this. Six sections: hero, the gaps, the finding deck,
   the audit, the internal links, the FAQs, then the one dark close every page
   on this system gets.

   Solution labels are hard-coded here rather than imported from `lib/
   marketing/solutions.ts`: that registry is Phase 2c's file, built in
   parallel, and several of the slugs this phase links to
   (`whatsapp-order-automation`, `invoice-automation`, `spreadsheet-automation`,
   `inventory-automation`, `document-processing`) don't exist there yet. The
   labels match Phase 0's `Footer.tsx`, which already established the same
   pattern for the same reason: the page's real shape should be reviewable
   without waiting for every sibling phase to land. Those links 404 until
   Phase 2c ships. */

const SOLUTION_LABELS: Record<SolutionSlug, string> = {
  "whatsapp-order-automation": "WhatsApp order automation",
  "invoice-automation": "Invoice automation",
  "spreadsheet-automation": "Spreadsheet automation",
  "procurement-automation": "Procurement automation",
  "inventory-automation": "Inventory automation",
  "reporting-automation": "Reporting automation",
  "document-processing": "Document processing",
  "reduce-money-leakage": "Reduce money leakage",
};

export function IndustryBody({ industry }: { industry: Industry }) {
  return (
    <>
      <Section
        headingLevel={1}
        eyebrow={industry.eyebrow}
        heading={industry.h1Plain}
        continuation={industry.h1Accent}
        lead={industry.lead}
        width="narrow"
      />

      <Section
        id="gaps"
        eyebrow="What usually goes wrong"
        heading="The gaps the audit usually finds."
        divider
      >
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2">
          {industry.gaps.map((gap) => (
            <li key={gap.title}>
              <Card as="article" padding="lg" className="h-full">
                <h3 className="vy-h3 text-[17px] text-[color:var(--vy-ink)]">{gap.title}</h3>
                <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)]">{gap.copy}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="examples"
        eyebrow="Illustrative examples"
        heading={`What Vyso would catch for a ${industry.singular}.`}
        lead="Worked examples at a plausible operation's volumes, not a client's measured result."
        divider
      >
        <IndustryDeck deck={industry.deck} />
      </Section>

      <Section
        id="audit"
        eyebrow="The front door"
        heading={`How the audit runs for a ${industry.singular}.`}
        divider
      >
        <ol className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-3 md:gap-[28px]">
          {industry.audit.map((sentence, index) => (
            <li key={sentence} className="flex flex-col gap-[10px]">
              <span className="vy-mono text-[13px] text-[color:var(--vy-ink-4)]">
                0{index + 1}
              </span>
              <p className="vy-body text-[color:var(--vy-ink-2)] text-pretty">{sentence}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="solutions"
        eyebrow="Where to start"
        heading="The solutions most relevant here."
        divider
      >
        <ul className="m-0 flex list-none flex-wrap gap-[10px] p-0">
          {industry.solutions.map((slug) => (
            <li key={slug}>
              <Link
                href={`/solutions/${slug}`}
                className="inline-flex items-center rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[16px] py-[10px] text-[14px] text-[color:var(--vy-ink-2)] transition-colors duration-150 hover:border-[color:var(--vy-line-2)] hover:text-[color:var(--vy-ink)]"
              >
                {SOLUTION_LABELS[slug]}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-[24px] flex flex-wrap items-center gap-[18px]">
          <Button href="/case-studies/turn-n-slice" variant="quiet">
            Read the Turn &rsquo;n Slice case study
          </Button>
          {industry.siblings.length > 0 ? (
            <span className="vy-small text-[color:var(--vy-ink-4)]">
              Also see{" "}
              {industry.siblings.map((slug, i) => (
                <span key={slug}>
                  {i > 0 ? ", " : ""}
                  <Link
                    href={`/industries/${slug}`}
                    className="text-[color:var(--vy-ink-3)] underline decoration-[color:var(--vy-line-2)] underline-offset-2 hover:text-[color:var(--vy-ink)]"
                  >
                    {getIndustry(slug)?.shortName ?? slug}
                  </Link>
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </Section>

      <Section id="faqs" eyebrow="Questions" heading="Frequently asked." divider>
        <dl className="m-0 flex flex-col">
          {industry.faqs.map((faq) => (
            <div key={faq.question} className="border-t border-[color:var(--vy-line)] py-[20px] first:border-0">
              <dt className="vy-h3 text-[16px] text-[color:var(--vy-ink)]">{faq.question}</dt>
              <dd className="vy-body mt-[8px] text-[color:var(--vy-ink-3)] text-pretty">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="What's costing your business time?"
        lead={`Tell us how your ${industry.singular} currently operates. We'll show you where Vyso can help.`}
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "industries", vertical: industry.slug }}
          >
            Get a free Operations Audit
          </Button>
          <Button href="/contact" variant="secondary" size="lg">
            Talk to Vyso
          </Button>
        </div>
      </Section>
    </>
  );
}

export default IndustryBody;
