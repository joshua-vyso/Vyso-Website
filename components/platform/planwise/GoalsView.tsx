'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { MODULE_META, type VysoModuleKey } from '@/lib/platform/module-meta';
import type { PlTargets } from '@/lib/platform/pricepilot';
import { zar } from '@/lib/platform/orderflow';
import { goalTone, goalToneColor } from '@/lib/platform/planwise';
import { GoalsDashboard } from './GoalsDashboard';
import { usePlanWise } from './context';

type FieldKey = 'monthly_revenue_target' | 'monthly_gross_profit_target' | 'monthly_opex' | 'target_margin_pct';

const REAL_FIELDS: { key: FieldKey; label: string; adorn: string; side: 'left' | 'right'; help: string; module: VysoModuleKey; used: string }[] = [
  { key: 'monthly_revenue_target', label: 'Revenue goal', adorn: 'R', side: 'left', help: 'Total sales you aim to bill each month.', module: 'orderflow', used: 'Measured from OrderFlow sales' },
  { key: 'monthly_gross_profit_target', label: 'Desired monthly profit', adorn: 'R', side: 'left', help: 'Gross profit you aim to keep each month.', module: 'pricepilot', used: 'Tracked against PricePilot margins' },
  { key: 'monthly_opex', label: 'Maximum expenses', adorn: 'R', side: 'left', help: 'Operating-cost ceiling — rent, salaries, transport, etc.', module: 'procurepulse', used: 'Spend visibility from ProcurePulse & Doc-U' },
  { key: 'target_margin_pct', label: 'Target gross margin', adorn: '%', side: 'right', help: 'Goal margin on selling prices.', module: 'pricepilot', used: 'Drives PricePilot pricing recommendations' },
];

/**
 * Strategic goals. These used to be UI-only placeholders; each one is now a real
 * `pw_goals` row whose CURRENT value PlanWise measures every request:
 *  - cash        → gross profit banked this month + receivables − overhead used to date
 *  - growth      → revenue this month vs the same days last month (like-for-like)
 *  - outstanding → unpaid invoices (of_invoices, else invoiced-not-paid orders)
 * `higherIsBetter: false` on outstanding makes a *lower* number the win.
 */
type StrategicKey = 'cash' | 'growth' | 'outstanding';

const STRATEGIC_GOALS: {
  key: StrategicKey;
  label: string;
  adorn: 'R' | '%';
  placeholder: string;
  module?: VysoModuleKey;
  used: string;
  higherIsBetter: boolean;
  sortOrder: number;
}[] = [
  { key: 'cash', label: 'Cash reserve target', adorn: 'R', placeholder: '300 000', used: 'Operational safety buffer', higherIsBetter: true, sortOrder: 10 },
  { key: 'growth', label: 'Growth target', adorn: '%', placeholder: '8', used: 'Month-on-month revenue growth', higherIsBetter: true, sortOrder: 11 },
  { key: 'outstanding', label: 'Outstanding invoice target', adorn: 'R', placeholder: '10 000', module: 'orderflow', used: 'Keep unpaid invoices below this', higherIsBetter: false, sortOrder: 12 },
];

const SETUP_SQL = `create table if not exists pl_targets (
  org_id uuid primary key references organisations(id) on delete cascade,
  target_margin_pct numeric,
  monthly_revenue_target numeric,
  monthly_gross_profit_target numeric,
  monthly_opex numeric,
  updated_at timestamptz not null default now()
);
alter table pl_targets add column if not exists monthly_opex numeric;
alter table pl_targets enable row level security;
drop policy if exists pl_targets_all on pl_targets;
create policy pl_targets_all on pl_targets for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));`;

function toStr(n: number | null | undefined) {
  return n == null ? '' : String(n);
}

