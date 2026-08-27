import { Footer } from "./Footer";
import { Nav } from "./Nav";
import type { VysoNavSection } from "./Nav";

/* ── The shell ───────────────────────────────────────────────────────────────
   Nav, `<main id="main">`, footer — and the `.vyso-site` class, which is the
   only thing that switches a page onto the `--vy-*` palette. A page that
   forgets the shell renders in the old marketing theme, which is loud enough to
   catch at a glance; that is the intended failure mode.

   ── The skip link is NOT rendered here, on purpose ──────────────────────────
   `app/layout.tsx` mounts `components/finch/SkipLink` once, above every route,
   and it targets `#main`. Rendering a second one inside this shell would put
   two identical "Skip to content" tab stops in front of every keyboard user on
   every Vyso page — the accessibility feature, doubled, is worse than the
   feature. What this component owes the global one instead is the `id="main"`
   it jumps to, which is why that id is written here rather than left to each
   page. If the Finch surface is ever deleted and the global mount goes with it,
   the skip link moves in here; until then the contract is "one skip link, in
   the root layout".

   `min-h-screen` on the wrapper so a short page's footer still sits at the
   bottom of the viewport rather than halfway up it. */

export function Shell({
  children,
  /** Which nav item the current page is, so it can carry `aria-current="page"`
      and the active ink. */
  active = "none",
  /** Drop the footer. Only for a route that ends in its own full-bleed thing
      and is not a marketing page at all; every real page keeps it. */
  footer = true,
  className = "",
}: {
  children: React.ReactNode;
  active?: VysoNavSection;
  footer?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`vyso-site min-h-screen antialiased ${className}`.trim()}
    >
      <Nav active={active} />
      {/* `tabIndex={-1}`: the root `SkipLink` (`app/layout.tsx`) is a plain
          `href="#main"` anchor with no client JS, which is enough to move the
          browser's scroll position here but not enough, on its own, to move
          keyboard focus onto an element that is not natively focusable — a
          `<main>` has no tabindex by default, so the jump landed the viewport
          here while focus stayed on `<body>`, and a keyboard user's next Tab
          press resumed from the top of the document instead of from the
          content they just skipped to. `-1` makes the element focus-target-able
          (`element.focus()`, and the browser's own post-fragment-navigation
          focus step) without adding it to the normal Tab order. */}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      {footer ? <Footer /> : null}
    </div>
  );
}

export default Shell;
