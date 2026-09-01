/* ── Analytics event taxonomy ─────────────────────────────────────────────
   Single typed `track()` used by every Finch marketing component instead of
   importing `@vercel/analytics` directly, so the event name + prop shape for
   each event is declared exactly once (here) and every call site is checked
   against it. Phase 4, `.ai/vyso_v2.md` §7.7 / `.ai/plan_phase4_search_ai_
   visibility.md` Workstream C.

   Never add a name/email/business/phone (or anything else a visitor typed
   into a form) to an event's props — these events describe what a visitor
   *did*, not who they are. `AuditFormVariant` etc. below are closed string
   unions, not free text, for exactly that reason.

   `track()` no-ops on the server: `@vercel/analytics`'s own `track()` reads
   `window` and either warns (production) or throws (development) when called
   there, so every call site would otherwise need its own `typeof window`
   guard. Doing it once here is the whole point of the wrapper. */
import { track as vercelTrack } from "@vercel/analytics";

export type AuditFormVariant = "audit" | "general" | "academy";
export type DemoDirection = "forward" | "reverse";

/** One entry per event this site emits. The value type is its prop shape —
    `Record<string, never>` for events that carry no props at all. */
export type AnalyticsEvents = {
  book_audit_click: { page: string; vertical?: string };
  audit_form_submit: { variant: AuditFormVariant };
  demo_played: { direction: DemoDirection };
  orbit_hover: Record<string, never>;
  finding_card_action_click: { agent: string; action: string };
  faq_open: { id: string };
  resource_request: { slug: string };
  academy_interest: Record<string, never>;
  outbound_click: { href: string };
  /* Orbit's waitlist. `trade` is a **slug from `lib/orbit/trades.ts`** (or the
     literals `"other"` / `"unspecified"`), never the free-text fields on the
     same form — see the rule at the top of this file. Typed `string` rather
     than a union of the ten slugs because that union would have to be imported
     from a data file this module otherwise has no reason to know about, and a
     `<select>` is the only thing that can produce the value. */
  orbit_waitlist_submit: { trade: string };
  /* Agency redesign (2026-09): the one conversion goal. `source` is a closed
     set of site placements, never visitor input. The form events mirror the
     brief's start → submit → success/failure funnel. */
  join_waitlist_click: { source: "hero_plasma" | "nav" | "mobile_nav" | "section_cta" | "footer" };
  waitlist_form_start: Record<string, never>;
  waitlist_form_submit: Record<string, never>;
  waitlist_form_success: Record<string, never>;
  waitlist_form_failure: { reason: "validation" | "network" | "server" };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Fire a typed analytics event. Safe to call from anywhere (event handlers,
    effects) — no-ops before hydration and on the server. */
export function track<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]): void {
  if (typeof window === "undefined") return;
  vercelTrack(event, props);
}
