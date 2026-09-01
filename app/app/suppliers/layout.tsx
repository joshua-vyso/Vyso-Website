/**
 * Passthrough. Every page under `/app/suppliers` now redirects to
 * `/app/stock/suppliers` (`.ai/plan_stock_suppliers_page.md`), so this layout
 * renders nothing: its `getSupplySyncData` call was TEN queries built to fill a
 * seven-tab chrome, and running them to serve a redirect would make the slowest
 * screen in the platform out of one that no longer draws anything.
 *
 * THE SEGMENT SURVIVES ON PURPOSE — old links keep working.
 * `components/platform/supplysync/*` and `lib/platform/supplysync-*.ts` stay
 * too; the Suppliers tab reuses the lib.
 */
export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
