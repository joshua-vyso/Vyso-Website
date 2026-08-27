import Link from "next/link";

import type { RelatedLink } from "@/lib/marketing/solutions";

/* ── Small shared pieces for /solutions ──────────────────────────────────────
   Server components, all of them: nothing here needs state, and keeping them
   off the client boundary means the only JavaScript the hub ships is the
   symptom checklist itself.                                                   */

/** Mono trail above every `<h1>` in this tree. The schema twin lives in
    `solutions-jsonld.ts`; this is the visible half of the same claim. */
export function Breadcrumb({ trail }: { trail: readonly RelatedLink[] }) {
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

/** The mono eyebrow every section header in this tree opens with. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
      {children}
    </div>
  );
}

/** The honesty chip. Same three states as `.ai/vyso_v2.md` §4 — the label is
    the status verbatim, so a roadmap agent can never read as shipped. */
export function StatusChip({ status }: { status: string }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-[99px] border border-fn-line px-[9px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-muted">
      {status}
    </span>
  );
}

/* `AgentChipRow` and `AgentList` (agent-roster chips typed against the old
   `lib/marketing/solutions.ts`'s `SolutionAgent`) were removed here: Phase 2c
   of `.ai/plan_vyso_redesign_2026.md` rewrote that file's `Solution` type
   without an `agents` field (the redesign has no "agent roster" concept —
   see that file's header), which orphaned both functions. Neither had a
   second importer (`components/finch/industries/IndustryBits.tsx` defines
   its OWN, differently-shaped `AgentChipRow` locally, and never imported
   this one) — confirmed by grep before removal, same rule plan §10 applies
   to `components/finch/*` deletions in general. */

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
