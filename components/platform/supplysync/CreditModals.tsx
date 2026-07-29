'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import {
  CREDIT_ISSUE_LABEL,
  CREDIT_ISSUE_TYPES,
  REBATE_PERIODS,
  type CreditIssueType,
  type RebateBasis,
  type RebatePeriod,
} from '@/lib/platform/supplysync-credits';
import { useSupplySync } from './context';
import { RED } from './shared';

// ---------------------------------------------------------------------------
// Local form primitives — the same field language as the add-supplier wizard.
// Exported so the settle-credit modal on the Credits tab reuses them verbatim.
// ---------------------------------------------------------------------------

const ACCENT = '#1F5FA8';

export function fieldClass(): string {
  return 'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-[#6B6F68]">
        {label}
        {required ? <span className="ml-0.5 text-[#A32D2D]">*</span> : null}
      </label>
      {children}
    </div>
  );
}

/**
 * Portal modal shell — the platform modal idiom (instrument font + radius token
 * on the wrapper, scrim closes, footer actions).
 *
 * Only ever rendered while a modal is open, and a modal only opens from a
 * click, so this never runs during SSR and needs no mounted guard.
 */
export function ModalShell({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  saving,
  error,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  saving?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
    >
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative my-auto w-full max-w-[560px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="of-display text-[18px] font-semibold tracking-[-0.015em] text-[#171A17]">{title}</div>
            {subtitle ? <div className="mt-0.5 text-[13px] text-[#6B6F68]">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
          >
            ✕
          </button>
        </div>

        <div className="my-4 h-px w-full bg-[#EEF1F5]" />
        <div className="space-y-3.5">{children}</div>

        {error ? (
          <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ backgroundColor: `${RED}0F`, color: RED }}>
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EEF1F5] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || saving}
            className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            style={{ backgroundColor: ACCENT }}
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function todayISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

function toNumber(v: string): number {
  const n = Number(v.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** A credit claim is also an operational incident — this is the timeline event
 *  type it should leave behind, so measured performance reflects it. */
const ISSUE_EVENT_TYPE: Record<CreditIssueType, string | null> = {
  short_ship: 'delivery_issue',
  not_delivered: 'delivery_issue',
  substitution: 'delivery_issue',
  quality: 'complaint',
  damaged: 'complaint',
  price_error: null,
  other: null,
};

// ---------------------------------------------------------------------------
// Log a credit claim
// ---------------------------------------------------------------------------

/**
 * The toast has to outlive the form (it confirms the save that closed the
 * modal), so this wrapper stays mounted and only the FORM mounts on open —
 * which is also how every field re-arms itself with no reset effect: a fresh
 * mount is fresh initial state.
 */
export function LogCreditModal() {
  const ss = useSupplySync();
  const { node: toastNode, show } = useToast();
  return (
    <>
      {ss.creditOpen ? <LogCreditForm onSaved={show} /> : null}
      {toastNode}
    </>
  );
}

function LogCreditForm({ onSaved }: { onSaved: (msg: string) => void }) {
  const ss = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();

  const [supplierId, setSupplierId] = useState(ss.creditSupplierId ?? ss.suppliers[0]?.id ?? '');
  const [issueType, setIssueType] = useState<CreditIssueType>('short_ship');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [claimedOn, setClaimedOn] = useState(todayISO);
  const [owner, setOwner] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = toNumber(amount);
  const valid = supplierId.length > 0 && value > 0;

  async function submit() {
    if (!valid || saving) return;
    setError(null);
    setSaving(true);

    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected — reconnect to Supabase to log a credit.');
      setSaving(false);
      return;
    }

    const supplier = ss.supplierById(supplierId);
    const { error: insertErr } = await supabase.from('ss_supplier_credits').insert({
      org_id: org.id,
      supplier_id: supplierId,
      supplier_name: supplier?.name ?? null,
      issue_type: issueType,
      reference: reference.trim() || null,
      item: item.trim() || null,
      description: description.trim(),
      amount: value,
      status: 'claimed',
      claimed_on: claimedOn,
      owner: owner.trim() || null,
    });

    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }

    // Best-effort: put the incident on the relationship timeline too, so measured
    // performance counts it. A failure here must never lose the claim itself.
    const eventType = ISSUE_EVENT_TYPE[issueType];
    if (eventType) {
      await supabase.from('ss_supplier_history').insert({
        org_id: org.id,
        supplier_id: supplierId,
        event_type: eventType,
        summary: `${CREDIT_ISSUE_LABEL[issueType]} claim raised${reference.trim() ? ` on ${reference.trim()}` : ''} — R ${Math.round(value).toLocaleString('en-ZA')}`,
        event_date: claimedOn,
      });
    }

    setSaving(false);
    ss.closeCredit();
    onSaved(`Credit claim logged against ${supplier?.name ?? 'supplier'}`);
    router.refresh();
  }

  return (
    <ModalShell
      title="Log a credit claim"
      subtitle="Short-ship, substitution, quality reject or price error — tracked until the supplier settles it."
      onClose={ss.closeCredit}
      onSubmit={submit}
      submitLabel="Log claim"
      submitDisabled={!valid}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Supplier" required>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={fieldClass()}>
            {ss.suppliers.length === 0 ? <option value="">No suppliers yet</option> : null}
            {ss.suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Issue" required>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value as CreditIssueType)} className={fieldClass()}>
            {CREDIT_ISSUE_TYPES.map((t) => (
              <option key={t} value={t}>{CREDIT_ISSUE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount claimed (R)" required>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className={fieldClass()}
          />
        </Field>
        <Field label="Claimed on">
          <input type="date" value={claimedOn} onChange={(e) => setClaimedOn(e.target.value)} className={fieldClass()} />
        </Field>
        <Field label="Invoice / delivery-note ref">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. INV-10482" className={fieldClass()} />
        </Field>
        <Field label="Item">
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Oranges 10kg" className={fieldClass()} />
        </Field>
      </div>
      <Field label="What happened">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="6 boxes short on the Tuesday delivery; driver signed the discrepancy."
          className="w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 py-3 text-[14px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
      </Field>
      <Field label="Chased by">
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who is following it up" className={fieldClass()} />
      </Field>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Add a rebate agreement
// ---------------------------------------------------------------------------

export function RebateModal() {
  const ss = useSupplySync();
  const { node: toastNode, show } = useToast();
  return (
    <>
      {ss.rebateOpen ? <RebateForm onSaved={show} /> : null}
      {toastNode}
    </>
  );
}

function RebateForm({ onSaved }: { onSaved: (msg: string) => void }) {
  const ss = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();

  const [supplierId, setSupplierId] = useState(ss.rebateSupplierId ?? ss.suppliers[0]?.id ?? '');
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<RebateBasis>('percent');
  const [ratePct, setRatePct] = useState('');
  const [flatAmount, setFlatAmount] = useState('');
  const [threshold, setThreshold] = useState('');
  const [period, setPeriod] = useState<RebatePeriod>('quarterly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [expected, setExpected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    supplierId.length > 0 &&
    name.trim().length > 0 &&
    (basis === 'percent' ? toNumber(ratePct) > 0 : toNumber(flatAmount) > 0);

  async function submit() {
    if (!valid || saving) return;
    setError(null);
    setSaving(true);

    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected — reconnect to Supabase to record an agreement.');
      setSaving(false);
      return;
    }

    const supplier = ss.supplierById(supplierId);
    const { error: insertErr } = await supabase.from('ss_supplier_rebates').insert({
      org_id: org.id,
      supplier_id: supplierId,
      supplier_name: supplier?.name ?? null,
      name: name.trim(),
      basis,
      rate_pct: basis === 'percent' ? toNumber(ratePct) : null,
      flat_amount: basis === 'flat' ? toNumber(flatAmount) : null,
      threshold_spend: threshold.trim() ? toNumber(threshold) : null,
      period,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      expected_amount: expected.trim() ? toNumber(expected) : null,
      status: 'agreed',
    });

    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    ss.closeRebate();
    onSaved(`Rebate agreement saved for ${supplier?.name ?? 'supplier'}`);
    router.refresh();
  }

  return (
    <ModalShell
      title="Add a rebate agreement"
      subtitle="What was agreed, for which period — so what actually arrives can be checked against it."
      onClose={ss.closeRebate}
      onSubmit={submit}
      submitLabel="Save agreement"
      submitDisabled={!valid}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Supplier" required>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={fieldClass()}>
            {ss.suppliers.length === 0 ? <option value="">No suppliers yet</option> : null}
            {ss.suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Agreement name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 citrus volume rebate" className={fieldClass()} />
        </Field>
        <Field label="Basis" required>
          <select value={basis} onChange={(e) => setBasis(e.target.value as RebateBasis)} className={fieldClass()}>
            <option value="percent">Percentage of spend</option>
            <option value="flat">Flat amount</option>
          </select>
        </Field>
        {basis === 'percent' ? (
          <Field label="Rate (%)" required>
            <input value={ratePct} onChange={(e) => setRatePct(e.target.value)} inputMode="decimal" placeholder="2.5" className={fieldClass()} />
          </Field>
        ) : (
          <Field label="Flat amount (R)" required>
            <input value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)} inputMode="decimal" placeholder="15000" className={fieldClass()} />
          </Field>
        )}
        <Field label="Qualifying spend threshold (R)">
          <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" placeholder="Optional" className={fieldClass()} />
        </Field>
        <Field label="Period">
          <select value={period} onChange={(e) => setPeriod(e.target.value as RebatePeriod)} className={fieldClass()}>
            {REBATE_PERIODS.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </Field>
        <Field label="Period start">
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={fieldClass()} />
        </Field>
        <Field label="Period end">
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={fieldClass()} />
        </Field>
      </div>
      <Field label="Expected amount (R)">
        <input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          inputMode="decimal"
          placeholder="Leave blank to estimate from the rate and average spend"
          className={fieldClass()}
        />
      </Field>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Record a rebate receipt
// ---------------------------------------------------------------------------

const RECEIPT_METHODS = [
  { value: 'credit_note', label: 'Credit note' },
  { value: 'eft', label: 'EFT' },
  { value: 'invoice_discount', label: 'Invoice discount' },
  { value: 'other', label: 'Other' },
];

export function RebateReceiptModal() {
  const ss = useSupplySync();
  const { node: toastNode, show } = useToast();
  const rebate = ss.rebates.find((r) => r.id === ss.receiptRebateId) ?? null;
  return (
    <>
      {rebate ? <RebateReceiptForm rebateId={rebate.id} onSaved={show} /> : null}
      {toastNode}
    </>
  );
}

function RebateReceiptForm({ rebateId, onSaved }: { rebateId: string; onSaved: (msg: string) => void }) {
  const ss = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayISO);
  const [method, setMethod] = useState('credit_note');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rebate = ss.rebates.find((r) => r.id === rebateId);
  const value = toNumber(amount);

  async function submit() {
    if (value <= 0 || saving) return;
    setError(null);
    setSaving(true);

    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected — reconnect to Supabase to record a receipt.');
      setSaving(false);
      return;
    }

    const { error: insertErr } = await supabase.from('ss_supplier_rebate_receipts').insert({
      org_id: org.id,
      rebate_id: rebateId,
      amount: value,
      received_on: receivedOn,
      method,
      reference: reference.trim() || null,
    });

    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    ss.closeReceipt();
    onSaved(`Receipt recorded against ${rebate?.name ?? 'the agreement'}`);
    router.refresh();
  }

  if (!rebate) return null;

  return (
    <ModalShell
      title="Record a rebate receipt"
      subtitle={`${rebate.name} · ${rebate.supplierName}`}
      onClose={ss.closeReceipt}
      onSubmit={submit}
      submitLabel="Record receipt"
      submitDisabled={value <= 0}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Amount received (R)" required>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className={fieldClass()} />
        </Field>
        <Field label="Received on">
          <input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={fieldClass()} />
        </Field>
        <Field label="How">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass()}>
            {RECEIPT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Reference">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Credit note / payment ref" className={fieldClass()} />
        </Field>
      </div>
      <p className="text-[12px] text-[#6B6F68]">
        Outstanding on this agreement is{' '}
        <span className="of-num font-medium text-[#171A17]">R {rebate.outstanding.toLocaleString('en-ZA')}</span>
        {rebate.expectedIsEstimated ? ' (against an estimated expected value).' : '.'}
      </p>
    </ModalShell>
  );
}
