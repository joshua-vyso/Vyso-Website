/**
 * WasteWatch — operational waste intelligence. Types + mock data connecting
 * Employee → Device → Recipe → Ingredient → Waste → Cost → Recommendation.
 * Devices automatically measure waste; every event eventually knows which device
 * measured it, who was using it, which recipe they prepared and which ingredient
 * became waste. Recipe definitions, ingredient costs and batches will later come
 * from ProcurePulse; shifts from ShiftBoard. Everything here is illustrative mock.
 */

import type { VysoModuleKey } from './module-meta';

/** Org-defined waste category label (from ww_waste_categories). */
export type WasteCategory = string;
export type WasteReason = 'Spoiled' | 'Expired' | 'Wilted' | 'Day-old' | 'Over-portioned' | 'Damaged' | 'Trim' | 'Prep error' | 'Other';
export type DeviceType = 'Bluetooth Scale' | 'Bench Scale' | 'Floor Scale' | 'Kitchen Scale' | 'IoT Sensor' | 'Barcode Station' | 'Camera Station' | 'Custom Device';
export type DeviceStatus = 'online' | 'offline' | 'calibrating' | 'attention';

// ---------------------------------------------------------------------------
// Waste events
// ---------------------------------------------------------------------------

export interface WasteEvent {
  id: string;
  date: string;
  time: string;
  item: string;
  category: WasteCategory;
  qty: number;
  unit: string;
  cost: number;
  reason: WasteReason;
  recipe: string | null;
  employee: string;
  device: string;
  location: string;
  preventable: boolean;
  notes?: string;
  // ProcurePulse-integration placeholders (populated once linked):
  ingredient?: string;
  supplier?: string;
  batch?: string;
  expectedQty?: number;
}

export const WASTE_REASONS: WasteReason[] = ['Spoiled', 'Expired', 'Wilted', 'Day-old', 'Over-portioned', 'Damaged', 'Trim', 'Prep error', 'Other'];

/** A waste category row (ww_waste_categories) — carries its own stats.
 *  cost/pct/trend are RECOMPUTED from ww_waste_events at read time (the stored
 *  columns are only a fallback), so the donut can never drift from the log. */
export interface WasteCategoryRow {
  id: string;
  name: string;
  color: string;
  cost: number;
  pct: number;
  trend: number[];
  /** True when the row was synthesised from events for a category that no longer
   *  exists in ww_waste_categories — shown, but not editable/removable. */
  derived?: boolean;
}

export interface CategoryStat {
  key: WasteCategory;
  cost: number;
  pct: number;
  color: string;
  trend: number[];
}

// ---------------------------------------------------------------------------
// Analytics aggregates
// ---------------------------------------------------------------------------

export interface EmployeeStat {
  name: string;
  cost: number;
  events: number;
  trend: 'up' | 'down' | 'flat';
  vsTeamPct: number; // +above / -below team average
}
export interface RecipeStat {
  recipe: string;
  wastePct: number;
  avgCost: number;
  frequency: number;
}

export const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const HEATMAP: { period: string; values: number[] }[] = [
  { period: 'Morning', values: [78, 64, 71, 66, 82, 90, 40] },
  { period: 'Lunch', values: [55, 48, 52, 50, 60, 72, 35] },
  { period: 'Dinner', values: [42, 38, 45, 44, 58, 80, 30] },
];

export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';
export const COST_TIMELINE: Record<TimePeriod, number[]> = {
  today: [120, 260, 180, 320, 410, 380, 290, 340],
  week: [3800, 4100, 3600, 4400, 4000, 4280, 3900],
  month: [16800, 17400, 15900, 18200, 17600, 18900],
  quarter: [52000, 49000, 54000, 51000],
  year: [180000, 172000, 168000, 190000, 176000, 184000, 179000, 188000, 181000, 175000, 192000, 186000],
};
export const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

// Splits the period's total waste cost (sum of CATEGORY_STATS) into avoidable vs not.
export const PREVENTABLE = { preventable: 4760, unavoidable: 5680 };

export interface WasteInsight {
  id: string;
  text: string;
  module?: VysoModuleKey;
}
export const INSIGHTS: WasteInsight[] = [
  { id: 'i1', text: 'Strawberries are consistently over-ordered — reduce next order by ~30%.', module: 'procurepulse' },
  { id: 'i2', text: 'Tomatoes regularly exceed recipe quantities during prep.', module: 'procurepulse' },
  { id: 'i3', text: 'Three staff members generate above-average waste — worth a quick refresher.', module: 'shiftboard' },
  { id: 'i4', text: 'Waste during breakfast prep is 22% higher than other services.' },
  { id: 'i5', text: 'Caesar Salad has the highest recipe waste at 18% — review portioning.' },
];

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface DeviceMeasurement {
  time: string;
  item: string;
  qty: number;
  unit: string;
}
export interface DeviceHistoryEvent {
  kind: 'connected' | 'assigned' | 'recipe' | 'calibration' | 'disconnected';
  label: string;
  time: string;
}
export interface DeviceAssignment {
  name: string;
  role: string;
  startedAt: string;
  shift: string;
}
export interface DeviceRecipe {
  name: string;
  expected: string[];
  currentWaste?: { item: string; qty: string };
}
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  status: DeviceStatus;
  battery: number | null;
  lastSync: string;
  firmware: string;
  calibration: string;
  eventsToday: number;
  currentUser: DeviceAssignment | null;
  currentRecipe: DeviceRecipe | null;
  measurements: DeviceMeasurement[];
  history: DeviceHistoryEvent[];
}

