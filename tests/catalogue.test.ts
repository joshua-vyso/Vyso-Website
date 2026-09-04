import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE_PAGE, loadOrgProductNames, loadOrgStockItems } from '../lib/platform/catalogue.ts';

// A PostgREST-shaped fake that, like Supabase, only ever answers a `range`.
function fakeDb(rows: { id: string; name: string; org_id: string }[]) {
  const calls: [number, number][] = [];
  const db = {
    from(table: string) {
      assert.equal(table, 'pp_stock_items');
      const filters: [string, unknown][] = [];
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push([c, v]), chain),
        order: () => chain,
        range: async (from: number, to: number) => {
          calls.push([from, to]);
          const data = rows.filter((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v)).slice(from, to + 1);
          return { data, error: null };
        },
      };
      return chain;
    },
  };
  return { db: db as never, calls };
}

test('reads a catalogue larger than one PostgREST page, whole and in order', async () => {
  const rows = Array.from({ length: 1060 }, (_, i) => ({ id: `id-${i}`, name: `Item ${String(i).padStart(4, '0')}`, org_id: 'org' }));
  const { db, calls } = fakeDb(rows);
  const out = await loadOrgStockItems<{ id: string; name: string }>(db, 'org', 'id, name');
  assert.equal(out.length, 1060);
  assert.equal(out.at(-1)?.name, 'Item 1059');
  assert.deepEqual(calls, [[0, CATALOGUE_PAGE - 1], [CATALOGUE_PAGE, 2 * CATALOGUE_PAGE - 1]]);
});

test('a catalogue of exactly one page stops after a second, empty page', async () => {
  const rows = Array.from({ length: CATALOGUE_PAGE }, (_, i) => ({ id: `id-${i}`, name: `n${i}`, org_id: 'org' }));
  const { db, calls } = fakeDb(rows);
  assert.equal((await loadOrgStockItems(db, 'org', 'id')).length, CATALOGUE_PAGE);
  assert.equal(calls.length, 2);
});

test('other orgs are never read, and names drop blanks', async () => {
  const { db } = fakeDb([
    { id: '1', name: 'Thyme (pkt)', org_id: 'org' },
    { id: '2', name: '', org_id: 'org' },
    { id: '3', name: 'Someone else', org_id: 'other' },
  ]);
  assert.deepEqual(await loadOrgProductNames(db, 'org'), ['Thyme (pkt)']);
});
