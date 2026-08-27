/* ── The grid stagger, in a module with no directive ─────────────────────────
   `stagger` is a plain function, but it is consumed by **server** components
   (`app/page.tsx`) that map a list and hand each `Reveal` its delay. Every
   export of a `"use client"`
   module reaches a server component as an opaque client *reference*, not as
   the value — calling one throws "Attempted to call stagger() from the server
   but stagger is on the client". Same trap `text/statement-class.ts` was split
   out to avoid, same fix.

   `Reveal.tsx` re-exports it, so a client component may keep importing it from
   there; a server component must import it from here.

   60ms a step, capped at the fifth item so the sixth card in a grid is not
   still waiting when the reader has finished reading the first. */
export const stagger = (index: number, step = 0.06, cap = 5) =>
  Math.min(index, cap) * step;
