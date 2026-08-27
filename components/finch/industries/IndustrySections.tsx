import Link from "next/link";

import { AGENT_HONESTY } from "@/components/finch/agents/agents-data";
import type { Industry } from "@/lib/marketing/industries";
import { INDUSTRIES } from "@/lib/marketing/industries";
import { getLearnArticle } from "@/lib/marketing/learn-articles";
import { MARKETING_MODULE_BY_SLUG } from "@/lib/marketing/modules";
import { SOLUTIONS } from "@/lib/marketing/solutions";

import { TrackedLink } from "@/components/finch/TrackedLink";

import { FindingDeck } from "./FindingDeck";
import { ArrowLink, Breadcrumb, Eyebrow, Section, StatusChip } from "./IndustryBits";

/* ── /industries/[slug] sections ─────────────────────────────────────────────
   All server components. The only client code a vertical page loads is the
   finding deck.

   Link labels are resolved from the registries — `MARKETING_MODULE_BY_SLUG`,
   `getLearnArticle`, `SOLUTIONS` — rather than written out here, so the anchor
   text on this page cannot drift from the title of the page it points at, and
   a link cannot outlive its target. See the header of
   `lib/marketing/industries.ts` for why (Phase 2 found nine dead Learn links
   that had been live on the published site).

   Section rhythm is `.ai/vyso_v2.md` §1: max-w 1160, 110px desktop gaps / 72
   mobile, mono eyebrow → STIX h2 → 15.5px body.                              */

/* ── Hero ─────────────────────────────────────────────────────────────────── */

export function IndustryHero({ industry }: { industry: Industry }) {
  return (
    <header className="mx-auto grid max-w-[1160px] grid-cols-1 items-start gap-[40px] px-[20px] pt-[36px] pb-[8px] lg:grid-cols-[1fr_476px] lg:gap-[56px] lg:px-[40px] lg:pt-[56px] lg:pb-[24px]">
      <div>
        <Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Industries", href: "/industries" },
            { label: industry.shortName, href: `/industries/${industry.slug}` },
          ]}
        />
        <Eyebrow>{industry.eyebrow}</Eyebrow>
        <h1 className="mb-[18px] font-fn-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[48px] lg:leading-[1.08] lg:tracking-[-0.025em]">
          {industry.h1Plain} <span className="text-fn-ink-3">{industry.h1Accent}</span>
        </h1>
        <p className="mb-[26px] max-w-[540px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:mb-[32px] lg:text-[17px]">
          {industry.lead}
        </p>
        <div className="lg:flex lg:items-center lg:gap-[18px]">
          {/* Phase 4 analytics hook: `book_audit_click {page, vertical}` per
              `.ai/vyso_v2.md` §7.7, fired by `TrackedLink`. */}
          <TrackedLink
            href="/operations-audit"
            event="book_audit_click"
            eventProps={{ page: "industries", vertical: industry.slug }}
            className="block min-h-[44px] rounded-[10px] bg-fn-orange-cta px-[26px] py-[15px] text-center text-[16px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white lg:inline-block lg:min-h-0 lg:rounded-[9px] lg:py-[14px] lg:text-[15.5px]"
          >
            Book your free audit
          </TrackedLink>
          <span className="mt-[12px] block text-center font-fn-mono text-[10.5px] tracking-[0.06em] text-fn-muted lg:mt-0 lg:inline lg:text-left lg:text-[11.5px]">
            FREE OPERATIONS AUDIT · ABOUT AN HOUR
          </span>
        </div>
      </div>

      {/* The signature visual. */}
      <FindingDeck findings={industry.deck} />
    </header>
  );
}

/* ── The experimental band ────────────────────────────────────────────────────
   Only the two experimental verticals render this, and it sits directly under
   the hero: a reader should learn that no audit has been run in their industry
   before they read a rand figure, not three sections later.                   */

