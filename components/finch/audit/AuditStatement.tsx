import { Band } from "@/components/finch/ground/Band";
import { WaveClockProvider } from "@/components/finch/ground/wave-clock";
import { WaveField } from "@/components/finch/ground/WaveField";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
/* From the plain module, not from `Statement.tsx`: this is a server
   component, and every export of a `"use client"` module reaches one as an
   opaque client reference. See `text/statement-class.ts`. */
import { STATEMENT_CLASS } from "@/components/finch/text/statement-class";
import { WaveText } from "@/components/finch/text/WaveText";

/* ── "Free. An hour. Whether you go ahead or not." ───────────────────────────
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

   `.ai/plan_home_only.md`, change 4: this band used to read "R2,000. Credited.
   Whether you sign or not." The audit is free, so the first line is the word
   that replaces the number and the second is the length rather than the
   credit. No amount appears on this page at all now, and none appears in the
   Service schema either beyond the zero-price `Offer` that states the audit
   is free.

   Grain comes free with the ink ground (`Band`). One device, and `WaveText` is
   the second moving thing — nothing else on this band moves.                  */

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
            WHAT THE HOUR IS ACTUALLY WORTH
          </div>

          <h2 className={STATEMENT_CLASS + " m-0 text-fn-ink-text"}>
            <span className="block">
              <WaveText>Free.</WaveText>
            </span>
            <span className="block italic">
              <WaveText>An hour.</WaveText>
            </span>
            <span className="block">
              <WaveText>Whether you go ahead or not.</WaveText>
            </span>
          </h2>

          <div className="mt-[28px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-ink-mono lg:mt-[38px] lg:text-[11px]">
            ABOUT AN HOUR · WHERE IT LEAKS · WHAT TO DO FIRST
          </div>

          <p className="m-0 mt-[20px] max-w-[560px] text-[15px] leading-[1.65] text-fn-ink-text-2 text-pretty lg:text-[15.5px]">
            The roadmap is yours either way: what we found, and what we would do about
            it first. What we build after that is priced per customer and per scope,
            with a fixed build price and a monthly run price against each item,
            quoted to you directly.
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
              Book your free audit
            </MagneticButton>
          </div>
        </div>
      </Band>
    </WaveClockProvider>
  );
}

export default AuditStatement;
