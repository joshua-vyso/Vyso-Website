'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/platform/orderflow/ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { rand } from '@/lib/platform/procurepulse';
// Type-only — erased at compile time, so importing the server-side data module
// here does NOT pull `supabase-server` (and `next/headers`) into the client bundle.
import type { AgentFinding, EvidenceSummary, FindingStatus } from '@/lib/platform/agent-findings';
import { AI_GRADIENT_BAR, AI_GRADIENT_TEXT, agentChip } from './brief-display';
import { askBrief, findingPrompt } from './brief-chat';

/**
 * One finding, as the owner reads it: who found it, what it says, what it costs
 * a year, what it was read from — Dismiss, a way in to the evidence, and a tap
 * to talk about it.
 *
 * TAP TO OPEN, ✦ TO DISCUSS (changed in W3, .ai/plan_brief_chat_v2.md §4).
 * Tapping the card's body now OPENS the finding — `/app/finding/[id]`, the full
 * evidence view with its price history and its cited invoices. Up to this wave
 * a tap named the finding in the composer instead; that gesture is still here,
 * demoted to an explicit "✦ Discuss" button. The swap is deliberate: a card is
 * a headline and the obvious meaning of clicking a headline is "show me the
 * rest", whereas "put this into a chat" is a specific intent that deserves to
 * be asked for by name. Both affordances still gate on the same `finchEnabled`
 * flag where they need the chat; the detail route does not, so the body link is
 * always live.
 *
 * The observation is a real `<Link>`, not a click handler on a div — so it is
 * keyboard-reachable, middle-clickable and openable in a new tab, and the
 * card-level handler exists only to widen the target to the whitespace around
 * it. Clicks that land on a link or a button are left alone; those already mean
 * something.
 *
 * The mock's "Show 6-month trend" is not a button here because it is the detail
 * page now — the chart lives where the evidence is.
 *
 * The write follows the house mutation shape exactly — this repo has no server
 * actions and no `revalidatePath`; a row mutation is an org-scoped browser
 * write followed by `router.refresh()` to reconcile with server truth (see
 * components/platform/supplysync/Risk.tsx → `updateRiskStatus`). W3's detail
 * page shares that write by importing `useStatusWrite` from here rather than
 * copying it: two places that can dismiss a finding must not be able to drift
 * into dismissing it differently.
 */

const CARD =
  'relative overflow-hidden rounded-[var(--pf-radius-card)] border border-[var(--pf-border)] bg-white shadow-[var(--pf-shadow-card)] transition-all hover:border-[var(--pf-accent-ring)] hover:shadow-[0_10px_30px_-12px_rgba(20,24,20,0.12)]';

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold';

/** The ✦ AI mark, in the sanctioned gradient. Ornament is banned in this brand;
 *  ✦ is the one glyph that carries meaning — "Vyso wrote this". */
function AiMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`bg-clip-text text-transparent ${className}`}
      style={{ backgroundImage: AI_GRADIENT_TEXT }}
      aria-hidden
    >
      ✦
    </span>
  );
}

/**
 * The status write shared by Dismiss (open feed) and Restore (history).
 *
 * `done` fades the card the instant the write lands, closing the gap until the
 * refreshed server render drops it from the list; a failure leaves the card
 * exactly as it was, so a dead click can never look like a success.
 *
 * No success toast, unlike the module exemplar: a status change there keeps its
 * row on screen, whereas dismissing here REMOVES the card — and a toast
 * portalled from a card that is about to unmount would flash and vanish. The
 * finding leaving the brief is the confirmation. Failures still toast, because
 * nothing else would tell the owner the finding is still open.
 *
 * Exported for W3's detail page, which uses `write`, `busy` and the toast but
 * NOT `done`: dismissing from there removes nothing from the screen — the
 * status pill changes after `router.refresh()` and the owner stays put — so
 * fading the page out would misdescribe what just happened.
 */
export function useStatusWrite(finding: AgentFinding) {
  const { org } = usePlatform();
  const router = useRouter();
  const { node: toastNode, show } = useToast();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function write(next: FindingStatus) {
    setBusy(true);

    const supabase = createClient();
    if (!supabase || !org) {
      setBusy(false);
      show('Not connected — nothing was saved.');
      return;
    }

    // --- Real write: update agent_findings.status ---------------------------
    // org_id is pinned alongside the id even though RLS already scopes the
    // caller — the same belt-and-braces every other module write uses.
    const { error } = await supabase
      .from('agent_findings')
      .update({ status: next })
      .eq('id', finding.id)
      .eq('org_id', org.id);

    setBusy(false);

    if (error) {
      show(error.message);
      return;
    }

    setDone(true);
    router.refresh(); // reconcile with server truth
  }

  return { write, done, busy, toastNode };
}

