/* ── The section ─────────────────────────────────────────────────────────────
   One idea per section, one content column, one heading construction. This is
   the scaffolding every page hangs on, so the rhythm (plan §4) lives here and
   nowhere else: 1120px column, 72px vertical padding on mobile stepping to
   112px on desktop, and a hairline between neighbours rather than a change of
   background.

   ── The two-tier headline ───────────────────────────────────────────────────
   The research's rule 2, and the strongest single device the three inspiration
   sites share: a short high-contrast clause, then a longer continuation in a
   lighter ink. Scannable hierarchy without shrinking the type. Both clauses are
   ONE heading element — a screen reader reads "Most automation stops when the
   task is complete. Vyso looks at what happened next." as one heading, because
   that is one sentence. Splitting them into two headings would invent an
   outline level that does not exist.

   ── Grounds ─────────────────────────────────────────────────────────────────
   `ground="dark"` sets `data-vy-ground="dark"`, which re-points the `--vy-*`
   ramp for everything inside (globals.css). One dark band per page, and it is
   the closing CTA — that is the system's budget, not a suggestion. */

export type SectionGround = "paper" | "dark";
export type SectionWidth = "narrow" | "content" | "wide";
export type SectionSpacing = "none" | "tight" | "default" | "loose";

const WIDTH: Record<SectionWidth, string> = {
  /* A measure, for a section that is mostly prose. */
  narrow: "max-w-[720px]",
  content: "max-w-[var(--vy-content)]",
  /* Only for a full-bleed demo that needs the extra 120px to hold its chrome. */
  wide: "max-w-[1280px]",
};

const SPACING: Record<SectionSpacing, string> = {
  none: "",
  tight: "py-[56px] md:py-[80px]",
  default: "py-[72px] md:py-[112px]",
  loose: "py-[80px] md:py-[140px]",
};

export function Section({
  children,
  eyebrow,
  heading,
  /** The lighter second clause of the two-tier headline. */
  continuation,
  /** The supporting sentence under the headline. Body-lg, `--vy-ink-3`. */
  lead,
  /** `1` only for the page's hero. Every page has exactly one h1. */
  headingLevel = 2,
  ground = "paper",
  width = "content",
  spacing = "default",
  /** Hairline above the section. The default separator between neighbours; the
      first section on a page and any section following a dark band pass
      `divider={false}`, because a rule that has nothing above it is a rule
      drawn under the nav. */
  divider = false,
  align = "left",
  id,
  className = "",
  headerClassName = "",
}: {
  children?: React.ReactNode;
  eyebrow?: string;
  heading?: React.ReactNode;
  continuation?: React.ReactNode;
  lead?: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
  ground?: SectionGround;
  width?: SectionWidth;
  spacing?: SectionSpacing;
  divider?: boolean;
  align?: "left" | "center";
  id?: string;
  className?: string;
  headerClassName?: string;
}) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingType = headingLevel === 1 ? "vy-h1" : headingLevel === 2 ? "vy-h2" : "vy-h3";
  const hasHeader = Boolean(eyebrow || heading || lead);

  return (
    <section
      id={id}
      data-vy-ground={ground === "dark" ? "dark" : undefined}
      className={[
        "px-[var(--vy-gutter)] md:px-[40px]",
        SPACING[spacing],
        divider ? "border-t border-[color:var(--vy-line)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "mx-auto w-full",
          WIDTH[width],
          align === "center" ? "text-center" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {hasHeader ? (
          <div
            className={[
              "max-w-[760px]",
              align === "center" ? "mx-auto" : "",
              children ? "mb-[40px] md:mb-[56px]" : "",
              headerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {eyebrow ? (
              <div className="vy-label mb-[18px] text-[color:var(--vy-ink-3)]">{eyebrow}</div>
            ) : null}
            {heading ? (
              <Heading className={`${headingType} text-[color:var(--vy-ink)]`}>
                {heading}
                {continuation ? (
                  <>
                    {" "}
                    <span className="text-[color:var(--vy-ink-3)]">{continuation}</span>
                  </>
                ) : null}
              </Heading>
            ) : null}
            {lead ? (
              <p className="vy-body-lg mt-[18px] text-[color:var(--vy-ink-3)]">{lead}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export default Section;
