import Link from "next/link";

/* ── Shared pieces for the /industries cluster ───────────────────────────────
   Server components, all of them. The only JavaScript this tree ships is the
   finding deck (its fan, and the finding card's own pointer tilt) — everything
   else is markup and CSS.

   Deliberately a local copy of the breadcrumb / eyebrow / arrow-link idiom
   rather than an import from `components/finch/solutions/SolutionBits.tsx`,
   following the precedent `components/finch/compare/CompareBits.tsx` set in
   Phase 2: those take `/solutions`' own data types and belong to that page's
   data file. The shared contract is the visual one (`.ai/vyso_v2.md` §1), not
   a shared module.                                                            */

export type Crumb = { label: string; href: string };

/** Mono trail above every `<h1>` in this tree; twin of the `BreadcrumbList`. */
export function Breadcrumb({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-[18px]">
      <ol className="m-0 flex list-none flex-wrap items-center gap-[7px] p-0 font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-muted">
        {trail.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-[7px]">
            {i > 0 ? <span className="text-fn-line-3">/</span> : null}
            {i === trail.length - 1 ? (
              <span aria-current="page" className="text-fn-ink-3">
                {crumb.label.toUpperCase()}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors duration-150 hover:text-fn-orange-deep"
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

/** The mono eyebrow every section in this tree opens with. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
      {children}
    </div>
  );
}

/** The honesty chip — the §4 status verbatim, so a roadmap agent can never
    read as shipped. Also carries the hub's `EXPERIMENTAL` label. */
export function StatusChip({ status }: { status: string }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-[99px] border border-fn-line px-[9px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-muted">
      {status}
    </span>
  );
}

/** Agent labels as chips, for the hub cards. No links — the whole card is one. */
export function AgentChipRow({ labels }: { labels: readonly string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-[6px] rounded-[99px] border border-fn-line-2 bg-fn-bg px-[9px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-ink-3"
        >
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-fn-orange" />
          {label}
        </span>
      ))}
    </div>
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
        "group inline-flex items-center gap-[7px] text-[14px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep " +
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

/** The section frame: 110px desktop / 72 mobile gaps, eyebrow → STIX h2 → sub. */
export function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
      aria-labelledby={`${id}-heading`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={`${id}-heading`}
        className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]"
      >
        {title}
      </h2>
      {sub ? (
        <p className="m-0 mb-[32px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty lg:mb-[44px] lg:text-[15.5px]">
          {sub}
        </p>
      ) : null}
      {children}
    </section>
  );
}
