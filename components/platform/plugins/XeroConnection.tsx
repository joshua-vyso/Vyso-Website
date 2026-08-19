'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The Xero connection — connect, reconnect, disconnect, and what state it is in.
 *
 * MOVED, NOT REWRITTEN. This is `components/platform/settings/XeroIntegrationCard.tsx`
 * lifted onto the plugin page (plan X1, "Connection"), which is why the markup
 * and the disconnect flow below are the ones that already shipped. `/app/settings`
 * now carries a one-line link here instead of a second copy of this card: two
 * screens that can both connect an accounting system are two screens that can
 * disagree about whether it is connected.
 *
 * WHAT CHANGED IN THE MOVE, and why:
 *   - The heading dropped. On settings this was one card among six and needed to
 *     announce itself; here it is the first block of a page whose title is
 *     already "Xero", and repeating the word three times in 40px of vertical
 *     space is the kind of thing that reads as a template rather than a product.
 *   - The blurb tells the truth about X1. The old copy promised "export customers
 *     and draft invoices, then keep payment status in sync" — Vyso does not write
 *     to Xero at all, in this wave or any previous one. It READS. Saying so is
 *     not a smaller claim, it is the only honest one.
 *   - `last_synced_at` moved to the Snapshot block, which is where the rest of
 *     the sync's output lives.
 *
 * `confirm()` before disconnecting, unchanged from the card this came from.
 * Disconnecting revokes tokens at Xero and cannot be undone with a click — the
 * owner reconnects through Xero's consent screen — so it earns the one native
 * dialog in this section.
 */

export interface XeroConnectionSummary {
  id: string;
  tenant_name: string;
  status: string;
  last_synced_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  connected: 'Connected',
  syncing: 'Syncing',
  error: 'Needs attention',
  reauth_required: 'Reconnect required',
  disconnected: 'Disconnected',
};

export function XeroConnection({
  configured,
  canManage,
  connection,
  notice,
  initialError,
}: {
  /** Server credentials + service role are both present. Without them nothing on
   *  this page can work, and the card says so rather than offering a dead button. */
  configured: boolean;
  canManage: boolean;
  connection: XeroConnectionSummary | null;
  /** "Connected {tenant}" after a successful OAuth round-trip. */
  notice: string | null;
  /** The `?xero_error=` the callback route redirects back with. */
  initialError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [warning, setWarning] = useState<string | null>(null);
  const hasActiveConnection =
    connection?.status === 'connected' ||
    connection?.status === 'syncing' ||
    connection?.status === 'error';
  const healthy = connection?.status === 'connected' || connection?.status === 'syncing';

  async function disconnect() {
    if (!confirm(`Disconnect ${connection?.tenant_name ?? 'this Xero organisation'} from Vyso?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const response = await fetch('/api/integrations/xero/disconnect', { method: 'POST' });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        warning?: string | null;
      };
      if (!response.ok) {
        setError(result.error ?? 'Could not disconnect Xero.');
        return;
      }
      setWarning(result.warning ?? null);
      // The house mutation shape: an org-scoped write, then `router.refresh()`
      // to reconcile with server truth. No optimistic local state — the status
      // pill above is read from the row.
      router.refresh();
    } catch {
      setError('Could not disconnect Xero.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="of-display text-[16px] font-semibold text-[#171A17]">Connection</div>
          <p className="mt-1 text-[13px] text-[#6B6F68]">
            Vyso reads your Xero invoices and contacts. It never writes to Xero.
          </p>
        </div>
        {connection ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
              healthy
                ? 'bg-[#E7F4EA] text-[#27733B]'
                : connection.status === 'reauth_required'
                  ? 'bg-[#FBEEDA] text-[#854F0B]'
                  : 'bg-[#EEF1F5] text-[#6B6F68]'
            }`}
          >
            {STATUS_LABELS[connection.status] ?? connection.status}
          </span>
        ) : null}
      </div>

      {!configured ? (
        <p className="mt-4 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
          Xero’s server credentials or the Supabase service role are not configured.
        </p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-[12px] border border-[#D5EAD9] bg-[#F2FAF4] p-3 text-[13px] text-[#27733B]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[12px] border border-[#F3D1D1] bg-[#FFF7F7] p-3 text-[13px] text-[#A32D2D]">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mt-4 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
          {warning}
        </p>
      ) : null}

      {connection && connection.status !== 'disconnected' ? (
        <div className="mt-4 rounded-[12px] border border-[#E4E9F0] bg-[#F8FAFC] p-3.5">
          <div className="text-[13px] font-semibold text-[#171A17]">{connection.tenant_name}</div>
          <p className="mt-1 text-[12px] text-[#8A8E86]">
            {connection.status === 'reauth_required'
              ? 'Xero has stopped accepting Vyso’s access. Reconnect to start reading again.'
              : 'The Xero organisation Vyso reads.'}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canManage && configured && (!connection || connection.status === 'disconnected') ? (
          <a
            href="/api/integrations/xero/connect"
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
          >
            Connect Xero
          </a>
        ) : null}
        {canManage && configured && connection?.status === 'reauth_required' ? (
          <a
            href="/api/integrations/xero/connect"
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
          >
            Reconnect Xero
          </a>
        ) : null}
        {canManage && hasActiveConnection ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:border-[#F3D1D1] hover:bg-[#FFF7F7] hover:text-[#A32D2D] disabled:opacity-40"
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : null}
        {!canManage ? (
          <p className="text-[13px] text-[#6B6F68]">An owner or admin manages this connection.</p>
        ) : null}
      </div>
    </div>
  );
}
