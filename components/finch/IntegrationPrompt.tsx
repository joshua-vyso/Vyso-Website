"use client";

import { useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { INTEGRATIONS } from "./integrations";

/* ── Integration prompt ──────────────────────────────────────────────────────
   The "you ask Finch" line: what replaced the orbit's status chip (v4). It is
   pure presentation — `active` is owned by `Senses.tsx` and handed down, so
   the same index drives both this line and `IntegrationsOrbit`'s dock with no
   second timer to fall out of sync.

   Rendered twice by Senses.tsx (desktop copy column / mobile under-widget),
   so this component takes only an `active` index and a class for placement —
   no layout assumptions about where it sits.                                 */

export function IntegrationPrompt({
  active,
  className = "",
}: {
  active: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [broken, setBroken] = useState<string[]>([]);

  return (
    <div className={className}>
      <div className="mb-[10px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
        YOU ASK · FINCH DOES
      </div>
      {/* All eleven lines stacked in one grid cell, like the widget's old
          status chip: the row reserves the tallest line's height (two lines
          on mobile) up front, so nothing shifts as the copy swaps. */}
      <div className="grid">
        {INTEGRATIONS.map((it, i) => {
          const shown = i === active;
          const failed = broken.includes(it.slug);
          return (
            <div
              key={it.slug}
              className="flex items-center gap-[12px]"
              style={{
                gridArea: "1 / 1",
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(6px)",
                transition: reduceMotion
                  ? "none"
                  : "opacity 180ms ease-out, transform 180ms ease-out",
              }}
              aria-hidden={!shown}
            >
              <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border border-fn-line bg-fn-surface">
                {failed ? (
                  <span className="font-fn-mono text-[10px] text-fn-muted">
                    {it.name.charAt(0)}
                  </span>
                ) : (
                  <Image
                    src={`/finch/integrations/${it.slug}.svg`}
                    alt=""
                    width={20}
                    height={20}
                    onError={() => setBroken((b) => (b.includes(it.slug) ? b : [...b, it.slug]))}
                    className="object-contain"
                  />
                )}
              </span>
              <span className="font-fn-serif text-[17px] font-normal not-italic leading-[1.45] text-fn-ink">
                {it.prompt}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default IntegrationPrompt;
