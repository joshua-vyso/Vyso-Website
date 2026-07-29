/**
 * PlanWise — the strategic planning layer ("business GPS"). Types and structural
 * constants for goals, budget, forecast, scenarios, financial flow and
 * cross-module decisions. Every recommendation names the module RESPONSIBLE for
 * closing the gap, so the UI stays a routing surface rather than a dead-end
 * report.
 *
 * Where the numbers come from:
 *  - persisted plan   → `pw_budget_lines`, `pw_goals`, `pw_forecast`,
 *                       `pw_scenarios`, `pw_decisions`, plus shared `pl_targets`
 *  - measured reality → derived per request in `planwise-actuals.ts` from
 *                       OrderFlow sales, PricePilot unit costs, WasteWatch
 *                       events and receivables (see `planwise-data.ts`)
 *
 * The constants that remain here (`RECOMMENDATIONS`, `FORECAST_DRIVERS`,
 * `FORECAST_COMMENTARY`, `AI_SCENARIO`, `GOAL_TIMELINE`, `MOBILE_SNAPSHOT`) are
 * FALLBACKS only: each view prefers the measured equivalent and labels the
 * difference, so an org with nothing measurable yet still sees a populated
 * screen that is honestly marked as illustrative.
 */

import type { VysoModuleKey } from './module-meta';
import type { PlanWiseActuals } from './planwise-actuals';

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export interface BudgetRow {
  cat: string;
  budgeted: number;
  actual: number;
  profitImpact: number;
  suggestedAction: string;
  /** Module that can act on this category (for "Review →"). */
  module?: VysoModuleKey;
  color: string;
  /** `pw_budget_lines.id` — present for persisted rows, needed to edit them. */
  rowId?: string;
}

export function budgetStatus(b: { budgeted: number; actual: number }): { label: string; tone: 'positive' | 'warning' | 'critical' | 'neutral' } {
  if (b.actual > b.budgeted * 1.02) return { label: 'Over budget', tone: 'critical' };
  if (b.actual < b.budgeted * 0.9) return { label: 'Under budget', tone: 'neutral' };
  return { label: 'On track', tone: 'positive' };
}

// ---------------------------------------------------------------------------
// Monthly goal + goal summaries
// ---------------------------------------------------------------------------

export interface MonthlyGoal {
  label: string;
  targetRevenue: number;
  currentForecast: number;
}
export interface GoalSummary {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: 'R' | '%';
  higherIsBetter: boolean;
  module?: VysoModuleKey;
  /** Recent trend for a sparkline. */
  trend: number[];
  /** `pw_goals.id` — present for persisted rows, needed to edit them. */
  rowId?: string;
  /** True when `current` was measured from live module data this request. */
  derived?: boolean;
}
/** Position markers (0–100) for the goal timeline: where we are vs forecast-finish vs the month. */
export const GOAL_TIMELINE = { monthProgress: 70, forecastFinish: 95, goal: 100 };

/** Informational relationship chain (Revenue → Margins → Profit → Cash → Growth). */
export const GOAL_CHAIN: { label: string; module?: VysoModuleKey }[] = [
  { label: 'Revenue', module: 'orderflow' },
  { label: 'Margins', module: 'pricepilot' },
  { label: 'Profit' },
  { label: 'Cash' },
  { label: 'Growth' },
];

// ---------------------------------------------------------------------------
// Decisions (cross-module recommendations as actionable tasks)
// ---------------------------------------------------------------------------

