import Link from 'next/link';
import type { AgentFinding, EvidenceSummary } from '@/lib/platform/agent-findings';
import { groupByAgent } from '@/lib/platform/brief-feed';
import { FindingCard } from './FindingCard';
import { ReadOvernightBand } from './ReadOvernightBand';
import { agentChip, foundLabel } from './brief-display';

/**
 * `/app?view=all` — every open finding, not just today's five.
 *
 * WHAT IT IS FOR. "Today's brief" caps at five cards so the landing page is a
 * brief rather than a backlog (lib/platform/brief-feed.ts). This is where the
 * rest of them live, reached from the overflow card's "View the full briefing
 * →". It is the destination that makes the cap honest: nothing is hidden, it is
 * one click behind a sentence that says how much of it there is.
 *
 * SAME CARDS, DIFFERENT SHAPE. `FindingCard` is reused verbatim — dismiss,
 * discuss, the evidence link, the tap-through to `/app/finding/[id]` all behave
 * exactly as they do on the brief, because a finding read here and a finding
 * read there are the same finding and must not offer different actions. What
 * changes is the arrangement: grouped under an agent heading instead of one
 * ranked column. The two views answer different questions — "what do I do
 * first?" is an ordering; "what has Vyso got on me?" is about coverage, and
 * twenty-three cards in a flat list is the wall the cap exists to prevent.
 *
 * HEADINGS COME FROM `agentChip`. The same function the cards' chips use, so a
 * group can never be titled something its own cards disagree with, and an agent
 * this component has never heard of still gets a title-cased heading rather than
 * a blank one (see brief-display.ts). The ORDER comes from `groupByAgent`, which
 * puts the money agents first and appends unknown ones rather than dropping
 * them.
 *
 * READ OVERNIGHT IS LAST AND STILL SEPARATE. Doc Watch's receipts are rendered
 * here — the plan's grouping is "Price Watch, Debtors, Stock, then Read
 * overnight" — through the same `ReadOvernightBand` the brief uses, which keeps
 * them visually quieter and counted in nothing. They are not a fifth group: they
 * are not findings.
 *
 * A SERVER COMPONENT, so every "found" label is computed once from the page's
 * single clock and crosses into the client cards as finished text (the rule
 * `foundLabel` established — a client recomputing "this morning" at hydration
 * can disagree with the HTML it is hydrating).
 */
export function FullBriefing({
  open,
  informational,
  evidence,
  now,
}: {
  /** Every open, non-informational finding — uncapped. */
  open: AgentFinding[];
  /** Doc Watch's receipts, still inside their 48-hour window. */
  informational: AgentFinding[];
  evidence: Record<string, EvidenceSummary>;
  /** The page's one clock, shared with the greeting above this. */
  now: Date;
}) {
  const groups = groupByAgent(open);

  return (
    <div className="mt-9">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="of-display text-[17px] font-semibold text-[var(--pf-text)]">
          Full briefing
        </h2>
        <Link
          href="/app"
          className="rounded-[9px] text-[13px] text-[var(--pf-accent-strong)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--pf-accent-ring)]"
        >
          ← Back to today&apos;s brief
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-3.5 text-[13.5px] text-[var(--pf-text-secondary)]">
          Nothing is open right now.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.agent} className="mt-7" aria-label={agentChip(group.agent).label}>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pf-text-muted)]">
              {agentChip(group.agent).label}
              {/* The count is per GROUP, deliberately — the greeting above
                  already carries the total, and repeating it here would read as
                  a second, disagreeing number. */}
              <span className="of-num ml-2 font-normal text-[var(--pf-text-faint)]">
                {group.findings.length}
              </span>
            </h3>

            <div className="mt-3.5 flex flex-col gap-3.5">
              {group.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  evidence={evidence[f.id]}
                  foundLabel={foundLabel(f.created_at, now)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <ReadOvernightBand findings={informational} evidence={evidence} now={now} />
    </div>
  );
}
