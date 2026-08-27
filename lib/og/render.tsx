/* ── The OG image ────────────────────────────────────────────────────────────
   One renderer behind every `opengraph-image.tsx` in `app/`, so a link to any
   page previews as the same object: the Finch surface at 1200×630 — warm-white,
   the wordmark, an editorial title, and the page's own finding card.

   It is deliberately the *card* that changes per page, not a decorative
   variation. The finding card is the atomic unit of this site
   (`components/finch/FindingCard.tsx`); every route passes the finding its page
   already publishes — the industry's first deck card, the solution's
   `exampleFinding`, the article's `endFinding`, the glossary term's `example`,
   the comparison's `finding` — so an OG image can never show something the page
   itself does not say. Where the card content is a worked example rather than a
   measurement, the caption above it says so, exactly as every on-page render
   does.

   Sizes and colours are the design's (`app/globals.css` `--fn-*` tokens and the
   card's own paddings), scaled up: the real card renders at ~430px wide in a
   1160px layout, the OG card at 470px in 1200px, so type steps up two or three
   points to stay readable in a feed thumbnail.

   Satori is not a browser. Three constraints shape the markup below:
   every element with more than one child carries an explicit `display: flex`;
   there is no CSS cascade, so styles are inline on each node; and colours are
   literal hex values, because `var(--fn-*)` means nothing here. */

import { ImageResponse } from "next/og";

import { loadOgFonts } from "./fonts";

/** The one size Facebook, LinkedIn, WhatsApp and X all agree on. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/* The `--fn-*` tokens this design uses, resolved from `app/globals.css`. */
const C = {
  bg: "#FAF9F6",
  surface: "#FFFFFF",
  ink: "#14120E",
  ink2: "#4A463C",
  ink3: "#6B6659",
  muted: "#8A8474",
  muted2: "#A39D8E",
  faint: "#B9B3A3",
  line: "#E7E3DA",
  line2: "#F0EDE5",
  orange: "#FF7727",
  orangeDeep: "#C94F0E",
  orangeTint: "#F3D9C6",
  blueDeep: "#2F6FAE",
  blueTint: "#EDF4FB",
} as const;

const SERIF = "STIX Two Text";
const SANS = "DM Sans";
const MONO = "IBM Plex Mono";

/** The card content — the same five fields every finding on the site carries. */
export type OgFinding = {
  /** Mono agent label, e.g. "PRICE WATCH". */
  agent: string;
  observation: string;
  /** The orange line. A rand figure where the page has one. */
  impact: string;
  /** The blue evidence chip, e.g. "3 invoices". */
  evidence: string;
  /** The mono trail under the chip. Optional — not every finding has one. */
  meta?: string;
};

export type OgImageSpec = {
  /** Mono caps line beside the wordmark — the page's section, not a slogan. */
  eyebrow: string;
  /** The page's own title or H1. Wraps; sized down as it gets longer. */
  title: string;
  /**
   * One optional sentence under the title, for pages whose title is a headword
   * rather than a statement (the glossary). Only pass it with a short title —
   * the column is 560px and the two share it.
   */
  lead?: string;
  finding: OgFinding;
  /**
   * The mono caption above the card. Pass `"ILLUSTRATIVE EXAMPLE"` (the site's
   * own wording) whenever the figures are a worked example rather than a
   * measurement — which is every finding deck on the site. Omit only when the
   * card states published facts, e.g. the price on `/pricing`.
   */
  caption?: string;
  /**
   * The chip in the card's top-right. `NEW` — the site's default finding state
   * — unless overridden; `null` drops the chip, which is what a card holding
   * published facts rather than a finding should do.
   */
  state?: string | null;
   /**
   * The right half of the footer. Defaults to the free audit, which is the one
   * offer every preview can carry truthfully: it used to default to the
   * published monthly price, and nothing on the site publishes one now
   * (`.ai/plan_home_only.md`). Pass `null` to drop the line, or a string to
   * point at a nearer page than the audit.
   */
  footerNote?: string | null;
};

/* The wordmark, from `public/finch/vyso-wordmark.svg`. Paths verbatim; the
   file's `<clipPath>` wrapper is dropped because its rect (1254×1254) is larger
   than the artwork's viewBox and clips nothing — and `<defs>` support is the
   kind of thing satori is not obliged to have.

   Exported so `lib/og/vyso.tsx` can draw the same mark in its own ink rather
   than keep a second copy of eight path strings in sync with this one. `fill`
   defaults to this template's ink, so every existing call site is unchanged. */
