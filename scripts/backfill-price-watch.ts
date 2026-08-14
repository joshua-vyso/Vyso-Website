/**
 * One-off Price Watch backfill (plan `.ai/plan_price_watch_agent.md`, step 5).
 *
 * Runs the SAME orchestrator the nightly cron runs (lib/platform/price-watch/
 * run.ts) over an org's entire priced-document history — deliberately not a
 * second implementation, so a backfill can never build a price history the cron
 * would not have built.
 *
 * Usage (both work; node 22 strips the types natively, tsx is the plan's form):
 *
 *   node scripts/backfill-price-watch.ts --org <uuid> --dry-run
 *   npx tsx scripts/backfill-price-watch.ts --org <uuid>
 *
 * Flags:
 *   --org <uuid>   REQUIRED. Never defaulted — see below.
 *   --dry-run      Compute and print everything; write nothing at all.
 *   --quiet        Suppress per-stage progress lines.
 *
 * WHY --org IS MANDATORY: this script holds the service-role key, which bypasses
 * RLS entirely. A default org id (or "all orgs") would mean one careless
 * invocation writing a price catalogue and findings into a demo tenant — or a
 * real customer's — from a terminal. Making the target explicit every single
 * time is the whole safety mechanism.
 *
 * ENV: read from .env.local in the repo root, by hand. This is a plain node
 * script, not a Next.js process, so nothing loads that file for us — and
 * lib/platform/supabase-service.ts cannot be imported here at all (it is marked
 * `server-only`, which throws outside a React Server Component). The client is
 * therefore built locally from the same two variables that module uses.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { runPriceWatch, type PriceWatchSummary } from '../lib/platform/price-watch/run.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, '..', '.env.local');

// ---------------------------------------------------------------------------
// .env.local
// ---------------------------------------------------------------------------

/**
 * Minimal KEY=VALUE parser. No dependency is added for this (house rule), and
 * the file it reads is one we control: `#` comments, blank lines, optional
 * `export ` prefix, and single/double quoted values are handled; anything
 * fancier (multi-line values, variable interpolation) is not, and would be a
 * surprise in this repo's .env.local rather than a feature.
 */
function loadEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

interface Args {
  orgId: string | null;
  dryRun: boolean;
  quiet: boolean;
}

const USAGE =
  'Usage: node scripts/backfill-price-watch.ts --org <uuid> [--dry-run] [--quiet]';

/**
 * STRICT on purpose: an argument this parser does not recognise is a fatal
 * error, not something to ignore.
 *
 * This is not pedantry, it is the exact defect that put 56 pw_items and 115
 * pw_item_matches rows into the production database on 2026-08-14. An earlier
 * version of this parser silently skipped anything it did not match, so
 * `--dryrun` — one missing hyphen — parsed as "no flags at all" and the script
 * ran LIVE while the operator believed they were previewing. A tool holding the
 * service-role key must never quietly do the more destructive thing when it is
 * given something it does not understand.
 */
function parseArgs(argv: string[]): Args {
  const args: Args = { orgId: null, dryRun: false, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--org') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        console.error(`Refusing to run: --org needs a value.\n  ${USAGE}`);
        process.exit(1);
      }
      args.orgId = value;
      i += 1;
    } else if (arg.startsWith('--org=')) {
      args.orgId = arg.slice('--org='.length);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--quiet') {
      args.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(
        `Refusing to run: unrecognised argument "${arg}".\n` +
          `  ${USAGE}\n` +
          '  (Nothing was read or written. If you meant --dry-run, note the hyphen.)',
      );
      process.exit(1);
    }
  }
  return args;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

/** "1240.374" → "R 1,240.37".
 *
 *  Hand-rolled, NOT toLocaleString('en-ZA'): that locale renders 2.8 as "2,8"
 *  and 1280 as "1 280", so a terminal full of prices reads as though the
 *  decimals had moved. Same formatter shape as observe.ts's formatRand, for the
 *  same reason — a number a human might act on must never be ambiguous. */
function money(n: number): string {
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `R ${n < 0 ? '-' : ''}${grouped}.${frac}`;
}

