import { DayStrip, type DayStripProps } from "./DayStrip";

/* The section header sits in its own wrapper rather than wrapping the strip:
   the strip's desktop form is a 300vh block with a sticky stage inside it, and
   sticky positioning only works if no ancestor is a scroll container or a
   transformed box. Same arrangement as `SequenceIntro` + `ScrollSequence` on
   the homepage.

   Header and strip content are both props, so the same section can carry a
   different day (Phase 2 runs a COO's day against Finch's). This is a server
   component; only the strip below it reaches the client. */
export function DaySection({
  id = "day",
  eyebrow = "A COO’S DAY · 06:00 → 18:00",
  title = "From the first invoice to the evening brief.",
  sub = "One working day, as Finch runs it. The agents read what comes in, flag what costs money, and put the three that matter into one message at 17:55.",
  footnote = "ILLUSTRATIVE — DEMO DATA",
  ...strip
}: DayStripProps & {
  id?:       string;
  eyebrow?:  string;
  title?:    string;
  sub?:      string;
  /** The provenance line under the strip. "" to omit. */
  footnote?: string;
}) {
  return (
    <>
      <div id={id} className="mx-auto max-w-[1160px] scroll-mt-[80px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]">
        <div className="border-t border-fn-line pt-[40px] lg:pt-[64px]">
          <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
            {eyebrow}
          </div>
          <h2 className="m-0 mb-[16px] max-w-[680px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
            {title}
          </h2>
          <p className="m-0 max-w-[560px] text-[15px] leading-[1.65] text-fn-ink-3 lg:text-[15.5px]">
            {sub}
          </p>
        </div>
      </div>

      <DayStrip {...strip} />

      {footnote ? (
        <div className="mx-auto max-w-[1160px] px-[20px] pt-[16px] lg:px-[40px]">
          <div className="font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
            {footnote}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default DaySection;
