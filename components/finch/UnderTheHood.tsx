import { RAIL } from "./ground/Band";

const MODULES: [string, string][] = [
  ["EXTRACTION",     "Every invoice, delivery note and statement read into structured line items."],
  ["PRICE MEMORY",   "Six months of what everything cost, per supplier, per unit."],
  ["RECONCILIATION", "Invoiced vs delivered vs paid, matched line by line."],
  ["BRIEF COMPOSER", "Findings ranked by rand impact, written in plain language."],
];

/* The paper rest between the homepage's two ink bands (§2: "a warm-white
   section between blue and ink is a rest, not a reset"). It carries a real
   bottom rest as well as a top one — it used to rely on the next section's own
   padding, which was fine when that section was a card on paper and is not fine
   now that it is a full-bleed ink band with a living background.

   The rest is the paper band's own 110/110 rhythm rather than 6b's 130: the
   extra 20px was buying separation from the ribbon, and the ribbon has since
   moved up inside its band (`AuditBand.tsx`) while the quote above stopped
   moving at all, so the two dark bands no longer need a wider gap than any
   other pair. No device: a rest carries none. */
export function UnderTheHood() {
  return (
    <section className={`${RAIL} pt-[88px] pb-[72px] lg:py-[110px]`}>
      <div className="border-t border-fn-line pt-[40px] lg:pt-[48px]">
        <div className="mb-[24px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:mb-[32px] lg:text-[11px]">
          UNDER THE HOOD
        </div>
        <div className="grid grid-cols-1 gap-[28px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-[40px]">
          {MODULES.map(([label, body]) => (
            <div key={label}>
              <div className="mb-[8px] font-fn-mono text-[11.5px] tracking-[0.1em] text-fn-ink-2">
                {label}
              </div>
              <div className="text-[13.5px] leading-[1.55] text-fn-muted">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default UnderTheHood;
