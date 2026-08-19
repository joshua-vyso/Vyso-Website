import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation } from './db-errors';
import { getXeroAccessTokenForOrg } from './xero';
import {
  ifModifiedSinceHeader,
  mapXeroContactPage,
  mapXeroInvoicePage,
  MAX_RETRY_WAIT_MS,
  PAGE_PAUSE_MS,
  retryAfterMs,
  type XeroContactRow,
  type XeroInvoiceRow,
} from './xero-sync-shared';

/**
 * The Xero sync — reads one org's invoices and contacts out of Xero and writes
 * them into the local mirror (`supabase/xero-sync.sql`).
 *
 * READ ONLY, IN BOTH DIRECTIONS THAT MATTER. Nothing here writes to Xero: the
 * only verbs are GET. And nothing here writes to Vyso's own business tables
 * either — the mirror is its own island, so a bad sync can never corrupt an
 * invoice the business actually issued.
 *
 * FIVE RULES, four inherited from the Phase C agents' run loops and one new.
 *
 * 1. THE ORG ID IS THE ONLY FENCE. The caller is a service-role client, which
 *    bypasses RLS entirely, so every statement below filters `.eq('org_id',
 *    orgId)` by hand — including the upserts, whose conflict target is
 *    `(org_id, xero_invoice_id)`.
 *
 * 2. RE-RUNS ARE FREE. Idempotency is that unique pair: the nightly cron, a
 *    doubled cron and an owner mashing "Sync now" all converge on the same rows.
 *    The cursor is only ADVANCED on success, so a partial sync re-reads the
 *    window it failed in rather than skipping it.
 *
 * 3. AN ORDINARY DATA PROBLEM IS A WARNING, NOT AN EXCEPTION. A missing mirror
 *    table (this file can be deployed before the SQL is pasted), a page that
 *    fails to upsert, a rate limit that outlasts the retry budget — all are
 *    collected into the summary the route returns. Only something genuinely
 *    unexpected throws.
 *
 * 4. NOTHING IS DELETED. An invoice VOIDED in Xero stops coming back in the
 *    incremental window and its mirror row simply goes stale rather than
 *    vanishing. Deleting on absence would need a full read every night to tell
 *    "deleted" from "unchanged", which is precisely what `If-Modified-Since`
 *    exists to avoid. The staleness is bounded by the FULL RESYNC below.
 *
 * 5. XERO'S RATE LIMIT IS A CONTRACT, NOT A SUGGESTION — 60 calls per minute per
 *    tenant. Pages are fetched SEQUENTIALLY with a short pause between them, and
 *    a 429 is honoured by waiting `Retry-After` (capped) and retrying the SAME
 *    page. Parallelising the pages would halve the wall time and cost the tenant
 *    its whole minute's budget in one burst.
 *
 * WHEN A FULL RESYNC HAPPENS. `If-Modified-Since` is sent only when a cursor
 * exists AND is younger than `CURSOR_MAX_AGE_DAYS`. An older cursor is ignored
 * and the resource is read in full — which is what repairs a mirror that drifted
 * while the connection was broken, and what eventually retires rows that were
 * voided in Xero months ago.
 */

/** Xero's Accounting API. */
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0/';

/** Invoices page at 100; Contacts at 100 too. Xero's own page size — asking for
 *  more is ignored, asking for fewer just costs more calls. */
const PAGE_SIZE = 100;

/** A ceiling on pages per resource per run. 200 pages = 20,000 invoices, which
 *  is far beyond any Vyso customer and is here so a pathological response
 *  (a `page` parameter Xero starts ignoring, say) cannot spin a cron until its
 *  300s timeout. Hitting it is recorded as a warning. */
const MAX_PAGES = 200;

/** How many times one page is retried after a 429 before the run gives up on
 *  that resource and records a partial sync. */
const MAX_RETRIES = 3;

/** A cursor older than this is not trusted, and the resource is read in full.
 *  Two weeks is comfortably longer than any outage worth healing incrementally
 *  and short enough that a voided invoice cannot linger for a season. */
