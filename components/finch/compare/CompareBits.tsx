import Link from "next/link";

import { FindingCardFrame } from "@/components/finch/FindingCard";
import type { Crumb, Step } from "@/lib/marketing/compare";

/* ── Shared pieces for the /compare cluster ──────────────────────────────────
   Server components, all of them. The only JavaScript this tree ships is the
   cost bars on the COO page, the day strip it borrows, and the finding card's
   pointer tilt — everything else is markup and CSS.

   Deliberately a local copy of the breadcrumb/eyebrow/arrow-link idiom rather
   than an import from `components/finch/solutions/SolutionBits.tsx`: those take
   `/solutions`' own data types and belong to that page's data file. The visual
   contract is the shared one (`.ai/vyso_v2.md` §1), not a shared module.      */

/** Mono trail above every `<h1>` in this tree; twin of the `BreadcrumbList`.

    `tone` exists because 6b puts the COO comparison's hero on an **ink** band
    and `--fn-muted` on `#14120E` is 2.0:1 — unreadable. Same markup, one
    palette swap; a separate ink breadcrumb component would have been a second
    place for the trail to drift from the `BreadcrumbList` that mirrors it. */
const CRUMB_TONE = {
  paper: {
    rail:    "text-fn-muted",
    divider: "text-fn-line-3",
    current: "text-fn-ink-3",
    hover:   "hover:text-fn-orange-deep",
  },
  ink: {
    rail:    "text-fn-ink-mono",
    divider: "text-fn-ink-line",
    current: "text-fn-ink-text-2",
    hover:   "hover:text-fn-orange-on-ink",
  },
} as const;