export type RecStatus = 'open' | 'in_progress' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export interface PlanRecommendation {
  id: string;
  module: VysoModuleKey;
  action: string;
  impact: string;
  /** Signed rand impact for sorting/summary. */
  impactValue: number;
  priority: Priority;
  status: RecStatus;
}
export const RECOMMENDATIONS: PlanRecommendation[] = [
  { id: 'r1', module: 'procurepulse', action: 'Reduce Produce overspend', impact: '+R 11 200', impactValue: 11200, priority: 'high', status: 'open' },
  { id: 'r2', module: 'orderflow', action: 'Recover outstanding invoices', impact: '+R 18 000', impactValue: 18000, priority: 'high', status: 'in_progress' },
  { id: 'r3', module: 'orderflow', action: 'Increase average order value', impact: '+R 320 / order', impactValue: 6400, priority: 'medium', status: 'open' },
  { id: 'r4', module: 'wastewatch', action: 'Reduce preventable waste', impact: '+R 2 400', impactValue: 2400, priority: 'medium', status: 'open' },
  { id: 'r5', module: 'pricepilot', action: 'Review 6 low-margin products', impact: '+R 6 400', impactValue: 6400, priority: 'high', status: 'open' },
  { id: 'r6', module: 'docu', action: 'Add 3 missing expense documents', impact: 'Cleaner forecast', impactValue: 0, priority: 'low', status: 'open' },
];
export const REC_STATUS_LABEL: Record<RecStatus, string> = { open: 'Open', in_progress: 'In progress', done: 'Done' };
export const REC_STATUSES: readonly RecStatus[] = ['open', 'in_progress', 'done'];
/** Clicking the status chip walks open → in progress → done → open. */
export function nextRecStatus(s: RecStatus): RecStatus {
  return s === 'open' ? 'in_progress' : s === 'in_progress' ? 'done' : 'open';
}

/**
 * A decision the org is actually tracking (`pw_decisions`) — or a live
 * suggestion PlanWise derived this request and is offering to start tracking.
 * `rowId` is the discriminator: persisted rows have one, suggestions do not.
 */
export interface PlanDecision {
  /** `pw_decisions.id`, or null for an untracked suggestion. */
  rowId: string | null;
  /** Stable key — matches the suggestion it came from, so adopting one twice is idempotent. */
  key: string;
  module: VysoModuleKey;
  action: string;
  impact: string;
  impactValue: number;
  priority: Priority;
  status: RecStatus;
  /** Why PlanWise raised it (measured evidence), when known. */
  because: string | null;
  note: string | null;
}

/** Highest priority + biggest rand impact first. */
export function sortDecisions(list: PlanDecision[]): PlanDecision[] {
  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  const done: Record<RecStatus, number> = { open: 0, in_progress: 0, done: 1 };
  return [...list].sort(
    (a, b) => done[a.status] - done[b.status] || rank[a.priority] - rank[b.priority] || b.impactValue - a.impactValue,
  );
}
export const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; label: string }> = {
  high: { bg: '#FCEBEB', fg: '#A32D2D', label: 'High' },
  medium: { bg: '#FBEEDA', fg: '#854F0B', label: 'Medium' },
  low: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Low' },
};

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export interface ForecastLine {
  id: string;
  label: string;
  value: number;
  target: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  trend: 'up' | 'down' | 'flat';
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
  data: number[];
  /** `pw_forecast.id` — present for persisted rows, needed to edit them. */
  rowId?: string;
  /** Measured month-to-date value for this line, when a live feed covers it. */
  measured?: number | null;
}

/** Expense-style lines are "good when low"; every other line is good when high. */
export function forecastLowerIsBetter(id: string): boolean {
  return id === 'exp' || id === 'expenses';
}

