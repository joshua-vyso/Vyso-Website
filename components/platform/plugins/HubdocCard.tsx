'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SAST } from '@/lib/platform/sast';
import {
  hubdocForwardLabel,
  validateHubdocIntakeEmail,
  HUBDOC_INTAKE_DOMAIN,
  HUBDOC_INTAKE_HINT,
  type HubdocForwardEntry,
} from '@/lib/platform/hubdoc-shared';

/**
 * Hubdoc — where this org's paperwork goes, whether Vyso may send it unprompted,
 * and every document it has sent (plan `.ai/plan_plugins_xero.md`, X2).
 *
 * THE COPY ON THE TOGGLE IS THE FEATURE. An owner switching this on is giving
 * Vyso a standing instruction to email their supplier invoices to a third party
 * for as long as it stays on, and the label says exactly that in those words —
 * "You are giving Vyso a standing instruction; every forward is logged below."
 * The log is directly beneath it for the same reason: the promise and the
 * evidence of the promise being kept are one glance apart.
 *
 * DEFAULT OFF, AND IT CANNOT BE TURNED ON WITHOUT AN ADDRESS. The switch is
 * disabled until there is somewhere to send to — a standing instruction with no
 * destination does nothing but write failed rows on every upload — and the route
 * enforces the same rule server-side rather than trusting this.
 *
 * THE ADDRESS IS VALIDATED HERE AND AGAIN ON THE SERVER, from the same pure
 * function. The client copy exists so a typo is caught before a round-trip; the
 * server copy is the one that decides. A non-Hubdoc domain is a WARNING, not a
 * refusal — some businesses point this at their own bookkeeper's mailbox, and
 * Hubdoc's intake domain is Hubdoc's to change.
 *
 * A CLIENT COMPONENT because all three controls write. The house mutation shape:
 * POST, then `router.refresh()` to reconcile against server truth — no optimistic
 * state, because the thing being written is a permission.
 */
