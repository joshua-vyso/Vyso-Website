"use client";

import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";
import { FINCH_MONTHLY, type SalarySource } from "@/lib/marketing/compare";

/* ── The cost bars ───────────────────────────────────────────────────────────
   Two horizontal bars that grow on enter, drawn to scale against the top of
   the sourced salary range, with the rand values stamping (scale 1.3 → 1 +
   fade, 220ms) per `.ai/vyso_v2.md` §1 motion rule 4.

   ── Phase 6b: redrawn on blue ───────────────────────────────────────────────
   §7 moves this section onto a **blue** band behind a `FacetPlane`, which
   re-points every colour in it. The discipline §2 sets for a blue band is that
   orange appears on **exactly one element**, and here that element is the
   **Finch bar** — the shortest bar in the picture, which is the argument. The
   two rand values stay `--fn-blue-text`: `#FF7727` on `#1F5FA8` is 2.5:1, so
   orange is a fill colour on this ground and never a text colour.

   The salary bar is `--fn-blue-text-2` — present, sourced, and deliberately
   *not* tinted with anything that editorialises it. On paper it was
   `--fn-line-3` and ink; the roles are identical, the palette is not.

   Honesty: the widths are a ratio of two published numbers and nothing else.
   If `SALARY.monthlyHigh` is `null` — nothing could be sourced — the section
   drops the proportional claim entirely rather than draw an invented ratio, and
   says so. The sourced sentence under the bars is plain server-rendered text,
   so the figures are in the HTML whether or not the animation ever runs.

   Reduced motion goes through `useStaticMotion` rather than `motion`'s own
   `useReducedMotion`, which reads the media query on the hydration render and
   hands React a different tree than the server built — see
   `motion-preference.tsx`. Same reason every other 6a/6b component does.      */

