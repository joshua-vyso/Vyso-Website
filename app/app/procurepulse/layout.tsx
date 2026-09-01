/**
 * Passthrough. Every page under `/app/procurepulse` is now a `redirect()` into
 * Stock & Suppliers (`.ai/plan_stock_suppliers_page.md`), so this layout must
 * render nothing of its own — the module header, the nine-tab `PpSubnav` and the
 * feature gate it used to draw would flash on screen for the length of a
 * redirect and, worse, would draw a nav pointing at routes that no longer exist.
 *
 * THE SEGMENT SURVIVES ON PURPOSE. Deleting it would 404 every bookmark, email
 * link and finding href written while ProcurePulse was a module; keeping the
 * files as redirects forwards them. `components/platform/procurepulse/*` and
 * every `/api/procurepulse/*` route also stay — the new screens reuse them.
 */
export default function ProcurePulseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
