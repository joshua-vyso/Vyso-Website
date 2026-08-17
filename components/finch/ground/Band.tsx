import type { CSSProperties, ReactNode } from "react";

import { SeamHairline } from "./SeamHairline";

/* ── The band ────────────────────────────────────────────────────────────────
   A full-bleed horizontal section on one of the three grounds
   (`.ai/vyso_v3_design.md` §2). Every deep-contrast section on the site is one
   of these, and the rules it enforces are the rules that keep the design from
   becoming a crypto landing page:

   - **One ground per band, and adjacent bands never share one.** The `ground`
     prop is the only way to set a dark background; nothing else in the Finch
     surface may paint one.
   - **One device per band.** `device` is a single slot, not an array. Two
     living backgrounds in one band is the §1.3 failure mode, so the type makes
     it awkward rather than the code review catching it later.
   - **`data-ground` for the nav.** `NavGround.tsx` observes these attributes and
     inverts `FinchNav` over blue and ink. A band that forgets the attribute is
     a band the nav goes invisible over, so it is set here and not by callers.
   - **Reserved height, no CLS.** The device mounts client-side after the band
     is within a viewport; the band's own padding and content have already laid
     the height out, and the device is absolutely positioned inside it, so
     nothing moves when it arrives.

   **On `content-visibility: auto`** — the plan asks for it here and it is
   `contain` below, off by default, because measuring it on `/design` showed it
   doing the opposite of its job. A band whose device is an absolutely
   positioned, `inset-0` canvas collapses to its `contain-intrinsic-size` while
   skipped, which drags the canvas down with it; scrolling the sink made the
   document height swing between 9,810px and 11,793px, moved every band's
   position under the scrollbar, and put three devices inside one viewport that
   should have held two. The paint saving it buys is already bought by the
   devices' own `IntersectionObserver` gating, which pauses them off-screen and
   is not a layout mechanism. Left available (`contain`) for text-only bands,
   where none of the above applies.

   A server component: it has no state, and keeping it off the client means a
   page can be a server component up to the point where its device starts.      */

export type Ground = "paper" | "blue" | "ink";

/** **The column.** One 1160 rail with a 20/40px gutter, sitewide — the same
    string a `Band` uses for its own content, exported so a paper section that
    is not a band (`WhatsIncluded`, `AcademyCard`, `UnderTheHood`, `AuditTools`)
    lines up with the bands above and below it instead of centring its own
    narrower measure and leaving every left edge in a different place. Reading
    measures (860, 620) go *inside* this, left-aligned. */
export const RAIL = "mx-auto max-w-[1160px] px-[20px] lg:px-[40px]";

/** §2's rhythm, restated as classes: paper 110/110, blue 96/104, ink 112/120 at
    desktop, ~64/72 below `lg` where 140px of nothing is a scroll cost rather
    than a breath.

    **These are the only heights a band has.** 6b's review found bands 500px
    taller than the thing inside them, so nothing here — and nothing in a
    caller — sets a `min-height`: a band is its padding plus its content, full
    stop. A composition that wants more air asks for more content or uses
    `paddingClassName`, and then says why. */
const PADDING: Record<Ground, string> = {
  paper: "py-[64px] lg:py-[110px]",
  blue:  "pt-[56px] pb-[64px] lg:pt-[96px] lg:pb-[104px]",
  ink:   "pt-[60px] pb-[68px] lg:pt-[112px] lg:pb-[120px]",
};

/** Ground fill + the text colour the band's contents inherit. The blue is a
    vertical gradient (§2) — deep, not electric — and the ink is flat, because
    a gradient under a grain texture reads as a compression artefact. */
const SURFACE: Record<Ground, string> = {
  paper: "bg-fn-bg text-fn-ink",
  blue:  "text-fn-blue-text bg-[linear-gradient(180deg,var(--fn-blue-900),var(--fn-blue-700))]",
  ink:   "bg-fn-ink text-fn-ink-text",
};

/* ── The seam, as two directions ─────────────────────────────────────────────
   §2's seam is "the dark slab overlaps the paper band above by 48px, 24px top
   radius, so a card straddles the join". 6b needs the mirror of that too — a
   pricing hero whose founding-terms strip crosses an ink→paper join has the
   *dark* band on top, so the overlap has to be downward and the radius on the
   bottom corners.

   Both are the same 48px and the same 24px; only the edge changes. Written as
   one map so the two can never drift, and so a band declares which way it
   leans rather than restating four utilities.                                  */
const OVERLAP: Record<"up" | "down", string> = {
  up:   "-mt-[48px] rounded-t-[24px] z-10",
  down: "-mb-[48px] rounded-b-[24px] z-10",
};

