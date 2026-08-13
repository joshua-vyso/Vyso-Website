'use client';

import { useMemo, useState } from 'react';
import { Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import type { OutreachSegment } from '@/lib/platform/notion-outreach';

type Draft = {
  pageId: string;
  name: string;
  dailyQuota: number;
  searchBrief: string;
  industryLabels: string;
  active: boolean;
  priority: number;
};

const BLANK: Draft = {
  pageId: '',
  name: '',
  dailyQuota: 10,
  searchBrief: '',
  industryLabels: '',
  active: true,
  priority: 2,
};

/**
 * The control panel for the lead engine. Each row is a market segment with a
 * daily quota; n8n reads this database at the start of every run and splits the
 * day's batch accordingly. There is no "apply" step — a save here is what the
 * next run does.
 */
export function SegmentsPanel({ initial }: { initial: OutreachSegment[] }) {
  const [segments, setSegments] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const totalPerDay = useMemo(
    () => segments.filter((s) => s.active).reduce((a, s) => a + s.dailyQuota, 0),
    [segments],
  );

  const open = (s?: OutreachSegment) =>
    setDraft(
      s
        ? { pageId: s.id, name: s.name, dailyQuota: s.dailyQuota, searchBrief: s.searchBrief, industryLabels: s.industryLabels, active: s.active, priority: s.priority }
        : { ...BLANK, priority: segments.length + 1 },
    );

  async function refresh() {
    const res = await fetch('/api/serviceden/outreach/segments');
    if (res.ok) {
      const payload = (await res.json()) as { segments: OutreachSegment[] };
      setSegments(payload.segments);
    }
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/serviceden/outreach/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Save failed (${res.status})`);
      await refresh();
      setDraft(null);
      setNotice('Saved. The next automation run uses these numbers.');
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <KpiStrip>
        <Kpi label="Leads per day" value={String(totalPerDay)} accent="#1F5FA8" sub="sum of active segments" />
        <Kpi label="Segments" value={String(segments.length)} sub={`${segments.filter((s) => s.active).length} active`} />
      </KpiStrip>

      {notice ? (
        <div className="rounded-xl border border-[#B7DCC7] bg-[#F3FAF6] px-4 py-2.5 text-[13px] text-[#2F7D5B]">{notice}</div>
      ) : null}

      <SectionCard
        title="Lead segments"
        right={
          <button type="button" onClick={() => open()}
            className="rounded-lg bg-[#1F5FA8] px-3 py-1.5 text-[12px] font-medium text-white">
            + New segment
          </button>
        }
      >
        <ul className="divide-y divide-[#F4F6FA]">
          {segments.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#171A17]">{s.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    s.active ? 'bg-[#F3FAF6] text-[#2F7D5B]' : 'bg-[#F1F2F4] text-[#6B7280]'
                  }`}>
                    {s.active ? `${s.dailyQuota} / day` : 'paused'}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] text-[#A0A49C]">{s.searchBrief.slice(0, 220) || 'No search brief yet.'}</p>
              </div>
              <button type="button" onClick={() => open(s)}
                className="shrink-0 rounded-lg border border-[#EAEDF2] px-3 py-1.5 text-[12px] font-medium text-[#5C605A] hover:bg-[#F4F6FA]">
                Edit
              </button>
            </li>
          ))}
          {segments.length === 0 ? <li className="py-3 text-[13px] text-[#A0A49C]">No segments yet — the engine falls back to the food brief at 40/day.</li> : null}
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-[#A0A49C]">
          The engine works highest priority first each morning, so if a day runs short, the lowest-priority segment is
          the one that comes up light. Setting a quota to 0 or unticking Active pauses a segment without deleting its
          brief.
        </p>
      </SectionCard>

      {draft ? (
        <SectionCard title={draft.pageId ? `Edit — ${draft.name || 'segment'}` : 'New segment'}>
          <div className="space-y-4">
            {error ? <div className="rounded-lg border border-[#E7B4AF] bg-[#FCF3F2] px-3 py-2 text-[13px] text-[#B4342B]">{error}</div> : null}

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-[#5C605A]">Segment name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Security companies"
                  className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]" />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[#5C605A]">Leads per day</span>
                <input type="number" min={0} max={100} value={draft.dailyQuota}
                  onChange={(e) => setDraft({ ...draft, dailyQuota: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]" />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[#5C605A]">Priority</span>
                <input type="number" min={1} value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]" />
              </label>
            </div>

            <label className="block">
              <span className="text-[12px] font-medium text-[#5C605A]">Search brief</span>
              <textarea value={draft.searchBrief} onChange={(e) => setDraft({ ...draft, searchBrief: e.target.value })} rows={10}
                placeholder={'Describe the businesses to find, in plain language. What they do, what good fits look like, example search queries. This text goes straight into the lead finder\'s prompt.'}
                className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:border-[#1F5FA8]" />
            </label>

            <label className="block">
              <span className="text-[12px] font-medium text-[#5C605A]">Industry labels</span>
              <input value={draft.industryLabels} onChange={(e) => setDraft({ ...draft, industryLabels: e.target.value })}
                placeholder="Semicolon-separated, e.g. Armed Response; Guarding; Security Tech; Other Security"
                className="mt-1 w-full rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] outline-none focus:border-[#1F5FA8]" />
              <span className="mt-1 block text-[11px] text-[#A0A49C]">
                The classifier files each lead under exactly one of these. End the list with a catch-all like &ldquo;Other …&rdquo;.
              </span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-[#5C605A]">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                Active — include in daily runs
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] text-[#5C605A]">Cancel</button>
                <button type="button" onClick={submit} disabled={busy}
                  className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save segment'}
                </button>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-[#A0A49C]">
              A new segment usually wants its own email templates too — add a campaign for it under Templates, tick
              &ldquo;Active for New Leads&rdquo;, and its leads will rotate into that copy. Without one they get the
              existing campaigns&rsquo; templates.
            </p>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
