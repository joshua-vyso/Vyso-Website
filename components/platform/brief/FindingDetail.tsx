'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { rand } from '@/lib/platform/procurepulse';
import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';
// Type-only — erased at compile time, so neither the findings module nor the
// price-series module (which imports the whole Price Watch pipeline) is pulled
// into the client bundle.
import type { AgentFinding, FindingStatus } from '@/lib/platform/agent-findings';
import type { FindingSeries } from '@/lib/platform/price-watch/series';
import { AI_GRADIENT_RULE, AI_GRADIENT_TEXT, agentChip } from './brief-display';
import { askBrief, draftEmailPrompt, findingPrompt } from './brief-chat';
import { useStatusWrite } from './FindingCard';
import { PriceHistoryChart } from './PriceHistoryChart';
import { EvidenceList, type EvidencePanel } from './EvidenceList';

/**
 * One finding, in full (design 1c; `.ai/plan_brief_chat_v2.md` §4 W3).
 *
 * The card on the Brief is a headline; this is the evidence. Same finding, same
 * rules — every figure comes from rows that exist, and a clause whose data is
 * missing is DROPPED rather than filled with a zero. The volume sub-line, the
 * chart, the recommendation and the evidence strip each disappear independently
 * for exactly that reason, which is why this component is a stack of guarded
 * blocks rather than one template.
 *
 * ── WHY IT IS A CLIENT COMPONENT ────────────────────────────────────────────
 * Four of its controls write or talk: Dismiss and Mark resolved mutate the row
 * the house way (browser client + `router.refresh()`, the pattern FindingCard
 * owns and this file imports rather than copies), and the two chat buttons
 * drive the shell's provider. Everything that can be a string is computed on
 * the server and passed in (`foundAt`, the evidence dates and prices), so the
 * only thing hydrating here is behaviour.
 *
 * ── THE TWO CHAT BUTTONS, AND THE ORDER THEY DO THINGS IN ───────────────────
 * Both create a real chat row filed against this finding
 * (`POST /api/finch/chats` → `finch_chats.finding_id`) and then move to
 * `/app/chat/<id>`. They differ in one word: "Send to chat" leaves the prompt
 * in the composer for the owner to finish; "Draft email" sends it.
 *
 * The sequencing is the load-bearing part. `send()` closes over the provider's
 * `activeChatId`, so calling it in the same tick as `adoptChat(id, [])` would
 * still see `null` and create a SECOND chat — the first one left in the rail,
 * empty, with the finding attached to the wrong conversation. So the draft path
 * hands the chat to the provider, waits one render for `activeChatId` to become
 * that id, and only then sends and navigates. The stream lives in the provider,
 * not here, so this component unmounting on the push cannot interrupt it, and
 * `ChatView` prefers the provider's live turns over the (legitimately empty)
 * server read it lands on.
 *
 * TWO DEGRADATIONS, BOTH DELIBERATE. If the chat cannot be created (the
 * finch-chats migration hasn't been applied → 503, plan §5) we fall back to
 * exactly what W2 does: `askBrief` puts the prompt in the composer, the finding
 * id rides in the provider's ref, and the row is created when the owner sends.
 * If an answer is already streaming, `adoptChat` correctly refuses to steal the
 * transcript — so the draft path stops pre-sending and behaves like "Send to
 * chat" instead of hanging on a button that never resolves.
 */

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold';

const BTN_QUIET =
  'inline-flex items-center gap-2 rounded-full border border-[var(--pf-border-strong)] bg-white px-4 py-2 text-[12.5px] font-semibold text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)] hover:text-[var(--pf-accent-deep)] disabled:opacity-50';

const BTN_PRIMARY =
  'inline-flex items-center justify-center rounded-[9px] bg-[var(--pf-text)] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

const BTN_SECONDARY =
  'inline-flex items-center justify-center rounded-[9px] border border-[var(--pf-border-strong)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)] hover:text-[var(--pf-accent-deep)] disabled:opacity-50';

/** The ✦ AI mark in the sanctioned gradient — the same glyph, and the same one
 *  meaning, as everywhere else on the Brief (see brief-display.ts). */
function AiMark() {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: AI_GRADIENT_TEXT }} aria-hidden>
      ✦
    </span>
  );
}

const STATUS_PILL: Record<FindingStatus, { label: string; bg: string; fg: string }> = {
  new: { label: 'New', bg: 'var(--tone-info-bg)', fg: 'var(--tone-info-fg)' },
  in_progress: { label: 'In progress', bg: 'var(--tone-warning-bg)', fg: 'var(--tone-warning-fg)' },
  resolved: { label: 'Resolved', bg: 'var(--tone-positive-bg)', fg: 'var(--tone-positive-fg)' },
  dismissed: { label: 'Dismissed', bg: 'var(--tone-neutral-bg)', fg: 'var(--tone-neutral-fg)' },
};

