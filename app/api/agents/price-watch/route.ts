import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { parseEnvList, runPriceWatch, type PriceWatchSummary } from '@/lib/platform/price-watch/run';
import { priceWatchMatchCall, priceWatchObservationCall } from '@/lib/ai/price-watch-model';

export const maxDuration = 300;

/**
 * Price Watch's nightly run (plan `.ai/plan_price_watch_agent.md`, step 8).
 *
 * Reads the org's already-extracted invoice/statement lines, keeps
 * pw_price_points current, and writes any material price increase to
 * agent_findings — where The Brief (/app) and the Monday digest pick it up.
 * It observes and recommends; it never acts.
 *
 * Runs on a Vercel Cron at 03:45 UTC (see vercel.json), after the 03:00/03:30
 * ingest-recovery crons, so a document that landed overnight is extracted before
 * Price Watch reads it. The schedule is not load-bearing: runPriceWatch is
 * idempotent (price points upsert on (document_id, line_index); findings dedupe
 * on unique(org_id, dedupe_key)), so a missed or doubled run costs nothing.
 *
 * ORG ALLOWLIST — PRICE_WATCH_ORG_IDS, comma-separated org uuids. v1 is Turn 'n
 * Slice only. An unset or empty value means DO NOTHING and say so: an agent that
 * defaulted to "every org" would write findings into customers' Briefs off a
 * catalogue nobody has reviewed. Opt-in is the only safe default here.
 *
 * Authenticated with CRON_SECRET — Vercel Cron sends it as a bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const orgIds = parseEnvList(process.env.PRICE_WATCH_ORG_IDS);
  if (orgIds.length === 0) {
    // 200, not an error: the cron fired correctly and there is simply nothing
    // enabled. A 5xx here would page us nightly for a working system.
    return NextResponse.json({
      ok: true,
      ran: 0,
      message: 'PRICE_WATCH_ORG_IDS is not set — no organisation is enabled for Price Watch.',
    });
  }

  // Serial on purpose: each org runs Claude matches for any line description it
  // has never seen, and running orgs in parallel would multiply that burst
  // against the same rate limit inside one 300s invocation.
  type RunResult = PriceWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  for (const orgId of orgIds) {
    try {
      // matchCall/observeCall wire the real Anthropic transport in — without them
      // match.ts/observe.ts fall back to their `missingModelCall` default, which
      // throws for every model-eligible line and turns the whole run into
      // `model_error` review rows. That's exactly what the 2026-08-14 remediation
      // (lib/ai/price-watch-model.ts) was supposed to fix everywhere, but this
      // route was never updated to inject it. Tests inject their own fakes, so
      // this wiring is only load-bearing here and in the backfill CLI.
      summaries.push(
        await runPriceWatch(supabase, orgId, {
          log: (m) => console.log(m),
          matchCall: priceWatchMatchCall,
          observeCall: priceWatchObservationCall,
        }),
      );
    } catch (error) {
      // runPriceWatch turns ordinary data problems into warnings rather than
      // throwing, so reaching here means something genuinely unexpected broke.
      // One org's failure must not cancel the others.
      const message = error instanceof Error ? error.message : String(error);
      console.error('price-watch: run failed', orgId, message);
      summaries.push({ orgId, failed: true, error: message });
    }
  }

  return NextResponse.json({ ok: true, ran: summaries.length, summaries });
}