const rand = (value: number) => `R${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

/** ease-out-expo-ish; the same curve the homepage sequence's reveals use. */
const GROW = { duration: 0.66, ease: [0.22, 1, 0.36, 1] as const };
const STAMP = { duration: 0.22, ease: "easeOut" as const };

export type CostTone = "paper" | "blue";

const TONE = {
  paper: {
    label:  "text-fn-ink-2",
    value:  "text-fn-ink",
    stamp:  "text-fn-orange-deep",
    detail: "text-fn-faint",
    track:  "bg-fn-line-2",
    theirs: "var(--fn-line-3)",
    ours:   "var(--fn-ink)",
    note:   "text-fn-ink-3",
    rule:   "border-fn-line-2",
    link:   "text-fn-ink-2 decoration-fn-line-3",
    prose:  "text-fn-muted",
    small:  "text-fn-muted decoration-fn-line-2",
    linkHover: "hover:text-fn-orange-deep",
  },
  blue: {
    label:  "text-fn-blue-text-2",
    value:  "text-fn-blue-text",
    /* No orange stamp on blue: the bar carries the band's one orange element,
       and a second would break §2 as well as the contrast floor. */
    stamp:  "text-fn-blue-text",
    detail: "text-fn-blue-mono",
    track:  "bg-fn-blue-900/50",
    theirs: "var(--fn-blue-text-2)",
    ours:   "var(--fn-orange)",
    note:   "text-fn-blue-text-2",
    rule:   "border-fn-blue-300/50",
    link:   "text-fn-blue-text decoration-fn-blue-300",
    prose:  "text-fn-blue-text-2",
    small:  "text-fn-blue-text-2 decoration-fn-blue-300",
    /* `--fn-orange-deep` is a paper hover; on blue it disappears. The light
       orange is the one orange that stays legible on a dark ground (§2). */
    linkHover: "hover:text-fn-orange-on-ink",
  },
} as const;

function Bar({
  label,
  value,
  detail,
  /** 0–1 of the track, or `null` when the comparison is not drawn to scale. */
  fraction,
  fill,
  stamp,
  delay,
  reduce,
  tone,
}: {
  label:    string;
  value:    string;
  /** The mono line under the track. "" to omit. */
  detail:   string;
  fraction: number | null;
  fill:     string;
  /** The one bar this section argues — orange on blue, orange text on paper. */
  stamp:    boolean;
  delay:    number;
  reduce:   boolean;
  tone:     CostTone;
}) {
  const palette = TONE[tone];
  return (
    <div>
      <div className="mb-[10px] flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[4px]">
        <span className={`text-[15px] leading-[1.4] lg:text-[15.5px] ${palette.label}`}>{label}</span>
        <motion.span
          className={`font-fn-serif text-[22px] font-medium tracking-[-0.01em] lg:text-[26px] ${
            stamp ? palette.stamp : palette.value
          }`}
          initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.3 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ ...STAMP, delay: reduce ? 0 : delay + 0.5 }}
        >
          {value}
        </motion.span>
      </div>
      <div className={`h-[14px] w-full overflow-hidden rounded-[4px] ${palette.track}`}>
        <motion.span
          className="block h-full rounded-[4px]"
          style={{
            /* `null` fraction → a full, unscaled track: the bar is a label
               holder, not a measurement. */
            width: fraction === null ? "100%" : `${Math.max(fraction * 100, 1.5)}%`,
            background: fill,
            transformOrigin: "left",
          }}
          initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ ...GROW, delay: reduce ? 0 : delay }}
        />
      </div>
      {detail ? (
        <div className={`mt-[8px] font-fn-mono text-[10px] tracking-[0.1em] ${palette.detail}`}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function CostBars({
  salary,
  tone = "paper",
  className = "",
}: {
  salary: SalarySource;
  tone?:  CostTone;
  className?: string;
}) {
  const reduce = useStaticMotion();
  const palette = TONE[tone];

  const sourced = salary.monthlyLow !== null && salary.monthlyHigh !== null;
  const top = salary.monthlyHigh;

  const salaryValue = sourced
    ? `${rand(salary.monthlyLow as number)}–${rand(salary.monthlyHigh as number)}`
    : "market salary — see sources";

  return (
    <div className={"flex flex-col gap-[28px] " + className}>
      <Bar
        label={`${salary.role} in South Africa, per month`}
        value={salaryValue}
        detail={sourced ? salary.detail : ""}
        fraction={sourced ? 1 : null}
        fill={palette.theirs}
        stamp={false}
        delay={0}
        reduce={reduce}
        tone={tone}
      />
      <Bar
        label="Finch, per location per month"
        value={rand(FINCH_MONTHLY)}
        detail="EVERYTHING INCLUDED · NO SETUP FEE"
        fraction={sourced && top ? FINCH_MONTHLY / top : null}
        fill={palette.ours}
        stamp
        delay={0.14}
        reduce={reduce}
        tone={tone}
      />
    </div>
  );
}

/** The citation. Split out of `CostBars` in 6b so the blue band can put the
    evidence in one column and the bars in the other, with the bars' baseline
    sitting on the band's bottom edge — which is the whole composition of that
    section. Same strings, same order, same honesty note. */
export function CostSources({
  salary,
  finchNote,
  tone = "paper",
  className = "",
}: {
  salary:    SalarySource;
  finchNote: string;
  tone?:     CostTone;
  className?: string;
}) {
  const palette = TONE[tone];
  const sourced = salary.monthlyLow !== null && salary.monthlyHigh !== null;

  return (
    <div className={className}>
      <p className={`m-0 text-[14px] leading-[1.65] text-pretty ${palette.note}`}>{finchNote}</p>

      {/* Blue is this site's evidence colour, so the source chip stays the
          light blue tint on both grounds — on the blue band it reads as an
          inset plate rather than as a second accent. */}
      <div className={`mt-[18px] border-t pt-[16px] ${palette.rule}`}>
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="shrink-0 whitespace-nowrap rounded-[6px] bg-fn-blue-tint px-[10px] py-[4px] font-fn-mono text-[11px] text-fn-blue-deep">
            SOURCE ↗
          </span>
          <a
            href={salary.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`text-[13.5px] leading-[1.5] underline underline-offset-[3px] transition-colors duration-150 ${palette.linkHover} ${palette.link}`}
          >
            {salary.publisher}, {salary.year} — {salary.role}
          </a>
        </div>
        <p className={`m-0 mt-[10px] text-[13px] leading-[1.6] text-pretty ${palette.prose}`}>
          {salary.workings}
          {sourced ? null : " The bar above is therefore unlabelled and the two are not drawn to scale."}
        </p>
        {salary.alsoSee.length > 0 ? (
          <ul className="m-0 mt-[10px] flex list-none flex-col gap-[5px] p-0">
            {salary.alsoSee.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={`text-[12.5px] leading-[1.5] underline underline-offset-[3px] transition-colors duration-150 ${palette.linkHover} ${palette.small}`}
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default CostBars;
