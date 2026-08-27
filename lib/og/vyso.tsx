/* ── The OG image, `--vy-*` ──────────────────────────────────────────────────
   The link preview for the redesigned surface (`.ai/plan_vyso_redesign_2026.md`
   §8): the wordmark, the two-tier positioning line, and a small operations feed
   in window chrome. It is the homepage in miniature, which is the point — the
   feed is the site's recurring visual grammar (`components/vyso/demo/
   EventTimeline.tsx`), so a shared link previews as the same object the page
   opens with.

   ── Why this is a second module, not a rewrite of `render.tsx` ──────────────
   `lib/og/render.tsx` is the Finch-era template and thirty routes still render
   through it, including `/orbit/**`, which plan §10 puts off limits. Repainting
   it in `--vy-*` would silently restyle every one of them in the middle of a
   phased migration. So this is a sibling — the same pattern `lib/og/orbit.tsx`
   already set — and Phase 3 points the remaining new pages at it as they are
   rebuilt. The wordmark is imported rather than copied; only the palette, the
   faces and the mock are new.

   Satori is not a browser, and the same three constraints apply as in
   `render.tsx`: every element with more than one child carries an explicit
   `display: flex`, every style is inline because there is no cascade, and every
   colour is a literal hex because `var(--vy-*)` means nothing here. */

import { ImageResponse } from "next/og";

import { loadVysoOgFonts } from "./fonts";
import { Wordmark } from "./render";

/** The one size Facebook, LinkedIn, WhatsApp and X all agree on. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/* The `--vy-*` tokens this design uses, resolved from `app/globals.css`. */
const C = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surface2: "#F3F3EF",
  ink: "#101010",
  ink2: "#3D3D3A",
  ink3: "#6E6E68",
  ink4: "#9C9C95",
  line: "#E7E7E2",
  line2: "#D9D9D3",
  accent: "#E05E1F",
  accentInk: "#A8410C",
  accentTint: "#FBEDE4",
} as const;

const DISPLAY = "Instrument Sans";
const BODY = "Inter";
const MONO = "IBM Plex Mono";

/** One row of the feed mock. `time` is a STATIC string, always. */
export type VysoOgEvent = {
  time: string;
  text: string;
  /** Draws the row as an accent box: the "Vyso noticed" moment, once per image. */
  accent?: boolean;
  /** The mono label inside an accent box, e.g. "VYSO RECOMMENDS". */
  label?: string;
};

export type VysoOgSpec = {
  /** Mono caps line beside the wordmark. The page's section, not a slogan. */
  eyebrow: string;
  /** The strong clause of the two-tier headline. */
  title: string;
  /** The lighter continuation clause, set on its own line. */
  continuation?: string;
  /** One short supporting sentence. The column is 560px and the three share it. */
  lead?: string;
  /** The window bar's title. */
  frameTitle?: string;
  /** Three or four rows. More than four and the type has to shrink to fit. */
  feed: readonly VysoOgEvent[];
  /** The right half of the footer. `null` drops it. */
  footerNote?: string | null;
};

/* One knob, not a layout engine: the column is a fixed 560px, so a long title
   only needs a smaller size. Tight tracking belongs to short display lines
   (plan §4 / research rule 13), so it loosens as the line grows. */
function titleFontSize(title: string): number {
  if (title.length > 44) return 46;
  if (title.length > 28) return 54;
  return 60;
}

function FeedMock({ frameTitle, feed }: Pick<VysoOgSpec, "frameTitle" | "feed">) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 470,
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 18px 46px rgba(16,16,16,0.09)",
      }}
    >
      {/* The window bar. Grey dots, not macOS colours: the shell carries no
          hue, and three coloured circles would spend the whole budget on
          furniture. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: C.surface2,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 9, height: 9, borderRadius: 99, background: C.line2 }} />
          <div style={{ width: 9, height: 9, borderRadius: 99, background: C.line2 }} />
          <div style={{ width: 9, height: 9, borderRadius: 99, background: C.line2 }} />
        </div>
        {frameTitle ? (
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", color: C.ink3 }}>
            {frameTitle.toUpperCase()}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "24px 26px" }}>
        {feed.map((event) => (
          <div key={`${event.time}-${event.text}`} style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 13,
                color: C.ink4,
                width: 46,
                flexShrink: 0,
                paddingTop: 3,
              }}
            >
              {event.time}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  marginTop: 9,
                  flexShrink: 0,
                  background: event.accent ? C.accent : C.ink4,
                }}
              />
              {event.accent ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    background: C.accentTint,
                    border: `1px solid ${C.line}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  {event.label ? (
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        color: C.accentInk,
                        marginBottom: 6,
                      }}
                    >
                      {event.label}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 17, lineHeight: 1.4, color: C.ink }}>{event.text}</div>
                </div>
              ) : (
                <div style={{ fontSize: 17, lineHeight: 1.4, color: C.ink2, flex: 1 }}>
                  {event.text}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render one page's OG image on the `--vy-*` template. Every new
 * `opengraph-image.tsx` is a thin wrapper around this: a headline the page
 * actually carries, and a feed the page actually shows.
 */
export async function renderVysoOgImage(spec: VysoOgSpec): Promise<ImageResponse> {
  const fonts = await loadVysoOgFonts();
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
          fontFamily: BODY,
          color: C.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark fill={C.ink} />
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: C.ink3 }}>
            {spec.eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 54, paddingTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            {/* The one accent mark on the image: a rule, not a gradient. The
                new system has no gradients (plan §4). */}
            <div
              style={{
                width: 52,
                height: 3,
                borderRadius: 2,
                marginBottom: 26,
                background: C.accent,
              }}
            />
            {/* Two tiers, two lines. Satori has no inline text runs with mixed
                styles worth relying on, and at this size the headline wants the
                break anyway. */}
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 600,
                fontSize: titleFontSize(spec.title),
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: C.ink,
              }}
            >
              {spec.title}
            </div>
            {spec.continuation ? (
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 600,
                  fontSize: titleFontSize(spec.title),
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: C.ink3,
                }}
              >
                {spec.continuation}
              </div>
            ) : null}
            {spec.lead ? (
              <div style={{ marginTop: 22, fontSize: 20, lineHeight: 1.55, color: C.ink2 }}>
                {spec.lead}
              </div>
            ) : null}
          </div>

          <FeedMock frameTitle={spec.frameTitle} feed={spec.feed} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.line}`,
            paddingTop: 20,
            fontFamily: MONO,
            fontSize: 15,
            color: C.ink3,
          }}
        >
          <div>vyso.co.za · Johannesburg, South Africa</div>
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
