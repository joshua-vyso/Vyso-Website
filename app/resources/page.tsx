import type { Metadata } from "next";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { H2, LEAD, SECTION } from "@/components/finch/learn/LearnBits";
import { ResourceCard } from "@/components/finch/learn/ResourceCard";
import { buildResourcesHubSchema } from "@/components/finch/learn/learn-jsonld";
import { ArrowLink, Breadcrumb, Eyebrow } from "@/components/finch/solutions/SolutionBits";
import { RESOURCES } from "@/lib/marketing/resources";
import { SITE } from "@/lib/marketing/site";

const TITLE = "Free operations templates for South African SMEs";
const DESCRIPTION =
  "Three free documents for South African operators: an operations audit checklist, a weekly report template and a supplier scorecard. Previewed in full.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/resources` },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/resources`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/* `/resources` — the page-flip cards are this route's signature visual and
   appear nowhere else on the site. No finding card here: the resources are
   documents, not findings, and the one card in this tree that carries a rand
   figure belongs on the article and glossary pages where the figure is
   explained. */
export default function ResourcesHubPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildResourcesHubSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="learn" />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Resources", href: "/resources" },
            ]}
          />
          <Eyebrow>FREE RESOURCES</Eyebrow>
          <h1 className="m-0 mb-[18px] max-w-[820px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[56px] lg:leading-[1.06] lg:tracking-[-0.025em]">
            Practical tools, <span className="text-fn-ink-3">not another ebook.</span>
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[17px]">
            Three documents built from the same operational problems Finch watches for — buying,
            stock, reporting, suppliers. Each page shows every section it contains before you ask
            for it, so you know what you are getting.
          </p>
        </section>

        <section className={SECTION} aria-labelledby="resources-heading">
          <Eyebrow>START HERE</Eyebrow>
          <h2 id="resources-heading" className={H2}>
            Three documents, previewed in full.
          </h2>
          <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>
            Ask for one and it arrives by email from a person, not an autoresponder. We read what
            you write in the message field and reply to it.
          </p>

          <ul className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-3">
            {RESOURCES.map((resource) => (
              <li key={resource.slug}>
                <ResourceCard resource={resource} />
              </li>
            ))}
          </ul>

          <p className="m-0 mt-[36px] text-[14px] text-fn-muted">
            <ArrowLink href="/learn">The articles behind these documents</ArrowLink>
          </p>
        </section>

        <section className={SECTION} aria-labelledby="beyond-heading">
          <Eyebrow>WHEN A TEMPLATE ISN&rsquo;T ENOUGH</Eyebrow>
          <h2 id="beyond-heading" className={H2}>
            A checklist finds the question. The audit finds the number.
          </h2>
          <p className={`${LEAD} max-w-[720px]`}>
            These documents are designed to be used without us. If you work through one and the
            answer is &ldquo;something is leaking here and I cannot prove it,&rdquo; that is what
            the one-week Operations Audit is for: your own invoices, statements and stock sheets,
            read against each other, with a rand figure attached to what it finds.
          </p>
          <p className="m-0 mt-[24px] text-[14px] text-fn-muted">
            <ArrowLink href="/learn/glossary">
              Or start with the glossary, if the words are the problem
            </ArrowLink>
          </p>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
