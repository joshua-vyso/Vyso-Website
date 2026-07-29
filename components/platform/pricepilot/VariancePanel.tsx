'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zar, zar2, pts, type VarianceAttribution, type VarianceComponentKey } from '@/lib/platform/pricepilot';

export type VarianceWindowKey = '30d' | '90d';

export interface VariancePanelProps {
  /** One attribution per comparison window (current window vs the window before it). */
  windows: Record<VarianceWindowKey, VarianceAttribution>;
  /** True when ww_waste_events could actually be read — otherwise the waste row is honest about it. */
  hasWasteData: boolean;
}

const WINDOWS: { key: VarianceWindowKey; label: string; sub: string }[] = [
  { key: '30d', label: 'Last 30 days', sub: 'vs the 30 days before' },
  { key: '90d', label: 'Last 90 days', sub: 'vs the 90 days before' },
];

const COMPONENT_COLOR: Record<VarianceComponentKey, string> = {
  cost: '#A32D2D',
  price: '#1F5FA8',
  mix: '#854F0B',
};

/**
 * Variance attribution — the "why is food cost high" panel. Decomposes the
 * change in realized gross margin into cost inflation, selling price and sales
 * mix (these three sum exactly to the drift), and reports WasteWatch cost
 * alongside as its own drag, since waste never touches invoice-line COGS.
 */
