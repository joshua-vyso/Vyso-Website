/**
 * One-off Turn 'n Slice categorisation backfill (plan
 * `.ai/plan_procurepulse_manufacturing.md`, Phase A step 2).
 *
 * Runs the SAME model call the UI's "✦ Categorise" button uses
 * (`categoriseProducts()` in lib/ai/anthropic.ts) over the Turn 'n Slice org's
 * `pp_stock_items`, in the same 120-per-call batches as
 * app/api/procurepulse/categorise/route.ts. Deliberately not a second
 * implementation of the categorisation logic — only the "which org, which rows,
 * print a summary" wrapper differs from the route.
 *
 * Safe to run more than once: only rows with a NULL/blank `category` are ever
 * selected, so a repeat run is a no-op once everything is filled in.
 *
 * Usage:
 *   npx tsx scripts/categorise-tns.ts
 *   node --experimental-strip-types scripts/categorise-tns.ts
 *
 * ENV: read from .env.local in the repo root, by hand. This is a plain node
 * script, not a Next.js process, so nothing loads that file for us — and
 * lib/ai/anthropic.ts is marked `server-only`, which throws outside a React
 * Server Component. Both the Supabase and Anthropic clients are therefore
 * built locally, same pattern as scripts/backfill-price-watch.ts.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, '..', '.env.local');

// ---------------------------------------------------------------------------
// .env.local — minimal KEY=VALUE parser (no dependency added for this; the
// file it reads is one we control). See scripts/backfill-price-watch.ts for
// the same parser and the same rationale.
// ---------------------------------------------------------------------------
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

const fileEnv = loadEnvFile(ENV_PATH);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || fileEnv.ANTHROPIC_API_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    `Refusing to run: missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ` +
      `(looked in ${ENV_PATH}).\n` +
      'Nothing was read or written. Josh: click "✦ Categorise 963" in ProcurePulse → ' +
      'Products instead once the taxonomy change deploys.',
  );
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error(
    `Refusing to run: missing ANTHROPIC_API_KEY (looked in ${ENV_PATH}).\n` +
      'Nothing was read or written.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// categoriseProducts — copied transport, not re-derived. lib/ai/anthropic.ts
// cannot be imported here (it is `server-only`), so the model call is
// duplicated at the byte level: same model env var, same system prompt import
// path is not available either, so the prompt is inlined verbatim from
// CATEGORISE_SYSTEM as of this Phase A change. If that prompt changes again,
// update both places.
// ---------------------------------------------------------------------------

const CATEGORISE_MODEL = process.env.ANTHROPIC_CATEGORISE_MODEL || 'claude-haiku-4-5';

const PRODUCE_CATEGORIES = [
  'Fruit',
  'Vegetables',
  'Herbs',
  'Salad & Leafy Greens',
  'Mushrooms',
  'Dried & Processed',
  'Packaging',
  'Other',
] as const;

const CATEGORISE_SYSTEM = `You categorise fresh-produce products for a South African fruit & vegetable wholesaler.
For EACH product, assign exactly one category from this fixed list:
- "Fruit" — apples, bananas, citrus, berries, melons, grapes, stone fruit, avocado, pineapple, mango, etc.
- "Vegetables" — potatoes, onions, carrots, tomatoes, butternut, pumpkin, peppers, cabbage, broccoli, cauliflower, green beans, sweetcorn, beetroot, ginger, garlic, etc.
- "Herbs" — basil, coriander, parsley, mint, rosemary, thyme, dill, chives, etc.
- "Salad & Leafy Greens" — lettuce, spinach, rocket, mixed leaves, kale, microgreens, watercress, etc.
- "Mushrooms" — button, portabellini, oyster, shiitake, brown, white mushrooms, etc.
- "Dried & Processed" — dried fruit, nuts, seeds, frozen produce, tinned/canned goods, juices, sauces, or anything else not sold fresh.
- "Packaging" — punnets, boxes, crates, bags, pallets, cartons and other packaging or containers sold/consumed as stock items.
- "Other" — anything that is not fresh produce or packaging, or is genuinely unclear (eggs, deposits, sundries, etc.).
Respond with ONLY a JSON object (no prose, no markdown code fences) mapping each product id to its category:
{ "<id>": "Fruit", "<id>": "Vegetables", ... }
Every id you are given MUST appear exactly once. Use ONLY the eight category strings above, spelled exactly as shown.`;

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function categoriseProducts(items: { id: string; name: string }[]): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const message = await anthropic.messages.create({
    model: CATEGORISE_MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: CATEGORISE_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(items.map((i) => ({ id: i.id, name: i.name }))) }],
  });

  let parsed: Record<string, unknown> = {};
  try {
    const raw = textOf(message).trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const allowed = new Set<string>(PRODUCE_CATEGORIES);
  const out: Record<string, string> = {};
  for (const it of items) {
    const c = parsed[it.id];
    if (typeof c === 'string' && allowed.has(c)) out[it.id] = c;
  }
  return out;
}

// Products per Claude call — same batch size as the route (large enough to be
// efficient, small enough that a batch's JSON reliably parses).
const BATCH = 120;

async function main(): Promise<void> {
  // Found the same way supabase/tns-users-roles.sql finds it — tolerant of
  // "Turn 'n Slice" / "Turn N Slice HO" — rather than hardcoding an id that
  // could drift from the real database. Do NOT change this to a literal uuid.
  const { data: org, error: orgErr } = await supabase
    .from('organisations')
    .select('id, name')
    .ilike('name', '%turn%slice%')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr || !org) {
    console.error(`Refusing to run: could not find the Turn 'n Slice org (${orgErr?.message ?? 'no match'}).`);
    process.exit(1);
  }
  console.log(`Turn 'n Slice org: ${org.name} (${org.id})`);

  const { data, error } = await supabase
    .from('pp_stock_items')
    .select('id, name, category')
    .eq('org_id', org.id);
  if (error) {
    console.error(`Refusing to continue: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as { id: string; name: string; category: string | null }[];
  const targets = rows.filter((r) => !r.category || !r.category.trim());
  console.log(`${rows.length} stock items total, ${targets.length} uncategorised.`);

  if (targets.length === 0) {
    console.log('Nothing to categorise — every row already has a category.');
    await printDistribution(org.id);
    return;
  }

  const batches: { id: string; name: string }[][] = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  console.log(`Running ${batches.length} categorisation batch(es) of up to ${BATCH}...`);

  let mapping: Record<string, string> = {};
  const results = await Promise.all(batches.map((b) => categoriseProducts(b)));
  for (const r of results) mapping = { ...mapping, ...r };

  const missing = targets.filter((t) => !mapping[t.id]);
  if (missing.length) {
    console.warn(`${missing.length} item(s) got no category back from the model and will stay NULL:`);
    for (const m of missing.slice(0, 20)) console.warn(`  - ${m.name} (${m.id})`);
  }

  const byCategory = new Map<string, string[]>();
  for (const [id, cat] of Object.entries(mapping)) {
    const arr = byCategory.get(cat) ?? [];
    arr.push(id);
    byCategory.set(cat, arr);
  }

  let updated = 0;
  for (const [cat, ids] of byCategory) {
    const { error: updErr } = await supabase.from('pp_stock_items').update({ category: cat }).in('id', ids);
    if (updErr) {
      console.error(`Failed to write category "${cat}" for ${ids.length} item(s): ${updErr.message}`);
      continue;
    }
    updated += ids.length;
  }
  console.log(`Updated ${updated}/${targets.length} item(s).`);

  await printDistribution(org.id);
}

async function printDistribution(orgId: string): Promise<void> {
  const { data, error } = await supabase.from('pp_stock_items').select('category').eq('org_id', orgId);
  if (error) {
    console.error(`Could not read back distribution: ${error.message}`);
    return;
  }
  const rows = (data ?? []) as { category: string | null }[];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.category && r.category.trim() ? r.category : 'Uncategorised (NULL)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log('\n-- category distribution --');
  for (const [cat, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(24)} ${n}`);
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${rows.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
