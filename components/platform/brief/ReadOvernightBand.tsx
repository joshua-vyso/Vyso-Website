import Link from 'next/link';
import type { AgentFinding, EvidenceSummary } from '@/lib/platform/agent-findings';
import { AI_GRADIENT_TEXT, countSinceSastMidnight, foundLabel } from './brief-display';

/**
 * "Read this morning" — the informational band below the findings.
 *
 * WHAT IT IS. Doc Watch writes one card per document Vyso reads. Those cards are
 * receipts, not problems: they carry no rand figure and recommend nothing, and
 * `fetchFindings` keeps them out of `open` entirely so the greeting still says
 * "3 things need your attention" on a morning when twelve invoices also landed
 * (lib/platform/agent-findings.ts → INFORMATIONAL_AGENTS). This band is where
 * they go instead — visually quieter than a FindingCard in every respect that
 * matters: no gradient accent bar, no ≈R/yr figure, no Dismiss button, smaller
 * type, flatter surface.
 *
 * WHY IT EARNS ITS SPACE. It is the product saying "I was working while you were
 * not". The mock's line — "✦ Overnight I read 12 new invoices…" — is the single
 * most quoted thing about the Brief's design, and until Doc Watch existed there
 * was nothing in the schema that recorded Vyso having read anything, so the
 * Brief deliberately did not say it (see app/app/page.tsx's docblock). Now there
 * is, and the line is derived: `countSinceSastMidnight` counts cards that exist,
 * in the owner's timezone. When that count is zero the line is dropped rather
 * than rendered as "0 documents".
 *
 * NO DISMISS. There is nothing to dismiss — a receipt is not a task. They age
 * out on their own after 48 hours (INFORMATIONAL_TTL_HOURS), computed at read
 * time, and land in History like everything else.
 *
 * A SERVER COMPONENT, on purpose: it renders text and links, holds no state, and
 * both its labels are computed from the page's single `now` so nothing can
 * disagree across a hydration boundary.
 */
export function ReadOvernightBand({
  findings,
  evidence,
  now,
}: {
  /** `feed.informational` — newest first, already inside its 48-hour window. */
  findings: AgentFinding[];
  evidence: Record<string, EvidenceSummary>;
  /** The page's one clock, so every label here agrees with the greeting's. */
  now: Date;
}) {
  if (findings.length === 0) return null;

  const today = countSinceSastMidnight(
    findings.map((f) => f.created_at),
    now,
  );

  return (
    <section className="mt-9" aria-label="Documents Vyso read">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pf-text-muted)]">
        {today > 0 ? 'Read this morning' : 'Recently read'}
      </h2>

      {today > 0 ? (
        <p className="mt-2 flex items-start gap-2 text-[13px] text-[var(--pf-text-secondary)]">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: AI_GRADIENT_TEXT }}
            aria-hidden
          >
            ✦
          </span>
          <span>
            Since midnight Vyso read {today} {today === 1 ? 'document' : 'documents'} for you.
            Nothing here needs a decision.
          </span>
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {findings.map((f) => (
          <li
            key={f.id}
            className="rounded-[var(--pf-radius-card)] border border-[#EFEDE8] bg-[#FBFAF8] px-[18px] py-3.5"
          >
            <p className="text-[13.5px] leading-[1.5] text-[var(--pf-text-secondary)]">
              {f.observation}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <span className="text-[11.5px] text-[var(--pf-text-faint)]">
                {foundLabel(f.created_at, now)}
              </span>
              {evidence[f.id]?.href ? (
                <Link
                  href={evidence[f.id].href!}
                  className="text-[12px] text-[var(--pf-accent-strong)] hover:underline"
                >
                  {evidence[f.id].label} ↗
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