function printSummary(summary: PriceWatchSummary): void {
  const mode = summary.dryRun ? 'DRY RUN — nothing was written' : 'LIVE — changes were written';
  console.log(`\n=== Price Watch backfill (${mode}) ===`);
  console.log(`org: ${summary.orgId}`);

  if (summary.tablesMissing) {
    console.log('\npw_* tables are not in this database. Run supabase/agents-price-watch.sql first.');
    return;
  }

  console.log('\n-- documents --');
  console.log(`  priced documents read : ${summary.documentsSeen}`);
  console.log(`  contributed lines     : ${summary.documentsUsed}`);
  console.log(`  dated from created_at : ${summary.documentsDatedFromCreatedAt}`);
  const skipped = Object.entries(summary.documentsSkipped);
  if (skipped.length) {
    console.log('  skipped:');
    for (const [reason, count] of skipped.sort((a, b) => b[1] - a[1])) {
      console.log(`    ${reason.padEnd(32)} ${count}`);
    }
  }

  console.log('\n-- lines --');
  console.log(`  seen                  : ${summary.linesSeen}`);
  console.log(`  no description        : ${summary.linesSkippedNoDescription}`);
  console.log(`  no usable price       : ${summary.linesSkippedNoPrice}`);
  console.log(`  waiting on review     : ${summary.linesAwaitingReview}`);
  console.log(`  price points ${summary.dryRun ? 'planned  ' : 'upserted '}: ${summary.pricePointsUpserted}`);
  if (summary.pricePointErrors) console.log(`  price point errors    : ${summary.pricePointErrors}`);

  console.log('\n-- matching --');
  console.log(`  claude match calls    : ${summary.matchModelCalls}`);
  console.log(`  cache hits (free)     : ${summary.matchCacheHits}`);
  console.log(`  review queue adds     : ${summary.reviewQueueAdds}`);
  console.log(`  new items proposed    : ${summary.itemsCreated}`);

  console.log('\n-- findings --');
  console.log(`  detected              : ${summary.findingsDetected}`);
  console.log(`  ${summary.dryRun ? 'would be written    ' : 'written             '}  : ${summary.findingsWritten}`);
  console.log(`  already open (dedupe) : ${summary.findingsSkippedDuplicate}`);
  if (summary.findingErrors) console.log(`  write errors          : ${summary.findingErrors}`);
  if (summary.observationFallbacks) {
    console.log(`  template observations : ${summary.observationFallbacks}`);
  }

  if (summary.samplePricePoints.length) {
    console.log(`\n-- sample price points (first ${summary.samplePricePoints.length}) --`);
    for (const p of summary.samplePricePoints) {
      console.log(
        `  ${p.invoiceDate}  ${money(p.unitPrice)}/${p.baseUnit.padEnd(4)} ` +
          `x${p.quantityBase.toFixed(2).padStart(9)}  ${p.itemName} ` +
          `[${p.lineSupplier ?? p.supplierName}]  <- "${p.description}"`,
      );
    }
  }

  if (summary.sampleReviewItems.length) {
    console.log(`\n-- sample review-queue items (first ${summary.sampleReviewItems.length}) --`);
    for (const r of summary.sampleReviewItems) {
      console.log(
        `  ${r.reason.padEnd(16)} conf ${r.confidence.toFixed(2)}  "${r.rawDescription}" ` +
          `(${r.supplierName})${r.proposedItemName ? ` → propose "${r.proposedItemName}"` : ''}`,
      );
    }
  }

  if (summary.sampleFindings.length) {
    console.log(`\n-- sample findings (first ${summary.sampleFindings.length}) --`);
    for (const f of summary.sampleFindings) {
      console.log(`  ${money(f.randImpact)} · ${f.evidenceCount} docs · ${f.dedupeKey}`);
      console.log(`    ${f.observation}`);
    }
  }

  if (summary.warnings.length) {
    console.log('\n-- warnings --');
    for (const w of summary.warnings) console.log(`  ! ${w}`);
  }

  if (summary.dryRun) {
    console.log(
      '\nNothing was written. Note that a real run re-asks Claude for the same new ' +
        'descriptions (a dry run cannot cache what it does not write), so the match ' +
        'cost above is incurred twice across the two runs.',
    );
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.orgId) {
    console.error(
      'Refusing to run: --org <uuid> is required.\n' +
        '  node scripts/backfill-price-watch.ts --org <uuid> --dry-run',
    );
    process.exit(1);
  }
  if (!UUID_RE.test(args.orgId)) {
    // A typo'd org id would otherwise read as "an org with no documents" and
    // report a cheerful zero — indistinguishable from a real empty tenant.
    console.error(`Refusing to run: --org "${args.orgId}" is not a uuid.`);
    process.exit(1);
  }

  const fileEnv = loadEnvFile(ENV_PATH);
  // A real process env wins over the file: that is how a one-off run against a
  // different project is done, without editing .env.local.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || '';
  // The matcher and the observation writer read this from process.env inside
  // lib/ai/anthropic.ts, so it has to be promoted out of the file here.
  if (!process.env.ANTHROPIC_API_KEY && fileEnv.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = fileEnv.ANTHROPIC_API_KEY;
  }
  if (!process.env.ANTHROPIC_MODEL && fileEnv.ANTHROPIC_MODEL) {
    process.env.ANTHROPIC_MODEL = fileEnv.ANTHROPIC_MODEL;
  }

  if (!url || !serviceKey) {
    console.error(
      `Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (looked in ${ENV_PATH}).`,
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The mode is stated loudly and unmistakably, because the failure mode this
  // guards against is a human scrolling past a one-line "(LIVE)" and believing
  // they ran a preview.
  if (args.dryRun) {
    console.log(`Price Watch backfill: org ${args.orgId} — DRY RUN (read-only, writes disabled)`);
  } else {
    console.log('!'.repeat(72));
    console.log(`!!  LIVE RUN — this WILL write to the database for org ${args.orgId}`);
    console.log('!!  Add --dry-run to preview instead.');
    console.log('!'.repeat(72));
  }

  const summary = await runPriceWatch(supabase, args.orgId, {
    dryRun: args.dryRun,
    log: args.quiet ? undefined : (m) => console.log(`  ${m}`),
  });

  printSummary(summary);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
