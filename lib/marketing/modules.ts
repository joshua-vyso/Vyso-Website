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
import type { MarketingModule } from "./module-types";

export type {
  MarketingModule,
  ModuleFaq,
  ModuleFeatureSection,
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
