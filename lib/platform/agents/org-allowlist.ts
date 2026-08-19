/**
 * WHICH ORGANISATIONS THE AGENTS RUN FOR. Read by every /api/agents/* route and
 * nowhere else.
 *
 * IT USED TO BE AN ALLOWLIST. Price Watch shipped opt-in — `PRICE_WATCH_ORG_IDS`
 * naming the one org it was allowed to touch — and Phase C generalised that to a
 * single `AGENTS_ORG_IDS` read here. The reasoning at the time was that an agent
 * defaulting to "every org" would write findings into a customer's Brief off data
 * nobody had reviewed.
 *
 * THAT IS NO LONGER TRUE, AND THE DEFAULT IS NOW EVERY ORGANISATION. The agents
 * are the product: an org that signs up and connects its data is asking for the
 * Brief to be filled in, and a var somebody has to remember to edit in Vercel is
 * a way for a paying customer to sit there getting nothing while every dashboard
 * says the system is healthy. The rule this module now implements is Josh's:
 * *all agents need to be available on each org id.*
 *
 * So the source of truth is the `organisations` table, ordered by `created_at`
 * (oldest first — stable, and it makes the time-budget guard drop the NEWEST orgs
 * first rather than an arbitrary set). Two env vars can still narrow it:
 *
 *   AGENTS_ORG_EXCLUDE  — comma-separated uuids to SKIP. The escape hatch for a
 *                         churned or internal org, and the only one production is
 *                         ever expected to set.
 *   AGENTS_ORG_IDS      — comma-separated uuids to restrict TO. Optional, and
 *   PRICE_WATCH_ORG_IDS   meant for a developer or a staging deploy pointed at a
 *                         copy of production who wants one org's agents to run.
 *                         PRODUCTION LEAVES BOTH UNSET; setting one there is how
 *                         you silently turn the agents off for everybody else.
 *
 * The restriction INTERSECTS the table rather than being used verbatim: ids that
 * name no organisation are reported back (`notFound`) instead of being handed to
 * an agent, which is what a typo in Vercel used to look like — a run that
 * reported `ran: 1` having done nothing at all.
 *
 * A MISSING `organisations` RELATION IS EMPTY AND FLAGGED, never a throw — the
 * same contract lib/platform/agent-findings.ts and brief-schedules.ts have, for
 * the same reason: `supabase/*.sql` is pasted in by hand, so a deployed build can
 * legitimately run ahead of its schema, and a cron that 500s nightly for that is
 * noise. Every empty result carries a sentence saying WHY (`noOrgsMessage`),
 * because that sentence is the whole diagnostic an operator gets at 04:00.
 *
 * The pure decisions — parsing the vars, intersecting, excluding — are
 * `selectAgentOrgs`, kept separate from the read and pinned in
 * tests/agents-org-allowlist.test.ts. Only `agentOrgIds` does I/O.
 *
 * RELATIVE, `.ts`-suffixed imports — not the `@/` alias. That alias only exists
 * inside Next's bundler, and this module is unit-tested with bare `node --test`,
 * which resolves it to nothing. That exact mistake is what the 2026-08-14 Price
 * Watch model outage was (see run.ts's closing comment), and every module under
 * lib/platform that a test imports follows this rule.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation } from '../db-errors.ts';
import { parseEnvList } from '../price-watch/run.ts';

/** Optional restriction: run ONLY these orgs. Unset in production. */
export const AGENTS_ORG_IDS_VAR = 'AGENTS_ORG_IDS';
/** Price Watch's original name for the same restriction. Also unset in production. */
export const LEGACY_ORG_IDS_VAR = 'PRICE_WATCH_ORG_IDS';
/** Orgs to skip. The only var production is expected to set, and usually empty. */
export const AGENTS_ORG_EXCLUDE_VAR = 'AGENTS_ORG_EXCLUDE';

/** Just the shape this module reads, so a test can pass `{}` without having to
 *  construct a whole `NodeJS.ProcessEnv` (which requires NODE_ENV). */
export type EnvLike = Record<string, string | undefined>;

/** What the routes get back. Everything except `orgIds` exists to be printed in
 *  the run's JSON, so a `ran: 0` is never a mystery. */
