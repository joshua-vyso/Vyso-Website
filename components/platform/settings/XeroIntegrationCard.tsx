'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export function XeroIntegrationCard({
  configured,
  canManage,
  connection,
  notice,
  initialError,
}: {
  configured: boolean;
  canManage: boolean;
  connection: XeroConnectionSummary | null;
  notice: string | null;
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
        <div>
          <div className="of-display text-[16px] font-semibold text-[#171A17]">Xero accounting</div>
          <p className="mt-1 text-[13px] text-[#6B6F68]">
            Export customers and draft invoices, then keep payment status in sync.
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
            {connection.last_synced_at
              ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
              : 'Connected; initial data sync has not started yet.'}
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
