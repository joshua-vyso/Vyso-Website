import Link from 'next/link';
import { rand } from '@/lib/platform/procurepulse';
import type { AgentFinding, EvidenceSummary } from '@/lib/platform/agent-findings';
import { groupByAgent } from '@/lib/platform/brief-feed';
import { BriefingRow, BRIEFING_ROW_COLS } from './BriefingRow';
import { ReadOvernightBand } from './ReadOvernightBand';
import { SAST, agentChip, briefDateLine, countSinceSastMidnight, foundLabel } from './brief-display';

/**
 * `/app?view=all` — every open finding, as a REPORT.
 *
 * WHAT IT IS FOR. "Today's brief" caps at five cards so the landing page is a
 * brief rather than a backlog (lib/platform/brief-feed.ts). This is where the
 * rest of them live, reached from the overflow card's "View the full briefing
 * →". It is the destination that makes the cap honest: nothing is hidden, it is
 * one click behind a sentence that says how much of it there is.
 *
 * A DIFFERENT SHAPE, BECAUSE IT ANSWERS A DIFFERENT QUESTION. Up to this pass
 * it reused `FindingCard` verbatim under agent headings, which made it a longer
 * brief rather than another kind of document. The two views are not the same
 * read: today's brief is "what do I do first?", which is an ordering and wants
 * cards you decide on one at a time; `?view=all` is "what has Vyso got on me?",
 * which is about COVERAGE — and coverage is a report. So this is drawn as one:
 * a masthead (who it is about, what it is, when it was generated), a totals
 * strip, and then one dense table per agent, one row per finding
 * (`BriefingRow`). The idiom is lifted from the design's own back-office table
 * (`.ai/design/vyso-brief/Vyso - The Brief.dc.html` §1d) — white sheet, hairline
 * rules, uppercase column heads, tabular figures right-aligned — which is
 * exactly the register a report should be in: plain, dense, printable.
 *
 * THE SAME FINDING, THE SAME ACTIONS. A row's headline is the same `<Link>` to
 * `/app/finding/[id]` the card carries, and its Dismiss is the card's own
 * `useStatusWrite`. A finding read here and a finding read on the brief are the
 * same finding and must not offer different outcomes; only the density changes.
 *
 * MONOCHROME, AGENT COLOURS AS THE ONLY ACCENT. `--pf-*` text tones throughout,
 * with each agent's chip dot as the one spot of colour in its section heading
 * and its rows' status dots. The AI gradient is deliberately absent: it means
 * "Vyso said this" and is rationed to five placements (brief-display.ts, THE
 * GRADIENT RULE); thirty rows of it would be wallpaper.
 *
 * HEADINGS AND ORDER COME FROM THE SAME PLACES THEY ALWAYS DID. `agentChip` for
 * the title, so a section can never be called something its rows disagree with
 * and an unknown agent still gets a title-cased heading rather than a blank one;
 * `groupByAgent` for the order, which puts the money agents first and APPENDS
 * unknown ones rather than dropping them — a new agent must never be the reason
 * a finding vanishes off the one screen that promises everything. Within a
 * section, `groupByAgent` applies `rankFindings`: money before recency, nulls
 * last.
 *
 * READ OVERNIGHT IS LAST AND STILL SEPARATE. Doc Watch's receipts render through
 * the same `ReadOvernightBand` the brief uses. They are not a fourth section:
 * they are not findings, they carry no figure and recommend nothing, and they
 * are counted in nothing except the masthead's "read overnight" total, which is
 * a statement about Vyso's work rather than about the owner's.
 *
 * A SERVER COMPONENT, so every derived label and every total is computed once
 * from the page's single clock and crosses into the client rows as finished text
 * (the rule `foundLabel` established — a client recomputing "this morning" at
 * hydration can disagree with the HTML it is hydrating).
 */

/** HH:mm in the owner's timezone. The masthead says when the report was
 *  generated, and every other figure on this page is quoted in SAST, so this
 *  one is too — a report timestamped in the server's timezone is a report
 *  nobody can match against their own morning. */
