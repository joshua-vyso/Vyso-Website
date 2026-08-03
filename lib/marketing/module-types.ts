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
}
