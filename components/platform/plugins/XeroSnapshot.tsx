'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { xeroMoney, type XeroMirrorSnapshot } from '@/lib/platform/xero-sync-shared';

/**
 * What Vyso has read out of Xero, and a button to read it again.
 *
 * FOUR FIGURES, NOT FOURTEEN. Money owed to the business and how much of it is
 * late; money the business owes, how much falls due this week and how much is
 * already late. That is the question an owner opens an accounting screen with,
 * and every additional tile past it is a tile that has to be read before the
 * four that matter.
 *
 * EVERY FIGURE IS FORMATTED HERE FROM NUMBERS THE SERVER SUMMED. The totals come
 * out of `summariseXeroMirror` (pure, tested); this component only decides how
 * they look. That is why the currency travels with them: Vyso holds no exchange
 * rates, so a mirror containing two currencies reports the dominant one and NAMES
 * the rest as excluded rather than adding them together into a figure that exists
 * nowhere.
 *
 * A CLIENT COMPONENT ONLY BECAUSE OF "SYNC NOW". The button POSTs to
 * `/api/integrations/xero/sync` and then `router.refresh()`es — the house
 * mutation shape (a write, then a reconcile against server truth; no optimistic
 * state, because the figures below are the thing being written). Everything else
 * here would render perfectly well on the server.
 *
 * THE BUTTON IS HONEST ABOUT WHAT IT DOES. It reads; it does not push. The line
 * under it says when the last read landed, because "Sync now" with no timestamp
 * beside it invites an owner to press it whenever they are unsure, which is how
 * a tenant burns its Xero rate limit.
 */
export function XeroSnapshot({
  snapshot,
  lastSyncedLabel,
  canSync,
  tableMissing,
  connected,
}: {
  snapshot: XeroMirrorSnapshot;
  /** "Last synced 03:20, Wed 19 Aug", or null when it never has been. Formatted
   *  on the server — a client recomputing a time at hydration can disagree with
   *  the HTML it is hydrating. */
  lastSyncedLabel: string | null;
  canSync: boolean;
  /** The mirror migration has not been pasted into this database yet. */
  tableMissing: boolean;
  /** There is a live Xero connection to sync. */
  connected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function syncNow() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/integrations/xero/sync', { method: 'POST' });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { invoices?: { rowsRead?: number }; contacts?: { rowsRead?: number } };
      };
      if (!response.ok) {
        setError(result.error ?? 'Could not sync Xero.');
        return;
      }
      const invoices = result.summary?.invoices?.rowsRead ?? 0;
      const contacts = result.summary?.contacts?.rowsRead ?? 0;
      // Says what CHANGED, not "done". A sync that read nothing is the common and
      // correct outcome of pressing this twice in a minute, and an owner who is
      // told "synced" both times learns nothing from the second press.
      setNote(
        invoices === 0 && contacts === 0
          ? 'Nothing has changed in Xero since the last sync.'
          : `Read ${invoices} invoice${invoices === 1 ? '' : 's'} and ${contacts} contact${contacts === 1 ? '' : 's'}.`,
      );
      router.refresh();
    } catch {
      setError('Could not sync Xero.');
    } finally {
      setBusy(false);
    }
  }

  const currency = snapshot.currency;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Snapshot</h2>
          <p className="mt-1 text-[13px] text-[#6B6F68]">
            {lastSyncedLabel ?? 'Xero has not been read yet.'}
          </p>
        </div>
        {canSync && connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void syncNow()}
            className="inline-flex h-[38px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[16px] text-[13px] font-medium text-[#171A17] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE] disabled:opacity-40"
          >
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-[12px] border border-[#F3D1D1] bg-[#FFF7F7] p-3 text-[13px] text-[#A32D2D]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mt-3 rounded-[12px] border border-[#E4E9F0] bg-[#F8FAFC] p-3 text-[13px] text-[#6B6F68]">
          {note}
        </p>
      ) : null}

      {tableMissing ? (
        <p className="mt-3 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
          The Xero mirror tables are not in this database yet — paste
          <span className="font-medium"> supabase/xero-sync.sql</span> into the SQL editor and sync
          again.
        </p>
      ) : snapshot.invoicesMirrored === 0 ? (
        <p className="mt-3 rounded-2xl border border-[#EAEDF2] bg-white p-5 text-[13px] text-[#6B6F68] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          {connected
            ? 'Nothing has been read out of Xero yet. The nightly sync runs at 03:20, or read it now.'
            : 'Connect Xero above and Vyso will read your invoices and contacts every night.'}
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Owed to you"
              value={xeroMoney(snapshot.receivablesOutstanding, currency)}
              sub={
                snapshot.receivablesOverdueCount > 0
                  ? `${xeroMoney(snapshot.receivablesOverdue, currency)} overdue`
                  : 'None overdue'
              }
            />
            <Tile
              label="Overdue invoices"
              value={String(snapshot.receivablesOverdueCount)}
              sub={
                snapshot.topDebtors.length > 0
                  ? `Worst: ${snapshot.topDebtors[0].contactName}`
                  : 'Nobody is late'
              }
            />
            <Tile
              label="You owe"
              value={xeroMoney(snapshot.payablesOutstanding, currency)}
              sub={
                snapshot.payablesOverdueCount > 0
                  ? `${xeroMoney(snapshot.payablesOverdue, currency)} already overdue`
                  : 'None overdue'
              }
            />
            <Tile
              label="Due within 7 days"
              value={xeroMoney(snapshot.payablesDueSoon, currency)}
              sub={`${snapshot.payablesDueSoonCount} bill${snapshot.payablesDueSoonCount === 1 ? '' : 's'}`}
            />
          </div>

          {snapshot.excludedCurrencies.length > 0 ? (
            // Vyso does no FX. Saying which rows were left out is the only honest
            // way to show a single total for a multi-currency ledger.
            <p className="mt-3 text-[12px] text-[#8A8E86]">
              Figures are in {currency}. Not included:{' '}
              {snapshot.excludedCurrencies
                .map((c) => `${c.invoiceCount} invoice${c.invoiceCount === 1 ? '' : 's'} in ${c.currency}`)
                .join(', ')}
              . Vyso does not convert currencies.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">
        {label}
      </div>
      <div className="of-num mt-1.5 text-[19px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-[#8A8E86]">{sub}</div>
    </div>
  );
}
