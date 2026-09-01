'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import {
  isPluginPath,
  pluginToneDot,
  pluginToneLabel,
  type PluginRailRow,
} from '@/lib/platform/plugins';
import { clearParsedOrder } from '@/lib/ai/finch/order-handoff';
import { firstName, initials } from '@/components/platform/brief/brief-display';
import { FeedbackModal } from '@/components/platform/FeedbackModal';
import { VysoMark } from '@/components/platform/VysoMark';
import { useFinchChat } from './FinchChatProvider';
import { RailNav } from './RailNav';
import { trialPillLabel } from './shell-data';

const ROW = 'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors';
const ROW_IDLE = 'text-[var(--pf-text-control)] hover:bg-[#F5F3EF]';
const ROW_ACTIVE = 'bg-[#EDEDEA] font-semibold text-[var(--pf-text)]';

/**
 * The <lg navigation surface (plan §6): the desktop rail's content re-flowed
 * into a left slide-in sheet, opened from MobileTopBar's menu button.
 *
 * DELIBERATE DIFFERENCES FROM THE DESKTOP RAIL (plan §6, explicit):
 *   - Account items (My Organisation, Settings, Send feedback, Sign out) are
 *     inline rows, not a nested popover — UserChipMenu's floating menu doesn't
 *     fit inside a sheet that's already an overlay.
 *   - No Upload button: it is on MobileTopBar, one tap closer, because it is
 *     the shell's primary action and not a place to navigate to
 *     (`.ai/plan_phase0_teardown_shell.md` Task E4).
 *
 * ── WHAT PHASE 0 TOOK OUT (Task D/E) ────────────────────────────────────────
 * The "Under the hood" module list and, with it, `lockedModules` / the
 * ModuleLockNotice branch this sheet used to mirror from UnderTheHood.tsx.
 * Navigation is a fixed list now (nav-config.ts) and entitlement is no longer a
 * navigation concern, so there is no locked row left to explain. The chat list
 * went the same way — RailNav no longer mounts RailChats.
 *
 * RailNav.tsx IS reused verbatim for every nav row — that markup is identical
 * on mobile and desktop, which is what keeps the two surfaces from drifting.
 *
 * MOTION (plan §5): slide-in `translateX(-100%)→0` at `--dur-control`
 * `--ease-standard`; scrim fades at `--dur-fade`. Escape / scrim tap / route
 * change all close it (plan §8 E12 — focus-trap parity with the old
 * ModulesOverlay, which was `role="dialog" aria-modal`).
 *
 * Unmounted in Wave 1 — not imported by app/app/layout.tsx yet (Wave 3 mounts
 * it, via MobileTopBar, as the `<lg` sibling of AppRail).
 */
export function MobileDrawer({
  open,
  onClose,
  openCount,
  canSeeBrief,
  plugins,
  reviewCount,
}: {
  open: boolean;
  onClose: () => void;
  openCount: number;
  /** The drawer MIRRORS the rail (v2b): a member who cannot see Overview on
   *  desktop must not find it here either. Same prop, same component, so the
   *  two surfaces cannot drift. */
  canSeeBrief: boolean;
  /** The Plugins section, mirroring the desktop rail. EMPTY for a member — the
   *  layout withholds the rows, exactly as it withholds the Brief's (Plugins
   *  X1); this sheet does not carry an access rule of its own. */
  plugins: PluginRailRow[];
  /** The Review row mirrors the desktop rail too — same RailNav, same
   *  RailReview, so the two surfaces cannot disagree about whether something is
   *  waiting (Review chat wave). */
  reviewCount: number;
}) {
  const { org, email, profile, trial } = usePlatform();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { reset: resetChat } = useFinchChat();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // A route change means a Link inside the drawer was tapped — close it. Only
  // `pathname` should retrigger this (not `onClose`, which is a fresh closure
  // every MobileTopBar render); harmless no-op when already closed.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function signOut() {
    clearParsedOrder();
    // Abort any in-flight answer and empty the transcript before the session
    // goes — the mobile half of plan §8 E7, identical to UserChipMenu's.
    resetChat();
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    onClose();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-[var(--pf-scrim)] backdrop-blur-[3px] transition-opacity lg:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        } motion-reduce:transition-none`}
        style={{ transitionDuration: 'var(--dur-fade)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vyso menu"
        aria-hidden={!open}
        className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[300px] max-w-[85vw] flex-col overflow-y-auto border-r border-[var(--pf-border-warm)] bg-white px-5 pb-6 pt-7 shadow-[var(--pf-shadow-overlay)] transition-transform motion-reduce:transition-none lg:hidden"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transitionDuration: 'var(--dur-control)',
          transitionTimingFunction: 'var(--ease-standard)',
        }}
      >
        <div className="flex items-center justify-between px-2 pb-[22px]">
          <VysoMark width={64} color="#171A17" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--pf-border-strong)] bg-white text-[16px] text-[var(--pf-text-muted)] transition-colors hover:bg-[#F3F5F8]"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            ✕
          </button>
        </div>

        <RailNav openCount={openCount} canSeeBrief={canSeeBrief} reviewCount={reviewCount} />

        {/* Plugins — the last section below the nav, as on the desktop rail now
            that Under the hood is gone. NO collapse ceremony: this sheet is a
            re-flow of the rail's content, not a second design, and a one-row
            section behind a toggle is a tap that buys nothing. */}
        {plugins.length > 0 ? (
          <div className="mt-4 flex flex-col gap-0.5">
            <div className="px-2.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
              Plugins
            </div>
            {plugins.map((p) => {
              const active = isPluginPath(pathname, p.href);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE}`}
                  style={{ transitionDuration: 'var(--dur-hover)' }}
                >
                  <span
                    aria-hidden
                    className="h-[6px] w-[6px] shrink-0 rounded-full"
                    style={{ backgroundColor: pluginToneDot(p.tone) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  <span className="shrink-0 text-[11px] text-[var(--pf-text-faint)]">
                    {pluginToneLabel(p.tone)}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-1 border-t border-[#EFEDE8] pt-4">
          {trial && !trial.expired ? (
            <Link
              href="/app/settings"
              className="mb-2 inline-flex items-center justify-center rounded-full bg-[var(--pf-accent-weak)] px-3 py-1.5 text-[12px] font-medium text-[var(--pf-accent-deep)]"
            >
              {trialPillLabel(trial.daysLeft)}
            </Link>
          ) : null}

          <Link href="/app/notifications" className={`${ROW} ${ROW_IDLE}`} style={{ transitionDuration: 'var(--dur-hover)' }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Notifications
          </Link>

          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[var(--pf-accent-weak)] text-[11px] font-semibold text-[var(--pf-accent-strong)]">
              {initials(profile?.full_name ?? email)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--pf-text-secondary)]">
              {[firstName(profile?.full_name) || email, org?.name].filter(Boolean).join(' · ')}
            </span>
          </div>

          <Link href="/app/organisation" className={`${ROW} ${ROW_IDLE}`} style={{ transitionDuration: 'var(--dur-hover)' }}>
            My Organisation
          </Link>
          <Link href="/app/settings" className={`${ROW} ${ROW_IDLE}`} style={{ transitionDuration: 'var(--dur-hover)' }}>
            Settings
          </Link>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className={`${ROW} ${ROW_IDLE} w-full text-left`}
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            Send feedback
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className={`${ROW} w-full text-left text-[#A32D2D] hover:bg-[#FCEBEB]`}
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            Sign out
          </button>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
