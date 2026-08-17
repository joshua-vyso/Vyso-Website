/**
 * Postgres error helpers shared across the platform.
 *
 * Once the (org_id, lower(name)) unique indexes exist (supabase/dedup-unique-indexes.sql),
 * a duplicate-name insert fails with SQLSTATE 23505 instead of silently creating a
 * second row. Find-or-create paths re-select the winner on conflict; user-facing
 * add/import paths turn it into a friendly "already exists" message.
 */

type MaybePgError = { code?: string | null; message?: string | null } | null | undefined;

/** True when an insert failed a unique constraint / index (duplicate row). */
export function isUniqueViolation(error: MaybePgError): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = error.message ?? '';
  return /duplicate key|unique constraint|already exists|23505/i.test(msg);
}

/**
 * True when a query hit a table that isn't in this database yet.
 *
 * Several supabase/*.sql migrations are pasted into the SQL editor by hand, so
 * a deployed build can legitimately run ahead of the schema. Screens that must
 * survive that (a landing page, a feed) use this to fall back to an empty
 * state instead of a 500.
 *
 * TWO codes, not one: Postgres raises 42P01 ("relation ... does not exist"),
 * but PostgREST usually answers first — it fails the request against its own
 * schema cache with PGRST205 ("Could not find the table 'public.x' in the
 * schema cache") and never reaches the planner. The message probes are the
 * belt-and-braces for older PostgREST builds that returned neither code.
 * The same pair is open-coded in several app/api/procurepulse routes; new
 * callers should use this helper rather than adding a fourth copy.
 */
export function isMissingRelation(error: MaybePgError): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = error.message ?? '';
  return /relation .* does not exist|could not find the table/i.test(msg);
}
