/**
 * The rail, as a list (`.ai/plan_phase0_teardown_shell.md` Task E).
 *
 * WHAT THIS REPLACES. The rail used to be assembled from three moving parts:
 * two hard-coded Brief rows, this user's conversations, and `railModules()` —
 * the nine modules the org's `features` flags happened to enable, behind an
 * "Under the hood" toggle, with locked ones rendering as a modal trigger
 * instead of a link. The restructure's whole premise is that an owner should
 * not have to know which of nine products a question belongs to, so the nav is
 * now a FIXED list of nine places plus Review — the same rail for every org,
 * whatever they have bought.
 *
 * STATIC ON PURPOSE, AND THAT IS THE INTERESTING PART. Nothing here reads
 * `features`, `lockedModules` or the plan tier: entitlement stopped being a
 * navigation concern this phase. The old module routes still work, still carry
 * their own guards, and are simply no longer offered here (plan acceptance
 * criterion 6) — so a row can never again advertise a screen that answers
 * "locked, email Joshua".
 *
 * NO FRAMEWORK, NO HOOKS, NO 'use client'. Three components import this — the
 * desktop rail (server), RailNav (client) and the mobile drawer (client) — so
 * it has to stay safe on either side of the boundary, exactly as shell-data.ts
 * does next door.
 *
 * ICONS ARE PATH DATA, NOT COMPONENTS. Every row draws the same 14px, 24-unit,
 * stroke-only frame, so the only thing that differs between them is one `d`
 * string. Two rows are exceptions and are handled by RailNav rather than by a
 * shape here: Overview wears the gradient live dot (the agents' own mark — see
 * brief-display.ts) and Review is `RailReview`, which brings its own icon, its
 * red dot and its "draw nothing when the count is 0" rule.
 */

/** Identifies a row for the two cases RailNav special-cases. Also the React key
 *  — a stable string per row, unlike an array index. */
export type NavKey =
  | 'overview'
  | 'stock'
  | 'sales'
  | 'fleet'
  | 'expenses'
  | 'staff'
  | 'compliance'
  | 'documents'
  | 'review'
  | 'settings';

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  /** SVG path data for a 24×24 stroke-only icon, or null for the two rows that
   *  draw their own mark (`overview`, `review`). */
  icon: string | null;
}

/**
 * The rail's rows, top to bottom.
 *
 * Order is the day's shape, not the alphabet: what happened (Overview), then
 * what you buy and hold (Stock & Suppliers), then what you sell (Sales &
 * Customers), then the three cost centres (Fleet, Services & Expenses, Staff),
 * then the two things that are about paperwork rather than money (Compliance,
 * Documents), and finally the two that are about the system rather than the
 * business (Review, Settings).
 *
 * Seven of these are stubs this phase and say so on screen, naming the live
 * surfaces they will fold in. Overview is the Brief, unchanged; Review is the
 * decision queue, rehomed from `/app/chat/review` in Task C; Settings is the
 * existing workspace settings page.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'overview', label: 'Overview', href: '/app', icon: null },
  {
    key: 'stock',
    label: 'Stock & Suppliers',
    href: '/app/stock',
    icon: 'M12 3.75 20.25 8 12 12.25 3.75 8 12 3.75ZM3.75 12 12 16.25 20.25 12M3.75 16 12 20.25 20.25 16',
  },
  {
    key: 'sales',
    label: 'Sales & Customers',
    href: '/app/sales',
    icon: 'M3.75 17.25 9.5 11.5l3.75 3.75L20.25 8.25M15.5 8.25h4.75V13',
  },
  {
    key: 'fleet',
    label: 'Fleet',
    href: '/app/fleet',
    icon: 'M3.75 16.5v-9h10.5v9M14.25 10.5h3.5l2.5 3v3h-6M7.25 19a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM17.25 19a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z',
  },
  {
    key: 'expenses',
    label: 'Services & Expenses',
    href: '/app/expenses',
    icon: 'M5.75 3.75h12.5v16.5l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5V3.75ZM9 8.75h6M9 12.75h6',
  },
  {
    key: 'staff',
    label: 'Staff',
    href: '/app/staff',
    icon: 'M15.25 19.5v-1.25a3.5 3.5 0 0 0-3.5-3.5h-4a3.5 3.5 0 0 0-3.5 3.5v1.25M9.75 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM20.25 19.5v-1.25a3.5 3.5 0 0 0-2.5-3.35M15.25 4.95a3.25 3.25 0 0 1 0 6.1',
  },
  {
    key: 'compliance',
    label: 'Compliance',
    href: '/app/compliance',
    icon: 'M12 3.5 19 6v5.4c0 4.1-2.85 7.3-7 8.85-4.15-1.55-7-4.75-7-8.85V6l7-2.5ZM9.25 11.9l2.1 2.1 3.9-4.2',
  },
  {
    key: 'documents',
    label: 'Documents',
    href: '/app/documents',
    icon: 'M13.5 3.75H7.25a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5h9.5a1.5 1.5 0 0 0 1.5-1.5V8.75l-4.75-5ZM13.5 3.75v5h4.75',
  },
  { key: 'review', label: 'Review', href: '/app/review', icon: null },
  {
    key: 'settings',
    label: 'Settings',
    href: '/app/settings',
    icon: 'M4.25 7.25h9M17.25 7.25h2.5M4.25 16.75h3.5M11.75 16.75h8M15.25 5.25v4M8.25 14.75v4',
  },
];

/**
 * Is this row the one the reader is standing on?
 *
 * OVERVIEW MATCHES EXACTLY; everything else matches its subtree. `/app` is a
 * prefix of every route in the platform, so a `startsWith` there would light it
 * up on all ten rows at once. The others own their segment: `/app/documents/…`
 * is still Documents.
 *
 * `?view=history` and `?view=all` are DELIBERATELY still Overview. They are the
 * Brief's own two other views, reached from inside it, and the rail's job is to
 * say where the reader is — which is inside Overview, looking at more of it.
 * (The old rail had a separate History row and read the query string with
 * `useSearchParams` to tell them apart; that row is not in the new IA, which is
 * why RailNav no longer needs the hook — or the Suspense boundary AppRail used
 * to wrap it in.)
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}
