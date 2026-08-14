'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { clearParsedOrder } from '@/lib/ai/finch/order-handoff';
import { firstName, initials } from '@/components/platform/brief/brief-display';
import { FeedbackModal } from '@/components/platform/FeedbackModal';
import { trialPillLabel } from './shell-data';

/**
 * The rail's bottom cluster: trial chip + notifications bell, then the user
 * chip that opens the account menu (org header, My Organisation, Settings,
 * Send feedback, Sign out) — TopBar's account button, rehomed and its menu
 * flipped to open UPWARD since the trigger now sits at the bottom of the rail
 * instead of a top bar (plan §3 rows #4-#8, §5 "User-chip menu open").
 *
 * All the data this needs — org, email, profile, trial, and the pathname for
 * the bell's active state — comes from usePlatform()/usePathname() rather than
 * props, exactly like TopBar did; AppRail (a server component) only prop-drills
 * the data it fetched server-side (findings counts, the modules list), not
 * session state that's already free via context.
 *
 * signOut()/outside-click/Escape are TopBar's logic verbatim (same three
 * effects: clear the parsed-order draft, sign out of Supabase, redirect + hard
 * refresh so client component state doesn't leak into the next session).
 *
 * NOTE ON SCOPE: the plan's §4.2 table lists "Mounts FeedbackModal +
 * ModuleLockNotice" for this component. Only FeedbackModal has an actual
 * trigger here ("Send feedback"); nothing in this menu opens a locked module,
 * so ModuleLockNotice is NOT mounted here — it lives in UnderTheHood.tsx,
 * where the locked rows that open it actually are. Mounting an unreachable
 * modal here would be dead code.
 *
 * Unmounted in W1 — not imported by any rendered tree yet.
 */
export function UserChipMenu() {
  const { org, email, profile, trial } = usePlatform();
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const [accountOpen, setAccountOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click or Escape — ported verbatim from
  // TopBar.tsx.
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  async function signOut() {
    // Clear the client-side parsed-order draft (customer + line items + prices)
    // so it can't survive sign-out into the next user's session on a shared
    // workstation. Ported verbatim from TopBar.tsx.
    clearParsedOrder();
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const notificationsActive = pathname === '/app/notifications' || pathname.startsWith('/app/notifications/');

  return (
    <>
      <div className="mt-3.5 flex flex-col gap-2 border-t border-[#EFEDE8] pt-3">
        <div className="flex items-center gap-1.5 px-1">
          {trial && !trial.expired ? (
            <Link
              href="/app/settings"
              className="inline-flex flex-1 items-center justify-center truncate rounded-full bg-[var(--pf-accent-weak)] px-3 py-1 text-[11.5px] font-medium text-[var(--pf-accent-deep)] transition-colors hover:bg-[var(--pf-accent-weak-hover)]"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              {trialPillLabel(trial.daysLeft)}
            </Link>
          ) : null}

          <Link
            href="/app/notifications"
            aria-label="Notifications"
            title="Notifications"
            aria-current={notificationsActive ? 'page' : undefined}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border transition-colors ${
              notificationsActive
                ? 'border-[var(--pf-accent-ring)] bg-[var(--pf-accent-weak)] text-[var(--pf-accent-strong)]'
                : 'border-transparent text-[var(--pf-text-muted)] hover:border-[var(--pf-accent-ring)] hover:bg-[var(--pf-accent-weak)] hover:text-[var(--pf-accent-strong)]'
            }`}
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
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
          </Link>
        </div>

        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => setAccountOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[#F5F3EF]"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[var(--pf-accent-weak)] text-[11px] font-semibold text-[var(--pf-accent-strong)]">
              {initials(profile?.full_name ?? email)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--pf-text-secondary)]">
              {[firstName(profile?.full_name) || email, org?.name].filter(Boolean).join(' · ')}
            </span>
          </button>

          {accountOpen ? (
            // Opens upward — the trigger sits at the bottom of the rail, so the
            // menu grows above it. `.vyso-pop-in-up` mirrors `.vyso-pop-in`
            // (plan §5): same --dur-pop/--ease-pop, translateY(+6px)→0 instead
            // of translateY(-6px)→0.
            <div
              role="menu"
              className="vyso-pop-in-up absolute bottom-full left-0 z-40 mb-2 w-[224px] overflow-hidden rounded-xl border border-[var(--pf-border-strong)] bg-white py-1 shadow-[var(--pf-shadow-menu)]"
            >
              <div className="border-b border-[var(--pf-border-soft)] px-3.5 pb-2 pt-2.5">
                <div className="truncate text-[13px] font-medium text-[var(--pf-text)]">{org?.name ?? 'Your organisation'}</div>
                <div className="truncate text-[12px] text-[var(--pf-text-muted)]">{email || '—'}</div>
              </div>
              <Link
                href="/app/organisation"
                role="menuitem"
                onClick={() => setAccountOpen(false)}
                className="block px-3.5 py-2 text-[13px] text-[var(--pf-text)] transition-colors hover:bg-[var(--pf-accent-weak)]"
                style={{ transitionDuration: 'var(--dur-hover)' }}
              >
                My Organisation
              </Link>
              <Link
                href="/app/settings"
                role="menuitem"
                onClick={() => setAccountOpen(false)}
                className="block px-3.5 py-2 text-[13px] text-[var(--pf-text)] transition-colors hover:bg-[var(--pf-accent-weak)]"
                style={{ transitionDuration: 'var(--dur-hover)' }}
              >
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  setFeedbackOpen(true);
                }}
                className="block w-full px-3.5 py-2 text-left text-[13px] text-[var(--pf-text)] transition-colors hover:bg-[var(--pf-accent-weak)]"
                style={{ transitionDuration: 'var(--dur-hover)' }}
              >
                Send feedback
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  void signOut();
                }}
                className="block w-full px-3.5 py-2 text-left text-[13px] text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]"
                style={{ transitionDuration: 'var(--dur-hover)' }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
