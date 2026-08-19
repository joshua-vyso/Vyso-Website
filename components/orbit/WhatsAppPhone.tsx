import type { CSSProperties, ReactNode } from "react";

import type { ChatMessage, ChatScript } from "@/lib/orbit/sequences";

/* ── The phone ───────────────────────────────────────────────────────────────
   A chat screen drawn in HTML and CSS, inside a phone frame drawn in HTML and
   CSS. Not a screenshot, not an image, not a mockup exported from a design
   tool — every pixel below is markup, for four reasons that are worth stating
   because they are the reasons this file is long:

   1. **Trademark.** WhatsApp is Meta's. A screenshot of their client, or a
      pixel-copy of their wallpaper art, is their artwork on our marketing site.
      What is reproduced here is the *layout convention* of a mobile chat —
      header, wallpaper, alternating bubbles, timestamps, ticks, input bar —
      which is not anybody's property, drawn with our own geometry. The doodle
      wallpaper is ours: an abstract tile, not a trace of theirs. Every page
      that renders a phone also renders `ORBIT.trademark`.
   2. **It has to be readable.** A 300px-wide screenshot of a chat is unreadable
      on a phone and invisible to a crawler. This is real text: it scales, it
      selects, it is in the HTML, and an answer engine reading `/orbit` can see
      the conversation the page is describing.
   3. **It has to be deterministic.** No `new Date()`, no random ids, no
      hydration-time measurement. The times in `lib/orbit/sequences.ts` are
      strings for exactly this reason — the server and the client render the
      same bytes.
   4. **The sequence needs the parts.** `OrbitSequence` is a client component
      that reveals these bubbles one at a time as the page scrolls. It imports
      the same `Bubble`, `ChatHeader` and `PhoneFrame` used here rather than
      re-implementing them, which is why this module carries **no `"use client"`
      directive**: without one, both a server page and a client sequence may
      import it, and the two renders cannot drift apart.

   ── Accessibility ───────────────────────────────────────────────────────────
   The frame is `role="img"` with the script's own `alt` as its label. A screen
   reader gets one sentence describing the conversation instead of a stream of
   disconnected bubbles, timestamps and tick glyphs — which is what the plan
   means by "alt text on every phone render". The text stays in the DOM, so
   crawlers and answer engines still read the conversation itself.              */

/** Screen width. The frame adds 10px of bezel on each side, so a phone is
    320px wide — which fits a 390px viewport with the site's 20px gutters. */
export const PHONE_SCREEN_W = 300;

/* ── The wallpaper ───────────────────────────────────────────────────────────
   An abstract 96px tile: rings, dashes, chevrons and dots at low alpha over the
   warm grey a chat client puts behind its bubbles. Ours, not a trace of
   anyone's artwork, and cheap — one data URI, no request, no image decode. */
const WALLPAPER_TILE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
      `<g fill="none" stroke="#B3A899" stroke-width="1.4" stroke-linecap="round" opacity="0.5">` +
      `<circle cx="18" cy="20" r="6.5"/>` +
      `<path d="M60 14 l7 7 -7 7"/>` +
      `<path d="M78 40 h10"/>` +
      `<path d="M10 54 q6 -7 12 0 t12 0"/>` +
      `<rect x="52" y="48" width="12" height="12" rx="3"/>` +
      `<path d="M30 82 v10"/>` +
      `<path d="M70 74 l6 6 -6 6"/>` +
      `</g>` +
      `<g fill="#B3A899" opacity="0.45">` +
      `<circle cx="44" cy="30" r="1.7"/>` +
      `<circle cx="86" cy="66" r="1.7"/>` +
      `<circle cx="8" cy="80" r="1.7"/>` +
      `</g>` +
      `</svg>`,
  );

const WALLPAPER: CSSProperties = {
  backgroundColor: "#E5DDD3",
  backgroundImage: `url("${WALLPAPER_TILE}")`,
  backgroundSize: "96px 96px",
};

/* ── Chrome ─────────────────────────────────────────────────────────────── */

/** The iOS status bar: time on the left, the three indicators on the right.
    Drawn rather than typed — the SF Symbols glyphs are Apple's. */
