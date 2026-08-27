/* ── The grid stagger, in a module with no directive ─────────────────────────
   `stagger` is a plain function, but almost every caller is a **server**
   component mapping a list and handing each `Reveal` its delay. Every export of
   a `"use client"` module reaches a server component as an opaque client
   *reference* rather than the value, so calling one throws "Attempted to call
   stagger() from the server". `components/finch/site/reveal-stagger.ts` was
   split out for exactly this reason; this is the same split for the Vyso
   surface, and `Reveal.tsx` re-exports it so client callers need not know.

   80ms a step is the CEILING the design system sets (plan §4, "stagger ≤80ms"),
   and this is the only place it is written down. Capped at the fifth item so
   the sixth card in a grid is not still waiting when the reader has finished
   reading the first. */
export const stagger = (index: number, step = 0.07, cap = 5) =>
  Math.min(index, cap) * Math.min(step, 0.08);