function sastTime(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SAST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/** The masthead's one-line summary. Every segment is DROPPED rather than
 *  rendered as a zero — the same "say nothing rather than claim nothing" rule
 *  the greeting and the ✦ line follow, and the reason "0 debtors" never appears
 *  next to three price findings. */
function totalsStrip(
  open: readonly AgentFinding[],
  informational: readonly AgentFinding[],
  now: Date,
): string[] {
  const segments: string[] = [];

  segments.push(`${open.length} ${open.length === 1 ? 'finding' : 'findings'}`);

  // Summed across the findings that carry a figure only. A finding nobody could
  // price contributes nothing to the total and is not counted as a zero, which
  // is why this is a filtered sum and not `reduce(... ?? 0)`.
  const priced = open.filter((f) => f.rand_impact != null);
  if (priced.length > 0) {
    const atStake = priced.reduce((sum, f) => sum + (f.rand_impact as number), 0);
    segments.push(`≈${rand(atStake)}/yr at stake`);
  }

  const debtors = open.filter((f) => f.agent === 'debtors_watch').length;
  if (debtors > 0) segments.push(`${debtors} ${debtors === 1 ? 'debtor' : 'debtors'}`);

  const stock = open.filter((f) => f.agent === 'stock_cover').length;
  if (stock > 0) segments.push(`${stock} stock ${stock === 1 ? 'line' : 'lines'}`);

  // Receipts since SAST midnight, the same count the band's own line quotes —
  // one derivation, so the strip and the band can never disagree about how much
  // Vyso read.
  const read = countSinceSastMidnight(
    informational.map((f) => f.created_at),
    now,
  );
  if (read > 0) segments.push(`${read} read overnight`);

  return segments;
}

export function FullBriefing({
  open,
  informational,
  evidence,
  orgName,
  now,
}: {
  /** Every open, non-informational finding — uncapped. */
  open: AgentFinding[];
  /** Doc Watch's receipts, still inside their 48-hour window. */
  informational: AgentFinding[];
  evidence: Record<string, EvidenceSummary>;
  /** Whose operation this report is about — the masthead's first line. */
  orgName: string;
  /** The page's one clock, shared with every label below it. */
  now: Date;
}) {
  const groups = groupByAgent(open);
  const totals = totalsStrip(open, informational, now);

  return (
    <div className="pt-1">
      {/* ── Masthead ───────────────────────────────────────────────────────── */}
      <header className="border-b border-[var(--pf-border-strong)] pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pf-text-muted)]">
            {orgName}
          </div>
          <Link
            href="/app"
            className="rounded-[9px] text-[13px] text-[var(--pf-accent-strong)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--pf-accent-ring)] print:hidden"
          >
            ← Back to today&apos;s brief
          </Link>
        </div>

        <h1 className="of-display mt-2 text-[clamp(22px,2.6vw,28px)] font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--pf-text)]">
          Full briefing
        </h1>

        <p className="mt-1 text-[13px] text-[var(--pf-text-secondary)]">
          {briefDateLine(now)} · {sastTime(now)} SAST
        </p>

        {/* The one-line totals strip. Interpuncts rather than a table: it is a
            sentence about the whole report, not another set of columns. */}
        <p className="of-num mt-3 text-[12.5px] tabular-nums text-[var(--pf-text-secondary)]">
          {totals.join(' · ')}
        </p>
      </header>

      {/* ── One table per agent ────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <p className="mt-6 text-[13.5px] text-[var(--pf-text-secondary)]">Nothing is open right now.</p>
      ) : (
        groups.map((group) => {
          const chip = agentChip(group.agent);
          const priced = group.findings.filter((f) => f.rand_impact != null);
          const subtotal = priced.reduce((sum, f) => sum + (f.rand_impact as number), 0);

          return (
            <section key={group.agent} className="mt-7" aria-label={chip.label}>
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1">
                <span
                  className="h-[7px] w-[7px] shrink-0 self-center rounded-full"
                  style={{ backgroundColor: chip.dot }}
                  aria-hidden
                />
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pf-text)]">
                  {chip.label}
                </h2>
                {/* The count is per SECTION, deliberately — the totals strip
                    above already carries the whole-report number, and repeating
                    it here would read as a second, disagreeing figure. */}
                <span className="of-num text-[12px] tabular-nums text-[var(--pf-text-faint)]">
                  {group.findings.length}
                </span>
                {priced.length > 0 ? (
                  <span className="of-num ml-auto text-[12px] tabular-nums text-[var(--pf-text-muted)]">
                    ≈{rand(subtotal)}/yr
                  </span>
                ) : null}
              </div>

              <div className="mt-2 overflow-hidden rounded-[12px] border border-[var(--pf-border)] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
                {/* The column heads are a visual scaffold, not content: this is
                    a grid of divs rather than a <table>, so the heads cannot be
                    associated with the cells anyway, and each row already says
                    what its own cells mean (the figure carries "≈…/yr", the
                    time cell an sr-only "Found"). Hidden from assistive tech
                    rather than read out as a stray line of nouns. Hidden below
                    `sm` too, where the rows stack and there are no columns for
                    it to head. */}
                <div
                  aria-hidden
                  className={`hidden border-b border-[var(--pf-border-soft)] bg-[var(--pf-surface-tint-faint)] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-text-muted)] ${BRIEFING_ROW_COLS}`}
                >
                  <span />
                  <span>Finding</span>
                  <span className="text-right">Per year</span>
                  <span>Evidence</span>
                  <span>Found</span>
                  <span />
                </div>

                {group.findings.map((f) => (
                  <BriefingRow
                    key={f.id}
                    finding={f}
                    evidence={evidence[f.id]}
                    // The card says "Found this morning" because it is read one
                    // at a time; a column headed "Found" repeating the word on
                    // every row is noise, so the prefix is stripped here rather
                    // than derived twice — one function still decides what the
                    // label SAYS (brief-display's `foundLabel`).
                    foundShort={foundLabel(f.created_at, now).replace(/^Found /, '')}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <ReadOvernightBand findings={informational} evidence={evidence} now={now} />
    </div>
  );
}
