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
 * a year, what it was read from — Dismiss, and a tap to talk about it.
 *
 * TAP TO DISCUSS. Tapping the card's body names the finding in the chat
 * composer below (the mock's "Tap any finding to bring it into the
 * conversation"). Clicks that land on the evidence link or a button are left
 * alone — those already mean something. The observation itself is the
 * keyboard-reachable version of the same gesture, so the affordance isn't
 * mouse-only. It is offered only when the chat can actually receive it: the
 * same `finchEnabled` session flag the pill gates on.
 *
 * The mock's other per-finding buttons ("Draft supplier email", "Show 6-month
 * trend") are features, not styling, and are deliberately not here yet
 * (.ai/plan_brief_home.md § Out of scope). Dismiss is the one real action, so it
 * is the one that ships.
 *
 * The write follows the house mutation shape exactly — this repo has no server
 * actions and no `revalidatePath`; a row mutation is an org-scoped browser
 * write followed by `router.refresh()` to reconcile with server truth (see
 * components/platform/supplysync/Risk.tsx → `updateRiskStatus`).
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
 */
function useStatusWrite(finding: AgentFinding) {
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
  const chip = agentChip(finding.agent);
  const isNew = finding.status === 'new';
  const canDiscuss = finchEnabled && !!email;

  // The id rides along so the chat this becomes is filed against this finding
  // (`finch_chats.finding_id`) — see askBrief: it is remembered until the owner
  // sends, never acted on at tap time.
  const discuss = () => askBrief(findingPrompt(finding), finding.id);

  return (
    <article
      className={`${CARD} px-[22px] py-5 ${done ? 'pointer-events-none opacity-40' : ''} ${canDiscuss ? 'cursor-pointer' : ''}`}
      aria-busy={busy || done}
      onClick={
        canDiscuss
          ? (e) => {
              // The link and the buttons already say what a click on them means.
              if ((e.target as HTMLElement).closest('a,button')) return;
              discuss();
            }
          : undefined
      }
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

      {canDiscuss ? (
        // The keyboard route to the same tap. A plain-text button: it reads as
        // the observation, because that is what it is.
        <button
          type="button"
          onClick={discuss}
          aria-label={`Ask Vyso about this finding: ${finding.observation}`}
          className="mb-1 mt-3 block w-full rounded-[6px] text-left text-[16px] leading-[1.5] text-[var(--pf-text-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-accent-ring)]"
        >
          {finding.observation}
        </button>
      ) : (
        <p className="mb-1 mt-3 text-[16px] leading-[1.5] text-[var(--pf-text-body)]">{finding.observation}</p>
      )}

      {finding.rand_impact != null ? (
        <div className="of-num mb-0.5 mt-1.5 text-[22px] font-semibold text-[var(--pf-text)]">
          ≈ {rand(finding.rand_impact)}
          <span className="text-[14px] font-medium text-[var(--pf-text-muted)]">/yr</span>
        </div>
      ) : null}

      {evidence?.firstDocId ? (
        // Doc-U has no "these ids" list route, so the link opens the first cited
        // document; the count still tells the truth about how many there are.
        <Link
          href={`/app/docu/${evidence.firstDocId}`}
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

      <div className="mt-4 flex">
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
