import ContactForm from "@/components/ContactForm";
import { Glow } from "@/components/finch/ground/Glow";
import { SplitReveal } from "@/components/finch/text/Statement";

import { DIRECT_ANSWER, WHAT_WE_NEED, WHAT_YOU_GET } from "./audit-content";

/* ── The front door's hero ───────────────────────────────────────────────────
   Header left, booking form right — the homepage hero's grid (1.05fr / 0.95fr,
   64px gutter) with the form where the finding card sits on `/`. There are no
   hero buttons: the only thing a button could point at is already on screen,
   and a CTA that scrolls you to something you can see is furniture.

   The two lists under the sub state the trade before anyone is asked for
   anything. They are the whole of the old `NeedAndGet` band, compressed —
   that band existed to fill a full-width row this layout no longer has.

   ── Phase 6b ────────────────────────────────────────────────────────────────
   Paper ground, one device: a single blue `Glow` behind the booking form
   (§3.4 — the entire motion budget Linear and Attio spend on a hero). **Blue**
   rather than the homepage's orange because on this site blue is evidence and
   orange is agent activity; the thing behind the form is the report, not an
   agent. It is damped to ≈12% peak per the plan, against `Glow`'s 14% default.

   The glow is bigger than the card it sits behind, which is the only way a
   glow behind an opaque card is visible at all — it reads at the card's edges.
   That means its box overhangs the column, so the header clips horizontally:
   `overflow-x-clip` (not `hidden`, which would also clip vertically and take
   the drift with it) is what stops 40px of transparent gradient producing a
   horizontal scrollbar at 375px.

   Server component; `ContactForm`, the glow and the `SplitReveal` hydrate.    */

function TradeList({ eyebrow, items }: { eyebrow: string; items: readonly string[] }) {
  return (
    <div>
      <div className="mb-[10px] font-fn-mono text-[10px] leading-[1.6] tracking-[0.12em] text-fn-muted lg:text-[10.5px]">
        {eyebrow}
      </div>
      <ul className="m-0 flex list-none flex-col gap-0 p-0">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-[10px] border-b border-fn-line-2 py-[9px] text-[13.5px] leading-[1.5] text-fn-ink-3 last:border-b-0 lg:text-[14px]"
          >
            <span aria-hidden="true" className="shrink-0 text-fn-line-3">
              —
            </span>
            <span className="text-pretty">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuditHero() {
  return (
    <header className="relative isolate mx-auto grid max-w-[1160px] grid-cols-1 items-start gap-[36px] overflow-x-clip px-[20px] pb-[100px] pt-[40px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-[64px] lg:px-[40px] lg:pb-[128px] lg:pt-[68px]">
      {/* The one device. `-z-10` puts it under both columns; the region it
          covers is the form's, on desktop by the `lg:left-[50%]` and on mobile
          by the whole width, where the form is simply further down it. */}
      <Glow
        tone="blue"
        size={520}
        travel={22}
        className="-z-10 inset-y-[-40px] left-[-40px] right-[-60px] opacity-[0.86] lg:left-[50%]"
      />

      <div>
        <div
          className="mb-[22px] h-[3px] w-[44px] rounded-[2px] lg:mb-[28px] lg:w-[52px]"
          style={{ background: "var(--fn-grad)" }}
        />

        <div className="mb-[16px] font-fn-mono text-[10px] leading-[1.6] tracking-[0.14em] text-fn-muted lg:mb-[20px] lg:text-[11px]">
          THE OPERATIONS AUDIT · R2,000 · CREDITED TO YOUR FIRST MONTH
        </div>

        {/* §4.4's split-word reveal. Transform only — the words start 10px low
            and never fade, so a reader whose JS never runs still gets the
            headline (`Statement.tsx` has the long version of that argument). */}
        <h1 className="m-0 mb-[18px] font-fn-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[46px] lg:leading-[1.06] lg:tracking-[-0.025em] xl:text-[50px]">
          <SplitReveal text={"One week. Let’s find out where you’re leaking money and time."} />
        </h1>

        <p className="m-0 mb-[28px] max-w-[520px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:mb-[34px] lg:text-[16.5px]">
          {DIRECT_ANSWER}
        </p>

        {/* One column until there is room for two — at the hero's left-column
            width these lists are ~250px each, which is as narrow as a sentence
            of this length reads. */}
        <div className="grid grid-cols-1 gap-[24px] border-t border-fn-line pt-[24px] sm:grid-cols-2 sm:gap-[32px] lg:pt-[28px]">
          <TradeList eyebrow="WHAT WE NEED FROM YOU" items={WHAT_WE_NEED} />
          <TradeList eyebrow="WHAT YOU GET" items={WHAT_YOU_GET} />
        </div>
      </div>

      <div>
        <div className="mb-[12px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
          ONE WEEK · R2,000 · CREDITED
        </div>
        {/* `#book` stays on the card itself: every "Book your audit" elsewhere
            on the site is an anchor to it, and those links predate this layout. */}
        <div
          id="book"
          className="scroll-mt-[24px] rounded-[12px] border border-fn-line bg-fn-surface p-[20px] shadow-[var(--fn-shadow-card)] lg:p-[28px]"
        >
          <ContactForm variant="audit" />
        </div>
      </div>
    </header>
  );
}

export default AuditHero;
