'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Badge, ModuleWidgetCard } from '@/components/platform/module-ui';
import { widgetsFor, type ModuleWidget } from '@/lib/platform/module-widgets';
import {
  EMPLOYEE_STATUS_STYLE,
  COVERAGE_STYLE,
  ATTENDANCE_STYLE,
  SWAP_STATUS_META,
  overviewStats,
  departmentSnapshots,
  type DepartmentName,
  type EmployeeStatus,
  type CoverageStatus,
  type AttendanceStatus,
  type ShiftConflict,
  type SwapStatus,
} from '@/lib/platform/shiftboard';
import { useShiftBoard } from './context';

// ---------------------------------------------------------------------------
// Form + overlay primitives (one Vyso form language across the module)
// ---------------------------------------------------------------------------

export const FIELD_CLASS =
  'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-3.5 text-[14px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

export const BTN_PRIMARY =
  'inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50';

export const BTN_SECONDARY =
  'inline-flex h-[42px] items-center justify-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-50';

export const BTN_DANGER =
  'inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#A32D2D] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#8a2626] disabled:cursor-not-allowed disabled:opacity-50';

/** Portals mount outside the platform subtree, so re-declare the type + radius. */
export const MODAL_STYLE = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

/** Never-changing store: the portal mount flag only ever flips server → client. */
const subscribeNever = () => () => {};

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-[12px] font-medium text-[#6B6F68]">{children}</label>;
}

/** Centred modal shell — Escape to close, click-outside to close. */
export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  // SSR guard for createPortal: false while server-rendering / hydrating, true on
  // the client. useSyncExternalStore rather than a setState-in-effect so the rule
  // against cascading renders holds (same two-pass result, no extra render).
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="of-display text-[18px] font-semibold text-[#171A17]">{title}</h2>
            {subtitle ? <p className="mt-1 text-[13px] text-[#6B6F68]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[18px] text-[#A0A49C] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** The module's one no-data treatment — dashed panel, title, hint, optional CTA. */
export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
      <p className="of-display text-[16px] font-semibold text-[#171A17]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#6B6F68]">{hint}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  const m = SWAP_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

/** Small green/amber justification chips used by the cover shortlist. */
export function MatchChip({ text, tone }: { text: string; tone: 'good' | 'warn' }) {
  const s = tone === 'good' ? { bg: '#E1F5EE', fg: '#0F6E56' } : { bg: '#FBEEDA', fg: '#854F0B' };
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      {text}
    </span>
  );
}

export function DeptBadge({ department }: { department: DepartmentName }) {
  const { deptColor } = useShiftBoard();
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[#6B6F68]">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: deptColor(department) }} />
      {department}
    </span>
  );
}

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  const s = EMPLOYEE_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'Working' ? 'animate-pulse' : ''}`} style={{ backgroundColor: s.fg }} />
      {status}
    </span>
  );
}

export function CoverageBadge({ status }: { status: CoverageStatus }) {
  const s = COVERAGE_STYLE[status];
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>;
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const s = ATTENDANCE_STYLE[status];
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{status}</span>;
}

export function ConflictBadge({ conflict }: { conflict: ShiftConflict }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FCEBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#A32D2D]" title={conflict}>
      <span className="text-[9px]">▲</span>
      {conflict}
    </span>
  );
}

/** Simple 0–5 skill rating as filled dots. */
export function SkillStars({ rating, color = '#3E7BC4' }: { rating: number; color?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: i < rating ? color : '#EAEDF2' }} />
      ))}
    </span>
  );
}

export function MobileSnapshotCards({ onAction }: { onAction?: (label: string) => void }) {
  const sb = useShiftBoard();
  // Override the static registry values with the org's live numbers so the
  // companion-app preview matches the page KPIs.
  const stats = overviewStats(sb);
  const snaps = departmentSnapshots(sb.employees, sb.departments);
  const worstShort = snaps.filter((s) => s.status === 'short').sort((a, b) => b.required - b.working - (a.required - a.working))[0];
  const pendingLeave = sb.leave.filter((l) => l.status === 'Pending').length;
  const override: Record<string, Partial<ModuleWidget>> = {
    'shift-working': { value: String(stats.working), subtitle: `of ${stats.rostered} rostered` },
    'shift-open': { value: String(stats.openShifts) },
    'shift-ot': { value: String(stats.overtimeRisk) },
    'shift-attendance': { value: String(stats.attendanceIssues) },
    'shift-dispatch': worstShort
      ? { title: `${worstShort.name} short today`, value: `−${worstShort.required - worstShort.working}`, subtitle: `${worstShort.working} of ${worstShort.required}` }
      : { title: 'Departments', value: 'Covered', subtitle: 'all on target' },
    'shift-leave': { value: String(pendingLeave) },
  };
  return (
    <div>
      <h2 className="of-display mb-2.5 text-[16px] font-semibold text-[#171A17]">Mobile snapshot — widgets the companion app will surface</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {widgetsFor('shiftboard').map((w) => (
          <ModuleWidgetCard key={w.id} widget={{ ...w, ...override[w.id] }} onAction={(widget) => onAction?.(widget.actionLabel ?? widget.title)} />
        ))}
      </div>
    </div>
  );
}