/** Re-derive tone + trend after an edit so the card colouring stays honest. */
export function forecastTone(line: { id: string; value: number; target: number }): {
  tone: ForecastLine['tone'];
  trend: ForecastLine['trend'];
} {
  if (line.target === 0) return { tone: 'neutral', trend: 'flat' };
  const diff = (line.value - line.target) / line.target;
  const good = forecastLowerIsBetter(line.id) ? -diff : diff;
  const tone: ForecastLine['tone'] = good >= 0 ? 'positive' : good >= -0.05 ? 'warning' : 'critical';
  const trend: ForecastLine['trend'] = Math.abs(diff) < 0.01 ? 'flat' : diff > 0 ? 'up' : 'down';
  return { tone, trend };
}
export interface ForecastDriver {
  label: string;
  pct: number;
  module?: VysoModuleKey;
  color: string;
}
export const FORECAST_DRIVERS: ForecastDriver[] = [
  { label: 'Orders', pct: 68, module: 'orderflow', color: '#3E7BC4' },
  { label: 'Margins', pct: 16, module: 'pricepilot', color: '#2E7D67' },
  { label: 'Expenses', pct: 10, module: 'procurepulse', color: '#854F0B' },
  { label: 'Waste', pct: 6, module: 'wastewatch', color: '#A32D2D' },
];
export const FORECAST_COMMENTARY: string[] = [
  'Revenue is trending below target primarily due to a lower average order value this month.',
  'Current waste costs account for roughly R 4 200 of lost projected profit.',
  'Recovering outstanding invoices would extend cash runway by approximately 0.4 months.',
];

// ---------------------------------------------------------------------------
// Scenarios (interactive builder)
// ---------------------------------------------------------------------------

/** Current baseline the scenario sliders adjust from (derived per-org from budget). */
export interface ScenarioBase {
  revenue: number;
  expenses: number;
  cogs: number;
  cash: number;
  outstanding: number;
  runwayMonths: number;
}

export interface ScenarioSlider {
  id: 'revenueGrowth' | 'expenseReduction' | 'marginImprovement' | 'wasteReduction' | 'invoiceRecovery';
  label: string;
  max: number;
  unit: string;
  module?: VysoModuleKey;
}
export const SCENARIO_SLIDERS: ScenarioSlider[] = [
  { id: 'revenueGrowth', label: 'Revenue growth', max: 15, unit: '%', module: 'orderflow' },
  { id: 'expenseReduction', label: 'Expense reduction', max: 15, unit: '%', module: 'procurepulse' },
  { id: 'marginImprovement', label: 'Margin improvement', max: 10, unit: '%', module: 'pricepilot' },
  { id: 'wasteReduction', label: 'Waste reduction', max: 50, unit: '%', module: 'wastewatch' },
  { id: 'invoiceRecovery', label: 'Invoice recovery', max: 100, unit: '%', module: 'orderflow' },
];
export type SliderValues = Record<ScenarioSlider['id'], number>;

export interface ScenarioResult {
  revenue: number;
  expenses: number;
  profit: number;
  cash: number;
  runwayMonths: number;
  diffVsCurrent: number;
}
/** Pure projection from slider settings against the org's baseline. */
export function projectScenario(v: SliderValues, base: ScenarioBase): ScenarioResult {
  const currentProfit = base.revenue - base.expenses;
  const revenue = base.revenue * (1 + v.revenueGrowth / 100);
  const expenses = base.expenses * (1 - v.expenseReduction / 100);
  const marginGain = revenue * (v.marginImprovement / 100);
  const wasteSaved = base.expenses * 0.01 * (v.wasteReduction / 100);
  const recovered = base.outstanding * (v.invoiceRecovery / 100);
  const profit = revenue - expenses + marginGain + wasteSaved;
  const cash = base.cash + recovered + Math.max(0, profit - currentProfit) * 0.5;
  const runwayMonths = base.runwayMonths + recovered / Math.max(1, base.expenses / 8) + (profit - currentProfit) / Math.max(1, base.expenses / 6);
  return { revenue, expenses, profit, cash, runwayMonths: Math.max(0, runwayMonths), diffVsCurrent: profit - currentProfit };
}

