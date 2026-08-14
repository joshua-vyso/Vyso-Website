'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { ModuleLockNotice } from '@/components/platform/ModuleLockNotice';
import { moduleForPathname, type RailModule } from './shell-data';

/**
 * The rail's "under the hood" section — modules deliberately demoted below the
 * Brief's two primary rows, collapsed by default (plan §12 D6: no persistence,
 * every mount starts collapsed).
 *
 * WHY THE ROWS SIT ABOVE THE TOGGLE. The toggle button is the section's fixed
 * anchor, always visible directly above the trial-chip/user-chip cluster at
 * the bottom of the rail; the modules list is rendered BEFORE it in the DOM.
 * With the rows collapsed to zero height, that puts the toggle right where the
 * mock's "Under the hood" eyebrow sits; expanding grows the grid row upward
 * from the toggle rather than pushing the trial chip / user chip further down
 * the rail — which is what plan §4.2/§5 call "expanding upward".
 *
 * MOTION (plan §5). Container: CSS grid `grid-template-rows: 0fr → 1fr` at
 * `--dur-control` `--ease-out-soft`. Inner list: opacity 0→1 at `--dur-fade`,
 * ~40ms transition-delay on expand only (none on collapse). Chevron rotates
 * 180° at `--dur-hover`. Rows do not stagger. `motion-reduce:transition-none`
 * on every animated rule per the house convention.
 *
 * LOCKED MODULES (plan §8 E2). A row for a module in `lockedModules` renders
 * as a <button>, not a <Link>; clicking it opens ModuleLockNotice instead of
 * navigating — mirrors ModulesOverlay.tsx's locked-tile branch.
 *
 * Unmounted in W1 — not imported by any rendered tree yet.
 */
export function UnderTheHood({ modules }: { modules: RailModule[] }) {
  const [expanded, setExpanded] = useState(false);
  const [lockedLabel, setLockedLabel] = useState<string | null>(null);
  const { lockedModules } = usePlatform();
  const pathname = usePathname() ?? '';
  const activeHref = moduleForPathname(pathname)?.screens.desktop ?? null;

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <div
          className="grid overflow-hidden transition-[grid-template-rows] motion-reduce:transition-none"
          style={{
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transitionDuration: 'var(--dur-control)',
            transitionTimingFunction: 'var(--ease-out-soft)',
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="flex flex-col gap-0.5 pb-1.5 transition-opacity motion-reduce:transition-none motion-reduce:opacity-100"
              style={{
                opacity: expanded ? 1 : 0,
                transitionDuration: 'var(--dur-fade)',
                transitionDelay: expanded ? '40ms' : '0ms',
              }}
            >
              {modules.map((m) => {
                const active = m.href === activeHref;
                const locked = lockedModules.includes(m.key);
                const dot = (
                  <span
                    aria-hidden
                    className={`h-[5px] w-[5px] shrink-0 rounded-[2px] ${active ? 'bg-[var(--pf-text)]' : 'bg-[#C9CCC4]'}`}
                  />
                );

                if (locked) {
                  return (
                    <button
                      key={m.href}
                      type="button"
                      onClick={() => setLockedLabel(m.label)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-[var(--pf-text-muted)] transition-colors hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)]"
                      style={{ transitionDuration: 'var(--dur-hover)' }}
                    >
                      {dot}
                      {m.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                      active
                        ? 'bg-[#EDEDEA] font-semibold text-[var(--pf-text)]'
                        : 'text-[var(--pf-text-muted)] hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)]'
                    }`}
                    style={{ transitionDuration: 'var(--dur-hover)' }}
                  >
                    {dot}
                    {m.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-left transition-colors hover:bg-[#F5F3EF]"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
            Under the hood
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="ml-auto shrink-0 text-[var(--pf-text-faint)] transition-transform motion-reduce:transition-none"
            style={{ transitionDuration: 'var(--dur-hover)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <ModuleLockNotice open={lockedLabel !== null} moduleLabel={lockedLabel ?? ''} onClose={() => setLockedLabel(null)} />
    </>
  );
}
