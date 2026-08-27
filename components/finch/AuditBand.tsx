import { Band } from "./ground/Band";
import { CTA_TILE_DIM, GradientRibbon } from "./ground/GradientRibbon";
import { MagneticButton } from "./text/MagneticButton";

/* ── The closing CTA ─────────────────────────────────────────────────────────
   Two shapes of the same offer; round 3 (Josh: "I love the orange and blue
   gradient. Replace the black background on the Book-your-audit tiles across
   the site with that gradient as the background") puts the same ground under
   both of them.

   **`default` — the dark plate on paper.** What every one of the ~18 routes
   that import this had before 6b, restored to a plate (not a full-bleed band)
   by the 6b-fixes rounds — see the file's own history in
   `.ai/implementation_phase6.md` for why. The plate keeps its 16px radius and
   its paper surroundings; only its own fill changes, from flat `#14120E` to
   `GradientRibbon` dimmed to `CTA_TILE_DIM` — the plate is small enough (and
   the copy dark enough behind it) that the gradient reads as a warm surface,
   not a smear.

   **`home` — the ink band, the whole band on the gradient now.** Previously a
   full-bleed ink band with a *separate* 240px `GradientRibbon` strip reserved
   under the copy — §3's "spend the site's one gradient here and nowhere else"
   rule, from when the gradient was reserved for exactly one strip. Round 3
   spends it on every closing tile, so the strip's own reasoning (a moving
   accent under static copy) folds into the band itself: `GradientRibbon`
   dimmed to `CTA_TILE_DIM` is now the **whole band's** background, via `Band`'s
   own `device` slot, the same way every other band on the site paints a living
   ground. The copy sits directly on it — no more 36–56px gap up to a strip
   that used to start partway down the band.

   Heights are content-driven in both, same as every other band on the site:
   the ground's own padding preset plus whatever is in it, no `min-height`, no
   reserved spacer box now that the ribbon isn't a separate element.

   **The button.** Orange-on-gradient risks orange-on-orange in the tile's
   warm half, so both variants use `tone="ink"` (`MagneticButton.tsx`) — a
   `--fn-ink` fill, `--fn-ink-text` text, `--fn-ink-fill` on hover. Every other
   "Book your audit" button on the site stays orange; this is the one ground
   where orange is the background, not the control.

   Under reduced motion `GradientRibbon` renders a static, full-bleed CSS
   gradient built from the same stops (`color-mix` toward `--fn-ink` by
   `CTA_TILE_DIM`) rather than a frozen canvas frame or the thin hairline the
   original strip used — see `GradientRibbon.tsx` for why the two
   reduced-motion forms differ by `dim`.                                        */

/* `.ai/plan_home_only.md`, change 4: the audit is free. It was a paid week
   credited against the first month; it is about an hour with you now, and the
   credit language goes with the fee. */
const COPY = {
  h2: "Start with a free operations audit.",
  body:
    "About an hour with you, free. We tell you where the money is leaking whether you work with us or not.",
} as const;

/** The one lockup the three closing CTAs on the site share (`AuditBand`,
    `pricing/AuditCta`, `compare/CooCta`): serif h2 at 28/34, body at 15/15.5 on
    the ground's secondary, one magnetic button at 16px. */
function CtaCopy() {
  return (
    <div>
      <h2 className="m-0 mb-[12px] max-w-[560px] font-fn-serif text-[28px] font-medium leading-[1.18] tracking-[-0.02em] text-fn-ink-text lg:text-[34px]">
        {COPY.h2}
      </h2>
      <p className="m-0 max-w-[520px] text-[15px] leading-[1.65] text-fn-ink-text-2 text-pretty lg:text-[15.5px]">
        {COPY.body}
      </p>
    </div>
  );
}

/** Where "Book your audit" goes. `/operations-audit` for every page that is
    not already in the audit cluster; the two tool pages under it pass
    `/operations-audit#book` instead, because sending someone who has just been
    handed a finding back to the top of a page they came from is a step they
    then have to undo. */
const CTA_HREF = "/operations-audit";

function Cta({ page, href }: { page: string; href: string }) {
  return (
    <MagneticButton
      href={href}
      tone="ink"
      event="book_audit_click"
      eventProps={{ page }}
      className="shrink-0 whitespace-nowrap text-[16px]"
    >
      Book your free audit
    </MagneticButton>
  );
}

const ROW =
  "flex flex-col items-start gap-[26px] lg:flex-row lg:items-center lg:justify-between lg:gap-[48px]";

export function AuditBand({
  variant = "default",
  href = CTA_HREF,
}: {
  variant?: "default" | "home";
  href?: string;
}) {
  if (variant === "home") {
    return (
      <Band ground="ink" device={<GradientRibbon dim={CTA_TILE_DIM} />}>
        <div className={ROW}>
          <CtaCopy />
          <Cta page="home-cta" href={href} />
        </div>
      </Band>
    );
  }

  return (
    <Band ground="paper">
      <div className="fn-ground-grain relative isolate overflow-hidden rounded-[16px] bg-fn-ink px-[24px] py-[36px] lg:px-[56px] lg:py-[52px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[16px]"
        >
          <GradientRibbon dim={CTA_TILE_DIM} />
        </div>
        <div className={ROW}>
          <CtaCopy />
          <Cta page="audit-band" href={href} />
        </div>
      </div>
    </Band>
  );
}

export default AuditBand;
