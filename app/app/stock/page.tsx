import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Stock & Suppliers — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 1 of `PLAN.md`).
 *
 * A stub, not a redirect. Pointing this at `/app/procurepulse/stock` would tell
 * the owner the restructure has not happened and would have to be un-pointed in
 * Phase 1; naming what is coming, and linking the two screens that already do
 * part of the job, is the honest version of the same click.
 */
export default function StockPage() {
  return (
    <PhaseStub
      icon="proc"
      title="Stock & Suppliers"
      description="What you hold, what you pay for it, and who you buy it from"
      phase={1}
      lede="Stock levels, supplier prices, the market sheet and manufacturing batches come together here, fed by the documents you upload — one screen instead of two modules."
      links={[
        {
          label: 'Stock',
          href: '/app/procurepulse/stock',
          note: 'Live stock levels, counts, reorder points',
        },
        {
          label: 'Suppliers',
          href: '/app/suppliers',
          note: 'Who you buy from, and what they have charged',
        },
      ]}
    />
  );
}
