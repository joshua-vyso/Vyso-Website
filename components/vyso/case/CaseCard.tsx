import Link from "next/link";

import type { CaseStudyData } from "./CaseTemplate";

/* ── The case preview card ───────────────────────────────────────────────────
   `/case-studies`'s one entry today. Generic over `CaseStudyData` the same way
   `CaseTemplate` is, so the hub grows by adding a case study to the array it
   maps over, not by writing a new card. */

export function CaseCard({ data }: { data: CaseStudyData }) {
  return (
    <Link
      href={`/case-studies/${data.slug}`}
      className="group grid grid-cols-1 gap-[28px] rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] p-[24px] transition-colors duration-150 hover:border-[color:var(--vy-line-2)] lg:grid-cols-[240px_1fr] lg:items-center lg:gap-[40px] lg:p-[36px]"
    >
      <div className="flex items-center justify-center rounded-[var(--vy-radius)] bg-[color:var(--vy-surface-2)] p-[28px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed brand mark */}
        <img
          src={data.logoSrc}
          alt={data.logoAlt}
          width={200}
          height={200}
          className="h-auto w-full max-w-[180px]"
        />
      </div>
      <div>
        <p className="vy-label mb-[10px] text-[color:var(--vy-ink-4)]">{data.eyebrow}</p>
        <h3 className="vy-h3 mb-[10px] text-[color:var(--vy-ink)]">{data.h1}</h3>
        <p className="vy-body mb-[18px] max-w-[560px] text-[color:var(--vy-ink-3)] text-pretty">
          {data.lead}
        </p>
        <span className="inline-flex items-center gap-[6px] text-[14.5px] font-medium text-[color:var(--vy-ink-2)] transition-colors duration-150 group-hover:text-[color:var(--vy-ink)]">
          Read the full story
          <span aria-hidden="true" className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export default CaseCard;
