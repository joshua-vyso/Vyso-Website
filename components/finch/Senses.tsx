"use client";

import { useState } from "react";
import { IntegrationsOrbit } from "./IntegrationsOrbit";
import { IntegrationPrompt } from "./IntegrationPrompt";

/* v4: this became a client component so it can hold the one `active` index
   the orbit reports up and hand it to both `IntegrationPrompt` renders (copy
   column on desktop, under the widget on mobile) — a single source of truth
   instead of two timers that could drift apart. */
export function Senses() {
  const [active, setActive] = useState(0);

  return (
    <section
      /* 6b fixes r2 — the bottom padding is the fix, not decoration. This
         section had none, so the orbit's last pixel and the ink quote band's
         first pixel were the same line: measured 0px of paper between them at
         1440. A paper section followed by a dark band with **no straddling
         element** keeps its full bottom rhythm (§2: 110 desktop / 64 mobile)
         and the band starts after it; only a band whose content actually
         crosses the join is allowed to eat that air. */
      className="mx-auto max-w-[1160px] px-[20px] pb-[64px] pt-[72px] lg:px-[40px] lg:pb-[110px] lg:pt-[110px]"
    >
      {/* items-center, not items-start: the orbit is a tall block and the copy is
          a short one, so the two read as a pair only when the copy sits against
          the capsule rather than against the top of the arc. */}
      <div className="grid grid-cols-1 items-center gap-[24px] border-t border-fn-line pt-[40px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-[64px] lg:pt-[64px]">
        <div>
          <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
            SENSES, NOT INTEGRATIONS
          </div>
          <h2 className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
            We put your current tools into Finch.
          </h2>
          <p className="m-0 max-w-[400px] text-[15px] leading-[1.65] text-fn-ink-3 lg:text-[15.5px]">
            Nothing to migrate, nothing to retrain on. Finch plugs into what you already run and
            starts watching.
          </p>
          {/* Desktop: directly under the paragraph. */}
          <IntegrationPrompt active={active} className="hidden lg:block lg:mt-[28px]" />
        </div>
        <IntegrationsOrbit onActiveChange={setActive} />
        {/* Mobile: directly under the widget, left-aligned with the copy above —
            a top-level grid child so it stacks in source order below the orbit
            in the single-column layout and simply doesn't render at `lg`. */}
        <IntegrationPrompt active={active} className="mt-[24px] lg:hidden" />
      </div>
    </section>
  );
}

export default Senses;
