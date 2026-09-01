import Link from 'next/link';
import { ModuleHeader, SectionCard } from '@/components/platform/module-ui';
import type { AppIconKey } from '@/lib/platform/types';

/**
 * The seven new nav destinations, before they have anything in them
 * (`.ai/plan_phase0_teardown_shell.md` Task E3).
 *
 * ONE COMPONENT, SEVEN PAGES. The plan asks for "each a server component using
 * ModuleHeader + SectionCard", and seven copies of the same twenty lines is
 * seven places to fix a spacing bug — so the pages under app/app/{stock,sales,
 * fleet,expenses,staff,compliance,documents}/page.tsx are each a handful of
 * lines of CONTENT and this holds the shape. Nothing here is a new pattern: the
 * page frame is the module layouts' `min-h-full px-8 py-7`, the header is
 * ModuleHeader, the card is SectionCard, the link rows are the settings page's
 * pointer rows one size down.
 *
 * SERVER-SAFE. No hooks, no state — so a page can render it without becoming a
 * client component, even though ModuleHeader/SectionCard are themselves in a
 * `'use client'` module (importing one from a server component is the ordinary
 * boundary crossing, not a violation).
 *
 * THE LINKS ARE THE POINT. A stub that says only "coming soon" is a dead end,
 * and every one of these routes has real work living somewhere else in the
 * platform TODAY — the old module screens are all still reachable by URL, they
 * are simply no longer in the rail (plan acceptance criterion 6). So each stub
 * names them. Where nothing exists yet (Fleet, Compliance) the list is empty
 * and the page says plainly that the data does not exist, rather than linking
 * somewhere adjacent and hoping.
 */

/** One "this already works, over here" row. `note` says what is behind the
 *  link, because the route names are the OLD product's vocabulary and this
 *  page's reader has just been shown the new one. */
export interface PhaseStubLink {
  label: string;
  href: string;
  note: string;
}

export function PhaseStub({
  icon,
  title,
  description,
  phase,
  lede,
  links = [],
}: {
  icon: AppIconKey;
  title: string;
  /** The one-liner under the title — what this section will be FOR. */
  description: string;
  /** Which phase of `PLAN.md` builds it. A number, not a date: the plan is
   *  ordered, not scheduled, and a date on a stub is a promise nobody made. */
  phase: number;
  /** What arrives with that phase, in the owner's terms. */
  lede: string;
  links?: PhaseStubLink[];
}) {
  return (
    <div className="min-h-full px-8 py-7">
      <ModuleHeader icon={icon} title={title} description={description} />

      <div className="mt-6 max-w-[820px]">
        <SectionCard title={`Coming in Phase ${phase}`}>
          <p className="text-[14px] leading-[1.6] text-[var(--pf-text-secondary)]">{lede}</p>

          {links.length > 0 ? (
            <>
              <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-text-muted)]">
                Working today
              </div>
              <div className="mt-2.5 flex flex-col gap-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between gap-4 rounded-[var(--pf-radius)] border border-[var(--pf-border-soft)] px-4 py-3 transition-colors hover:border-[var(--pf-accent-ring)] hover:bg-[var(--pf-accent-weak)]"
                    style={{ transitionDuration: 'var(--dur-hover)' }}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-[var(--pf-text)]">{link.label}</span>
                      <span className="mt-0.5 block text-[12.5px] text-[var(--pf-text-secondary)]">{link.note}</span>
                    </span>
                    <span className="shrink-0 text-[18px] text-[var(--pf-text-faint)]" aria-hidden>
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
