import Link from "next/link";

import { FindingCard } from "@/components/finch/FindingCard";
import type { Solution } from "@/lib/marketing/solutions";

import { AgentList, ArrowLink, Breadcrumb, Eyebrow } from "./SolutionBits";
import { SolutionCards } from "./SolutionCards";

/* ── /solutions/[slug] sections ──────────────────────────────────────────────
   All server components. The only client code any solution page loads is
   `FindingCard` (for its pointer tilt) — the same trade the homepage makes.

   Section rhythm is `.ai/vyso_v2.md` §1: max-w 1160, 110px desktop gaps / 72
   mobile, mono eyebrow → STIX h2 → 15.5px body.                              */

const SECTION = "mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]";
const H2 =
  "m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]";
const LEAD = "m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 lg:text-[15.5px]";

/* ── Hero ─────────────────────────────────────────────────────────────────── */

export function SolutionHero({ solution }: { solution: Solution }) {
  return (
    <header className="mx-auto grid max-w-[1160px] grid-cols-1 items-center gap-[40px] px-[20px] pt-[36px] pb-[8px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-[64px] lg:px-[40px] lg:pt-[56px] lg:pb-[24px]">
      <div>
        <Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Solutions", href: "/solutions" },
            { label: solution.shortName, href: `/solutions/${solution.slug}` },
          ]}
        />
        <Eyebrow>{solution.eyebrow}</Eyebrow>
        <h1 className="mb-[18px] font-fn-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[52px] lg:leading-[1.07] lg:tracking-[-0.025em]">
          {solution.heroPlain}{" "}
          <span className="text-fn-ink-3">{solution.heroAccent}</span>
        </h1>
        <p className="mb-[26px] max-w-[540px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:mb-[32px] lg:text-[17px]">
          {solution.lead}
        </p>
        <div className="lg:flex lg:items-center lg:gap-[18px]">
          <Link
            href="/operations-audit"
            className="block min-h-[44px] rounded-[10px] bg-fn-orange-cta px-[26px] py-[15px] text-center text-[16px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white lg:inline-block lg:min-h-0 lg:rounded-[9px] lg:py-[14px] lg:text-[15.5px]"
          >
            Book your audit
          </Link>
          <span className="mt-[12px] block text-center font-fn-mono text-[10.5px] tracking-[0.06em] text-fn-muted lg:mt-0 lg:inline lg:text-left lg:text-[11.5px]">
            ONE-WEEK OPERATIONS AUDIT · R2,000
          </span>
        </div>
      </div>

      {/* The page's one finding card. Captioned, because the figures in it are
          worked examples — the same caption the homepage hero carries. */}
      <div>
        <FindingCard
          agent={solution.exampleFinding.agent}
          observation={solution.exampleFinding.observation}
          impact={solution.exampleFinding.impact}
          evidence={solution.exampleFinding.evidence}
          meta={solution.exampleFinding.meta}
          actions={[...solution.exampleFinding.actions]}
          className="max-w-[460px]"
        />
        <div className="mt-[12px] max-w-[460px] text-right font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
          ILLUSTRATIVE EXAMPLE
        </div>
      </div>
    </header>
  );
}

/* ── Why this keeps happening ─────────────────────────────────────────────── */

