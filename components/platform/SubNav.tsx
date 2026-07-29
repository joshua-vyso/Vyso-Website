'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * The label of a tab, dimmed with a trailing dot while its navigation is in
 * flight. `useLinkStatus` only reports for the Link it is rendered inside, so
 * the feedback lands on the tab the user actually clicked.
 *
 * Both the dim and the dot are delayed ~150ms and the dot is always in the DOM
 * at a fixed size: a prefetched tab resolves before the delay elapses (no
 * flicker) and nothing reflows when the indicator appears.
 */
function TabLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`inline-flex items-center transition-opacity delay-150 duration-200 ${
        pending ? 'opacity-55' : 'opacity-100'
      }`}
    >
      {label}
      <span
        aria-hidden
        className={`ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current transition-opacity delay-150 duration-200 ${
          pending ? 'opacity-70' : 'opacity-0'
        }`}
      />
    </span>
  );
}

/**
 * Generic horizontal sub-navigation for a module's screens — the calm underline
 * style shared with Doc-U: a thin baseline with the active tab underlined in blue.
 * The `rootHref` tab (module index) is matched exactly; the rest match by prefix.
 * An optional `right` slot renders a right-aligned action (e.g. the Finch pill).
 * `accent` recolours the active underline for modules that run their own palette
 * (OrderFlow is orange); it defaults to the platform blue every other module uses.
 */
export function SubNav({
  tabs,
  rootHref,
  right,
  accent = '#3E7BC4',
}: {
  tabs: { label: string; href: string }[];
  rootHref: string;
  right?: ReactNode;
  accent?: string;
}) {
  const pathname = usePathname() ?? '';
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#EAEDF2]">
      {tabs.map((t) => {
        const active =
          t.href === rootHref ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 pb-2.5 pt-1 text-[14px] transition-colors ${
              active ? 'font-medium text-[#171A17]' : 'border-transparent text-[#6B6F68] hover:text-[#171A17]'
            }`}
            style={active ? { borderBottomColor: accent } : undefined}
          >
            <TabLabel label={t.label} />
          </Link>
        );
      })}
      {right ? <div className="ml-auto self-center pb-1.5">{right}</div> : null}
    </nav>
  );
}
