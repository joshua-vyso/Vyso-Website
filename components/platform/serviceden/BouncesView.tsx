'use client';

import { Badge, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import type { OutreachBounce } from '@/lib/platform/outreach-bounces';

/**
 * A bounced lead is not a dead lead — it is a lead on the wrong channel. The
 * table leads with the fallback (phone, then website) rather than the failure,
 * because the useful action is calling them, not re-reading the SMTP error.
 */
export function BouncesView({ bounces, error }: { bounces: OutreachBounce[]; error: string | null }) {
  if (error) {
    return (
      <SectionCard title="Bounces">
        <p className="text-[14px] text-[#B4342B]">{error}</p>
      </SectionCard>
    );
  }

  const hard = bounces.filter((b) => b.kind === 'hard');
  const soft = bounces.filter((b) => b.kind === 'soft');
  const reachable = hard.filter((b) => b.phone);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[#8A8E86]">Delivery failures from the last 30 days, matched to leads.</p>
      </div>

      <KpiStrip>
        <Kpi label="Hard bounces" value={String(hard.length)} accent={hard.length ? '#B4342B' : undefined} sub="address does not exist" />
        <Kpi label="Soft bounces" value={String(soft.length)} sub="temporary, may still land" />
        <Kpi
          label="Reachable by phone"
          value={String(reachable.length)}
          accent={reachable.length ? '#2F7D5B' : undefined}
          sub="of the hard bounces"
        />
      </KpiStrip>

      <SectionCard title={`Bounced (${bounces.length})`}>
        {bounces.length === 0 ? (
          <p className="text-[13px] text-[#A0A49C]">
            No delivery failures. Either everything landed, or nothing has been sent from this mailbox recently.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                  {['Business', 'Type', 'Try instead', 'Failed', 'Reason'].map((h) => (
                    <th key={h} className="px-2 py-2.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bounces.map((b) => (
                  <tr key={b.messageId} className="border-b border-[#F4F6FA] align-top last:border-0">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-[#171A17]">{b.company ?? '(not a current lead)'}</div>
                      <div className="text-[12px] text-[#A0A49C]">{b.email}</div>
                      {b.stage ? <div className="mt-1"><Badge label={b.stage} tone="neutral" /></div> : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge label={b.kind === 'hard' ? 'hard' : 'soft'} tone={b.kind === 'hard' ? 'critical' : 'warning'} />
                      <div className="mt-1 text-[11px] text-[#A0A49C]">{b.status}</div>
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
                    <td className="px-2 py-2.5 whitespace-nowrap text-[#5C605A]">{b.failedAt.slice(0, 10)}</td>
                    <td className="px-2 py-2.5 text-[12px] text-[#8A8E86]">{b.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[12px] leading-relaxed text-[#A0A49C]">
          Hard bounces will not deliver however many times the sequence retries, so clear the Next follow-up on those
          leads to take them out of rotation. Soft bounces are usually a full mailbox or a greylist and often land on
          the next attempt. Note that a domain accepting mail is not proof a person reads it — catch-all servers accept
          everything, so silence is not always a bounce.
        </p>
      </SectionCard>
    </div>
  );
}