const CURSOR_MAX_AGE_DAYS = 14;

/** Rows per upsert. Postgres is happy with far more; this keeps any single
 *  statement's failure blast radius to one page. */
const UPSERT_CHUNK = 100;

export interface SyncXeroOptions {
  /** Read everything and report it; write NOTHING (not even the cursor). */
  dryRun?: boolean;
  /** Ignore the stored cursor and read both resources in full. */
  full?: boolean;
  /** Progress logging. Silent by default: the cron's output is its JSON body. */
  log?: (message: string) => void;
}

export interface XeroResourceSummary {
  pagesRead: number;
  rowsRead: number;
  rowsWritten: number;
  /** True when this resource was read in full rather than incrementally. */
  fullRead: boolean;
  /** The `If-Modified-Since` actually sent, for the operator reading the JSON. */
  modifiedSince: string | null;
  /** True when the read stopped early — a rate limit that outlasted the retries,
   *  a failed page, or the page ceiling. The cursor is NOT advanced in that case. */
  partial: boolean;
}

export interface XeroSyncSummary {
  orgId: string;
  dryRun: boolean;
  /** True when the mirror tables are not in this database yet. */
  tablesMissing: boolean;
  /** Null when the org has no usable Xero connection — the run did nothing. */
  tenantName: string | null;
  invoices: XeroResourceSummary;
  contacts: XeroResourceSummary;
  /** True when everything the run attempted succeeded. Drives the status write. */
  ok: boolean;
  warnings: string[];
}

function emptyResource(): XeroResourceSummary {
  return {
    pagesRead: 0,
    rowsRead: 0,
    rowsWritten: 0,
    fullRead: true,
    modifiedSince: null,
    partial: false,
  };
}

function emptySummary(orgId: string, dryRun: boolean): XeroSyncSummary {
  return {
    orgId,
    dryRun,
    tablesMissing: false,
    tenantName: null,
    invoices: emptyResource(),
    contacts: emptyResource(),
    ok: true,
    warnings: [],
  };
}

/** A pause the event loop can actually take. Used only between pages and after a
 *  429 — never in a loop that could run unbounded. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, MAX_RETRY_WAIT_MS))));
}

interface XeroFetchResult {
  /** Parsed JSON body, or null when the response carried none. */
  body: unknown;
  status: number;
  retryAfter: string | null;
}

/**
 * One GET against the Accounting API, with the four headers every call needs.
 *
 * `cache: 'no-store'` for the same reason every other outbound fetch in this
 * codebase carries it: an accounting ledger read through a cache is a figure
 * nobody can date.
 */
