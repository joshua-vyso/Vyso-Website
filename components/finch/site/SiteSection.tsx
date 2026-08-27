import Link from "next/link";

import { Band, type Ground } from "@/components/finch/ground/Band";

/* ── Section furniture for the repositioned pages ────────────────────────────
   Site repositioning Phase 3 (`.ai/plan_site_repositioning.md`, brief §13),
   revised by Phase 3.5 (AMENDMENT 2).

   `/`, `/industries`, `/industries/hotels`, `/how-we-work` and
   `/operations-audit` are written to a looser measure than the rest of the
   site: more air between sections (96px mobile / 140px desktop against the
   industries cluster's 72/110), a longer body line height (1.7 against 1.65)
   and fewer boxes.

   Deliberately a small local set rather than an import from
   `components/finch/industries/IndustryBits.tsx`: those are that cluster's own
   rhythm, and changing them would have moved five pages that are not in this
   phase. The shared contract is the visual language (`--fn-*` tokens, the mono
   eyebrow, the STIX heading), not a shared module.

   ── What AMENDMENT 2 changed ────────────────────────────────────────────────
   Phase 3 read brief §13 as "paper, everywhere, forever": no bands, no
   gradients, no devices. The owner reviewed the result and rejected it. So the
   furniture grows the two things it was missing rather than being replaced:

   1. **A tone.** The eyebrow / heading / lead ramp now resolves against the
      ground it is standing on, so the same section lockup can sit on paper,
      blue or ink and take the right three colours without a caller restating
      them. Paper is the default and is byte-identical to what Phase 3 shipped.
   2. **`BandSection`.** The same lockup inside a `Band` — one ground, one
      device, `data-ground` for `NavGround`'s inversion — which is how every
      deep-contrast section on the rest of the site is already built. A page
      alternates by using `Section` and `BandSection` in turn; adjacent bands
      never share a ground, exactly as `Band.tsx` requires.

   Every piece here is a server component. */

export type SectionTone = "paper" | "blue" | "ink";

/** The three-step text ramp per ground. The values are the ones `globals.css`
    measured for AA on each surface — see the `--fn-blue-*` block's contrast
    note; nothing here invents a colour. */
const TONE: Record<SectionTone, { eyebrow: string; heading: string; lead: string }> = {
  paper: { eyebrow: "text-fn-muted",      heading: "text-fn-ink",        lead: "text-fn-ink-2" },
  blue:  { eyebrow: "text-fn-blue-mono",  heading: "text-fn-blue-text",  lead: "text-fn-blue-text-2" },
  ink:   { eyebrow: "text-fn-ink-mono",   heading: "text-fn-ink-text",   lead: "text-fn-ink-text-2" },
};

/** The mono line every section opens with. Sentence case, not the caps the
    industries cluster uses: brief §2's "sentence case everywhere" is a copy
    rule, and a CSS `uppercase` on a copy string is still the reader seeing
    caps. The letterspacing does the work the caps used to. */
export function Eyebrow({
  children,
  tone = "paper",
}: {
  children: React.ReactNode;
  tone?: SectionTone;
}) {
  return (
    <p
      className={
        "m-0 mb-[16px] font-fn-mono text-[11px] tracking-[0.12em] lg:text-[11.5px] " +
        TONE[tone].eyebrow
      }
    >
      {children}
    </p>
  );
}

const HEADING_CLASS =
  "m-0 mb-[18px] max-w-[760px] font-fn-serif text-[30px] font-medium leading-[1.14] tracking-[-0.022em] text-pretty lg:text-[42px] lg:leading-[1.08]";
const LEAD_CLASS =
  "m-0 mb-[36px] max-w-[640px] text-[15.5px] leading-[1.7] text-pretty lg:mb-[52px] lg:text-[17px]";

/** The lockup itself, shared by `Section` and `BandSection` so the two can
    never drift by a pixel of tracking. */
function SectionHead({
  id,
  eyebrow,
  heading,
  lead,
  tone,
}: {
  id: string;
  eyebrow?: React.ReactNode;
  heading?: React.ReactNode;
  lead?: React.ReactNode;
  tone: SectionTone;
}) {
  return (
    <>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      {heading ? (
        <h2 id={`${id}-heading`} className={HEADING_CLASS + " " + TONE[tone].heading}>
          {heading}
        </h2>
      ) : null}
      {lead ? (
        <p className={LEAD_CLASS + " " + TONE[tone].lead}>{lead}</p>
      ) : (
        <div className="h-[20px] lg:h-[28px]" />
      )}
    </>
  );
}

/** The section frame: generous top gap, eyebrow, STIX heading, optional lead. */
export function Section({
  id,
  eyebrow,
  heading,
  lead,
  tone = "paper",
  children,
  className = "",
}: {
  id: string;
  eyebrow?: React.ReactNode;
  heading?: React.ReactNode;
  lead?: React.ReactNode;
  tone?: SectionTone;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={heading ? `${id}-heading` : undefined}
      className={
        "mx-auto max-w-[1160px] px-[20px] pt-[80px] lg:px-[40px] lg:pt-[128px] " + className
      }
    >
      <SectionHead id={id} eyebrow={eyebrow} heading={heading} lead={lead} tone={tone} />
      {children}
    </section>
  );
}

