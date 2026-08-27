import Link from "next/link";

import type { Industry } from "@/lib/marketing/industries";
import { Pill } from "@/components/vyso/Card";

/* ── The hub card ─────────────────────────────────────────────────────────────
   `/industries`'s three cards. Each one leads with the vertical's own example
   finding rather than a generic description, because that one sentence is
   the fastest way to tell a food distributor and a hospitality group apart. */

export function IndustryCard({ industry }: { industry: Industry }) {
  return (
    <Link
      href={`/industries/${industry.slug}`}
      className="group flex flex-col rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] p-[24px] transition-colors duration-150 hover:border-[color:var(--vy-line-2)] lg:p-[28px]"
    >
      <Pill className="self-start">{industry.shortName}</Pill>
      <p className="vy-h3 mt-[16px] text-[color:var(--vy-ink)]">{industry.cardFinding}</p>
      <p className="vy-small mt-[10px] text-[color:var(--vy-ink-3)]">
        {industry.cardAgents.join(" · ")}
      </p>
      <span className="mt-auto inline-flex items-center gap-[6px] pt-[20px] text-[14px] font-medium text-[color:var(--vy-ink-2)] transition-colors duration-150 group-hover:text-[color:var(--vy-ink)]">
        See the {industry.singular} page
        <span aria-hidden="true" className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]">
          →
        </span>
      </span>
    </Link>
  );
}

export default IndustryCard;
