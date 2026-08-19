'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/app/docu', label: 'Documents', match: 'documents' },
  { href: '/app/docu/review', label: 'Review', match: 'review' },
  { href: '/app/docu/recent', label: 'Recent', match: 'recent' },
  { href: '/app/docu/reconciliation', label: 'Reconciliation', match: 'reconciliation' },
  { href: '/app/docu/settings', label: 'Settings', match: 'settings' },
] as const;

/** Top tabs for the Doc-U section (Documents · Review · Recent · Reconciliation · Settings). */
export function DocuNav({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname() ?? '';
  const current = pathname.startsWith('/app/docu/review')
    ? 'review'
    : pathname.startsWith('/app/docu/recent')
      ? 'recent'
      : pathname.startsWith('/app/docu/reconciliation')
        ? 'reconciliation'
        : pathname.startsWith('/app/docu/settings')
          ? 'settings'
          : 'documents'; // /app/docu, /app/docu/folder/*, /app/docu/[id], awaiting/confidence/flagged

  return (
    // `overflow-x-auto` + `whitespace-nowrap` (v2.1): <main> now clips sideways
    // rather than scrolling, so a tab row that outgrows a narrow column has to
    // carry its own scroller or its last tab becomes unreachable. Nothing wraps
    // — a two-line tab bar reads as two rows of navigation.
    //
    // `overflow-y-clip` is not decoration: each tab's `-mb-px` (which lifts its
    // underline onto the row's border) leaves the links 1px taller than the box,
    // and a scroll container with 1px of vertical overflow is a scroll container
    // that can grow a vertical scrollbar. Clipping that axis keeps the sideways
    // scroller without the stray bar.
    <div className="flex items-center gap-5 overflow-x-auto overflow-y-clip whitespace-nowrap border-b border-[#EAEDF2]">
      {TABS.map((t) => {
        const active = t.match === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 pb-2.5 pt-1 text-[14px] transition-colors ${
              active
                ? 'border-[#3E7BC4] font-medium text-[#171A17]'
                : 'border-transparent text-[#6B6F68] hover:text-[#171A17]'
            }`}
          >
            {t.label}
            {t.match === 'review' && reviewCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-[#FBEEDA] px-1.5 py-0.5 text-[11px] font-medium text-[#854F0B]">
                {reviewCount}
              </span>
            ) : null}
          </Link>
        );
      })}
      {/* The Finch pill that used to sit here is gone (W4): the shell's bubble
          is bottom-right on every module screen and carries the same
          conversation the Brief has, so Doc-U no longer launches a second one. */}
    </div>
  );
}
