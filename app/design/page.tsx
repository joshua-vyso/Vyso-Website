import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinchNav } from "@/components/finch/FinchNav";

import { DesignSink } from "./DesignSink";

/* ── `/design` — the kitchen sink ────────────────────────────────────────────
   Every phase-6a primitive on every ground, with the controls and meters
   needed to judge it (`.ai/plan_phase6a_primitives.md` §6). Built for one
   review: Josh and Fable look at this on localhost before 6b recomposes the
   real pages.

   **Not a public route.** Two independent guards, because one is not enough:

   1. `notFound()` in production unless `NEXT_PUBLIC_DESIGN_ROUTE=1`. This is
      the real gate — the route 404s on the deployed site, so there is nothing
      to find whatever a crawler does.
   2. `robots: noindex, nofollow` on top of that, for the case where the env
      var IS set (a preview deploy Josh wants to look at from his phone).

   It is also absent from `app/sitemap.ts` by construction — that file
   enumerates a hand-written list, and this is not on it.                       */

export const metadata: Metadata = {
  title: { absolute: "Design sink — Vyso" },
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DESIGN_ROUTE !== "1") {
    notFound();
  }

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      {/* The real nav, so the ground-inversion observer has something to
          invert — this is the only page with `data-ground` bands until 6b. */}
      <FinchNav />
      <main id="main">
        {/* The sink's own h1: every page on this site has exactly one, and a
            review page is not an exception worth making. */}
        <h1 className="sr-only">Vyso design sink — phase 6a primitives</h1>
        <DesignSink />
      </main>
    </div>
  );
}
