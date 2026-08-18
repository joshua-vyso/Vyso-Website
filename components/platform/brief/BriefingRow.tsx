'use client';

import Link from 'next/link';
import { rand } from '@/lib/platform/procurepulse';
// Type-only — erased at compile time, so the server-side data module does not
// follow `supabase-server` (and `next/headers`) into the client bundle. Same
// reason FindingCard imports it this way.
import type { AgentFinding, EvidenceSummary } from '@/lib/platform/agent-findings';
import { agentChip } from './brief-display';
import { useStatusWrite } from './FindingCard';

/**
 * One finding as a ROW, for the full briefing's report view.
 *
 * WHY A ROW AND NOT A CARD. `/app` is a brief: five cards, each with room for
 * the observation, the figure, the recommendation and two actions, because the
 * owner is being asked to decide something about each one. `/app?view=all` is
 * the other question — "what has Vyso got on me?" — and twenty-three cards is
 * the wall the five-card cap exists to prevent. A report answers a coverage
 * question by being dense and scannable: one line per finding, the same fields
 * in the same column on every line, so the eye runs down the rand column rather
 * than re-reading five headings. The idiom is the design's own back-office table
 * (`.ai/design/vyso-brief/Vyso - The Brief.dc.html` §1d) — white sheet, hairline
 * rules, uppercase column heads, tabular figures right-aligned.
 *
 * IT OFFERS THE SAME ACTIONS AS THE CARD, THROUGH THE SAME CODE. The headline is
 * the same `<Link>` to `/app/finding/[id]`, and Dismiss is `useStatusWrite`
 * imported from FindingCard rather than reimplemented — two places that can
 * dismiss a finding must not be able to drift into dismissing it differently
 * (the rule W3's detail page already follows). What is NOT here is "Discuss":
 * the report is read at a distance and a per-row chat button on twenty-three
 * rows is noise; the row opens the finding, and the finding page has the button.
 *
 * MONOCHROME, WITH ONE ACCENT. The only colour a row is allowed is its agent's
 * chip dot (brief-display's `agentChip`) — everything else is `--pf-*` text
 * tones. That is what keeps a page of thirty rows readable, and it is also why
 * the gradient does NOT appear here: the AI gradient means "Vyso said this" and
 * is rationed to five placements (see brief-display.ts). A table of rows is not
 * a sixth.
 *
 * THE DOT IS THE STATUS, AND ITS COLOUR IS THE AGENT. Filled means 'new' —
 * nobody has looked; a hollow ring means 'in progress' — somebody has. Two
 * shapes rather than two colours, because a colour difference would compete with
 * the agent accent it is drawn in, and because a ring/disc distinction survives
 * a monochrome print and a colour-blind reader.
 *
 * MOBILE: the row STACKS. Below `sm` this is a wrapping flex line — the headline
 * takes the first line beside the dot, and the figure, evidence, time and
 * Dismiss wrap onto the second. Above `sm` the same markup becomes the grid,
 * whose template is shared with the column header in FullBriefing.
 */

/** The column template, shared with the header row so they cannot drift.
 *  dot · headline · ≈R/yr · evidence · found · dismiss.
 *
 *  The four fixed columns are sized to the widest thing they can hold (a
 *  seven-figure rand, "4 stock lines", "3 days ago", "Dismissing…") and no
 *  wider: everything they do not take goes to the observation, which is a
 *  SENTENCE and the only column whose content is worth more room. */
export const BRIEFING_ROW_COLS =
  'sm:grid sm:grid-cols-[10px_minmax(0,1fr)_104px_96px_92px_62px] sm:items-center sm:gap-x-3 sm:gap-y-0';

export function BriefingRow({
  finding,
  evidence,
  /** "this morning" / "yesterday" / "13 Aug" — computed on the SERVER from the
   *  page's one clock, for the reason `foundLabel` gives: a client recomputing
   *  "this morning" at hydration can disagree with the HTML it is hydrating. */
  foundShort,
}: {
  finding: AgentFinding;
  evidence?: EvidenceSummary;
  foundShort: string;
}) {
  const { write, done, busy, toastNode } = useStatusWrite(finding);
  const isNew = finding.status === 'new';
  const dot = agentChip(finding.agent).dot;

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-b border-[var(--pf-border-soft)] px-4 py-2.5 text-[13px] transition-colors last:border-b-0 hover:bg-[var(--pf-surface-tint-faint)] motion-reduce:transition-none print:break-inside-avoid ${BRIEFING_ROW_COLS} ${
        done ? 'pointer-events-none opacity-40' : ''
      }`}
      aria-busy={busy || done}
    >
      {toastNode}

      <span className="flex shrink-0 items-center self-center">
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={
            isNew
              ? { backgroundColor: dot }
              : { boxShadow: `inset 0 0 0 1.5px ${dot}`, backgroundColor: 'transparent' }
          }
          aria-hidden
        />
        <span className="sr-only">{isNew ? 'New. ' : 'In progress. '}</span>
      </span>

      {/* `basis` only bites in the mobile flex line, where it pushes everything
          else onto the row below; as a grid item above `sm` it is ignored.
          TWO LINES, NOT ONE: an observation is a sentence, and a single-line
          truncate cuts most of them at "FreshCo Produce raised tomatoes from
          R8.41/kg to…" — which is the half that says nothing. Clamped at two so
          a long one still cannot set the height of the whole table; the full
          text is on the row's `title` and one click away. */}
      <Link
        href={`/app/finding/${finding.id}`}
        className="line-clamp-2 min-w-0 basis-[calc(100%-1.25rem)] rounded-[6px] leading-[1.45] text-[var(--pf-text-body)] outline-none hover:text-[var(--pf-accent-deep)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--pf-accent-ring)] sm:basis-auto"
        title={finding.observation}
      >
        {finding.observation}
      </Link>

      <span className="of-num shrink-0 font-medium tabular-nums text-[var(--pf-text)] sm:text-right">
        {finding.rand_impact != null ? (
          <>
            ≈ {rand(finding.rand_impact)}
            <span className="text-[11px] font-normal text-[var(--pf-text-muted)]">/yr</span>
          </>
        ) : (
          // An unpriced finding is one nobody could price, not one worth
          // nothing — a dash says that, a "R0" would be a claim.
          <span className="text-[var(--pf-text-faint)]" aria-label="No rand figure">
            —
          </span>
        )}
      </span>

      <span className="min-w-0 shrink-0 truncate text-[12px] text-[var(--pf-text-secondary)]">
        {evidence?.label ? (
          evidence.href ? (
            // Where the evidence link points is the RESOLVER's decision, not
            // this row's — see agent-findings.ts. The row renders what it was
            // handed, and shows plain text rather than a dead link when the
            // refs resolved to nothing readable.
            <Link href={evidence.href} className="text-[var(--pf-accent-strong)] hover:underline">
              {evidence.label}
            </Link>
          ) : (
            evidence.label
          )
        ) : (
          <span className="text-[var(--pf-text-faint)]">—</span>
        )}
      </span>

      <span className="shrink-0 text-[12px] text-[var(--pf-text-faint)]">
        <span className="sr-only">Found </span>
        {foundShort}
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={() => write('dismissed')}
        aria-label={`Dismiss: ${finding.observation}`}
        className="ml-auto shrink-0 rounded-[7px] px-1.5 py-1 text-[12px] text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-text-control)] disabled:opacity-50 motion-reduce:transition-none sm:ml-0 sm:text-right print:hidden"
      >
        {busy ? 'Dismissing…' : 'Dismiss'}
      </button>
    </div>
  );
}
