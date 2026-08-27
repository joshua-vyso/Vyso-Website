import Link from "next/link";

import { Card } from "@/components/vyso/Card";
import type { Solution } from "@/lib/marketing/solutions";

/* ── The hub's card ───────────────────────────────────────────────────────────
   One per solution on `/solutions`. Flat, bordered, no shadow (`Card`'s
   default — the system reserves its one ambient shadow for window chrome and
   the hero demo). The whole card is a link; `interactive` is what steps the
   hairline on hover so the click target reads as one. */

export function SolutionCard({ solution }: { solution: Solution }) {
  return (
    <Card as="li" padding="lg" interactive className="flex flex-col">
      <Link href={`/solutions/${solution.slug}`} className="flex flex-1 flex-col no-underline">
        <span className="vy-label text-[color:var(--vy-ink-4)]">{solution.eyebrow}</span>
        <h3 className="vy-h3 mt-[14px] text-[color:var(--vy-ink)]">{solution.name}</h3>
        <p className="vy-body mt-[10px] flex-1 text-[color:var(--vy-ink-3)] text-pretty">
          {solution.summary}
        </p>
        <span className="vy-small mt-[20px] inline-flex items-center gap-[8px] font-medium text-[color:var(--vy-ink-2)]">
          Read how
          <span aria-hidden="true" className="translate-y-[0.5px]">
            →
          </span>
        </span>
      </Link>
    </Card>
  );
}

export default SolutionCard;
