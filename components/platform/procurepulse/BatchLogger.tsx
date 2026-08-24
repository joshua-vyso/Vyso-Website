'use client';

import { useEffect, useMemo, useState } from 'react';
import { filterRecipes } from '@/lib/platform/procurepulse/batch-logic';
import { distinctItemUnits } from '@/lib/platform/procurepulse/units';

/** The thin recipe shape the logger needs: header + its ingredient lines. */
export interface RecipeLite {
  id: string;
  name: string;
  output_product: string | null;
  output_qty: number | null;
  output_unit: string | null;
  /** Set once a batch has resolved/created the output product (see the batch
   *  route's "learned link"). When set, the output unit is locked to that
   *  item's own unit rather than editable here. */
  output_stock_item_id: string | null;
  ingredients: {
    stock_item_id: string | null;
    product_name: string;
    qty_per_batch: number;
    unit: string | null;
  }[];
}

export interface ItemLite {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
}

interface Row {
  stock_item_id: string | null;
  product_name: string;
  qty_used: string;
  unit: string;
}

interface RecentBatch {
  id: string;
  recipe_name: string;
  output_product: string;
  output_qty: number;
  output_unit: string | null;
  source: 'manual' | 'chat';
  created_at: string;
}

function sanitizeDecimal(s: string): string {
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const field =
  'h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

const OTHER = '__other__';

/**
 * Unit control for a line that ISN'T locked to a stock item: a `<select>` of
 * the org's known units, sorted and deduped case-insensitively, plus the
 * field's own current value folded in (so it can always represent what's
 * already there, even a one-off unit — see `distinctItemUnits`). "Other…"
 * drops to a plain input: the org's unit data is too messy (pkt / 250gr pkt /
 * bx …) to treat as a closed list, so this must never block a new one.
 */
function UnitPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const known = useMemo(() => distinctItemUnits([...options, value]), [options, value]);
  const [customOpen, setCustomOpen] = useState(false);

  if (customOpen) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="unit"
          className="h-10 w-[76px] rounded-[10px] border border-[#E4E9F0] bg-white px-2 text-[13px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
        />
        <button
          type="button"
          onClick={() => setCustomOpen(false)}
          aria-label="Back to unit list"
          className="text-[11px] text-[#8A8E86] hover:text-[#3E4A57]"
        >
          list
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => (e.target.value === OTHER ? setCustomOpen(true) : onChange(e.target.value))}
      className="h-10 w-[104px] rounded-[10px] border border-[#E4E9F0] bg-white px-2 text-[13px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
    >
      <option value="">unit…</option>
      {known.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
      <option value={OTHER}>Other…</option>
    </select>
  );
}

/**
 * Log a Manufacturing batch: typeahead a recipe, adjust the weights actually
 * used (prefilled from the recipe but editable — a person weighing on the
 * floor doesn't always hit the recipe exactly), confirm. The route this
 * POSTs to (`/api/procurepulse/batch`) is the ONLY place stock actually
 * moves — this component just collects what happened and shows what came
 * back.
 */
