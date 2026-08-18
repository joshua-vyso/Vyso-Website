/**
 * Who may see what, as ONE rule with two names.
 *
 * THE RULE. Owners and admins run the business; members work in it. Everything
 * that quotes money — outstanding balances, overdue invoices, the revenue
 * figures on the OrderFlow dashboard — has been gated on `role in (owner,
 * admin)` since the platform shipped, and The Brief is now gated on the same
 * thing: every card on it is a claim about money (a supplier's price, a
 * customer's overdue balance, the cost of running a line out), so a Brief a
 * member could read would be a way around the gate the money tools already
 * enforce.
 *
 * TWO NAMES, ONE IMPLEMENTATION, ON PURPOSE. `canSeeMoney` and `canSeeBrief`
 * are the same predicate today and are deliberately NOT collapsed into a single
 * exported function. They answer different questions — "may this person read a
 * figure?" and "may this person open the agents' feed?" — and the day those
 * questions get different answers (a viewer role that sees the brief but not
 * the rands, say) the change should be one function body, not a search for
 * every call site that happened to mean the other thing. Keeping them as two
 * named exports over one shared body is what makes that a one-line change
 * instead of an archaeology exercise.
 *
 * FAIL CLOSED. A missing, null or unrecognised role is NOT an admin. Roles come
 * from `profiles.role`, which is free text in the database (`UserRole` is a
 * TypeScript narrowing, not a check constraint), so "unknown" is a state that
 * can really occur — a half-finished invite, a row written by a migration, a
 * typo. The safe reading of an unknown role is the least privileged one: a
 * wrongly-excluded user is fixed by setting their role, whereas a wrongly-
 * included one has already read the figures.
 *
 * THIS IS UI AND ROUTE GATING, NOT ROW SECURITY. RLS is untouched by this
 * module and by the wave that introduced it: `agent_findings` is still readable
 * by every member of the org at the database level, exactly as it was. What
 * this predicate does is stop the product from RENDERING that feed and from
 * putting it into Finch's prelude — the same layer at which `canSeeMoney` has
 * always worked (the money tools return a `restricted` string rather than the
 * figures; they do not fail the query). Anyone reaching for real row-level
 * enforcement should add a policy, not extend this file.
 *
 * Framework-free and dependency-free so both server routes and the layout can
 * import it, and so `node --test` can pin the truth table directly.
 */

/**
 * Roles as they arrive from `profiles.role`.
 *
 * Typed loosely rather than as `UserRole` because every caller reads it off a
 * row or a session that may not have one: `session.profile` is nullable, and
 * `/api/ai/agent` selects the column into `string | null`. Narrowing at the
 * boundary would just push an `?? null` onto every call site.
 */
export type RoleInput = string | null | undefined;

/** The roles that run the business. Not exported — the two predicates below are
 *  the interface, so nobody can grow a third opinion by importing the list and
 *  writing their own `includes`. */
const ADMIN_ROLES: readonly string[] = ['owner', 'admin'];

/**
 * May this person see money figures? Mirrors what `RoleGate.useIsAdmin` decides
 * on the client and what `/api/ai/agent` enforces before handing the finance
 * tools their context.
 */
export function canSeeMoney(role: RoleInput): boolean {
  return typeof role === 'string' && ADMIN_ROLES.includes(role);
}

/**
 * May this person open The Brief — `/app`, `/app?view=all`, `/app?view=history`
 * and `/app/finding/*` — and should the rail show them its two rows?
 *
 * Callers that get a `false` here REDIRECT rather than render a 403: a member
 * has no business being told there is a screen they are not allowed to see,
 * and the rail never offered them the link in the first place, so the only way
 * to arrive is a stale bookmark or a typed URL. Both deserve to land somewhere
 * useful.
 */
export function canSeeBrief(role: RoleInput): boolean {
  return canSeeMoney(role);
}
