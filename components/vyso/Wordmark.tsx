import Image from "next/image";

/* ── The wordmark ────────────────────────────────────────────────────────────
   ONE brand. The Vyso redesign is the point at which the site stops being a
   parent company plus a product name, so there is no lockup here — no divider,
   no second word. `components/finch/BrandLockup.tsx` still draws `Vyso | Finch`
   and `Vyso | Orbit` for the surfaces that still need them; this is the same
   artwork, alone.

   `/finch/vyso-wordmark.svg` is the existing BLACK asset (the path is historical
   — the file predates the split and is referenced from `BrandLockup`; it is not
   moved here, because moving a public asset would break the Finch and Orbit
   navs that still load it).

   `alt=""` and `aria-hidden`: the wordmark is always inside a link that carries
   its own accessible name, so announcing "Vyso" twice is what this prevents. */

export type WordmarkSize = "nav" | "sheet" | "footer";

const HEIGHT: Record<WordmarkSize, string> = {
  nav: "h-[14px] lg:h-[16px]",
  sheet: "h-[14px]",
  footer: "h-[13px]",
};

export function Wordmark({
  size = "nav",
  /** Invert to paper artwork. There is no light SVG of this mark, and a filter
      is the honest way to get one from black line art with no `currentColor`
      inside it — the same trick the Finch nav's ground inversion uses. */
  tone = "ink",
  className = "",
}: {
  size?: WordmarkSize;
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <Image
      src="/finch/vyso-wordmark.svg"
      alt=""
      aria-hidden="true"
      width={59}
      height={15}
      priority={size === "nav"}
      className={`block w-auto ${HEIGHT[size]} ${tone === "paper" ? "invert brightness-[1.6]" : ""} ${className}`}
    />
  );
}

export default Wordmark;
