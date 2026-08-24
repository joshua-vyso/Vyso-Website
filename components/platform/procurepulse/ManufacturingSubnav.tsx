'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Second-level nav inside the Manufacturing section (the top-level
 * ProcurePulse tab formerly labelled "Recipes" — PpSubnav in ui.tsx). Kept as
 * its own small component, scoped by app/app/procurepulse/recipes/layout.tsx,
 * rather than folded into PpSubnav: PpSubnav spans every ProcurePulse screen,
 * but Recipes/Batches only makes sense within this one section.
 */
const SUBTABS = [
  { label: 'Recipes', href: '/app/procurepulse/recipes' },
  { label: 'Batches', href: '/app/procurepulse/recipes/batches' },
];

export function ManufacturingSubnav() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {SUBTABS.map((t) => {
        // Exact match for Recipes so it doesn't stay "active" on /recipes/[id]
        // while Batches is showing, and exact match for Batches so a future
        // /recipes/batches/[id] detail page doesn't fall through to Recipes.
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-[10px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? 'bg-[#1F5FA8] text-white'
                : 'bg-[#EEF1F5] text-[#6B6F68] hover:bg-[#E4E9F0] hover:text-[#171A17]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
