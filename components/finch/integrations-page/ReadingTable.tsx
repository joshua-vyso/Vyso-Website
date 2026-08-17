"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { INTEGRATION_DETAILS, type IntegrationDetail } from "@/lib/marketing/integrations";

/* ── The reading table ────────────────────────────────────────────────────────
   `/integrations`'s signature visual (unique to this page — not the orbit, not
   logos in a ring). A two-column ledger: one row per tool, and on enter each
   row's right-hand column animates in the fields Finch reads out of that tool
   as blue extracted mono text — the sequence's beat-2 "EXTRACTED" treatment
   (`ScrollSequence.tsx`'s `ExtractedRows`), but one line per tool instead of
   one card — followed by a small ink tick.

   Colour discipline draws the honesty line for free: blue + a tick only renders
   for a tool that is genuinely read today (CONNECTED IN ONBOARDING or LIMITED
   ROLLOUT); a ROADMAP row's field list stays plain ink with a hollow dot
   instead of a tick, because nothing has actually been extracted from it yet.
   Same rule as everywhere else on the site — "blue = extracted data only" —
   applied at the row level rather than asserted in a caption.

   Reveal mechanics copy `AgentsOnShift.tsx`'s rest/play idiom exactly: under
   reduced motion the row starts (and stays) at `play`, so the static render is
   a finished picture, never an empty one. */

const TICK_PATH = "M2.5 6.5 L5 9 L10.5 3";

function Row({ integration, index }: { integration: IntegrationDetail; index: number }) {
  const reduceMotion = useReducedMotion();
  const live = integration.status !== "ROADMAP";

  const rowMotion = reduceMotion
    ? ({ initial: "play" as const, animate: "play" as const })
    : ({
        initial: "rest" as const,
        whileInView: "play" as const,
        viewport: { once: true, amount: 0.6 },
        transition: { duration: 0.36, ease: "easeOut", delay: (index % 6) * 0.06 } as const,
      });

  return (
    <motion.div
      role="row"
      {...rowMotion}
      variants={{
        rest: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 },
        play: { opacity: 1, y: 0 },
      }}
      className="grid grid-cols-[minmax(0,108px)_1fr] items-start gap-[12px] border-b border-fn-line-2 py-[14px] last:border-b-0 lg:grid-cols-[200px_1fr] lg:items-center lg:gap-[28px] lg:py-[16px]"
    >
      <div role="cell" className="flex min-w-0 items-center gap-[8px] lg:gap-[10px]">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-fn-line bg-fn-surface">
          <Image
            src={`/finch/integrations/${integration.slug}.svg`}
            alt=""
            width={15}
            height={15}
            className="object-contain"
          />
        </span>
        <span className="truncate text-[14px] font-medium text-fn-ink lg:text-[15px]">
          {integration.name}
        </span>
      </div>

      <div role="cell" className="flex min-w-0 items-start gap-[10px]">
        <motion.span
          variants={{
            rest: { opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : -6 },
            play: { opacity: 1, x: 0, transition: { duration: 0.32, ease: "easeOut", delay: 0.12 } },
          }}
          className={
            "min-w-0 font-fn-mono text-[11.5px] leading-[1.5] lg:text-[12px] " +
            (live ? "text-fn-blue-deep" : "text-fn-muted")
          }
        >
          {integration.fields.join(" · ")}
        </motion.span>

        <motion.svg
          viewBox="0 0 13 13"
          width="13"
          height="13"
          aria-hidden="true"
          className="mt-[3px] shrink-0"
          variants={{
            rest: { opacity: 0, scale: 0.6 },
            play: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut", delay: 0.36 } },
          }}
        >
          {live ? (
            <path
              d={TICK_PATH}
              fill="none"
              stroke="#14120E"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <circle cx="6.5" cy="6.5" r="3" fill="none" stroke="#D8D3C6" strokeWidth="1.4" />
          )}
        </motion.svg>
      </div>
    </motion.div>
  );
}

export function ReadingTable() {
  return (
    <div
      role="table"
      aria-label="What Finch reads from each connected tool"
      className="rounded-[10px] border border-fn-line bg-fn-surface px-[18px] lg:px-[24px]"
    >
      <div
        role="row"
        className="grid grid-cols-[minmax(0,108px)_1fr] gap-[12px] border-b border-fn-line py-[12px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted lg:grid-cols-[200px_1fr] lg:gap-[28px]"
      >
        <span role="columnheader">TOOL</span>
        <span role="columnheader">WHAT FINCH READS</span>
      </div>
      <div role="rowgroup">
        {INTEGRATION_DETAILS.map((integration, i) => (
          <Row key={integration.slug} integration={integration} index={i} />
        ))}
      </div>
    </div>
  );
}

export default ReadingTable;
