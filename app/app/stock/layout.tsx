import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { ModuleHeader } from '@/components/platform/module-ui';
import { SubNav } from '@/components/platform/SubNav';

/**
 * Stock & Suppliers chrome — the one header + tab row every screen of the
 * merged module shares (`.ai/plan_stock_suppliers_page.md`).
 *
 * SIX TABS, NOTHING ELSE. This is the whole surface for stock and suppliers now:
 * the old ProcurePulse and SupplySync sub-navs (14 tabs between them, several of
 * which were the same screen twice) are gone, and their routes redirect in here.
 * Adding a tab means the plan's route map changed, not that a screen was found.
 *
 * NO DATA PROVIDER. Modelled on `app/app/orderflow/layout.tsx`: pages
 * server-fetch and pass props down (the house rule stated in
 * `lib/platform/orderflow-data.ts`). A layout-level provider goes stale on soft
 * navigation, so a detail page can miss a record that was just written.
 *
 * The identity is hard-coded rather than read from MODULE_META because there is
 * no `stock` module key — MODULE_META still describes the OLD procurepulse and
 * supplysync modules, and pointing this at either one would put the wrong name
 * ("Procurement & stock intelligence") above the merged screen.
 */

const TABS = [
  { label: 'Dashboard', href: '/app/stock' },
  { label: 'Market sheet', href: '/app/stock/market' },
  { label: 'Stock', href: '/app/stock/levels' },
  { label: 'Suppliers', href: '/app/stock/suppliers' },
  { label: 'Manufacturing', href: '/app/stock/manufacturing' },
  { label: 'Uploads', href: '/app/stock/uploads' },
];

export default async function StockLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    // Font and page wash come from the platform shell (app/app/layout.tsx); this
    // layout only owns the module's own header/tabs and the standard page inset.
    <div className="min-h-full px-8 py-7">
      <ModuleHeader
        icon="proc"
        title="Stock & Suppliers"
        description="What you hold, what you pay for it, and who you buy it from"
      />
      <div className="mt-5">
        {/* Default accent (--pf-accent's blue): OrderFlow is the only module that
            runs its own palette, and this one is deliberately platform-standard. */}
        <SubNav tabs={TABS} rootHref="/app/stock" />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
