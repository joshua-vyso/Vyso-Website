'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { RowActionsMenu, useToast } from '@/components/platform/orderflow/ui';
import { Badge, DataTable, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import {
  CREDIT_ISSUE_LABEL,
  type CreditStatus,
  type SupplierCredit,
  type SupplierRebate,
} from '@/lib/platform/supplysync-credits';
import { useSupplySync } from './context';
import { Field, ModalShell, fieldClass } from './CreditModals';
import {
  zar,
  fmtDate,
  EmptyState,
  CreditStatusBadge,
  RebateStatusBadge,
  REBATE_STATUS_META,
  ProgressBar,
  SupplierNameButton,
  RED,
  AMBER,
  GREEN,
  ACCENT,
  MUTE,
} from './shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Age colouring: the longer a supplier holds the money, the hotter it reads. */
function ageColor(days: number): string {
  if (days >= 60) return RED;
  if (days >= 30) return AMBER;
  return MUTE;
}

function toNumber(v: string): number {
  const n = Number(v.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function todayISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

/** Which settlement a row is being closed with. */
type Settlement = 'credited' | 'written_off';

// ---------------------------------------------------------------------------
// Rebate card
// ---------------------------------------------------------------------------

function RebateCard({ rebate, onRecord }: { rebate: SupplierRebate; onRecord: (id: string) => void }) {
  const meta = REBATE_STATUS_META[rebate.status];
  const barColor = rebate.status === 'missed' ? RED : rebate.progressPct >= 100 ? GREEN : ACCENT;
  return (
    <article
      className="rounded-2xl border border-[#EAEDF2] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]"
      style={{ borderLeft: `3px solid ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="of-display text-[15px] font-semibold text-[#171A17]">{rebate.name}</h3>
          <p className="mt-0.5 text-[12px] text-[#A0A49C]">
            {rebate.supplierId ? (
              <SupplierNameButton id={rebate.supplierId} name={rebate.supplierName} className="text-[12px]" />
            ) : (
              rebate.supplierName
            )}
            {' · '}
            {rebate.basis === 'percent' ? `${rebate.ratePct ?? 0}% of spend` : `Flat ${zar(rebate.flatAmount ?? 0)}`}
            {' · '}
            {rebate.period}
          </p>
        </div>
        <RebateStatusBadge status={rebate.status} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Received</div>
          <div className="of-num mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">
            {zar(rebate.receivedTotal)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Expected</div>
          <div className="of-num mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em]" style={{ color: MUTE }}>
            {zar(rebate.expectedAmount)}
          </div>
        </div>
      </div>

      <div className="mt-2.5">
        <ProgressBar pct={rebate.progressPct} color={barColor} />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#8A8E86]">
          <span className="of-num">{rebate.progressPct}% of the agreement</span>
          <span className="of-num" style={{ color: rebate.outstanding > 0 ? AMBER : GREEN }}>
            {rebate.outstanding > 0 ? `${zar(rebate.outstanding)} outstanding` : 'Settled in full'}
          </span>
        </div>
      </div>

      <div className="mt-2.5 text-[12px] text-[#A0A49C]">
        {rebate.periodStart || rebate.periodEnd ? (
          <span className="of-num">
            {fmtDate(rebate.periodStart)} → {fmtDate(rebate.periodEnd)}
          </span>
        ) : (
          <span>No period set</span>
        )}
        {rebate.expectedIsEstimated ? ' · expected value estimated from the rate and average spend' : null}
        {rebate.thresholdSpend ? ` · qualifies above ${zar(rebate.thresholdSpend)}` : null}
      </div>

      {rebate.receipts.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-[#EEF1F5] pt-2.5">
          {rebate.receipts.slice(0, 3).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-[12px] text-[#6B6F68]">
              <span className="of-num">{fmtDate(r.receivedOn)}{r.reference ? ` · ${r.reference}` : ''}</span>
              <span className="of-num font-medium text-[#171A17]">{zar(r.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => onRecord(rebate.id)}
        className="mt-3 inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
      >
        Record receipt
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Credits & rebates workspace
// ---------------------------------------------------------------------------

export function CreditsTab() {
  const ss = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();
  const { node: toastNode, show } = useToast();

  // Optimistic status overrides, keyed by credit id (same idiom as the risk register).
  const [statusOverride, setStatusOverride] = useState<Record<string, CreditStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Settle modal (local — it only ever opens from this table).
  const [settleTarget, setSettleTarget] = useState<SupplierCredit | null>(null);
  const [settlement, setSettlement] = useState<Settlement>('credited');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(todayISO());
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const effectiveStatus = (c: SupplierCredit): CreditStatus => statusOverride[c.id] ?? c.status;

  const openCredits = useMemo(
    () => ss.credits.filter((c) => effectiveStatus(c) === 'claimed' || effectiveStatus(c) === 'acknowledged'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ss.credits, statusOverride],
  );

  async function patchCredit(credit: SupplierCredit, patch: Record<string, unknown>, next: CreditStatus, confirmMsg: string) {
    const prev = statusOverride[credit.id];
    setStatusOverride((m) => ({ ...m, [credit.id]: next })); // optimistic
    setSavingId(credit.id);

    const revert = () =>
      setStatusOverride((m) => {
        const copy = { ...m };
        if (prev === undefined) delete copy[credit.id];
        else copy[credit.id] = prev;
        return copy;
      });

    const supabase = createClient();
    if (!supabase || !org) {
      revert();
      setSavingId(null);
      show('Not connected — the change was not saved.');
      return;
    }

    const { error } = await supabase
      .from('ss_supplier_credits')
      .update({ ...patch, status: next, updated_at: new Date().toISOString() })
      .eq('id', credit.id)
      .eq('org_id', org.id);

    setSavingId(null);
    if (error) {
      revert();
      show(error.message);
      return;
    }

    show(confirmMsg);
    // Drop the override so refreshed server truth shows through.
    setStatusOverride((m) => {
      const copy = { ...m };
      delete copy[credit.id];
      return copy;
    });
    router.refresh();
  }

  function openSettle(credit: SupplierCredit, mode: Settlement) {
    setSettleTarget(credit);
    setSettlement(mode);
    setSettleAmount(mode === 'credited' ? String(credit.amount) : '0');
    setSettleDate(todayISO());
    setSettleError(null);
    setSettleSaving(false);
  }

  async function submitSettle() {
    if (!settleTarget || settleSaving) return;
    setSettleSaving(true);
    setSettleError(null);

    const supabase = createClient();
    if (!supabase || !org) {
      setSettleError('Not connected — the settlement was not saved.');
      setSettleSaving(false);
      return;
    }

    const credited = toNumber(settleAmount);
    const { error } = await supabase
      .from('ss_supplier_credits')
      .update({
        status: settlement,
        amount_credited: credited,
        resolved_on: settleDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settleTarget.id)
      .eq('org_id', org.id);

    setSettleSaving(false);
    if (error) {
      setSettleError(error.message);
      return;
    }

    const label = settlement === 'credited' ? `Credited ${zar(credited)}` : 'Claim written off';
    setSettleTarget(null);
    show(label);
    router.refresh();
  }

  function creditActions(c: SupplierCredit) {
    const status = effectiveStatus(c);
    const busy = savingId === c.id;
    if (status === 'claimed') {
      return [
        {
          label: busy ? 'Saving…' : 'Mark acknowledged',
          onClick: () => patchCredit(c, { acknowledged_on: todayISO() }, 'acknowledged', 'Supplier acknowledged the claim'),
        },
        { label: 'Settle as credited', onClick: () => openSettle(c, 'credited') },
        { label: 'Write off', onClick: () => openSettle(c, 'written_off'), danger: true },
      ];
    }
    if (status === 'acknowledged') {
      return [
        { label: busy ? 'Saving…' : 'Settle as credited', onClick: () => openSettle(c, 'credited') },
        { label: 'Write off', onClick: () => openSettle(c, 'written_off'), danger: true },
      ];
    }
    return [
      {
        label: busy ? 'Saving…' : 'Reopen claim',
        onClick: () => patchCredit(c, { resolved_on: null, amount_credited: null }, 'claimed', 'Claim reopened'),
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Empty state — no supply base at all
  // -------------------------------------------------------------------------
  if (ss.isEmpty) {
    return (
      <EmptyState
        title="No suppliers yet"
        hint="Add a supplier first — credit claims and rebate agreements are tracked against the supply base."
      />
    );
  }

  const rollup = ss.creditRollup;
  const rebateRollup = ss.rebateRollup;

  const creditRows: ReactNode[][] = ss.credits.map((c) => {
    const status = effectiveStatus(c);
    return [
      c.supplierId ? (
        <SupplierNameButton id={c.supplierId} name={c.supplierName} />
      ) : (
        <span className="text-[#6B6F68]">{c.supplierName}</span>
      ),
      <div key="issue">
        <div className="text-[#171A17]">{CREDIT_ISSUE_LABEL[c.issueType]}</div>
        <div className="mt-0.5 text-[12px] text-[#A0A49C]">
          {c.item || 'Unspecified item'}
          {c.reference ? ` · ${c.reference}` : ''}
        </div>
      </div>,
      <span key="desc" className="text-[#6B6F68]">{c.description || '—'}</span>,
      <span key="amt" className="of-num font-semibold text-[#171A17]">{zar(c.amount)}</span>,
      <span key="cred" className="of-num" style={{ color: c.amountCredited != null ? GREEN : MUTE }}>
        {c.amountCredited != null ? zar(c.amountCredited) : '—'}
      </span>,
      <CreditStatusBadge key="status" status={status} />,
      <span key="age" className="of-num font-medium" style={{ color: ageColor(c.ageDays) }}>
        {c.ageDays}d
      </span>,
      <span key="owner" className="text-[#6B6F68]">{c.owner ?? 'Unassigned'}</span>,
      <div key="act" className="flex justify-end">
        <RowActionsMenu actions={creditActions(c)} />
      </div>,
    ];
  });

  return (
    <div className="space-y-5">
      {/* 1) Money at stake */}
      <KpiStrip>
        <Kpi
          label="Unresolved credits"
          value={zar(rollup.unresolvedTotal)}
          accent={rollup.unresolvedTotal > 0 ? RED : undefined}
          sub={`${rollup.unresolvedCount} claim${rollup.unresolvedCount === 1 ? '' : 's'} outstanding`}
        />
        <Kpi
          label="Oldest unresolved"
          value={rollup.oldestUnresolvedDays > 0 ? `${rollup.oldestUnresolvedDays}d` : '—'}
          accent={rollup.oldestUnresolvedDays >= 30 ? AMBER : undefined}
          sub="Since the claim was raised"
        />
        <Kpi label="Recovered" value={zar(rollup.creditedTotal)} accent={rollup.creditedTotal > 0 ? GREEN : undefined} sub="Credited back to date" />
        <Kpi
          label="Recovery rate"
          value={`${rollup.recoveryRate}%`}
          accent={rollup.recoveryRate >= 80 ? GREEN : rollup.recoveryRate > 0 ? AMBER : undefined}
          sub="Of settled claims"
        />
        <Kpi
          label="Rebates outstanding"
          value={zar(rebateRollup.outstandingTotal)}
          accent={rebateRollup.outstandingTotal > 0 ? AMBER : undefined}
          sub={`${rebateRollup.agreementCount} agreement${rebateRollup.agreementCount === 1 ? '' : 's'}`}
        />
        <Kpi
          label="Rebates received"
          value={zar(rebateRollup.receivedTotal)}
          accent={rebateRollup.receivedTotal > 0 ? GREEN : undefined}
          sub={rebateRollup.overdueCount > 0 ? `${rebateRollup.overdueCount} period(s) missed` : 'Against expected'}
        />
      </KpiStrip>

      {/* 2) Credit & dispute register */}
      <SectionCard
        title="Credit & dispute tracker"
        right={
          <div className="flex items-center gap-2">
            <Badge
              label={`${openCredits.length} unresolved`}
              tone={openCredits.length > 0 ? 'warning' : 'positive'}
            />
            <button
              type="button"
              onClick={() => ss.openCredit()}
              className="inline-flex h-9 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
            >
              + Log credit
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[12px] text-[#6B6F68]">
          Short-ships, substitutions, quality rejects and price errors, tracked claimed → acknowledged → credited or
          written off. Unresolved claims are money the supplier is still holding.
        </p>
        {ss.credits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-10 text-center">
            <p className="of-display text-[16px] font-semibold text-[#171A17]">No credit claims logged</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[#6B6F68]">
              Log the next short-ship or quality reject as it happens and SupplySync will keep the running total of what
              each supplier still owes — instead of it living in a WhatsApp thread.
            </p>
          </div>
        ) : (
          <DataTable
            columns={[
              { label: 'Supplier' },
              { label: 'Issue' },
              { label: 'What happened' },
              { label: 'Claimed', align: 'right' },
              { label: 'Credited', align: 'right' },
              { label: 'Status' },
              { label: 'Age', align: 'right' },
              { label: 'Chased by' },
              { label: 'Actions', align: 'right' },
            ]}
            rows={creditRows}
            empty="No credit claims logged."
          />
        )}
      </SectionCard>

      {/* 3) Rebate agreements */}
      <SectionCard
        title="Rebate tracker"
        right={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#A0A49C]">Expected vs received</span>
            <button
              type="button"
              onClick={() => ss.openRebate()}
              className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
            >
              + Add agreement
            </button>
          </div>
        }
      >
        {ss.rebates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-10 text-center">
            <p className="of-display text-[16px] font-semibold text-[#171A17]">No rebate agreements recorded</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[#6B6F68]">
              Volume and growth rebates leak because nobody checks what arrived against what was agreed. Record an
              agreement and every receipt gets measured against it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ss.rebates.map((r) => (
              <RebateCard key={r.id} rebate={r} onRecord={ss.openReceipt} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Settle-credit modal */}
      {settleTarget ? (
        <ModalShell
          title={settlement === 'credited' ? 'Settle as credited' : 'Write off claim'}
          subtitle={`${settleTarget.supplierName} · ${zar(settleTarget.amount)} claimed`}
          onClose={() => setSettleTarget(null)}
          onSubmit={submitSettle}
          submitLabel={settlement === 'credited' ? 'Mark credited' : 'Write off'}
          saving={settleSaving}
          error={settleError}
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Amount credited (R)">
              <input
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                inputMode="decimal"
                className={fieldClass()}
              />
            </Field>
            <Field label="Settled on">
              <input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className={fieldClass()} />
            </Field>
          </div>
          <p className="text-[12px] text-[#6B6F68]">
            {settlement === 'credited'
              ? 'Record what the supplier actually credited — a partial credit is common, and the gap is the number worth arguing about.'
              : 'Writing off closes the claim without recovery. It stays on the record so the supplier’s settlement history stays honest.'}
          </p>
        </ModalShell>
      ) : null}

      {toastNode}
    </div>
  );
}