export const DEVICE_TYPES: DeviceType[] = ['Bluetooth Scale', 'Bench Scale', 'Floor Scale', 'Kitchen Scale', 'IoT Sensor', 'Barcode Station', 'Camera Station', 'Custom Device'];

export const DEVICE_STATUS_STYLE: Record<DeviceStatus, { bg: string; fg: string; label: string }> = {
  online: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Online' },
  offline: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Offline' },
  calibrating: { bg: '#E6F1FB', fg: '#0C447C', label: 'Calibrating' },
  attention: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Needs attention' },
};

// ---------------------------------------------------------------------------
// Per-org payload (fetched in wastewatch-data.ts)
// ---------------------------------------------------------------------------

export interface WasteWatchData {
  categories: WasteCategoryRow[];
  events: WasteEvent[];
  devices: Device[];
  employeeStats: EmployeeStat[];
  recipeStats: RecipeStat[];
  preventable: { preventable: number; unavoidable: number };
  /** Cost timeline per period, derived from the events (falls back to COST_TIMELINE). */
  timeline: Record<TimePeriod, number[]>;
  /** % change vs the previous comparable period, per period. null = no comparison. */
  timelineDelta: Record<TimePeriod, number | null>;
  /** True when `timeline` came from the events rather than the illustrative constant. */
  timelineDerived: boolean;
  foodCost: FoodCostContext;
  weekly: WeeklyReport | null;
  overPortion: OverPortionStat[];
  coaching: CoachingNote[];
  dayPatterns: DayPattern[];
  serviceHeatmap: { period: string; values: number[] }[];
  /** True when `serviceHeatmap` came from the events rather than HEATMAP. */
  heatmapDerived: boolean;
}

// ---------------------------------------------------------------------------
// Waste-in-margin loop — the number PricePilot's variance panel consumes
// ---------------------------------------------------------------------------

/** Which real numbers the food-cost denominator was built from. */
export type FoodCostBasis = 'purchases' | 'revenue' | 'none';

export interface FoodCostContext {
  basis: FoodCostBasis;
  /** Plain-language description of the denominator, shown next to the number. */
  basisLabel: string;
  /** Average waste cost per day across the logged window. */
  wastePerDay: number;
  /** Average food cost per day across the source window. */
  foodCostPerDay: number;
  /** Waste as % of food cost — null when there is no denominator to divide by. */
  pct: number | null;
  /** Days of waste data behind `wastePerDay`. */
  wasteDays: number;
  /** Days of purchase/sales data behind `foodCostPerDay`. */
  foodCostDays: number;
  /** Sales over the food-cost window (0 when unknown). */
  revenue: number;
  /** Cost-of-goods ratio applied to sales — only set when basis === 'revenue'. */
  cogsPct: number | null;
  /** Annualised rand value of the waste rate — the "what this costs us" figure. */
  annualised: number;
}

// ---------------------------------------------------------------------------
// Weekly waste report (Overview)
// ---------------------------------------------------------------------------

export interface CausePattern {
  reason: WasteReason;
  cost: number;
  events: number;
  /** Share of the window's total waste cost. */
  pct: number;
  preventable: boolean;
}

export interface WasteItemStat {
  item: string;
  cost: number;
  events: number;
  topReason: WasteReason;
}

export interface WeeklyReport {
  /** 7-day window, anchored to the most recent logged event (not to "today"). */
  start: string;
  end: string;
  /** True when the window ends more than a day before today — the log went quiet. */
  stale: boolean;
  total: number;
  events: number;
  preventable: number;
  preventablePct: number;
  prevTotal: number;
  /** % change vs the previous 7 days — null when there is no prior week to compare. */
  deltaPct: number | null;
  /** Preventable causes first, biggest rand value first. */
  topCauses: CausePattern[];
  topItems: WasteItemStat[];
  /** Plain-language "do this next week" lines derived from the causes above. */
  actions: string[];
}

// ---------------------------------------------------------------------------
// Reason-code insights (Analytics)
// ---------------------------------------------------------------------------

/** Over-portioning measured as actual qty vs the recipe's expected qty. */
export interface OverPortionStat {
  recipe: string;
  events: number;
  expectedQty: number;
  actualQty: number;
  /** Mean over-portion, e.g. 24 = 24% more than the recipe expects. */
  overPct: number;
  /** Cost attributable to the excess only, not the whole event. */
  excessCost: number;
  unit: string;
}

/** Constructive coaching note — framed as support, never as a blame list. */
export interface CoachingNote {
  name: string;
  events: number;
  preventableCost: number;
  totalCost: number;
  topReason: WasteReason | null;
  /** +above / −below the team average cost per person. */
  vsTeamPct: number;
  tone: 'coach' | 'watch' | 'praise';
  message: string;
}

export interface DayPattern {
  /** Mon…Sun, matching HEATMAP_DAYS. */
  day: string;
  cost: number;
  events: number;
  preventable: number;
}
