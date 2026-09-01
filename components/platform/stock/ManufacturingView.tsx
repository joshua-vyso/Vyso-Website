import { Badge, DataTable, type Column, type Tone } from '@/components/platform/module-ui';
import { rand } from '@/lib/platform/procurepulse';

/**
 * The read-only half of Manufacturing: what the warehouse can make, and what it
 * has made. The form that writes lives in `LogBatchForm` (client); these two
 * tables have no interaction, so they stay server-rendered and ship no JS.
 *
 * Freshly built on `DataTable` — ProcurePulse's `RecipesView` / batches list are
 * left where they are; only the fetchers underneath them are reused.
 */

export interface RecipeSummary {
  id: string;
  name: string;
  output: string | null;
  ingredientCount: number;
  /** Batches the current stock covers; null when nothing constrains it. */
  batches: number | null;
  readiness: 'ready' | 'blocked' | 'unknown';
  limitingName: string | null;
  costPerBatch: number;
}

export interface BatchSummary {
  id: string;
  when: string;
  recipeName: string;
  outputProduct: string;
  outputQty: number;
  outputUnit: string | null;
  /** Ingredient lines recorded against the run, pre-formatted. */
  used: string;
  source: string;
}

const READINESS: Record<RecipeSummary['readiness'], { label: string; tone: Tone }> = {
  ready: { label: 'Can make', tone: 'positive' },
  blocked: { label: 'Short on stock', tone: 'critical' },
  // "Unknown" is the honest answer when no ingredient line is linked to a
  // tracked product: we cannot judge availability, and guessing "ready" would
  // put a green badge on a recipe nobody has the stock for.
  unknown: { label: 'Not linked to stock', tone: 'neutral' },
};

const RECIPE_COLUMNS: Column[] = [
  { label: 'Recipe' },
  { label: 'Makes' },
  { label: 'Ingredients', align: 'right' },
  { label: 'Batches now', align: 'right' },
  { label: 'Limited by' },
  { label: 'Stock cost / batch', align: 'right' },
];

const BATCH_COLUMNS: Column[] = [
  { label: 'Date' },
  { label: 'Recipe' },
  { label: 'Produced' },
  { label: 'Quantity', align: 'right' },
  { label: 'Used' },
];

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h2 className="of-display text-[16px] font-semibold text-[var(--pf-text)]">{title}</h2>
      <p className="mt-0.5 text-[13px] text-[var(--pf-text-muted)]">{sub}</p>
    </div>
  );
}

export function RecipesTable({ recipes }: { recipes: RecipeSummary[] }) {
  const rows = recipes.map((r) => {
    const badge = READINESS[r.readiness];
    return [
      <span key="n" className="flex items-center gap-2">
        <span className="truncate">{r.name}</span>
        <Badge label={badge.label} tone={badge.tone} />
      </span>,
      r.output ?? '—',
      String(r.ingredientCount),
      r.batches == null ? '—' : String(r.batches),
      r.readiness === 'blocked' && r.limitingName ? r.limitingName : '—',
      r.costPerBatch > 0 ? rand(r.costPerBatch) : '—',
    ];
  });

  return (
    <section>
      <Heading
        title="Recipes"
        sub="What the warehouse makes from tracked stock, and how many batches today's levels cover"
      />
      <DataTable
        columns={RECIPE_COLUMNS}
        rows={rows}
        empty="No recipes yet — a recipe links the products you buy to the ones you make."
      />
    </section>
  );
}

export function BatchesTable({ batches }: { batches: BatchSummary[] }) {
  const rows = batches.map((b) => [
    b.when,
    <span key="r" className="flex items-center gap-2">
      <span className="truncate">{b.recipeName}</span>
      {/* A batch drafted through Finch and confirmed by a person is still a
          person's write, but knowing which runs came in through chat is worth
          one quiet pill. */}
      {b.source === 'chat' ? <Badge label="Chat" tone="info" /> : null}
    </span>,
    b.outputProduct,
    `${b.outputQty}${b.outputUnit ? ` ${b.outputUnit}` : ''}`,
    b.used || '—',
  ]);

  return (
    <section>
      <Heading title="Batch log" sub="Production runs recorded against stock, newest first" />
      <DataTable columns={BATCH_COLUMNS} rows={rows} empty="No batches logged yet." />
    </section>
  );
}
