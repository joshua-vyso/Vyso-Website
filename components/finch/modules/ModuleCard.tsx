import Link from "next/link";
import type { MarketingModule } from "@/lib/marketing/modules";

import { AgentChips } from "./AgentChips";
import { StatusChip } from "./StatusChip";

/* The index grid card: "white, border, radius 10, name (STIX 20), one-line
   capability, 'used by' agent chips (mono), LIVE/status chip from the
   registry, arrow" — per the plan, verbatim. No screenshot thumbnail: the
   wiring diagram above already carries the page's one visual moment, and a
   ten-up grid of screenshots would compete with it rather than support it.

   The outer element is a plain `<div>`, not one card-sized `<a>`: the "used
   by" chips are themselves real links (to `/#agents`), and an anchor cannot
   contain another anchor — nesting them earlier produced a hydration error
   ("<a> cannot contain a nested <a>"). The module name and the footer row
   are each their own `Link` instead; `group`/`group-hover` still works off
   the outer `<div>`, which is all the hover treatment needs. */
export function ModuleCard({ module_ }: { module_: MarketingModule }) {
  const href = `/platform/modules/${module_.slug}`;

  return (
    <div className="group flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[24px] transition-colors duration-150 hover:border-fn-line-hover">
      <div className="mb-[10px] flex items-start justify-between gap-[12px]">
        <Link href={href} className="min-w-0">
          <h3 className="m-0 font-fn-serif text-[20px] font-medium tracking-[-0.01em] text-fn-ink transition-colors duration-150 group-hover:text-fn-orange-deep">
            {module_.name}
          </h3>
        </Link>
        <StatusChip status={module_.status} className="mt-[2px] shrink-0" />
      </div>

      <p className="m-0 mb-[16px] text-[13.5px] leading-[1.5] text-fn-ink-3">{module_.tagline}</p>

      <AgentChips agents={module_.agents} className="mb-[18px]" />

      <Link
        href={href}
        className="mt-auto flex items-center gap-[6px] border-t border-fn-line-2 pt-[14px] text-[13px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep"
      >
        Explore {module_.name}
        <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-[2px]">
          →
        </span>
      </Link>
    </div>
  );
}

export default ModuleCard;