/** `FinchNav`'s **measured** height: 76px below `lg`, 92px above (18/26px of
    padding around a row whose tallest item is the CTA). `NavGround.tsx` keeps
    64/80 because that constant only has to put its probe line *inside* the nav
    and it does; this one has to cover the nav exactly, and the 15px shortfall
    showed on `/pricing` as an 11px strip of paper above a full-bleed ink hero
    (measured 6b-fixes: the band's top sat at y=11, not y=0). */
const NAV_H = { pull: "-mt-[76px] lg:-mt-[92px]", give: "pt-[76px] lg:pt-[92px]" };

export function Band({
  ground = "paper",
  device,
  seam = false,
  overlap,
  underNav = false,
  hairline = false,
  children,
  className = "",
  contentClassName = "",
  paddingClassName,
  /** Only read when `contain` is on: the height to reserve while skipped. */
  intrinsicHeight = 600,
  /** Opt into `content-visibility: auto`. Off by default — see the header. */
  contain = false,
  style,
  id,
  as: Tag = "section",
}: {
  ground?: Ground;
  /** The living background. Exactly one, absolutely positioned, decorative. */
  device?: ReactNode;
  /** Shorthand for `overlap="up"` — kept because `/design` and 6a's own
      composition already speak it, and because "seam" is the word §2 uses. */
  seam?: boolean;
  /** Which way this band leans over its neighbour: `up` straddles the band
      above (24px top radius, −48px), `down` straddles the band below (bottom
      radius, −48px). Either way something in the content can cross the join —
      §2, the Illoca move. */
  overlap?: "up" | "down";
  /** For a **dark hero**: run the ground up behind the nav instead of starting
      below it. §7 says the nav inverts over an ink hero, and it can only do
      that if the ink is actually under it — `FinchNav` is in normal flow with
      no background of its own, so without this a dark hero leaves an 80px
      warm-white strip at the top of the window and `NavGround`'s probe (which
      hit-tests just below the nav) correctly reports `paper`.

      The band is pulled up by the nav's height and the *content* is padded back
      down by the same amount, so nothing moves except the ground. `FinchNav`
      carries `z-30` for the other half of this: the band is a later sibling and
      would otherwise paint over the links it is supposed to sit behind.

      Only ever on the first band of a page, and only when that band is dark. */
  underNav?: boolean;
  /** Draw §2's orange→blue hairline at the top of the band's content as it
      enters (§4.4). **At most once per page.** For a hairline that sits
      somewhere other than the top of a band — under a Statement, say — import
      `SeamHairline` directly and place it. */
  hairline?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** **Replaces** the ground's padding preset rather than fighting it. Two
      arbitrary Tailwind values for one property resolve by stylesheet order,
      not by the order they are written on the element, so a `pt-*` in
      `className` is a coin flip; this substitutes the whole string. For heroes
      that carry the nav's height inside them and would otherwise open on 200px
      of nothing. Everything else takes the preset. */
  paddingClassName?: string;
  intrinsicHeight?: number;
  contain?: boolean;
  style?: CSSProperties;
  id?: string;
  as?: "section" | "div" | "header" | "footer";
}) {
  const dark = ground !== "paper";
  const lean = overlap ?? (seam ? "up" : undefined);

  return (
    <Tag
      id={id}
      data-ground={ground}
      className={[
        "relative isolate",
        SURFACE[ground],
        paddingClassName ?? PADDING[ground],
        lean ? OVERLAP[lean] : "",
        underNav ? NAV_H.pull : "",
        /* Grain is an ink-only texture (§2) and always static. */
        dark && ground === "ink" ? "fn-ground-grain" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={
        contain
          ? { contentVisibility: "auto", containIntrinsicSize: `auto ${intrinsicHeight}px`, ...style }
          : style
      }
    >
      {/* The device layer. `-z-10` rather than a z-index on the content so a
          card that straddles the seam still paints above the band below it. */}
      {device ? (
        /* `rounded-[inherit]` so a seam band's 24px corners clip the device
           too — a canvas with square corners under a rounded slab is the kind
           of 2px tell that makes a whole section look unfinished. */
        <div
          data-band-device
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        >
          {device}
        </div>
      ) : null}
      <div
        data-band-content
        className={
          "relative mx-auto max-w-[1160px] px-[20px] lg:px-[40px] " +
          (underNav ? NAV_H.give + " " : "") +
          contentClassName
        }
      >
        {hairline ? <SeamHairline className="mb-[28px] w-[120px] lg:mb-[36px]" /> : null}
        {children}
      </div>
    </Tag>
  );
}

export default Band;
