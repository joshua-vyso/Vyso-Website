import Link from "next/link";

import { SOLUTIONS, type Solution } from "@/lib/marketing/solutions";

import { AgentChipRow } from "./SolutionBits";

/* ── The four solution cards ─────────────────────────────────────────────────
   Used twice: as the hub's grid, and on each detail page as its "related
   problems" row (§7.5 wants every spoke linking sideways to its siblings).
   Server component — the whole card is one `<Link>`, so it needs no JS.      */

function Card({ solution }: { solution: Solution }) {
  return (
    <Link
      href={`/solutions/${solution.slug}`}
      className="group flex h-full flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[26px] transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-[2px] hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)]"
    >
      <h3 className="m-0 mb-[10px] font-fn-serif text-[20px] font-medium leading-[1.25] tracking-[-0.015em] text-fn-ink">
        {solution.name}
      </h3>
      <p className="m-0 mb-[20px] text-[14.5px] leading-[1.55] text-fn-ink-3 text-pretty">
        {solution.summary}
      </p>
      <div className="mt-auto">
        <AgentChipRow agents={solution.agents} />
        <span className="mt-[16px] flex items-center gap-[7px] border-t border-fn-line-2 pt-[13px] text-[13.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
          What Finch does about it
          <span
            aria-hidden="true"
            className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export function SolutionCards({ slugs }: { slugs: readonly string[] }) {
  return (
    <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
      {slugs.map((slug) => (
        <Card key={slug} solution={SOLUTIONS[slug]} />
      ))}
    </div>
  );
}

export default SolutionCards;
