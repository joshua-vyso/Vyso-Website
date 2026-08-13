'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CAMPAIGN_OPTIONS,
  INDUSTRY_OPTIONS,
  OUTCOME_OPTIONS,
  OUTREACH_STAGES,
  type OutreachLead,
} from '@/lib/platform/notion-outreach';

type Field = 'company' | 'email' | 'phone' | 'website' | 'industry' | 'campaign' | 'outreachStage' | 'icpScore' | 'nextFollowUp' | 'outcome';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Colour matches the Notion select colours so the two surfaces read the same way.
 * Stage runs cool -> warm as a lead ages through the sequence.
 */
const STAGE_COLOUR: Record<string, { bg: string; fg: string }> = {
  'Contacted': { bg: '#EAF2FC', fg: '#1F5FA8' },
  '1st Follow-Up': { bg: '#FDF4E3', fg: '#9A6B14' },
  '2nd Follow-Up': { bg: '#FDEEE0', fg: '#A65A1F' },
  '3rd Follow-Up': { bg: '#F4EAE2', fg: '#7A5236' },
  'Breakup': { bg: '#FCF3F2', fg: '#B4342B' },
  'Meeting Booked': { bg: '#F3FAF6', fg: '#2F7D5B' },
};

const CAMPAIGN_COLOUR: Record<string, { bg: string; fg: string }> = {
  'Legacy': { bg: '#EAF2FC', fg: '#1F5FA8' },
  'Discovery First': { bg: '#F3EDFB', fg: '#6B3FA0' },
  'Original': { bg: '#F1F2F4', fg: '#6B7280' },
};

const NEUTRAL = { bg: 'transparent', fg: '#2C333B' };

/**
 * Notion-style inline editing. Every cell writes straight through to Notion on
 * blur or change, so there is no explicit save. Edits are applied optimistically
 * and rolled back if the API rejects them, because a silent failure here would
 * leave the screen disagreeing with the database the automation actually reads.
 */
