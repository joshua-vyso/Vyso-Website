/* ── The Statement's typography, as a plain module ───────────────────────────
   This is one string, and it lives on its own for a reason that has bitten this
   codebase before (`components/finch/day/day-beats.ts` documents the same
   trap): **in the App Router every export of a `"use client"` module becomes an
   opaque client reference when a *server* module imports it.** `Statement.tsx`
   carries `"use client"`, so a server component doing

       import { STATEMENT_CLASS } from "./Statement";
       <span className={STATEMENT_CLASS + " text-fn-ink-text"}>

   does not get a class list — it gets `class="function() {…"` serialised into
   the HTML and a headline at body size. Measured on
   `/compare/finch-vs-hiring-a-coo` before this file existed.

   So the constant sits in a module with no directive, which both sides may
   import. `Statement.tsx` re-exports it for the client components that already
   speak that import path; **server** components must import it from here.     */

/** Five words at most, one of them optionally italic. STIX 500 at 52px on
    mobile and 72 on desktop — the size a band-sized claim needs, and the size
    every wave-riding headline has to match without restating five utilities. */
export const STATEMENT_CLASS =
  "font-fn-serif font-medium tracking-[-0.02em] text-balance " +
  "text-[52px] leading-[1.04] lg:text-[72px] lg:leading-[1.0]";
