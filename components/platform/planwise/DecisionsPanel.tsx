'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zar } from '@/lib/platform/orderflow';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { SectionCard, Badge } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import {
  REC_STATUS_LABEL,
  PRIORITY_STYLE,
  nextRecStatus,
  type PlanDecision,
  type RecStatus,
} from '@/lib/platform/planwise';
import { usePlanWise } from './context';

const STATUS_TONE: Record<RecStatus, 'warning' | 'info' | 'positive'> = {
  open: 'warning',
  in_progress: 'info',
  done: 'positive',
};

const SETUP_SQL = `-- supabase/demo-fresh-valley/10-planwise-decisions-schema.sql`;

/**
 * Recommended decisions.
 *
 * Two kinds of row live here. A SUGGESTION is derived this request from measured
 * data (overspend vs pace, unpaid invoices, waste, margin gap) and disappears the
 * moment the underlying number is fixed. Starting to track one writes it to
 * `pw_decisions`, at which point it becomes a real task with a status that
 * survives reloads — the difference between "the dashboard mentioned it" and
 * "we decided to do it".
 */
export function DecisionsPanel() {
  const router = useRouter();
  const { org } = usePlatform();
  const { decisions, decisionsNeedSetup } = usePlanWise();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tracked = decisions.filter((d) => d.rowId != null);
  const suggested = decisions.filter((d) => d.rowId == null);
  const openImpact = decisions.filter((d) => d.status !== 'done').reduce((s, d) => s + Math.max(0, d.impactValue), 0);
  const doneCount = tracked.filter((d) => d.status === 'done').length;

  async function track(d: PlanDecision) {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusyKey(d.key);
    setError(null);
    const { error: err } = await supabase.from('pw_decisions').insert({
      org_id: org.id,
      decision_key: d.key,
      module: d.module,
      action: d.action,
      impact: d.impact,
      impact_value: d.impactValue,
      priority: d.priority,
      status: 'open',
      because: d.because,
      sort_order: tracked.length,
    });
    setBusyKey(null);
    if (err) {
      setError(/pw_decisions|does not exist/i.test(err.message) ? 'Run the PlanWise decisions SQL once, then try again.' : err.message);
      return;
    }
    router.refresh();
  }

  async function cycle(d: PlanDecision) {
    const supabase = createClient();
    if (!supabase || !d.rowId) return;
    setBusyKey(d.key);
    setError(null);
    const { error: err } = await supabase
      .from('pw_decisions')
      .update({ status: nextRecStatus(d.status), updated_at: new Date().toISOString() })
      .eq('id', d.rowId);
    setBusyKey(null);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  async function drop(d: PlanDecision) {
    const supabase = createClient();
    if (!supabase || !d.rowId) return;
    setBusyKey(d.key);
    setError(null);
    const { error: err } = await supabase.from('pw_decisions').delete().eq('id', d.rowId);
    setBusyKey(null);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  if (decisions.length === 0) {
    return (
      <SectionCard title="Recommended decisions">
        <div className="rounded-[14px] border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-10 text-center">
          <p className="of-display text-[16px] font-semibold text-[#171A17]">Nothing needs a decision right now</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[#6B6F68]">
            Every measured line is inside its plan. PlanWise will raise a decision here the moment a category drifts,
            an invoice goes unpaid or margin slips below target.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Recommended decisions"
      right={
        <span className="text-[12px] text-[#8A8E86]">
          up to <span className="of-num font-semibold text-[#0F6E56]">+{zar(openImpact)}</span> open
          {doneCount > 0 ? (
            <>
              {' '}
              · <span className="of-num font-semibold text-[#0F6E56]">{doneCount}</span> done
            </>
          ) : null}
        </span>
      }
    >
      {decisionsNeedSetup ? (
        <div className="mb-4 rounded-[14px] border border-[#FBEEDA] bg-[#FFFBF4] px-4 py-3">
          <p className="text-[13px] text-[#7A6A4F]">
            <span className="font-semibold text-[#854F0B]">Decisions are not persisted yet.</span> Run{' '}
            <code className="of-num rounded bg-white px-1.5 py-0.5 text-[12px] text-[#6B6F68]">{SETUP_SQL}</code> once in
            the Supabase SQL editor to start tracking them.
          </p>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-[13px] text-[#A32D2D]">{error}</p> : null}

      {tracked.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {tracked.map((d) => (
            <Card key={d.key} d={d} busy={busyKey === d.key} onStatus={() => cycle(d)} onDrop={() => drop(d)} />
          ))}
        </div>
      ) : null}

      {suggested.length > 0 ? (
        <div className={tracked.length > 0 ? 'mt-5 border-t border-[#EEF1F5] pt-5' : ''}>
          <div className="mb-2.5 flex items-center gap-2">
            <h3 className="of-display text-[13px] font-semibold text-[#171A17]">Suggested by PlanWise</h3>
            <span className="text-[12px] text-[#A0A49C]">from this month&rsquo;s measured data — track one to make it a task</span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {suggested.map((d) => (
              <Card key={d.key} d={d} busy={busyKey === d.key} onTrack={() => track(d)} />
            ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function Card({
  d,
  busy,
  onStatus,
  onTrack,
  onDrop,
}: {
  d: PlanDecision;
  busy: boolean;
  onStatus?: () => void;
  onTrack?: () => void;
  onDrop?: () => void;
}) {
  const m = MODULE_META[d.module];
  const ps = PRIORITY_STYLE[d.priority];
  const done = d.status === 'done';
  return (
    <div
      className={`flex items-center gap-4 rounded-[14px] border p-4 transition-shadow hover:shadow-sm ${
        done ? 'border-[#E1F5EE] bg-[#FBFEFD]' : 'border-[#EEF1F5] bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: m.accent.bg, color: m.accent.fg }}>
            {m.name}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: ps.bg, color: ps.fg }}>
            {ps.label} priority
          </span>
          {onStatus ? (
            <button type="button" onClick={onStatus} disabled={busy} title="Change status" className="disabled:opacity-50">
              <Badge label={REC_STATUS_LABEL[d.status]} tone={STATUS_TONE[d.status]} />
            </button>
          ) : (
            <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[11px] font-medium text-[#6B6F68]">Suggestion</span>
          )}
        </div>
        <div className={`mt-2 text-[14px] font-medium ${done ? 'text-[#6B6F68] line-through' : 'text-[#171A17]'}`}>{d.action}</div>
        {d.because ? <div className="mt-1 text-[12px] text-[#8A8E86]">{d.because}</div> : null}
        <div className="of-num mt-1 text-[13px] font-semibold" style={{ color: d.impactValue > 0 ? '#0F6E56' : '#6B6F68' }}>
          {d.impact} impact
        </div>
        {onDrop ? (
          <button type="button" onClick={onDrop} disabled={busy} className="mt-1.5 text-[11px] font-medium text-[#A0A49C] transition-colors hover:text-[#A32D2D] disabled:opacity-50">
            Stop tracking
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        {onTrack ? (
          <button
            type="button"
            onClick={onTrack}
            disabled={busy}
            className="inline-flex h-[38px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Track this'}
          </button>
        ) : null}
        <Link href={m.route} className="inline-flex h-[38px] items-center rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]">
          Review →
        </Link>
      </div>
    </div>
  );
}
