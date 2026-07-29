'use client';

import { Badge, type Tone } from '@/components/platform/module-ui';
import { zar, zar2 } from '@/lib/platform/orderflow';
import { useSupplySync } from './context';
import type { CreditStatus, RebateStatus } from '@/lib/platform/supplysync-credits';
import type { ExpiryUrgency } from '@/lib/platform/supplysync-insights';
import type { ImpactBasis, PriceChangeSeverity, PriceChangeSource } from '@/lib/platform/supplysync-pricing';
import type {
  Supplier,
  SupplierStatus,
  SupplierRisk,
  SupplierDocumentStatus,
  SupplierRiskSeverity,
  SupplierRiskStatus,
  MarketPosition,
  SupplierComparison,
} from '@/lib/platform/supplysync-data';

export { zar, zar2 };

// ---------------------------------------------------------------------------
// Palette + score colours (calm blue/amber/red bands)
// ---------------------------------------------------------------------------

export const ACCENT = '#3E7BC4';
export const GREEN = '#0F6E56';
export const AMBER = '#854F0B';
export const RED = '#A32D2D';
export const PURPLE = '#5B53C0';
export const INK = '#171A17';
export const MUTE = '#6B6F68';
export const FAINT = '#8A8E86';

/** Score → colour band (0–100). */
export function scoreColor(n: number): string {
  if (n >= 85) return GREEN;
  if (n >= 72) return ACCENT;
  if (n >= 60) return AMBER;
  return RED;
}
export function scoreTone(n: number): Tone {
  if (n >= 85) return 'positive';
  if (n >= 72) return 'neutral';
  if (n >= 60) return 'warning';
  return 'critical';
}

/** Compact tinted score chip used across tables and cards. */
export function ScorePill({ value, suffix = '' }: { value: number; suffix?: string }) {
  const c = scoreColor(value);
  return (
    <span className="of-num inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ backgroundColor: `${c}1A`, color: c }}>
      {value}
      {suffix}
    </span>
  );
}

/** Larger score readout (profile header / scorecards). */
export function ScoreStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  const c = scoreColor(value);
  return (
    <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-3.5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]" style={{ color: c }}>{value}{suffix}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorical badges
// ---------------------------------------------------------------------------

export const SUPPLIER_STATUS_META: Record<SupplierStatus, { label: string; tone: Tone }> = {
  preferred: { label: 'Preferred', tone: 'positive' },
  active: { label: 'Active', tone: 'neutral' },
  review: { label: 'On review', tone: 'warning' },
};
export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const m = SUPPLIER_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const SUPPLIER_RISK_META: Record<SupplierRisk, { label: string; tone: Tone; color: string }> = {
  low: { label: 'Low risk', tone: 'positive', color: GREEN },
  medium: { label: 'Medium risk', tone: 'warning', color: AMBER },
  high: { label: 'High risk', tone: 'critical', color: RED },
};
export function SupplierRiskBadge({ risk }: { risk: SupplierRisk }) {
  const m = SUPPLIER_RISK_META[risk];
  return <Badge label={m.label} tone={m.tone} />;
}

export const DOC_STATUS_META: Record<SupplierDocumentStatus, { label: string; tone: Tone; color: string }> = {
  valid: { label: 'Valid', tone: 'positive', color: GREEN },
  expiring: { label: 'Expiring soon', tone: 'warning', color: AMBER },
  expired: { label: 'Expired', tone: 'critical', color: RED },
  missing: { label: 'Missing', tone: 'critical', color: RED },
};
export function DocStatusBadge({ status }: { status: SupplierDocumentStatus }) {
  const m = DOC_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const SEVERITY_META: Record<SupplierRiskSeverity, { label: string; tone: Tone; color: string }> = {
  low: { label: 'Low', tone: 'neutral', color: FAINT },
  medium: { label: 'Medium', tone: 'warning', color: AMBER },
  high: { label: 'High', tone: 'critical', color: RED },
  critical: { label: 'Critical', tone: 'critical', color: RED },
};
export function SeverityBadge({ severity }: { severity: SupplierRiskSeverity }) {
  const m = SEVERITY_META[severity];
  return <Badge label={m.label} tone={m.tone} />;
}

export const RISK_STATUS_META: Record<SupplierRiskStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'positive' },
  ignored: { label: 'Ignored', tone: 'neutral' },
};
export function RiskStatusBadge({ status }: { status: SupplierRiskStatus }) {
  const m = RISK_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const POSITION_META: Record<MarketPosition, { label: string; color: string }> = {
  below: { label: 'Below market', color: GREEN },
  at: { label: 'At market', color: MUTE },
  above: { label: 'Above market', color: RED },
};

/** Signed % vs market, coloured (cheaper = green, dearer = red). */
export function marketDiffColor(diffPct: number): string {
  if (diffPct <= -3) return GREEN;
  if (diffPct >= 3) return RED;
  return MUTE;
}

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px]" style={{ color: '#C9A227' }} aria-label={`${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ color: i < full ? '#C9A227' : '#E1E1DC' }}>★</span>
      ))}
    </span>
  );
}

