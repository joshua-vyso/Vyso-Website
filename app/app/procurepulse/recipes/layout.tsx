import { ManufacturingSubnav } from '@/components/platform/procurepulse/ManufacturingSubnav';

/**
 * Scoped to the Manufacturing section only (Recipes + Batches) — the rest of
 * ProcurePulse (Dashboard, Products, Stock orders, …) doesn't get this
 * sub-nav. Smallest-blast-radius per the plan: existing recipe routes/URLs
 * are untouched, Batches just lives beside them under the same segment.
 */
export default function ManufacturingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ManufacturingSubnav />
      {children}
    </div>
  );
}
