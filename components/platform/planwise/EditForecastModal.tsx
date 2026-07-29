'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { zar } from '@/lib/platform/orderflow';
import { forecastTone, type ForecastLine } from '@/lib/platform/planwise';

const MODAL_STYLE = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

function toStr(n: number) {
  return Number.isFinite(n) ? String(Math.round(n)) : '';
}
function parse(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Edit one forecast line (`pw_forecast`).
 *
 * A forecast is a judgement call, so the owner has to be able to override it —
 * the point of PlanWise is that the number on screen is the number the business
 * is actually planning to. Tone and trend are re-derived from the saved value vs
 * target rather than stored blind, so an edited card can't stay green while it
 * sits under its target.
 *
 * Rendered only while a line is selected, and keyed on that line, so opening a
 * different card REMOUNTS this with fresh initial state. That is why there is no
 * reset-on-open effect: the fields are seeded once from props and then owned by
 * the user, which is both simpler and avoids the cascading render an effectful
 * reset would cause.
 */
export function EditForecastModal({
  line,
  onClose,
  onSaved,
}: {
  line: ForecastLine;
  onClose: () => void;
  onSaved: (label: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => toStr(line.value));
  const [target, setTarget] = useState(() => toStr(line.target));
  const [low, setLow] = useState(() => toStr(line.rangeLow));
  const [high, setHigh] = useState(() => toStr(line.rangeHigh));
  const [confidence, setConfidence] = useState(() => Math.max(0, Math.min(100, Math.round(line.confidence))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function save() {
    const v = parse(value);
    const t = parse(target);
    if (v == null) {
      setError('Enter a forecast value.');
      return;
    }
    if (!line.rowId) {
      setError('This forecast line has no saved row yet.');
      return;
    }
    const lo = parse(low);
    const hi = parse(high);
    if (lo != null && hi != null && lo > hi) {
      setError('The low end of the range must be below the high end.');
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const nextTarget = t ?? line.target;
    const { tone, trend } = forecastTone({ id: line.id, value: v, target: nextTarget });
    const { error: err } = await supabase
      .from('pw_forecast')
      .update({
        value: v,
        target: nextTarget,
        range_low: lo ?? Math.round(v * 0.94),
        range_high: hi ?? Math.round(v * 1.06),
        confidence,
        tone,
        trend,
      })
      .eq('id', line.rowId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved(line.label);
    onClose();
    router.refresh();
  }

  // Only ever mounted from a click, so `document` is guaranteed — but guard
  // anyway so the component can never blow up if it is rendered on the server.
  if (typeof document === 'undefined') return null;

  const input =
    'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
  const preview = parse(value);
  const previewTarget = parse(target) ?? line.target;
  const gap = preview != null ? preview - previewTarget : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[460px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="of-display text-[18px] font-semibold tracking-[-0.015em] text-[#171A17]">Edit {line.label.toLowerCase()}</h2>
            <p className="mt-1 text-[13px] text-[#8A8E86]">Override what PlanWise projects for the rest of the month.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[18px] text-[#A0A49C] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]">
            ✕
          </button>
        </div>

        {line.measured != null ? (
          <p className="mt-3 rounded-[10px] bg-[#F5F9FE] px-3.5 py-2.5 text-[12px] text-[#6B6F68]">
            Measured so far this month: <span className="of-num font-semibold text-[#171A17]">{zar(line.measured)}</span>
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Forecast (R)</label>
              <input
                autoFocus
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                inputMode="decimal"
                placeholder="0"
                className={`${input} of-num`}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Target (R)</label>
              <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="0" className={`${input} of-num`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Range low (R)</label>
              <input value={low} onChange={(e) => setLow(e.target.value)} inputMode="decimal" placeholder="auto" className={`${input} of-num`} />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Range high (R)</label>
              <input value={high} onChange={(e) => setHigh(e.target.value)} inputMode="decimal" placeholder="auto" className={`${input} of-num`} />
            </div>
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-[13px] font-medium text-[#171A17]">
              <span>Confidence</span>
              <span className="of-num text-[#6B6F68]">{confidence}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-[#1F5FA8]"
            />
          </div>

          {gap != null ? (
            <p className="text-[12px] text-[#8A8E86]">
              That lands{' '}
              <span className="of-num font-semibold" style={{ color: gap >= 0 ? '#0F6E56' : '#A32D2D' }}>
                {gap >= 0 ? '+' : '−'}
                {zar(Math.abs(gap))}
              </span>{' '}
              against target.
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-black/[0.03] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60">
            {busy ? 'Saving…' : 'Save forecast'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
