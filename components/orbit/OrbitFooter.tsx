import Image from "next/image";
import Link from "next/link";

import { WaveField } from "@/components/finch/ground/WaveField";
import { ORBIT } from "@/lib/orbit/site";
import { TRADES } from "@/lib/orbit/trades";
import { ORBIT_ARTICLES } from "@/lib/orbit/articles";

/* ── The Orbit footer ────────────────────────────────────────────────────────
   §8 of `.ai/vyso_v3_design.md`: the footer sits on ink with a **static** wave
   field behind it. Static, not looping — a footer is the last thing a reader
   scrolls to and an animation there is motion nobody asked for, playing below
   the fold of the content they came for.

   Three jobs beyond the links:

   - **The way back to Vyso.** Orbit is a subsite, not a separate company. The
     "Built on Vyso" column links to the root site, the case study and the
     platform, because a reader who wants to know whether this outfit is real
     should be one click from the answer.
   - **The trademark note.** Every page renders a hand-built chat screen, so
     every page needs `ORBIT.trademark` under it. Putting it here rather than
     under each phone means it appears exactly once per page, at the bottom,
     where a legal note belongs.
   - **The status line.** `ORBIT.status` again. A reader who has scrolled the
     whole page and is about to leave should not be able to think Orbit is a
     product they could buy today.                                             */

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Orbit",
    links: [
      ["How it works", "/orbit/how-it-works"],
      ["Pricing", "/orbit/pricing"],
      ["FAQ", "/orbit/faq"],
      ["Join Waitlist", "/orbit/waitlist"],
    ],
  },
  {
    title: "Compare",
    links: [
      ["Orbit vs job management apps", "/orbit/compare/orbit-vs-job-management-apps"],
      ["Orbit vs spreadsheets", "/orbit/compare/orbit-vs-spreadsheets"],
      ["Guides", "/orbit/learn"],
      ["By trade", "/orbit/for"],
    ],
  },
  {
    title: "Built on Vyso",
    links: [
      ["Vyso", "/"],
      ["The platform", "/platform/modules"],
      ["Case study: Turn 'n Slice", "/case-studies/turn-n-slice"],
      ["About Vyso", "/about"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["POPIA", "/popia"],
    ],
  },
];

export function OrbitFooter() {
  const year = new Date().getFullYear();

  return (
    <footer data-ground="ink" className="relative isolate overflow-hidden border-t border-ob-line bg-ob-bg-2">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <WaveField static lines={9} amplitude={18} color="--ob-blue" colorFallback="#0369FD" opacity={0.22} />
      </div>

      <div className="mx-auto max-w-[1160px] px-[20px] pt-[56px] pb-[36px] lg:px-[40px] lg:pt-[88px] lg:pb-[44px]">
        <div className="grid grid-cols-2 gap-[28px] md:grid-cols-4 md:gap-[40px]">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <div className="mb-[16px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
                {column.title}
              </div>
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[13.5px] text-ob-text-2 transition-colors duration-150 hover:text-fn-orange-on-ink"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* The ten trade pages, in full. A footer row rather than a hidden menu
            so every trade page is one hop from every other page — which is the
            whole internal-linking argument for having ten of them. */}
        <div className="mt-[40px] border-t border-ob-line-2 pt-[24px]">
          <div className="mb-[12px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
            Orbit by trade
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-x-[18px] gap-y-[8px] p-0">
            {TRADES.map((trade) => (
              <li key={trade.slug}>
                <Link
                  href={`/orbit/for/${trade.slug}`}
                  className="text-[13px] text-ob-text-2 transition-colors duration-150 hover:text-fn-orange-on-ink"
                >
                  {trade.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-[28px] border-t border-ob-line-2 pt-[24px]">
          <div className="mb-[12px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
            Guides
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-x-[18px] gap-y-[8px] p-0">
            {ORBIT_ARTICLES.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/orbit/learn/${article.slug}`}
                  className="text-[13px] text-ob-text-2 transition-colors duration-150 hover:text-fn-orange-on-ink"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-[40px] flex flex-wrap items-center gap-x-[20px] gap-y-[12px] border-t border-ob-line-2 pt-[26px]">
          <Image
            src="/orbit/orbit-primary-dark.svg"
            alt="Orbit"
            width={1200}
            height={425}
            className="block h-[22px] w-auto opacity-80"
          />
          <span className="text-[12.5px] text-ob-mono">{ORBIT.status}</span>
          <span className="ml-auto text-[12.5px] text-ob-mono">
            &copy; {year} Vyso · Johannesburg
          </span>
        </div>

        <p className="mt-[20px] max-w-[720px] text-[11.5px] leading-[1.6] text-ob-mono">
          {ORBIT.trademark}
        </p>
      </div>
    </footer>
  );
}

export default OrbitFooter;
