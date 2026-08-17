/* ── The bird, in one colour ─────────────────────────────────────────────────
   `/finch/finch-bird.svg` is a stroked line drawing whose strokes carry the
   brand's own orange→blue gradients. That is exactly right on paper and wrong
   on a dark ground: the blue half of the tail drops to ~2:1 against ink, and
   next to a Statement the multi-colour mark competes with the one orange
   element §2 allows the band.

   So on dark grounds the same file is used as a **mask** rather than an image:
   the alpha channel (the strokes) punches a shape out of a single flat colour,
   which the caller names. No second asset, no inline copy of the path data to
   drift out of sync with the real logo — one file, two treatments.

   A server component: a mask is a paint, and `-webkit-mask-image` is still
   needed for WebKit, which is why both properties are written.                */

export type FinchBirdMarkProps = {
  /** Any CSS colour or token reference, e.g. `var(--fn-orange-on-ink)`. */
  color: string;
  /** Square, in px. */
  size?: number;
  className?: string;
};

const SRC = "url(/finch/finch-bird.svg)";

export function FinchBirdMark({ color, size = 44, className = "" }: FinchBirdMarkProps) {
  return (
    <span
      aria-hidden
      className={"inline-block shrink-0 " + className}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        maskImage: SRC,
        WebkitMaskImage: SRC,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export default FinchBirdMark;
