'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionCard } from '@/components/platform/module-ui';

/**
 * Log a production run — recipe, how many batches, the date.
 *
 * NEW FORM, EXISTING API. `POST /api/procurepulse/batch` already does the real
 * work (resolve/create the output product, write the batch header + ingredient
 * lines, move stock down for ingredients and up for the output), so this is
 * only the simple front end the plan asked for. ProcurePulse's `BatchLogger` is
 * deliberately not mounted: it carries the Finch chat-draft coupling, and this
 * screen is a person filling in a form.
 *
 * QUANTITY MEANS BATCHES, not output units. The recipe already states what one
 * batch consumes and produces, so multiplying by a batch count is the one input
 * that cannot contradict the recipe — asking for an output quantity instead
 * would leave the ingredient amounts to be reverse-engineered from a divide
 * that breaks whenever `output_qty` is null.
 *
 * THE DATE RIDES IN `notes`. The API has no date field — `pp_batches.created_at`
 * is stamped server-side when the run is recorded — so a back-dated batch says
 * so in its note rather than being silently filed as today with no trace. See
 * the deviation noted in the implementation report.
 */

export interface BatchRecipeOption {
  id: string;
  name: string;
  outputProduct: string | null;
  outputQty: number | null;
  outputUnit: string | null;
  ingredients: {
    stock_item_id: string | null;
    product_name: string;
    qty_per_batch: number;
    unit: string | null;
  }[];
  /** Batches the current stock can cover; null when nothing constrains it. */
  possible: number | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function LogBatchForm({ recipes }: { recipes: BatchRecipeOption[] }) {
  const router = useRouter();
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '');
  const [batches, setBatches] = useState('1');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const recipe = useMemo(() => recipes.find((r) => r.id === recipeId) ?? null, [recipes, recipeId]);
  const count = Number(batches.replace(',', '.'));
  const validCount = Number.isFinite(count) && count > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipe || !validCount || busy) return;
    setBusy(true);
    setMsg(null);
    setError(false);
    try {
      const res = await fetch('/api/procurepulse/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipe_id: recipe.id,
          ingredients: recipe.ingredients.map((i) => ({
            stock_item_id: i.stock_item_id,
            product_name: i.product_name,
            qty_used: i.qty_per_batch * count,
            unit: i.unit,
          })),
          output: {
            qty: (recipe.outputQty ?? 0) * count,
            unit: recipe.outputUnit ?? undefined,
          },
          notes: date && date !== todayISO() ? `Batch date: ${date}` : undefined,
          source: 'manual',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        movements?: number;
        output?: { name?: string; new_on_hand?: number };
      };
      if (!res.ok) {
        setError(true);
        setMsg(json.error ?? 'Could not log the batch.');
        return;
      }
      setMsg(
        `Logged. ${json.output?.name ?? 'Output'} is now ${fmtQty(Number(json.output?.new_on_hand ?? 0))} on hand · ${json.movements ?? 0} stock movement${json.movements === 1 ? '' : 's'}.`,
      );
      setBatches('1');
      router.refresh();
    } catch {
      setError(true);
      setMsg('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'h-[38px] w-full rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-3 text-[14px] text-[var(--pf-text)] outline-none focus:border-[var(--pf-accent)]';

  return (
    <SectionCard title="Log a batch">
      {recipes.length === 0 ? (
        <p className="text-[13px] text-[var(--pf-text-muted)]">
          No recipes yet — a recipe defines what a batch consumes and produces, so there is nothing
          to log against.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--pf-text-muted)]">Recipe</span>
              <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className={`${field} mt-1.5`}>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--pf-text-muted)]">Batches</span>
              <input
                type="text"
                inputMode="decimal"
                value={batches}
                onChange={(e) => setBatches(e.target.value)}
                className={`of-num mt-1.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--pf-text-muted)]">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1.5 ${field}`} />
            </label>
          </div>

          {recipe ? (
            <div className="rounded-[var(--pf-radius-control)] bg-[var(--pf-surface-tint)] px-4 py-3 text-[13px] text-[var(--pf-text-body)]">
              {/* What pressing the button will actually DO, in the org's own
                  numbers — a stock write should never be a surprise. */}
              <div>
                Produces{' '}
                <strong className="of-num">
                  {validCount ? fmtQty((recipe.outputQty ?? 0) * count) : '—'} {recipe.outputUnit ?? 'units'}
                </strong>{' '}
                of {recipe.outputProduct ?? recipe.name}
                {recipe.possible != null ? (
                  <span className="text-[var(--pf-text-muted)]"> · stock covers {recipe.possible} batch{recipe.possible === 1 ? '' : 'es'}</span>
                ) : null}
              </div>
              {recipe.ingredients.length > 0 ? (
                <div className="mt-1.5 text-[var(--pf-text-muted)]">
                  Uses{' '}
                  {recipe.ingredients
                    .map((i) => `${validCount ? fmtQty(i.qty_per_batch * count) : '—'} ${i.unit ?? ''} ${i.product_name}`.replace(/\s+/g, ' '))
                    .join(' · ')}
                </div>
              ) : (
                <div className="mt-1.5 text-[var(--pf-text-muted)]">
                  This recipe has no ingredient lines, so nothing will be taken off stock.
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!recipe || !validCount || busy}
              className="h-[38px] rounded-[var(--pf-radius-control)] bg-[var(--pf-accent-strong)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--pf-accent-deep)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Logging…' : 'Log batch'}
            </button>
            {msg ? (
              <span
                className="text-[13px]"
                style={{ color: error ? 'var(--tone-critical-fg)' : 'var(--pf-text-muted)' }}
              >
                {msg}
              </span>
            ) : (
              <span className="text-[13px] text-[var(--pf-text-faint)]">Moves real stock: ingredients down, output up.</span>
            )}
          </div>
        </form>
      )}
    </SectionCard>
  );
}
