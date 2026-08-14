'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlatform } from '@/lib/platform/session';
import { VysoMark } from '@/components/platform/VysoMark';
import { MobileDrawer } from './MobileDrawer';
import { trialPillLabel, type RailModule } from './shell-data';

/**
 * The <lg replacement for TopBar/AppRail (plan §6): a slim strip — VysoMark →
 * /app, the trial pill (hidden <sm), a menu button — that opens the full rail
 * content in MobileDrawer. Owns the drawer's open/close state itself, the same
 * self-containment TopBar had for ModulesOverlay's `modulesOpen`.
 *
 * HEIGHT. ~56px per plan §6, but deliberately NOT wired to --pf-topbar-h. As
 * of Wave 2 that var has no consumer left in code — BriefRail.tsx's sticky
 * `h-[calc(100dvh-var(--pf-topbar-h))]` went with the file — but it still
 * DESCRIBES a live height: TopBar.tsx renders `<lg` until Wave 3 and is 66px
 * (hardcoded, it never read the var). The var stays at 66px until TopBar is
 * unmounted; `h-14` (56px) is a plain literal here. Wave 3 can repoint
 * --pf-topbar-h to 56px and switch this to `h-[var(--pf-topbar-h)]` in the
 * same change that drops TopBar (plan §7 flags exactly this repointing, just
 * not the "when").
 *
 * Unmounted in Wave 1 — not imported by app/app/layout.tsx yet (Wave 3 mounts
 * it as the `<lg` sibling of AppRail).
 */
export function MobileTopBar({
  openCount,
  historyCount,
  modules,
}: {
  openCount: number;
  historyCount: number;
  modules: RailModule[];
}) {
  const { trial } = usePlatform();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasTrialPill = !!trial && !trial.expired;

  return (
    <>
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--pf-border-chrome)] bg-white/90 px-4 backdrop-blur-[10px] lg:hidden">
        <Link href="/app" aria-label="Vyso home" className="flex shrink-0 items-center">
          <VysoMark width={80} color="#171A17" />
        </Link>

        {hasTrialPill ? (
          <Link
            href="/app/settings"
            className="ml-auto hidden shrink-0 items-center rounded-full bg-[var(--pf-accent-weak)] px-3 py-1 text-[12px] font-medium text-[var(--pf-accent-deep)] transition-colors hover:bg-[var(--pf-accent-weak-hover)] sm:inline-flex"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            {trialPillLabel(trial.daysLeft)}
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          title="Menu"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[var(--pf-border-strong)] bg-white text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)] hover:bg-[var(--pf-accent-weak)] ${
            hasTrialPill ? '' : 'ml-auto'
          }`}
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        openCount={openCount}
        historyCount={historyCount}
        modules={modules}
      />
    </>
  );
}
