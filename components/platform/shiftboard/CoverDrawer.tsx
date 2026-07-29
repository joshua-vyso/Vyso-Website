'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, useToast } from '@/components/platform/orderflow/ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { zar } from '@/lib/platform/orderflow';
import {
  eligibleForOpenShift,
  fmtHours,
  shiftHours,
  skillForDepartment,
  type CoverCandidate,
  type OpenShift,
} from '@/lib/platform/shiftboard';
import { assignOpenShift, ensureRosterRow, proposeSwap, removeOpenShift, saveOpenShifts } from '@/lib/platform/shiftboard-write';
import { BTN_DANGER, BTN_SECONDARY, EmptyState, MatchChip } from './shared';
import { useShiftBoard } from './context';

/**
 * Call-out coverage: turn an open shift into a shortlist of people who can
 * actually work it.
 *
 * Everyone is shown — the ranked shortlist first, then the people who cannot
 * take it with the reason why. "Nobody is available" is an answer a manager can
 * act on; an empty list is not.
 */
export function CoverDrawer() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();
  const { org, userId } = usePlatform();
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = sb.openShiftByKey(sb.coveringKey);

  const candidates = useMemo(
    () => (open ? eligibleForOpenShift(open, { employees: sb.employees, roster: sb.roster }) : []),
    [open, sb.employees, sb.roster],
  );
  const shortlist = candidates.filter((c) => c.available);
  const blocked = candidates.filter((c) => !c.available);

  async function assign(c: CoverCandidate) {
    if (!open || !org) return;
    const db = createClient();
    if (!db) return;
    setBusyId(c.employee.id);

    let row = sb.rowFor(c.employee.id, c.employee.name);
    if (!row?.rowId) {
      const created = await ensureRosterRow(db, org.id, c.employee, sb.roster.label, sb.roster.openShifts);
      if (created.error || !created.rowId) {
        setBusyId(null);
        show(`Couldn't assign: ${created.error ?? 'no roster row'}`);
        return;
      }
      row = { rowId: created.rowId, employeeId: c.employee.id, name: c.employee.name, role: c.employee.role, department: c.employee.department, days: Array.from({ length: 7 }, () => ({ time: '', status: 'off' as const })) };
    }

    const { error } = await assignOpenShift(db, org.id, sb.roster, row, open, c.overtime.level === 'over' ? 'Overtime risk' : undefined);
    setBusyId(null);
    if (error) {
      show(`Couldn't assign: ${error}`);
      return;
    }
    show(`${c.employee.name} is covering ${open.day} ${open.time}`);
    sb.closeCover();
    router.refresh();
  }

  /** Offer it to the whole team instead of picking someone — creates a swap row. */
  async function offerToTeam() {
    if (!open || !org) return;
    const db = createClient();
    if (!db) return;
    setBusyId('__offer');
    const { error } = await proposeSwap(db, org.id, userId ?? null, {
      kind: 'cover',
      weekLabel: sb.roster.label,
      day: open.day,
      fromEmployeeId: open.fromEmployeeId ?? '',
      fromName: open.fromName ?? 'Open shift',
      fromTime: open.time,
      fromDepartment: open.department,
      reason: open.reason === 'call-out' ? 'Called out' : 'Unfilled shift',
      note: open.note ?? null,
    });
    setBusyId(null);
    if (error) {
      show(`Couldn't post the offer: ${error}`);
      return;
    }
    show('Cover offer posted to the team');
    router.refresh();
  }

  async function withdraw(target: OpenShift) {
    if (!org) return;
    const db = createClient();
    if (!db) return;
    setBusyId('__withdraw');
    const { error } = await saveOpenShifts(db, org.id, removeOpenShift(sb.roster.openShifts, target));
    setBusyId(null);
    if (error) {
      show(`Couldn't withdraw: ${error}`);
      return;
    }
    show('Open shift withdrawn');
    sb.closeCover();
    router.refresh();
  }

  if (!open) return null;

  const skill = skillForDepartment(open.department);
  const hours = shiftHours(open.time);

  return (
    <>
      {node}
      <Drawer
        open
        onClose={sb.closeCover}
        title={`Find cover — ${open.day} ${open.time}`}
        subtitle={`${open.department}${open.reason === 'call-out' && open.fromName ? ` · ${open.fromName} called out` : ''}`}
        width={620}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={() => void offerToTeam()} disabled={busyId != null}>
              Offer to the team
            </button>
            <button type="button" className={BTN_DANGER} onClick={() => void withdraw(open)} disabled={busyId != null}>
              Withdraw shift
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* What needs covering */}
          <div className="rounded-[14px] border border-[#EAEDF2] bg-[#FBFCFE] p-3.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
              <span className="flex items-center gap-2 font-semibold text-[#171A17]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(open.department) }} />
                {open.department}
              </span>
              <span className="text-[#6B6F68]">
                {open.day} · <span className="of-num">{open.time}</span> · <span className="of-num">{fmtHours(hours)}</span>
              </span>
              {skill ? <span className="text-[#6B6F68]">Needs {skill}</span> : null}
            </div>
            {open.note ? <p className="mt-2 text-[12px] text-[#8A8E86]">&ldquo;{open.note}&rdquo;</p> : null}
          </div>

          {/* Ranked shortlist */}
          <div>
            <h3 className="of-display mb-2 text-[14px] font-semibold text-[#171A17]">
              Eligible staff <span className="of-num ml-1 text-[12px] font-normal text-[#A0A49C]">{shortlist.length}</span>
            </h3>
            {shortlist.length === 0 ? (
              <EmptyState
                title="Nobody is free for this shift"
                hint="Everyone is already rostered, on leave or marked unavailable. Offer it to the team, or move the shift to another day."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {shortlist.map((c) => (
                  <CandidateRow key={c.employee.id} c={c} hours={hours} busy={busyId === c.employee.id} onAssign={() => void assign(c)} />
                ))}
              </div>
            )}
          </div>

          {/* Not available — shown with the reason, never silently dropped */}
          {blocked.length ? (
            <div>
              <h3 className="of-display mb-2 text-[14px] font-semibold text-[#171A17]">
                Not available <span className="of-num ml-1 text-[12px] font-normal text-[#A0A49C]">{blocked.length}</span>
              </h3>
              <div className="flex flex-col gap-1.5">
                {blocked.map((c) => (
                  <div key={c.employee.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-[#EEF1F5] bg-[#FBFCFE] px-3.5 py-2.5">
                    <span className="min-w-0 truncate text-[13px] text-[#6B6F68]">{c.employee.name}</span>
                    <span className="shrink-0 text-[12px] text-[#A0A49C]">{c.unavailableReason}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}

function CandidateRow({ c, hours, busy, onAssign }: { c: CoverCandidate; hours: number; busy: boolean; onAssign: () => void }) {
  const cost = hours * c.employee.rate;
  return (
    <div className="rounded-[14px] border border-[#EAEDF2] bg-white p-3.5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#171A17]">
            {c.employee.name}
            <span className="ml-1.5 text-[12px] font-normal text-[#A0A49C]">{c.employee.role}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-[#8A8E86]">
            {c.employee.department} · <span className="of-num">{zar(cost)}</span> for this shift
          </div>
        </div>
        <button
          type="button"
          onClick={onAssign}
          disabled={busy}
          className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {c.reasons.map((r) => (
          <MatchChip key={r} text={r} tone="good" />
        ))}
        {c.warnings.map((w) => (
          <MatchChip key={w} text={w} tone="warn" />
        ))}
      </div>
    </div>
  );
}