async function xeroGet(
  path: string,
  params: Record<string, string>,
  access: { accessToken: string; tenantId: string },
  modifiedSince: string | null,
): Promise<XeroFetchResult> {
  const url = new URL(path, XERO_API_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = {
    authorization: `Bearer ${access.accessToken}`,
    'xero-tenant-id': access.tenantId,
    accept: 'application/json',
  };
  if (modifiedSince) headers['if-modified-since'] = modifiedSince;

  const response = await fetch(url, { headers, cache: 'no-store' });
  // 304 and 429 both carry no useful body; `.catch` covers them and any
  // non-JSON error page an edge might return.
  const body = await response.json().catch(() => null);
  return { body, status: response.status, retryAfter: response.headers.get('retry-after') };
}

/**
 * Read one resource, page by page, until Xero returns a short page.
 *
 * TERMINATION. Xero has no "next page" marker on these endpoints: a page with
 * fewer than `PAGE_SIZE` rows is the last one. That is also why `MAX_PAGES`
 * exists — if a response ever stopped honouring `page`, "fewer than 100" would
 * never arrive and this loop would be the outage.
 *
 * A 304 means "nothing has changed since your cursor" and is a SUCCESSFUL,
 * complete read of zero rows — the cursor still advances, because the answer is
 * current.
 */
async function readPages<T>(
  resource: 'Invoices' | 'Contacts',
  params: Record<string, string>,
  access: { accessToken: string; tenantId: string },
  modifiedSince: string | null,
  map: (body: unknown) => T[],
  summary: XeroResourceSummary,
  warnings: string[],
  log: (m: string) => void,
): Promise<T[]> {
  const collected: T[] = [];
  let page = 1;
  let attempt = 0;

  while (page <= MAX_PAGES) {
    const result = await xeroGet(
      resource,
      { ...params, page: String(page) },
      access,
      modifiedSince,
    );

    if (result.status === 429) {
      if (attempt >= MAX_RETRIES) {
        summary.partial = true;
        warnings.push(
          `${resource}: Xero rate-limited the read and it did not clear after ${MAX_RETRIES} retries — a partial sync was recorded and the cursor was left where it was.`,
        );
        return collected;
      }
      const wait = retryAfterMs(result.retryAfter, attempt);
      log(`xero-sync: ${resource} page ${page} rate-limited, waiting ${wait}ms`);
      attempt += 1;
      await sleep(wait);
      continue; // the SAME page
    }

    // Nothing has changed since the cursor. A complete answer, not a failure.
    if (result.status === 304) return collected;

    if (result.status < 200 || result.status >= 300) {
      summary.partial = true;
      warnings.push(`${resource}: Xero returned ${result.status} on page ${page}.`);
      return collected;
    }

    attempt = 0;
    const rows = map(result.body);
    summary.pagesRead += 1;
    summary.rowsRead += rows.length;
    collected.push(...rows);

    // A short page is the last page. Note this reads the MAPPED length, which is
    // a floor on what Xero sent (the mapper drops voided invoices and anything
    // malformed) — so a page of 100 rows that maps to 40 still continues, which
    // is why the comparison is against the raw count below rather than `rows`.
    const rawCount = countRaw(result.body, resource);
    if (rawCount < PAGE_SIZE) return collected;

    page += 1;
    await sleep(PAGE_PAUSE_MS);
  }

  summary.partial = true;
  warnings.push(`${resource}: stopped at the ${MAX_PAGES}-page ceiling.`);
  return collected;
}

/** How many rows Xero actually sent on a page, before mapping dropped any. */
function countRaw(body: unknown, resource: 'Invoices' | 'Contacts'): number {
  if (!body || typeof body !== 'object') return 0;
  const list = (body as Record<string, unknown>)[resource];
  return Array.isArray(list) ? list.length : 0;
}

/**
 * Upsert mirror rows in chunks.
 *
 * Returns the number written, and pushes a warning for any chunk that failed
 * rather than throwing — one bad page must not cost the whole night's read.
 * A MISSING TABLE short-circuits: every remaining chunk would fail identically,
 * and the caller turns it into `tablesMissing`.
 */
async function upsertRows(
  supabase: SupabaseClient,
  table: 'xero_invoices' | 'xero_contacts',
  conflictColumn: 'xero_invoice_id' | 'xero_contact_id',
  rows: readonly (XeroInvoiceRow | XeroContactRow)[],
  warnings: string[],
): Promise<{ written: number; tableMissing: boolean }> {
  let written = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: `org_id,${conflictColumn}` });
    if (!error) {
      written += chunk.length;
      continue;
    }
    if (isMissingRelation(error)) {
      warnings.push(`${table} does not exist in this database — nothing was mirrored.`);
      return { written, tableMissing: true };
    }
    warnings.push(`${table}: a page of ${chunk.length} rows failed to write (${error.message}).`);
  }
  return { written, tableMissing: false };
}

/** The cursor for one resource, when it is young enough to trust. */
async function readCursor(
  supabase: SupabaseClient,
  orgId: string,
  connectionId: string,
  entityType: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('xero_sync_cursors')
    .select('modified_since')
    .eq('org_id', orgId)
    .eq('connection_id', connectionId)
    .eq('entity_type', entityType)
    .maybeSingle<{ modified_since: string | null }>();
  if (error || !data?.modified_since) return null;

  const age = Date.now() - Date.parse(data.modified_since);
  if (!Number.isFinite(age) || age > CURSOR_MAX_AGE_DAYS * 86_400_000) return null;
  return data.modified_since;
}