export function VariancePanel({ windows, hasWasteData }: VariancePanelProps) {
  const [win, setWin] = useState<VarianceWindowKey>('90d');
  const v = windows[win];
  const meta = WINDOWS.find((w) => w.key === win)!;

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEF1F5] px-5 py-4">
        <div className="min-w-0">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Why your margin moved</h2>
          <p className="mt-0.5 text-[12px] text-[#8A8E86]">{meta.label} {meta.sub} — price vs cost vs mix, with waste alongside</p>
        </div>
        <div className="inline-flex shrink-0 rounded-[10px] border border-[#EEF1F5] bg-[#F6F8FB] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWin(w.key)}
              className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                win === w.key
                  ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]'
                  : 'text-[#8A8E86] hover:text-[#174C87]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {!v.hasData ? (
        <div className="p-5">
          <div className="rounded-2xl border border-dashed border-[#EAEDF2] bg-white px-8 py-12 text-center">
            <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Not enough history to attribute yet</h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#8A8E86]">
              This needs costed sales in both {meta.label.toLowerCase()} and the window before it. Invoice orders in
              OrderFlow and keep product costs current in ProcurePulse, and the breakdown fills itself in.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-5">
          {/* Headline: baseline margin → current margin */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <Figure label="Baseline margin" value={fmtPct(v.baseMarginPct)} sub={`${zar(v.baseRevenue)} costed sales`} />
            <span aria-hidden className="pb-6 text-[18px] text-[#C7C9C5]">→</span>
            <Figure label="Current margin" value={fmtPct(v.currentMarginPct)} sub={`${zar(v.currentRevenue)} costed sales`} />
            <div className="pb-1">
              <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Drift</div>
              <div
                className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]"
                style={{ color: v.driftPts >= 0 ? '#0F6E56' : '#A32D2D' }}
              >
                {pts(v.driftPts)}
              </div>
            </div>
          </div>

          {/* The three effects — they sum exactly to the drift */}
          <div className="mt-5 flex flex-col gap-3">
            {v.components.map((c) => (
              <EffectRow key={c.key} label={c.label} note={c.note} value={c.pts} max={maxAbs(v)} color={COMPONENT_COLOR[c.key]} />
            ))}
            <div className="flex items-center gap-3 border-t border-[#F4F5F7] pt-3">
              <span className="w-[128px] shrink-0 text-[13px] font-semibold text-[#171A17]">Total drift</span>
              <span className="flex-1" />
              <span className="of-num w-[86px] shrink-0 text-right text-[14px] font-semibold" style={{ color: v.driftPts >= 0 ? '#0F6E56' : '#A32D2D' }}>
                {pts(v.driftPts)}
              </span>
            </div>
          </div>

          {/* Waste — deliberately outside the identity above */}
          <div className="mt-5 rounded-[14px] border border-[#EEF1F5] bg-[#FBFCFE] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[#171A17]">Waste, on top of the above</h3>
              <Link href="/app/wastelog" className="text-[12px] font-semibold text-[#1F5FA8] hover:underline">
                Open WasteWatch →
              </Link>
            </div>
            {!hasWasteData ? (
              <p className="mt-2 text-[13px] text-[#6B6F68]">
                No waste log connected yet. Logging waste in WasteWatch adds the missing piece — the food cost that never
                reaches an invoice line.
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MiniStat label="Waste cost (window)" value={zar(v.waste.currentCost)} />
                  <MiniStat
                    label="As % of costed sales"
                    value={v.waste.currentPts != null ? `${v.waste.currentPts.toFixed(1)}%` : '—'}
                    color={v.waste.currentPts != null && v.waste.currentPts > 0 ? '#A32D2D' : undefined}
                  />
                  <MiniStat
                    label="Change vs baseline"
                    value={v.waste.driftPts != null ? pts(-v.waste.driftPts) : '—'}
                    color={v.waste.driftPts == null ? undefined : v.waste.driftPts > 0 ? '#A32D2D' : '#0F6E56'}
                  />
                </div>
                <p className="mt-3 text-[12px] text-[#6B6F68]">
                  Margin after waste is charged against revenue:{' '}
                  <span className="of-num font-semibold text-[#171A17]">{fmtPct(v.marginAfterWastePct)}</span>. Waste cost
                  is not in the invoice-line costs above, so it is shown separately rather than folded into the split.
                </p>
              </>
            )}
          </div>

          {/* Biggest single cost movements */}
          {v.topCostDrivers.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Biggest cost movements</h3>
              <div className="mt-2 overflow-hidden rounded-[14px] border border-[#EEF1F5]">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-2 bg-[#FBFCFE] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                  <span>Product</span>
                  <span className="text-right">Unit cost</span>
                  <span className="text-right">Extra spend</span>
                  <span className="text-right">Margin</span>
                </div>
                {v.topCostDrivers.map((d) => (
                  <div key={d.key} className="grid grid-cols-[1.6fr_1fr_1fr_auto] items-center gap-2 border-t border-[#F4F5F7] px-4 py-3 text-[14px]">
                    <span className="min-w-0 truncate font-semibold text-[#171A17]">{d.label}</span>
                    <span className="of-num text-right text-[#6B6F68]">
                      {zar2(d.fromUnitCost)} <span className="text-[#A0A49C]">→</span>{' '}
                      <span className="font-semibold text-[#171A17]">{zar2(d.toUnitCost)}</span>
                    </span>
                    <span className="of-num text-right font-semibold text-[#A32D2D]">+{zar(d.costDelta)}</span>
                    <span className="of-num w-[74px] text-right text-[#A32D2D]">{pts(d.pts)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[12px] text-[#A0A49C]">
            Derived from invoiced sales and each product&rsquo;s recorded cost. Cost, price and mix are computed on the
            current window&rsquo;s quantities and sum exactly to the drift; products with no baseline sales land in mix
            only. {Math.round(v.coveragePct)}% of current costed revenue comes from products that also sold in the
            baseline window.
          </p>
        </div>
      )}
    </div>
  );
}

function maxAbs(v: VarianceAttribution): number {
  return Math.max(1, ...v.components.map((c) => Math.abs(c.pts)), Math.abs(v.driftPts));
}

function fmtPct(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(1)}%`;
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{value}</div>
      <div className="of-num mt-1.5 text-[12px] text-[#A0A49C]">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[10px] border border-[#EAEDF2] bg-white px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-1 text-[16px] font-semibold leading-none text-[#171A17]" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

/** A signed bar growing left or right of a centre line, so gains and losses read instantly. */
function EffectRow({ label, note, value, max, color }: { label: string; note: string; value: number; max: number; color: string }) {
  const frac = Math.min(1, Math.abs(value) / max);
  const width = `${Math.max(value === 0 ? 0 : 2, frac * 50)}%`;
  const positive = value >= 0;
  return (
    <div className="flex items-start gap-3">
      <div className="w-[128px] shrink-0">
        <div className="text-[13px] font-semibold text-[#171A17]">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[#A0A49C]">{note}</div>
      </div>
      <div className="relative mt-2 h-2.5 flex-1 rounded-full bg-[#F4F5F7]">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-[#E2E6EC]" aria-hidden />
        <div
          className="absolute top-0 h-2.5 rounded-full"
          style={{ width, backgroundColor: positive ? '#0F6E56' : color, left: positive ? '50%' : undefined, right: positive ? undefined : '50%' }}
        />
      </div>
      <span
        className="of-num mt-1 w-[86px] shrink-0 text-right text-[14px] font-semibold"
        style={{ color: positive ? '#0F6E56' : color }}
      >
        {pts(value)}
      </span>
    </div>
  );
}
