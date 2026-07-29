/**
 * The shared route-level loading fallback for every /app screen. Rendered from
 * the `loading.tsx` files so a navigation paints instantly instead of freezing
 * on the previous page for the whole server round-trip.
 *
 * Deliberately dumb: a server component with NO imports that touch cookies,
 * the session or the platform context — a loading fallback must be renderable
 * before any of that resolves.
 *
 * `chrome` picks which of the two slots the skeleton is filling:
 *  - `chrome` (app/app/loading.tsx, app/app/docu/loading.tsx) — the file sits
 *    ABOVE a module's own chrome, so it draws the page padding and a
 *    SubNav-shaped placeholder bar itself.
 *  - default (a module's loading.tsx) — Next nests `loading.tsx` INSIDE the
 *    layout of the same segment, so the real padding and the real SubNav are
 *    already on screen. Drawing them again would double the padding and stack a
 *    fake tab bar under the real one, so the module variant is content-only.
 *
 * Not to be confused with ModuleSkeleton, which is a permanent "this screen
 * isn't built yet" placeholder rather than a transient loading state.
 */

/** Fixed widths so the placeholder bars look like real tabs without randomness
 * (which would desync between the server and client renders). */
const TAB_WIDTHS = [62, 84, 56, 92, 70, 78, 66, 88];
const ROW_WIDTHS = [58, 72, 46, 64, 52, 68, 44, 60];

const BAR = 'rounded-full bg-[#EDF0F4]';
const CARD = 'rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]';

export function RouteSkeleton({
  chrome = false,
  tabs = 6,
  stats = 4,
  rows = 6,
}: {
  /** Draw the page padding + sub-nav placeholder. See the note above. */
  chrome?: boolean;
  /** How many placeholder tabs the sub-nav bar shows (only used with `chrome`). */
  tabs?: number;
  /** Placeholder stat cards above the main card; 0 hides the row. */
  stats?: number;
  /** Placeholder list rows inside the main card. */
  rows?: number;
}) {
  return (
    <div className={chrome ? 'min-h-full px-8 py-7' : undefined} role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>

      <div className="animate-pulse" aria-hidden>
        {chrome ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#EAEDF2]">
            {Array.from({ length: tabs }).map((_, i) => (
              <span key={i} className="-mb-px block pb-2.5 pt-1">
                <span
                  className={`block h-[14px] ${BAR}`}
                  style={{ width: TAB_WIDTHS[i % TAB_WIDTHS.length] }}
                />
              </span>
            ))}
          </div>
        ) : null}

        <div className={chrome ? 'mt-6' : undefined}>
          {/* Page heading */}
          <div className={`h-[26px] w-[220px] max-w-full ${BAR}`} />
          <div className={`mt-2.5 h-[14px] w-[340px] max-w-full ${BAR}`} />

          {stats > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: stats }).map((_, i) => (
                <div key={i} className={`${CARD} p-5`}>
                  <div className={`h-[12px] w-[80px] ${BAR}`} />
                  <div className={`mt-3 h-[24px] w-[110px] ${BAR}`} />
                  <div className={`mt-3 h-[10px] w-[64px] ${BAR}`} />
                </div>
              ))}
            </div>
          ) : null}

          <div className={`mt-4 ${CARD} p-5`}>
            <div className="flex items-center justify-between gap-4">
              <div className={`h-[16px] w-[160px] ${BAR}`} />
              <div className="h-[30px] w-[110px] shrink-0 rounded-[10px] bg-[#EDF0F4]" />
            </div>
            <div className="mt-5 flex flex-col gap-3.5">
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-[32px] w-[32px] shrink-0 rounded-[10px] bg-[#EDF0F4]" />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`h-[12px] ${BAR}`}
                      style={{ width: `${ROW_WIDTHS[i % ROW_WIDTHS.length]}%` }}
                    />
                    <div className={`mt-2 h-[10px] w-[38%] ${BAR}`} />
                  </div>
                  <div className={`h-[12px] w-[70px] shrink-0 ${BAR}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
