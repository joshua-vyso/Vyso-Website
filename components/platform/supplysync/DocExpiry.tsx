'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import type { DocExpiryItem } from '@/lib/platform/supplysync-insights';
import { useSupplySync } from './context';
import { ExpiryBadge, EXPIRY_META, SupplierNameButton, fmtDate, RED, AMBER, GREEN, MUTE } from './shared';

/** Days a logged request keeps the row marked as chased. */
const REQUEST_COOLDOWN_DAYS = 30;

function daysAgo(dateStr: string): number {
  const t = new Date(`${dateStr}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return Number.MAX_SAFE_INTEGER;
  return Math.round((Date.now() - t) / 86_400_000);
}

/** Days-remaining readout: overdue in red, tight in amber, comfortable in green. */
function Remaining({ days }: { days: number | null }) {
  if (days === null) return <span className="of-num" style={{ color: MUTE }}>No expiry on file</span>;
  const color = days < 0 ? RED : days <= 14 ? AMBER : GREEN;
  const text = days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`;
  return <span className="of-num font-medium" style={{ color }}>{text}</span>;
}

/**
 * Compliance documents that need a human, as a worklist rather than a table:
 * urgency, what to do, and the one action that does it. "Request" writes a real
 * `document_request` event onto the supplier's relationship timeline (with a
 * week's follow-up), so the chase is on the record instead of in someone's head.
 */
export function DocExpiryPanel({ limit, showSupplier = true }: { limit?: number; showSupplier?: boolean }) {
  const { docExpiries, supplierById } = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();
  const { node: toastNode, show } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const rows = limit ? docExpiries.slice(0, limit) : docExpiries;

  /** Has this document been chased recently (server truth or this session)? */
  function alreadyRequested(item: DocExpiryItem): boolean {
    if (requested[item.id]) return true;
    const supplier = supplierById(item.supplierId);
    return (supplier?.history ?? []).some(
      (h) =>
        h.eventType === 'document_request' &&
        h.summary.toLowerCase().includes(item.label.toLowerCase()) &&
        daysAgo(h.date) <= REQUEST_COOLDOWN_DAYS,
    );
  }

  async function requestDocument(item: DocExpiryItem) {
    if (savingId) return;
    setSavingId(item.id);

    const supabase = createClient();
    if (!supabase || !org) {
      setSavingId(null);
      show('Not connected — the request was not logged.');
      return;
    }

    const today = new Date();
    const followUp = new Date(today.getTime() + 7 * 86_400_000);
    const { error } = await supabase.from('ss_supplier_history').insert({
      org_id: org.id,
      supplier_id: item.supplierId,
      event_type: 'document_request',
      channel: 'Document Request',
      summary: `Requested ${item.label} — ${item.urgency === 'missing' ? 'never supplied' : `expiry ${fmtDate(item.expiry)}`}`,
      follow_up: `Chase ${item.label} from ${item.supplierName}`,
      follow_up_date: followUp.toISOString().slice(0, 10),
      event_date: today.toISOString().slice(0, 10),
    });

    setSavingId(null);
    if (error) {
      show(error.message);
      return;
    }
    setRequested((m) => ({ ...m, [item.id]: true }));
    show(`${item.label} requested from ${item.supplierName}`);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-10 text-center">
          <p className="of-display text-[16px] font-semibold text-[#171A17]">Every document is in date</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#6B6F68]">
            Nothing is missing, expired or inside its renewal window. Documents appear here automatically as their
            expiry approaches.
          </p>
        </div>
        {toastNode}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {rows.map((item) => {
          const meta = EXPIRY_META[item.urgency];
          const chased = alreadyRequested(item);
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-[#EEF1F5] bg-white p-3.5"
              style={{ borderLeft: `3px solid ${meta.color}` }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="of-display text-[15px] font-semibold text-[#171A17]">{item.label}</span>
                  <ExpiryBadge urgency={item.urgency} />
                  {showSupplier ? (
                    <SupplierNameButton id={item.supplierId} name={item.supplierName} className="text-[13px]" />
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] leading-snug text-[#6B6F68]">{item.action}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#A0A49C]">
                  <span className="of-num">Expiry {fmtDate(item.expiry)}</span>
                  <Remaining days={item.daysRemaining} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestDocument(item)}
                disabled={savingId === item.id || chased}
                className="inline-flex h-9 shrink-0 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {savingId === item.id ? 'Logging…' : chased ? 'Requested' : 'Request document'}
              </button>
            </div>
          );
        })}
      </div>
      {toastNode}
    </>
  );
}
