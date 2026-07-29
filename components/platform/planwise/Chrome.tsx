'use client';

import { useState, type ReactNode } from 'react';
import { ModuleHeader, PrimaryAction } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { SubNav } from '@/components/platform/SubNav';
import { useToast } from '@/components/platform/orderflow/ui';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import { AddBudgetLineModal } from './AddBudgetLineModal';

const M = MODULE_META.planwise;

const TABS = [
  { label: 'Overview', href: '/app/marginview' },
  { label: 'Budget', href: '/app/marginview/budget' },
  { label: 'Goals', href: '/app/marginview/goals' },
  { label: 'Forecast', href: '/app/marginview/forecast' },
  { label: 'Scenarios', href: '/app/marginview/scenarios' },
];

/**
 * PlanWise chrome: the module identity header above the shared underline
 * sub-nav, plus the module's live wiring — the SupplySync/InsightGen
 * arrangement. "+ Add budget line" is module-level (a budget line is the thing
 * every tab reads from), so it rides in the header and its modal is hosted here
 * rather than inside the Overview view.
 *
 * PlanWise is a read-mostly dashboard whose numbers are written from several
 * places — the budget modal here, the goals form here, PricePilot's target
 * editor — so a plan edited in one tab (or by a colleague) must not sit stale in
 * another. Subscribing re-runs the server layout, which re-derives every actual
 * from source. Each table needs a row in `supabase/planwise-realtime.sql`.
 *
 * The per-tab section titles stay in the views, below the nav.
 */
export function PlanWiseChrome({ children }: { children: ReactNode }) {
  const { node, show } = useToast();
  const [budgetOpen, setBudgetOpen] = useState(false);
  useRealtimeRefresh(['pw_budget_lines', 'pl_targets', 'pw_goals', 'pw_forecast', 'pw_decisions']);

  return (
    <>
      {node}
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={<PrimaryAction onClick={() => setBudgetOpen(true)}>+ Add budget line</PrimaryAction>}
      />
      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/marginview" />
      </div>
      <div className="mt-6">{children}</div>

      <AddBudgetLineModal open={budgetOpen} onClose={() => setBudgetOpen(false)} onSaved={(c) => show(`${c} added to budget`)} />
    </>
  );
}
