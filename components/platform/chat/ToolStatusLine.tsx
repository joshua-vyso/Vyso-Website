'use client';

import { toolLine } from './chat-display';

/**
 * "✦ Searching your documents…" — one line per tool the answer reached for
 * (design 1b, the block between the question and the answer).
 *
 * WHY THESE EXIST AT ALL. `/api/ai/agent` has always streamed `{tool}` events
 * and the dock has always thrown them away (W1 stopped dropping them). A
 * question that makes Finch read four invoice tables takes seconds, and
 * without this the owner is looking at a spinner wondering whether it hung.
 * The lines are also the honest answer to "where did that number come from",
 * which is why they are KEPT on the finished turn rather than cleared when the
 * answer arrives — the server stores the same list on the message row, so a
 * chat reopened next week still shows what it was built from.
 *
 * `pulsing` is the in-flight variant: the ✦ breathes on the tool currently
 * running (`.vyso-pulse`, the shell's token-driven keyframe), and stops the
 * moment the turn ends. `motion-reduce` is handled inside that class.
 */
export function ToolStatusLine({ tool, pulsing = false }: { tool: string; pulsing?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-[var(--pf-text-faint)]">
      <span className={`text-[#3E8FE0] ${pulsing ? 'vyso-pulse' : ''}`} aria-hidden>
        ✦
      </span>
      {toolLine(tool)}
    </div>
  );
}

/** The whole block, with the design's 6px rhythm. Renders nothing for an empty
 *  list so callers can hand it a turn's `tools` without a guard. */
export function ToolStatusLines({
  tools,
  pulsing = false,
}: {
  tools: readonly string[] | undefined;
  pulsing?: boolean;
}) {
  if (!tools?.length) return null;
  return (
    <div className="flex flex-col gap-1.5 pl-0.5">
      {tools.map((tool, i) => (
        // The last line is the one still running while a turn is in flight.
        <ToolStatusLine key={`${tool}-${i}`} tool={tool} pulsing={pulsing && i === tools.length - 1} />
      ))}
    </div>
  );
}
