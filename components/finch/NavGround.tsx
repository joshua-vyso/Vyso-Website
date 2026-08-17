"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ROUTE_FADE_END } from "./RouteFade";

/* ── Which ground is the nav sitting on? ─────────────────────────────────────
   §8: the nav inverts over blue and ink bands — text goes to `--fn-ink-text`,
   the CTA stays orange. This is the measuring half; `FinchNav` reads the result
   through a CSS selector, so the nav itself stays a server component and the
   inversion costs no hydration.

   How it works: every `Band` carries `data-ground`. This walks their rects and
   answers one question — **which band contains the nav's vertical centre right
   now** — writing the answer to `<html>` as `data-nav-ground`, where
   `globals.css` inverts from. Direct attribute writes rather than React state
   on purpose: this fires on every scroll past a band boundary, and re-rendering
   the nav for it would be the most expensive way to change one colour.

   ── 6b fixes r2: the four moments it has to be right, not just one ───────────
   The first version ran on mount, `scroll` and `resize` only, and asked the
   question with `elementsFromPoint`. Both halves of that were wrong:

   1. **Route changes never fired it.** `NavGround` lives in the root layout, so
      a client-side navigation does not remount it, and the new page's first
      band is already under the nav — there is no scroll event to notice it
      with. `/pricing`'s ink hero arrived with dark-on-dark nav text and stayed
      that way until the reader scrolled; `/` arrived still inverted, warm-white
      on paper. Fixed by re-running on `usePathname()` change **and** on
      `ROUTE_FADE_END` (whichever lands later wins, and both are idempotent),
      because `RouteFade` animates `.finch-site`'s wrapper and a band's rect is
      only final once the new page has finished laying out under it.
   2. **A hit test asks the wrong thing.** `elementsFromPoint` returns whatever
      paints at a pixel, which on a page whose hero has a device canvas, a glow
      or a straddling card is not necessarily the band. Rects are the actual
      question: a band either spans the probe line or it does not. Document
      order breaks the tie, so a seamed band (`-mt-[48px] z-10`, always a later
      sibling) wins over the band it overlaps — which is exactly the one the
      reader sees.

   **First paint on a hard load** is not this component's to fix — nothing has
   hydrated yet. A page whose hero is a dark `underNav` band declares it on its
   own wrapper (`data-nav-hero="ink"`), and `globals.css` inverts from that for
   as long as `<html>` has no `data-nav-ground` of its own. This component sets
   that attribute on mount, unconditionally, which is what switches the static
   fallback off — so the two can never disagree, and there is no flash in
   either direction.                                                            */

/** `FinchNav`'s **measured** height: 76px below `lg`, 92px above (18/26px of
    padding around a row whose tallest item is the CTA). The same numbers
    `Band`'s `underNav` pulls a dark hero up by — the probe is that box's
    centre line, so "which ground is the nav on" is asked about the nav's
    actual middle rather than about a line four pixels above its bottom edge. */
const NAV_H = { mobile: 76, desktop: 92 };

function groundUnderNav(): string {
  const probe = (window.innerWidth >= 1024 ? NAV_H.desktop : NAV_H.mobile) / 2;
  let ground: string | undefined;
  /* Document order, last match wins: bands never nest, and where two overlap
     (§2's seam) the later sibling is the one carrying `z-10` and painting on
     top. Zero-height nodes are skipped — a `contain`ed band that has not been
     laid out yet would otherwise claim the line at y=0. */
  for (const el of document.querySelectorAll<HTMLElement>("[data-ground]")) {
    const box = el.getBoundingClientRect();
    if (box.height === 0) continue;
    if (box.top <= probe && box.bottom > probe) ground = el.dataset.ground;
  }
  return ground ?? "paper";
}

function applyNavGround(): void {
  const root = document.documentElement;
  const next = groundUnderNav();
  if (root.dataset.navGround !== next) root.dataset.navGround = next;
}

export function NavGround() {
  const pathname = usePathname();

  /* Listeners: mounted once, never re-bound. `apply` reads the DOM fresh every
     time, so it has no dependencies to go stale. */
  useEffect(() => {
    const root = document.documentElement;

    /* Passive + rAF-coalesced: the walk is cheap, but once per scroll *event*
       is still a hundred times more often than the answer can change. */
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        applyNavGround();
      });
    };

    applyNavGround();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    /* Not coalesced: the fade ending is one event per navigation, and the
       answer is wanted on that frame rather than the next one. */
    window.addEventListener(ROUTE_FADE_END, applyNavGround);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(ROUTE_FADE_END, applyNavGround);
      delete root.dataset.navGround;
    };
  }, []);

  /* Route change: once on the commit (the new page's bands are in the DOM and
     laid out by the time an effect runs) and once on the next frame, because
     the App Router restores scroll position after the commit and a page landing
     at y > 0 would otherwise be measured at the top of the document. The fade's
     own end event is the third and last word. */
  useEffect(() => {
    applyNavGround();
    const frame = requestAnimationFrame(applyNavGround);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

export default NavGround;
