import type { FindingSeries, SeriesPoint } from '@/lib/platform/price-watch/series';
import { unitPrice } from './brief-display';

/**
 * What this item has actually cost, invoice by invoice (design 1c, the left
 * panel).
 *
 * NO CHART LIBRARY. One `<polyline>`, three grid lines and two circles is the
 * whole drawing; a charting dependency would be more bytes than the rest of the
 * page for a shape that has no interaction, no zoom and no second axis. The
 * mock's own SVG is hand-written for the same reason.
 *
 * THE X AXIS IS TIME, NOT POSITION. Points are placed by their invoice date, so
 * a three-month gap between two deliveries LOOKS like a three-month gap. Spacing
 * them evenly (which is what an index-based x would do, and what most quick
 * implementations do) would flatten a sudden jump into a gentle slope, or turn
 * a quiet quarter into a cliff — on a chart whose only job is to show whether
 * a price moved and when. The month labels are positioned by the same scale,
 * which is why they are absolutely-placed spans rather than the mock's evenly
 * spaced flex row.
 *
 * DEFENSIVE GEOMETRY. Every divisor here can legitimately be zero — one day's
 * worth of invoices (t1 === t0), a price that never moved (max === min) — and
 * each case draws a flat line through the middle rather than NaN coordinates,
 * which render as nothing at all and would look like a broken panel.
 *
 * Presentational and pure: it receives the resolved series and derives only
 * pixels from it. `MONTHS` is a fixed array rather than `Intl` because this
 * renders inside a client component and a locale-dependent label is one more
 * thing that can differ between the server's HTML and the browser's hydration.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Price Watch's orange — the same one the agent chip and the accent bar wear. */
const LINE = '#BE5D23';

const W = 520;
const H = 180;
/** Room for the end markers, so a first or last point can't be half-clipped. */
const PAD_X = 8;
const PAD_Y = 18;

/** UTC midnight of a 'YYYY-MM-DD' string. UTC throughout: these are DATE
 *  columns with no time in them, so a timezone would only introduce an offset
 *  that could push a point into the previous month. */
function dayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function monthLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return MONTHS[month - 1] ?? '';
}

/** "Jun–Aug", or "Aug 2025 – Aug 2026" once the series crosses a year. */
function rangeLabel(first: string, last: string): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const a = sameYear ? monthLabel(first) : `${monthLabel(first)} ${first.slice(0, 4)}`;
  const b = sameYear ? monthLabel(last) : `${monthLabel(last)} ${last.slice(0, 4)}`;
  return a === b ? a : `${a}–${b}`;
}

/** Month boundaries inside the series' span, as percentages across the plot —
 *  the axis labels. Capped so a two-year series doesn't print 24 of them on top
 *  of each other. */
function monthTicks(points: SeriesPoint[]): { label: string; pct: number }[] {
  const t0 = dayMs(points[0].invoice_date);
  const t1 = dayMs(points[points.length - 1].invoice_date);
  const span = t1 - t0;

  const seen = new Map<string, number>();
  for (const p of points) {
    const key = p.invoice_date.slice(0, 7);
    if (!seen.has(key)) seen.set(key, dayMs(`${key}-01`));
  }

  const all = [...seen.entries()];
  // Every other month, then every third, … until they fit.
  const step = Math.ceil(all.length / 8);
  return all
    .filter((_, i) => i % step === 0)
    .map(([key, t]) => ({
      label: monthLabel(`${key}-01`),
      // A month that starts before the first invoice pins to the left edge
      // rather than hanging off it.
      pct: span > 0 ? Math.min(100, Math.max(0, ((t - t0) / span) * 100)) : 50,
    }));
}

export function PriceHistoryChart({
  series,
  className = '',
}: {
  /** Guaranteed by the caller to hold at least two points — one price is not a
   *  history, and the panel is omitted rather than drawn flat. */
  series: FindingSeries;
  className?: string;
}) {
  const { points, first, last, deltaPct, base_unit, item_name, supplier_name } = series;
  if (points.length < 2 || !first || !last) return null;

  const t0 = dayMs(first.invoice_date);
  const t1 = dayMs(last.invoice_date);
  const span = t1 - t0;

  const prices = points.map((p) => p.unit_price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  const x = (p: SeriesPoint) =>
    span > 0 ? PAD_X + ((dayMs(p.invoice_date) - t0) / span) * (W - PAD_X * 2) : W / 2;
  const y = (p: SeriesPoint) =>
    range > 0 ? PAD_Y + (1 - (p.unit_price - min) / range) * (H - PAD_Y * 2) : H / 2;

  const path = points.map((p) => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const ticks = monthTicks(points);

  const rose = deltaPct != null && deltaPct > 0;
  const heading = [item_name, base_unit ? `R/${base_unit}` : null, rangeLabel(first.invoice_date, last.invoice_date)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`rounded-[var(--pf-radius-card)] border border-[var(--pf-border)] bg-white px-5 py-[18px] shadow-[var(--pf-shadow-card)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-text-muted)]">
          {heading || 'Price history'}
        </div>
        {supplier_name ? (
          <div className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--pf-text-secondary)]">
            <span className="h-[2.5px] w-[10px] rounded-[2px]" style={{ background: LINE }} aria-hidden />
            {supplier_name}
          </div>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2.5 w-full"
        role="img"
        aria-label={`${item_name ?? 'This item'} moved from ${unitPrice(first.unit_price, base_unit)} on ${first.invoice_date} to ${unitPrice(last.unit_price, base_unit)} on ${last.invoice_date} across ${points.length} invoice lines.`}
      >
        {[45, 90, 135].map((gy) => (
          <line key={gy} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--pf-border-soft)" />
        ))}
        <polyline
          points={path}
          fill="none"
          stroke={LINE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Where it started — hollow, so it reads as a reference rather than a
            second reading. */}
        <circle cx={x(first)} cy={y(first)} r="4" fill="#fff" stroke={LINE} strokeWidth="2.5" />
        {/* Where it is now. */}
        <circle cx={x(last)} cy={y(last)} r="4.5" fill={LINE} />
      </svg>

      <div className="relative mt-1 h-[14px] text-[11px] text-[var(--pf-text-faint)]">
        {ticks.map((t, i) => (
          <span
            key={`${t.label}-${i}`}
            className="of-num absolute top-0 whitespace-nowrap"
            style={{
              left: `${t.pct}%`,
              transform: t.pct < 6 ? 'none' : t.pct > 94 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {t.label}
          </span>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-7 gap-y-3 border-t border-[var(--pf-border-soft)] pt-3">
        <Stat label={supplier_name ? `${supplier_name} today` : 'Latest'} value={unitPrice(last.unit_price, base_unit)} />
        <Stat label={`First seen ${monthLabel(first.invoice_date)}`} value={unitPrice(first.unit_price, base_unit)} />
        {deltaPct != null ? (
          <Stat
            label="Change"
            value={`${rose ? '+' : ''}${deltaPct.toFixed(1)}%`}
            tone={rose ? '#BE5D23' : '#0F6E56'}
          />
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--pf-text-muted)]">{label}</div>
      <div
        className="of-num text-[17px] font-semibold text-[var(--pf-text)]"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
