import Link from "next/link";

import { Shell } from "@/components/vyso/Shell";

/* ── The legal reading layout ────────────────────────────────────────────────
   Shared by `/privacy`, `/terms` and `/popia` — a plain reading column
   instead of a bespoke panel. No blur, no gradient — legal copy is the one
   place on the site where the design should get out of the way.

   `.ai/plan_vyso_redesign_2026.md` §7.6: chrome swap only. `Shell` replaces
   `FinchNav`/`FinchFooter` (`active="none"`, per plan §5: none of these three
   pages is a nav item, and the footer's Legal column is the only place they
   are linked from) and the reading column itself moved from `--fn-*` tokens
   to `--vy-*`. Every word of the policy text in the three page files is
   untouched. */

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <Shell active="none">
      <div className="mx-auto max-w-[720px] px-[20px] pt-[56px] pb-[96px] lg:px-[40px] lg:pt-[88px] lg:pb-[130px]">
        {children}
      </div>
    </Shell>
  );
}

/** The mono `DRAFT · UNDER LEGAL REVIEW` chip — `/terms` and `/popia` only.
    `/privacy` carries none: its text is the real, current policy. */
export function DraftChip() {
  return (
    <span className="vy-label inline-flex shrink-0 items-center rounded-[10px] border border-[color:var(--vy-line-2)] bg-[color:var(--vy-surface-2)] px-[9px] py-[4px] text-[color:var(--vy-ink-2)]">
      DRAFT · UNDER LEGAL REVIEW
    </span>
  );
}

export function LegalHeader({
  eyebrow,
  title,
  meta,
  chip,
}: {
  eyebrow: string;
  title: string;
  /** e.g. "Effective date: 22 July 2026" — plain text under the h1. */
  meta?: string;
  chip?: React.ReactNode;
}) {
  return (
    <header className="mb-[44px]">
      <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
        <p className="vy-label m-0 text-[color:var(--vy-ink-3)]">{eyebrow}</p>
        {chip}
      </div>
      <h1 className="vy-h2 m-0 mb-[14px] text-[color:var(--vy-ink)]">{title}</h1>
      {meta ? <p className="m-0 text-[14.5px] text-[color:var(--vy-ink-3)]">{meta}</p> : null}
    </header>
  );
}

/** One numbered/titled block of reading copy. The `prose`-style child
    selectors keep every section's markup to plain `<p>`/`<ul>`/`<a>` — the
    verbatim legal text never needs a bespoke class of its own. `id`, when
    given, makes the section a deep-link target (e.g. `/privacy#…` from the
    `/popia` page's cross-reference) — `scroll-mt` clears the sticky nav. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-[100px] border-t border-[color:var(--vy-line)] py-[26px] first:border-t-0 first:pt-0"
    >
      <h2 className="m-0 mb-[12px] text-[20px] font-medium leading-[1.3] tracking-[-0.01em] text-[color:var(--vy-ink)] lg:text-[22px]">
        {title}
      </h2>
      <div
        className="text-[17px] leading-[1.75] text-[color:var(--vy-ink-3)] [&_a]:font-medium [&_a]:text-[color:var(--vy-ink)] [&_a]:underline [&_a]:decoration-[color:var(--vy-line-2)] [&_a]:underline-offset-2 [&_a:hover]:decoration-[color:var(--vy-ink-2)]
          [&_p]:m-0 [&_p+p]:mt-[14px]
          [&_ul]:m-0 [&_ul]:mt-[12px] [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-[8px] [&_ul]:pl-[22px]"
      >
        {children}
      </div>
    </section>
  );
}

/** Footer-of-document pointer between the three legal pages, so a reader who
    lands on one can find the other two without going back to the site footer. */
export function LegalCrossLinks({ current }: { current: "privacy" | "terms" | "popia" }) {
  const links: { href: string; label: string; key: "privacy" | "terms" | "popia" }[] = [
    { href: "/privacy", label: "Privacy Policy", key: "privacy" },
    { href: "/terms", label: "Terms", key: "terms" },
    { href: "/popia", label: "POPIA & PAIA", key: "popia" },
  ];

  return (
    <nav
      aria-label="Legal pages"
      className="mt-[8px] flex flex-wrap gap-x-[18px] gap-y-[6px] border-t border-[color:var(--vy-line)] pt-[24px]"
    >
      {links
        .filter((l) => l.key !== current)
        .map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[13.5px] font-medium text-[color:var(--vy-ink-2)] underline decoration-[color:var(--vy-line-2)] underline-offset-2 transition-colors duration-150 hover:text-[color:var(--vy-ink)] hover:decoration-[color:var(--vy-ink-2)]"
          >
            {l.label} →
          </Link>
        ))}
    </nav>
  );
}