/**
 * Canonical "click a supplier name to open its profile" affordance — one
 * treatment (ink text, module-accent hover) reused across every tab and drawer
 * so the same element never reads differently from screen to screen.
 */
export function SupplierNameButton({ id, name, className = '' }: { id: string; name: string; className?: string }) {
  const { openProfile } = useSupplySync();
  return (
    <button
      type="button"
      onClick={() => openProfile(id)}
      className={`text-left font-medium text-[#171A17] transition-colors hover:text-[#1F5FA8] hover:underline ${className}`}
    >
      {name}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Price-change alerts (Overview + Pricing)
// ---------------------------------------------------------------------------

export const PRICE_SEVERITY_META: Record<PriceChangeSeverity, { label: string; tone: Tone; color: string }> = {
  high: { label: 'High impact', tone: 'critical', color: RED },
  medium: { label: 'Watch', tone: 'warning', color: AMBER },
  low: { label: 'Minor', tone: 'neutral', color: MUTE },
};

export const PRICE_SOURCE_META: Record<PriceChangeSource, { label: string; hint: string }> = {
  invoice: { label: 'Invoice', hint: 'Read off a filed invoice — the price actually paid.' },
  price_list: { label: 'Price list', hint: 'From the tracked supplier price list.' },
};

export const IMPACT_BASIS_META: Record<ImpactBasis, { label: string; tone: Tone }> = {
  measured: { label: 'measured volume', tone: 'positive' },
  estimated: { label: 'estimated volume', tone: 'neutral' },
};

/** Rising price = red, falling = green, flat = muted. */
export function changeColor(changePct: number): string {
  if (changePct > 0.4) return RED;
  if (changePct < -0.4) return GREEN;
  return MUTE;
}

/** Signed percentage, one decimal — "+4.2%", "−1.5%". */
export function signedPct(value: number): string {
  const v = Math.round(value * 10) / 10;
  return `${v > 0 ? '+' : ''}${v}%`;
}

/** old → new, with the arrow tinted by direction. Cents matter on unit prices. */
export function PriceDelta({ from, to }: { from: number; to: number }) {
  const color = changeColor(from === 0 ? 0 : ((to - from) / from) * 100);
  return (
    <span className="of-num inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[#8A8E86] line-through">{zar2(from)}</span>
      <span style={{ color }}>→</span>
      <span className="font-semibold" style={{ color }}>{zar2(to)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Credits, rebates and document expiry
// ---------------------------------------------------------------------------

export const CREDIT_STATUS_META: Record<CreditStatus, { label: string; tone: Tone; color: string }> = {
  claimed: { label: 'Claimed', tone: 'warning', color: AMBER },
  acknowledged: { label: 'Acknowledged', tone: 'info', color: ACCENT },
  credited: { label: 'Credited', tone: 'positive', color: GREEN },
  written_off: { label: 'Written off', tone: 'neutral', color: MUTE },
};
export function CreditStatusBadge({ status }: { status: CreditStatus }) {
  const m = CREDIT_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const REBATE_STATUS_META: Record<RebateStatus, { label: string; tone: Tone; color: string }> = {
  agreed: { label: 'Agreed', tone: 'neutral', color: MUTE },
  accruing: { label: 'Accruing', tone: 'info', color: ACCENT },
  claimed: { label: 'Part received', tone: 'warning', color: AMBER },
  received: { label: 'Received', tone: 'positive', color: GREEN },
  missed: { label: 'Missed', tone: 'critical', color: RED },
};
export function RebateStatusBadge({ status }: { status: RebateStatus }) {
  const m = REBATE_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const EXPIRY_META: Record<ExpiryUrgency, { label: string; tone: Tone; color: string }> = {
  missing: { label: 'Missing', tone: 'critical', color: RED },
  expired: { label: 'Expired', tone: 'critical', color: RED },
  critical: { label: 'Expires soon', tone: 'warning', color: AMBER },
  soon: { label: 'Renewal due', tone: 'info', color: ACCENT },
};
export function ExpiryBadge({ urgency }: { urgency: ExpiryUrgency }) {
  const m = EXPIRY_META[urgency];
  return <Badge label={m.label} tone={m.tone} />;
}

/** Slim expected-vs-received bar used by the rebate tracker. */
export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF1F5]">
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: color, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </div>
  );
}

/** Short, calm date rendering — "3 Jul 2026" — or an em-dash. */
export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// History / relationship channel styling
// ---------------------------------------------------------------------------

export const CHANNELS = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Price Update', 'Document Request', 'Complaint', 'Delivery Issue'] as const;
export type Channel = (typeof CHANNELS)[number];

export function channelColor(channel: string | null): string {
  switch (channel) {
    case 'Call': return ACCENT;
    case 'WhatsApp': return GREEN;
    case 'Email': return '#3A4DB0';
    case 'Meeting': return PURPLE;
    case 'Price Update': return AMBER;
    case 'Document Request': return '#7C5BC0';
    case 'Complaint': return RED;
    case 'Delivery Issue': return RED;
    default: return FAINT;
  }
}

/** Human label + dot colour for a supplier-history event_type. */
export function eventMeta(eventType: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    document_uploaded: { label: 'Document uploaded', color: GREEN },
    price_list_received: { label: 'Price list received', color: AMBER },
    late_delivery: { label: 'Late delivery', color: RED },
    delivery_issue: { label: 'Delivery issue', color: RED },
    compliance_issue: { label: 'Compliance issue', color: RED },
    marked_preferred: { label: 'Marked preferred', color: GREEN },
    note_added: { label: 'Note added', color: ACCENT },
    order_linked: { label: 'Order linked (ProcurePulse)', color: PURPLE },
    call: { label: 'Call', color: ACCENT },
    whatsapp: { label: 'WhatsApp', color: GREEN },
    email: { label: 'Email', color: '#3A4DB0' },
    meeting: { label: 'Meeting', color: PURPLE },
    price_update: { label: 'Price update', color: AMBER },
    document_request: { label: 'Document request', color: '#7C5BC0' },
    complaint: { label: 'Complaint', color: RED },
  };
  return map[eventType] ?? { label: eventType.replace(/_/g, ' '), color: FAINT };
}

// ---------------------------------------------------------------------------
// Shared empty state
// ---------------------------------------------------------------------------

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
      <p className="of-display text-[16px] font-semibold text-[#171A17]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#6B6F68]">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison builder (used by the compare drawer)
// ---------------------------------------------------------------------------

export function buildComparison(suppliers: Supplier[]): SupplierComparison[] {
  if (suppliers.length === 0) return [];
  const maxOverall = Math.max(...suppliers.map((s) => s.scorecard.overall));
  const maxReliability = Math.max(...suppliers.map((s) => s.scorecard.reliability));
  return suppliers.map((s) => {
    const hasDocGap = s.docs.some((d) => d.status === 'missing' || d.status === 'expired');
    let recommendation: string;
    if (s.scorecard.compliance < 75 || hasDocGap || s.risk === 'high') recommendation = 'Compliance risk';
    else if (s.marketPosition === 'above' || s.priceTrend === 'rising') recommendation = 'Watch pricing';
    else if (s.scorecard.overall === maxOverall) recommendation = 'Best value';
    else if (s.scorecard.reliability === maxReliability) recommendation = 'Most reliable';
    else recommendation = 'Solid choice';
    return {
      supplierId: s.id,
      name: s.name,
      overall: s.scorecard.overall,
      reliability: s.scorecard.reliability,
      quality: s.scorecard.quality,
      delivery: s.scorecard.deliveryConsistency,
      priceStability: s.scorecard.priceStability,
      compliance: s.scorecard.compliance,
      pricePosition: s.marketPosition,
      lastIssue: s.lastIssue,
      recommendation,
    };
  });
}

export function recommendationTone(rec: string): Tone {
  if (rec === 'Best value') return 'positive';
  if (rec === 'Most reliable') return 'info';
  if (rec === 'Compliance risk') return 'critical';
  if (rec === 'Watch pricing') return 'warning';
  return 'neutral';
}
