'use client';

import { useState, type ReactNode } from 'react';
import { ModuleHeader, PrimaryAction } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { SubNav } from '@/components/platform/SubNav';
import { useToast } from '@/components/platform/orderflow/ui';
import { LogWasteModal } from './shared';

const M = MODULE_META.wastewatch;

const TABS = [
  { label: 'Overview', href: '/app/wastelog' },
  { label: 'Waste Log', href: '/app/wastelog/log' },
  { label: 'Analytics', href: '/app/wastelog/analytics' },
  { label: 'Devices', href: '/app/wastelog/devices' },
];

/**
 * WasteWatch chrome: the module identity header above the shared sub-nav — the
 * SupplySync/InsightGen arrangement. Logging waste is the module's one job, so
 * "+ Log waste" is module-level and reachable from every tab; the tabs that also
 * offer it in context (the empty state, the log table) keep their own buttons.
 *
 * Rendered inside WasteWatchProvider — the log modal reads the org's categories.
 */
export function WasteWatchChrome({ children }: { children: ReactNode }) {
  const { node, show } = useToast();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      {node}
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={<PrimaryAction onClick={() => setLogOpen(true)}>+ Log waste</PrimaryAction>}
      />
      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/wastelog" />
      </div>
      <div className="mt-6">{children}</div>

      <LogWasteModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => show('Waste logged')} />
    </>
  );
}
