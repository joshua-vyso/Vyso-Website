'use client';

import type { ReactNode } from 'react';
import { Badge, DataTable } from '@/components/platform/module-ui';
import type { CrossSupplierItem, PriceChangeAlert } from '@/lib/platform/supplysync-pricing';
import { useSupplySync } from './context';
import {
  zar,
  zar2,
  fmtDate,
  changeColor,
  signedPct,
  PriceDelta,
  PRICE_SEVERITY_META,
  PRICE_SOURCE_META,
  IMPACT_BASIS_META,
  SupplierNameButton,
  RED,
  GREEN,
  MUTE,
} from './shared';

// ---------------------------------------------------------------------------
// Summary maths (shared by the Overview strip and the Pricing tab)
// ---------------------------------------------------------------------------

export interface PriceChangeSummary {
  /** Alerts whose price went UP. */
  increases: number;
  decreases: number;
  /** Annualised rand the increases add, at the volumes behind them. */
  annualExposure: number;
  /** Annualised rand the decreases give back. */
  annualRelief: number;
  /** Net annual effect (+ = costing more). */
  netAnnual: number;
  /** True when at least one figure rests on real invoice volume. */
  anyMeasured: boolean;
  highCount: number;
}

export function summarisePriceChanges(alerts: PriceChangeAlert[]): PriceChangeSummary {
  let increases = 0;
  let decreases = 0;
  let annualExposure = 0;
  let annualRelief = 0;
  let anyMeasured = false;
  let highCount = 0;
  for (const a of alerts) {
    if (a.changePct > 0) {
      increases += 1;
      annualExposure += Math.max(0, a.annualImpact);
    } else if (a.changePct < 0) {
      decreases += 1;
      annualRelief += Math.abs(Math.min(0, a.annualImpact));
    }
    if (a.impactBasis === 'measured') anyMeasured = true;
    if (a.severity === 'high') highCount += 1;
  }
  return {
    increases,
    decreases,
    annualExposure: Math.round(annualExposure),
    annualRelief: Math.round(annualRelief),
    netAnnual: Math.round(annualExposure - annualRelief),
    anyMeasured,
    highCount,
  };
}

