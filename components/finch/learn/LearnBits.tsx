import Link from "next/link";

import { FindingCard } from "@/components/vyso/demo/FindingCard";
import { getGlossaryTerm } from "@/lib/marketing/glossary";
import type { ArticleAgent, ArticleFinding, ArticleSource, LearnArticle } from "@/lib/marketing/learn-articles";
import { LEARN_CATEGORIES, type LearnCategory } from "@/lib/marketing/learn-articles";
import { SITE } from "@/lib/marketing/site";

/* ── Shared pieces for /learn, /learn/glossary and /resources ────────────────
   All server components. `FindingCard` (see its own header) dropped its
   pointer-tilt going from the Finch original to the Vyso one, so the reading-
   progress hairline and the TOC's current-heading highlight are the only
   client islands left in this tree, listed here so the boundary is visible in
   one place.

   `.ai/plan_vyso_redesign_2026.md` §7.6: chrome swap. This file used to import
   `Breadcrumb`, `Eyebrow`, `StatusChip` and `ArrowLink` from
   `components/finch/solutions/SolutionBits` (Finch chrome, `--fn-*` tokens).
   That file is still live for `/compare` (Phase 4's job, not this one), so
   rather than repaint it and risk moving `/compare` too, this file now carries
   its own small `--vy-*` equivalents below. It is the only tree that used
   them, so there is no second copy to keep in step. `FindingCard` moved to
   `components/vyso/demo/FindingCard`, which already replaces
   `components/finch/FindingCard` for every new surface. */

export const SECTION = "mx-auto max-w-[1160px] px-[var(--vy-gutter)] pt-[72px] lg:px-[40px] lg:pt-[110px]";
export const H2 = "vy-h2 m-0 mb-[16px] text-[color:var(--vy-ink)]";
export const LEAD = "vy-body m-0 max-w-[620px] text-[color:var(--vy-ink-3)]";

/** The reading column, shared with the legal pages. */
export const READING_COLUMN = "max-w-[720px]";

