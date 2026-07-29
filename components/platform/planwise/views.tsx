'use client';

import { useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { SecondaryAction, KpiStrip, Kpi } from '@/components/platform/module-ui';
import { usePlanWise } from './context';
import { MonthlyGoalCard, GoalSummaryCards, MobileSnapshotCards } from './ui';
import { DecisionsPanel } from './DecisionsPanel';
import { FinancialFlow } from './FinancialFlow';
import { BudgetWorkspace } from './BudgetWorkspace';
import { ForecastCardsRich, ForecastDrivers, ForecastInsight } from './Forecast';
import { ScenariosWorkspace } from './Scenarios';
import { AddBudgetLineModal } from './AddBudgetLineModal';
import { BudgetVsActual, BudgetPaceStrip } from './BudgetVsActual';

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="of-display text-[20px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">{title}</h2>
      {subtitle ? <p className="mt-1.5 text-[14px] text-[#8A8E86]">{subtitle}</p> : null}
    </div>
  );
}

export function OverviewView() {
  const pw = usePlanWise();
  const { totalBudget, totalActual, monthlyGoal, scenarioBase, forecast, actuals } = pw;
  const profitLine = forecast.find((f) => f.id === 'profit');
  const forecastProfit = profitLine ? profitLine.value : scenarioBase.revenue - scenarioBase.expenses;

  // Budget health is read against TODAY'S pace, not the whole month — otherwise
  // every org looks comfortably under budget until the last day of the month.
  const costLines = actuals.categories.filter((c) => !c.higherIsBetter);
  const pacedBudget = costLines.reduce((s, c) => s + c.pacedBudget, 0);
  const spentToDate = costLines.reduce((s, c) => s + c.mtdActual, 0);
  const usedVsPace = pacedBudget > 0 ? Math.round((spentToDate / pacedBudget) * 100) : 0;
  const used = pacedBudget > 0 ? usedVsPace : totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const variance = pacedBudget > 0 ? spentToDate - pacedBudget : totalActual - totalBudget;

  // The module header and its "+ Add budget line" action live in PlanWiseChrome,
  // above the tab nav — this view renders only the overview's own content.
  if (pw.isEmpty) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">No plan set up yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Set a budget, goals and a forecast to see your revenue target, budget health and the decisions that close the gap here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Monthly revenue target" value={zar(monthlyGoal.targetRevenue)} sub={actuals.hasSales ? `${zar(actuals.revenueMtd)} banked so far` : undefined} />
        <Kpi
          label="Budget used vs pace"
          value={`${used}%`}
          accent={used > 105 ? '#A32D2D' : used > 100 ? '#854F0B' : '#0F6E56'}
          sub={pacedBudget > 0 ? `${zar(spentToDate)} of ${zar(pacedBudget)} by day ${actuals.pace.day}` : `${zar(totalActual)} of ${zar(totalBudget)}`}
        />
        <Kpi label="Forecast profit" value={zar(forecastProfit)} accent={forecastProfit >= 0 ? '#0F6E56' : '#A32D2D'} />
        <Kpi
          label="Expense variance today"
          value={`${variance >= 0 ? '+' : '−'}${zar(Math.abs(variance))}`}
          accent={variance > 0 ? '#A32D2D' : '#0F6E56'}
          sub={pacedBudget > 0 ? 'against budget pro-rated to today' : undefined}
        />
        <Kpi label="Cash runway" value={`${scenarioBase.runwayMonths.toFixed(1)} mo`} sub={actuals.outstanding > 0 ? `${zar(actuals.outstanding)} owed to you` : undefined} />
      </KpiStrip>

      <MonthlyGoalCard />
      <GoalSummaryCards />
      <BudgetPaceStrip />
      <DecisionsPanel />
      <FinancialFlow />
      <MobileSnapshotCards />
    </div>
  );
}

export function BudgetView() {
  const { node, show } = useToast();
  const [budgetOpen, setBudgetOpen] = useState(false);
  return (
    <div className="space-y-5">
      {node}
      <AddBudgetLineModal open={budgetOpen} onClose={() => setBudgetOpen(false)} onSaved={(c) => show(`${c} added to budget`)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Budget" subtitle="Explore where your budget goes — hover and click to dig in" />
        <SecondaryAction onClick={() => setBudgetOpen(true)}>+ Add category</SecondaryAction>
      </div>
      <BudgetVsActual />
      <BudgetWorkspace />
    </div>
  );
}

export function ForecastView() {
  const { node, show } = useToast();
  const { forecast } = usePlanWise();
  if (forecast.length === 0) {
    return (
      <div className="space-y-5">
        <PageTitle title="Forecast" subtitle="Where the business is expected to finish — and why" />
        <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">No forecast yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Once there&rsquo;s revenue, expense and cash history, PlanWise will project where the month is likely to land.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {node}
      <PageTitle title="Forecast" subtitle="Where the business is expected to finish — and why" />
      <ForecastCardsRich onEdited={(label) => show(`${label} forecast updated`)} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ForecastDrivers />
        <ForecastInsight />
      </div>
    </div>
  );
}

export function ScenariosView() {
  const { scenarioBase } = usePlanWise();
  if (scenarioBase.revenue === 0) {
    return (
      <div className="space-y-5">
        <PageTitle title="Scenarios" subtitle="Adjust the assumptions and watch the outcome recalculate live" />
        <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">Nothing to model yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Scenarios build on your revenue and expense baseline. Add a budget to start exploring what-ifs here.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageTitle title="Scenarios" subtitle="Adjust the assumptions and watch the outcome recalculate live" />
      <ScenariosWorkspace />
    </div>
  );
}