/** Annualised impact, signed and tinted (+ costs more, − gives back). */
export function AnnualImpact({ alert }: { alert: PriceChangeAlert }) {
  const up = alert.annualImpact > 0;
  const color = alert.annualImpact === 0 ? MUTE : up ? RED : GREEN;
  return (
    <span className="of-num font-semibold whitespace-nowrap" style={{ color }}>
      {alert.annualImpact === 0 ? '—' : `${up ? '+' : '−'}${zar(Math.abs(alert.annualImpact))}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Compact list — Overview
// ---------------------------------------------------------------------------

/**
 * The top price moves as tappable rows. Deliberately terse: supplier, item,
 * old → new, and what it costs over a year — the four things that decide
 * whether anyone picks up the phone.
 */
export function PriceChangeList({ alerts, limit = 5 }: { alerts: PriceChangeAlert[]; limit?: number }) {
  const { openProfile } = useSupplySync();
  const rows = alerts.slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-[#6B6F68]">
        No supplier price moves detected — every tracked line is holding.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {rows.map((a) => {
        const sev = PRICE_SEVERITY_META[a.severity];
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => a.supplierId && openProfile(a.supplierId)}
            className="flex w-full items-start gap-2.5 rounded-[11px] px-2.5 py-2.5 text-left transition-colors hover:bg-[#F5F9FE]"
          >
            <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sev.color }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] leading-snug text-[#2C333B]">
                <span className="font-medium text-[#171A17]">{a.supplierName || 'Supplier'}</span>
                {' · '}
                {a.item}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <PriceDelta from={a.oldPrice} to={a.newPrice} />
                <span className="of-num font-medium" style={{ color: changeColor(a.changePct) }}>
                  {signedPct(a.changePct)}
                </span>
                <span className="text-[#8A8E86]">
                  <AnnualImpact alert={a} />
                  <span className="ml-1">a year</span>
                </span>
              </span>
            </span>
            <span className="shrink-0">
              <Badge label={PRICE_SOURCE_META[a.source].label} tone={a.source === 'invoice' ? 'info' : 'neutral'} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full table — Pricing tab
// ---------------------------------------------------------------------------

export function PriceChangeTable({ alerts }: { alerts: PriceChangeAlert[] }) {
  const rows: ReactNode[][] = alerts.map((a) => {
    const sev = PRICE_SEVERITY_META[a.severity];
    const basis = IMPACT_BASIS_META[a.impactBasis];
    return [
      <div key="item">
        <div className="font-semibold text-[#171A17]">{a.item}</div>
        <div className="mt-0.5 text-[12px] text-[#A0A49C]">
          {a.category || 'Uncategorised'}
          {a.unit ? ` · per ${a.unit}` : ''}
        </div>
      </div>,
      a.supplierId ? (
        <SupplierNameButton key="sup" id={a.supplierId} name={a.supplierName || 'Supplier'} />
      ) : (
        <span key="sup" className="text-[#6B6F68]">{a.supplierName || '—'}</span>
      ),
      <PriceDelta key="delta" from={a.oldPrice} to={a.newPrice} />,
      <span key="pct" className="of-num font-medium" style={{ color: changeColor(a.changePct) }}>
        {signedPct(a.changePct)}
      </span>,
      <div key="impact" className="text-right">
        <AnnualImpact alert={a} />
        <div className="mt-0.5 text-[11px] text-[#A0A49C]">
          <span className="of-num">{a.annualUnits.toLocaleString('en-ZA')}</span> {a.unit || 'unit'}/yr · {basis.label}
        </div>
      </div>,
      <Badge key="src" label={PRICE_SOURCE_META[a.source].label} tone={a.source === 'invoice' ? 'info' : 'neutral'} />,
      <span key="seen" className="of-num text-[#6B6F68]">{fmtDate(a.observedOn)}</span>,
      <Badge key="sev" label={sev.label} tone={sev.tone} />,
    ];
  });

  return (
    <DataTable
      columns={[
        { label: 'Item' },
        { label: 'Supplier' },
        { label: 'Old → new' },
        { label: 'Change', align: 'right' },
        { label: 'Annualised impact', align: 'right' },
        { label: 'Source' },
        { label: 'Seen' },
        { label: 'Severity' },
      ]}
      rows={rows}
      empty="No price moves detected yet."
    />
  );
}

// ---------------------------------------------------------------------------
// Cross-supplier comparison — equivalent items priced by several suppliers
// ---------------------------------------------------------------------------

export function CrossSupplierTable({ items }: { items: CrossSupplierItem[] }) {
  const rows: ReactNode[][] = items.map((it) => [
    <div key="item">
      <div className="font-semibold text-[#171A17]">{it.label}</div>
      <div className="mt-0.5 text-[12px] text-[#A0A49C]">
        {it.category || 'Uncategorised'}
        {it.unit ? ` · per ${it.unit}` : ''} · <span className="of-num">{it.offers.length}</span> suppliers
      </div>
    </div>,
    <div key="cheap" className="flex flex-col items-start gap-1">
      {it.cheapest.supplierId ? (
        <SupplierNameButton id={it.cheapest.supplierId} name={it.cheapest.supplierName || 'Supplier'} />
      ) : (
        <span className="text-[#6B6F68]">{it.cheapest.supplierName || '—'}</span>
      )}
      <span className="of-num text-[13px] font-semibold" style={{ color: GREEN }}>{zar2(it.cheapest.price)}</span>
    </div>,
    <div key="dear" className="flex flex-col items-start gap-1">
      {it.dearest.supplierId ? (
        <SupplierNameButton id={it.dearest.supplierId} name={it.dearest.supplierName || 'Supplier'} />
      ) : (
        <span className="text-[#6B6F68]">{it.dearest.supplierName || '—'}</span>
      )}
      <span className="of-num text-[13px] font-semibold" style={{ color: RED }}>{zar2(it.dearest.price)}</span>
    </div>,
    <span key="spread" className="of-num font-medium" style={{ color: it.spreadPct >= 8 ? RED : MUTE }}>
      {signedPct(it.spreadPct)}
    </span>,
    <span key="save" className="of-num font-semibold" style={{ color: it.potentialAnnualSaving ? GREEN : MUTE }}>
      {it.potentialAnnualSaving ? zar(it.potentialAnnualSaving) : '—'}
    </span>,
  ]);

  return (
    <DataTable
      columns={[
        { label: 'Item' },
        { label: 'Cheapest supplier' },
        { label: 'Dearest supplier' },
        { label: 'Spread', align: 'right' },
        { label: 'Annual saving if switched', align: 'right' },
      ]}
      rows={rows}
      empty="No item is priced by more than one supplier yet."
    />
  );
}
