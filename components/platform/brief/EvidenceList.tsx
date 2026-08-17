import Link from 'next/link';

/**
 * What the finding was read from (design 1c, the evidence strip).
 *
 * THIS IS THE PROOF, AND IT HAS TO BE OPENABLE. The Brief's whole claim on the
 * owner's trust is "every sentence here comes from a document you have" — a
 * count they cannot click is a claim they have to take on faith. So each card
 * is a link into Doc-U, and each one carries the line price the agent actually
 * read off that invoice, which is the number the chart above is drawn from.
 *
 * Presentational and already-formatted: the dates and prices arrive as strings
 * built on the server (see app/app/finding/[id]/page.tsx). A client component
 * formatting a date at hydration can disagree with the HTML it is hydrating,
 * and a flicker on the date of a money finding reads as a bug.
 *
 * A cited document that no longer resolves is NOT silently dropped from the
 * count: `missing` says so in words (plan §5). "3 invoices" over an empty strip
 * would look broken; "no longer available" is a fact about the account.
 */

export interface EvidenceItem {
  id: string;
  filename: string;
  /** "13 Aug 2026" — the invoice date where the price series knows it, else the
   *  day the document was uploaded. */
  dateLabel: string;
  /** "Butternut @ R9.42/kg", or null when this document contributed no point to
   *  the series (a statement cited for context, a line that failed to match). */
  priceLabel: string | null;
}

export function EvidenceList({
  items,
  label,
  missing,
}: {
  items: EvidenceItem[];
  /** "3 invoices" — the truthful noun from `agent-findings.ts`. */
  label: string;
  missing: boolean;
}) {
  if (missing) {
    return (
      <section className="mt-6">
        <SectionHeading>Evidence</SectionHeading>
        <p className="mt-2.5 text-[13px] text-[var(--pf-text-secondary)]">
          The documents behind this finding are no longer available.
        </p>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <SectionHeading>Evidence · {label} from Doc-U</SectionHeading>
        <Link
          href={`/app/docu/${items[0].id}`}
          className="text-[12px] text-[var(--pf-accent-strong)] hover:underline"
        >
          Open in Doc-U ↗
        </Link>
      </div>

      <div className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/app/docu/${item.id}`}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--pf-border)] bg-white p-3 transition-colors hover:border-[var(--pf-accent-ring)] hover:bg-[var(--pf-surface-tint-faint)]"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            <PaperMark />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--pf-text)]">
                {item.filename}
              </div>
              <div className="mt-0.5 text-[12px] text-[var(--pf-text-secondary)]">{item.dateLabel}</div>
              {item.priceLabel ? (
                <div className="of-num mt-0.5 truncate text-[12px] text-[var(--pf-text-muted)]">
                  {item.priceLabel}
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
 *  read. */
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
