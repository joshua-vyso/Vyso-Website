import type { ReactNode } from "react";

import { OrbitFooter } from "./OrbitFooter";
import { OrbitNav, type OrbitNavSection } from "./OrbitNav";

/* ── The subsite shell ───────────────────────────────────────────────────────
   Every page under `/orbit` is this: nav, `<main id="main">`, footer, on the
   dark ground.

   **Both classes, in this order.** `finch-site` first, because the Orbit pages
   depend on four rules that live under it in `globals.css` — the unlayered
   link reset, the 20px mobile section gutter, the `overflow-x: clip` fix that
   keeps `position: sticky` working (the scroll sequence needs it), and the
   `prefers-reduced-motion` animation kill. `orbit-site` second, because it
   remaps the paper tokens those rules assume. Dropping either one breaks
   something that is not obvious until you scroll.

   This is a **layout component, not a route layout.** `app/orbit/layout.tsx`
   would have to be given the active nav section by every page anyway (a layout
   cannot read which child rendered), and the only other thing it could carry —
   a `title.template` — would eat into the 60-character budget that the root
   layout's " | Vyso" suffix already spends 7 of. So each page composes this
   directly, exactly as the Finch pages compose `FinchNav` + `FinchFooter`.    */

export function OrbitShell({
  active = "none",
  children,
}: {
  active?: OrbitNavSection;
  children: ReactNode;
}) {
  return (
    <div className="finch-site orbit-site min-h-screen font-fn-sans text-ob-text antialiased">
      <OrbitNav active={active} />
      <main id="main">{children}</main>
      <OrbitFooter />
    </div>
  );
}

export default OrbitShell;
