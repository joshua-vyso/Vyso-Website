'use client';

import { useState } from 'react';
import { Badge, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';

export type BounceRow = {
  key: string;
  leadId: string | null;
  company: string | null;
  email: string;
  kind: 'hard' | 'soft';
  status: string;
  reason: string;
  failedAt: string;
  phone: string | null;
  website: string | null;
  stage: string | null;
  /** Already marked in Notion, so the automation is not emailing it. */
  recorded: boolean;
};

/**
 * The permanent bounce record. Notion rows stay forever; the mailbox scan adds
 * fresh detail and surfaces failures not yet recorded — one click marks those
 * in Notion, which is what actually stops the automation emailing them again.
 */
export function BouncesView({ rows: initial, error, scanError }: { rows: BounceRow[]; error: string | null; scanError: string | null }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  if (error) {
    return (
      <SectionCard title="Bounces">
        <p className="text-[14px] text-[#B4342B]">{error}</p>
      </SectionCard>
    );
  }

  async function record(row: BounceRow) {
    if (!row.leadId) return;
    setBusy(row.key);
    setRecordError(null);
    try {
      const res = await fetch(`/api/serviceden/outreach/leads/${row.leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailStatus: 'Bounced' }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Save failed (${res.status})`);
      }
      setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, recorded: true } : r)));
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  const hard = rows.filter((b) => b.kind === 'hard');
  const unrecorded = rows.filter((b) => !b.recorded && b.leadId);
  const reachable = hard.filter((b) => b.phone);

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-[#8A8E86]">
        Every address that has ever bounced. Recorded rows are excluded from the automation&rsquo;s follow-ups; the
        mailbox scan covers the last 90 days of delivery reports.
      </p>

      {scanError ? (
        <div className="rounded-lg border border-[#EAD9A8] bg-[#FCF9EF] px-3 py-2 text-[13px] text-[#9A6B14]">
          Mailbox scan unavailable ({scanError}) — showing the Notion record only.
        </div>
      ) : null}
      {recordError ? (
        <div className="rounded-lg border border-[#E7B4AF] bg-[#FCF3F2] px-3 py-2 text-[13px] text-[#B4342B]">{recordError}</div>
      ) : null}

      <KpiStrip>
        <Kpi label="Bounced addresses" value={String(rows.length)} accent={rows.length ? '#B4342B' : undefined} sub="all time" />
        <Kpi
          label="Not yet recorded"
          value={String(unrecorded.length)}
          accent={unrecorded.length ? '#9A6B14' : undefined}
          sub="automation still emails these"
        />
        <Kpi
          label="Reachable by phone"
          value={String(reachable.length)}
          accent={reachable.length ? '#2F7D5B' : undefined}
          sub="call instead"
        />
      </KpiStrip>

      <SectionCard title={`Bounced (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-[13px] text-[#A0A49C]">No delivery failures on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                  {['Business', 'Type', 'Suppressed?', 'Try instead', 'Failed', 'Reason'].map((h) => (
                    <th key={h} className="px-2 py-2.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.key} className="border-b border-[#F4F6FA] align-top last:border-0">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-[#171A17]">{b.company ?? '(not a current lead)'}</div>
                      <div className="text-[12px] text-[#A0A49C]">{b.email}</div>
                      {b.stage ? <div className="mt-1"><Badge label={b.stage} tone="neutral" /></div> : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge label={b.kind} tone={b.kind === 'hard' ? 'critical' : 'warning'} />
                      <div className="mt-1 text-[11px] text-[#A0A49C]">{b.status}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      {b.recorded ? (
                        <Badge label="suppressed" tone="positive" />
                      ) : b.leadId ? (
                        <button
                          type="button"
                          disabled={busy === b.key}
                          onClick={() => record(b)}
                          className="rounded-lg bg-[#B4342B] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-60"
                        >
                          {busy === b.key ? 'Recording…' : 'Stop emailing'}
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#A0A49C]">no lead match</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {b.phone ? (
                        <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="font-medium text-[#2F7D5B] hover:underline">
                          {b.phone}
                        </a>
                      ) : b.website ? (
                        <a href={b.website} target="_blank" rel="noreferrer" className="text-[#1F5FA8] hover:underline">
                          contact form
                        </a>
                      ) : (
                        <span className="text-[#A0A49C]">no fallback</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-[#5C605A]">{b.failedAt || '—'}</td>
                    <td className="px-2 py-2.5 text-[12px] text-[#8A8E86]">{b.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[12px] leading-relaxed text-[#A0A49C]">
          The n8n run also records bounces automatically when it scans the inbox, so most rows arrive suppressed. A
          bounced lead is on the wrong channel, not dead — the phone number is right there. Soft bounces are usually a
          full mailbox or a greylist and often land on the next attempt, so they are not suppressed automatically.
        </p>
      </SectionCard>
    </div>
  );
}