export type RiskLevel = 'Low' | 'Medium' | 'High';
export interface Scenario {
  id: string;
  title: string;
  description: string;
  assumption: string;
  sliders: SliderValues;
  risk: RiskLevel;
  probability: number;
}
const Z: SliderValues = { revenueGrowth: 0, expenseReduction: 0, marginImprovement: 0, wasteReduction: 0, invoiceRecovery: 0 };
export const RISK_STYLE: Record<RiskLevel, { bg: string; fg: string }> = {
  Low: { bg: '#E1F5EE', fg: '#0F6E56' },
  Medium: { bg: '#FBEEDA', fg: '#854F0B' },
  High: { bg: '#FCEBEB', fg: '#A32D2D' },
};

/** The "Generate best scenario" AI recommendation (mock). */
export const AI_SCENARIO = {
  steps: ['Increase average order value by 4%', 'Reduce Produce spend by 3%', 'Raise margins on 8 products'],
  additionalProfit: 32000,
  sliders: { ...Z, revenueGrowth: 4, expenseReduction: 3, marginImprovement: 2 } as SliderValues,
};

// ---------------------------------------------------------------------------
// Financial flow
// ---------------------------------------------------------------------------

export interface FlowNode {
  key: string;
  label: string;
  value: number;
  tone: 'neutral' | 'positive' | 'critical';
  module?: VysoModuleKey;
  /** Sub-breakdown shown when the node is expanded. */
  children?: { label: string; value: number; module?: VysoModuleKey }[];
}

// ---------------------------------------------------------------------------
// Mobile snapshot
// ---------------------------------------------------------------------------

export type SnapshotSeverity = 'positive' | 'warning' | 'critical' | 'neutral';
export interface MobileSnapshot {
  id: string;
  label: string;
  value: string;
  severity: SnapshotSeverity;
}
export const MOBILE_SNAPSHOT: MobileSnapshot[] = [
  { id: 'rev', label: 'Revenue progress', value: '82%', severity: 'positive' },
  { id: 'budget', label: 'Budget used', value: '68%', severity: 'warning' },
  { id: 'gap', label: 'Forecast gap', value: '−R 18k', severity: 'warning' },
  { id: 'runway', label: 'Cash runway', value: '4.2 months', severity: 'neutral' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Progress toward a goal as 0–120 (handles "lower is better" ceilings). */
export function goalProgress(g: { target: number; current: number; higherIsBetter: boolean }): number {
  if (g.target <= 0) return 0;
  const pct = g.higherIsBetter ? (g.current / g.target) * 100 : (g.target / Math.max(1, g.current)) * 100;
  return Math.max(0, Math.min(120, Math.round(pct)));
}

export type GoalTone = 'positive' | 'warning' | 'critical';
/** Green only when the goal is actually met (>=100%); a shortfall reads amber/red. */
export function goalTone(pct: number): GoalTone {
  if (pct >= 100) return 'positive';
  if (pct >= 85) return 'warning';
  return 'critical';
}
export function goalToneColor(t: GoalTone): string {
  return t === 'positive' ? '#0F6E56' : t === 'warning' ? '#854F0B' : '#A32D2D';
}

// ---------------------------------------------------------------------------
// Per-org data bundle (fetched in lib/platform/planwise-data.ts)
// ---------------------------------------------------------------------------

export interface PlanWiseData {
  budget: BudgetRow[];
  goals: GoalSummary[];
  forecast: ForecastLine[];
  scenarios: Scenario[];
  /** Revenue actuals series for the monthly-goal sparkline. */
  revenueSeries: number[];
  totalBudget: number;
  totalActual: number;
  scenarioBase: ScenarioBase;
  monthlyGoal: MonthlyGoal;
  financialFlow: FlowNode[];
  /** Month-to-date measurements from OrderFlow / PricePilot / WasteWatch. */
  actuals: PlanWiseActuals;
  /** Tracked decisions (pw_decisions) plus live untracked suggestions. */
  decisions: PlanDecision[];
  /** True when `pw_decisions` has not been created yet (surface the setup hint). */
  decisionsNeedSetup: boolean;
  /** The org's target gross margin from `pl_targets`, when set. */
  targetMarginPct: number | null;
}