/** The same lockup on a deep ground. One `Band`, one device, and the ground's
    own text ramp — the composition every dark section on the rest of the site
    already uses (`AuditHour`, `AuditStatement`, `PlatformShowcase`). */
export function BandSection({
  id,
  ground,
  device,
  eyebrow,
  heading,
  lead,
  overlap,
  paddingClassName,
  children,
  className = "",
}: {
  id: string;
  /** `paper` is available but pointless here — use `Section` for paper. */
  ground: Extract<Ground, "blue" | "ink">;
  device?: React.ReactNode;
  eyebrow?: React.ReactNode;
  heading?: React.ReactNode;
  lead?: React.ReactNode;
  overlap?: "up" | "down";
  paddingClassName?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Band
      id={id}
      ground={ground}
      device={device}
      overlap={overlap}
      paddingClassName={paddingClassName}
      className={className}
    >
      <SectionHead id={id} eyebrow={eyebrow} heading={heading} lead={lead} tone={ground} />
      {children}
    </Band>
  );
}

/** The quiet arrow link that points a section somewhere else. */
export function ArrowLink({
  href,
  children,
  tone = "paper",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: SectionTone;
  className?: string;
}) {
  const colour =
    tone === "paper"
      ? "text-fn-ink-2 hover:text-fn-orange-deep"
      : tone === "blue"
        ? "text-fn-blue-text hover:text-fn-orange-on-ink"
        : "text-fn-ink-text hover:text-fn-orange-on-ink";

  return (
    <Link
      href={href}
      className={
        "group inline-flex min-h-[44px] items-center gap-[8px] text-[15px] font-medium transition-colors duration-150 " +
        colour +
        " " +
        className
      }
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
      >
        &rarr;
      </span>
    </Link>
  );
}

/* ── The card ────────────────────────────────────────────────────────────────
   Phase 3's card was a 1px border on a 12px radius with nothing else: no rest
   shadow, no hover, no movement. Six of them in a grid is the flat rectangle
   the owner rejected.

   AMENDMENT 2 keeps the 1px border — it is still what draws structure on this
   site — and adds the two things folk and attio spend on a tile: it **lifts**
   3px and takes the site's own `--fn-shadow-card-hover` on hover, and it
   carries a faint warm surface at rest so the card is a surface rather than an
   outline. Transform and box-shadow only, so the hover is composited and
   nothing relayouts. */
export const CARD_BASE =
  "rounded-[14px] border transition-[transform,box-shadow,border-color] duration-[260ms] ease-out " +
  "motion-reduce:transition-none motion-reduce:hover:transform-none";

/** A paper card. */
export const CARD_CLASS =
  CARD_BASE +
  " border-fn-line bg-fn-surface px-[22px] py-[24px] shadow-[0_1px_2px_rgba(20,18,14,.04)] " +
  "hover:-translate-y-[3px] hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card-hover)] " +
  "lg:px-[26px] lg:py-[28px]";

/** A card standing on a blue band: the band's own facet range, one step up, a
    light hairline, and the same lift. Measured against `--fn-blue-500`
    (#27649F), the lightest thing under it — `--fn-blue-text` reads 5.85:1 and
    `--fn-blue-text-2` 5.16:1 on that, so the translucent white here (which only
    ever *lightens* the ground it sits on) cannot take either below AA. */
export const CARD_ON_BLUE =
  CARD_BASE +
  " border-[color:color-mix(in_srgb,var(--fn-blue-300)_60%,transparent)] bg-[rgba(255,255,255,0.07)] " +
  "px-[22px] py-[24px] hover:-translate-y-[3px] " +
  "hover:border-[color:var(--fn-blue-300)] hover:bg-[rgba(255,255,255,0.11)] lg:px-[26px] lg:py-[28px]";

/* ── The accent wash ─────────────────────────────────────────────────────────
   The owner's "beautiful orange-blue gradients", in the one form a *card* can
   carry it without becoming a gradient card: two very low-alpha radial stops,
   orange out of one corner and blue out of the opposite one, over the card's
   own paper surface. It is the same two hues `--fn-grad` runs between, laid
   flat rather than swept, so the flagship tile reads as lit rather than
   painted. Static — `.ai/vyso_v3_design.md` §1.3's "no animated gradient
   fills" is untouched by this. */
export const ACCENT_WASH =
  "radial-gradient(120% 130% at 0% 0%, rgba(255,119,39,0.13) 0%, rgba(255,119,39,0) 58%), " +
  "radial-gradient(120% 130% at 100% 100%, rgba(75,150,221,0.16) 0%, rgba(75,150,221,0) 58%)";