export function OutreachTable({ initial }: { initial: OutreachLead[] }) {
  const [rows, setRows] = useState(initial);
  const [state, setState] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.company, r.email, r.industry ?? '', r.campaign, r.outreachStage ?? ''].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  const save = useCallback(
    async (lead: OutreachLead, field: Field, raw: string) => {
      const key = `${lead.id}:${field}`;
      const previous = rows;

      const value: string | number | null =
        field === 'icpScore' ? (raw === '' ? null : Number(raw)) : raw;

      // Nothing changed — don't spend a Notion write on a blur.
      const current = field === 'icpScore' ? (lead.icpScore ?? '') : ((lead[field] as string | null) ?? '');
      if (String(current) === String(raw)) return;

      setRows((rs) => rs.map((r) => (r.id === lead.id ? { ...r, [field]: value } : r)));
      setState((s) => ({ ...s, [key]: 'saving' }));
      setErrors((e) => ({ ...e, [key]: '' }));

      try {
        const res = await fetch(`/api/serviceden/outreach/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || `Save failed (${res.status})`);
        }
        setState((s) => ({ ...s, [key]: 'saved' }));
        setTimeout(() => setState((s) => ({ ...s, [key]: 'idle' })), 1200);
      } catch (error) {
        setRows(previous);
        setState((s) => ({ ...s, [key]: 'error' }));
        setErrors((e) => ({ ...e, [key]: error instanceof Error ? error.message : 'Save failed' }));
      }
    },
    [rows],
  );

  const swatch = (c?: { bg: string; fg: string }) => {
    const v = c ?? NEUTRAL;
    return { backgroundColor: v.bg, color: v.fg, borderRadius: '0.5rem' };
  };

  const cellClass = (key: string) =>
    `w-full rounded-lg border px-2 py-1.5 text-[13px] outline-none transition ${
      state[key] === 'error'
        ? 'border-[#E7B4AF] bg-[#FCF3F2]'
        : state[key] === 'saved'
          ? 'border-[#B7DCC7] bg-[#F3FAF6]'
          : 'border-transparent bg-transparent hover:border-[#EAEDF2] focus:border-[#1F5FA8] focus:bg-white'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads…"
          className="w-64 rounded-lg border border-[#EAEDF2] px-3 py-1.5 text-[13px] outline-none focus:border-[#1F5FA8]"
        />
        <span className="text-[12px] text-[#A0A49C]">
          {visible.length} of {rows.length} · edits save to Notion automatically
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <table className="w-full min-w-[1100px] text-[13px]">
          <thead>
            <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
              {['Business', 'Email', 'Phone', 'Stage', 'Campaign', 'Industry', 'ICP', 'Next follow-up', 'Outcome', 'Website'].map((h) => (
                <th key={h} className="px-2 py-2.5 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((lead) => {
              const err = Object.entries(errors).find(([k, v]) => k.startsWith(`${lead.id}:`) && v)?.[1];
              return (
                <tr key={lead.id} className="border-b border-[#F4F6FA] last:border-0 align-top">
                  <td className="px-2 py-1.5">
                    <input defaultValue={lead.company} onBlur={(e) => save(lead, 'company', e.target.value)}
                      className={cellClass(`${lead.id}:company`)} />
                    {err ? <div className="px-2 pt-1 text-[11px] text-[#B4342B]">{err}</div> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <input defaultValue={lead.email} onBlur={(e) => save(lead, 'email', e.target.value)}
                      className={cellClass(`${lead.id}:email`)} />
                    {lead.emailStatus === 'Bounced' ? (
                      <div className="px-2 pt-0.5 text-[11px] font-medium text-[#B4342B]">bounced — not emailed</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <input defaultValue={lead.phone ?? ''} onBlur={(e) => save(lead, 'phone', e.target.value)}
                      className={cellClass(`${lead.id}:phone`)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={lead.outreachStage ?? ''} onChange={(e) => save(lead, 'outreachStage', e.target.value)}
                      style={swatch(STAGE_COLOUR[lead.outreachStage ?? ''])}
                      className={`${cellClass(`${lead.id}:outreachStage`)} font-medium`}>
                      <option value="">—</option>
                      {OUTREACH_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={lead.campaign === 'Unassigned' || lead.campaign === 'Original' ? '' : lead.campaign}
                      onChange={(e) => save(lead, 'campaign', e.target.value)}
                      style={swatch(CAMPAIGN_COLOUR[lead.campaign])}
                      className={`${cellClass(`${lead.id}:campaign`)} font-medium`}>
                      <option value="">{lead.campaign === 'Original' ? 'Original' : '—'}</option>
                      {CAMPAIGN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={lead.industry ?? ''} onChange={(e) => save(lead, 'industry', e.target.value)}
                      className={cellClass(`${lead.id}:industry`)}>
                      <option value="">—</option>
                      {/* Segment-defined industries are not in the static list; keep the
                          current value selectable rather than blanking it. */}
                      {lead.industry && !(INDUSTRY_OPTIONS as readonly string[]).includes(lead.industry)
                        ? <option value={lead.industry}>{lead.industry}</option> : null}
                      {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 w-[70px]">
                    <input type="number" min={0} max={8} defaultValue={lead.icpScore ?? ''}
                      onBlur={(e) => save(lead, 'icpScore', e.target.value)}
                      className={cellClass(`${lead.id}:icpScore`)} />
                  </td>
                  <td className="px-2 py-1.5 w-[140px]">
                    <input type="date" defaultValue={lead.nextFollowUp ?? ''}
                      onBlur={(e) => save(lead, 'nextFollowUp', e.target.value)}
                      className={cellClass(`${lead.id}:nextFollowUp`)} />
                  </td>
                  <td className="px-2 py-1.5 w-[150px]">
                    <select value={lead.outcome ?? ''} onChange={(e) => save(lead, 'outcome', e.target.value)}
                      className={cellClass(`${lead.id}:outcome`)}>
                      <option value="">—</option>
                      {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input defaultValue={lead.website ?? ''} onBlur={(e) => save(lead, 'website', e.target.value)}
                      className={cellClass(`${lead.id}:website`)} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-[13px] text-[#A0A49C]">No leads match that search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-[#A0A49C]">
        Changing Stage or Next follow-up changes what the automation sends next. Clearing Next follow-up stops the
        sequence for that lead.
      </p>
    </div>
  );
}
