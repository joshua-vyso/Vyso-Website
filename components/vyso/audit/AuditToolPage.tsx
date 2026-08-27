import Link from "next/link";

import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";

import { AUDIT_PATH, BOOK_HREF } from "./audit-content";

/* ── The shell both tool pages share ─────────────────────────────────────────
   `/operations-audit/score` and `/operations-audit/calculator` are the same
   page with a different widget in the middle, so the shell is written once.
   This is the Phase 5 restyle of `components/finch/audit/AuditToolPage.tsx`:
   same job, the `--vy-*` shell instead of `.finch-site`. The widgets
   themselves (`RoiCalculator`, `OperationsAudit` in `components/marketing/`)
   are untouched — the plan's instruction is to wrap and restyle the page
   chrome, not rebuild the calculator/score logic, and `--fn-bg`/`--fn-surface`
   sit close enough to `--vy-bg`/`--vy-surface` (both a warm off-white with a
   white card) that the widgets already read correctly against this page
   without a rewrite.

   No `active` prop passed to `Shell`: these are not `How it works`,
   `Solutions` or any other nav item, and highlighting the audit CTA is not
   something the nav row does (the same choice the parent `/operations-audit`
   page makes).

   Single content column, no second card around the tool: both widgets already
   bring their own white cards, and a card inside a card is a border nobody
   asked for. */

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
    <Shell>
      <section className="px-[var(--vy-gutter)] pt-[44px] pb-[48px] md:px-[40px] md:pt-[72px] md:pb-[64px]">
        <div className="mx-auto w-full max-w-[var(--vy-content)]">
          <p className="vy-label mb-[18px] text-[color:var(--vy-ink-3)]">{eyebrow}</p>
          <h1 className="vy-h1 max-w-[820px] text-[color:var(--vy-ink)] text-pretty">{title}</h1>
          <p className="vy-body-lg mt-[18px] max-w-[620px] text-[color:var(--vy-ink-3)] text-pretty">
            {sub}
          </p>
        </div>
      </section>

      <section className="px-[var(--vy-gutter)] pb-[48px] md:px-[40px] md:pb-[64px]">
        <div className="mx-auto w-full max-w-[var(--vy-content)]">{children}</div>
      </section>

      {/* Below the tool, not above it: the way out of a page like this is the
          thing you reach after you have finished with it. */}
      <div className="px-[var(--vy-gutter)] pb-[56px] md:px-[40px] md:pb-[96px]">
        <div className="mx-auto w-full max-w-[var(--vy-content)]">
          <Link
            href={AUDIT_PATH}
            className="inline-block border-t border-[color:var(--vy-line)] pt-[18px] text-[14px] font-medium text-[color:var(--vy-ink-2)] transition-colors duration-150 hover:text-[color:var(--vy-ink)]"
          >
            <span aria-hidden="true">‹</span> Back to the audit
          </Link>
        </div>
      </div>

      <Section
        ground="dark"
        spacing="loose"
        align="center"
        heading="What's costing your business time?"
        lead="Tell us how your operation currently works. We'll come back with where it leaks and what would be worth fixing first."
      >
        <div className="flex justify-center">
          <Button
            href={BOOK_HREF}
            size="lg"
            event="book_audit_click"
            eventProps={{ page: eyebrow }}
          >
            Book your free audit
          </Button>
        </div>
      </Section>
    </Shell>
  );
}

export default AuditToolPage;
