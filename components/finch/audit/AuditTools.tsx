import { RAIL } from "@/components/finch/ground/Band";
import { MagneticButton } from "@/components/finch/text/MagneticButton";

import { CALCULATOR_PATH, SCORE_PATH } from "./audit-content";

/* ── Two ways to see it ──────────────────────────────────────────────────────
   The card that straddles the blue→paper seam, and — since 6b fixes r2 — the
   whole of this section.

   **What changed.** The self-assessment and the margin/time calculator used to
   be embedded here, side by side from `xl`. Two ten-minute tools stacked under
   a booking page made `/operations-audit` 5,700px tall, put two interactive
   widgets in a row that only fit above 1280, and gave neither one a URL anybody
   could send. They now live at `/operations-audit/score` and
   `/operations-audit/calculator`, each with its own hero, metadata and
   breadcrumb, and this card is the doorway to both.

   So the card keeps its job as the straddler — §2's Illoca move, a white card
   pulled up over `AuditWeek`'s bottom edge, with the blue band reserving
   exactly that overhang — and its content becomes the choice rather than the
   tools. `relative z-20` on the section is load-bearing, not decoration:
   `Band` is positioned and a seamed one carries `z-10`, so a later
   *non*-positioned sibling would paint under the band it is supposed to cross.

   The two buttons are `secondary` — white, hairline border, ink text, still
   magnetic. Neither is the page's call to action: the primary act here is
   booking, which is the form in the hero and the CTA on the ink band below, and
   two orange buttons in the middle of the page would argue with both. Untracked
   for now: `lib/analytics.ts`'s taxonomy has no event for opening a tool, and
   inventing one at a call site is how a taxonomy stops being one.

   The bottom padding is the air above the **next** band, whose own seam eats
   48px of it — same reason `AuditHero` carries the air above this one.        */

const CAPTION = "mt-[10px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted lg:text-[10.5px]";

/** White fill on top of the secondary outline: the card behind these buttons is
    `--fn-surface` too, so without it a "white, hairline border" button is just
    a rectangle of border. The `gap` is not cosmetic — `MagneticButton` is an
    `inline-flex`, and a flex container drops the whitespace text node between
    the label and the arrow, so without it the label reads "Run the numbers→". */
const BUTTON = "w-full justify-center gap-[7px] bg-fn-surface md:w-auto";

function Tool({ href, label, caption }: { href: string; label: string; caption: string }) {
  return (
    <div>
      <MagneticButton href={href} variant="secondary" className={BUTTON}>
        {label} <span aria-hidden="true">→</span>
      </MagneticButton>
      <div className={CAPTION}>{caption}</div>
    </div>
  );
}

export function AuditTools() {
  return (
    <section
      id="assess"
      className={`relative z-20 ${RAIL} scroll-mt-[24px] pb-[112px] lg:pb-[152px]`}
    >
      {/* The straddler. It pulls up over the blue band's bottom edge by 68/104
          and the band reserves exactly that with its own spacer, so the card
          lands on empty blue rather than on the day rail. `overflow: visible`
          on both (neither sets one) and `z-20` on this section — a seamed
          `Band` carries `z-10`, and a non-positioned later sibling paints
          *under* it. */}
      <div className="-mt-[68px] rounded-[14px] border border-fn-line bg-fn-surface px-[24px] py-[28px] shadow-[var(--fn-shadow-card)] lg:-mt-[104px] lg:px-[44px] lg:py-[40px]">
        <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
          BEFORE YOU BOOK
        </div>
        <h2 className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
          Two ways to see it before we start.
        </h2>
        <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty lg:text-[15.5px]">
          Score your operation in a minute, or put your own numbers in — both are estimates; the audit
          is where we find out for real.
        </p>

        {/* Side by side from `md`, stacked below it. `items-start` so the two
            captions sit under their own button rather than being stretched to
            a shared row height. */}
        <div className="mt-[28px] flex flex-col items-start gap-[24px] md:flex-row md:gap-[40px] lg:mt-[34px]">
          <Tool
            href={SCORE_PATH}
            label="Score your operation"
            caption="10 QUESTIONS · 1 MINUTE"
          />
          <Tool
            href={CALCULATOR_PATH}
            label="Run the numbers"
            caption="YOUR NUMBERS · AN ESTIMATE"
          />
        </div>
      </div>
    </section>
  );
}

export default AuditTools;
