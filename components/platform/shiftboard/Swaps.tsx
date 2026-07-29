'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import {
  DAYS,
  SWAP_REASONS,
  SWAP_STATUS_META,
  assessOvertime,
  fmtHours,
  type Employee,
  type ShiftSwap,
  type SwapKind,
} from '@/lib/platform/shiftboard';
import { acceptSwap, approveSwap, proposeSwap, setSwapStatus } from '@/lib/platform/shiftboard-write';
import { BTN_PRIMARY, BTN_SECONDARY, EmptyState, FIELD_CLASS, FieldLabel, ModalShell, SwapStatusBadge } from './shared';
import { useShiftBoard } from './context';

const ACTIVE: ShiftSwap['status'][] = ['proposed', 'accepted'];

/** Live swap/cover requests — the ones a manager still owes an answer on. */
export function activeSwaps(swaps: ShiftSwap[]): ShiftSwap[] {
  return swaps.filter((s) => ACTIVE.includes(s.status));
}

// ---------------------------------------------------------------------------
// Inline panel (Roster + Overview)
// ---------------------------------------------------------------------------

export function SwapsPanel() {
  const sb = useShiftBoard();
  const live = activeSwaps(sb.swaps);
  const toApprove = live.filter((s) => s.status === 'accepted').length;

  return (
    <SectionCard
      title="Swaps & cover requests"
      right={
        <button type="button" onClick={sb.openSwaps} className="text-[12px] font-semibold text-[#1F5FA8] hover:underline">
          Open swap centre →
        </button>
      }
    >
      {live.length === 0 ? (
        <EmptyState
          title="No swap requests open"
          hint="When someone can't work a shift, log it here instead of a WhatsApp thread — the roster only changes once a manager approves."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {toApprove > 0 ? (
            <p className="rounded-[10px] bg-[#FBEEDA] px-3 py-2 text-[12px] font-medium text-[#854F0B]">
              <span className="of-num">{toApprove}</span> {toApprove === 1 ? 'request has' : 'requests have'} a taker and need your approval.
            </p>
          ) : null}
          {live.slice(0, 4).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={sb.openSwaps}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#EEF1F5] bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]"
            >
              <span className="min-w-0 text-[13px] text-[#171A17]">
                <span className="font-semibold">{s.fromName}</span>
                <span className="text-[#6B6F68]">
                  {' '}
                  · {s.day} <span className="of-num">{s.fromTime}</span> · {s.kind === 'cover' ? 'cover' : 'swap'}
                  {s.toName ? ` → ${s.toName}` : ''}
                </span>
              </span>
              <SwapStatusBadge status={s.status} />
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Swap centre drawer — propose / accept / approve in one place
// ---------------------------------------------------------------------------

export function SwapCentre() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();
  const { org } = usePlatform();
  const [busy, setBusy] = useState<string | null>(null);
  const [takerFor, setTakerFor] = useState<ShiftSwap | null>(null);

  const live = activeSwaps(sb.swaps);
  const settled = sb.swaps.filter((s) => !ACTIVE.includes(s.status));

  async function run(id: string, fn: () => Promise<{ error: string | null }>, okMsg: string) {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    if (error) {
      show(`Couldn't save: ${error}`);
      return;
    }
    show(okMsg);
    router.refresh();
  }

  function approve(s: ShiftSwap) {
    const db = createClient();
    if (!db || !org) return;
    void run(s.id, () => approveSwap(db, org.id, s, sb.roster), `Approved — roster updated for ${s.day}`);
  }
  function decline(s: ShiftSwap) {
    const db = createClient();
    if (!db) return;
    void run(s.id, () => setSwapStatus(db, s.id, 'declined'), 'Request declined');
  }
  function cancel(s: ShiftSwap) {
    const db = createClient();
    if (!db) return;
    void run(s.id, () => setSwapStatus(db, s.id, 'cancelled'), 'Request cancelled');
  }

  if (!sb.swapsOpen) return null;

  return (
    <>
      {node}
      <Drawer
        open
        onClose={sb.closeSwaps}
        title="Swap & cover centre"
        subtitle="propose → accept → manager approval. Only an approved request rewrites the roster."
        width={640}
      >
        <div className="space-y-5">
          <div>
            <h3 className="of-display mb-2 text-[14px] font-semibold text-[#171A17]">
              Open requests <span className="of-num ml-1 text-[12px] font-normal text-[#A0A49C]">{live.length}</span>
            </h3>
            {live.length === 0 ? (
              <EmptyState
                title="Nothing waiting"
                hint="Open a shift on the Roster tab and choose “Offer for swap” to start a request."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {live.map((s) => (
                  <SwapCard
                    key={s.id}
                    swap={s}
                    busy={busy === s.id}
                    onFindTaker={() => setTakerFor(s)}
                    onApprove={() => approve(s)}
                    onDecline={() => decline(s)}
                    onCancel={() => cancel(s)}
                  />
                ))}
              </div>
            )}
          </div>

          {settled.length ? (
            <div>
              <h3 className="of-display mb-2 text-[14px] font-semibold text-[#171A17]">Settled</h3>
              <div className="flex flex-col gap-1.5">
                {settled.slice(0, 12).map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#EEF1F5] bg-[#FBFCFE] px-3.5 py-2.5">
                    <span className="min-w-0 text-[13px] text-[#6B6F68]">
                      <span className="font-medium text-[#171A17]">{s.fromName}</span> · {s.day} <span className="of-num">{s.fromTime}</span>
                      {s.toName ? ` → ${s.toName}` : ''}
                    </span>
                    <SwapStatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Drawer>

      {takerFor ? <TakerModal key={takerFor.id} swap={takerFor} onClose={() => setTakerFor(null)} /> : null}
    </>
  );
}

function SwapCard({
  swap,
  busy,
  onFindTaker,
  onApprove,
  onDecline,
  onCancel,
}: {
  swap: ShiftSwap;
  busy: boolean;
  onFindTaker: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const sb = useShiftBoard();
  const meta = SWAP_STATUS_META[swap.status];

  // What approving would do to the taker's week — the same overtime maths the
  // roster editor runs, so approval is never the moment OT appears.
  const takerRow = swap.toEmployeeId ? sb.rowFor(swap.toEmployeeId, swap.toName ?? undefined) : undefined;
  const taker = sb.employeeById(swap.toEmployeeId);
  const dayIdx = DAYS.indexOf(swap.day);
  const ot =
    takerRow && dayIdx >= 0
      ? assessOvertime(takerRow, taker, dayIdx, { time: swap.fromTime, department: swap.fromDepartment, status: 'scheduled' })
      : null;

  return (
    <div className="rounded-[14px] border border-[#EAEDF2] bg-white p-3.5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#171A17]">
            {swap.fromName}
            <span className="ml-1.5 text-[12px] font-normal text-[#8A8E86]">{swap.kind === 'cover' ? 'wants cover' : 'wants to swap'}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[#6B6F68]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(swap.fromDepartment) }} />
              {swap.fromDepartment}
            </span>
            <span>
              {swap.day} · <span className="of-num">{swap.fromTime}</span>
            </span>
            {swap.reason ? <span className="text-[#A0A49C]">· {swap.reason}</span> : null}
          </div>
        </div>
        <SwapStatusBadge status={swap.status} />
      </div>

      {swap.note ? <p className="mt-2 text-[12px] text-[#8A8E86]">&ldquo;{swap.note}&rdquo;</p> : null}

      {swap.toName ? (
        <div className="mt-2.5 rounded-[10px] bg-[#E6F1FB] px-3 py-2 text-[12px] text-[#0C447C]">
          <span className="font-semibold">{swap.toName}</span> will take it
          {swap.kind === 'swap' && swap.toTime ? (
            <>
              {' '}
              and gives back {swap.toDay ?? swap.day} <span className="of-num">{swap.toTime}</span>
            </>
          ) : null}
          .
        </div>
      ) : (
        <p className="mt-2.5 text-[12px] text-[#A0A49C]">{meta.hint}</p>
      )}

      {ot && ot.level !== 'ok' ? (
        <p className="mt-2 rounded-[10px] px-3 py-2 text-[12px]" style={{ backgroundColor: ot.level === 'over' ? '#FCEBEB' : '#FBEEDA', color: ot.level === 'over' ? '#A32D2D' : '#854F0B' }}>
          ▲ Approving puts {swap.toName} on <span className="of-num">{fmtHours(ot.projected)}</span> of <span className="of-num">{fmtHours(ot.threshold)}</span>.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {swap.status === 'proposed' ? (
          <button type="button" onClick={onFindTaker} disabled={busy} className="inline-flex h-9 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50">
            Record a taker
          </button>
        ) : null}
        {swap.status === 'accepted' ? (
          <button type="button" onClick={onApprove} disabled={busy} className="inline-flex h-9 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50">
            {busy ? 'Approving…' : 'Approve & update roster'}
          </button>
        ) : null}
        <button type="button" onClick={onDecline} disabled={busy} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50">
          Decline
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-9 items-center rounded-[10px] px-2.5 text-[13px] font-medium text-[#8A8E86] transition-colors hover:text-[#171A17] disabled:opacity-50">
          Cancel request
        </button>
      </div>
    </div>
  );
}

/** Record who accepted a proposed request (and, for a trade, what they give back).
 *  Mounted keyed on the request, so each one starts from a clean form. */
function TakerModal({ swap, onClose }: { swap: ShiftSwap; onClose: () => void }) {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();
  const [takerId, setTakerId] = useState('');
  const [backDay, setBackDay] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => sb.employees.filter((e) => e.id !== swap.fromEmployeeId), [sb.employees, swap.fromEmployeeId]);
  const taker = options.find((e) => e.id === takerId);
  const takerRow = taker ? sb.rowFor(taker.id, taker.name) : undefined;
  const backIdx = DAYS.indexOf(backDay);
  const backCell = takerRow && backIdx >= 0 ? takerRow.days[backIdx] : undefined;

  async function save() {
    if (!taker) return;
    const db = createClient();
    if (!db) return;
    setSaving(true);
    const { error } = await acceptSwap(db, swap.id, {
      id: taker.id,
      name: taker.name,
      day: swap.kind === 'swap' && backDay ? backDay : null,
      time: swap.kind === 'swap' && backCell?.status === 'scheduled' ? backCell.time : null,
      department: swap.kind === 'swap' && backCell?.status === 'scheduled' ? (backCell.department ?? taker.department) : null,
    });
    setSaving(false);
    if (error) {
      show(`Couldn't save: ${error}`);
      return;
    }
    show(`${taker.name} recorded — awaiting approval`);
    onClose();
    router.refresh();
  }

  return (
    <>
      {node}
      <ModalShell
        open
        onClose={onClose}
        title="Who is taking this shift?"
        subtitle={`${swap.fromName} · ${swap.day} ${swap.fromTime} · ${swap.fromDepartment}`}
        width={480}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={saving || !taker}>
              {saving ? 'Saving…' : 'Record taker'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>Taking the shift</FieldLabel>
            <select value={takerId} onChange={(e) => setTakerId(e.target.value)} className={FIELD_CLASS}>
              <option value="">Select someone…</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.department}
                </option>
              ))}
            </select>
          </div>

          {swap.kind === 'swap' ? (
            <div>
              <FieldLabel>Shift they give back (optional)</FieldLabel>
              <select value={backDay} onChange={(e) => setBackDay(e.target.value)} className={FIELD_CLASS} disabled={!taker}>
                <option value="">No return shift — straight cover</option>
                {DAYS.map((d, i) => {
                  const cell = takerRow?.days[i];
                  return (
                    <option key={d} value={d} disabled={cell?.status !== 'scheduled'}>
                      {d} {cell?.status === 'scheduled' ? `· ${cell.time}` : '· not scheduled'}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          <p className="rounded-[10px] bg-[#F5F9FE] px-3 py-2 text-[12px] text-[#6B6F68]">
            Recording a taker does not change the roster. A manager still has to approve it — that approval is what writes the shift.
          </p>
        </div>
      </ModalShell>
    </>
  );
}

// ---------------------------------------------------------------------------
// Propose a swap from a roster cell
// ---------------------------------------------------------------------------

export function SwapDraftModal() {
  const sb = useShiftBoard();
  const draft = sb.swapDraft;
  const employee = sb.employeeById(draft?.employeeId);
  if (!draft || !employee) return null;
  return <SwapDraftForm key={`${draft.employeeId}:${draft.dayIdx}`} employee={employee} dayIdx={draft.dayIdx} />;
}

function SwapDraftForm({ employee, dayIdx }: { employee: Employee; dayIdx: number }) {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();
  const { org, userId } = usePlatform();
  const [kind, setKind] = useState<SwapKind>('cover');
  const [reason, setReason] = useState<string>(SWAP_REASONS[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const row = sb.rowFor(employee.id, employee.name);
  const cell = row?.days[dayIdx];

  async function submit() {
    if (!org || !cell || cell.status !== 'scheduled') return;
    const db = createClient();
    if (!db) return;
    setSaving(true);
    const { error } = await proposeSwap(db, org.id, userId ?? null, {
      kind,
      weekLabel: sb.roster.label,
      day: DAYS[dayIdx] ?? '',
      fromEmployeeId: employee.id,
      fromName: employee.name,
      fromTime: cell.time,
      fromDepartment: cell.department ?? employee.department,
      reason,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      show(`Couldn't post: ${error}`);
      return;
    }
    show('Request posted — the roster changes once it is approved');
    sb.closeSwapDraft();
    router.refresh();
  }

  const day = DAYS[dayIdx] ?? '';

  return (
    <>
      {node}
      <ModalShell
        open
        onClose={sb.closeSwapDraft}
        title="Offer this shift"
        subtitle={`${employee.name} · ${day} ${cell?.time ?? ''}`}
        width={480}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={sb.closeSwapDraft} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => void submit()} disabled={saving || cell?.status !== 'scheduled'}>
              {saving ? 'Posting…' : 'Post request'}
            </button>
          </>
        }
      >
        {cell?.status !== 'scheduled' ? (
          <p className="text-[13px] text-[#6B6F68]">There is no shift on {day} to offer.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'cover' as SwapKind, label: 'Give it away', hint: 'Someone else takes the shift' },
                  { value: 'swap' as SwapKind, label: 'Trade it', hint: 'Swap for one of theirs' },
                ]
              ).map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`rounded-[12px] border px-3 py-2.5 text-left transition-colors ${
                    kind === k.value ? 'border-[#3E7BC4] bg-[#F5F9FE]' : 'border-[#E4E9F0] bg-white hover:border-[#C9DEF7]'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-[#171A17]">{k.label}</div>
                  <div className="mt-0.5 text-[11px] text-[#8A8E86]">{k.hint}</div>
                </button>
              ))}
            </div>

            <div>
              <FieldLabel>Reason</FieldLabel>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD_CLASS}>
                {SWAP_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Note (optional)</FieldLabel>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the team should know" className={FIELD_CLASS} />
            </div>

            <p className="rounded-[10px] bg-[#F5F9FE] px-3 py-2 text-[12px] text-[#6B6F68]">
              The shift stays on {employee.name}&rsquo;s roster until a manager approves a taker — so nothing goes uncovered while the request is open.
            </p>
          </div>
        )}
      </ModalShell>
    </>
  );
}
