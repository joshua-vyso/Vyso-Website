'use client';

import type { ReactNode } from 'react';
import { SubNav } from '@/components/platform/SubNav';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';

const TABS = [
  { label: 'Overview', href: '/app/marginview' },
  { label: 'Budget', href: '/app/marginview/budget' },
  { label: 'Goals', href: '/app/marginview/goals' },
  { label: 'Forecast', href: '/app/marginview/forecast' },
  { label: 'Scenarios', href: '/app/marginview/scenarios' },
];

/**
 * PlanWise chrome: the shared underline sub-nav plus the module's live wiring.
 *
 * PlanWise is a read-mostly dashboard whose numbers are written from several
 * places — the budget modal here, the goals form here, PricePilot's target
 * editor — so a plan edited in one tab (or by a colleague) must not sit stale in
 * another. Subscribing re-runs the server layout, which re-derives every actual
 * from source. Each table needs a row in `supabase/planwise-realtime.sql`.
 *
 * The per-tab titles stay in the views (each PlanWise tab has its own heading),
 * so this deliberately renders no ModuleHeader.
 */
export function PlanWiseChrome({ children }: { children: ReactNode }) {
  useRealtimeRefresh(['pw_budget_lines', 'pl_targets', 'pw_goals', 'pw_forecast', 'pw_decisions']);

  return (
    <>
      <SubNav tabs={TABS} rootHref="/app/marginview" />
      <div className="mt-6">{children}</div>
    </>
  );
}
