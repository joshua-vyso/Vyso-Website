import Link from "next/link";

import { FindingCard } from "@/components/finch/FindingCard";
import type { Crumb, FindingExample } from "@/lib/marketing/compare";

import { Breadcrumb } from "./CompareBits";

/* ── The hero every page in this cluster opens with ──────────────────────────
   The homepage hero's grid (1.05fr / 0.95fr, 64px gutter) with the page's one
   FindingCard where the homepage puts its own. The `answer` is the direct
   answer §4 asks for: ≤ 45 words, first thing under the `<h1>`, complete on its
   own — that paragraph is what an answer engine lifts.

   Server component; only the finding card hydrates, and only for its tilt.   */

export function CompareHero({
  trail,
  eyebrow,
  title,
  answer,
  example,
  secondary,
}: {
  trail:      readonly Crumb[];
  eyebrow:    string;
  title:      string;
  answer:     string;
  /** The page's one FindingCard. Omitted on the hub, which has three cards of
      its own and would otherwise open with four. */
  example?:   FindingExample;
  secondary:  Crumb;
}) {
  return (
    <header
      className={
        "mx-auto grid max-w-[1160px] grid-cols-1 items-start gap-[40px] px-[20px] pt-[32px] lg:gap-[64px] lg:px-[40px] lg:pt-[56px] " +
        (example ? "lg:grid-cols-[1.05fr_0.95fr]" : "")
      }
    >
      <div>
        <Breadcrumb trail={trail} />

        <div
          className="mb-[22px] h-[3px] w-[44px] rounded-[2px] lg:mb-[28px] lg:w-[52px]"
          style={{ background: "var(--fn-grad)" }}
        />

        <div className="mb-[16px] font-fn-mono text-[10px] leading-[1.6] tracking-[0.14em] text-fn-muted lg:mb-[20px] lg:text-[11px]">
          {eyebrow}
        </div>

        <h1 className="m-0 mb-[18px] max-w-[720px] font-fn-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[46px] lg:leading-[1.06] lg:tracking-[-0.025em] xl:text-[50px]">
          {title}
        </h1>

        <p className="m-0 mb-[28px] max-w-[560px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:mb-[34px] lg:text-[16.5px]">
          {answer}
        </p>

        <div className="flex flex-wrap items-center gap-[14px]">
          <Link
            href="/operations-audit"
            className="rounded-[10px] bg-fn-orange-cta px-[22px] py-[13px] text-[15px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white"
          >
            Book your audit
          </Link>
          <Link
            href={secondary.href}
            className="rounded-[10px] border border-fn-line px-[22px] py-[13px] text-[15px] font-medium text-fn-ink-2 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-ink"
          >
            {secondary.label}
          </Link>
        </div>
      </div>

      {example ? (
        <div>
          <FindingCard
            agent={example.agent}
            observation={example.observation}
            impact={example.impact}
            evidence={example.evidence}
            meta={example.meta}
            actions={[...example.actions]}
            className="w-full max-w-[460px]"
          />
          <p className="m-0 mt-[18px] max-w-[460px] text-[14px] leading-[1.6] text-fn-ink-3 text-pretty">
            {example.lead}
          </p>
          <div className="mt-[12px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
            {example.note}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default CompareHero;
