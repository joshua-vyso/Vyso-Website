import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── The case study template ─────────────────────────────────────────────────
   Plan §7.6, brief §37: Company / Industry / Situation / Operational problem /
   Before Vyso / What Vyso built / How the automation works / Proactive
   outcomes / Results / CTA, as one reusable set so the next case study is a
   data object, not a new page.

   Built for exactly one case study today (Turn 'n Slice,
   `turn-n-slice-data.ts`), and written generically anyway: nothing here reads
   "Turn 'n Slice" directly, everything comes through `CaseStudyData`.

   Every fact rendered by this component for Turn 'n Slice was already true on
   the pre-redesign `app/case-studies/turn-n-slice/page.tsx` — this file only
   supplies the SHAPE. The module codename ("OrderFlow") and the banned
   "founding client" framing were removed from the copy that feeds this
   template, not from any fact: the workflow that replaced QuickBooks
   invoicing, the four capabilities, the quote and its byline are unchanged. */

export type CaseStat = readonly [string, string];

export type CaseStudyData = {
  slug: string;
  company: string;
  eyebrow: string;
  h1: string;
  h1Accent?: string;
  lead: string;
  logoSrc: string;
  logoAlt: string;
  stats: readonly CaseStat[];

  industry: string;
  situation: string;
  problem: string;

  before: readonly string[];

  builtIntro: string;
  capabilities: readonly { title: string; copy: string }[];

  howItWorksEyebrow: string;
  howItWorksHeading: string;
  howItWorksCopy: string;
  /** The one demo on the page. Optional so the template stays generic for a
      future case study with a different or no demo. */
  demo?: React.ReactNode;

  outcomesIntro: string;
  outcomes: readonly string[];

  results: readonly string[];
  resultsNote: string;

  quote?: { text: string; byline: string; note: string };

  ctaPrimary: { href: string; label: string };
  ctaSecondary: { href: string; label: string };
};

