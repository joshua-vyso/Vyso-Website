import { RouteSkeleton } from '@/components/platform/RouteSkeleton';

/**
 * Platform-wide loading fallback. It sits below the shell layout's session
 * await, so it covers every module layout beneath it — clicking a module tile
 * paints this immediately instead of freezing on the previous screen while that
 * module's layout fetches its data.
 *
 * `chrome` because at this level no module sub-nav has rendered yet.
 */
export default function AppLoading() {
  return <RouteSkeleton chrome />;
}
