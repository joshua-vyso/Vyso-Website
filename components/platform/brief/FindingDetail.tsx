'use client';

import Link from 'next/link';
import { rand } from '@/lib/platform/procurepulse';
// Type-only — erased at compile time, so neither the findings module nor the
// price-series module (which imports the whole Price Watch pipeline) is pulled
// into the client bundle.
import type { AgentFinding, FindingStatus } from '@/lib/platform/agent-findings';
import type { FindingSeries } from '@/lib/platform/price-watch/series';
import { AI_GRADIENT_RULE, AI_GRADIENT_TEXT, agentChip } from './brief-display';
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
 * Two of its controls write: Dismiss and Mark resolved mutate the row the house
 * way (browser client + `router.refresh()`, the pattern FindingCard owns and
 * this file imports rather than copies). Everything that can be a string is
 * computed on the server and passed in (`foundAt`, the evidence dates and
 * prices), so the only thing hydrating here is behaviour.
 *
 * ── THE THREE CHAT BUTTONS ARE GONE (`.ai/plan_phase0_teardown_shell.md` D4) ─
 * "Send to chat" (twice — once in the header, once in the action row) and
 * "Draft a supplier email" all did the same thing in the end: create a
 * `finch_chats` row filed against this finding and push `/app/chat/<id>`. That
 * route now redirects to the Brief, so every one of them would have been a
 * button that walked the reader out of the screen they were reading.
 *
 * Their machinery went with them — the `useFinchChat()` hook, the
 * adopt-then-send sequencing that stopped the draft path creating a second
 * chat, and the `askBrief` fallback for an org whose finch-chats migration was
 * never applied. None of it is deleted from the repo: `brief-chat.ts`,
 * `draftEmailPrompt` and `findingPrompt` are all still there, and the provider
 * is still mounted by the layout, so this reads as a re-wiring rather than a
 * removal when the chat comes back.
 *
 * WHAT DID NOT CHANGE: the evidence, the chart, the recommendation, and the
 * three status writes. FindingCard's own "Discuss" button is also untouched —
 * it is outside this plan's Task D list.
 */

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold';

/* BTN_QUIET / BTN_PRIMARY / BTN_SECONDARY and the ✦ `AiMark` helper were the
 * three chat buttons' clothes and went with them (Task D). The gradient itself
 * still has a job on this page — `AI_GRADIENT_TEXT` on the rand figure,
 * `AI_GRADIENT_RULE` on the recommendation's hairline — so the imports stay. */

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
  const { write, busy, toastNode } = useStatusWrite(finding);

  const chip = agentChip(finding.agent);
  const status = STATUS_PILL[finding.status];
  const isOpen = finding.status === 'new' || finding.status === 'in_progress';

  // A price panel needs a shape, not a dot: one invoice is a price, not a
  // history (plan §4 W3 — omit below two points).
  const showChart = !!series && series.points.length >= 2;
  // Both halves or neither: "at your current ~380/month" with no unit is not a
  // sentence, and a unit with no volume is not a figure.
  const volumeText =
    series && series.monthlyVolume != null && series.base_unit
      ? volumeLabel(series.monthlyVolume, series.base_unit)
      : null;

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

      {/* The status writes are all that is left in this row, so they keep their
          `ml-auto` and simply sit alone on the right — the two chat buttons that
          used to hold the left half are gone (see the docblock). */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
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
