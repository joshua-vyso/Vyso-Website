import type { Metadata } from "next";

import { Shell } from "@/components/vyso/Shell";
import { ArrowLink, Breadcrumb, Eyebrow, H2, LEAD, SECTION } from "@/components/finch/learn/LearnBits";
import { ResourceCard } from "@/components/finch/learn/ResourceCard";
import { buildResourcesHubSchema } from "@/components/finch/learn/learn-jsonld";
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
   explained.

   `.ai/plan_vyso_redesign_2026.md` §7.6: chrome swap onto the vyso `Shell`
   (`active="insights"`). All three documents and their contents are
   unchanged; only the chrome, the `--fn-*` styling and two stray Finch-era
   claims (see below) moved. */
export default function ResourcesHubPage() {
  return (
    <Shell active="insights">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildResourcesHubSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <section className="mx-auto max-w-[1160px] px-[var(--vy-gutter)] pt-[36px] lg:px-[40px] lg:pt-[56px]">
        <Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources" },
          ]}
        />
        <Eyebrow>FREE RESOURCES</Eyebrow>
        <h1 className="vy-h1 m-0 mb-[18px] max-w-[820px] text-pretty text-[color:var(--vy-ink)] lg:mb-[22px]">
          Practical tools, <span className="text-[color:var(--vy-ink-3)]">not another ebook.</span>
        </h1>
        <p className="vy-body-lg m-0 max-w-[620px] text-pretty text-[color:var(--vy-ink-2)]">
          Three documents built from the same operational problems Vyso watches for: buying,
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

        <p className="m-0 mt-[36px] text-[14px] text-[color:var(--vy-ink-3)]">
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
          the free Operations Audit is for: your own invoices, statements and stock sheets,
          read against each other, with a rand figure attached to what it finds.
        </p>
        <p className="m-0 mt-[24px] text-[14px] text-[color:var(--vy-ink-3)]">
          <ArrowLink href="/learn/glossary">
            Or start with the glossary, if the words are the problem
          </ArrowLink>
        </p>
      </section>
    </Shell>
  );
}
