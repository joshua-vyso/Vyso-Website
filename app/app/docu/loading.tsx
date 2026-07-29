import { RouteSkeleton } from '@/components/platform/RouteSkeleton';

/**
 * Doc-U has no layout of its own — each screen renders its own padding and
 * DocuChrome (module header + tabs) — so this fallback draws the full chrome
 * placeholder rather than the body-only variant the other modules use.
 */
export default function DocuLoading() {
  return <RouteSkeleton chrome tabs={5} />;
}
