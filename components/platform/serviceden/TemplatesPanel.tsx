'use client';

import { useState } from 'react';
import { Badge, SectionCard } from '@/components/platform/module-ui';
import {
  CAMPAIGN_OPTIONS,
  TEMPLATE_BODY_LIMIT,
  TEMPLATE_KEYS,
  TEMPLATE_STAGE_BY_KEY,
  type EmailTemplate,
} from '@/lib/platform/notion-outreach';

type Draft = {
  pageId: string;
  name: string;
  campaign: string;
  templateKey: string;
  subject: string;
  body: string;
  active: boolean;
};

const BLANK: Draft = {
  pageId: '',
  name: '',
  campaign: 'Legacy',
  templateKey: 'initial',
  subject: '',
  body: '',
  active: true,
};

/**
 * These rows are what the n8n workflow actually sends. It looks a template up by
 * campaign + template key, so those two fields are the join and are validated
 * server-side; everything else is free text.
 */
const CAMPAIGN_COLOUR: Record<string, { bg: string; fg: string }> = {
  'Legacy': { bg: '#EAF2FC', fg: '#1F5FA8' },
  'Discovery First': { bg: '#F3EDFB', fg: '#6B3FA0' },
};

export function TemplatesPanel({ initial }: { initial: EmailTemplate[] }) {
  const [templates, setTemplates] = useState(initial);
  // Two levels: campaigns first, then that campaign's six-stage sequence. Twelve
  // templates in one flat list buries the thing you came to edit.
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = (t?: EmailTemplate) =>
    setDraft(
      t
        ? { pageId: t.id, name: t.name, campaign: t.campaign, templateKey: t.templateKey, subject: t.subject, body: t.body, active: t.active }
        : { ...BLANK },
    );

  async function refresh() {
    const res = await fetch('/api/serviceden/outreach/templates');
    if (res.ok) {
      const payload = (await res.json()) as { templates: EmailTemplate[] };
      setTemplates(payload.templates);
    }
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/serviceden/outreach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Save failed (${res.status})`);
      await refresh();
      setDraft(null);
      setNotice('Saved. The next automation run will use this copy.');
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const byCampaign = [...new Set(templates.map((t) => t.campaign))].sort();

  return (
    <div className="space-y-6">
      {notice ? (
        <div className="rounded-xl border border-[#B7DCC7] bg-[#F3FAF6] px-4 py-2.5 text-[13px] text-[#2F7D5B]">{notice}</div>
      ) : null}

      {openCampaign === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {byCampaign.map((campaign) => {
            const rows = templates.filter((t) => t.campaign === campaign);
            const live = rows.filter((t) => t.active).length;
            const c = CAMPAIGN_COLOUR[campaign] ?? { bg: '#F1F2F4', fg: '#6B7280' };
            return (
              <button
                key={campaign}
                type="button"
                onClick={() => setOpenCampaign(campaign)}
                className="rounded-2xl border border-[#EAEDF2] bg-white p-5 text-left shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition hover:border-[#1F5FA8]"
              >
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: c.bg, color: c.fg }}>
                  {campaign}
                </span>
                <div className="of-display mt-3 text-[17px] font-semibold text-[#171A17]">{rows.length}-email sequence</div>
                <div className="mt-1 text-[13px] text-[#8A8E86]">
                  {live} active{live !== rows.length ? ` · ${rows.length - live} inactive` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {rows.map((t) => (
                    <span key={t.id} className="rounded px-1.5 py-0.5 text-[11px]"
                      style={{ backgroundColor: t.active ? '#F4F6FA' : '#FCF3F2', color: t.active ? '#5C605A' : '#B4342B' }}>
                      {TEMPLATE_STAGE_BY_KEY[t.templateKey] ?? t.stage}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[12px] font-medium text-[#1F5FA8]">Open sequence →</div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => open()}
            className="rounded-2xl border border-dashed border-[#D7DCE4] p-5 text-left text-[13px] text-[#8A8E86] transition hover:border-[#1F5FA8] hover:text-[#1F5FA8]"
          >
            <div className="of-display text-[15px] font-semibold">+ New template</div>
            <div className="mt-1">Add a stage, or start a third campaign. Anything ticked &ldquo;Active for New Leads&rdquo; in Notion joins the rotation automatically.</div>
          </button>
        </div>
      ) : (
        <SectionCard
          title={`${openCampaign} sequence`}
          right={
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpenCampaign(null)}
                className="rounded-lg border border-[#EAEDF2] px-3 py-1.5 text-[12px] font-medium text-[#5C605A] hover:bg-[#F4F6FA]">
                ← All campaigns
              </button>
              <button type="button" onClick={() => open()}
                className="rounded-lg bg-[#1F5FA8] px-3 py-1.5 text-[12px] font-medium text-white">
                + New template
              </button>
            </div>
          }
        >
          <ul className="divide-y divide-[#F4F6FA]">
            {templates
              .filter((t) => t.campaign === openCampaign)
              .map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#A0A49C]">{t.sequenceOrder ?? '—'}</span>
                      <span className="font-medium text-[#171A17]">{TEMPLATE_STAGE_BY_KEY[t.templateKey] ?? t.stage}</span>
                      {!t.active ? <Badge label="inactive" tone="critical" /> : null}
                    </div>
                    <div className="mt-1 truncate text-[13px] text-[#5C605A]">{t.subject}</div>
                    <div className="mt-0.5 line-clamp-2 text-[12px] text-[#A0A49C]">{t.body.slice(0, 160)}…</div>
                  </div>
                  <button type="button" onClick={() => open(t)}
                    className="shrink-0 rounded-lg border border-[#EAEDF2] px-3 py-1.5 text-[12px] font-medium text-[#5C605A] hover:bg-[#F4F6FA]">
                    Edit
                  </button>
                </li>
              ))}
          </ul>
        </SectionCard>
      )}

      {draft ? (
        <SectionCard title={draft.pageId ? 'Edit template' : 'New template'}>
          <div className="space-y-4">
            {error ? <div className="rounded-lg border border-[#E7B4AF] bg-[#FCF3F2] px-3 py-2 text-[13px] text-[#B4342B]">{error}</div> : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-[12px] font-medium text-[#5C605A]">Name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]" />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[#5C605A]">Campaign</span>
                <select value={draft.campaign} onChange={(e) => setDraft({ ...draft, campaign: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]">
                  {CAMPAIGN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[#5C605A]">Stage</span>
                <select value={draft.templateKey} onChange={(e) => setDraft({ ...draft, templateKey: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]">
                  {TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{TEMPLATE_STAGE_BY_KEY[k]}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-[12px] font-medium text-[#5C605A]">Subject</span>
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]" />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-[12px] font-medium text-[#5C605A]">
                <span>Body</span>
                <span className={draft.body.length > TEMPLATE_BODY_LIMIT ? 'text-[#B4342B]' : 'text-[#A0A49C]'}>
                  {draft.body.length} / {TEMPLATE_BODY_LIMIT}
                </span>
              </span>
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={16}
                className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:border-[#1F5FA8]" />
            </label>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-[#5C605A]">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Active
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] text-[#5C605A]">Cancel</button>
                <button type="button" onClick={submit} disabled={busy}
                  className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save template'}
                </button>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-[#A0A49C]">
              Placeholders like <code className="rounded bg-[#F4F6FA] px-1">{'{{company_name}}'}</code>,{' '}
              <code className="rounded bg-[#F4F6FA] px-1">{'{{first_name}}'}</code> and{' '}
              <code className="rounded bg-[#F4F6FA] px-1">{'{{specific_observation_from_website}}'}</code> are filled per lead
              at send time. Deactivating a template halts the run at that stage rather than sending a blank email, so leave
              a replacement active if you deactivate one.
            </p>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