/** Mono trail above every `<h1>` in this tree. */
export function Breadcrumb({ trail }: { trail: readonly { label: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-[18px]">
      <ol className="vy-label m-0 flex list-none flex-wrap items-center gap-[7px] p-0 text-[color:var(--vy-ink-3)]">
        {trail.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-[7px]">
            {i > 0 ? <span className="text-[color:var(--vy-line-2)]">/</span> : null}
            {i === trail.length - 1 ? (
              <span aria-current="page" className="text-[color:var(--vy-ink-3)]">
                {crumb.label.toUpperCase()}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors duration-150 hover:text-[color:var(--vy-ink)]"
              >
                {crumb.label.toUpperCase()}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The mono eyebrow every section header in this tree opens with. Local copy
    of the one pattern `components/vyso/Section.tsx` inlines per-caller: this
    tree builds its own headers by hand (see the note above), so it needs the
    same one-liner in a reusable form. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="vy-label mb-[14px] text-[color:var(--vy-ink-3)]">{children}</div>;
}

/** The honesty chip. Same three states as the plan's roadmap language — the
    label is the status verbatim, so a roadmap capability can never read as
    shipped. */
export function StatusChip({ status }: { status: string }) {
  return (
    <span className="vy-label shrink-0 whitespace-nowrap rounded-[var(--vy-radius-pill)] border border-[color:var(--vy-line)] px-[9px] py-[3px] text-[color:var(--vy-ink-3)]">
      {status}
    </span>
  );
}

/** The quiet arrow link used everywhere a section points somewhere else. */
export function ArrowLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={
        "group inline-flex items-center gap-[7px] text-[14px] font-medium text-[color:var(--vy-ink-2)] transition-colors duration-150 hover:text-[color:var(--vy-ink)] " +
        className
      }
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
      >
        →
      </span>
    </Link>
  );
}

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
    "vy-label inline-block rounded-[var(--vy-radius-pill)] border px-[13px] py-[6px] transition-colors duration-150";
  const on = "border-[color:var(--vy-ink)] bg-[color:var(--vy-ink)] text-[color:var(--vy-bg)]";
  const off =
    "border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] text-[color:var(--vy-ink-3)] hover:border-[color:var(--vy-line-2)] hover:text-[color:var(--vy-ink)]";

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
        className="group flex h-full flex-col rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[22px] py-[22px] transition-colors duration-150 hover:border-[color:var(--vy-line-2)]"
      >
        <span className="vy-label mb-[12px] text-[color:var(--vy-ink-3)]">
          {article.category.toUpperCase()}
        </span>
        <h3 className="vy-h3 m-0 mb-[10px] text-[color:var(--vy-ink)]">{article.title}</h3>
        <p className="vy-small m-0 mb-[18px] text-[color:var(--vy-ink-3)] text-pretty">
          {article.description}
        </p>
        <span className="vy-label mt-auto text-[color:var(--vy-ink-3)]">
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
        className="group grid grid-cols-1 gap-[24px] rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[24px] py-[28px] transition-colors duration-150 hover:border-[color:var(--vy-line-2)] lg:grid-cols-[1fr_0.85fr] lg:gap-[48px] lg:px-[36px] lg:py-[36px]"
      >
        <div>
          <span className="vy-label mb-[14px] block text-[color:var(--vy-ink-3)]">
            START HERE · {article.category.toUpperCase()}
          </span>
          <h3 className="vy-h3 m-0 mb-[14px] text-pretty text-[color:var(--vy-ink)] lg:text-[28px]">
            {article.title}
          </h3>
          <p className="vy-body m-0 text-[color:var(--vy-ink-3)] text-pretty">{article.heroLead}</p>
        </div>
        <div className="flex flex-col justify-end">
          <p className="vy-small m-0 mb-[14px] text-[color:var(--vy-ink-2)] text-pretty">
            {article.description}
          </p>
          <span className="vy-label text-[color:var(--vy-ink-3)]">
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
    <aside className="rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[22px] py-[20px]">
      <div className="vy-label mb-[10px] text-[color:var(--vy-ink-3)]">WRITTEN BY</div>
      <div className="mb-[6px] text-[18px] font-medium tracking-[-0.015em] text-[color:var(--vy-ink)]">
        {SITE.founder.name}
      </div>
      <div className="vy-label mb-[12px] text-[color:var(--vy-ink-3)]">
        {SITE.founder.jobTitle.toUpperCase()}, {SITE.name.toUpperCase()} ·{" "}
        {SITE.address.addressLocality.toUpperCase()}
      </div>
      <p className="vy-small m-0 mb-[14px] text-[color:var(--vy-ink-3)] text-pretty">
        {SITE.description}
      </p>
      <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[6px]">
        <ArrowLink href="/operations-audit">Book an operations audit</ArrowLink>
        <span className="vy-label text-[color:var(--vy-ink-3)]">
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
    <section
      aria-labelledby="sources-heading"
      className="mt-[44px] border-t border-[color:var(--vy-line)] pt-[24px]"
    >
      <h2 id="sources-heading" className="vy-label m-0 mb-[14px] text-[color:var(--vy-ink-3)]">
        WHERE THE NUMBERS COME FROM
      </h2>
      <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
        {sources.map((source) => (
          <li key={source.label}>
            <div className="mb-[4px] text-[14px] font-semibold text-[color:var(--vy-ink)]">
              {source.label}
            </div>
            <p className="vy-small m-0 text-[color:var(--vy-ink-3)] text-pretty">{source.basis}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Related agents ───────────────────────────────────────────────────────────
   What Vyso would build against this article's problem, using the same
   worked-example vocabulary as `/solutions` and the homepage demo. No route
   named here: there is no single "agent roster" page any more (plan §5), so
   each row is illustrative text, not a link. */

export function ArticleAgents({ agents }: { agents: readonly ArticleAgent[] }) {
  return (
    <div>
      <Eyebrow>WHAT VYSO WOULD BUILD AGAINST THIS</Eyebrow>
      <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
        {agents.map((agent) => (
          <li key={agent.label}>
            <div className="flex flex-col rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[18px] py-[16px]">
              <span className="mb-[8px] flex flex-wrap items-center gap-[8px]">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[color:var(--vy-accent)]" />
                <span className="vy-label text-[color:var(--vy-ink-2)]">{agent.label}</span>
                <span className="ml-auto">
                  <StatusChip status={agent.status} />
                </span>
              </span>
              <span className="vy-small text-[color:var(--vy-ink-3)]">{agent.role}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="vy-small m-0 mt-[12px] text-[color:var(--vy-ink-3)] text-pretty">
        Examples. Your roster is set in the audit, in the order the findings justify.
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
              className="inline-block rounded-[var(--vy-radius-pill)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[13px] py-[6px] text-[13.5px] text-[color:var(--vy-ink-3)] transition-colors duration-150 hover:border-[color:var(--vy-line-2)] hover:text-[color:var(--vy-ink)]"
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
        source={finding.agent}
        observation={finding.observation}
        impact={finding.impact}
        evidence={finding.evidence}
        meta={finding.meta}
        actions={[...finding.actions]}
        className="max-w-none"
      />
      <div className="vy-label mt-[12px] text-right text-[color:var(--vy-ink-3)]">
        ILLUSTRATIVE EXAMPLE
      </div>
    </div>
  );
}
