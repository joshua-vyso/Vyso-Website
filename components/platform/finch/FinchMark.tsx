'use client';

import { FinchBirdMark } from '@/components/finch/FinchBirdMark';

/**
 * The Finch mark on the platform — the brand's bird, in white, sat on the blue
 * gradient.
 *
 * ONE BIRD, ONE FILE. The artwork is `public/finch/finch-bird.svg`, the same
 * file the marketing site draws, used the same way: as a MASK, so the strokes
 * punch a shape out of a flat colour instead of carrying the logo's own
 * orange→blue gradients (which fight the blue chip they would sit on, and drop
 * to ~2:1 contrast against it). That technique — and the reasoning — lives in
 * `components/finch/FinchBirdMark.tsx`, which is imported here rather than
 * reimplemented: a second copy of the mark is how the product and the website
 * end up wearing two different birds, and a second copy of the PATH DATA is how
 * they drift out of sync with the real logo. This module is the platform's
 * wrapper around it: the white colour, the gradient chip, the draw-in.
 *
 * WHITE, ALWAYS. Every place this renders, the ground underneath it is the blue
 * gradient — the collapsed bubble pill, the dock and onboarding header discs,
 * the assistant's avatar in a transcript. White is the only colour that holds on
 * all of them, and holding one colour is what makes the mark recognisable at
 * 20px.
 *
 * SIZE IS THE BIRD, NOT THE DISC. The stroke is ~3.8% of the artwork's box, so a
 * 13px bird is a half-pixel line and reads as a smudge. Callers that already
 * draw their own gradient circle (all of them, today) should therefore ask for a
 * bird about 70% of that circle's diameter and NOT pass `chip` — a 24px disc
 * wants `size={17}`. `chip` is kept for a caller that has no disc of its own; it
 * draws one at the same 1.8× footprint the padded version always had.
 *
 * `animate="draw"` plays a one-time gentle pop/fade on mount (honours
 * prefers-reduced-motion via the `.finch-mark-pop` rule in globals.css). Default
 * is static.
 */
export function FinchMark({
  size = 20,
  title = 'Finch',
  animate = 'none',
  chip = false,
}: {
  /** The BIRD's square, in px — not the disc's, when `chip` is set. */
  size?: number;
  /** Accessible name. Pass `''` where the mark sits beside the word "Finch"
   *  and would otherwise be read twice. */
  title?: string;
  animate?: 'draw' | 'none';
  /** Draw the blue gradient disc too. Off by default: every mount site in the
   *  platform draws its own, and nesting one gradient disc inside another gives
   *  two independently-animating gradients stacked a pixel apart. */
  chip?: boolean;
}) {
  const bird = (
    <FinchBirdMark
      color="#FFFFFF"
      size={size}
      className={animate === 'draw' ? 'finch-mark-pop' : ''}
    />
  );

  // FinchBirdMark is `aria-hidden` (it is a painted shape). When the mark has to
  // carry a name, the wrapper carries it — role + label on the element, so the
  // mask underneath stays out of the tree.
  const labelled = title ? (
    <span role="img" aria-label={title} className="inline-flex">
      {bird}
    </span>
  ) : (
    bird
  );

  if (!chip) return labelled;

  // 0.4 × size of padding on each edge — the footprint the traced-glyph version
  // had, kept so a caller that swaps `chip` on does not have to re-measure.
  const pad = Math.max(5, Math.round(size * 0.4));
  return (
    <span
      className="finch-gradient"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        padding: pad,
        boxShadow: '0 2px 10px -2px rgba(62,143,224,0.6)',
      }}
    >
      {labelled}
    </span>
  );
}
