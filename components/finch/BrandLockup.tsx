import Image from "next/image";

/* ── The lockup ──────────────────────────────────────────────────────────────
   **Vyso | Finch** and **Vyso | Orbit**, from one file.

   Josh's note on the Orbit launch (2026-08-19) was that the subsite's top-left
   read only "Orbit", while Finch's read only "Vyso" in its footer and
   "Vyso | Finch" in its nav — three different answers to the question "whose
   site is this?". Two products, one company; the lockup is where that is
   stated, so it is stated in one place and both sites import it.

   ── The shape ───────────────────────────────────────────────────────────────
   Company wordmark · a 1px divider · the product. Always in that order, always
   with the same divider, and always as ONE link with ONE accessible name
   ("Vyso — Finch" / "Vyso — Orbit"). The parts carry `alt=""` because a lockup
   is a single mark: three announcements ("Vyso", "divider", "Orbit") for one
   graphic is what the `aria-label` on the anchor exists to prevent.

   ── Why the two products differ inside it ───────────────────────────────────
   Finch has no logotype of its own — it is set, as it always has been, in the
   site's serif at the wordmark's optical weight. Orbit does: `orbit-primary-
   dark.svg` is a real mark (the ring replacing the O), and drawing it as text
   next to its own logo elsewhere on the page would be two Orbits.

   ── Grounds ─────────────────────────────────────────────────────────────────
   `tone` picks the company wordmark's artwork rather than filtering it:

   - `ink` (Finch, paper pages) loads `/finch/vyso-wordmark.svg`, black artwork.
     Over a dark band `globals.css` inverts it — which is why the divider keeps
     its `bg-fn-line-3` class, because the same block keys the divider's own
     inversion on exactly that selector.
   - `paper` (Orbit, dark pages) loads `/orbit/vyso-wordmark-paper.svg`, the same
     paths at `--ob-text`. A filter would land on `#FFFFFF`, not on the warm
     white every other glyph on the subsite is set in, and `OrbitNav` is
     labelled `Orbit` precisely to opt out of that filter block.               */

export type BrandProduct = "finch" | "orbit";

/** `nav` is the responsive one — the desktop nav steps up above `lg`; `sheet`
    and `footer` are fixed, because a mobile sheet is only ever mobile and a
    footer brand row does not want to grow. */
export type BrandLockupSize = "nav" | "sheet" | "footer";

const VYSO_H: Record<BrandLockupSize, string> = {
  nav:    "h-[13px] lg:h-[15px]",
  sheet:  "h-[13px]",
  footer: "h-[12px]",
};

const RULE_H: Record<BrandLockupSize, string> = {
  nav:    "h-[14px] lg:h-[16px]",
  sheet:  "h-[14px]",
  footer: "h-[13px]",
};

/** Finch's product word, set in the site serif. */
const FINCH_TEXT: Record<BrandLockupSize, string> = {
  nav:    "text-[16px] lg:text-[18px]",
  sheet:  "text-[16px]",
  footer: "text-[14px]",
};

/** Orbit's product mark. Taller than the wordmark beside it because the ring
    occupies the full box, so its letters land at the wordmark's cap height. */
const ORBIT_H: Record<BrandLockupSize, string> = {
  nav:    "h-[24px] lg:h-[27px]",
  sheet:  "h-[24px]",
  footer: "h-[21px]",
};

const GAP: Record<BrandLockupSize, string> = {
  nav:    "gap-[10px] lg:gap-[12px]",
  sheet:  "gap-[10px]",
  footer: "gap-[9px]",
};

export function BrandLockup({
  product,
  size = "nav",
  tone = product === "orbit" ? "paper" : "ink",
  className = "",
}: {
  product: BrandProduct;
  size?: BrandLockupSize;
  /** Which company wordmark artwork to load. Defaults by product, because
      Finch is a paper site and Orbit is a dark one; overridable for the one
      case that breaks the rule (a Finch component drawn on ink). */
  tone?: "ink" | "paper";
  className?: string;
}) {
  const paper = tone === "paper";
  return (
    <span aria-hidden className={`flex items-center ${GAP[size]} ${className}`}>
      <Image
        src={paper ? "/orbit/vyso-wordmark-paper.svg" : "/finch/vyso-wordmark.svg"}
        alt=""
        width={59}
        height={15}
        priority={size === "nav"}
        className={`block w-auto ${VYSO_H[size]}`}
      />
      {/* `bg-fn-line-3` is load-bearing on the Finch side — see the header. On
          Orbit `--fn-line-3` is remapped to `--ob-line`, which is a step too
          dark to read as a rule against the ground, so the subsite states its
          own. */}
      <span className={`w-px ${RULE_H[size]} ${paper ? "bg-white/25" : "bg-fn-line-3"}`} />
      {product === "orbit" ? (
        <Image
          src="/orbit/orbit-primary-dark.svg"
          alt=""
          width={1200}
          height={425}
          priority={size === "nav"}
          className={`block w-auto ${ORBIT_H[size]}`}
        />
      ) : (
        <span className={`font-fn-serif tracking-[-0.01em] ${FINCH_TEXT[size]}`}>Finch</span>
      )}
    </span>
  );
}

/** The accessible name for the link the lockup sits inside. An em dash rather
    than the pipe the eye reads, because a screen reader says "vertical bar". */
export const BRAND_LABEL: Record<BrandProduct, string> = {
  finch: "Vyso — Finch",
  orbit: "Vyso — Orbit",
};

export default BrandLockup;
