'use client';

import { useMemo, useState } from 'react';
import { Badge, DataTable, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import type { OutreachLead } from '@/lib/platform/notion-outreach';

export type SalesState =
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; leads: OutreachLead[]; contactedTotal: number };

/**
 * A lead lands here the moment it replies. The outreach sequence stops at that
 * point, so the stage shown below is where the DEAL stands, not where the email
 * sequence got to — the two are tracked separately on purpose.
 *
 * Sales stage is not yet persisted: replying puts a lead in "Replied" and a human
 * moves it on from there. Wiring the picker to storage is the next step.
 */
const SALES_STAGES = ['Replied', 'Discovery', 'Pilot proposed', 'Founding customer', 'Won', 'Lost'] as const;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export function SalesView({ state }: { state: SalesState }) {
  const [campaignFilter, setCampaignFilter] = useState<string>('All');

  const campaigns = useMemo(() => {
    if (state.kind !== 'ready') return ['All'];
    return ['All', ...new Set(state.leads.map((l) => l.campaign))];
  }, [state]);

  const visible = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const rows = campaignFilter === 'All' ? state.leads : state.leads.filter((l) => l.campaign === campaignFilter);
    // Freshest replies first — those are the ones going cold if ignored.
    return [...rows].sort((a, b) => (b.repliedOn ?? '').localeCompare(a.repliedOn ?? ''));
  }, [state, campaignFilter]);

  if (state.kind === 'unconfigured') {
    return (
      <SectionCard title="Sales">
        <p className="text-[14px] text-[#5C605A]">
          Notion is not connected yet. Add a <code className="rounded bg-[#F4F6FA] px-1.5 py-0.5">NOTION_API_KEY</code>{' '}
          to the server environment and share the Lead Hub database with that integration.
        </p>
      </SectionCard>
    );
  }

  if (state.kind === 'error') {
    return (
      <SectionCard title="Sales">
        <p className="text-[14px] text-[#B4342B]">{state.message}</p>
      </SectionCard>
    );
  }

  const meetings = state.leads.filter((l) => l.outreachStage === 'Meeting Booked').length;
  const handoffRate = state.contactedTotal ? (state.leads.length / state.contactedTotal) * 100 : 0;
  const waiting = state.leads.filter((l) => l.outreachStage !== 'Meeting Booked').length;

  return (
    <div className="space-y-6">
      <KpiStrip>
        <Kpi label="In sales" value={String(state.leads.length)} sub="replied or booked" />
        <Kpi label="Awaiting action" value={String(waiting)} accent={waiting > 0 ? '#B4342B' : undefined} sub="replied, no meeting yet" />
        <Kpi label="Meetings booked" value={String(meetings)} accent="#2F7D5B" />
        <Kpi label="Hand-off rate" value={`${handoffRate.toFixed(1)}%`} sub={`of ${state.contactedTotal} contacted`} />
      </KpiStrip>

      <SectionCard
        title="Replied leads"
        right={
          <div className="flex flex-wrap gap-1.5">
            {campaigns.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCampaignFilter(c)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                  campaignFilter === c ? 'bg-[#1F5FA8] text-white' : 'bg-[#F4F6FA] text-[#5C605A] hover:bg-[#EAEDF2]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        }
      >
        <DataTable
          columns={[
            { label: 'Business' },
            { label: 'Won by' },
            { label: 'Replied' },
            { label: 'Industry' },
            { label: 'ICP', align: 'right' },
            { label: 'Stage reached', align: 'right' },
          ]}
          rows={visible.map((l) => {
            const age = daysSince(l.repliedOn);
            return [
              <span key="n" className="flex flex-col">
                <span className="font-medium text-[#171A17]">{l.company || '—'}</span>
                <span className="text-[12px] text-[#A0A49C]">{l.email}</span>
              </span>,
              // Which outreach strategy earned this reply. The whole point of keeping
              // campaign attribution once a lead crosses into sales.
              <Badge key="c" label={l.campaign} tone={l.campaign === 'Discovery First' ? 'info' : 'neutral'} />,
              <span key="r" className="flex flex-col">
                <span>{l.repliedOn ?? '—'}</span>
                {age != null ? (
                  <span className={`text-[12px] ${age > 3 ? 'text-[#B4342B]' : 'text-[#A0A49C]'}`}>
                    {age === 0 ? 'today' : `${age}d ago`}
                  </span>
                ) : null}
              </span>,
              l.industry ?? '—',
              l.icpScore ?? '—',
              l.outreachStage === 'Meeting Booked' ? (
                <Badge key="s" label="Meeting booked" tone="positive" />
              ) : (
                <span key="s" className="text-[#A0A49C]">after {l.outreachStage ?? '—'}</span>
              ),
            ];
          })}
          empty="No replies yet. Leads appear here automatically the moment they answer."
        />
      </SectionCard>

      <SectionCard title="Pipeline stages">
        <div className="flex flex-wrap gap-2">
          {SALES_STAGES.map((stage) => (
            <span
              key={stage}
              className="rounded-full border border-[#EAEDF2] bg-[#FBFCFE] px-3 py-1.5 text-[13px] text-[#5C605A]"
            >
              {stage}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[#A0A49C]">
          Sales stage is not stored yet, so every replied lead shows as newly handed over. Persisting it needs a column
          in Lead Hub or a move to Supabase, which is the next decision rather than something to guess at here.
        </p>
      </SectionCard>
    </div>
  );
}
