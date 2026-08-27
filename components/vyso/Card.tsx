/* ── The card ────────────────────────────────────────────────────────────────
   1px `--vy-line`, `--vy-surface` fill, 10px radius, and NO SHADOW. The system
   allows exactly one ambient shadow and it belongs to window chrome and the
   hero demo (`demo/ChromeFrame.tsx` owns it) — a marketing card that lifts off
   the page is the "warmth dial" turned up on a data-dense section, which is the
   one place the research says not to turn it.

   Everything paints through `--vy-*`, so a card standing inside a
   `data-vy-ground="dark"` band is the same component under a re-pointed
   palette rather than a second card with a `tone` prop. Change a piece once and
   both grounds follow, which is the only version of this that stays in sync. */

export type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-[18px]",
  md: "p-[24px]",
  lg: "p-[28px] md:p-[32px]",
};

export function Card({
  children,
  padding = "md",
  /** A card the whole of which is a link or a button. Adds the hairline's hover
      step; it does not make the card focusable — the anchor inside it is what
      takes focus, and wrapping this in one is the caller's job. */
  interactive = false,
  as: Tag = "div",
  id,
  className = "",
}: {
  children: React.ReactNode;
  padding?: CardPadding;
  interactive?: boolean;
  as?: "div" | "li" | "article" | "figure";
  id?: string;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={[
        "rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)]",
        PADDING[padding],
        interactive
          ? "transition-colors duration-150 hover:border-[color:var(--vy-line-2)]"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

/* ── The eyebrow pill ────────────────────────────────────────────────────────
   The other radius. 999px is for eyebrow labels and status chips ONLY, which is
   why the pill is a named component rather than a class anyone can reach for:
   there is one place to look to see every pill the system draws. */
export function Pill({
  children,
  /** Draws the accent dot and the accent ink. Reserved for demo surfaces — an
      alert, a "Vyso noticed" moment, a live status — because the accent is not
      a decoration budget, it is the signal that something needs attention. */
  accent = false,
  className = "",
}: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "vy-label inline-flex items-center gap-[6px] rounded-[var(--vy-radius-pill)]",
        "border px-[10px] py-[4px] text-[11px]",
        accent
          ? "border-[color:var(--vy-accent-tint)] bg-[color:var(--vy-accent-tint)] text-[color:var(--vy-accent-ink)]"
          : "border-[color:var(--vy-line)] text-[color:var(--vy-ink-3)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="h-[6px] w-[6px] rounded-full bg-[color:var(--vy-accent)]"
        />
      ) : null}
      {children}
    </span>
  );
}

export default Card;
