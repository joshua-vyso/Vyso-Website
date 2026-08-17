import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { RAIL } from "@/components/finch/ground/Band";
import { SplitReveal } from "@/components/finch/text/Statement";

import { AUDIT_PATH, BOOK_HREF } from "./audit-content";

/* ── The shell both tool pages share ─────────────────────────────────────────
   `/operations-audit/score` and `/operations-audit/calculator` are the same
   page with a different widget in the middle, so the shell is written once
   rather than twice with a promise to keep them in sync.

   ── Ground sequence (`.ai/vyso_v3_design.md` §7) ─────────────────────────────
   **paper** (hero + tool) → **ink** (the closing CTA plate). Two grounds, one
   band, no device: these are working pages. The tool is the moving thing — a
   gauge that draws, numbers that tween — and a living background under a form
   somebody is filling in is the §1.3 failure mode with extra steps.

   The hero is deliberately compact against `/operations-audit`'s: no glow, no
   two-column split, no booking form. It exists to name the tool and get out of
   the way, and the reader arriving here has already chosen (they came through
   "Two ways to see it before we start.", or a search result that promised
   exactly this). `SplitReveal` on the `<h1>` is the one piece of §4.4 it keeps,
   because it is transform-only and a headline that never fades still reads with
   JS off.

   The tool sits on the shared 1160 rail at full width — no second card around
   it, because both widgets already bring their own white cards, and a card
   inside a card is a border nobody asked for. Single column: they used to share
   a row on `/operations-audit`, which only fit above 1280 and squeezed both
   below it.

   The closing plate is the site's shared `AuditBand` in its `default` variant
   (a dark plate on paper, not a fourth full-bleed band on a two-band page),
   pointed at the booking form on the parent page rather than at the parent page
   generally: someone who has just been handed a finding is one click from the
   thing that quantifies it.                                                    */

export function AuditToolPage({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      {/* No `active` section: these are not `Industries`, `Pricing` or `Learn`,
          and highlighting the nav's audit CTA is not something the row does. */}
      <FinchNav />
      <main id="main">
        <header className={`${RAIL} pb-[40px] pt-[40px] lg:pb-[56px] lg:pt-[64px]`}>
          <div
            className="mb-[22px] h-[3px] w-[44px] rounded-[2px] lg:mb-[28px] lg:w-[52px]"
            style={{ background: "var(--fn-grad)" }}
          />
          <div className="mb-[16px] font-fn-mono text-[10px] leading-[1.6] tracking-[0.14em] text-fn-muted lg:mb-[20px] lg:text-[11px]">
            {eyebrow}
          </div>
          <h1 className="m-0 mb-[16px] max-w-[820px] font-fn-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[20px] lg:text-[46px] lg:leading-[1.06] lg:tracking-[-0.025em]">
            <SplitReveal text={title} />
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[16.5px]">
            {sub}
          </p>
        </header>

        <section className={`${RAIL} pb-[40px] lg:pb-[56px]`}>{children}</section>

        {/* Below the tool, not above it: the way out of a page like this is the
            thing you reach after you have finished with it. */}
        <div className={`${RAIL} pb-[64px] lg:pb-[96px]`}>
          <Link
            href={AUDIT_PATH}
            className="inline-block border-t border-fn-line pt-[20px] text-[14px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
          >
            <span aria-hidden="true">‹</span> Back to the audit
          </Link>
        </div>

        <AuditBand href={BOOK_HREF} />
      </main>
      <FinchFooter />
    </div>
  );
}

export default AuditToolPage;
