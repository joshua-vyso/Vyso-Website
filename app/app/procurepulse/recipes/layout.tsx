/**
 * Passthrough, for the same reason as the segment above it: the three recipe
 * routes are redirects into `/app/stock/manufacturing` now, so the
 * Recipes/Batches sub-nav this layout used to draw would point at itself.
 */
export default function ManufacturingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
