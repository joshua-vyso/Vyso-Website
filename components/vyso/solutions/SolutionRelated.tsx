import Link from "next/link";

import { Pill } from "@/components/vyso/Card";
import { SOLUTIONS, type Solution } from "@/lib/marketing/solutions";

/* ── Where this page connects to ─────────────────────────────────────────────
   Plan §7.4 item 7: the case study (where relevant), one related learn
   article, and related solutions. All three read from `solution` itself
   rather than being typed out per page, so a related slug that stops existing
   is a compile error here (`SOLUTIONS[slug].shortName`) instead of a silent
   dead pill. */

export function SolutionRelated({ solution }: { solution: Solution }) {
  return (
    <div className="grid grid-cols-1 gap-[40px] md:grid-cols-2 md:gap-[56px]">
      <div>
        <h3 className="vy-label mb-[16px] text-[color:var(--vy-ink-3)]">Also worth a look</h3>
        <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
          {solution.related.map((slug) => (
            <li key={slug}>
              <Link href={`/solutions/${slug}`}>
                <Pill>{SOLUTIONS[slug].shortName}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="vy-label mb-[16px] text-[color:var(--vy-ink-3)]">Related reading</h3>
        <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
          <li>
            <Link
              href={solution.learnArticle.href}
              className="vy-body text-[color:var(--vy-ink-2)] underline decoration-[color:var(--vy-line-2)] underline-offset-4 transition-colors duration-150 hover:text-[color:var(--vy-ink)]"
            >
              {solution.learnArticle.label}
            </Link>
          </li>
          {solution.caseStudy ? (
            <li>
              <Link
                href="/case-studies/turn-n-slice"
                className="vy-body text-[color:var(--vy-ink-2)] underline decoration-[color:var(--vy-line-2)] underline-offset-4 transition-colors duration-150 hover:text-[color:var(--vy-ink)]"
              >
                How this looked at Turn &rsquo;n Slice, our first client
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export default SolutionRelated;
