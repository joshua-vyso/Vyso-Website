import Link from "next/link";

import { FindingCard } from "@/components/finch/FindingCard";
import { ArrowLink, Eyebrow, StatusChip } from "@/components/finch/solutions/SolutionBits";
import { getGlossaryTerm } from "@/lib/marketing/glossary";
import type { ArticleAgent, ArticleFinding, ArticleSource, LearnArticle } from "@/lib/marketing/learn-articles";
import { LEARN_CATEGORIES, type LearnCategory } from "@/lib/marketing/learn-articles";
import { SITE } from "@/lib/marketing/site";

/* ── Shared pieces for /learn, /learn/glossary and /resources ────────────────
   All server components. The only client code these three page trees load is
   `FindingCard` (its pointer tilt), the reading-progress hairline, the TOC's
   current-heading highlight and the resource cards' hover — four small
   islands, listed here so the boundary is visible in one place.

   `Breadcrumb`, `Eyebrow`, `StatusChip` and `ArrowLink` are imported from
   `components/finch/solutions/SolutionBits` rather than copied: they are the
   generic Finch chrome every rebuilt page uses, and a second copy would be a
   second thing to keep in step.                                              */

export const SECTION = "mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]";
export const H2 =
  "m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]";
export const LEAD = "m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 lg:text-[15.5px]";

/** The reading column. 720px is `.ai/vyso_v2.md` §2.3's figure for this tree
    and the legal pages reuse it. */
export const READING_COLUMN = "max-w-[720px]";

