/* ── The finding card ────────────────────────────────────────────────────────
   The atomic unit of every Vyso demo: one thing the system noticed, what it
   costs, and what it looked at to decide that. Adapted from
   `components/finch/FindingCard.tsx` — the shape is the same because the shape
   was right (left state rule, source line, observation, impact, evidence chip,
   action row) — repainted in `--vy-*` and stripped of two things:

   1. **The tilt.** The Finch card follows the pointer through a ±4° rotate.
      Plan §4 rules out cursor-drift and magnetic behaviour on the new surface,
      so the card is flat and, with the pointer listeners gone, it is a plain
      SERVER component. The Finch original is `"use client"` purely to tilt and
      to count action clicks.
   2. **Clickable actions.** These are labels on a picture of a card, not
      controls. A `<span>` with an `onClick` that navigates nowhere is a control
      to a screen reader and a lie to a mouse, and it was only ever there to
      feed an analytics event.

   Colour: the accent is the WHOLE point of this component and the reason the
   rest of the site can stay monochrome. `state="alert"` is the "Vyso noticed"
   moment — accent rule, accent dot, accent impact figure. `watching` and
   `resolved` are grey. Three cards on a page and one of them accented is the
   intended ratio; four accented cards is a page with no signal in it.

   Everything paints through `--vy-*`, so a card inside a `data-vy-ground="dark"`
   band is this same component under a re-pointed ramp — no `tone` prop, no
   second copy to keep in sync. */

export type FindingState = "alert" | "watching" | "resolved";

const STATE: Record<FindingState, { label: string; rule: string; dot: string; chip: string }> = {
  alert: {
    label: "NEEDS A DECISION",
    rule: "bg-[color:var(--vy-accent)]",
    dot: "bg-[color:var(--vy-accent)]",
    chip: "border-[color:var(--vy-accent-tint)] bg-[color:var(--vy-accent-tint)] text-[color:var(--vy-accent-ink)]",
  },
  watching: {
    label: "WATCHING",
    rule: "bg-[color:var(--vy-line-2)]",
    dot: "bg-[color:var(--vy-ink-4)]",
    chip: "border-[color:var(--vy-line)] text-[color:var(--vy-ink-3)]",
  },
  resolved: {
    label: "RESOLVED",
    rule: "bg-[color:var(--vy-line)]",
    dot: "bg-[color:var(--vy-line-2)]",
    chip: "border-[color:var(--vy-line)] text-[color:var(--vy-ink-4)]",
  },
};

export function FindingCard({
  /** What noticed it. In house voice this is "Vyso noticed" or the workflow's
      own name — never a codename, never "Finch" (plan §2). */
  source = "VYSO NOTICED",
  state = "alert",
  /** The sentence. What happened, in the owner's language. */
  observation,
  /** The number. Accent ink on an alert, plain ink otherwise — an amount that
      is not a problem should not be painted like one. */
  impact,
  /** What it looked at: an invoice number, a delivery note, a price list. */
  evidence,
  /** Timestamp or provenance, mono. A STATIC string. */
  meta,
  /** Labels on the action row. Not controls — see the header. */
  actions,
  className = "",
}: {
  source?: string;
  state?: FindingState;
  observation: React.ReactNode;
  impact?: React.ReactNode;
  evidence?: string;
  meta?: string;
  actions?: readonly string[];
  className?: string;
}) {
  const s = STATE[state];

  return (
    <div
      className={[
        "relative rounded-[var(--vy-radius)] border border-[color:var(--vy-line)]",
        "bg-[color:var(--vy-surface)] pt-[20px] pr-[22px] pb-[16px] pl-[24px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[14px] bottom-[14px] left-0 w-[3px] rounded-[2px] ${s.rule}`}
      />

      <div className="mb-[12px] flex items-center gap-[8px]">
        <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${s.dot}`} />
        <span className="vy-label text-[11px] text-[color:var(--vy-ink-3)]">{source}</span>
        <span
          className={`vy-label ml-auto shrink-0 rounded-[var(--vy-radius-pill)] border px-[9px] py-[3px] text-[10px] ${s.chip}`}
        >
          {s.label}
        </span>
      </div>

      <div className="vy-body mb-[10px] text-[17px] leading-[1.45] text-[color:var(--vy-ink)]">
        {observation}
      </div>

      {impact ? (
        <div
          className={`mb-[12px] text-[21px] font-semibold tracking-[-0.01em] ${
            state === "alert"
              ? "text-[color:var(--vy-accent-ink)]"
              : "text-[color:var(--vy-ink-2)]"
          }`}
        >
          {impact}
        </div>
      ) : null}

      {evidence || meta ? (
        <div className="mb-[14px] flex flex-wrap items-center gap-x-[8px] gap-y-[6px]">
          {evidence ? (
            /* nowrap: at phone width the chip is the first thing to buckle, and
               a chip broken across two lines stops reading as a chip. */
            <span className="vy-mono shrink-0 whitespace-nowrap rounded-[6px] bg-[color:var(--vy-surface-2)] px-[10px] py-[4px] text-[11.5px] text-[color:var(--vy-ink-2)]">
              {evidence}
            </span>
          ) : null}
          {meta ? (
            <span className="vy-label whitespace-nowrap text-[10.5px] text-[color:var(--vy-ink-4)]">
              {meta}
            </span>
          ) : null}
        </div>
      ) : null}

      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] border-t border-[color:var(--vy-line)] pt-[13px] text-[13px] font-medium text-[color:var(--vy-ink-2)]">
          {actions.map((label, i) => (
            <span key={label} className="inline-flex items-center gap-[10px]">
              {i > 0 ? (
                <span aria-hidden="true" className="text-[color:var(--vy-line-2)]">
                  ·
                </span>
              ) : null}
              <span>{label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default FindingCard;
