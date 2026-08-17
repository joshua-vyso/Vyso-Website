import type { CompareTableSpec } from "@/lib/marketing/compare";

/* ── The comparison table ────────────────────────────────────────────────────
   A server component: both behaviours the plan asks for are CSS, so this table
   ships no JavaScript.

   1. **Row highlight under the pointer.** Each cell paints `--row-bg`, which
      the `<tr>` sets and swaps on `:hover`. Going through a custom property
      rather than `hover:bg-*` on the cells is what lets the sticky first column
      (which needs its own opaque background) highlight with the rest of the row
      instead of fighting it.
   2. **Sticky first column on mobile.** The table has a `min-width`, so below
      roughly 720px the wrapper scrolls horizontally and the criterion column
      stays put — you can always see which row you are reading. Above that width
      the table fits and `position: sticky` has nothing to do.

   No fill colour on the Finch column: on this site orange means an agent found
   something that costs money, and a tinted "ours" column would be a colour
   making an argument. The column earns its emphasis with ink and weight.      */

export function CompareTable({ spec, label }: { spec: CompareTableSpec; label: string }) {
  const [criterionCol, theirsCol, finchCol] = spec.columns;

  return (
    <div className="mt-[32px]">
      {/* `tabindex` + role: a scrollable region has to be reachable by keyboard,
          or the sticky column is the only part a keyboard user ever sees. */}
      <div
        className="overflow-x-auto rounded-[10px] border border-fn-line bg-fn-surface"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="px-[20px] pb-[4px] pt-[18px] text-left text-[12.5px] leading-[1.55] text-fn-muted">
            {spec.caption}
          </caption>
          <thead>
            <tr className="[--row-bg:var(--fn-bg)]">
              <th
                scope="col"
                className="sticky left-0 z-[1] w-[26%] border-b border-fn-line bg-[var(--row-bg)] px-[20px] py-[13px] font-fn-mono text-[10px] font-normal tracking-[0.12em] text-fn-muted"
              >
                {criterionCol.toUpperCase()}
              </th>
              <th
                scope="col"
                className="w-[37%] border-b border-fn-line bg-[var(--row-bg)] px-[20px] py-[13px] font-fn-mono text-[10px] font-normal tracking-[0.12em] text-fn-muted"
              >
                {theirsCol.toUpperCase()}
              </th>
              <th
                scope="col"
                className="w-[37%] border-b border-l border-fn-line bg-[var(--row-bg)] px-[20px] py-[13px] font-fn-mono text-[10px] font-normal tracking-[0.12em] text-fn-ink-2"
              >
                {finchCol.toUpperCase()}
              </th>
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((row) => (
              <tr key={row.criterion} className="[--row-bg:var(--fn-surface)] hover:[--row-bg:#F5F2EA]">
                <th
                  scope="row"
                  className="sticky left-0 z-[1] border-b border-fn-line-2 bg-[var(--row-bg)] px-[20px] py-[15px] align-top text-[14px] font-medium leading-[1.5] text-fn-ink transition-colors duration-150"
                >
                  {row.criterion}
                </th>
                <td className="border-b border-fn-line-2 bg-[var(--row-bg)] px-[20px] py-[15px] align-top text-[14px] leading-[1.55] text-fn-ink-3 transition-colors duration-150">
                  {row.theirs}
                </td>
                <td className="border-b border-l border-fn-line-2 bg-[var(--row-bg)] px-[20px] py-[15px] align-top text-[14px] font-medium leading-[1.55] text-fn-ink-2 transition-colors duration-150">
                  {row.finch}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-[10px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint lg:hidden">
        SCROLL THE TABLE SIDEWAYS →
      </div>
    </div>
  );
}

export default CompareTable;
