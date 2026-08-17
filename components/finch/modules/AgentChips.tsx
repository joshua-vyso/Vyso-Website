import Link from "next/link";

/* "Used by" agent chips: mono label + the small orange dot the homepage's
   agent roster (`components/finch/WhatFinchWatches.tsx`,
   `components/finch/agents/AgentsOnShift.tsx`) uses for "this is an agent, at
   work" — orange is agent activity, which is exactly what this dot means
   here too. Every chip points at the same anchor, `/#agents`, per the plan.
   Server component: this is a plain link list, nothing here needs the
   client. */
export function AgentChips({ agents, className = "" }: { agents: readonly string[]; className?: string }) {
  if (agents.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-[8px] ${className}`}>
      {agents.map((agent) => (
        <Link
          key={agent}
          href="/#agents"
          className="inline-flex items-center gap-[6px] rounded-[99px] border border-fn-line bg-fn-surface px-[10px] py-[5px] font-fn-mono text-[10.5px] tracking-[0.08em] text-fn-ink-2 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
        >
          <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" aria-hidden="true" />
          {agent}
        </Link>
      ))}
    </div>
  );
}

export default AgentChips;
