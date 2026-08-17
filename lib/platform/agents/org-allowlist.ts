/**
 * The ONE allowlist every Vyso agent route reads before it does anything.
 *
 * Price Watch shipped first and read `PRICE_WATCH_ORG_IDS` directly. Phase C
 * adds three more agents (Debtors Watch, Stock Cover, Doc Watch) and a fourth
 * copy of `parseEnvList(process.env.PRICE_WATCH_ORG_IDS)` in four route files is
 * how an allowlist drifts: one route gets a new org, the others don't, and the
 * Brief fills up for a business that was only ever enabled for one agent.
 *
 * So there is now a single variable — `AGENTS_ORG_IDS` — read here and nowhere
 * else, with `PRICE_WATCH_ORG_IDS` kept as the FALLBACK rather than removed.
 * That fallback is not politeness: the var is already set in Vercel against the
 * live Meridian/Turn 'n Slice org, and a rename that silently turned every agent
 * off on the next deploy would look exactly like "the crons stopped working".
 * Behaviour with only the old var set is byte-identical to before.
 *
 * OPT-IN IS THE ONLY SAFE DEFAULT, and it is inherited unchanged from Price
 * Watch: an unset or empty value means DO NOTHING. An agent that defaulted to
 * "every org" would write findings into customers' Briefs off data nobody has
 * reviewed. Every route therefore treats an empty list as `{ok: true, ran: 0}`
 * — a 200, because the cron fired correctly and there is simply nothing enabled;
 * a 5xx would page us nightly for a working system.
 *
 * `parseEnvList` is imported from Price Watch's run module rather than
 * re-implemented, so "how a comma-separated env var is split" has exactly one
 * definition in this codebase (the digest route already imports it from there
 * for the same reason).
 *
 * RELATIVE, `.ts`-suffixed import — not the `@/` alias. That alias only exists
 * inside Next's bundler, and this module is unit-tested with bare
 * `node --test`, which resolves it to nothing. That exact mistake is what the
 * 2026-08-14 Price Watch model outage was (see run.ts's closing comment), and
 * every module under lib/platform that a test imports follows this rule.
 */

import { parseEnvList } from '../price-watch/run.ts';

/** The env var an operator should set from now on. */
export const AGENTS_ORG_IDS_VAR = 'AGENTS_ORG_IDS';
/** Price Watch's original var, still honoured so a live deploy keeps working. */
export const LEGACY_ORG_IDS_VAR = 'PRICE_WATCH_ORG_IDS';

/** Just the shape this module reads, so a test can pass `{}` without having to
 *  construct a whole `NodeJS.ProcessEnv` (which requires NODE_ENV). */
export type EnvLike = Record<string, string | undefined>;

/**
 * Organisation uuids the agents are enabled for, newest var winning.
 *
 * `AGENTS_ORG_IDS` is only "set" when it contains at least one non-blank id —
 * an operator who clears the value has turned the agents OFF, and silently
 * falling through to the legacy var at that point would ignore them. Falling
 * back only when the new var yields nothing keeps both readings honest.
 */
export function agentOrgIds(env: EnvLike = process.env): string[] {
  const current = parseEnvList(env[AGENTS_ORG_IDS_VAR]);
  if (current.length > 0) return current;
  return parseEnvList(env[LEGACY_ORG_IDS_VAR]);
}

/**
 * The message a route returns when nothing is enabled. Names BOTH vars, because
 * the operator reading this JSON at 04:00 needs to know which one to set and
 * that the old one still counts.
 */
export const NO_ORGS_MESSAGE = `Neither ${AGENTS_ORG_IDS_VAR} nor ${LEGACY_ORG_IDS_VAR} is set — no organisation is enabled for Vyso's agents.`;