export function SolutionProblem({ solution }: { solution: Solution }) {
  return (
    <section className={SECTION} aria-labelledby="problem-heading">
      <Eyebrow>THE PROBLEM</Eyebrow>
      <h2 id="problem-heading" className={H2}>
        Why this keeps happening.
      </h2>
      <div className="max-w-[720px]">
        {solution.problem.map((paragraph) => (
          <p
            key={paragraph.slice(0, 32)}
            className="m-0 mb-[18px] text-[15px] leading-[1.7] text-fn-ink-3 text-pretty last:mb-0 lg:text-[15.5px]"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

/* ── It's rarely one big failure ──────────────────────────────────────────── */

export function SolutionStruggles({ solution }: { solution: Solution }) {
  return (
    <section className={SECTION} aria-labelledby="struggles-heading">
      <Eyebrow>WHY IT PERSISTS</Eyebrow>
      <h2 id="struggles-heading" className={H2}>
        It&rsquo;s rarely one big failure.
      </h2>
      <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>
        These are the recurring patterns behind {solution.problemNoun}. The audit confirms which of
        them are actually present in your operation.
      </p>
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
        {solution.struggles.map(({ title, copy }) => (
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
    </section>
  );
}

/* ── What it costs ────────────────────────────────────────────────────────────
   No figures. The four numbers this section used to show ("R8k–R25k typical
   monthly variance"…) carried no source; see the note at the top of
   `lib/marketing/solutions.ts`.                                              */

export function SolutionCost({ solution }: { solution: Solution }) {
  return (
    <section className={SECTION} aria-labelledby="cost-heading">
      <Eyebrow>WHAT IT COSTS</Eyebrow>
      <h2 id="cost-heading" className={H2}>
        Small losses, repeated often.
      </h2>
      <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>{solution.costIntro}</p>

      <dl className="m-0 grid grid-cols-1 gap-x-[48px] gap-y-[26px] border-t border-fn-line pt-[28px] md:grid-cols-2 lg:grid-cols-4">
        {solution.costShapes.map(({ label, copy }) => (
          <div key={label}>
            <dt className="mb-[8px] font-fn-serif text-[18px] font-medium tracking-[-0.01em] text-fn-ink">
              {label}
            </dt>
            <dd className="m-0 text-[14px] leading-[1.6] text-fn-ink-3 text-pretty">{copy}</dd>
          </div>
        ))}
      </dl>

      <p className="m-0 mt-[32px] max-w-[720px] text-[14px] leading-[1.65] text-fn-muted text-pretty">
        {solution.costNote}
      </p>
    </section>
  );
}

/* ── How Finch fixes it ───────────────────────────────────────────────────── */

export function HowFinchFixesIt({ solution }: { solution: Solution }) {
  return (
    <section className={SECTION} aria-labelledby="how-heading">
      <Eyebrow>HOW FINCH FIXES IT</Eyebrow>
      <h2 id="how-heading" className={H2}>
        The agents that would work this problem.
      </h2>
      <p className={`${LEAD} mb-[32px] lg:mb-[40px]`}>{solution.helpIntro}</p>

      <AgentList agents={solution.agents} />

      <p className="m-0 mt-[20px] max-w-[720px] text-[13.5px] leading-[1.6] text-fn-muted text-pretty">
        These are examples. Your roster is set in the audit, in the order the findings justify —
        document intelligence (Doc-U) is live today, Price Watch is rolling out, and the rest are
        activated from your roadmap.
      </p>

      <div className="mt-[36px] border-t border-fn-line pt-[28px]">
        <Eyebrow>UNDER THE HOOD</Eyebrow>
        <p className="m-0 mb-[16px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3">
          The agents read from and write to Finch&rsquo;s modules. The ones behind{" "}
          {solution.problemNoun} are mainly:
        </p>
        <ul className="m-0 mb-[18px] flex list-none flex-wrap gap-[8px] p-0">
          {solution.modules.map(({ name, role }) => (
            <li key={name}>
              <span
                title={role}
                className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[12px] py-[5px] font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-ink-3"
              >
                {name}
              </span>
            </li>
          ))}
        </ul>
        <ArrowLink href="/platform/modules">See all ten modules</ArrowLink>
      </div>
    </section>
  );
}

/* ── What it looks like in practice ───────────────────────────────────────── */

export function SolutionWorkflow({ solution }: { solution: Solution }) {
  return (
    <section className={SECTION} aria-labelledby="workflow-heading">
      <Eyebrow>IN PRACTICE</Eyebrow>
      <h2 id="workflow-heading" className={H2}>
        What it looks like week to week.
      </h2>
      <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>
        A representative flow. The exact sequence for your business is confirmed after the audit.
      </p>
      <ol className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 lg:grid-cols-4">
        {solution.workflow.map(({ title, copy }, index) => (
          <li key={title} className="border-t border-fn-line pt-[18px]">
            <span className="mb-[10px] block font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="m-0 mb-[8px] text-[15.5px] font-semibold tracking-[-0.01em] text-fn-ink">
              {title}
            </h3>
            <p className="m-0 text-[14px] leading-[1.55] text-fn-ink-3 text-pretty">{copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Related ──────────────────────────────────────────────────────────────── */

export function SolutionRelated({ solution }: { solution: Solution }) {
  const isHubOfHubs = solution.slug === "reduce-money-leakage";

  return (
    <section className={SECTION} aria-labelledby="related-heading">
      <Eyebrow>{isHubOfHubs ? "WHERE THE LEAKS USUALLY ARE" : "RELATED PROBLEMS"}</Eyebrow>
      <h2 id="related-heading" className={H2}>
        {isHubOfHubs ? "The three places to start looking." : "Often the same operation."}
      </h2>
      <p className={`${LEAD} mb-[32px] lg:mb-[40px]`}>
        {isHubOfHubs
          ? "Money leakage is the symptom. In practice it turns out to be one of these three, and usually more than one."
          : "Businesses that recognise this page usually recognise at least one of these too."}
      </p>

      <SolutionCards slugs={solution.related} />

      <div className="mt-[48px] grid grid-cols-1 gap-[40px] border-t border-fn-line pt-[36px] md:grid-cols-2 md:gap-[64px]">
        <div>
          <Eyebrow>WHERE THIS FITS</Eyebrow>
          <h3 className="m-0 mb-[16px] font-fn-serif text-[20px] font-medium tracking-[-0.015em]">
            Industries we see it in.
          </h3>
          <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
            {solution.industries.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[13px] py-[6px] text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Eyebrow>GO DEEPER</Eyebrow>
          <h3 className="m-0 mb-[16px] font-fn-serif text-[20px] font-medium tracking-[-0.015em]">
            Related reading.
          </h3>
          <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
            {solution.learnArticles.map(({ label, href }) => (
              <li key={href}>
                <ArrowLink href={href}>{label}</ArrowLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── FAQs ─────────────────────────────────────────────────────────────────────
   A `<dl>`, matching `/pricing`'s StraightAnswers: term/definition is what
   these are, it keeps the heading levels flat, and the FAQPage entities in
   `solutions-jsonld.ts` mirror these strings exactly.                        */

export function SolutionFaqs({ solution }: { solution: Solution }) {
  return (
    <section className={SECTION} aria-labelledby="faq-heading">
      <Eyebrow>COMMON QUESTIONS</Eyebrow>
      <h2 id="faq-heading" className={H2}>
        Fit before implementation.
      </h2>
      <dl className="m-0 mt-[32px] grid max-w-[980px] grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
        {solution.faqs.map(({ question, answer }) => (
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
    </section>
  );
}
