'use client';

import type { ReactNode } from 'react';
import { Badge, type Tone } from '@/components/platform/module-ui';
import { MODULE_META, VYSO_MODULE_KEYS, type VysoModuleKey } from '@/lib/platform/module-meta';
import type { InsightSeverity, ReportStatus } from '@/lib/platform/insightgen-data';

// ---------------------------------------------------------------------------
// Palette (platform tokens — see .ai/pain-point-solutions.md)
// ---------------------------------------------------------------------------

export const INK = '#171A17';
export const MUTE = '#6B6F68';
export const FAINT = '#8A8E86';
export const ACCENT = '#3E7BC4';
export const PRIMARY = '#1F5FA8';
export const GREEN = '#0F6E56';
export const AMBER = '#854F0B';
export const RED = '#A32D2D';
export const INFO = '#0C447C';

export const SEV_COLOR: Record<InsightSeverity, string> = {
  critical: RED,
  warning: AMBER,
  positive: GREEN,
  info: INFO,
};
export const SEV_TONE: Record<InsightSeverity, Tone> = {
  critical: 'critical',
  warning: 'warning',
  positive: 'positive',
  info: 'info',
};
export const SEV_LABEL: Record<InsightSeverity, string> = {
  critical: 'Critical',
  warning: 'Watch',
  positive: 'Positive',
  info: 'Info',
};

export const STATUS_TONE: Record<ReportStatus, Tone> = { ready: 'positive', scheduled: 'info', draft: 'neutral' };
export const STATUS_LABEL: Record<ReportStatus, string> = { ready: 'Ready', scheduled: 'Scheduled', draft: 'Draft' };

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Rand, no cents — the repo-wide money format. */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')}`;
}
export function signedPct(n: number, dp = 1): string {
  const v = Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);
  return `${v >= 0 ? '+' : ''}${v}%`;
}
export function pct(n: number | null | undefined, dp = 1): string {
  if (n == null) return '—';
  return `${Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)}%`;
}

export function asModuleKey(s: string): VysoModuleKey | null {
  return (VYSO_MODULE_KEYS as string[]).includes(s) ? (s as VysoModuleKey) : null;
}
export function moduleName(s: string): string {
  const k = asModuleKey(s);
  return k ? MODULE_META[k].name : s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}
export function reportModules(mods: string[]): string {
  if (mods.length === 0) return '—';
  if (mods.includes('all')) return 'All modules';
  return mods.map(moduleName).join(' · ');
}
/** yyyy-mm-dd from an ISO timestamp; em-dash when absent. */
export function dateLabel(ts: string | null | undefined): string {
  if (!ts) return '—';
  return ts.split('T')[0] ?? '—';
}
/** "Friday 24 Jul" for a yyyy-mm-dd day. */
export function dayLabel(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
/** "computed 14:32" — an honest stamp instead of the old hard-coded "2m ago". */
export function timeLabel(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** The dashed empty panel every InsightGen view falls back to. */
export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-[#FBFCFE] px-6 py-12 text-center">
      <p className="of-display text-[18px] font-semibold text-[#171A17]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">{hint}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SeverityDot({ severity }: { severity: InsightSeverity }) {
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEV_COLOR[severity] }} />;
}

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  return <Badge label={SEV_LABEL[severity]} tone={SEV_TONE[severity]} />;
}

/** Pill filter used by the insights + reports tabs. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[32px] items-center rounded-full border px-3.5 text-[13px] font-medium transition-all ${
        active
          ? 'border-transparent bg-[#1F5FA8] text-white'
          : 'border-[#E2E6EC] bg-white text-[#3E4A57] hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]'
      }`}
    >
      {children}
    </button>
  );
}

/** Small ghost button — "Export CSV", "Acknowledge", "Run now". */
export function GhostButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[32px] items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** A labelled line inside the Daily Ops Brief. */
export function BriefRow({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F4F5F7] py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#171A17]">{label}</div>
        {sub ? <div className="mt-0.5 text-[12px] text-[#8A8E86]">{sub}</div> : null}
      </div>
      <div className="of-num shrink-0 text-[15px] font-semibold" style={{ color: color ?? INK }}>
        {value}
      </div>
    </div>
  );
}

/** Tiny inline sparkline for the brief/overview trend cards. */
export function Sparkline({ data, color = ACCENT, height = 34 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const w = 100;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
