import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';
import { ModuleHeader } from '@/components/platform/module-ui';
import { LiveChip } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { PricePilotLive } from '@/components/platform/pricepilot/Live';

const M = MODULE_META.pricepilot;

const TABS = [
  { label: 'Dashboard', href: '/app/pricepilot' },
  { label: 'Products', href: '/app/pricepilot/products' },
  { label: 'Price lists', href: '/app/pricepilot/price-lists' },
  { label: 'Customers', href: '/app/pricepilot/customers' },
  { label: 'Recommendations', href: '/app/pricepilot/recommendations' },
  { label: 'Analytics', href: '/app/pricepilot/analytics' },
  { label: 'Notifications', href: '/app/pricepilot/notifications' },
  { label: 'Recent sales', href: '/app/pricepilot/recent-sales' },
  { label: 'Sales hub', href: '/app/pricepilot/sales-hub' },
  { label: 'Complaints', href: '/app/pricepilot/complaints' },
];

/**
 * PricePilot chrome: the module identity header (icon + name + the live-pricing
 * chip, which reports on the whole module, not one tab) above the sub-nav shared
 * by every screen — the SupplySync/InsightGen arrangement. The dashboard used to
 * hand-roll this header below the tabs; it now lives here so every tab carries it.
 */
export default async function PricePilotLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <PricePilotLive />
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} actions={<LiveChip label="Live pricing" />} />
      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/pricepilot" />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
