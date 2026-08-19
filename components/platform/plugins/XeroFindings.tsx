import { FindingCard } from '@/components/platform/brief/FindingCard';
import { foundLabel } from '@/components/platform/brief/brief-display';
import type { AgentFinding, EvidenceSummary } from '@/lib/platform/agent-findings';

/**
 * What Xero Watch has to say, on the plugin's own page.
 *
 * THE SAME CARD THE BRIEF DRAWS, not a plugin-flavoured copy. `FindingCard` owns
 * dismiss, the ✦ discuss gesture, the evidence link and the tap-through to
 * `/app/finding/[id]`; a second card here would be a second place all of that can
 * drift. The findings themselves are NOT filtered out of the Brief by appearing
 * here — this page is a lens on the same rows, which is why dismissing from
 * either surface removes the card from both.
 *
 * SERVER COMPONENT. Every string a card needs is formatted upstream (the page
 * passes `foundLabel` in already-rendered form, for the reason
 * `brief-display.ts` spells out: a client recomputing "this morning" at
 * hydration can disagree with the HTML it is hydrating).
 *
 * THE EMPTY STATE IS NOT AN APOLOGY. "Nothing to flag" is the answer an owner
 * wants from an agent that reads their books nightly, so it is worded as a
 * result rather than as an absence of one. The pre-migration case (`xero_watch`
 * has never run) reads identically on purpose — "your ops software isn't
 * finished" is not the customer's problem.
 */
export function XeroFindings({
  findings,
  evidence,
  now,
}: {
  /** Open `agent_findings` rows for `xero_watch`, in the Brief's own order. */
  findings: AgentFinding[];
  /** The feed's resolved evidence, keyed by finding id — passed straight through. */
  evidence: Record<string, EvidenceSummary>;
  /** One clock for the whole list, resolved on the server. */
  now: Date;
}) {
  return (
    <section>
      <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Findings from Xero</h2>
      <p className="mt-1 text-[13px] text-[#6B6F68]">
        These also appear on your brief. Dismissing one here dismisses it there.
      </p>

      {findings.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="text-[13.5px] font-semibold text-[#171A17]">Nothing to flag</div>
          <p className="mt-1 text-[13px] text-[#6B6F68]">
            Xero Watch checks your connection, your overdue receivables, the bills falling due this
            week and any duplicate supplier bills every night. Anything worth your attention lands
            here and on your brief.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              evidence={evidence[f.id]}
              foundLabel={foundLabel(f.created_at, now)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
