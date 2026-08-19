'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  isPluginPath,
  pluginToneDot,
  pluginToneLabel,
  type PluginRailRow,
} from '@/lib/platform/plugins';

/**
 * The rail's "Plugins" section — the outside systems this business has plugged
 * into, sitting directly ABOVE "Under the hood" (Josh, 2026-08-18: "a separate
 * section for integrations that has all integrations in one place, call the
 * section Plugins, just above the under the hood section").
 *
 * THE SAME COLLAPSIBLE IDIOM AS `UnderTheHood`, DELIBERATELY COPIED RATHER THAN
 * SHARED. The two sections look identical and behave identically today, and a
 * `<RailSection>` abstraction over them is the obvious next move — but they
 * differ in the one thing an abstraction would have to parameterise (rows here
 * carry a coloured status dot and a title; rows there carry a lock branch and a
 * modal), and a shared component whose body is two `if`s on which caller it has
 * is not a smaller thing than two components. Extract it when a THIRD section
 * turns up.
 *
 * EXPANDED BY DEFAULT — the one real difference from Under the hood (plan X1:
 * "Collapsed by default? No — expanded"). Under the hood is nine rows of screens
 * the owner rarely opens, so hiding it is a kindness; Plugins is one row that
 * says whether the company's accounting system is talking to Vyso, which is
 * exactly the kind of thing a rail exists to keep in view. The chevron stays for
 * parity — the section is still collapsible, it simply starts open — and, like
 * Under the hood, the state is NOT persisted: every mount starts expanded.
 *
 * THE DOT IS THE POINT. Green = connected, amber = linked but nothing is coming
 * through (`error` / `reauth_required`), grey = not connected. The mapping is
 * `xeroStatusTone` in lib/platform/plugins.ts, where a test pins it; the row's
 * `title` spells the same fact out for anyone who cannot separate the colours.
 *
 * OWNERS AND ADMINS ONLY. This component is not gated — `app/app/layout.tsx`
 * simply does not render it for a member, the same way it withholds the Brief's
 * rows. The ROUTES carry their own gate (a layout in Next 16 does not re-render
 * on a client-side navigation, so an auth check in one is not re-run per route);
 * this is chrome, and chrome is not a permission.
 */
export function Plugins({ plugins }: { plugins: PluginRailRow[] }) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname() ?? '';

  // Nothing configured is nothing to draw. The registry is a constant today, so
  // this can only fire if a future build ships an empty one — but an eyebrow
  // over no rows is a promise the rail cannot keep.
  if (plugins.length === 0) return null;

  return (
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
            {plugins.map((p) => {
              const active = isPluginPath(pathname, p.href);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={active ? 'page' : undefined}
                  title={`${p.label} — ${pluginToneLabel(p.tone)}`}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                    active
                      ? 'bg-[#EDEDEA] font-semibold text-[var(--pf-text)]'
                      : 'text-[var(--pf-text-muted)] hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)]'
                  }`}
                  style={{ transitionDuration: 'var(--dur-hover)' }}
                >
                  {/* A ROUND dot, unlike Under the hood's 2px-radius square: the
                      square there is a bullet, this one carries a state, and the
                      two sit five pixels apart in the same rail. */}
                  <span
                    aria-hidden
                    className="h-[6px] w-[6px] shrink-0 rounded-full"
                    style={{ backgroundColor: pluginToneDot(p.tone) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  {/* Screen readers get the state as words; the dot is decoration
                      to them. Visually hidden rather than absent, because "Xero"
                      alone does not answer the question the section exists for. */}
                  <span className="sr-only">{pluginToneLabel(p.tone)}</span>
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
          Plugins
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
          style={{
            transitionDuration: 'var(--dur-hover)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
