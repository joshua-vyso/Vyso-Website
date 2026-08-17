'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Badge, DataTable, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import type { OutreachLead, TodaySnapshot } from '@/lib/platform/notion-outreach';
import type { DraftInbox, SendOutcome } from '@/lib/platform/outreach-drafts';

type SendResult = { sent: number; failed: SendOutcome[]; dropped: number; held?: { company: string | null; to: string; reason: string }[]; account: string };

const CAMPAIGN_COLOUR: Record<string, { bg: string; fg: string }> = {
  'Pricing Refined': { bg: '#EAF7EF', fg: '#2F7D5B' },
  Legacy: { bg: '#EAF2FC', fg: '#1F5FA8' },
  'Discovery First': { bg: '#F3EDFB', fg: '#6B3FA0' },
  Original: { bg: '#F1F2F4', fg: '#6B7280' },
};

function CampaignTag({ name }: { name: string | null }) {
  if (!name) return <span className="text-[#A0A49C]">—</span>;
  const c = CAMPAIGN_COLOUR[name] ?? { bg: '#F1F2F4', fg: '#6B7280' };
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: c.bg, color: c.fg }}>
      {name}
    </span>
  );
}

function leadRows(leads: OutreachLead[]) {
  return leads.map((l) => [
    <span key="n" className="flex flex-col">
      <span className="font-medium text-[#171A17]">{l.company || '—'}</span>
      <span className="text-[12px] text-[#A0A49C]">{l.email}</span>
    </span>,
    <CampaignTag key="c" name={l.campaign} />,
    l.industry ?? '—',
    l.icpScore ?? '—',
  ]);
}

const LEAD_COLUMNS = [
  { label: 'Business' },
  { label: 'Campaign' },
  { label: 'Industry' },
  { label: 'ICP', align: 'right' as const },
];

