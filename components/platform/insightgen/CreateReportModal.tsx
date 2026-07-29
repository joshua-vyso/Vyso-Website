'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { MODULE_META, type VysoModuleKey } from '@/lib/platform/module-meta';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useInsightGen } from './context';

/** Modal wrapper tokens the platform uses for every portal dialog. */
const MODAL_STYLE = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

export const REPORT_SCOPES = ['Company', 'Finance', 'Operations', 'Procurement', 'Sales'];
export const REPORT_MODULES: VysoModuleKey[] = [
  'docu',
  'procurepulse',
  'pricepilot',
  'planwise',
  'wastewatch',
  'shiftboard',
  'supplysync',
  'orderflow',
];

/**
 * Saves a cross-module report DEFINITION to ig_reports. The definition is what
 * the Reports tab then runs for real: modules chosen here select which raw
 * datasets the run pulls and exports.
 */
export function CreateReportModal() {
  const { closeCreate, datasets } = useInsightGen();
  const { org } = usePlatform();
  const router = useRouter();
  const [name, setName] = useState('');
  const [scope, setScope] = useState(REPORT_SCOPES[0]);
  const [schedule, setSchedule] = useState('weekly');
  const [modules, setModules] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Modules InsightGen can actually query rows for right now. */
  const liveModules = new Set(datasets.filter((d) => d.rows.length > 0).map((d) => d.module as string));

  // The chrome only mounts this component while the modal is open, so the state
  // above is already fresh on every open — no reset effect, and no mount latch
  // before the portal (a click is what renders it, long after hydration).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) closeCreate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeCreate, busy]);

  function toggleModule(m: string) {
    setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function save() {
    const n = name.trim();
    if (!n) {
      setError('Give the report a name.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('ig_reports').insert({
      org_id: org.id,
      name: n,
      scope,
      modules: modules.length ? modules : ['all'],
      schedule,
      status: 'ready',
      owner: 'You',
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    closeCreate();
    router.refresh();
  }

  const input =
    'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={() => !busy && closeCreate()} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[460px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Create report</h2>
            <p className="mt-1 text-[13px] text-[#6B6F68]">A saved cross-module report definition you can run and export.</p>
          </div>
          <button
            type="button"
            onClick={closeCreate}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#171A17]">Report name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
              placeholder="e.g. Weekly business brief"
              className={input}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={input}>
              {REPORT_SCOPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className={input}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-[#171A17]">
              Modules <span className="font-normal text-[#8A8E86]">(none = all)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_MODULES.map((m) => {
                const live = liveModules.has(m);
                const on = modules.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModule(m)}
                    title={live ? 'Rows available to export' : 'No rows for this org yet'}
                    className={`inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-all ${
                      on
                        ? 'border-transparent bg-[#1F5FA8] text-white'
                        : 'border-[#E2E6EC] bg-white text-[#3E4A57] hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]'
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: live ? (on ? '#FFFFFF' : '#0F6E56') : on ? 'rgba(255,255,255,0.45)' : '#D8DFE8' }}
                    />
                    {MODULE_META[m].name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-[#8A8E86]">A green dot means InsightGen already has raw rows to export for that module.</p>
          </div>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeCreate}
            disabled={busy}
            className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Create report'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
