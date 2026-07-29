'use client';

import type { ReactNode } from 'react';
import { ModuleHeader, PrimaryAction } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { SubNav } from '@/components/platform/SubNav';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import { useInsightGen } from './context';
import { CreateReportModal } from './CreateReportModal';

const M = MODULE_META.insightgen;

const TABS = [
  { label: 'Overview', href: '/app/reportgen' },
  { label: 'Insights', href: '/app/reportgen/insights' },
  { label: 'Reports', href: '/app/reportgen/reports' },
  { label: 'Anomalies', href: '/app/reportgen/anomalies' },
];

/**
 * InsightGen chrome: module header + routed sub-nav shared by every tab, plus
 * the create-report modal any tab can open through the InsightGen context.
 *
 * The brain is recomputed server-side on every render, so the realtime
 * subscription covers the tables it aggregates that are already published to
 * `supabase_realtime` (of_orders) alongside InsightGen's own records — a new
 * order or a newly saved report re-derives the brief without a manual refresh.
 */
export function InsightGenChrome({ children }: { children: ReactNode }) {
  const ig = useInsightGen();
  useRealtimeRefresh(['of_orders', 'ig_reports', 'ig_insights']);

  return (
    <>
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={<PrimaryAction onClick={ig.openCreate}>+ Create report</PrimaryAction>}
      />
      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/reportgen" />
      </div>
      <div className="mt-6">{children}</div>

      {/* Mounted only while open, so the form is fresh on every open. */}
      {ig.createOpen ? <CreateReportModal /> : null}
    </>
  );
}