export function formatDate(iso: string): string {
  /* Explicit UTC: the server renders in the container's zone and the client in
     the reader's, and "6 July" flipping to "5 July" between the two is a
     hydration mismatch that only shows up for readers west of Greenwich. */
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Anchor id for a section heading — the TOC and the headings must agree, so
    both call this rather than each doing their own slugging. */
export function headingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── The category filter ──────────────────────────────────────────────────────
   Progressive enhancement in the literal sense: real links to real URLs, and
   the filtering happens on the server. No JavaScript, and every filtered view
   is linkable, shareable and crawlable. */

export function CategoryFilter({ active }: { active: LearnCategory | "All" }) {
  const chip =
    "inline-block rounded-[99px] border px-[13px] py-[6px] font-fn-mono text-[10.5px] tracking-[0.1em] transition-colors duration-150";
  const on = "border-fn-ink bg-fn-ink text-fn-bg";
  const off = "border-fn-line bg-fn-surface text-fn-ink-3 hover:border-fn-line-hover hover:text-fn-ink";

  return (
    <nav aria-label="Filter articles by category">
      <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
        <li>
          <Link
            href="/learn"
            aria-current={active === "All" ? "true" : undefined}
            className={`${chip} ${active === "All" ? on : off}`}
          >
            ALL
          </Link>
        </li>
        {LEARN_CATEGORIES.map((category) => (
          <li key={category}>
            <Link
              href={`/learn?category=${encodeURIComponent(category)}`}
              aria-current={active === category ? "true" : undefined}
              className={`${chip} ${active === category ? on : off}`}
            >
              {category.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Article cards ────────────────────────────────────────────────────────── */

export function ArticleCard({ article }: { article: LearnArticle }) {
  return (
    <article className="h-full">
      <Link
        href={`/learn/${article.slug}`}
        className="group flex h-full flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[22px] transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-[2px] hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)]"
      >
        <span className="mb-[12px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
          {article.category.toUpperCase()}
        </span>
        <h3 className="m-0 mb-[10px] font-fn-serif text-[20px] font-medium leading-[1.2] tracking-[-0.015em] text-fn-ink transition-colors duration-150 group-hover:text-fn-orange-deep">
          {article.title}
        </h3>
        <p className="m-0 mb-[18px] text-[14px] leading-[1.55] text-fn-ink-3 text-pretty">
          {article.description}
        </p>
        <span className="mt-auto font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
          {article.readingTime.toUpperCase()}
        </span>
      </Link>
    </article>
  );
}

/** The one featured article at the top of the hub: same card, wider, with the
    hero lead instead of the meta description. */
export function FeaturedArticle({ article }: { article: LearnArticle }) {
  return (
    <article>
      <Link
        href={`/learn/${article.slug}`}
        className="group grid grid-cols-1 gap-[24px] rounded-[12px] border border-fn-line bg-fn-surface px-[24px] py-[28px] transition-[border-color,box-shadow] duration-200 ease-out hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)] lg:grid-cols-[1fr_0.85fr] lg:gap-[48px] lg:px-[36px] lg:py-[36px]"
      >
        <div>
          <span className="mb-[14px] block font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
            START HERE · {article.category.toUpperCase()}
          </span>
          <h3 className="m-0 mb-[14px] font-fn-serif text-[26px] font-medium leading-[1.15] tracking-[-0.02em] text-pretty transition-colors duration-150 group-hover:text-fn-orange-deep lg:text-[32px]">
            {article.title}
          </h3>
          <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3 text-pretty lg:text-[15.5px]">
            {article.heroLead}
          </p>
        </div>
        <div className="flex flex-col justify-end">
          <p className="m-0 mb-[14px] text-[14px] leading-[1.55] text-fn-ink-2 text-pretty">
            {article.description}
          </p>
          <span className="font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
            {article.readingTime.toUpperCase()} · {formatDate(article.datePublished).toUpperCase()}
          </span>
        </div>
      </Link>
    </article>
  );
}

/* ── The author box ───────────────────────────────────────────────────────────
   §7.4 asks for the same one-line entity description everywhere it appears,
   so this reads `SITE.description` rather than re-writing it. No photo and no
   bio facts: `lib/marketing/site.ts` carries name, title and city, and there
   is nothing else in the repo that could be stated without inventing it. */

export function AuthorBox({ dateModified }: { dateModified: string }) {
  return (
    <aside className="rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[20px]">
      <div className="mb-[10px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
        WRITTEN BY
      </div>
      <div className="mb-[6px] font-fn-serif text-[18px] font-medium tracking-[-0.015em]">
        {SITE.founder.name}
      </div>
      <div className="mb-[12px] font-fn-mono text-[10.5px] tracking-[0.08em] text-fn-ink-3">
        {SITE.founder.jobTitle.toUpperCase()}, {SITE.name.toUpperCase()} ·{" "}
        {SITE.address.addressLocality.toUpperCase()}
      </div>
      <p className="m-0 mb-[14px] text-[14px] leading-[1.6] text-fn-ink-3 text-pretty">
        {SITE.description}
      </p>
      <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[6px]">
        <ArrowLink href="/operations-audit">Book an operations audit</ArrowLink>
        <span className="font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
          UPDATED {formatDate(dateModified).toUpperCase()}
        </span>
      </div>
    </aside>
  );
}

/* ── Sources ──────────────────────────────────────────────────────────────────
   Rendered only where the article's own text names where a figure came from.
   Nothing on this site invents a citation to fill the block, so an article
   without a stated basis simply doesn't show one. */

export function SourcesBlock({ sources }: { sources: readonly ArticleSource[] }) {
  return (
    <section aria-labelledby="sources-heading" className="mt-[44px] border-t border-fn-line pt-[24px]">
      <h2 id="sources-heading" className="m-0 mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted">
        WHERE THE NUMBERS COME FROM
      </h2>
      <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
        {sources.map((source) => (
          <li key={source.label}>
            <div className="mb-[4px] text-[14px] font-semibold text-fn-ink">{source.label}</div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-fn-ink-3 text-pretty">{source.basis}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Related agents ───────────────────────────────────────────────────────────
   Links to `/finch#agents`, the homepage roster — the one place the agents are
   listed. Statuses are the §4 chips verbatim, so a roadmap agent can never
   read as shipped from inside an article. */

export function ArticleAgents({ agents }: { agents: readonly ArticleAgent[] }) {
  return (
    <div>
      <Eyebrow>THE AGENTS THAT WOULD WORK THIS</Eyebrow>
      <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
        {agents.map((agent) => (
          <li key={agent.label}>
            <Link
              href="/finch#agents"
              className="group flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[18px] py-[16px] transition-colors duration-150 hover:border-fn-line-hover"
            >
              <span className="mb-[8px] flex flex-wrap items-center gap-[8px]">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" />
                <span className="font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                  {agent.label}
                </span>
                <span className="ml-auto">
                  <StatusChip status={agent.status} />
                </span>
              </span>
              <span className="text-[13.5px] leading-[1.55] text-fn-ink-3">{agent.role}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-[12px] text-[12.5px] leading-[1.6] text-fn-muted text-pretty">
        Examples. Your roster is set in the audit, in the order the findings justify — document
        intelligence (Doc-U) is live today, Price Watch is rolling out.
      </p>
    </div>
  );
}

/* ── Glossary chips ───────────────────────────────────────────────────────────
   §7.5: every article links to at least one glossary term. Unknown slugs are
   dropped rather than rendered as a dead link — the failure mode Phase 2 found
   nine times in the solutions data. */

export function TermChips({ slugs, label = "TERMS IN THIS ARTICLE" }: { slugs: readonly string[]; label?: string }) {
  const terms = slugs.map((slug) => getGlossaryTerm(slug)).filter((term) => term !== undefined);
  if (terms.length === 0) return null;

  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
        {terms.map((term) => (
          <li key={term.slug}>
            <Link
              href={`/learn/glossary/${term.slug}`}
              className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[13px] py-[6px] text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
            >
              {term.term}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── The captioned finding card ───────────────────────────────────────────────
   Every finding card outside the product carries a caption saying its rand
   figure is a worked example. Same caption text as the homepage hero and
   `/solutions`, so the qualification reads identically everywhere. */

export function IllustrativeFinding({
  finding,
  className = "max-w-[460px]",
}: {
  finding: ArticleFinding;
  className?: string;
}) {
  return (
    <div className={className}>
      <FindingCard
        agent={finding.agent}
        observation={finding.observation}
        impact={finding.impact}
        evidence={finding.evidence}
        meta={finding.meta}
        actions={[...finding.actions]}
        className="max-w-none"
      />
      <div className="mt-[12px] text-right font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
        ILLUSTRATIVE EXAMPLE
      </div>
    </div>
  );
}
