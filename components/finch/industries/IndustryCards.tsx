import Link from "next/link";

import { INDUSTRIES } from "@/lib/marketing/industries";

import { AgentChipRow, StatusChip } from "./IndustryBits";

/* ── The industry cards ──────────────────────────────────────────────────────
   Two shapes, because the two rows on the hub are not making the same claim.

   `IndustryCards` — the six primary verticals. Each card carries one example
   finding *in that vertical's words* (the line a reader recognises as their own
   week) and the agents behind it, so the grid reads as six different businesses
   rather than six labels on the same page.

   `ExperimentalCards` — the "Also watching" row. Deliberately quieter: smaller
   type, no agent chips, a mono `EXPERIMENTAL` chip, and the honest one-liner.
   This is the only place on the site these two are linked from (plus the
   sitemap) — not the nav, not the homepage, not the footer.

   Server components: the whole card is one `<Link>`, so neither ships JS.     */

function Card({ slug }: { slug: string }) {
  const industry = INDUSTRIES[slug];

  return (
    <Link
      href={`/industries/${slug}`}
      className="group flex h-full flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[26px] transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-[2px] hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)]"
    >
      <h3 className="m-0 mb-[12px] font-fn-serif text-[20px] font-medium leading-[1.25] tracking-[-0.015em] text-fn-ink">
        {industry.shortName}
      </h3>

      {/* The example finding, quoted rather than asserted: the blue rule is the
          evidence colour, and this line is what the evidence would say. */}
      <p className="m-0 mb-[20px] border-l-[2px] border-fn-blue-hl pl-[12px] text-[14.5px] leading-[1.55] text-fn-ink-2 text-pretty">
        {industry.cardFinding}
      </p>

      <div className="mt-auto">
        <AgentChipRow labels={industry.cardAgents} />
        <span className="mt-[16px] flex items-center gap-[7px] border-t border-fn-line-2 pt-[13px] text-[13.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
          What Finch watches
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

export function IndustryCards({ slugs }: { slugs: readonly string[] }) {
  return (
    <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-3">
      {slugs.map((slug) => (
        <Card key={slug} slug={slug} />
      ))}
    </div>
  );
}

function ExperimentalCard({ slug }: { slug: string }) {
  const industry = INDUSTRIES[slug];

  return (
    <Link
      href={`/industries/${slug}`}
      className="group flex h-full flex-col rounded-[10px] border border-fn-line bg-fn-bg px-[20px] py-[20px] transition-colors duration-200 ease-out hover:border-fn-line-hover"
    >
      <div className="mb-[10px] flex items-center gap-[10px]">
        <h3 className="m-0 font-fn-serif text-[17px] font-medium tracking-[-0.01em] text-fn-ink">
          {industry.shortName}
        </h3>
        <span className="ml-auto">
          <StatusChip status="EXPERIMENTAL" />
        </span>
      </div>
      <p className="m-0 text-[13.5px] leading-[1.55] text-fn-ink-3 text-pretty">
        {industry.cardFinding}
      </p>
      <span className="mt-[14px] flex items-center gap-[7px] text-[13px] font-medium text-fn-muted transition-colors duration-150 group-hover:text-fn-orange-deep">
        What Finch would watch
        <span
          aria-hidden="true"
          className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
        >
          →
        </span>
      </span>
    </Link>
  );
}

export function ExperimentalCards({ slugs }: { slugs: readonly string[] }) {
  return (
    <div className="grid max-w-[720px] grid-cols-1 gap-[16px] md:grid-cols-2">
      {slugs.map((slug) => (
        <ExperimentalCard key={slug} slug={slug} />
      ))}
    </div>
  );
}

export default IndustryCards;