export function CaseTemplate({ data }: { data: CaseStudyData }) {
  return (
    <>
      <Section
        id="overview"
        headingLevel={1}
        eyebrow={data.eyebrow}
        heading={data.h1}
        continuation={data.h1Accent}
        lead={data.lead}
        width="narrow"
      >
        <div className="mt-[8px] flex flex-wrap gap-[14px]">
          <Button href={data.ctaPrimary.href}>{data.ctaPrimary.label}</Button>
          <Button href={data.ctaSecondary.href} variant="secondary">
            {data.ctaSecondary.label}
          </Button>
        </div>
      </Section>

      {/* ── Company / Industry, in one facts strip ────────────────────────── */}
      <Section id="facts" width="wide" divider>
        <div className="grid grid-cols-1 items-center gap-[28px] lg:grid-cols-[220px_1fr] lg:gap-[40px]">
          <div className="flex items-center justify-center rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface-2)] p-[28px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a fixed
                brand mark from `public/`, not an optimisable content image;
                the same file the pre-redesign page rendered. */}
            <img
              src={data.logoSrc}
              alt={data.logoAlt}
              width={200}
              height={200}
              className="h-auto w-full max-w-[180px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-[14px] md:grid-cols-4">
            {data.stats.map(([value, label]) => (
              <Card key={label} as="article">
                <p className="vy-h3 m-0 text-[19px] text-[color:var(--vy-ink)]">{value}</p>
                <p className="vy-label mt-[6px] text-[color:var(--vy-ink-3)]">{label}</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Situation / Operational problem / Before Vyso ─────────────────── */}
      <Section
        id="before"
        eyebrow="Before Vyso"
        heading="What the operation looked like."
        divider
      >
        <div className="grid grid-cols-1 gap-[28px] lg:grid-cols-2 lg:gap-[40px]">
          <div className="flex flex-col gap-[18px]">
            <div>
              <p className="vy-label text-[color:var(--vy-ink-3)]">Industry</p>
              <p className="vy-body mt-[6px] text-[color:var(--vy-ink-2)]">{data.industry}</p>
            </div>
            <div>
              <p className="vy-label text-[color:var(--vy-ink-3)]">Situation</p>
              <p className="vy-body mt-[6px] text-[color:var(--vy-ink-2)] text-pretty">
                {data.situation}
              </p>
            </div>
            <div>
              <p className="vy-label text-[color:var(--vy-ink-3)]">Operational problem</p>
              <p className="vy-body mt-[6px] text-[color:var(--vy-ink-2)] text-pretty">
                {data.problem}
              </p>
            </div>
          </div>
          <Card as="article" padding="lg">
            <p className="vy-label text-[color:var(--vy-ink-3)]">Before Vyso</p>
            <ul className="m-0 mt-[14px] flex list-none flex-col gap-[12px] p-0">
              {data.before.map((line) => (
                <li key={line} className="flex gap-[12px] text-[14.5px] leading-[1.6] text-[color:var(--vy-ink-2)]">
                  <span
                    aria-hidden="true"
                    className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--vy-ink-4)]"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      {/* ── What Vyso built ────────────────────────────────────────────────── */}
      <Section
        id="built"
        eyebrow="What Vyso built"
        heading={data.builtIntro}
        divider
      >
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2">
          {data.capabilities.map((capability, i) => (
            <Reveal as="li" key={capability.title} delay={stagger(i)}>
              <Card as="article" padding="lg" className="h-full">
                <h3 className="vy-h3 text-[18px] text-[color:var(--vy-ink)]">{capability.title}</h3>
                <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)]">{capability.copy}</p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* ── How the automation works ───────────────────────────────────────── */}
      {data.demo ? (
        <Section
          id="how-it-works"
          eyebrow={data.howItWorksEyebrow}
          heading={data.howItWorksHeading}
          lead={data.howItWorksCopy}
          divider
        >
          <Reveal>{data.demo}</Reveal>
        </Section>
      ) : null}

      {/* ── Proactive outcomes ─────────────────────────────────────────────── */}
      <Section
        id="outcomes"
        eyebrow="What this reinforces"
        heading={data.outcomesIntro}
        divider
      >
        <ul className="m-0 flex list-none flex-col gap-[14px] p-0">
          {data.outcomes.map((line) => (
            <li key={line} className="flex gap-[12px] text-[15px] leading-[1.6] text-[color:var(--vy-ink-2)]">
              <span
                aria-hidden="true"
                className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--vy-accent)]"
              />
              {line}
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <Section id="results" eyebrow="Results" heading="What we can already say." divider>
        <Card as="article" padding="lg">
          <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
            {data.results.map((result) => (
              <li key={result} className="vy-body text-[color:var(--vy-ink-2)]">
                {result}
              </li>
            ))}
          </ul>
          <p className="vy-label mt-[16px] border-t border-[color:var(--vy-line)] pt-[14px] text-[10px] text-[color:var(--vy-ink-3)]">
            {data.resultsNote}
          </p>
        </Card>

        {data.quote ? (
          <div className="mt-[40px] text-center">
            <p aria-hidden="true" className="vy-display m-0 mb-[8px] text-[40px] leading-none text-[color:var(--vy-line-2)]">
              &ldquo;
            </p>
            <p className="vy-h3 mx-auto max-w-[640px] text-[color:var(--vy-ink)] text-pretty">
              {data.quote.text}
            </p>
            <p className="vy-label mt-[16px] text-[color:var(--vy-ink-3)]">{data.quote.byline}</p>
            <p className="vy-small mx-auto mt-[6px] max-w-[460px] text-[color:var(--vy-ink-3)]">
              {data.quote.note}
            </p>
          </div>
        ) : null}
      </Section>

      {/* ── Close ───────────────────────────────────────────────────────────── */}
      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="What's costing your business time?"
        lead="Every roadmap starts with the same free audit Turn ’n Slice started with."
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "case-study" }}
          >
            Get a free Operations Audit
          </Button>
          <Button href="/case-studies" variant="secondary" size="lg">
            See more case studies
          </Button>
        </div>
      </Section>
    </>
  );
}

export default CaseTemplate;
