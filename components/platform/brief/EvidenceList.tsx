import Link from 'next/link';

/**
 * What the finding was read from (design 1c, the evidence strip).
 *
 * THIS IS THE PROOF, AND IT HAS TO BE OPENABLE. The Brief's whole claim on the
 * owner's trust is "every sentence here comes from a row you have" — a count
 * they cannot click is a claim they have to take on faith. So each card is a
 * link into the module that row lives in, and each one carries the figure the
 * agent actually read off it: the line price for a Price Watch invoice, the
 * outstanding balance and the days past terms for a Debtors Watch one.
 *
 * THREE KINDS, ONE STRIP. Before Phase C every finding cited Doc-U documents and
 * this component hardcoded that — the heading said "from Doc-U" and every card
 * linked `/app/docu/<id>`. Debtors Watch cites `of_invoices` and Stock Cover
 * cites one `pp_stock_items` line, so the strings and the hrefs are now computed
 * by the caller (`lib/platform/agents/finding-kinds.ts` + the page) and this file
 * is left with the markup. A fourth agent needs no change here.
 *
 * Presentational and already-formatted: the dates, prices and balances arrive as
 * strings built on the server (see app/app/finding/[id]/page.tsx). A client
 * component formatting a date at hydration can disagree with the HTML it is
 * hydrating, and a flicker on the date of a money finding reads as a bug.
 *
 * A cited row that no longer resolves is NOT silently dropped from the count:
 * `missing` says so in words (plan §5). "3 invoices" over an empty strip would
 * look broken; "no longer available" is a fact about the account.
 */

/** Which glyph sits beside an item. Paper for anything that is a piece of paper
 *  (a document, an invoice); the crate for a stock line, which is not. */
export type EvidenceMark = 'paper' | 'stock';

export interface EvidenceItem {
  id: string;
  /** Where this row lives: `/app/docu/<id>`, `/app/orderflow/invoices/<id>`,
   *  `/app/procurepulse/stock/<id>`. Built by the page, which is the only place
   *  that knows the kind. */
  href: string;
  /** The filename, the invoice number, the stock line's name. */
  title: string;
  /** "13 Aug 2026", "Northern Suburbs Supply · due 4 Jul 2026", "Low cover". */
  subtitle: string;
  /** "Butternut @ R9.42/kg", "R 12,400 · 40 days past terms", or null when there
   *  is no third line to draw. */
  detail: string | null;
}

/** Everything the strip needs, assembled on the server. One object rather than
 *  seven props threaded through `FindingDetail`, which only passes it along. */
export interface EvidencePanel {
  items: EvidenceItem[];
  /** "Evidence · 3 invoices from OrderFlow" / "Subject · stock line". */
  heading: string;
  /** "Evidence" / "Subject" — the heading when there is nothing to show. */
  missingHeading: string;
  /** "The invoices behind this finding are no longer available." */
  missingCopy: string;
  missing: boolean;
  /** "Open in OrderFlow ↗" — opens the first item. */
  openLabel: string;
  mark: EvidenceMark;
}

export function EvidenceList({
  items,
  heading,
  missingHeading,
  missingCopy,
  missing,
  openLabel,
  mark,
}: EvidencePanel) {
  if (missing) {
    return (
      <section className="mt-6">
        <SectionHeading>{missingHeading}</SectionHeading>
        <p className="mt-2.5 text-[13px] text-[var(--pf-text-secondary)]">{missingCopy}</p>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <SectionHeading>{heading}</SectionHeading>
        <Link
          href={items[0].href}
          className="text-[12px] text-[var(--pf-accent-strong)] hover:underline"
        >
          {openLabel}
        </Link>
      </div>

      <div className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--pf-border)] bg-white p-3 transition-colors hover:border-[var(--pf-accent-ring)] hover:bg-[var(--pf-surface-tint-faint)]"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            {mark === 'stock' ? <CrateMark /> : <PaperMark />}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--pf-text)]">
                {item.title}
              </div>
              {item.subtitle ? (
                <div className="mt-0.5 truncate text-[12px] text-[var(--pf-text-secondary)]">
                  {item.subtitle}
                </div>
              ) : null}
              {item.detail ? (
                <div className="of-num mt-0.5 truncate text-[12px] text-[var(--pf-text-muted)]">
                  {item.detail}
                </div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-text-muted)]">
      {children}
    </h2>
  );
}

/** The little sheet of paper from the mock — an abstract document, not a
 *  thumbnail. Doc-U has no rendered previews, and a fake one would be a picture
 *  of a document the owner never uploaded. The orange bar is the line the agent
 *  read. Also worn by an invoice: OrderFlow's invoices are paper too. */
function PaperMark() {
  return (
    <div
      className="flex h-[66px] w-[52px] flex-none flex-col gap-1 rounded-[3px] border border-[#E5E5E5] bg-[#FDFDFC] px-[6px] py-[7px] shadow-[0_1px_3px_rgba(20,24,20,0.08)]"
      aria-hidden
    >
      <div className="h-[4px] w-[55%] rounded-[2px] bg-[#C9CCC4]" />
      <div className="h-[3px] w-[85%] rounded-[2px] bg-[#E5E5E5]" />
      <div className="h-[3px] w-[75%] rounded-[2px] bg-[#E5E5E5]" />
      <div className="h-[3px] w-[82%] rounded-[2px] bg-[#E5E5E5]" />
      <div className="mt-auto h-[3px] w-[40%] rounded-[2px] bg-[#E5E5E5]" />
      <div className="h-[4px] w-[60%] rounded-[2px] bg-[#BE5D23] opacity-[0.55]" />
    </div>
  );
}

/** A stock line is not a document, so it does not get the sheet of paper. An
 *  abstract crate, in the same footprint and the same restraint — no quantity is
 *  drawn into it, because the level it depicts would be a number the page has
 *  not proved. */
function CrateMark() {
  return (
    <div
      className="flex h-[66px] w-[52px] flex-none flex-col justify-end gap-[3px] rounded-[3px] border border-[#E5E5E5] bg-[#FDFDFC] px-[6px] py-[7px] shadow-[0_1px_3px_rgba(20,24,20,0.08)]"
      aria-hidden
    >
      <div className="h-[4px] w-full rounded-[2px] bg-[#C9CCC4]" />
      <div className="h-[26px] w-full rounded-[2px] border border-[#E5E5E5] bg-[#F5F5F3]" />
      <div className="h-[4px] w-full rounded-[2px] bg-[#BE5D23] opacity-[0.55]" />
    </div>
  );
}
