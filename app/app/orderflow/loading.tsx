import { RouteSkeleton } from '@/components/platform/RouteSkeleton';

/**
 * Tab-level loading fallback. Next nests this inside the module's own layout,
 * so the sub-nav and page padding are already on screen and stay interactive —
 * only the page body is swapped for the skeleton while the next tab loads.
 */
export default function Loading() {
  return <RouteSkeleton />;
}
