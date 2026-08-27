import type { Metadata } from "next";
import Link from "next/link";

import { BirdHop } from "@/components/finch/BirdHop";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import {
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

const ACTIONS: [string, string][] = [
  ["Go home",              "/"],
  ["See how Finch works",  "/finch#agents"],
  ["Book your audit",      "/operations-audit"],
];

/* Next returns the 404 status for this file; the page only has to say so in the
   site's own voice. The finding card is the Finch atom, so a dead URL is
   reported the way every other observation is. */
export default function NotFound() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <FinchNav />
      <main className="mx-auto flex max-w-[1160px] flex-col items-center px-[20px] pt-[72px] pb-[96px] text-center lg:px-[40px] lg:pt-[120px] lg:pb-[140px]">
        <BirdHop className="mb-[24px]" />
        <div className="mb-[12px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
          404
        </div>
        <h1 className="m-0 mb-[36px] font-fn-serif text-[28px] tracking-[-0.02em] lg:text-[34px]">
          Page not found.
        </h1>

        <FindingCardFrame tilt={false} className="w-full max-w-[460px] text-left">
          <FindingHeader agent="PAGE WATCH" />
          <FindingObservation>
            This page doesn&rsquo;t exist — or it moved when we rebuilt around Finch.
          </FindingObservation>
          <FindingImpact>&asymp; R0 at stake</FindingImpact>
          <FindingEvidence evidence="1 URL" meta="404 · NOTHING TO RECOVER" />
          {/* The card's real actions: these are links, not the label-only row
              the illustrative cards use, so `FindingActions` is composed here. */}
          <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[4px] border-t border-fn-line-2 pt-[13px] max-[399px]:gap-x-[14px]">
            {ACTIONS.map(([label, href], i) => (
              <span key={href} className="inline-flex items-center gap-[6px]">
                {i > 0 ? (
                  <span className="text-[12px] text-fn-line-3 max-[399px]:hidden">·</span>
                ) : null}
                <Link
                  href={href}
                  className="rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium whitespace-nowrap text-fn-ink-2 transition-all duration-[120ms] hover:bg-[#F5F2EA] hover:text-fn-ink"
                >
                  {label}
                </Link>
              </span>
            ))}
          </div>
        </FindingCardFrame>
      </main>
      <FinchFooter />
    </div>
  );
}