export function HubdocCard({
  intakeEmail,
  autoForward,
  canManage,
  configured,
  tableMissing,
  forwards,
}: {
  intakeEmail: string | null;
  autoForward: boolean;
  /** Owner or admin. Members never see this page at all; this covers the case of
   *  a role that changed under an open tab. */
  canManage: boolean;
  /** Resend is configured on the server. Without it nothing here can send, and
   *  the card says so rather than offering a button that always fails. */
  configured: boolean;
  /** supabase/hubdoc.sql has not been pasted into this database yet. */
  tableMissing: boolean;
  /** The last 50 forwards, newest first. */
  forwards: HubdocForwardEntry[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(intakeEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The stored address's own warning, recomputed on every render rather than
  // stored: the domain that is "wrong" today may be right tomorrow, and a
  // warning frozen into a row would outlive the reason for it.
  const savedCheck = intakeEmail ? validateHubdocIntakeEmail(intakeEmail) : null;
  const savedWarning = savedCheck?.ok ? savedCheck.warning : null;

  async function save(next: { intakeEmail: string | null; autoForward: boolean }) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/integrations/hubdoc/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        warning?: string | null;
      };
      if (!response.ok) {
        setError(result.error ?? 'Could not save your Hubdoc settings.');
        return;
      }
      setNote(next.intakeEmail ? 'Saved.' : 'Hubdoc address cleared. Nothing will be sent.');
      router.refresh();
    } catch {
      setError('Could not save your Hubdoc settings.');
    } finally {
      setBusy(false);
    }
  }

  function saveAddress() {
    const trimmed = email.trim();
    if (!trimmed) {
      // Clearing the address is a legitimate act — it is how an owner switches
      // the whole feature off — so it saves rather than erroring. The server
      // turns auto-forward off with it.
      void save({ intakeEmail: null, autoForward: false });
      return;
    }
    const check = validateHubdocIntakeEmail(trimmed);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    void save({ intakeEmail: check.email, autoForward });
  }

  return (
    <section>
      <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Hubdoc</h2>
      <p className="mt-1 text-[13px] text-[#6B6F68]">
        Send the supplier invoices Doc-U reads straight to your Hubdoc inbox, so they reach Xero the
        way the rest of your paperwork does.
      </p>

      <div className="mt-3 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        {tableMissing ? (
          <p className="mb-4 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
            The Hubdoc tables are not in this database yet — paste
            <span className="font-medium"> supabase/hubdoc.sql</span> into the SQL editor.
          </p>
        ) : null}
        {!configured ? (
          <p className="mb-4 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
            Email sending is not configured on this server, so nothing can be sent to Hubdoc yet.
          </p>
        ) : null}

        {/* ---- The address ---- */}
        <label htmlFor="hubdoc-intake" className="block text-[13px] font-semibold text-[#171A17]">
          Hubdoc upload address
        </label>
        <p className="mt-1 text-[12px] text-[#8A8E86]">
          Find it in {HUBDOC_INTAKE_HINT} It usually ends in{' '}
          <span className="font-medium">@{HUBDOC_INTAKE_DOMAIN}</span>.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="hubdoc-intake"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            value={email}
            disabled={!canManage || busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`yourorg@${HUBDOC_INTAKE_DOMAIN}`}
            className="h-[42px] min-w-0 flex-1 rounded-[11px] border border-[#E2E6EC] bg-white px-3.5 text-[14px] text-[#171A17] placeholder:text-[#B4B8B0] focus:border-[#C9DEF7] focus:outline-none disabled:opacity-50"
          />
          {canManage ? (
            <button
              type="button"
              disabled={busy || email.trim() === (intakeEmail ?? '')}
              onClick={saveAddress}
              className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>

        {savedWarning ? (
          <p className="mt-2 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
            {savedWarning}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 rounded-[12px] border border-[#F3D1D1] bg-[#FFF7F7] p-3 text-[13px] text-[#A32D2D]">
            {error}
          </p>
        ) : null}
        {note ? (
          <p className="mt-2 rounded-[12px] border border-[#E4E9F0] bg-[#F8FAFC] p-3 text-[13px] text-[#6B6F68]">
            {note}
          </p>
        ) : null}

        {/* ---- The standing instruction ---- */}
        <div className="mt-5 rounded-[12px] border border-[#E4E9F0] bg-[#F8FAFC] p-3.5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={autoForward}
              disabled={!canManage || busy || !intakeEmail}
              onChange={(e) => void save({ intakeEmail, autoForward: e.target.checked })}
              className="mt-0.5 h-[16px] w-[16px] shrink-0 accent-[#1F5FA8] disabled:opacity-40"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[#171A17]">
                Forward every new supplier invoice Doc-U reads to Hubdoc automatically
              </span>
              <span className="mt-1 block text-[12.5px] text-[#6B6F68]">
                You are giving Vyso a standing instruction; every forward is logged below. Off by
                default — with this switched off, nothing goes to Hubdoc unless you press a button.
              </span>
              {!intakeEmail ? (
                <span className="mt-1 block text-[12px] text-[#8A8E86]">
                  Set an upload address first.
                </span>
              ) : null}
            </span>
          </label>
        </div>

        {/* ---- The receipts ---- */}
        <div className="mt-5">
          <div className="text-[13px] font-semibold text-[#171A17]">Sent to Hubdoc</div>
          {forwards.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[#6B6F68]">
              Nothing has been sent yet. Every document Vyso sends will be listed here, whether you
              sent it or the standing instruction did.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[#EEF1F5] border-t border-[#EEF1F5]">
              {forwards.map((f) => (
                <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/app/docu/${f.documentId}`}
                      className="text-[13px] font-medium text-[#171A17] underline decoration-[#DDE2E9] underline-offset-2 transition-colors hover:text-[#1F5FA8]"
                    >
                      {f.subject || f.filename || 'Document'}
                    </Link>
                    {f.status === 'failed' && f.error ? (
                      <span className="mt-0.5 block text-[12px] text-[#A32D2D]">{f.error}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                        f.status === 'sent'
                          ? 'bg-[#E7F4EA] text-[#27733B]'
                          : 'bg-[#FFF0F0] text-[#A32D2D]'
                      }`}
                    >
                      {hubdocForwardLabel(f)}
                    </span>
                    <span className="text-[12px] text-[#8A8E86]">{sentDay(f.sentAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * "19 Aug" — the date beside a forward.
 *
 * PINNED TO SAST, which is what makes it safe to compute in a client component
 * at all. An unpinned formatter runs in UTC on the server and in the reader's own
 * zone in the browser, so a forward sent at 01:00 SAST renders as two different
 * days either side of hydration — the flicker-on-a-date bug the Brief's
 * `foundAtLabel` exists to avoid. With the zone fixed, both sides compute the
 * same string and no prop has to be threaded through for fifty rows.
 */
function sentDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST,
    day: 'numeric',
    month: 'short',
  }).format(at);
}