export function BatchLogger({
  recipes,
  items,
  unitOptions,
}: {
  recipes: RecipeLite[];
  items: ItemLite[];
  /** The org's distinct stock-item units — see `distinctItemUnits`. Built
   *  server-side by the page (it already has the stock read) and handed down
   *  as a plain prop rather than re-fetched here. */
  unitOptions: string[];
}) {
  const [query, setQuery] = useState('');
  const [openPicker, setOpenPicker] = useState(false);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [outputQty, setOutputQty] = useState('');
  const [outputUnit, setOutputUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [recent, setRecent] = useState<RecentBatch[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const recipe = useMemo(() => recipes.find((r) => r.id === recipeId) ?? null, [recipes, recipeId]);
  /** Set only once the recipe's output has a learned link — until then the
   *  output unit stays editable (see RecipeLite.output_stock_item_id). */
  const outputItem = useMemo(
    () => (recipe?.output_stock_item_id ? itemById.get(recipe.output_stock_item_id) ?? null : null),
    [recipe, itemById],
  );

  // Root cause of the "dead picker" bug this replaces: the old version only
  // computed matches once `query` was non-empty, so focusing the field with
  // nothing typed yet showed no dropdown at all — with an org that has one
  // recipe, that reads as "typeahead does nothing". filterRecipes() returns
  // every recipe for an empty query, so focus alone now surfaces the list.
  const matches = useMemo(() => {
    if (recipeId) return [];
    return filterRecipes(recipes, query, 8);
  }, [recipes, query, recipeId]);

  /** Recipe selected, and the one number that actually has to be right —
   *  gates the Confirm button (a zero/blank output would log a batch that
   *  produced nothing, which is never intentional). */
  const canConfirm = useMemo(() => {
    if (!recipe) return false;
    const qty = Number(outputQty);
    return Number.isFinite(qty) && qty > 0;
  }, [recipe, outputQty]);

  /** Re-fetched after a confirmed batch (from a click handler, not an effect —
   *  see the mount-time effect below for why that distinction matters here). */
  async function loadRecent() {
    try {
      const res = await fetch('/api/procurepulse/batch');
      const json = (await res.json().catch(() => ({}))) as { batches?: RecentBatch[] };
      setRecent(res.ok ? json.batches ?? [] : []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }

  // Inlined as an IIFE rather than `void loadRecent()`: eslint's
  // set-state-in-effect check flags an effect that directly calls a named
  // function it can see sets state, even async ones — same reason
  // AddStockButton.tsx's mount effect is written this way instead of calling
  // out to a shared helper.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/procurepulse/batch');
        const json = (await res.json().catch(() => ({}))) as { batches?: RecentBatch[] };
        setRecent(res.ok ? json.batches ?? [] : []);
      } catch {
        setRecent([]);
      } finally {
        setLoadingRecent(false);
      }
    })();
  }, []);

  function pickRecipe(r: RecipeLite) {
    setRecipeId(r.id);
    setQuery(r.name);
    setOpenPicker(false);
    setRows(
      r.ingredients.map((ing) => ({
        stock_item_id: ing.stock_item_id,
        product_name: ing.product_name,
        qty_used: ing.qty_per_batch ? String(ing.qty_per_batch) : '',
        unit: ing.unit ?? '',
      })),
    );
    setOutputQty(r.output_qty != null ? String(r.output_qty) : '');
    setOutputUnit(r.output_unit ?? '');
    setNotes('');
    setMsg(null);
  }

  function clearRecipe() {
    setRecipeId(null);
    setQuery('');
    setRows([]);
    setOutputQty('');
    setOutputUnit('');
    setNotes('');
    setMsg(null);
  }

  function updateRow(i: number, qty: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, qty_used: sanitizeDecimal(qty) } : r)));
  }

  function updateRowUnit(i: number, unit: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, unit } : r)));
  }

  async function confirm() {
    if (!recipe || busy || !canConfirm) return;
    setBusy(true);
    setMsg(null);
    // A row linked to a stock item decrements THAT item — its unit, not
    // whatever the recipe last had saved, is what the on_hand math must use,
    // so the live item's unit wins over the row's own field for linked rows
    // (same reasoning for the output below).
    const effectiveOutputUnit = outputItem ? outputItem.unit : outputUnit || recipe.output_unit || null;
    try {
      const res = await fetch('/api/procurepulse/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipe_id: recipe.id,
          ingredients: rows.map((r) => {
            const item = r.stock_item_id ? itemById.get(r.stock_item_id) : null;
            return {
              stock_item_id: r.stock_item_id,
              product_name: r.product_name,
              qty_used: Number(r.qty_used) || 0,
              unit: item ? item.unit : r.unit || null,
            };
          }),
          output: { qty: Number(outputQty) || 0, unit: effectiveOutputUnit },
          notes: notes.trim() || undefined,
          source: 'manual',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        output?: { name: string; new_on_hand: number };
      };
      if (!res.ok || !json.output) {
        setMsg({ kind: 'error', text: json?.error ?? 'Could not log the batch.' });
      } else {
        setMsg({
          kind: 'ok',
          text: `Produced ${outputQty || recipe.output_qty || 0}${effectiveOutputUnit ? ` ${effectiveOutputUnit}` : ''} of ${json.output.name} — now ${json.output.new_on_hand} on hand.`,
        });
        clearRecipe();
        void loadRecent();
      }
    } catch {
      setMsg({ kind: 'error', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* LEFT — recipe picker + weights form */}
      <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="of-display text-[16px] font-semibold text-[#171A17]">New batch</div>

        <div className="relative mt-3">
          <input
            value={query}
            onChange={(e) => {
              setRecipeId(null);
              setQuery(e.target.value);
              setOpenPicker(true);
            }}
            onFocus={() => setOpenPicker(true)}
            placeholder="Search recipes…"
            className={`${field} w-full`}
          />
          {openPicker && matches.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[240px] overflow-y-auto rounded-[12px] border border-[#EAEDF2] bg-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
              {matches.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickRecipe(r);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-[14px] text-[#171A17] hover:bg-[#F5F9FE]"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="ml-2 shrink-0 text-[12px] text-[#A0A49C]">{r.ingredients.length} ingredient{r.ingredients.length === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {!recipe ? (
          <p className="mt-3 text-[13px] text-[#8A8E86]">
            {recipes.length === 0 ? 'No recipes yet — create one on the Recipes tab first.' : 'Pick a recipe to log a batch against.'}
          </p>
        ) : (
          <div className="mt-4">
            {rows.length === 0 ? (
              <p className="text-[13px] text-[#8A8E86]">This recipe has no ingredients — confirming will only record the output.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-[#EEF1F5] pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                  <div className="flex-1">Ingredient</div>
                  <div className="w-[100px] text-right">Used</div>
                  <div className="w-[104px]">Unit</div>
                </div>
                {rows.map((row, i) => {
                  const item = row.stock_item_id ? itemById.get(row.stock_item_id) : null;
                  return (
                    <div key={`${row.product_name}-${i}`} className="flex items-center gap-2 border-t border-[#F4F5F7] py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] text-[#171A17]">{row.product_name}</div>
                        {item ? (
                          <div className="of-num text-[12px] text-[#8A8E86]">On hand: {item.on_hand} {item.unit}</div>
                        ) : (
                          <div className="text-[12px] text-[#854F0B]">Not linked — won&apos;t move stock</div>
                        )}
                      </div>
                      <input
                        className={`${field} of-num h-10 w-[100px] text-right`}
                        inputMode="decimal"
                        placeholder="0"
                        value={row.qty_used}
                        onChange={(e) => updateRow(i, e.target.value)}
                      />
                      <div className="w-[104px]">
                        {item ? (
                          <div
                            title="Locked to the linked stock item's unit"
                            className="truncate text-[13px] text-[#6B6F68]"
                          >
                            {item.unit}
                          </div>
                        ) : (
                          <UnitPicker value={row.unit} options={unitOptions} onChange={(v) => updateRowUnit(i, v)} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Output */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEF1F5] pt-4 text-[13px] text-[#6B6F68]">
              <span>Produces</span>
              <span className="font-medium text-[#171A17]">{recipe.output_product || recipe.name}</span>
              <input
                value={outputQty}
                onChange={(e) => setOutputQty(sanitizeDecimal(e.target.value))}
                inputMode="decimal"
                placeholder="qty"
                className="of-num h-10 w-[80px] rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-right text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
              />
              {outputItem ? (
                <span title="Locked to the linked stock item's unit">{outputItem.unit}</span>
              ) : (
                <UnitPicker value={outputUnit} options={unitOptions} onChange={setOutputUnit} />
              )}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="mt-3 w-full resize-y rounded-[12px] border border-[#E4E9F0] bg-white px-4 py-2.5 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={clearRecipe}
                className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy || !canConfirm}
                className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
              >
                {busy ? 'Confirming…' : 'Confirm batch'}
              </button>
            </div>
          </div>
        )}

        {msg ? (
          <p className={`mt-3 text-[13px] ${msg.kind === 'ok' ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}`}>{msg.text}</p>
        ) : null}
      </div>

      {/* RIGHT — recent batches */}
      <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="of-display text-[16px] font-semibold text-[#171A17]">Recent batches</div>
        <div className="mt-3 space-y-3">
          {loadingRecent ? (
            <p className="text-[13px] text-[#8A8E86]">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-[13px] text-[#8A8E86]">No batches logged yet.</p>
          ) : (
            recent.map((b) => (
              <div key={b.id} className="border-t border-[#F4F5F7] pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[13px] font-medium text-[#171A17]">{b.output_product}</div>
                  <div className="of-num shrink-0 text-[13px] font-semibold text-[#0F6E56]">
                    +{b.output_qty}{b.output_unit ? ` ${b.output_unit}` : ''}
                  </div>
                </div>
                <div className="text-[12px] text-[#8A8E86]">
                  {b.recipe_name} · {timeAgo(b.created_at)}
                  {b.source === 'chat' ? ' · via chat' : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
