/* ── The Orbit OG image ──────────────────────────────────────────────────────
   `lib/og/render.tsx`'s dark sibling. Same 1200×630 canvas, same three faces,
   same satori constraints (explicit `display: flex` on anything with more than
   one child, no cascade, literal hex values) — inverted, and with the finding
   card replaced by a chat snippet, because the atomic unit of the Orbit subsite
   is a message rather than a finding.

   Two decisions worth recording.

   **The lockup is drawn, not loaded.** `public/orbit/orbit-primary-dark.svg` is
   a 4.5KB vector trace, and getting it into satori means either reading it off
   disk at render time (which assumes `public/` is present in whatever runtime
   ends up serving the route) or pasting several thousand path coordinates into
   this file. Instead the mark is rebuilt from two primitives — an arc and a
   dot, which is what the mark *is* — and set next to "rbit" in the site's own
   serif, which is what the logo does: the mark replaces the O. It is a
   reconstruction of the lockup, not a copy of the artwork, and it renders
   identically on every runtime.

   **The phone snippet is not a phone.** No frame, no status bar, no input bar.
   At the size an OG image is actually seen — a 400px-wide thumbnail in a
   WhatsApp forward — a full phone renders the bubbles at eight points and the
   whole point is lost. Two bubbles on the wallpaper colour reads as a chat at
   any size, which is all the image has to do.                                  */

import { ImageResponse } from "next/og";

import { loadOgFonts } from "./fonts";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/* The `--ob-*` and `--fn-*` tokens this design uses, resolved from
   `app/globals.css`. Satori has no `var()`, so they are literals here. */
const C = {
  bg: "#0B1020",
  bg2: "#0F1829",
  surface: "#141E33",
  line: "#22304A",
  text: "#F4F1EA",
  text2: "#C6D0E4",
  mono: "#93A3C2",
  blue: "#0369FD",
  orange: "#FF7727",
  orangeText: "#FFB27A",
  chatBg: "#E5DDD3",
  bubbleOut: "#E7FFDB",
  bubbleIn: "#FFFFFF",
  chatInk: "#111B21",
  chatMeta: "#667781",
} as const;

const SERIF = "STIX Two Text";
const SANS = "DM Sans";
const MONO = "IBM Plex Mono";

export type OrbitOgSpec = {
  /** Mono caps line beside the lockup — the page's section, not a slogan. */
  eyebrow: string;
  /** The page's own title or H1. Wraps; sized down as it gets longer. */
  title: string;
  /** One sentence under it. */
  lead?: string;
  /** The two-bubble snippet. Defaults to the flagship exchange. */
  chat?: { out: string; in: string };
  /** Right-hand footer note. `null` drops it. */
  footerNote?: string | null;
};

const DEFAULT_CHAT = {
  out: "fixed tiling at job on 1st avenue. charged 3800.",
  in: "Tracking that now ✅ — Job: 1st Avenue tiling · R3,800 · marked done",
};

/** The lockup: the ring mark, then "rbit". One knob, no layout engine. */
function Lockup({ height = 34 }: { height?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <svg width={height} height={height} viewBox="0 0 24 24" fill="none">
        <path d="M12 3.1a8.9 8.9 0 1 0 8.9 8.9" stroke={C.blue} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="17.6" cy="6" r="3.3" fill={C.blue} />
      </svg>
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: height * 0.92,
          letterSpacing: "-0.03em",
          color: C.text,
          marginLeft: -2,
        }}
      >
        rbit
      </div>
    </div>
  );
}

/* The title column is a fixed 570px, so the only thing a long title needs is a
   smaller size. Three steps land 2–4 lines for every title the subsite ships
   (the longest is a learn article's 64 characters). */
function titleFontSize(title: string): number {
  if (title.length > 62) return 42;
  if (title.length > 42) return 48;
  return 55;
}

function Bubble({
  text,
  side,
  time,
}: {
  text: string;
  side: "out" | "in";
  time: string;
}) {
  const out = side === "out";
  return (
    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: 330,
          background: out ? C.bubbleOut : C.bubbleIn,
          borderRadius: 12,
          padding: "12px 13px 8px",
        }}
      >
        <div style={{ fontSize: 19, lineHeight: 1.35, color: C.chatInk }}>{text}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 4,
            fontSize: 13,
            color: C.chatMeta,
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
}

function ChatSnippet({ chat }: { chat: { out: string; in: string } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 430 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: C.chatBg,
          borderRadius: 18,
          padding: "20px 16px",
        }}
      >
        <Bubble side="out" text={chat.out} time="16:41" />
        <Bubble side="in" text={chat.in} time="16:41" />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 12,
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.1em",
          color: C.mono,
        }}
      >
        ILLUSTRATIVE EXAMPLE
      </div>
    </div>
  );
}

/** Render one Orbit page's OG image. Every `opengraph-image.tsx` under
    `app/orbit` is a thin wrapper around this. */
export async function renderOrbitOgImage(spec: OrbitOgSpec): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  const footerNote = spec.footerNote === undefined ? "R99 / tradesperson / month" : spec.footerNote;
  const chat = spec.chat ?? DEFAULT_CHAT;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: C.bg,
          padding: "50px 58px",
          fontFamily: SANS,
          color: C.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Lockup />
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: C.mono }}>
            {spec.eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 50, paddingTop: 34 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 570 }}>
            <div
              style={{
                width: 52,
                height: 3,
                borderRadius: 2,
                marginBottom: 24,
                background: `linear-gradient(90deg, ${C.orange}, ${C.blue})`,
              }}
            />
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: titleFontSize(spec.title),
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                color: C.text,
              }}
            >
              {spec.title}
            </div>
            {spec.lead ? (
              <div style={{ marginTop: 18, fontSize: 20, lineHeight: 1.55, color: C.text2 }}>
                {spec.lead}
              </div>
            ) : null}
          </div>

          <ChatSnippet chat={chat} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.line}`,
            paddingTop: 18,
            fontFamily: MONO,
            fontSize: 15,
            color: C.mono,
          }}
        >
          <div>vyso.co.za/orbit · In development · Join the waitlist</div>
          {footerNote ? <div style={{ color: C.orangeText }}>{footerNote}</div> : null}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      ...(fonts.length > 0 ? { fonts } : {}),
    },
  );
}