/**
 * "~380 kg/month".
 *
 * Rounded HARD, and on purpose: this is a three-month average of lumpy produce
 * buying, and printing "379.6 kg" would dress an estimate up as a measurement.
 * The tilde in the sentence is doing honest work.
 */
function volumeLabel(volume: number, baseUnit: string): string {
  const rounded =
    volume >= 100 ? Math.round(volume / 10) * 10 : volume >= 10 ? Math.round(volume) : Math.round(volume * 10) / 10;
  return `${rounded.toLocaleString('en-ZA')} ${baseUnit}`;
}

export function FindingDetail({
  finding,
  foundAt,
  series,
  evidence,
}: {
  finding: AgentFinding;
  /** "Found 06:14, Thu 13 Aug" — SAST, computed server-side. */
  foundAt: string;
  /** Null for any finding with no resolvable price history (every agent that
   *  isn't Price Watch, and any Price Watch finding whose series can't be
   *  reconstructed). The chart and the volume line disappear together. */
  series: FindingSeries | null;
  /** The evidence strip, already resolved and worded by the page — documents
   *  from Doc-U, invoices from OrderFlow, or the one stock line a Stock Cover
   *  finding is about. This component only passes it along. */
  evidence: EvidencePanel;
}) {
  const router = useRouter();
  const { finchEnabled, email } = usePlatform();
  const { adoptChat, send, activeChatId, streaming } = useFinchChat();
  const { write, busy, toastNode } = useStatusWrite(finding);

  const chip = agentChip(finding.agent);
  const status = STATUS_PILL[finding.status];
  const isOpen = finding.status === 'new' || finding.status === 'in_progress';
  const canChat = finchEnabled && !!email;

  const supplier = series?.supplier_name ?? null;
  const item = series?.item_name ?? null;
  const draftPrompt = draftEmailPrompt(finding, { supplier, item });

  // A price panel needs a shape, not a dot: one invoice is a price, not a
  // history (plan §4 W3 — omit below two points).
  const showChart = !!series && series.points.length >= 2;
  // Both halves or neither: "at your current ~380/month" with no unit is not a
  // sentence, and a unit with no volume is not a figure.
  const volumeText =
    series && series.monthlyVolume != null && series.base_unit
      ? volumeLabel(series.monthlyVolume, series.base_unit)
      : null;

  /* ── the two chat buttons ───────────────────────────────────────────────── */
  const [opening, setOpening] = useState<'draft' | 'chat' | null>(null);
  /** The chat this page created, waiting for the provider to take it over. */
  const [handedOver, setHandedOver] = useState<string | null>(null);
  /** One pre-send per click — the effect below re-runs on every provider
   *  update, and a second `send()` would be a duplicate question. */
  const sentRef = useRef(false);

  const startChat = useCallback(
    async (mode: 'draft' | 'chat') => {
      if (opening) return;
      setOpening(mode);
      const prompt = mode === 'draft' ? draftPrompt : findingPrompt(finding);

      let id: string | null = null;
      try {
        const res = await fetch('/api/finch/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: 'brief', findingId: finding.id }),
        });
        if (res.ok) {
          const created = (await res.json()) as { id?: unknown };
          if (typeof created.id === 'string') id = created.id;
        }
      } catch {
        /* offline — handled by the fallback below */
      }

      // No row (503 / offline): W2's path. The prompt goes to the composer, the
      // finding id rides in the provider's ref, and sending creates the chat.
      if (!id) {
        askBrief(prompt, finding.id);
        setOpening(null);
        router.push('/app/chat/new');
        return;
      }

      // An answer already in flight owns the transcript; `adoptChat` refuses,
      // and pre-sending into a chat the provider hasn't taken over would create
      // a second one. Hand the prompt over instead and let the owner send it.
      if (mode === 'draft' && !streaming) {
        sentRef.current = false;
        setHandedOver(id);
        adoptChat(id, []);
        return; // the effect below sends, then navigates
      }

      askBrief(prompt, finding.id);
      if (!streaming) adoptChat(id, []);
      setOpening(null);
      router.push(`/app/chat/${id}`);
      // The rail lives in the platform LAYOUT, which a client navigation does
      // not re-render — without this the chat we just created would not appear
      // in the list until the next hard load. Same call, same reason, as the
      // provider's own once-per-chat refresh (W2).
      router.refresh();
    },
    [opening, draftPrompt, finding, router, adoptChat, streaming],
  );

  // The provider now owns the chat, so `send` sees the right id — send the
  // draft prompt, then move to its screen. The stream continues in the provider
  // while this component unmounts.
  useEffect(() => {
    if (!handedOver || activeChatId !== handedOver || sentRef.current) return;
    sentRef.current = true;
    send(draftPrompt);
    router.push(`/app/chat/${handedOver}`);
    router.refresh(); // the rail's list is the layout's, not this page's
  }, [handedOver, activeChatId, send, draftPrompt, router]);

  return (
    <article>
      {toastNode}

      <Link
        href="/app"
        className="text-[13px] text-[var(--pf-text-secondary)] transition-colors hover:text-[#BE5D23]"
        style={{ transitionDuration: 'var(--dur-hover)' }}
      >
        ‹ Back to today&apos;s brief
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <span
          className={`${PILL} uppercase tracking-[0.08em]`}
          style={{ backgroundColor: chip.bg, color: chip.fg }}
        >
          <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: chip.dot }} aria-hidden />
          {chip.label}
        </span>
        <span className={PILL} style={{ backgroundColor: status.bg, color: status.fg }}>
          {status.label}
        </span>
        {foundAt ? <span className="text-[12px] text-[var(--pf-text-faint)]">{foundAt}</span> : null}
        {canChat ? (
          <button
            type="button"
            onClick={() => void startChat('chat')}
            disabled={opening !== null}
            className={`${BTN_QUIET} sm:ml-auto`}
          >
            <AiMark />
            {opening === 'chat' ? 'Opening…' : 'Send to chat'}
          </button>
        ) : null}
      </div>

      <h1 className="of-display mt-4 text-[clamp(22px,3vw,30px)] font-semibold leading-[1.3] tracking-[-0.01em] text-balance text-[var(--pf-text)]">
        {finding.observation}
      </h1>

      {finding.rand_impact != null ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div
            className="of-num bg-clip-text text-[clamp(26px,3.4vw,34px)] font-semibold text-transparent"
            style={{ backgroundImage: AI_GRADIENT_TEXT }}
          >
            ≈ {rand(finding.rand_impact)}/yr
          </div>
          {/* Only when the volume is derivable — see plan §1 item 1. Without a
              base unit or a 90-day buying window there is nothing true to say. */}
          {volumeText ? (
            <div className="text-[13.5px] text-[var(--pf-text-secondary)]">
              at your current ~{volumeText}/month
            </div>
          ) : null}
        </div>
      ) : null}

      {showChart || finding.recommended_action ? (
        <div
          className={`mt-7 grid gap-4 ${showChart && finding.recommended_action ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}
        >
          {showChart && series ? <PriceHistoryChart series={series} /> : null}

          {finding.recommended_action ? (
            <div className="flex flex-col overflow-hidden rounded-[var(--pf-radius-card)] border border-[var(--pf-border)] bg-white shadow-[var(--pf-shadow-card)]">
              {/* The gradient hairline — this block is Vyso talking, and that is
                  the one thing the gradient is allowed to mean. */}
              <div className="h-[3px]" style={{ background: AI_GRADIENT_RULE }} aria-hidden />
              <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-text-muted)]">
                  Recommended
                </h2>
                <p className="mt-2.5 text-[14.5px] leading-[1.55] text-[var(--pf-text-body)]">
                  {finding.recommended_action}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {canChat ? (
          <>
            <button
              type="button"
              onClick={() => void startChat('draft')}
              disabled={opening !== null}
              className={BTN_PRIMARY}
            >
              {opening === 'draft'
                ? 'Opening…'
                : supplier
                  ? `Draft email to ${supplier}`
                  : 'Draft a supplier email'}
            </button>
            <button
              type="button"
              onClick={() => void startChat('chat')}
              disabled={opening !== null}
              className={BTN_SECONDARY}
            >
              Send to chat
            </button>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {isOpen ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void write('resolved')}
                className="rounded-[9px] px-2.5 py-2 text-[12.5px] text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-text-control)] disabled:opacity-50"
              >
                Mark resolved
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void write('dismissed')}
                className="rounded-[9px] px-2.5 py-2 text-[12.5px] text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-text-control)] disabled:opacity-50"
              >
                Dismiss
              </button>
            </>
          ) : (
            // Reachable from History, and from this page after a dismiss — the
            // status pill above updates in place, so the owner can see what
            // they just did and undo it without going back.
            <button
              type="button"
              disabled={busy}
              onClick={() => void write('new')}
              className="rounded-[9px] px-2.5 py-2 text-[12.5px] text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-text-control)] disabled:opacity-50"
            >
              Restore to the brief
            </button>
          )}
        </div>
      </div>

      <EvidenceList {...evidence} />
    </article>
  );
}