export interface AgentOrgs {
  /** The orgs to run, oldest first. */
  orgIds: string[];
  /** Set when a restriction var narrowed the set — names the var. */
  restrictedBy?: string;
  /** Ids the restriction named that match no organisation (a typo, or an org
   *  deleted since somebody set the var). */
  notFound: string[];
  /** Ids dropped by AGENTS_ORG_EXCLUDE that really do exist. */
  excluded: string[];
  /** True when `organisations` isn't in this database yet. Empty and FLAGGED. */
  tableMissing: boolean;
  /** Set when the read failed for any other reason — also empty, also flagged. */
  error?: string;
}

/**
 * THE PURE HALF: given every organisation id in the database, decide which the
 * agents run for. No I/O, no `process.env` unless the caller defaults to it.
 *
 * Order is the caller's order (created_at) throughout; neither var reorders
 * anything, so two runs a minute apart cannot disagree about who goes first.
 */
export function selectAgentOrgs(
  allOrgIds: string[],
  env: EnvLike = process.env,
): Omit<AgentOrgs, 'tableMissing' | 'error'> {
  // The newer var wins, and a blank one falls through to the legacy name rather
  // than counting as "restrict to nothing" — an operator who cleared the value
  // meant "stop restricting", which is now the normal state.
  const restrictTo = parseEnvList(env[AGENTS_ORG_IDS_VAR]);
  const legacy = parseEnvList(env[LEGACY_ORG_IDS_VAR]);
  const restriction = restrictTo.length > 0 ? restrictTo : legacy;
  const restrictedBy =
    restrictTo.length > 0
      ? AGENTS_ORG_IDS_VAR
      : legacy.length > 0
        ? LEGACY_ORG_IDS_VAR
        : undefined;

  const exclude = new Set(parseEnvList(env[AGENTS_ORG_EXCLUDE_VAR]));

  const known = new Set(allOrgIds);
  const notFound = restriction.filter((id) => !known.has(id));

  const wanted = restriction.length > 0 ? new Set(restriction) : null;
  const orgIds: string[] = [];
  const excluded: string[] = [];
  for (const id of allOrgIds) {
    if (wanted && !wanted.has(id)) continue;
    if (exclude.has(id)) {
      excluded.push(id);
      continue;
    }
    orgIds.push(id);
  }

  return { orgIds, restrictedBy, notFound, excluded };
}

/** Empty result shapes, so the three failure paths can't drift apart. */
const NO_ORGS: AgentOrgs = {
  orgIds: [],
  notFound: [],
  excluded: [],
  tableMissing: false,
};

/**
 * THE I/O HALF: every organisation in the database, narrowed by the env.
 *
 * Takes the SERVICE-ROLE client (lib/platform/supabase-service.ts) — a cron has
 * no session, so there is nothing for RLS to key off, and reading the org list is
 * exactly the read that client exists for. Only `id` is selected: this is a
 * membership question, and the agents look up whatever else they need per org.
 */
export async function agentOrgIds(
  supabase: SupabaseClient,
  env: EnvLike = process.env,
): Promise<AgentOrgs> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id')
    // Oldest first. See the header: stable ordering is what makes the routes'
    // time-budget guard drop a predictable tail rather than a random org.
    .order('created_at', { ascending: true })
    .returns<{ id: string }[]>();

  if (error) {
    if (isMissingRelation(error)) return { ...NO_ORGS, tableMissing: true };
    console.error('agents: organisations read failed', error.message);
    return { ...NO_ORGS, error: error.message };
  }

  const allOrgIds = (data ?? []).map((row) => row.id).filter(Boolean);
  return { ...selectAgentOrgs(allOrgIds, env), tableMissing: false };
}

/**
 * The sentence a route prints when nothing ran. Every branch names the thing an
 * operator would have to change, because "ran: 0" on its own has sent us reading
 * code at four in the morning more than once.
 */
export function noOrgsMessage(orgs: AgentOrgs): string {
  if (orgs.tableMissing) {
    return 'The organisations table is not in this database yet — no agent ran.';
  }
  if (orgs.error) {
    return `Could not read the organisations table (${orgs.error}) — no agent ran.`;
  }
  if (orgs.restrictedBy) {
    return `${orgs.restrictedBy} is set and matches no organisation — no agent ran. Production should leave ${AGENTS_ORG_IDS_VAR} and ${LEGACY_ORG_IDS_VAR} unset so every organisation runs.`;
  }
  if (orgs.excluded.length > 0) {
    return `Every organisation is listed in ${AGENTS_ORG_EXCLUDE_VAR} — no agent ran.`;
  }
  return 'There are no organisations in this database — no agent ran.';
}