export function TodayOutreach({
  snapshot,
  initialInbox,
  initialError,
}: {
  snapshot: TodaySnapshot;
  initialInbox: DraftInbox | null;
  initialError: string | null;
}) {
  const [inbox, setInbox] = useState<DraftInbox | null>(initialInbox);
  const [draftError, setDraftError] = useState<string | null>(initialError);
  // Everything is ticked to begin with — the drafts were reviewed in Gmail, and
  // the common case is sending the lot.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialInbox?.sendable ?? []).map((d) => d.id)),
  );
  const [armed, setArmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [bounced, setBounced] = useState(0);

  /** Re-read the mailbox after a send so what remains is what actually remains. */
  const reload = useCallback(async () => {
    const res = await fetch('/api/serviceden/outreach/drafts');
    const payload = (await res.json().catch(() => ({}))) as DraftInbox & { error?: string };
    if (!res.ok) {
      setDraftError(payload.error || `Could not read drafts (${res.status})`);
      setInbox(null);
      return;
    }
    setDraftError(null);
    setInbox(payload);
    setSelected(new Set(payload.sendable.map((d) => d.id)));
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setArmed(false);
      return next;
    });

  /**
   * Bounces arrive seconds to a couple of minutes after a send, so a short poll
   * catches most of them while the send is still on screen. It is a convenience,
   * not the source of truth — the Bounces page derives the full list from the
   * mailbox whenever it is opened, so a missed poll loses nothing.
   */
  const watchForBounces = useCallback(async (before: number) => {
    for (const delay of [15_000, 30_000, 60_000]) {
      await new Promise((r) => setTimeout(r, delay));
      const res = await fetch('/api/serviceden/outreach/bounces?days=1');
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as { bounces?: { failedAt: string }[] };
      const fresh = (payload.bounces ?? []).filter((b) => Date.parse(b.failedAt) >= before);
      if (fresh.length > 0) {
        setBounced(fresh.length);
        return;
      }
    }
  }, []);

  async function send() {
    if (!inbox || selected.size === 0) return;
    setSending(true);
    setDraftError(null);
    setBounced(0);
    const sentAt = Date.now();
    try {
      const res = await fetch('/api/serviceden/outreach/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: [...selected] }),
      });
      const payload = (await res.json().catch(() => ({}))) as SendResult & { error?: string };
      if (!res.ok) throw new Error(payload.error || `Send failed (${res.status})`);
      setResult(payload);
      setArmed(false);
      await reload();
      void watchForBounces(sentAt);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  const count = selected.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[#8A8E86]">
          {new Date(`${snapshot.date}T12:00:00Z`).toLocaleDateString('en-ZA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <KpiStrip>
        <Kpi label="New leads found" value={String(snapshot.newLeads.length)} sub="first contacted today" />
        <Kpi
          label="Following up"
          value={String(snapshot.followUps.length)}
          accent={snapshot.followUps.length > 0 ? '#1F5FA8' : undefined}
          sub="due today"
        />
        <Kpi
          label="Replies"
          value={String(snapshot.replies.length)}
          accent={snapshot.replies.length > 0 ? '#2F7D5B' : undefined}
          sub="last 24 hours"
        />
        <Kpi label="Drafts waiting" value={inbox ? String(inbox.sendable.length) : '—'} sub="in Gmail" />
      </KpiStrip>

      <SectionCard
        title="Review and send"
        right={inbox ? <span className="text-[12px] text-[#A0A49C]">sending as {inbox.account}</span> : null}
      >
        {draftError ? (
          <div className="rounded-lg border border-[#E7B4AF] bg-[#FCF3F2] px-3 py-2 text-[13px] text-[#B4342B]">
            {draftError}
          </div>
        ) : null}

        {result ? (
          <div className="mb-4 rounded-xl border border-[#B7DCC7] bg-[#F3FAF6] px-4 py-3 text-[13px] text-[#2F7D5B]">
            Sent {result.sent} {result.sent === 1 ? 'email' : 'emails'} from {result.account}.
            {result.dropped > 0 ? ` ${result.dropped} were skipped as no longer sendable.` : ''}
            {result.held && result.held.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[#B4342B]">
                {result.held.map((h) => (
                  <li key={h.to}>Held, not sent — {h.company ?? h.to}: {h.reason}</li>
                ))}
              </ul>
            ) : null}
            {result.failed.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[#B4342B]">
                {result.failed.map((f) => (
                  <li key={f.id}>
                    {f.company ?? f.id}: {f.error}
                  </li>
                ))}
              </ul>
            ) : null}
            {bounced > 0 ? (
              <p className="mt-2 text-[#B4342B]">
                {bounced} {bounced === 1 ? 'address has' : 'addresses have'} already bounced.{' '}
                <Link href="/app/serviceden/outreach/bounces" className="font-medium underline">
                  See which
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        

        {inbox && inbox.sendable.length === 0 && inbox.held.length === 0 ? (
          <p className="text-[13px] text-[#A0A49C]">
            No outreach drafts waiting. Run the lead engine, or everything today has already gone out.
          </p>
        ) : null}

        {inbox && (inbox.sendable.length > 0 || inbox.held.length > 0) ? (
          <div className="space-y-3">
            {!inbox.canSend ? (
              <div className="rounded-lg border border-[#E7B4AF] bg-[#FCF3F2] px-3 py-2 text-[13px] text-[#B4342B]">
                This Gmail connection is read-only. Reconnect it and grant send access before using this.
              </div>
            ) : null}

            <ul className="divide-y divide-[#F4F6FA] rounded-xl border border-[#EAEDF2]">
              {inbox.sendable.map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="mt-1"
                    aria-label={`Include ${d.company ?? d.to}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#171A17]">{d.company ?? d.to}</span>
                      <CampaignTag name={d.campaign} />
                      {d.stage ? <Badge label={d.stage} tone="neutral" /> : null}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-[#5C605A]">{d.subject}</div>
                    <div className="text-[12px] text-[#A0A49C]">{d.to}</div>
                  </div>
                </li>
              ))}
            </ul>

            {inbox.held.length > 0 ? (
              <div className="rounded-xl border border-[#E7B4AF] bg-[#FCF3F2] px-4 py-3">
                <div className="text-[13px] font-medium text-[#B4342B]">
                  {inbox.held.length} {inbox.held.length === 1 ? 'draft is' : 'drafts are'} held and will not be sent
                </div>
                <ul className="mt-2 space-y-1.5">
                  {inbox.held.map((d) => (
                    <li key={d.id} className="text-[12px] text-[#7A2E27]">
                      <span className="font-medium text-[#171A17]">{d.company ?? d.to}</span>
                      <span className="text-[#A0A49C]"> · {d.to}</span> — {d.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-[#7A2E27]">
                  These stay in Gmail for you to read and delete. If a hold is wrong, untick Replied on the lead and reload.
                </p>
              </div>
            ) : null}

            {inbox.unrecognised > 0 ? (
              <p className="text-[12px] text-[#A0A49C]">
                {inbox.unrecognised} other {inbox.unrecognised === 1 ? 'draft is' : 'drafts are'} in this mailbox and
                will not be touched — the recipient is not a lead in Lead Hub.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex gap-2 text-[12px]">
                <button type="button" onClick={() => { setSelected(new Set(inbox.sendable.map((d) => d.id))); setArmed(false); }} className="text-[#1F5FA8] hover:underline">
                  Select all
                </button>
                <button type="button" onClick={() => { setSelected(new Set()); setArmed(false); }} className="text-[#8A8E86] hover:underline">
                  Clear
                </button>
              </div>
              {/* Two steps on purpose: this is the only control in ServiceDen that
                  puts cold email on the wire, and a single click is too cheap. */}
              {armed ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setArmed(false)} className="rounded-lg border border-[#EAEDF2] px-3 py-2 text-[13px] text-[#5C605A]">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending}
                    className="rounded-lg bg-[#B4342B] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
                  >
                    {sending ? 'Sending…' : `Confirm — send ${count} now`}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setArmed(true)}
                  disabled={count === 0 || !inbox.canSend}
                  className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  Send {count} {count === 1 ? 'email' : 'emails'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </SectionCard>

      {snapshot.replies.length > 0 ? (
        <SectionCard title="Replied in the last day" right={<Link href="/app/serviceden/sales" className="text-[12px] font-medium text-[#1F5FA8] hover:underline">Open sales →</Link>}>
          <DataTable
            columns={[{ label: 'Business' }, { label: 'Campaign' }, { label: 'Replied' }, { label: 'ICP', align: 'right' }]}
            rows={snapshot.replies.map((l) => [
              <span key="n" className="flex flex-col">
                <span className="font-medium text-[#171A17]">{l.company || '—'}</span>
                <span className="text-[12px] text-[#A0A49C]">{l.email}</span>
              </span>,
              <CampaignTag key="c" name={l.campaign} />,
              l.repliedOn ?? '—',
              l.icpScore ?? '—',
            ])}
            empty="No replies."
          />
        </SectionCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={`New leads found today (${snapshot.newLeads.length})`}>
          <DataTable columns={LEAD_COLUMNS} rows={leadRows(snapshot.newLeads)} empty="No new leads today." />
        </SectionCard>

        <SectionCard title={`Following up today (${snapshot.followUps.length})`}>
          <DataTable columns={LEAD_COLUMNS} rows={leadRows(snapshot.followUps)} empty="Nothing due today." />
        </SectionCard>
      </div>
    </div>
  );
}
