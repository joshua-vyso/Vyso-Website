import Link from 'next/link';
import { Badge, SectionCard, type Tone } from '@/components/platform/module-ui';
import { StatusPill, ConfidenceText } from '@/components/platform/ui';
import { rand } from '@/lib/platform/procurepulse';
import { documentTypeLabel } from '@/lib/platform/documents';
import type { StockPriceChange, StockDocument, StockRow } from '@/lib/platform/stock-data';

/**
 * The three cards under the Stock & Suppliers dashboard's KPI strip.
 *
 * SERVER COMPONENTS, DELIBERATELY. Nothing here is interactive — they read a
 * prop and render rows — so keeping them off the client boundary means the
 * dashboard ships no JS for them. (Importing SectionCard/Badge from the
 * `'use client'` module-ui is the ordinary boundary crossing, same as PhaseStub.)
 *
 * NEW JSX, NOT THE OLD SCREENS'. These are built on module-ui primitives and
 * --pf-* tokens; the ProcurePulse/SupplySync components they replace are still
 * on disk (their APIs and lib fetchers are reused) but none of their markup is.
 */

/** One list row: a label + sub-label on the left, a figure on the right. */
function Row({
  href,
  title,
  sub,
  right,
  rightSub,
}: {
  href?: string;
  title: string;
  sub?: React.ReactNode;
  right: React.ReactNode;
  rightSub?: React.ReactNode;
}) {
  const body = (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-[var(--pf-text)]">{title}</div>
        {sub != null ? <div className="mt-0.5 truncate text-[12px] text-[var(--pf-text-muted)]">{sub}</div> : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="of-num text-[13px] font-semibold text-[var(--pf-text)]">{right}</div>
        {rightSub != null ? <div className="mt-0.5 text-[11px] text-[var(--pf-text-faint)]">{rightSub}</div> : null}
      </div>
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-[var(--pf-surface-tint)]">
      {body}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-[var(--pf-text-muted)]">{children}</p>;
}

/** Divided list — the shared body of all three cards. */
function List({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--pf-border-soft)]">{children}</div>;
}

// ---------------------------------------------------------------------------

/** Worst-off products, on-hand against the threshold that governs them. */
export function LowStockCard({ rows }: { rows: StockRow[] }) {
  return (
    <SectionCard
      title="Low stock"
      right={
        <Link href="/app/stock/levels" className="text-[13px] font-medium text-[var(--pf-accent-strong)] hover:underline">
          All stock
        </Link>
      }
    >
      {rows.length === 0 ? (
        <Empty>Everything is above its threshold.</Empty>
      ) : (
        <List>
          {rows.map((r) => {
            const tone: Tone = r.status === 'out' ? 'critical' : 'warning';
            return (
              <Row
                key={r.id}
                href="/app/stock/levels"
                title={r.name}
                sub={
                  <span className="inline-flex items-center gap-2">
                    <Badge label={r.status === 'out' ? 'Out' : 'Low'} tone={tone} />
                    {r.category ?? 'Uncategorised'}
                  </span>
                }
                right={`${fmtQty(r.onHand)} ${r.unit}`}
                rightSub={`of ${fmtQty(r.threshold)} ${r.unit}`}
              />
            );
          })}
        </List>
      )}
    </SectionCard>
  );
}

/** Latest supplier price moves — current vs the price it replaced. */
export function PriceChangesCard({ changes }: { changes: StockPriceChange[] }) {
  return (
    <SectionCard
      title="Recent price changes"
      right={
        <Link href="/app/stock/market" className="text-[13px] font-medium text-[var(--pf-accent-strong)] hover:underline">
          Market sheet
        </Link>
      }
    >
      {changes.length === 0 ? (
        <Empty>No price movement recorded yet.</Empty>
      ) : (
        <List>
          {changes.map((c) => (
            <Row
              key={c.id}
              href="/app/stock/market"
              title={c.item}
              sub={c.supplierName}
              right={`${rand(c.currentPrice)}/${c.unit}`}
              rightSub={
                c.changePct == null ? (
                  '—'
                ) : (
                  // Up is bad here: this is what the business PAYS, so a rise is
                  // the warning colour and a drop is the good one — the inverse
                  // of a revenue chart's instinct.
                  <span style={{ color: c.changePct > 0 ? 'var(--tone-critical-fg)' : 'var(--tone-positive-fg)' }}>
                    {c.changePct > 0 ? '▲' : '▼'} {Math.abs(c.changePct).toFixed(1)}%
                  </span>
                )
              }
            />
          ))}
        </List>
      )}
    </SectionCard>
  );
}

/** Newest buying paperwork, each row opening its review page. */
export function RecentDocumentsCard({ docs }: { docs: StockDocument[] }) {
  return (
    <SectionCard
      title="Recent stock documents"
      right={
        <Link href="/app/stock/uploads" className="text-[13px] font-medium text-[var(--pf-accent-strong)] hover:underline">
          Uploads
        </Link>
      }
    >
      {docs.length === 0 ? (
        <Empty>Nothing uploaded yet.</Empty>
      ) : (
        <List>
          {docs.map((d) => (
            <Row
              key={d.id}
              href={`/app/stock/uploads/${d.id}`}
              title={d.filename}
              sub={
                <span className="inline-flex items-center gap-2">
                  <StatusPill status={d.status} />
                  {documentTypeLabel({ document_type: d.document_type, extracted_data: null })}
                </span>
              }
              right={<ConfidenceText value={d.confidence} />}
              rightSub={fmtDate(d.created_at)}
            />
          ))}
        </List>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------

/** Whole numbers stay whole; fractional quantities keep one decimal. */
function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