export function GoalsView({ initial, needsSetup }: { initial: PlTargets | null; needsSetup: boolean }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { goals, actuals } = usePlanWise();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    monthly_revenue_target: toStr(initial?.monthly_revenue_target),
    monthly_gross_profit_target: toStr(initial?.monthly_gross_profit_target),
    monthly_opex: toStr(initial?.monthly_opex),
    target_margin_pct: toStr(initial?.target_margin_pct),
  });

  // The measured "where we are now" for each strategic goal. null = not
  // measurable yet (no sales / no invoices), which reads as "—" rather than 0.
  const measured: Record<StrategicKey, number | null> = {
    cash: actuals.hasSales ? actuals.cashReserve : null,
    growth: actuals.growthPct,
    outstanding: actuals.outstanding > 0 ? actuals.outstanding : null,
  };

  const [strategic, setStrategic] = useState<Record<StrategicKey, string>>(() => {
    const seed = (k: StrategicKey) => {
      const g = goals.find((x) => x.id === k);
      return g && g.target ? String(Math.round(g.target)) : '';
    };
    return { cash: seed('cash'), growth: seed('growth'), outstanding: seed('outstanding') };
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategicBusy, setStrategicBusy] = useState(false);
  const [strategicSaved, setStrategicSaved] = useState(false);
  const [strategicError, setStrategicError] = useState<string | null>(null);

  function parse(v: string): number | null {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const fmt = (k: StrategicKey, n: number | null) => {
    if (n == null) return '—';
    const f = STRATEGIC_GOALS.find((g) => g.key === k);
    return f?.adorn === '%' ? `${n.toFixed(1)}%` : zar(n);
  };

  /**
   * Persist the strategic targets as real `pw_goals` rows so every other view
   * (and every other module) reads them from one place. Updated in place when
   * the row already exists; inserted with the measured current value otherwise.
   */
  async function saveStrategic() {
    const supabase = createClient();
    if (!supabase || !org) {
      setStrategicError('Not signed in.');
      return;
    }
    setStrategicBusy(true);
    setStrategicError(null);
    setStrategicSaved(false);

    for (const f of STRATEGIC_GOALS) {
      const target = parse(strategic[f.key]);
      if (target == null) continue;
      const existing = goals.find((g) => g.id === f.key);
      const current = measured[f.key] ?? existing?.current ?? 0;
      const res = existing?.rowId
        ? await supabase.from('pw_goals').update({ target, current, label: f.label, unit: f.adorn, higher_is_better: f.higherIsBetter }).eq('id', existing.rowId)
        : await supabase.from('pw_goals').insert({
            org_id: org.id,
            goal_key: f.key,
            label: f.label,
            target,
            current,
            unit: f.adorn,
            higher_is_better: f.higherIsBetter,
            module: f.module ?? null,
            trend: [],
            sort_order: f.sortOrder,
          });
      if (res.error) {
        setStrategicError(res.error.message);
        setStrategicBusy(false);
        return;
      }
    }
    setStrategicBusy(false);
    setStrategicSaved(true);
    router.refresh();
  }

  async function save() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not signed in.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const patch = {
      org_id: org.id,
      monthly_revenue_target: parse(values.monthly_revenue_target),
      monthly_gross_profit_target: parse(values.monthly_gross_profit_target),
      monthly_opex: parse(values.monthly_opex),
      target_margin_pct: parse(values.target_margin_pct),
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase.from('pl_targets').upsert(patch, { onConflict: 'org_id' });
    if (upErr) {
      setError(/relation .* does not exist|pl_targets/i.test(upErr.message) ? 'Run the one-time SQL shown above, then try again.' : upErr.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  const inputBox = 'mt-1.5 flex h-11 items-center rounded-[12px] border border-[#E4E9F0] bg-white px-4 transition-colors focus-within:border-[#3E7BC4]';
  const inputEl = 'of-num w-full bg-transparent text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C]';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Goals</h1>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">Define where you want the business to go. Vyso measures progress against these across every module.</p>
      </div>

      <GoalsDashboard />

      <div className="border-t border-[#EEF1F5] pt-5">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Set your goals</h2>
        <p className="mt-1 text-[13px] text-[#6B6F68]">These power the progress above and feed the modules that act on them.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
      {needsSetup ? (
        <div className="rounded-2xl border border-[#FBEEDA] bg-[#FFFBF4] p-5">
          <h2 className="of-display text-[15px] font-semibold text-[#854F0B]">One-time setup needed</h2>
          <p className="mt-1 text-[13px] text-[#7A6A4F]">Paste this once in the Supabase SQL editor, then fill in your goals below.</p>
          <pre className="mt-3 overflow-x-auto rounded-[14px] border border-[#EEDFBF] bg-white p-4 text-[12px] leading-relaxed text-[#6B6F68]">{SETUP_SQL}</pre>
        </div>
      ) : null}

      {/* Core goals — persisted to pl_targets (the shared store other modules read) */}
      <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="border-b border-[#EEF1F5] px-5 py-4">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Core goals</h2>
          <p className="mt-1 text-[13px] text-[#8A8E86]">Saved to your workspace and read by the modules that act on them. Leave any blank to skip it.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          {REAL_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-[13px] font-medium text-[#171A17]">{f.label}</span>
              <div className={inputBox}>
                {f.side === 'left' ? <span className="mr-2 text-[14px] text-[#8A8E86]">{f.adorn}</span> : null}
                <input inputMode="decimal" value={values[f.key]} onChange={(e) => { setValues((v) => ({ ...v, [f.key]: e.target.value })); setSaved(false); }} placeholder="—" className={inputEl} />
                {f.side === 'right' ? <span className="ml-2 text-[14px] text-[#8A8E86]">{f.adorn}</span> : null}
              </div>
              <span className="mt-1.5 block text-[12px] text-[#A0A49C]">{f.help}</span>
              <Link href={MODULE_META[f.module].route} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: MODULE_META[f.module].accent.fg }}>
                {f.used} →
              </Link>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-[#EEF1F5] px-5 py-4">
          <button type="button" onClick={save} disabled={busy} className="inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50">
            {busy ? 'Saving…' : 'Save goals'}
          </button>
          {saved ? <span className="text-[13px] font-medium text-[#0F6E56]">✓ Saved</span> : null}
          {error ? <span className="text-[13px] text-[#A32D2D]">{error}</span> : null}
        </div>
      </div>

      {/* Strategic goals — persisted to pw_goals; "now" is measured every request */}
      <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="border-b border-[#EEF1F5] px-5 py-4">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Strategic goals</h2>
          <p className="mt-1 text-[13px] text-[#8A8E86]">
            Saved to your plan. The &ldquo;now&rdquo; figure under each one is measured from live sales, invoices and costs —
            day <span className="of-num">{actuals.pace.day}</span> of <span className="of-num">{actuals.pace.days}</span> of {actuals.pace.monthLabel}.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
          {STRATEGIC_GOALS.map((g) => {
            const now = measured[g.key];
            const target = parse(strategic[g.key]);
            const hit = now != null && target != null && (g.higherIsBetter ? now >= target : now <= target);
            const pct =
              now != null && target != null && target !== 0
                ? Math.max(0, Math.min(120, Math.round((g.higherIsBetter ? now / target : target / Math.max(1, now)) * 100)))
                : null;
            return (
              <label key={g.key} className="block">
                <span className="text-[13px] font-medium text-[#171A17]">{g.label}</span>
                <div className={inputBox}>
                  {g.adorn === 'R' ? <span className="mr-2 text-[14px] text-[#8A8E86]">R</span> : null}
                  <input
                    inputMode="decimal"
                    value={strategic[g.key]}
                    onChange={(e) => {
                      setStrategic((m) => ({ ...m, [g.key]: e.target.value }));
                      setStrategicSaved(false);
                    }}
                    placeholder={g.placeholder}
                    className={inputEl}
                  />
                  {g.adorn === '%' ? <span className="ml-2 text-[14px] text-[#8A8E86]">%</span> : null}
                </div>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="text-[#8A8E86]">now</span>
                  <span className="of-num font-semibold" style={{ color: now == null ? '#A0A49C' : hit ? '#0F6E56' : '#854F0B' }}>
                    {fmt(g.key, now)}
                  </span>
                  {pct != null ? (
                    <span className="of-num rounded-full px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${goalToneColor(goalTone(pct))}1A`, color: goalToneColor(goalTone(pct)) }}>
                      {pct}%
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[12px] text-[#A0A49C]">
                  {g.module ? (
                    <Link href={MODULE_META[g.module].route} className="font-medium" style={{ color: MODULE_META[g.module].accent.fg }}>
                      {g.used} →
                    </Link>
                  ) : (
                    g.used
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#EEF1F5] px-5 py-4">
          <button type="button" onClick={saveStrategic} disabled={strategicBusy} className="inline-flex h-[42px] items-center justify-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50">
            {strategicBusy ? 'Saving…' : 'Save strategic goals'}
          </button>
          {strategicSaved ? <span className="text-[13px] font-medium text-[#0F6E56]">✓ Saved</span> : null}
          {strategicError ? <span className="text-[13px] text-[#A32D2D]">{strategicError}</span> : null}
          <span className="text-[12px] text-[#A0A49C]">Progress rings above update on save.</span>
        </div>
      </div>
      </div>
      <GoalsSidePanel />
      </div>
    </div>
  );
}

function GoalsSidePanel() {
  const links: { goal: string; module: VysoModuleKey; note: string }[] = [
    { goal: 'Revenue goal', module: 'orderflow', note: 'Measured against your OrderFlow sales' },
    { goal: 'Profit & margin', module: 'pricepilot', note: 'PricePilot flags products below target' },
    { goal: 'Expense ceiling', module: 'procurepulse', note: 'Spend visibility from ProcurePulse & Doc-U' },
  ];
  return (
    <div className="h-fit rounded-2xl border border-[#EAEDF2] bg-[#FBFCFE] p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] lg:sticky lg:top-6">
      <h3 className="of-display text-[16px] font-semibold text-[#171A17]">How Vyso uses your goals</h3>
      <p className="mt-1 text-[13px] text-[#6B6F68]">Your goals become the benchmark every module measures against — and they feed the forecast and scenarios.</p>
      <div className="mt-4 flex flex-col gap-3">
        {links.map((l) => {
          const m = MODULE_META[l.module];
          return (
            <div key={l.goal} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: m.accent.bg, color: m.accent.fg }}>{m.name}</span>
              <span className="text-[12px] text-[#6B6F68]">{l.note}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-[14px] border border-[#EEF1F5] bg-white p-3.5 text-[12px] text-[#6B6F68]">
        Set these once — PlanWise keeps measuring and tells you exactly what needs to change.
      </div>
    </div>
  );
}
