/**
 * Marketing data for the "All Modules" section (`/platform/modules` and
 * `/platform/modules/[slug]`). This is presentation copy for the public site —
 * NOT the platform's feature registry. See `lib/platform/modules.ts` for the
 * canonical `key -> label -> route` mapping the desktop/mobile apps use.
 *
 * Route-key <-> brand-name mapping (per `lib/platform/modules.ts`):
 *   marginview -> PlanWise, wastelog -> WasteWatch, suppliers -> SupplySync,
 *   reportgen -> InsightGen. ServiceDen has no entry in that registry — it is
 *   gated to a single internal Vyso account (see `lib/platform/serviceden-access.ts`),
 *   and is described on the site as internal/limited-rollout rather than GA.
 *
 * Per-module content lives in `lib/marketing/module-data/<slug>.ts`; this file
 * only assembles it, so `@/lib/marketing/modules` stays the single import site.
 *
 * Copy rules for this data set:
 *  - Every feature claim, KPI label, column name and FAQ answer is grounded in
 *    the module inventories in `.ai/inventory/` (read from the running app's
 *    code), not invented.
 *  - Screenshots were captured from the running platform with a demo org — only
 *    files that exist in `public/screenshots/modules/` are referenced here.
 *    ServiceDen has none and uses gradient placeholder panels instead.
 *  - Unbuilt or roadmap features (ShiftBoard's roster generation, PlanWise's
 *    saved scenarios, ProcurePulse Counts, ServiceDen invoice email) are named
 *    as roadmap or omitted — never presented as shipped.
 */

import { docU } from "./module-data/doc-u";
import { insightgen } from "./module-data/insightgen";
import { orderflow } from "./module-data/orderflow";
import { planwise } from "./module-data/planwise";
import { pricepilot } from "./module-data/pricepilot";
import { procurepulse } from "./module-data/procurepulse";
import { serviceden } from "./module-data/serviceden";
import { shiftboard } from "./module-data/shiftboard";
import { supplysync } from "./module-data/supplysync";
import { wastewatch } from "./module-data/wastewatch";
import type { MarketingModule, ModuleGroup } from "./module-types";

export type {
  MarketingModule,
  ModuleAvailability,
  ModuleFaq,
  ModuleFeatureSection,
  ModuleGroup,
  ModuleIndustryFit,
  ModuleScreenshot,
  ModuleWorkflowStep,
  ModuleWorksWith,
} from "./module-types";

export const MARKETING_MODULES: readonly MarketingModule[] = [
  orderflow,
  docU,
  procurepulse,
  pricepilot,
  planwise,
  wastewatch,
  shiftboard,
  supplysync,
  insightgen,
  serviceden,
] as const;

export const MARKETING_MODULE_BY_SLUG: Record<string, MarketingModule> = Object.fromEntries(
  MARKETING_MODULES.map((module) => [module.slug, module]),
);

export const MARKETING_MODULE_SLUGS: readonly string[] = MARKETING_MODULES.map(
  (module) => module.slug,
);

/** Previous/next module in registry order, wrapping at each end. */
export function getAdjacentModules(slug: string): {
  previous: MarketingModule;
  next: MarketingModule;
} {
  const index = MARKETING_MODULES.findIndex((module) => module.slug === slug);
  const count = MARKETING_MODULES.length;
  const previous = MARKETING_MODULES[(index - 1 + count) % count];
  const next = MARKETING_MODULES[(index + 1) % count];
  return { previous, next };
}

/**
 * Index-page grouping (Phase 2, Workstream A). Order and membership are the
 * plan's, verbatim: `.ai/plan_phase2_product_cluster.md` "Groups (H2 mono
 * labels): Documents (Doc-U) · Orders & money (OrderFlow, PricePilot) ·
 * Suppliers & stock (ProcurePulse, SupplySync, WasteWatch, PlanWise) · People
 * (ShiftBoard, ServiceDen LIMITED ROLLOUT) · Insight (InsightGen)." Slugs, not
 * module objects, so this stays a plain data table independent of
 * `MARKETING_MODULES`' own (unrelated) array order.
 */
export const MODULE_GROUPS: readonly { id: ModuleGroup; label: string; slugs: readonly string[] }[] = [
  { id: "documents", label: "Documents", slugs: ["doc-u"] },
  { id: "orders-money", label: "Orders & money", slugs: ["orderflow", "pricepilot"] },
  {
    id: "suppliers-stock",
    label: "Suppliers & stock",
    slugs: ["procurepulse", "supplysync", "wastewatch", "planwise"],
  },
  { id: "people", label: "People", slugs: ["shiftboard", "serviceden"] },
  { id: "insight", label: "Insight", slugs: ["insightgen"] },
] as const;

/**
 * The status of a Finch *agent* — distinct from a module's own availability
 * (`ModuleAvailability`). Verbatim from `.ai/vyso_v2.md` §4's copy rule:
 * "Doc-U (live), ROLLING OUT (Price Watch), FROM YOUR AUDIT ROADMAP (Recon,
 * Debtors, Stock Sense, The Brief)." Kept here (not imported from
 * `components/finch/agents/agents-data.ts`) because that module is the
 * homepage roster's own copy — a module's availability table should not
 * depend on what one marketing section happens to list.
 */
export const AGENT_STATUS: Record<string, "LIVE" | "ROLLING OUT" | "FROM YOUR AUDIT ROADMAP"> = {
  "DOC-U": "LIVE",
  "PRICE WATCH": "ROLLING OUT",
  "RECON": "FROM YOUR AUDIT ROADMAP",
  "DEBTORS": "FROM YOUR AUDIT ROADMAP",
  "STOCK SENSE": "FROM YOUR AUDIT ROADMAP",
  "THE BRIEF": "FROM YOUR AUDIT ROADMAP",
};
