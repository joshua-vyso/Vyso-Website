import { AgentsOnShift } from "./agents/AgentsOnShift";
import { AGENT_HONESTY } from "./agents/agents-data";

/* ── What Finch watches ──────────────────────────────────────────────────────
   The homepage's agent roster: six examples, each with the evidence it reads
   drawn underneath it and the status its claim can actually support.

   Server component. The section frame and both paragraphs render on the
   server; only the grid (`agents/AgentsOnShift.tsx`), whose cards play their
   micro-visuals once on enter, reaches the client.

   `id="agents"` is a linked target — the footer and the 404 both point at
   `/#agents`, so this section is what "see how Finch works" lands on.        */
export function WhatFinchWatches() {
  return (
    <section
      id="agents"
      className="mx-auto max-w-[1160px] scroll-mt-[80px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
    >
      <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
        WHAT FINCH WATCHES
      </div>
      <h2 className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
        Custom agents on shift, all day, every day.
      </h2>
      <p className="m-0 mb-[32px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 lg:mb-[44px] lg:text-[15.5px]">
        Agents are built around your business in the audit — these are the kinds of things they
        watch.
      </p>

      <AgentsOnShift />

      <p className="m-0 mt-[24px] max-w-[720px] text-[13.5px] leading-[1.6] text-fn-muted">
        {AGENT_HONESTY}
      </p>
    </section>
  );
}

export default WhatFinchWatches;
