import { Band } from "@/components/finch/ground/Band";
import { WaveClockProvider } from "@/components/finch/ground/wave-clock";
import { WaveField } from "@/components/finch/ground/WaveField";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
/* From the plain module, not from `Statement.tsx`: this is a server
   component, and every export of a `"use client"` module reaches one as an
   opaque client reference. See `text/statement-class.ts`. */
import { STATEMENT_CLASS } from "@/components/finch/text/statement-class";
import { WaveText } from "@/components/finch/text/WaveText";

import { PRICE } from "./audit-content";

/* ── "R2,000. Credited. Whether you sign or not." ────────────────────────────
   The page's ink band and the only place it raises its voice. §4.1's
   wave-riding type: eleven orange sine lines and a Statement whose words take
   their `y` from the same equation the canvas draws with, at 5px instead of 18
   — one `WaveClockProvider` above both is what makes it the *same* wave rather
   than two that drift apart within seconds.

   Three lines, one per sentence, each its own `WaveText`. Per-word phase is a
   function of x, and all three lines start at the same x, so the crest crosses
   them as one front travelling left to right rather than three independent
   wobbles. The middle line is italic — the plan's emphasis, and the word the
   whole offer turns on.

   The number is not restated here: `PRICE.audit` is the same constant the
   Service schema's `estimatedCost` reads, so the Statement and the structured
   data cannot say different things.

   Grain comes free with the ink ground (`Band`). One device, and `WaveText` is
   the second moving thing — nothing else on this band moves.                  */

const rand = (value: number) => `R${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export function AuditStatement() {
  return (
    <WaveClockProvider amplitude={18}>
      <Band
        ground="ink"
        /* Same seam as the blue band above: a 24px-radius slab laid 48px over
           the paper section. The air above it is `AuditTools`' bottom padding. */
        seam
        device={
          /* 0.28 for the same measured reason as the blue band's grid: an
             orange line crossing under the 11px mono eyebrow took it to 3.1:1.
             Still inside §2's 20–35% for orange on ink. */
          <WaveField lines={11} amplitude={18} color="--fn-orange" opacity={0.28} />
        }
      >
        <div className="max-w-[860px]">
          <div className="mb-[24px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-ink-mono lg:mb-[32px] lg:text-[11px]">
            WHAT YOU ARE ACTUALLY BUYING
          </div>

          <h2 className={STATEMENT_CLASS + " m-0 text-fn-ink-text"}>
            <span className="block">
              <WaveText>{`${rand(PRICE.audit)}.`}</WaveText>
            </span>
            <span className="block italic">
              <WaveText>Credited.</WaveText>
            </span>
            <span className="block">
              <WaveText>Whether you sign or not.</WaveText>
            </span>
          </h2>

          <div className="mt-[28px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-ink-mono lg:mt-[38px] lg:text-[11px]">
            ONE WEEK · IN RAND · WITH THE EVIDENCE
          </div>

          <p className="m-0 mt-[20px] max-w-[560px] text-[15px] leading-[1.65] text-fn-ink-text-2 text-pretty lg:text-[15.5px]">
            The report is yours either way — the findings, the rand figures and the
            evidence behind them. If you go ahead, the {rand(PRICE.audit)} comes off
            your first month.
          </p>

          <div className="mt-[32px] lg:mt-[40px]">
            {/* An in-page hash, so a plain anchor rather than a route change.
                Lenis runs with `anchors: false`, which means it never
                intercepts the click and the browser's own instant jump stands;
                `#book`'s `scroll-mt` is what stops it landing under the nav. */}
            <MagneticButton
              href="#book"
              tone="dark"
              event="book_audit_click"
              eventProps={{ page: "audit-statement" }}
            >
              Book your audit
            </MagneticButton>
          </div>
        </div>
      </Band>
    </WaveClockProvider>
  );
}

export default AuditStatement;
