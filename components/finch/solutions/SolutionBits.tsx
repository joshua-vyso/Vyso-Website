import Link from "next/link";

import type { RelatedLink, SolutionAgent } from "@/lib/marketing/solutions";

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

/** Compact agent chips for the hub's solution cards — label only, no link (the
    whole card is already one). */
export function AgentChipRow({ agents }: { agents: readonly SolutionAgent[] }) {
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {agents.map((agent) => (
        <span
          key={agent.label}
          className="inline-flex items-center gap-[6px] rounded-[99px] border border-fn-line-2 bg-fn-bg px-[9px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-ink-3"
        >
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-fn-orange" />
          {agent.label}
        </span>
      ))}
    </div>
  );
}

/** The full agent row used by "How Finch fixes it": a link to the roster on
    `/finch#agents`, the job this agent does for *this* problem, and its status. */
export function AgentList({ agents }: { agents: readonly SolutionAgent[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-[12px] p-0 md:grid-cols-2">
      {agents.map((agent) => (
        <li key={agent.label}>
          <Link
            href="/finch#agents"
            className="group flex h-full flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[18px] transition-colors duration-150 hover:border-fn-line-hover"
          >
            <span className="mb-[10px] flex items-center gap-[8px]">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" />
              <span className="font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                {agent.label}
              </span>
              <span className="ml-auto">
                <StatusChip status={agent.status} />
              </span>
            </span>
            <span className="text-[14px] leading-[1.55] text-fn-ink-3">{agent.role}</span>
          </Link>
        </li>
      ))}
    </ul>
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
