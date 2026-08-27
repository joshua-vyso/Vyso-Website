import type { Metadata } from "next";

import { Button } from "@/components/vyso/Button";
import { Shell } from "@/components/vyso/Shell";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/* ── The global 404 ───────────────────────────────────────────────────────────
   Phase 5 finding: this file was never touched by Phases 0 to 4, so every
   route on the rebuilt site was still shipping the Finch-era 404 underneath
   it — `.finch-site` chrome, `FinchNav`/`FinchFooter`, a "See how Finch
   works" link to the retired `/finch#agents` anchor, and an on-page sentence
   naming Finch directly ("or it moved when we rebuilt around Finch"). Next
   embeds this boundary's RSC payload on every page (it is how the framework
   pre-wires client-side 404 handling), so the old copy and class names were
   present in the rendered HTML of every route on the site, not just on a
   404 hit. Rewritten onto the `--vy-*` shell with the same job: say the page
   is gone, and offer three real ways back in.

   No bird mascot: `BirdHop` renders `/finch/finch-bird.svg`, the Finch brand
   mark, which has no place on a site that has fully repositioned away from
   Finch (plan §2, §3.2). Dropped rather than replaced — a 404 page earns its
   personality from the copy, not from a mascot the new brand doesn't have. */
export default function NotFound() {
  return (
    <Shell>
      {/* `Shell` already renders `<main id="main">`; this is that main's only
          child, not a second landmark. */}
      <div className="mx-auto flex max-w-[560px] flex-col items-center px-[var(--vy-gutter)] pt-[96px] pb-[140px] text-center md:px-[40px] md:pt-[140px] md:pb-[180px]">
        <p className="vy-label mb-[20px] text-[color:var(--vy-ink-4)]">404</p>
        <h1 className="vy-h2 text-[color:var(--vy-ink)]">Page not found.</h1>
        <p className="vy-body-lg mt-[16px] max-w-[440px] text-[color:var(--vy-ink-3)] text-pretty">
          This page doesn&rsquo;t exist, or it moved when we rebuilt the site. Nothing to recover
          here.
        </p>

        <div className="mt-[36px] flex flex-wrap items-center justify-center gap-[12px]">
          <Button href="/" size="md">
            Go home
          </Button>
          <Button href="/how-it-works" variant="secondary" size="md">
            See how it works
          </Button>
          <Button href="/operations-audit" variant="secondary" size="md">
            Book your audit
          </Button>
        </div>
      </div>
    </Shell>
  );
}