export function Wordmark({ height = 30, fill = C.ink }: { height?: number; fill?: string }) {
  return (
    <svg
      width={Math.round((height * 825) / 210)}
      height={height}
      viewBox="215 495 825 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M221 504L338 694L455 504H417L338 632L261.5 504H221Z" fill={fill} />
      <path d="M467 504L536.5 618H538.5L556.5 588L502 504H467Z" fill={fill} />
      <path d="M658.5 504H620.097L473 752L510 751L658.5 504Z" fill={fill} />
      <path
        d="M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5"
        stroke={fill}
        strokeWidth="33"
        strokeMiterlimit="10"
        strokeLinejoin="round"
      />
      <path d="M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z" fill={fill} />
      <path d="M580 692.5L578.5 660.5L559 692.5H559.512H580Z" fill={fill} />
      <path
        d="M938.5 696C991.243 696 1034 652.795 1034 599.5C1034 546.205 991.243 503 938.5 503C885.757 503 843 546.205 843 599.5C843 652.795 885.757 696 938.5 696Z"
        fill={fill}
      />
    </svg>
  );
}

/* One knob, not a layout engine: the title column is a fixed 560px, so the only
   thing a long title needs is a smaller size. The three steps land 2–4 lines for
   every title the site currently ships (the longest is /pricing's 66 chars). */
function titleFontSize(title: string): number {
  if (title.length > 62) return 44;
  if (title.length > 42) return 50;
  return 56;
}

function FindingMock({ finding, caption, state = "NEW" }: Required<Pick<OgImageSpec, "finding">> & Pick<OgImageSpec, "caption" | "state">) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          padding: "26px 28px 22px 32px",
          boxShadow: "0 8px 24px rgba(20,18,14,0.06)",
        }}
      >
        {/* The state bar down the left edge — orange for a new finding. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 18,
            bottom: 18,
            width: 3,
            borderRadius: 2,
            background: C.orange,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: 99, background: C.orange, marginRight: 10 }} />
          <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", color: C.ink3 }}>
            {finding.agent}
          </div>
          {state ? (
            <div
              style={{
                marginLeft: "auto",
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.1em",
                color: C.orangeDeep,
                border: `1px solid ${C.orangeTint}`,
                borderRadius: 99,
                padding: "4px 11px",
              }}
            >
              {state}
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 20, lineHeight: 1.45, color: C.ink, marginBottom: 12 }}>
          {finding.observation}
        </div>

        <div
          style={{
            fontSize: 25,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: C.orangeDeep,
            marginBottom: 16,
          }}
        >
          {finding.impact}
        </div>

        {/* Wrap the row, never the chip or the meta trail — the card's own rule
            (`FindingEvidence` sets `whitespace-nowrap` on both): a chip broken
            over two lines stops reading as a chip. */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 13,
              whiteSpace: "nowrap",
              color: C.blueDeep,
              background: C.blueTint,
              borderRadius: 6,
              padding: "5px 11px",
            }}
          >
            {finding.evidence}
          </div>
          {finding.meta ? (
            <div
              style={{
                fontFamily: MONO,
                fontSize: 12,
                whiteSpace: "nowrap",
                letterSpacing: "0.08em",
                color: C.muted2,
              }}
            >
              {finding.meta}
            </div>
          ) : null}
        </div>
      </div>

      {caption ? (
        /* Right-aligned under the card, exactly where `HomeHero` puts it. */
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 12,
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: "0.1em",
            color: C.faint,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Render one page's OG image. Every `opengraph-image.tsx` is a thin wrapper
 * around this: read the page's own data, hand over a title and a finding.
 */
export async function renderOgImage(spec: OgImageSpec): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  const footerNote = spec.footerNote === undefined ? "Free operations audit" : spec.footerNote;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: C.bg,
          padding: "52px 60px",
          fontFamily: SANS,
          color: C.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark />
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: C.muted }}>
            {spec.eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 54, paddingTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            {/* The gradient rule the hero opens with. */}
            <div
              style={{
                width: 52,
                height: 3,
                borderRadius: 2,
                marginBottom: 26,
                background: `linear-gradient(90deg, ${C.orange}, #4B96DD)`,
              }}
            />
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: titleFontSize(spec.title),
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: C.ink,
              }}
            >
              {spec.title}
            </div>
            {spec.lead ? (
              <div style={{ marginTop: 20, fontSize: 20, lineHeight: 1.55, color: C.ink2 }}>
                {spec.lead}
              </div>
            ) : null}
          </div>

          <FindingMock finding={spec.finding} caption={spec.caption} state={spec.state} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.line2}`,
            paddingTop: 20,
            fontFamily: MONO,
            fontSize: 15,
            color: C.muted,
          }}
        >
          <div>vyso.co.za · Built by Vyso in Johannesburg</div>
          {footerNote ? <div style={{ color: C.ink2 }}>{footerNote}</div> : null}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      // Omitted rather than empty: `ImageResponse` falls back to its own bundled
      // face when `fonts` is absent, and an empty array is not that.
      ...(fonts.length > 0 ? { fonts } : {}),
    },
  );
}