export function Breadcrumb({
  trail,
  tone = "paper",
}: {
  trail: readonly Crumb[];
  tone?: keyof typeof CRUMB_TONE;
}) {
  const palette = CRUMB_TONE[tone];
  return (
    <nav aria-label="Breadcrumb" className="mb-[18px]">
      <ol
        className={
          "m-0 flex list-none flex-wrap items-center gap-[7px] p-0 font-fn-mono text-[10.5px] tracking-[0.1em] " +
          palette.rail
        }
      >
        {trail.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-[7px]">
            {i > 0 ? <span className={palette.divider}>/</span> : null}
            {i === trail.length - 1 ? (
              <span aria-current="page" className={palette.current}>
                {crumb.label.toUpperCase()}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className={"transition-colors duration-150 " + palette.hover}
              >
                {crumb.label.toUpperCase()}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The eyebrow + H2 + sub that opens every `Section`, extracted so a **band**
    can open the same way without a `Section`'s paper hairline and rail — the
    blue cost band and the ink CTA band both need this trio in their own
    palette, and copying it into each would be three places for the site's
    section rhythm to drift. */
const BAND_HEAD_TONE = {
  blue: { eyebrow: "text-fn-blue-mono", title: "text-fn-blue-text", sub: "text-fn-blue-text-2" },
  ink:  { eyebrow: "text-fn-ink-mono",  title: "text-fn-ink-text",  sub: "text-fn-ink-text-2"  },
} as const;

export function BandHead({
  eyebrow,
  title,
  sub,
  tone,
  className = "",
}: {
  eyebrow: string;
  title:   string;
  sub?:    string;
  tone:    keyof typeof BAND_HEAD_TONE;
  className?: string;
}) {
  const palette = BAND_HEAD_TONE[tone];
  return (
    <div className={className}>
      <div className={"mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] lg:text-[11px] " + palette.eyebrow}>
        {eyebrow}
      </div>
      <h2
        className={
          "m-0 mb-[16px] max-w-[600px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px] " +
          palette.title
        }
      >
        {title}
      </h2>
      {sub ? (
        <p className={"m-0 max-w-[560px] text-[15px] leading-[1.65] text-pretty lg:text-[15.5px] " + palette.sub}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** The mono eyebrow every section in this tree opens with. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
      {children}
    </div>
  );
}

/** The section frame: hairline, eyebrow, H2, optional sub. Every section on
    these four pages opens with one, which is what gives the cluster its rhythm
    (§1: 110px desktop / 64 mobile between sections). */
export function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
  narrow = false,
}: {
  id?:       string;
  eyebrow:   string;
  title:     string;
  sub?:      string;
  children?: React.ReactNode;
  /** 860px measure for prose-heavy sections; 1160 otherwise. */
  narrow?:   boolean;
}) {
  return (
    <section
      id={id}
      className={`mx-auto ${narrow ? "max-w-[860px]" : "max-w-[1160px]"} scroll-mt-[80px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[110px]`}
    >
      <div className="border-t border-fn-line pt-[40px] lg:pt-[56px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="m-0 mb-[16px] max-w-[680px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
          {title}
        </h2>
        {sub ? (
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 lg:text-[15.5px]">
            {sub}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** The quiet arrow link used wherever a section points somewhere else. */
export function ArrowLink({
  href,
  children,
  className = "",
}: {
  href:       string;
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={
        "group inline-flex items-center gap-[7px] text-[14px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep " +
        className
      }
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
      >
        →
      </span>
    </Link>
  );
}

/** A plain hairline list — the "strengths" / "differences" bullets the two
    ported pages carry. `<ul>` with the marker replaced by a rule, because a
    disc in this typeface reads as debris. */
export function RuleList({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 mt-[28px] grid list-none grid-cols-1 gap-0 p-0 md:grid-cols-2 md:gap-x-[48px]">
      {items.map((item) => (
        <li
          key={item}
          className="border-t border-fn-line-2 py-[16px] text-[15px] leading-[1.6] text-fn-ink-2 text-pretty"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/** The "where it breaks down" cards: title + one line, four across on desktop. */
export function PointGrid({ items }: { items: readonly { title: string; text: string }[] }) {
  return (
    <div className="mt-[32px] grid grid-cols-1 gap-[16px] md:grid-cols-2">
      {items.map(({ title, text }) => (
        <div
          key={title}
          className="rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[20px] transition-[border-color,box-shadow] duration-200 ease-out hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)]"
        >
          <h3 className="m-0 mb-[8px] font-fn-serif text-[18px] font-medium tracking-[-0.01em] text-fn-ink">
            {title}
          </h3>
          <p className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">{text}</p>
        </div>
      ))}
    </div>
  );
}

/** The numbered four-step process both ported pages end on. Same mono-number
    idiom as `/operations-audit`'s week. */
export function StepRow({ items }: { items: readonly Step[] }) {
  return (
    <ol className="m-0 mt-[32px] grid list-none grid-cols-1 gap-0 p-0 md:grid-cols-2 md:gap-x-[48px] lg:grid-cols-4 lg:gap-x-[28px]">
      {items.map(({ n, label, text }) => (
        <li key={n} className="border-t border-fn-line-3 pt-[16px] lg:pt-[18px]">
          <div className="mb-[10px] flex items-baseline gap-[10px] font-fn-mono text-[10px] tracking-[0.12em]">
            <span className="text-fn-faint">{n}</span>
            <span className="text-fn-ink-2">{label}</span>
          </div>
          <p className="m-0 pb-[24px] text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">
            {text}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Two honest columns: when the alternative still wins, when Finch does. */
export function FitSplit({
  left,
  right,
}: {
  left:  { label: string; items: readonly string[] };
  right: { label: string; items: readonly string[] };
}) {
  return (
    <div className="mt-[32px] grid grid-cols-1 gap-[32px] md:grid-cols-2 md:gap-[48px]">
      {[left, right].map((column) => (
        <div key={column.label}>
          <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-ink-2">
            {column.label.toUpperCase()}
          </div>
          <ul className="m-0 list-none p-0">
            {column.items.map((item) => (
              <li
                key={item}
                className="border-t border-fn-line-2 py-[14px] text-[15px] leading-[1.6] text-fn-ink-3 text-pretty"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The hub's honesty note: a finding-card frame carrying the case *against*
    the page it sits on. `state="resolved"` deliberately — the bar and the
    label stay grey, because orange on this site means an agent found something
    that costs money, and this is the opposite claim. */
export function HonestyNote({ children }: { children: React.ReactNode }) {
  return (
    <FindingCardFrame state="resolved" className="mt-[20px] bg-fn-bg">
      <div className="mb-[10px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
        WHEN FINCH IS NOT THE ANSWER
      </div>
      <p className="m-0 text-[14.5px] leading-[1.55] text-fn-ink-2 text-pretty">{children}</p>
    </FindingCardFrame>
  );
}

/** The sideways links every spoke owes its siblings (§7.5). */
export function SideLinks({ links }: { links: readonly Crumb[] }) {
  return (
    <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
      <div className="flex flex-wrap items-center gap-x-[28px] gap-y-[14px] border-t border-fn-line pt-[28px]">
        {links.map(({ href, label }) => (
          <ArrowLink key={href} href={href}>
            {label}
          </ArrowLink>
        ))}
      </div>
    </section>
  );
}
