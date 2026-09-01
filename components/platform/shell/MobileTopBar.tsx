'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlatform } from '@/lib/platform/session';
import { VysoMark } from '@/components/platform/VysoMark';
import type { PluginRailRow } from '@/lib/platform/plugins';
import { MobileDrawer } from './MobileDrawer';
import { UploadButton } from './UploadButton';
import { trialPillLabel } from './shell-data';

/**
 * The <lg replacement for TopBar/AppRail (plan §6): a slim strip — VysoMark →
 * /app, the trial pill (hidden <sm), the Upload button, a menu button — that
 * opens the full rail content in MobileDrawer. Owns the drawer's open/close
 * state itself, the same self-containment TopBar had for ModulesOverlay's
 * `modulesOpen`.
 *
 * HEIGHT. ~56px per plan §6. As of Wave 3, TopBar is unmounted everywhere and
 * this is --pf-topbar-h's only remaining consumer, so the var is repointed to
 * 56px (app/globals.css) and this header reads it via `h-[var(--pf-topbar-h)]`
 * instead of a hardcoded `h-14` literal (plan §7 ruling).
 *
 * UPLOAD IS ON THE BAR, NOT IN THE DRAWER (`.ai/plan_phase0_teardown_shell.md`
 * Task E4). It is the shell's one primary action and it mirrors the desktop
 * rail's top-right control; behind a menu tap it would be a different feature
 * on phones. Its label hides below `sm` so the narrowest handsets keep the
 * trial pill's room.
 *
 * Mounted by app/app/layout.tsx from Wave 3 on, as the `<lg` sibling of
 * AppRail — outside TrialGate (plan §8 E1).
 */
export function MobileTopBar({
  openCount,
  canSeeBrief,
  plugins,
  reviewCount,
}: {
  openCount: number;
  /** Straight through: the drawer mirrors the desktop rail's Overview row, so
   *  it mirrors its gate too (v2b). */
  canSeeBrief: boolean;
  /** Straight through to the drawer, which mirrors the desktop rail's Plugins
   *  section — and mirrors its gate too: the layout hands over an empty list for
   *  a member (Plugins X1). */
  plugins: PluginRailRow[];
  /** Straight through as well: the drawer draws the same Review row the desktop
   *  rail does, from the same component (Review chat wave). */
  reviewCount: number;
}) {
  const { trial } = usePlatform();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasTrialPill = !!trial && !trial.expired;

  return (
    <>
      <header className="z-30 flex h-[var(--pf-topbar-h)] shrink-0 items-center gap-3 border-b border-[var(--pf-border-chrome)] bg-white/90 px-4 backdrop-blur-[10px] lg:hidden">
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

        {/* `ml-auto` moved here from the menu button: Upload is the first of the
            right-hand cluster, so it is the one that absorbs the gap — except
            at `sm` and up WITH a trial pill, where the pill above has already
            taken it and a second `auto` margin would split the two apart. The
            pill is `hidden sm:inline-flex`, which is why the rule is
            breakpoint-conditional rather than just `hasTrialPill`. */}
        <UploadButton className={hasTrialPill ? 'ml-auto sm:ml-0' : 'ml-auto'} />

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          title="Menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[var(--pf-border-strong)] bg-white text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)] hover:bg-[var(--pf-accent-weak)]"
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
        canSeeBrief={canSeeBrief}
        plugins={plugins}
        reviewCount={reviewCount}
      />
    </>
  );
}
