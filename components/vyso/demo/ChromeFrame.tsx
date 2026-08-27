/* ── Chrome ──────────────────────────────────────────────────────────────────
   The wrapper that makes a demo read as a real running system rather than an
   illustration of one. Research rule 8: Attio and Kinso both put their product
   shots inside a recognisable OS or app chrome, and for an SME buyer who has
   been sold vapourware before, that alone is a credibility signal.

   Two variants, because Vyso has two surfaces worth showing:

   - `window` — a neutral app window. Three dots, a title, an optional right-hand
     meta slot. The dots are GREY, not macOS red/amber/green: the shell of this
     site carries no hue, and three coloured circles at the top of every demo
     would spend the page's entire colour budget on furniture.
   - `whatsapp` — a message thread header. This one IS green, and the exception
     is the rule working as intended: colour on this site lives inside the
     product, and the single most important thing a South African SME owner
     needs to recognise instantly is that their orders still arrive on WhatsApp.
     A grey WhatsApp header communicates nothing. The two greens below are
     WhatsApp's own and are deliberately LOCAL constants, not `--vy-*` tokens —
     they are a piece of someone else's product being depicted, not part of
     Vyso's palette, and putting them in the token set would invite their reuse
     somewhere they would just be decoration.

   ── The shadow ──────────────────────────────────────────────────────────────
   `--vy-shadow-float` is the system's only ambient shadow and this component is
   one of the two places licensed to use it (plan §4). It is on by default here
   and nowhere else; `flat` turns it off for a frame sitting inside a card that
   already has a border. On a dark band the token resolves to `none`, because a
   shadow has nothing to fall on there. */

const WHATSAPP_HEADER = "#075E54";
const WHATSAPP_THREAD = "#ECE5DD";

export type ChromeVariant = "window" | "whatsapp";

export function ChromeFrame({
  children,
  variant = "window",
  /** The window title, or the WhatsApp contact name. */
  title,
  /** Right-hand slot on the window bar: a URL, a status, a timestamp. Ignored
      by the WhatsApp variant, which uses `subtitle` instead. */
  meta,
  /** The line under the contact name — "online", "last seen 09:41". */
  subtitle,
  flat = false,
  className = "",
}: {
  children: React.ReactNode;
  variant?: ChromeVariant;
  title?: string;
  meta?: string;
  subtitle?: string;
  flat?: boolean;
  className?: string;
}) {
  const frame = [
    "overflow-hidden rounded-[var(--vy-radius)] border border-[color:var(--vy-line)]",
    flat ? "" : "shadow-[var(--vy-shadow-float)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "whatsapp") {
    return (
      <div className={frame}>
        <div
          className="flex items-center gap-[12px] px-[14px] py-[10px]"
          style={{ background: WHATSAPP_HEADER }}
        >
          {/* The avatar is a monogram, not a photograph: an invented face on a
              demo is an invented person, and the copy rules do not allow one. */}
          <span
            aria-hidden="true"
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[13px] font-medium text-white"
          >
            {(title ?? "V").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            {title ? (
              <span className="block truncate text-[14px] font-medium text-white">{title}</span>
            ) : null}
            {subtitle ? (
              <span className="block truncate text-[11.5px] text-white/70">{subtitle}</span>
            ) : null}
          </span>
        </div>
        <div className="px-[14px] py-[16px]" style={{ background: WHATSAPP_THREAD }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      <div className="flex items-center gap-[10px] border-b border-[color:var(--vy-line)] bg-[color:var(--vy-surface-2)] px-[14px] py-[10px]">
        <span aria-hidden="true" className="flex shrink-0 gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-full bg-[color:var(--vy-line-2)]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[color:var(--vy-line-2)]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[color:var(--vy-line-2)]" />
        </span>
        {title ? (
          <span className="vy-label truncate text-[11px] text-[color:var(--vy-ink-3)]">
            {title}
          </span>
        ) : null}
        {meta ? (
          <span className="vy-label ml-auto shrink-0 text-[11px] text-[color:var(--vy-ink-4)]">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="bg-[color:var(--vy-surface)]">{children}</div>
    </div>
  );
}

/* ── The WhatsApp message bubble ─────────────────────────────────────────────
   Exported alongside the frame because a WhatsApp chrome with no bubbles in it
   is not a demo of anything, and every page that shows an incoming order needs
   the same two shapes. `side="in"` is the customer, `side="out"` is the
   business. The out-bubble green is WhatsApp's, for the reason in the header. */
export function WhatsAppBubble({
  children,
  side = "in",
  time,
  className = "",
}: {
  children: React.ReactNode;
  side?: "in" | "out";
  /** A STATIC string. Never `Date.now()` — a timestamp computed at render time
      differs between the server and the client and throws a hydration error, and
      it also makes a demo that claims to be a record of something look like it
      happened this second, every second. */
  time?: string;
  className?: string;
}) {
  const out = side === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"} ${className}`.trim()}>
      <div
        className="max-w-[80%] rounded-[var(--vy-radius)] px-[12px] py-[8px] text-[14px] leading-[1.5] text-[#111B21]"
        style={{ background: out ? "#DCF8C6" : "#FFFFFF" }}
      >
        {children}
        {time ? (
          <span className="vy-mono mt-[4px] block text-right text-[10.5px] text-[#667781]">
            {time}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default ChromeFrame;
