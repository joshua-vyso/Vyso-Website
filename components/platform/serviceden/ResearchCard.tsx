'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/platform/module-ui';
import type { SdCompanyResearch } from '@/lib/platform/serviceden';
import { SdPrimary } from './ui';

const CONFIDENCE_TONE = { high: 'positive', medium: 'info', low: 'neutral' } as const;
const STALE_MS = 30 * 86_400_000;

function researchDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isStale(researchedAt: string | null): boolean {
  return Boolean(researchedAt && Date.now() - Date.parse(researchedAt) > STALE_MS);
}

function Quiet({ onClick, children, disabled = false }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[34px] items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Website research for one lead. Everything is explicit: research only runs when
 * the user asks, an ambiguous search asks which site is right instead of
 * guessing, and any claim can be excluded so it never reaches a draft.
 */
export function ResearchCard({ leadId, onChanged }: { leadId: string; onChanged?: () => void }) {
  const [research, setResearch] = useState<SdCompanyResearch | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/serviceden/leads/${encodeURIComponent(leadId)}/research`, { cache: 'no-store' });
      const result = (await response.json().catch(() => ({}))) as {
        research?: SdCompanyResearch | null;
        configured?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Could not load company research.');
      setResearch(result.research ?? null);
      setConfigured(result.configured !== false);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load company research.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // load() is async: every setState inside it runs only after `await fetch`,
  // so this is a one-shot data fetch on mount, not the synchronous
  // setState-in-effect cascade the rule guards against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/serviceden/leads/${encodeURIComponent(leadId)}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as { research?: SdCompanyResearch; error?: string };
      if (!response.ok) throw new Error(result.error || 'Company research failed.');
      if (result.research) setResearch(result.research);
      onChanged?.();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Company research failed.');
    } finally {
      setBusy(false);
    }
  }

  const status = research?.status ?? 'pending';
  const stale = isStale(research?.researchedAt ?? null);

  return (
    <div className="rounded-[14px] border border-[#EAEDF2] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="of-display text-[15px] font-semibold text-[#171A17]">Company research</h3>
        {research && status === 'complete' ? (
          <div className="flex items-center gap-2">
            <Badge label={`${research.confidence} confidence`} tone={CONFIDENCE_TONE[research.confidence]} />
            <Quiet onClick={() => void post({ refresh: true })} disabled={busy}>{busy ? 'Working…' : 'Refresh'}</Quiet>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-[13px] text-[#A0A49C]">Loading…</p>
      ) : !configured ? (
        <p className="mt-3 text-[13px] text-[#6B6F68]">Company research is not configured on the server.</p>
      ) : status === 'complete' && research ? (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] leading-relaxed text-[#171A17]">{research.summary || 'No summary available.'}</p>
          <dl className="grid grid-cols-1 gap-1.5 text-[12px] text-[#6B6F68] sm:grid-cols-2">
            {([
              ['Industry', research.industry],
              ['Location', research.location],
              ['Products / services', research.productsServices],
              ['Customers', research.customerType],
            ] as Array<[string, string | null]>).filter(([, value]) => value).map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold text-[#171A17]">{label}</dt>
                <dd className="mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>

          {research.operationalSignals.length ? (
            <ul className="space-y-1.5">
              {[...research.operationalSignals]
                .sort((a, b) => Number(b.kind === 'fact') - Number(a.kind === 'fact'))
                .map((signal, index) => {
                  const source = research.sources.find((entry) => entry.id === signal.sourceId);
                  const excluded = research.excludedSourceIds.includes(signal.sourceId);
                  return (
                    <li key={`${signal.sourceId}-${index}`} className={`flex flex-wrap items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] ${excluded ? 'bg-[#F6F7F9] text-[#A0A49C] line-through' : 'bg-[#F5F9FE] text-[#171A17]'}`}>
                      <span className="min-w-0 flex-1">{signal.claim}</span>
                      <Badge label={signal.kind === 'fact' ? 'Fact' : 'Hypothesis'} tone={signal.kind === 'fact' ? 'info' : 'neutral'} />
                      {source ? (
                        <a href={source.url} target="_blank" rel="noreferrer noopener" className="text-[11px] text-[#1F5FA8] underline">
                          {signal.sourceId}
                        </a>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void post({ toggleExclude: signal.sourceId })}
                        className="text-[11px] font-medium text-[#6B6F68] underline transition-colors hover:text-[#171A17] disabled:opacity-50"
                      >
                        {excluded ? 'Include' : 'Exclude'}
                      </button>
                    </li>
                  );
                })}
            </ul>
          ) : null}

          <p className="text-[11px] text-[#A0A49C]">
            Researched <span className="of-num">{researchDate(research.researchedAt)}</span> from {research.sources.length} page{research.sources.length === 1 ? '' : 's'}
            {research.websiteUrl ? ` · ${research.domain}` : ''}
          </p>
          {stale ? (
            <p className="rounded-[10px] bg-[#FBEEDA] px-3 py-2 text-[12px] text-[#854F0B]">This research is over 30 days old. Refresh it before relying on it.</p>
          ) : null}
        </div>
      ) : status === 'needs_confirmation' && research ? (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-[#6B6F68]">More than one site could be this company. Pick the right one — nothing is assumed.</p>
          {research.candidates.map((candidate) => (
            <div key={candidate.url} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#EEF1F5] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#171A17]">{candidate.title || candidate.url}</p>
                <p className="truncate text-[11px] text-[#A0A49C]">{candidate.url} · {candidate.reason}</p>
              </div>
              <Quiet onClick={() => void post({ confirmUrl: candidate.url })} disabled={busy}>Use this site</Quiet>
            </div>
          ))}
        </div>
      ) : status === 'no_website' || status === 'error' ? (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-[#6B6F68]">
            No website context available.{research?.lastError ? ` ${research.lastError}` : ''}
          </p>
          <Quiet onClick={() => void post({ refresh: true })} disabled={busy}>{busy ? 'Researching…' : 'Try again'}</Quiet>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-[#6B6F68]">Read this company&apos;s own website to ground your next email in something real.</p>
          <SdPrimary onClick={() => void post({})} disabled={busy}>{busy ? 'Researching…' : 'Research company'}</SdPrimary>
        </div>
      )}

      {error ? <p className="mt-3 rounded-[10px] bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
    </div>
  );
}