function StatusBar({ time }: { time: string }) {
  return (
    <div
      aria-hidden
      className="relative z-10 flex h-[38px] items-end justify-between bg-[#F6F6F6] px-[20px] pb-[5px] text-[12.5px] font-semibold text-[#111B21]"
    >
      <span className="tracking-[-0.01em]">{time}</span>
      <span className="flex items-center gap-[4px]">
        {/* signal */}
        <svg width="15" height="10" viewBox="0 0 15 10" fill="#111B21">
          <rect x="0" y="7" width="2.6" height="3" rx="0.8" />
          <rect x="4.1" y="5" width="2.6" height="5" rx="0.8" />
          <rect x="8.2" y="2.7" width="2.6" height="7.3" rx="0.8" />
          <rect x="12.3" y="0" width="2.6" height="10" rx="0.8" />
        </svg>
        {/* wifi */}
        <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="#111B21" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 3.4a8 8 0 0 1 11 0" />
          <path d="M3.3 5.8a4.8 4.8 0 0 1 6.4 0" />
          <circle cx="6.5" cy="8.4" r="0.9" fill="#111B21" stroke="none" />
        </svg>
        {/* battery */}
        <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
          <rect x="0.5" y="0.5" width="18" height="9" rx="2.6" stroke="#111B21" strokeOpacity="0.4" />
          <rect x="2" y="2" width="13.5" height="6" rx="1.6" fill="#111B21" />
          <path d="M20 3.6v2.8a1.7 1.7 0 0 0 0-2.8Z" fill="#111B21" fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/** The Orbit avatar: the ring mark, flat, on the brand blue. Drawn as two
    strokes rather than loaded from `public/orbit/orbit-mark.svg` — at 34px the
    traced artwork's detail is lost anyway, and an `<img>` here would be a
    second request inside a component that is otherwise pure markup. */
function OrbitAvatar({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[#0369FD]"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.4a8.6 8.6 0 1 0 8.6 8.6"
          stroke="#FFFFFF"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <circle cx="17.4" cy="6.2" r="3.1" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

export function ChatHeader({ name, presence }: { name: string; presence: string }) {
  return (
    <div
      aria-hidden
      className="relative z-10 flex items-center gap-[9px] border-b border-[#D8D2CB] bg-[#F6F6F6] px-[10px] py-[7px]"
    >
      <svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="#0369FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 1.6 1.9 9 9 16.4" />
      </svg>
      <OrbitAvatar />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[15.5px] font-semibold tracking-[-0.01em] text-[#111B21]">{name}</span>
        <span className="mt-[3px] text-[11.5px] text-[#667781]">{presence}</span>
      </span>
      <span className="ml-auto flex items-center gap-[16px] pr-[4px]">
        <svg width="19" height="13" viewBox="0 0 19 13" fill="none" stroke="#0369FD" strokeWidth="1.7" strokeLinejoin="round">
          <rect x="0.9" y="0.9" width="11.6" height="11.2" rx="2.6" />
          <path d="M13.6 5.1 18.1 2.2v8.6l-4.5-2.9Z" />
        </svg>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#0369FD">
          <path d="M3.2.9c.5-.5 1.3-.4 1.7.2l1.5 2.2c.3.5.2 1.1-.2 1.5l-1 .9c-.2.2-.2.4-.1.6.5 1 2.3 2.8 3.3 3.3.2.1.5.1.6-.1l.9-1c.4-.4 1-.5 1.5-.2l2.2 1.5c.6.4.7 1.2.2 1.7l-1 1c-.7.7-1.7.9-2.6.6C7.6 12.9 3.1 8.4 1.6 4.5c-.3-.9-.1-1.9.6-2.6l1-1Z" />
        </svg>
      </span>
    </div>
  );
}

/** The date chip a chat client puts above the first message of a day. */
function DayChip({ label = "TODAY" }: { label?: string }) {
  return (
    <div aria-hidden className="mb-[10px] flex justify-center">
      <span className="rounded-[7px] bg-[#FFFFFF]/85 px-[10px] py-[4px] text-[10.5px] font-medium tracking-[0.04em] text-[#54656F] shadow-[0_1px_1px_rgba(11,20,26,0.08)]">
        {label}
      </span>
    </div>
  );
}

/** Double tick. Blue once the message has been read — the one piece of chat
    grammar everybody reads without thinking about it. */
function Ticks({ status }: { status: NonNullable<ChatMessage["status"]> }) {
  const colour = status === "read" ? "#53BDEB" : "#8696A0";
  if (status === "sent") {
    return (
      <svg width="12" height="9" viewBox="0 0 12 9" fill="none" stroke={colour} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.2 5 4 7.8 10.8 1" />
      </svg>
    );
  }
  return (
    <svg width="16" height="9" viewBox="0 0 16 9" fill="none" stroke={colour} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5 3.5 7.6 9.6 1" />
      <path d="M5.8 5 8.3 7.6 14.4 1" />
    </svg>
  );
}

/* ── The bubble ─────────────────────────────────────────────────────────────
   One shape, two sides. The tail is a CSS triangle on a pseudo-free element
   rather than a border trick: a bordered triangle inherits the bubble's
   background in some engines and not others, and a 6px artefact on the corner
   of the one graphic the page is built around is not a thing to leave to
   chance.

   `rows` is the structured half of an Orbit reply — a label/value table inside
   the bubble. Chat bots really do format replies this way, and it is what makes
   the difference between "Orbit said something" and "Orbit recorded something"
   legible at a glance.                                                        */

export function Bubble({
  message,
  style,
  className = "",
}: {
  message: ChatMessage;
  /** Plain CSS only. `OrbitSequence` animates bubbles by wrapping them in a
      `motion.div` rather than passing motion values here — a `MotionValue`
      only drives an element `motion` owns, and this component stays a plain
      one so a server page can render it with no runtime at all. */
  style?: CSSProperties;
  className?: string;
}) {
  const out = message.side === "out";
  return (
    <div
      style={style}
      className={
        "relative flex " + (out ? "justify-end " : "justify-start ") + className
      }
    >
      <div
        className={
          "relative max-w-[86%] rounded-[9px] px-[9px] pt-[6px] pb-[5px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] " +
          (out ? "bg-[#E7FFDB]" : "bg-[#FFFFFF]")
        }
      >
        {/* The tail. 8px, flush with the bubble's top edge, in the bubble's
            own colour — the only two literal colours that appear twice. */}
        <span
          aria-hidden
          className={"absolute top-0 h-0 w-0 " + (out ? "-right-[7px]" : "-left-[7px]")}
          style={
            out
              ? { borderTop: "8px solid #E7FFDB", borderRight: "8px solid transparent" }
              : { borderTop: "8px solid #FFFFFF", borderLeft: "8px solid transparent" }
          }
        />
        <p className="m-0 text-[14.5px] leading-[1.36] text-[#111B21]">{message.text}</p>

        {message.rows ? (
          <div className="mt-[7px] flex flex-col gap-[3px] rounded-[6px] bg-[#111B21]/[0.045] px-[8px] py-[6px]">
            {message.rows.map(([label, value]) => (
              <span key={label} className="flex items-baseline justify-between gap-[10px] text-[12px] leading-[1.4]">
                <span className="shrink-0 text-[#667781]">{label}</span>
                <span className="text-right font-medium text-[#111B21]">{value}</span>
              </span>
            ))}
          </div>
        ) : null}

        {/* The meta row sits inside the bubble, bottom-right, exactly as a
            chat client puts it — and is `aria-hidden` because the frame's own
            label already says who said what. */}
        <span aria-hidden className="mt-[2px] flex items-center justify-end gap-[3px] text-[10.5px] text-[#667781]">
          {message.time}
          {out && message.status ? <Ticks status={message.status} /> : null}
        </span>
      </div>
    </div>
  );
}

/** The compose bar. Inert — it is a drawing of a control, not a control, so
    nothing here is focusable and nothing announces itself as an input. */
export function ChatInputBar() {
  return (
    <div aria-hidden className="relative z-10 border-t border-[#D8D2CB] bg-[#F6F6F6] px-[8px] pt-[7px] pb-[6px]">
      <div className="flex items-center gap-[9px]">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#0369FD" strokeWidth="1.9" strokeLinecap="round">
          <path d="M10 4.4v11.2M4.4 10h11.2" />
        </svg>
        <span className="flex min-w-0 flex-1 items-center gap-[6px] rounded-[16px] border border-[#D8D2CB] bg-white px-[10px] py-[6px]">
          <span className="flex-1 truncate text-[14px] text-[#8696A0]">Message</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#8696A0" strokeWidth="1.4">
            <rect x="0.8" y="0.8" width="14.4" height="14.4" rx="3.4" />
            <path d="M10.4 15.2V11a.6.6 0 0 1 .6-.6h4.2" />
          </svg>
        </span>
        <svg width="19" height="17" viewBox="0 0 19 17" fill="none" stroke="#0369FD" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M1 5.2h3.4L6 2.6h7l1.6 2.6H18v10H1z" />
          <circle cx="9.5" cy="10" r="3.1" />
        </svg>
        <svg width="14" height="19" viewBox="0 0 14 19" fill="#0369FD">
          <rect x="4.4" y="0" width="5.2" height="10.6" rx="2.6" />
          <path d="M1 8.6a6 6 0 0 0 12 0h-1.7a4.3 4.3 0 0 1-8.6 0Z" />
          <rect x="6.2" y="15" width="1.6" height="3.6" rx="0.8" />
        </svg>
      </div>
      {/* The home indicator. Two pixels of realism for one div. */}
      <div className="mx-auto mt-[7px] h-[4px] w-[112px] rounded-full bg-[#111B21]/25" />
    </div>
  );
}

/* ── The frame ──────────────────────────────────────────────────────────── */

export function PhoneFrame({
  label,
  statusTime,
  header,
  children,
  className = "",
}: {
  /** The one-sentence description a screen reader gets. */
  label: string;
  statusTime: string;
  header: { name: string; presence: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={
        "relative shrink-0 rounded-[44px] bg-[#080B12] p-[10px] " +
        "shadow-[0_28px_70px_rgba(2,6,16,0.55),0_2px_0_rgba(255,255,255,0.06)_inset] " +
        "ring-1 ring-[#2A3652] " +
        className
      }
      style={{ width: PHONE_SCREEN_W + 20 }}
    >
      <div className="relative overflow-hidden rounded-[35px] bg-[#E5DDD3]">
        {/* The island. Above the status bar, which is why the bar's clock and
            indicators are pushed to the outer thirds. */}
        <span
          aria-hidden
          className="absolute left-1/2 top-[7px] z-30 h-[21px] w-[80px] -translate-x-1/2 rounded-full bg-[#080B12]"
        />
        <StatusBar time={statusTime} />
        <ChatHeader name={header.name} presence={header.presence} />
        {children}
        <ChatInputBar />
      </div>
    </div>
  );
}

/** The scrollable body, wallpaper included. Separated from `PhoneFrame` so
    `OrbitSequence` can put motion-driven children inside the same box. */
/* No `minHeight`. The sequence animates opacity and offset only — every
   message is laid out from the first frame whether or not it is visible — so
   the phone's height is fixed by its script and nothing reserves anything. An
   earlier version carried a measured floor here and it was dead weight. */
export function ChatBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={"relative flex flex-col gap-[7px] px-[9px] pt-[12px] pb-[10px] " + className}
      style={WALLPAPER}
    >
      {children}
    </div>
  );
}

/* ── The static phone ───────────────────────────────────────────────────── */

export function WhatsAppPhone({
  script,
  className = "",
  showDayChip = true,
}: {
  script: ChatScript;
  className?: string;
  showDayChip?: boolean;
}) {
  /* The clock in the status bar is the first message's own time. A phone
     showing 09:41 above a 16:41 conversation is the kind of detail that makes
     a whole illustration look borrowed. */
  const statusTime = script.messages[0]?.time ?? "16:41";

  return (
    <PhoneFrame
      label={script.alt}
      statusTime={statusTime}
      header={{ name: "Orbit", presence: "online" }}
      className={className}
    >
      <ChatBody>
        {showDayChip ? <DayChip /> : null}
        {script.messages.map((message, i) => (
          <Bubble key={`${message.side}-${i}`} message={message} />
        ))}
      </ChatBody>
    </PhoneFrame>
  );
}

export { DayChip };
export default WhatsAppPhone;
