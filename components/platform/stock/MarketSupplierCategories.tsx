'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, SectionCard } from '@/components/platform/module-ui';

/**
 * "Suppliers by category" — the tidying surface for `ss_suppliers.category`.
 *
 * WHY THIS EXISTS. Every supplier profile the document feed invents is filed
 * under the literal string 'General' (lib/platform/supplysync-feed.ts creates
 * them that way), so an org that has been scanning invoices for months has a
 * long "General" list and nothing to group spend by. The fix is not a settings
 * page; it is being able to retype a category where you are already looking at
 * the names — which is what this is.
 *
 * OPTIMISTIC, BUT NOT AMNESIAC: the row moves to its new group as soon as the
 * PATCH succeeds, and `router.refresh()` re-reads the server so the rest of the
 * page (the group counts, the market sheet's own supplier list) agrees. A
 * failed save puts the old value back and says why, rather than leaving a
 * category on screen that the database never accepted.
 */

export interface MarketCategorySupplier {
  /** `ss_suppliers.id` — what the PATCH route updates. */
  id: string;
  name: string;
  category: string;
  /** How many priced lines this supplier has on the market sheet. */
  lines: number;
  /** True when a document has been filed against it — i.e. it is a real trading
   *  relationship rather than a name someone typed once. */
  active: boolean;
}

export function MarketSupplierCategories({
  suppliers,
  canEdit,
}: {
  suppliers: MarketCategorySupplier[];
  /** Owner/admin, matching the route's own gate — members get a read-only list
   *  rather than an input that always 403s. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(suppliers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, MarketCategorySupplier[]>();
    for (const s of rows) {
      const key = s.category.trim() || 'Uncategorised';
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    // Biggest group first — the pile that needs sorting is the one to show first.
    return [...map.entries()]
      .map(([name, list]) => ({ name, list: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name));
  }, [rows]);

  const knownCategories = useMemo(
    () => [...new Set(rows.map((s) => s.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  async function save(id: string, next: string) {
    const trimmed = next.trim();
    const current = rows.find((r) => r.id === id);
    if (!current || !trimmed || trimmed === current.category) return;

    const previous = current.category;
    setBusyId(id);
    setError(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: trimmed } : r)));
    try {
      const res = await fetch('/api/stock/supplier-category', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, category: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: previous } : r)));
        setError(json.error ?? 'Could not save the category.');
      } else {
        router.refresh();
      }
    } catch {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: previous } : r)));
      setError('Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SectionCard
      title="Suppliers by category"
      right={<span className="text-[12px] text-[var(--pf-text-muted)]">{rows.length} supplier{rows.length === 1 ? '' : 's'}</span>}
    >
      {error ? (
        <p className="mb-4 rounded-[var(--pf-radius)] px-3 py-2 text-[13px]" style={{ backgroundColor: 'var(--tone-critical-bg)', color: 'var(--tone-critical-fg)' }}>
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-[var(--pf-text-muted)]">
          No supplier profiles yet. They are created automatically the first time a document is filed against a supplier.
        </p>
      ) : (
        <>
          {canEdit ? (
            <p className="mb-4 text-[13px] text-[var(--pf-text-secondary)]">
              Type a category and press Enter (or click away) to re-file a supplier. Existing categories are suggested; a new
              one is created just by typing it.
            </p>
          ) : (
            <p className="mb-4 text-[13px] text-[var(--pf-text-secondary)]">
              Categories are set by an owner or admin.
            </p>
          )}

          {/* One shared datalist: every input suggests the categories already in
              use, so re-filing converges on the same spellings instead of
              growing "Produce", "produce" and "Fresh produce". */}
          <datalist id="stock-supplier-categories">
            {knownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="flex items-center gap-2 border-b border-[var(--pf-border-soft)] pb-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-text-secondary)]">{g.name}</h3>
                  <Badge label={String(g.list.length)} tone="neutral" />
                </div>
                <ul className="divide-y divide-[var(--pf-border-soft)]">
                  {g.list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-[var(--pf-text)]">{s.name}</div>
                        <div className="mt-0.5 text-[12px] text-[var(--pf-text-muted)]">
                          {s.lines > 0 ? `${s.lines} priced line${s.lines === 1 ? '' : 's'}` : 'No prices on file'}
                          {s.active ? ' · trading' : ''}
                        </div>
                      </div>
                      {canEdit ? (
                        <input
                          type="text"
                          list="stock-supplier-categories"
                          defaultValue={s.category}
                          disabled={busyId === s.id}
                          onBlur={(e) => save(s.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') (e.target as HTMLInputElement).value = s.category;
                          }}
                          className="h-9 w-[200px] rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-3 text-[13px] text-[var(--pf-text-control)] outline-none focus:border-[var(--pf-accent)] disabled:opacity-50"
                        />
                      ) : (
                        <span className="text-[13px] text-[var(--pf-text-muted)]">{s.category || 'Uncategorised'}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}