export function FindingCard({
  finding,
  evidence,
  foundLabel,
}: {
  finding: AgentFinding;
  evidence?: EvidenceSummary;
  /** "Found this morning" / "Yesterday" — computed server-side (see brief-display). */
  foundLabel: string;
}) {
  const { write, done, busy, toastNode } = useStatusWrite(finding);
  const { email, finchEnabled } = usePlatform();
  const router = useRouter();
  const chip = agentChip(finding.agent);
  const isNew = finding.status === 'new';
  const canDiscuss = finchEnabled && !!email;
  const href = `/app/finding/${finding.id}`;

  // The id rides along so the chat this becomes is filed against this finding
  // (`finch_chats.finding_id`) — see askBrief: it is remembered until the owner
  // sends, never acted on at tap time.
  const discuss = () => askBrief(findingPrompt(finding), finding.id);

  return (
    <article
      className={`${CARD} cursor-pointer px-[22px] py-5 ${done ? 'pointer-events-none opacity-40' : ''}`}
      aria-busy={busy || done}
      onClick={(e) => {
        // The links and the buttons already say what a click on them means —
        // including the observation, which is the real <Link> this widens.
        if ((e.target as HTMLElement).closest('a,button')) return;
        router.push(href);
      }}
    >
      {toastNode}
      {/* Gradient accent bar — only on findings the owner has not seen yet. */}
      {isNew ? (
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: AI_GRADIENT_BAR }} aria-hidden />
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`${PILL} uppercase tracking-[0.08em]`}
          style={{ backgroundColor: chip.bg, color: chip.fg }}
        >
          <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: chip.dot }} aria-hidden />
          {chip.label}
        </span>
        {foundLabel ? <span className="text-[11.5px] text-[var(--pf-text-faint)]">{foundLabel}</span> : null}
        <span
          className={`${PILL} ml-auto`}
          style={
            isNew
              ? { backgroundColor: 'var(--tone-info-bg)', color: 'var(--tone-info-fg)' }
              : { backgroundColor: 'var(--tone-warning-bg)', color: 'var(--tone-warning-fg)' }
          }
        >
          {isNew ? null : (
            <span
              className="h-[5px] w-[5px] rounded-full bg-[#BE5D23] motion-safe:animate-pulse"
              aria-hidden
            />
          )}
          {isNew ? 'New' : 'In progress'}
        </span>
      </div>

      {/* The observation IS the link to the evidence — a real anchor, so it is
          keyboard-reachable and opens in a new tab like any other link. */}
      <Link
        href={href}
        className="mb-1 mt-3 block rounded-[6px] text-[16px] leading-[1.5] text-[var(--pf-text-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-accent-ring)]"
      >
        {finding.observation}
      </Link>

      {finding.rand_impact != null ? (
        <div className="of-num mb-0.5 mt-1.5 text-[22px] font-semibold text-[var(--pf-text)]">
          ≈ {rand(finding.rand_impact)}
          <span className="text-[14px] font-medium text-[var(--pf-text-muted)]">/yr</span>
        </div>
      ) : null}

      {evidence?.href ? (
        // Where the evidence link goes is the RESOLVER's decision, not this
        // card's: an agent's ids can be Doc-U documents, OrderFlow invoices or a
        // ProcurePulse stock line, and lib/platform/agent-findings.ts is the one
        // place that knows which. The card just renders what it was handed.
        <Link
          href={evidence.href}
          className="text-[12.5px] text-[var(--pf-accent-strong)] hover:underline"
        >
          {evidence.label} ↗
        </Link>
      ) : null}

      {finding.recommended_action ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-[9px] border border-[var(--pf-border-soft)] bg-[var(--pf-surface-tint-faint)] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[var(--pf-text-secondary)]">
          <AiMark />
          <span>{finding.recommended_action}</span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-1">
        {/* Demoted from "the whole card" to a named button (W3). Still the same
            one-line channel into the composer — see brief-chat.ts. */}
        {canDiscuss ? (
          <button
            type="button"
            onClick={discuss}
            aria-label={`Ask Finch about this finding: ${finding.observation}`}
            className="inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--pf-text-control)] transition-colors hover:text-[var(--pf-accent-deep)]"
          >
            <AiMark />
            Discuss
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => write('dismissed')}
          className="ml-auto rounded-[9px] px-2.5 py-2 text-[12.5px] text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-text-control)] disabled:opacity-50"
        >
          {busy ? 'Dismissing…' : 'Dismiss'}
        </button>
      </div>
    </article>
  );
}

/**
 * A closed finding under History — collapsed to one struck-through line, per
 * the mock. Restore puts it back at the top of the brief as 'new'; without it a
 * mis-click on Dismiss would be unrecoverable from the UI.
 */
export function ResolvedFindingCard({ finding }: { finding: AgentFinding }) {
  const { write, done, busy, toastNode } = useStatusWrite(finding);
  const resolved = finding.status === 'resolved';

  return (
    <article
      className={`rounded-[var(--pf-radius-card)] border border-[#EFEDE8] bg-[#FBFAF8] px-[22px] py-4 ${done ? 'pointer-events-none opacity-40' : 'opacity-[0.82]'}`}
      aria-busy={busy || done}
    >
      {toastNode}
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`${PILL} uppercase tracking-[0.08em]`}
          style={{ backgroundColor: agentChip(finding.agent).bg, color: agentChip(finding.agent).fg }}
        >
          {agentChip(finding.agent).label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--pf-text-secondary)] line-through decoration-[#C9CCC4]">
          {finding.observation}
        </span>
        <span
          className={PILL}
          style={
            resolved
              ? { backgroundColor: 'var(--tone-positive-bg)', color: 'var(--tone-positive-fg)' }
              : { backgroundColor: 'var(--tone-neutral-bg)', color: 'var(--tone-neutral-fg)' }
          }
        >
          {resolved ? 'Resolved' : 'Dismissed'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => write('new')}
          className="rounded-[9px] px-2 py-1.5 text-[12px] text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-text-control)] disabled:opacity-50"
        >
          {busy ? 'Restoring…' : 'Restore'}
        </button>
      </div>
    </article>
  );
}
