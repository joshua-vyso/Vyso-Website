/**
 * Shared types for the public-site module showcase data
 * (`/platform/modules` and `/platform/modules/[slug]`).
 *
 * The per-module content lives in `lib/marketing/module-data/<slug>.ts` and is
 * assembled into one ordered list by `lib/marketing/modules.ts` — import from
 * there, not from the data files directly.
 *
 * Everything here is presentation copy for the public site, NOT the platform's
 * feature registry (see `lib/platform/modules.ts` for the canonical
 * `key -> label -> route` mapping the desktop/mobile apps use).
 */

export interface ModuleScreenshot {
  /** Path under /public, e.g. "/screenshots/modules/orderflow-invoicing.png". */
  src: string;
  alt: string;
  /** Faux browser-bar URL shown above the frame, e.g. "app.vyso.co.za/orderflow/invoices". */
  label: string;
  /** The capture has empty space in its lower ~40% — show only the top of it. */
  cropTop?: boolean;
}

/**
 * One "Inside <Module>" block: a real sub-screen, what it does, and the
 * specific things on it. `screenshot: null` means the capability is described
 * in copy only — either the screen is empty in the demo org, or (ServiceDen)
 * the module has no public screenshots at all.
 */
export interface ModuleFeatureSection {
  /** Stable anchor id, unique within the module. */
  id: string;
  title: string;
  /** 2-3 sentences, problem-first, naming real screen elements. */
  copy: string;
  /** 2-4 capability lines using the exact labels the app uses. */
  bullets: readonly string[];
  screenshot: ModuleScreenshot | null;
  /**
   * Chips rendered inside the gradient placeholder panel when there is no
   * screenshot — used for ServiceDen, which is internal-only.
   */
  placeholderTags?: readonly string[];
}

/** One step in the "How it fits your week" narrative. */
export interface ModuleWorkflowStep {
  title: string;
  copy: string;
}

/** A sibling module this one genuinely exchanges data with. */
export interface ModuleWorksWith {
  /** Slug of another entry in MARKETING_MODULES. */
  slug: string;
  /** One line, grounded in a real data relationship — not a generic "integrates with". */
  reason: string;
}

/** An industry page this module maps onto, with the reason it fits. */
export interface ModuleIndustryFit {
  /** Route under /industries. */
  href: string;
  name: string;
  reason: string;
}

export interface ModuleFaq {
  question: string;
  answer: string;
}

/**
 * Index grouping for `/platform/modules` (Phase 2, Workstream A — added, not
 * part of the original data set). Matches `.ai/plan_phase2_product_cluster.md`
 * exactly: Documents (Doc-U) · Orders & money (OrderFlow, PricePilot) ·
 * Suppliers & stock (ProcurePulse, SupplySync, WasteWatch, PlanWise) · People
 * (ShiftBoard, ServiceDen) · Insight (InsightGen).
 */
export type ModuleGroup = "documents" | "orders-money" | "suppliers-stock" | "people" | "insight";

/**
 * Availability of the module itself on the public site — distinct from an
 * agent's status (see `AGENT_STATUS` in `modules.ts`, which is about whether a
 * Finch *agent* reading this module is live, rolling out or on a customer's
 * audit roadmap). Every module here is built and running; the only question is
 * who can see it. All ten currently have real screenshots except ServiceDen,
 * which is gated to a single internal Vyso account (see
 * `lib/platform/serviceden-access.ts`) — hence `LIMITED ROLLOUT`, the exact
 * chip text the plan specifies for it.
 */
export type ModuleAvailability = "LIVE" | "LIMITED ROLLOUT";

export interface MarketingModule {
  slug: string;
  name: string;
  role: string;
  tagline: string;
  description: string;
  capabilities: readonly string[];
  screenshots: readonly ModuleScreenshot[];
  featureSections: readonly ModuleFeatureSection[];
  workflow: readonly ModuleWorkflowStep[];
  worksWith: readonly ModuleWorksWith[];
  industryFit: readonly ModuleIndustryFit[];
  faqs: readonly ModuleFaq[];
  relatedSolutionHrefs: readonly string[];
  relatedIndustryHrefs: readonly string[];
  appUrlLabel: string;
  /** Index grouping — see `ModuleGroup`. */
  group: ModuleGroup;
  /** Module-level availability chip — see `ModuleAvailability`. */
  status: ModuleAvailability;
  /**
   * Which of Finch's named example agents (`AGENT_STATUS` in `modules.ts`)
   * genuinely read or write this module's data today, grounded in the
   * `worksWith`/feature copy above — not every module has one. Order is
   * display order for the "used by" chips.
   */
  agents: readonly string[];
  /**
   * 2–3 sentences, server copy, for the detail page's "How Finch uses it"
   * section: which agents read/write this module's data and what they do
   * with it. Describes the data relationship, not an outcome the module
   * itself can't show — matches the honesty rule in `.ai/vyso_v2.md` §4.
   */
  howFinchUsesIt: string;
}