export function ExperimentalNote({ industry }: { industry: Industry }) {
  if (!industry.experimentalNote) return null;

  return (
    <section
      className="mx-auto max-w-[1160px] px-[20px] pt-[48px] lg:px-[40px] lg:pt-[64px]"
      aria-labelledby="experimental-heading"
    >
      <div className="rounded-[12px] border border-fn-line bg-fn-surface px-[24px] py-[26px] lg:px-[32px] lg:py-[30px]">
        <div className="mb-[14px] flex items-center gap-[10px]">
          <StatusChip status="EXPERIMENTAL VERTICAL" />
        </div>
        <h2
          id="experimental-heading"
          className="m-0 mb-[12px] font-fn-serif text-[20px] font-medium tracking-[-0.015em] lg:text-[22px]"
        >
          Read this first.
        </h2>
        <p className="m-0 max-w-[760px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
          {industry.experimentalNote}
        </p>
      </div>
    </section>
  );
}

/* ── Where it goes wrong ──────────────────────────────────────────────────── */

export function IndustryGaps({ industry }: { industry: Industry }) {
  return (
    <Section
      id="gaps"
      eyebrow="WHERE IT GOES WRONG"
      title="Start where information keeps falling through."
      sub={`These are the repeated breakdowns behind most of what Finch finds in a ${industry.singular}. The audit confirms which of them are actually present before an agent is switched on.`}
    >
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
        {industry.gaps.map(({ title, copy }) => (
          <div
            key={title}
            className="rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[22px] transition-colors duration-150 hover:border-fn-line-hover"
          >
            <h3 className="m-0 mb-[8px] text-[15.5px] font-semibold tracking-[-0.01em] text-fn-ink">
              {title}
            </h3>
            <p className="m-0 text-[14px] leading-[1.55] text-fn-ink-3 text-pretty">{copy}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── What Finch watches in a <vertical> ──────────────────────────────────────
   Rows, not cards: this is a list of watches, and a row lets the agent label,
   the sentence and the honesty chip line up down the page so a reader can scan
   the statuses in one pass.                                                   */

export function WhatFinchWatchesHere({ industry }: { industry: Industry }) {
  return (
    <Section
      id="watches"
      eyebrow="ON SHIFT"
      title={`What Finch watches in a ${industry.singular}.`}
      sub={industry.watchIntro}
    >
      <ul className="m-0 list-none border-t border-fn-line p-0">
        {industry.agents.map((agent) => (
          <li
            key={agent.label}
            className="grid grid-cols-1 gap-[10px] border-b border-fn-line py-[20px] md:grid-cols-[176px_1fr_auto] md:items-baseline md:gap-[24px]"
          >
            <span className="flex items-center gap-[8px]">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" />
              <Link
                href="/finch#agents"
                className="font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
              >
                {agent.label}
              </Link>
            </span>
            <span className="text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">
              {agent.watches}
            </span>
            <span className="md:justify-self-end">
              <StatusChip status={agent.status} />
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-[24px] max-w-[720px] text-[13.5px] leading-[1.6] text-fn-muted text-pretty">
        {AGENT_HONESTY}
      </p>
    </Section>
  );
}

/* ── Modules under the hood ───────────────────────────────────────────────── */

export function IndustryModules({ industry }: { industry: Industry }) {
  return (
    <Section
      id="modules"
      eyebrow="UNDER THE HOOD"
      title="The machinery the agents read from."
      sub={industry.moduleNote}
    >
      <ul className="m-0 flex list-none flex-wrap gap-[10px] p-0">
        {industry.modules.map(({ slug, role }) => {
          const marketingModule = MARKETING_MODULE_BY_SLUG[slug];
          return (
            <li key={slug}>
              <Link
                href={`/platform/modules/${slug}`}
                className="group inline-flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[16px] py-[12px] transition-colors duration-150 hover:border-fn-line-hover"
              >
                <span className="font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                  {marketingModule.name}
                </span>
                <span className="mt-[5px] text-[13px] leading-[1.45] text-fn-ink-3">{role}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-[24px]">
        <ArrowLink href="/platform/modules">See all ten modules</ArrowLink>
      </div>
    </Section>
  );
}

/* ── How the audit runs ───────────────────────────────────────────────────── */

export function IndustryAudit({ industry }: { industry: Industry }) {
  return (
    <Section
      id="audit"
      eyebrow="THE FRONT DOOR"
      title={`How the audit runs for a ${industry.singular}.`}
    >
      <ol className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-3 md:gap-[32px]">
        {industry.audit.map((sentence, index) => (
          <li key={sentence.slice(0, 32)} className="border-t border-fn-line pt-[18px]">
            <span className="mb-[10px] block font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">{sentence}</p>
          </li>
        ))}
      </ol>
      <div className="mt-[32px]">
        <TrackedLink
          href="/operations-audit"
          event="book_audit_click"
          eventProps={{ page: "industries", vertical: industry.slug }}
          className="inline-flex min-h-[44px] items-center rounded-[9px] bg-fn-orange-cta px-[24px] text-[15.5px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white"
        >
          Book your free audit
        </TrackedLink>
        <span className="ml-0 mt-[12px] block font-fn-mono text-[10.5px] tracking-[0.06em] text-fn-muted lg:ml-[18px] lg:mt-0 lg:inline">
          FREE · ABOUT AN HOUR · NO OBLIGATION
        </span>
      </div>
    </Section>
  );
}

/* ── Related ──────────────────────────────────────────────────────────────── */

export function IndustryRelated({ industry }: { industry: Industry }) {
  return (
    <Section
      id="related"
      eyebrow="GO DEEPER"
      title="What this connects to."
      sub={`The problems a ${industry.singular} usually recognises, the reading behind them, and the other operations we work with.`}
    >
      <div className="grid grid-cols-1 gap-[40px] md:grid-cols-2 md:gap-[64px]">
        <div>
          <h3 className="m-0 mb-[16px] font-fn-serif text-[20px] font-medium tracking-[-0.015em]">
            Problems Finch fixes.
          </h3>
          <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
            {industry.solutions.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/solutions/${slug}`}
                  className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[13px] py-[6px] text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
                >
                  {SOLUTIONS[slug].shortName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="m-0 mb-[16px] font-fn-serif text-[20px] font-medium tracking-[-0.015em]">
            Related reading.
          </h3>
          <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
            {industry.learn.map((slug) => (
              <li key={slug}>
                <ArrowLink href={`/learn/${slug}`}>
                  {getLearnArticle(slug)?.title ?? slug}
                </ArrowLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-[48px] border-t border-fn-line pt-[36px]">
        <Eyebrow>OTHER OPERATIONS</Eyebrow>
        <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
          {industry.siblings.map((slug) => (
            <li key={slug}>
              <Link
                href={`/industries/${slug}`}
                className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[13px] py-[6px] text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
              >
                {INDUSTRIES[slug].shortName}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/industries"
              className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[13px] py-[6px] text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
            >
              All industries
            </Link>
          </li>
        </ul>
      </div>
    </Section>
  );
}

/* ── FAQs ─────────────────────────────────────────────────────────────────────
   A `<dl>`, matching `/pricing` and `/solutions`: term/definition is what these
   are, it keeps the heading levels flat, and the `FAQPage` entities in
   `industries-jsonld.ts` mirror these strings exactly.                        */

export function IndustryFaqs({ industry }: { industry: Industry }) {
  return (
    <Section id="faq" eyebrow="COMMON QUESTIONS" title="Fit before implementation.">
      <dl className="m-0 grid max-w-[980px] grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
        {industry.faqs.map(({ question, answer }) => (
          <div key={question}>
            <dt className="mb-[7px] font-fn-serif text-[17px] font-medium text-fn-ink">
              {question}
            </dt>
            <dd className="m-0 text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">{answer}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 mt-[28px] text-[14px] text-fn-muted">
        <ArrowLink href="/faq">More straight answers</ArrowLink>
      </p>
    </Section>
  );
}
