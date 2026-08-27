import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/vyso/Button";
import { Shell } from "@/components/vyso/Shell";
import { Section } from "@/components/vyso/Section";
import { SolutionClose } from "@/components/vyso/solutions/SolutionClose";
import { SolutionDemo } from "@/components/vyso/solutions/SolutionDemo";
import { SolutionFaqs } from "@/components/vyso/solutions/SolutionFaqs";
import { SolutionRelated } from "@/components/vyso/solutions/SolutionRelated";
import { buildSolutionSchema } from "@/components/vyso/solutions/solutions-jsonld";
import { SITE } from "@/lib/marketing/site";
import { SOLUTION_ORDER, getSolution } from "@/lib/marketing/solutions";

/* `/solutions/[slug]` — plan §7.4. Eight static pages, each rewritten from
   nothing (see `lib/marketing/solutions.ts`'s header for what this replaces).
   Sections in the order the plan lists them: problem answer, approach, demo,
   outcomes, integrations honesty, related, FAQs, the one dark close. */

export function generateStaticParams() {
  return SOLUTION_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return {};

  const url = `${SITE.url}/solutions/${slug}`;
  return {
    /* Plain string: the root layout's `%s | Vyso` template supplies the
       suffix. */
    title: solution.title,
    description: solution.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: solution.title,
      description: solution.description,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: solution.title,
      description: solution.description,
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  return (
    <Shell active="solutions">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSolutionSchema(solution)).replace(/</g, "\\u003c"),
        }}
      />

      {/* ── Hero: the problem answer, first (plan §7.4 item 1, AEO-quotable) ── */}
      <section className="px-[var(--vy-gutter)] pt-[44px] pb-[16px] md:px-[40px] md:pt-[72px]">
        <div className="mx-auto max-w-[var(--vy-content)]">
          <nav aria-label="Breadcrumb" className="vy-label mb-[24px] flex flex-wrap items-center gap-[8px] text-[color:var(--vy-ink-4)]">
            <Link href="/solutions" className="hover:text-[color:var(--vy-ink-2)]">
              Solutions
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[color:var(--vy-ink-3)]">{solution.shortName}</span>
          </nav>

          <p className="vy-label mb-[18px] text-[color:var(--vy-ink-3)]">{solution.eyebrow}</p>

          <h1 className="vy-h1 max-w-[820px] text-[color:var(--vy-ink)]">
            {solution.heading}{" "}
            <span className="text-[color:var(--vy-ink-3)]">{solution.continuation}</span>
          </h1>

          <p className="vy-body-lg mt-[22px] max-w-[640px] text-[color:var(--vy-ink-3)] text-pretty">
            {solution.problemAnswer}
          </p>

          <div className="mt-[30px]">
            <Button
              href="/operations-audit"
              event="book_audit_click"
              eventProps={{ page: `solutions-${solution.slug}` }}
            >
              Get your free operations audit
            </Button>
          </div>
        </div>
      </section>

      {/* ── Approach (plan §7.4 item 2) ─────────────────────────────────── */}
      <Section
        eyebrow="Vyso's approach"
        heading="How Vyso would approach this."
        lead={solution.approachIntro}
        spacing="tight"
        divider
      >
        <ol className="m-0 grid list-none grid-cols-1 gap-[28px] p-0 md:grid-cols-3 md:gap-[32px]">
          {solution.approachSteps.map((step, i) => (
            <li key={step.title}>
              <span aria-hidden="true" className="vy-mono text-[13px] text-[color:var(--vy-ink-4)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="vy-h3 mt-[8px] text-[color:var(--vy-ink)]">{step.title}</h3>
              <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)] text-pretty">{step.copy}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── The demo (plan §7.4 item 3) ─────────────────────────────────── */}
      <Section
        eyebrow="What this looks like"
        heading="A believable example, worked through."
        lead="The figures below are illustrative: a plausible operation, at a plausible volume, not a measurement taken from a client."
        divider
      >
        <SolutionDemo solution={solution} />
      </Section>

      {/* ── Outcomes (plan §7.4 item 4) ──────────────────────────────────── */}
      <Section
        eyebrow="What changes"
        heading="What this actually gets you."
        divider
      >
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 md:gap-x-[32px] md:gap-y-[20px]">
          {solution.outcomes.map((outcome) => (
            <li key={outcome} className="flex gap-[12px]">
              <span aria-hidden="true" className="mt-[8px] h-[6px] w-[6px] shrink-0 rounded-full bg-[color:var(--vy-ink-4)]" />
              <span className="vy-body text-[color:var(--vy-ink-2)] text-pretty">{outcome}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Integrations honesty (plan §7.4 item 5) ─────────────────────── */}
      <Section
        eyebrow="Works with what you run"
        heading="We design around your tools, not the other way round."
        divider
        width="narrow"
      >
        <p className="vy-body text-[color:var(--vy-ink-2)] text-pretty">{solution.integrationsNote}</p>
        <p className="vy-small mt-[16px] text-[color:var(--vy-ink-3)]">
          <Link href="/integrations" className="underline decoration-[color:var(--vy-line-2)] underline-offset-4 hover:text-[color:var(--vy-ink)]">
            See every tool and its honest status
          </Link>
        </p>
      </Section>

      {/* ── Related + FAQs (plan §7.4 items 6, 7) ────────────────────────── */}
      <Section divider width="narrow">
        <SolutionRelated solution={solution} />
      </Section>

      <Section
        eyebrow="Questions"
        heading="Before you book the audit."
        divider
        width="narrow"
      >
        <SolutionFaqs faqs={solution.faqs} />
      </Section>

      {/* ── The close (plan §7.4 item 8) ─────────────────────────────────── */}
      <SolutionClose page={`solutions-${solution.slug}-close`} />
    </Shell>
  );
}