async function writeCursor(
  supabase: SupabaseClient,
  orgId: string,
  connectionId: string,
  entityType: string,
  at: string,
  warnings: string[],
): Promise<void> {
  const { error } = await supabase.from('xero_sync_cursors').upsert(
    {
      org_id: orgId,
      connection_id: connectionId,
      entity_type: entityType,
      modified_since: at,
      last_success_at: at,
    },
    { onConflict: 'connection_id,entity_type' },
  );
  if (error && !isMissingRelation(error)) {
    // A cursor that did not save costs a full read next time — expensive, not
    // wrong. Worth a line in the summary, not worth failing the run.
    warnings.push(`Could not save the ${entityType} sync cursor: ${error.message}`);
  }
}

/**
 * Sync ONE org.
 *
 * `runStartedAt` is captured BEFORE the first request and is what the cursor
 * advances to on success — not the time the run finished. An invoice edited in
 * Xero while page 7 was being read would otherwise fall in the gap between "the
 * window we asked for" and "the window we recorded", and would never be read
 * again. Re-reading a few rows is free; missing one is not.
 */
export async function syncXeroOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts: SyncXeroOptions = {},
): Promise<XeroSyncSummary> {
  const dryRun = opts.dryRun === true;
  const log = opts.log ?? (() => {});
  const summary = emptySummary(orgId, dryRun);
  const runStartedAt = new Date().toISOString();

  // ---- 1. A token, and the tenant to spend it against ----------------------
  let access;
  try {
    access = await getXeroAccessTokenForOrg(supabase, orgId);
  } catch (error) {
    // `getXeroAccessTokenForOrg` has already marked the connection
    // `reauth_required` when Xero said the grant is gone; anything else is
    // recorded below and the agent's health rule picks it up tomorrow morning.
    const message = error instanceof Error ? error.message : 'Could not reach Xero.';
    summary.ok = false;
    summary.warnings.push(message);
    await recordSyncOutcome(supabase, orgId, { ok: false, error: message, dryRun });
    return summary;
  }
  summary.tenantName = access.tenantName;

  // ---- 2. Invoices ---------------------------------------------------------
  const invoiceCursor = opts.full ? null : await readCursor(supabase, orgId, access.connectionId, 'invoices');
  summary.invoices.modifiedSince = ifModifiedSinceHeader(invoiceCursor);
  summary.invoices.fullRead = summary.invoices.modifiedSince == null;

  const invoiceRows = await readPages(
    'Invoices',
    {
      // Both ledgers in one read. Xero's `where` grammar would let us split them,
      // but two reads is two rate-limit budgets for the same rows.
      //
      // Statuses: everything except DELETED and VOIDED. The mapper drops anything
      // outside this list again — the parameter saves the bandwidth, the mapper
      // is what guarantees the mirror's contents.
      Statuses: 'DRAFT,SUBMITTED,AUTHORISED,PAID',
      pageSize: String(PAGE_SIZE),
    },
    access,
    summary.invoices.modifiedSince,
    (body) => mapXeroInvoicePage(body as { Invoices?: [] }, orgId),
    summary.invoices,
    summary.warnings,
    log,
  );
  log(`xero-sync: ${orgId} read ${invoiceRows.length} invoices over ${summary.invoices.pagesRead} page(s).`);

  if (!dryRun && invoiceRows.length > 0) {
    const result = await upsertRows(supabase, 'xero_invoices', 'xero_invoice_id', invoiceRows, summary.warnings);
    summary.invoices.rowsWritten = result.written;
    if (result.tableMissing) summary.tablesMissing = true;
  } else if (dryRun) {
    summary.invoices.rowsWritten = invoiceRows.length;
  }

  // ---- 3. Contacts ---------------------------------------------------------
  const contactCursor = opts.full ? null : await readCursor(supabase, orgId, access.connectionId, 'contacts');
  summary.contacts.modifiedSince = ifModifiedSinceHeader(contactCursor);
  summary.contacts.fullRead = summary.contacts.modifiedSince == null;

  const contactRows = await readPages(
    'Contacts',
    { pageSize: String(PAGE_SIZE) },
    access,
    summary.contacts.modifiedSince,
    (body) => mapXeroContactPage(body as { Contacts?: [] }, orgId),
    summary.contacts,
    summary.warnings,
    log,
  );
  log(`xero-sync: ${orgId} read ${contactRows.length} contacts over ${summary.contacts.pagesRead} page(s).`);

  if (!dryRun && contactRows.length > 0) {
    const result = await upsertRows(supabase, 'xero_contacts', 'xero_contact_id', contactRows, summary.warnings);
    summary.contacts.rowsWritten = result.written;
    if (result.tableMissing) summary.tablesMissing = true;
  } else if (dryRun) {
    summary.contacts.rowsWritten = contactRows.length;
  }

  // ---- 4. Advance the cursors, but only where the read was complete --------
  summary.ok = !summary.invoices.partial && !summary.contacts.partial && !summary.tablesMissing;

  if (!dryRun && !summary.tablesMissing) {
    if (!summary.invoices.partial) {
      await writeCursor(supabase, orgId, access.connectionId, 'invoices', runStartedAt, summary.warnings);
    }
    if (!summary.contacts.partial) {
      await writeCursor(supabase, orgId, access.connectionId, 'contacts', runStartedAt, summary.warnings);
    }
  }

  await recordSyncOutcome(supabase, orgId, {
    ok: summary.ok,
    error: summary.ok ? null : summary.warnings[0] ?? 'The Xero sync did not finish.',
    dryRun,
  });

  return summary;
}

