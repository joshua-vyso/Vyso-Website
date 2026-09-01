import Link from "next/link";

import { SiteFooter, SiteNav } from "@/components/site/SiteChrome";

/* ── The legal reading layout ────────────────────────────────────────────────
   Shared by `/privacy`, `/terms` and `/popia` — a plain reading column (STIX
   headings, 17px/1.75 body, max-w 720) instead of the old WebGL-backed glass
   panel `/privacy` used before this pass. No blur, no gradient — legal copy
   is the one place on the site where the design should get out of the way.

   Chrome comes from the agency shell (`SiteNav`/`SiteFooter`); the reading
   column keeps its own `fn-*` typography tokens, which remain defined in
   `globals.css`. */

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="vy-site finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <SiteNav />
      <main id="main" className="mx-auto max-w-[720px] px-[20px] pt-[120px] pb-[96px] lg:px-[40px] lg:pt-[150px] lg:pb-[130px]">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** The mono `DRAFT · UNDER LEGAL REVIEW` chip — `/terms` and `/popia` only.
    `/privacy` carries none: its text is the real, current policy. */
export function DraftChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] border border-fn-orange-tint bg-[#FDF3EA] px-[9px] py-[4px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-orange-deep">
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
        <p className="m-0 font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">{eyebrow}</p>
        {chip}
      </div>
      <h1 className="m-0 mb-[14px] font-fn-serif text-[38px] font-medium leading-[1.05] tracking-[-0.02em] lg:text-[50px]">
        {title}
      </h1>
      {meta ? <p className="m-0 text-[14.5px] text-fn-ink-3">{meta}</p> : null}
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
    <section id={id} className="scroll-mt-[100px] border-t border-fn-line py-[26px] first:border-t-0 first:pt-0">
      <h2 className="m-0 mb-[12px] font-fn-serif text-[20px] font-medium tracking-[-0.01em] text-fn-ink lg:text-[22px]">
        {title}
      </h2>
      <div
        className="text-[17px] leading-[1.75] text-fn-ink-3 [&_a]:font-medium [&_a]:text-fn-orange-deep [&_a]:underline [&_a]:decoration-fn-line-3 [&_a]:underline-offset-2 [&_a:hover]:decoration-fn-orange-deep
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
    <nav aria-label="Legal pages" className="mt-[8px] flex flex-wrap gap-x-[18px] gap-y-[6px] border-t border-fn-line pt-[24px]">
      {links
        .filter((l) => l.key !== current)
        .map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[13.5px] font-medium text-fn-ink-2 underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
          >
            {l.label} →
          </Link>
        ))}
    </nav>
  );
}
