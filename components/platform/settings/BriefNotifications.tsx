'use client';

import { useState } from 'react';
import {
  MAX_SLOTS,
  WEEKDAY_LABELS,
  daysLabel,
  defaultSlots,
  kindLabel,
  type BriefSlot,
  type BriefSlotKind,
} from '@/lib/platform/brief-schedules-shared';

/**
 * Brief notifications — when this person wants their brief emailed to them.
 *
 * ADMIN-ONLY, AND MOUNTED THAT WAY. The settings page does not render this card
 * for a member (`canSeeBrief`), because the Brief itself is admin-only since
 * v2b: offering a member a schedule for a screen they cannot open would be
 * offering them a setting the product will refuse to honour. The route enforces
 * the same rule, so hiding the card is a courtesy rather than the control.
 *
 * THE STATE IS UNSAVED UNTIL SAVE. Every edit below — adding a time, toggling
 * Thursday, switching a slot off — changes local state only, and the two
 * defaults offered on an empty card are pre-filled rather than written. A
 * settings screen that emails you because you looked at it has made a decision
 * that was yours; the whole card is one form with one Save.
 *
 * THE ADDRESS IS READ-ONLY AND COMES FROM THE SESSION. There is no "send to a
 * different address" field on purpose: this email contains supplier prices and
 * customers' balances, and the only address the product will send it to is the
 * one the recipient signs in with. Changing it means changing your login.
 */
export function BriefNotifications({
  initialSlots,
  email,
  tableMissing,
}: {
  initialSlots: BriefSlot[];
  email: string;
  /** True when supabase/brief-schedules.sql hasn't been pasted in yet — the
   *  card says so rather than accepting a Save that will fail. */
  tableMissing: boolean;
}) {
  const [slots, setSlots] = useState<BriefSlot[]>(initialSlots);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function update(index: number, patch: Partial<BriefSlot>) {
    setNotice(null);
    setSlots((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function toggleDay(index: number, day: number) {
    const slot = slots[index];
    const days = slot.days.includes(day)
      ? slot.days.filter((d) => d !== day)
      : [...slot.days, day].sort((a, b) => a - b);
    update(index, { days });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/settings/brief-schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // `id` rides along so the server can UPDATE the row rather than replace
        // it, which is what keeps a slot's delivery history across an edit.
        body: JSON.stringify({
          slots: slots.map((s) => ({
            id: s.id,
            kind: s.kind,
            local_time: s.local_time,
            days: s.days,
            enabled: s.enabled,
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; slots?: BriefSlot[] };
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.');
        return;
      }
      // Adopt the server's rows: they carry the ids and timestamps the database
      // just assigned, and a client holding invented ones would insert
      // duplicates on the next Save.
      setSlots(json.slots ?? []);
      setNotice('Saved.');
    } catch {
      setError('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const first = slots[0];
      const res = await fetch('/api/settings/brief-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          first ? { kind: first.kind, local_time: first.local_time, days: first.days } : { kind: 'custom' },
        ),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'The test brief could not be sent.');
        return;
      }
      setNotice(`Sent to ${email}.`);
    } catch {
      setError('The test brief could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="brief-notifications"
      className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]"
    >
      <div className="of-display text-[16px] font-semibold text-[#171A17]">Brief notifications</div>
      <p className="mt-1 text-[13px] text-[#6B6F68]">
        Have your Brief emailed to <span className="text-[#171A17]">{email || 'your account'}</span> at the times
        you choose. Times are South African (SAST).
      </p>

      {tableMissing ? (
        <p className="mt-4 rounded-[11px] border border-[#F0E2C4] bg-[#FBF7EE] px-3.5 py-3 text-[13px] text-[#854F0B]">
          Not set up on this database yet — run <code>supabase/brief-schedules.sql</code> in the Supabase SQL
          editor, then reload this page.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {slots.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#E2E6EC] px-4 py-5">
            <p className="text-[13px] text-[#6B6F68]">
              No brief times yet. Most people want two: what changed overnight, and how the day went.
            </p>
            <button
              type="button"
              disabled={busy || tableMissing}
              onClick={() => {
                setNotice(null);
                setSlots(defaultSlots());
              }}
              className="mt-3 inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
            >
              Use 07:00 and 17:30
            </button>
            <p className="mt-1.5 text-[12px] text-[#A0A49C]">
              Nothing is sent until you press Save.
            </p>
          </div>
        ) : null}

        {slots.map((slot, i) => (
          <div key={slot.id ?? `new-${i}`} className="rounded-[14px] border border-[#EAEDF2] bg-[#FBFCFE] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={slot.local_time}
                onChange={(e) => update(i, { local_time: e.target.value })}
                className="h-[42px] rounded-[11px] border border-[#E4E9F0] bg-white px-3 text-[14px] text-[#171A17]"
                aria-label="Time of day"
              />
              <select
                value={slot.kind}
                onChange={(e) => update(i, { kind: e.target.value as BriefSlotKind })}
                className="h-[42px] rounded-[11px] border border-[#E4E9F0] bg-white px-3 text-[14px] text-[#3E4A57]"
                aria-label="What this brief is for"
              >
                <option value="morning">{kindLabel('morning')}</option>
                <option value="evening">{kindLabel('evening')}</option>
                <option value="custom">{kindLabel('custom')}</option>
              </select>

              <label className="ml-auto flex items-center gap-2 text-[13px] text-[#6B6F68]">
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
                On
              </label>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setSlots((current) => current.filter((_, j) => j !== i));
                }}
                className="inline-flex h-[42px] items-center rounded-[11px] px-[14px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
              >
                Remove
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {WEEKDAY_LABELS.map((d) => {
                const on = slot.days.includes(d.day);
                return (
                  <button
                    key={d.day}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.full}
                    onClick={() => toggleDay(i, d.day)}
                    className={`h-[32px] w-[32px] rounded-full border text-[13px] font-medium transition-colors ${
                      on
                        ? 'border-[#C9DEF7] bg-[#EAF2FC] text-[#174C87]'
                        : 'border-[#E4E9F0] bg-white text-[#A0A49C] hover:border-[#C9DEF7]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
              <span className="ml-2 text-[12px] text-[#A0A49C]">{daysLabel(slot.days)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || tableMissing || slots.length >= MAX_SLOTS}
          onClick={() => {
            setNotice(null);
            setSlots((current) => [
              ...current,
              { kind: 'custom', local_time: '08:00', days: [1, 2, 3, 4, 5], enabled: true },
            ]);
          }}
          className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
        >
          Add a time
        </button>
        <button
          type="button"
          disabled={busy || tableMissing}
          onClick={() => void save()}
          className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
        >
          {busy ? 'Working…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendTest()}
          className="inline-flex h-[42px] items-center rounded-[11px] px-[14px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
        >
          Send me a test now
        </button>
      </div>

      <p className="mt-2 text-[12px] text-[#A0A49C]">
        Up to {MAX_SLOTS} times a day. A test goes to you straight away and doesn&apos;t count as that day&apos;s
        brief.
      </p>

      {error ? <p className="mt-2 text-[13px] text-[#A32D2D]">{error}</p> : null}
      {notice ? <p className="mt-2 text-[13px] text-[#174C87]">{notice}</p> : null}
    </div>
  );
}
