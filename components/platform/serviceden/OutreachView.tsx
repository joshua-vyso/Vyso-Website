'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, DataTable, Kpi, KpiStrip, SectionCard, type Tone } from '@/components/platform/module-ui';
import {
  MIN_SAMPLE_FOR_SIGNIFICANCE,
  type CampaignMetrics,
  type OutreachLead,
  type OutreachStage,
} from '@/lib/platform/notion-outreach';

export type OutreachState =
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      leads: OutreachLead[];
      metrics: CampaignMetrics[];
      industries: { industry: string; leads: number; replied: number }[];
      outcomes: { outcome: string; count: number; industries: string[] }[];
      totalLeads: number;
    };

const STAGE_TONE: Record<OutreachStage, Tone> = {
  Contacted: 'info',
  '1st Follow-Up': 'neutral',
  '2nd Follow-Up': 'warning',
  '3rd Follow-Up': 'warning',
  Breakup: 'critical',
  'Meeting Booked': 'positive',
};

const STAGE_ORDER: OutreachStage[] = [
  'Contacted',
  '1st Follow-Up',
  '2nd Follow-Up',
  '3rd Follow-Up',
  'Breakup',
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function todayISO(): string {
  // The automation schedules everything in SAST, so "due today" has to be read
  // in the same zone or the follow-up count is a day out for part of the day.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
}

export function OutreachView({ state }: { state: OutreachState }) {
  const [campaignFilter, setCampaignFilter] = useState<string>('All');

  const today = todayISO();

  const visible = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const rows = campaignFilter === 'All' ? state.leads : state.leads.filter((l) => l.campaign === campaignFilter);
    // Most recently contacted first — the overview is a "what just happened" list,
    // not the full database. Everything lives under All leads.
    return [...rows]
      .sort((a, b) => (b.mostRecentContact ?? '').localeCompare(a.mostRecentContact ?? ''))
      .slice(0, 5);
  }, [state, campaignFilter]);

  if (state.kind === 'unconfigured') {
    return (
      <SectionCard title="Outreach">
        <p className="text-[14px] text-[#5C605A]">
          Notion is not connected yet. Add a <code className="rounded bg-[#F4F6FA] px-1.5 py-0.5">NOTION_API_KEY</code>{' '}
          to the server environment, then share the Lead Hub, Template List and Email Templates databases with that
          integration from Notion.
        </p>
      </SectionCard>
    );
  }

  if (state.kind === 'error') {
    return (
      <SectionCard title="Outreach">
        <p className="text-[14px] text-[#B4342B]">{state.message}</p>
      </SectionCard>
    );
  }

  const dueToday = state.leads.filter((l) => l.nextFollowUp === today).length;
  const scored = state.leads.map((l) => l.icpScore).filter((n): n is number => typeof n === 'number');
  const avgIcp = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const campaigns = ['All', ...state.metrics.map((m) => m.campaign)];

  return (
    <div className="space-y-6">
      <KpiStrip>
        <Kpi label="In sequence" value={String(state.leads.length)} sub={`${state.totalLeads} contacted all time`} />
        <Kpi label="Due today" value={String(dueToday)} accent={dueToday > 0 ? '#1F5FA8' : undefined} sub="follow-ups queued" />
        <Kpi label="Avg ICP score" value={avgIcp == null ? '—' : avgIcp.toFixed(1)} sub="out of 8" />
        <Kpi
          label="Replied"
          value={String(state.metrics.reduce((a, m) => a + m.replied, 0))}
          sub="moved to sales"
        />
        <Kpi
          label="Meetings"
          value={String(state.metrics.reduce((a, m) => a + m.meetings, 0))}
          accent="#2F7D5B"
        />
      </KpiStrip>

      <SectionCard
        title="Campaign comparison"
        right={
          state.metrics.some((m) => m.underpowered) ? (
            <span className="text-[12px] text-[#A0A49C]">
              Under {MIN_SAMPLE_FOR_SIGNIFICANCE} leads per arm, treat differences as noise
            </span>
          ) : null
        }
      >
        <DataTable
          columns={[
            { label: 'Campaign' },
            { label: 'Leads', align: 'right' },
            { label: 'Replied', align: 'right' },
            { label: 'Reply rate', align: 'right' },
            { label: 'Meetings', align: 'right' },
            { label: 'Avg ICP', align: 'right' },
          ]}
          rows={state.metrics.map((m) => [
            <span key="c" className="flex items-center gap-2">
              {m.campaign}
              {m.underpowered ? <Badge label="small sample" tone="neutral" /> : null}
            </span>,
            m.leads,
            m.replied,
            pct(m.replyRate),
            m.meetings,
            m.avgIcpScore == null ? '—' : m.avgIcpScore.toFixed(1),
          ])}
          empty="No campaigns yet."
        />
        <p className="mt-3 text-[12px] leading-relaxed text-[#A0A49C]">
          Reply rate favours Discovery First by design: it asks a question and nothing else, while Legacy asks for a
          call. Judge them on meetings booked too. &ldquo;Original&rdquo; is the pre-experiment cohort and is not
          comparable with either.
        </p>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          title="Recently contacted"
          right={
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href="/app/serviceden/outreach/leads"
                className="rounded-full bg-[#EAF2FC] px-2.5 py-1 text-[12px] font-medium text-[#1F5FA8] hover:bg-[#DCEAFA]"
              >
                View all →
              </Link>
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
              { label: 'Stage' },
              { label: 'Campaign' },
              { label: 'Industry' },
              { label: 'ICP', align: 'right' },
              { label: 'Next follow-up', align: 'right' },
            ]}
            rows={visible.map((l) => [
              <span key="n" className="flex flex-col">
                <span className="font-medium text-[#171A17]">{l.company || '—'}</span>
                <span className="text-[12px] text-[#A0A49C]">{l.email}</span>
              </span>,
              l.outreachStage ? <Badge label={l.outreachStage} tone={STAGE_TONE[l.outreachStage]} /> : '—',
              l.campaign,
              l.industry ?? '—',
              l.icpScore ?? '—',
              <span key="d" className={l.nextFollowUp === today ? 'font-medium text-[#1F5FA8]' : undefined}>
                {l.nextFollowUp ?? '—'}
              </span>,
            ])}
            empty="Nothing in sequence yet. Run the lead engine to find new businesses."
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Sequence stages">
            <ul className="space-y-2.5">
              {STAGE_ORDER.map((stage) => {
                const n = state.leads.filter((l) => l.outreachStage === stage).length;
                const share = state.leads.length ? (n / state.leads.length) * 100 : 0;
                return (
                  <li key={stage}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#5C605A]">{stage}</span>
                      <span className="of-num font-medium text-[#171A17]">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F0F2F6]">
                      <div className="h-full rounded-full bg-[#3E7BC4]" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="How conversations end">
            <ul className="space-y-2">
              {state.outcomes.map((row) => (
                <li key={row.outcome} className="text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#5C605A]">{row.outcome}</span>
                    <span className="of-num font-medium text-[#171A17]">{row.count}</span>
                  </div>
                  {row.industries.length ? (
                    <div className="mt-0.5 truncate text-[11px] text-[#A0A49C]">{row.industries.join(', ')}</div>
                  ) : null}
                </li>
              ))}
              {state.outcomes.length === 0 ? (
                <li className="text-[13px] text-[#A0A49C]">
                  No outcomes recorded yet. Set them on the Sales page or in All leads — &ldquo;Too Expensive&rdquo; on a
                  lead that loved the product is exactly the signal worth counting.
                </li>
              ) : null}
            </ul>
          </SectionCard>

          <SectionCard title="Industries">
            <ul className="space-y-2">
              {state.industries.slice(0, 8).map((row) => (
                <li key={row.industry} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-[#5C605A]">{row.industry}</span>
                  <span className="of-num shrink-0 font-medium text-[#171A17]">
                    {row.leads}
                    {row.replied > 0 ? <span className="ml-1.5 text-[12px] text-[#2F7D5B]">{row.replied} replied</span> : null}
                  </span>
                </li>
              ))}
              {state.industries.length === 0 ? <li className="text-[13px] text-[#A0A49C]">No industry data yet.</li> : null}
            </ul>
            <p className="mt-3 text-[12px] text-[#A0A49C]">
              Only leads found after 6 Aug carry an industry.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