/**
 * Record what the sync did on `xero_connections`, which is what the plugin page's
 * "Last synced" line and the agent's connection-health rule both read.
 *
 * NEVER OVERWRITES `reauth_required`. That status is set by the token path when
 * Xero has actually revoked the grant, and it is the one state a human has to
 * clear; a later run writing `error` over it would replace "reconnect Xero" with
 * "something went wrong", which is a strictly less useful thing to tell an owner.
 * `last_synced_at` is only stamped on a clean run — a half-read ledger is not a
 * ledger anyone should date.
 */
async function recordSyncOutcome(
  supabase: SupabaseClient,
  orgId: string,
  outcome: { ok: boolean; error: string | null; dryRun: boolean },
): Promise<void> {
  if (outcome.dryRun) return;
  const patch: Record<string, unknown> = {
    status: outcome.ok ? 'connected' : 'error',
    last_error: outcome.error ? outcome.error.slice(0, 1_000) : null,
  };
  if (outcome.ok) patch.last_synced_at = new Date().toISOString();

  const { error } = await supabase
    .from('xero_connections')
    .update(patch)
    .eq('org_id', orgId)
    .not('status', 'in', '("disconnected","reauth_required")');
  if (error && !isMissingRelation(error)) {
    console.error('xero-sync: could not record the sync outcome', orgId, error.message);
  }
}

/**
 * Every org whose Xero connection is worth syncing tonight.
 *
 * `error` IS INCLUDED. It means "linked, but the last read failed" — a transient
 * API outage, a rate limit that outlasted its retries — and the whole point of a
 * nightly job is that tonight's run heals it. `reauth_required` is EXCLUDED
 * because no amount of retrying fixes a revoked grant; a human has to reconnect,
 * and the Xero Watch agent is what tells them so.
 *
 * Returns an empty list (not an error) when the table is not there yet.
 */
export async function connectedXeroOrgIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('xero_connections')
    .select('org_id, status')
    .in('status', ['connected', 'syncing', 'error'])
    .returns<{ org_id: string; status: string }[]>();
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.org_id))];
}
