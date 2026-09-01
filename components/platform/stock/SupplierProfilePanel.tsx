'use client';

import Link from 'next/link';
import { Badge, type Tone } from '@/components/platform/module-ui';

/**
 * The supplier profile panel — contacts, prices on file, and the credit-note
 * register for one supplier.
 *
 * BUILT FRESH, NOT MOUNTED. The old `SupplierProfileDrawer` is deliberately not
 * reused (plan §Suppliers): it is a modal drawer wired into the SupplySync
 * screen's own tabs and selection model, and the new page needs an inline panel
 * beside a table. The DATA behind it is the same — `getSupplySyncData` and
 * `supplysync-credits` still do the fetching and the maths; only the rendering
 * is new.
 *
 * READ-ONLY. Nothing on this panel writes. The only mutation on the whole Stock
 * & Suppliers surface this task adds is the category edit on the Market sheet.
 */

export interface SupplierProfileContact {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  preferredMethod: string;
  isPrimary: boolean;
}

export interface SupplierProfilePrice {
  id: string;
  item: string;
  unit: string;
  currentPrice: number;
  previousPrice: number | null;
  changePct: number | null;
  lastUpdated: string | null;
  /** Where the figure came from — a tracked price list, or the documents feed. */
  source: 'price_list' | 'documents';
}

export interface SupplierProfileCredit {
  id: string;
  reference: string | null;
  item: string | null;
  description: string;
  issueLabel: string;
  statusLabel: string;
  amount: number;
  amountCredited: number | null;
  claimedOn: string;
  ageDays: number;
  unresolved: boolean;
  /** The Doc-U document the claim was raised off, when there is one. */
  documentId: string | null;
}

/** A filed `supplier_credit_note` document with no claim row against it — the
 *  paperwork arrived, nobody logged the claim. Worth showing next to the ones
 *  that were. */
export interface SupplierProfileCreditDoc {
  id: string;
  filename: string;
  date: string | null;
  status: string;
}

export interface SupplierProfileData {
  key: string;
  name: string;
  category: string;
  status: string;
  risk: string;
  rating: number;
  location: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  lastOrder: string | null;
  spendMtd: number;
  leadTimeDays: number | null;
  /** False for a core `suppliers` row with no `ss_suppliers` profile yet. */
  hasProfile: boolean;
  contacts: SupplierProfileContact[];
  pricing: SupplierProfilePrice[];
  credits: SupplierProfileCredit[];
  creditDocs: SupplierProfileCreditDoc[];
  unresolvedCreditTotal: number;
  unresolvedCreditCount: number;
}

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });
const zar0 = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });
const money = (n: number | null | undefined) => (n == null ? '—' : zar.format(n));

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_TONE: Record<string, Tone> = {
  preferred: 'positive',
  active: 'info',
  review: 'warning',
};
const RISK_TONE: Record<string, Tone> = { low: 'positive', medium: 'warning', high: 'critical' };

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--pf-border-soft)] px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pf-text-secondary)]">{title}</h3>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[var(--pf-text-muted)]">{children}</p>;
}

export function SupplierProfilePanel({ supplier }: { supplier: SupplierProfileData | null }) {
  if (!supplier) {
    return (
      <div className="rounded-2xl border border-[var(--pf-border)] bg-white p-8 text-center shadow-[var(--pf-shadow-card)]">
        <p className="text-[14px] text-[var(--pf-text-muted)]">Pick a supplier to see contacts, prices and credit notes.</p>
      </div>
    );
  }

  const s = supplier;

  return (
    <div className="rounded-2xl border border-[var(--pf-border)] bg-white shadow-[var(--pf-shadow-card)]">
      <div className="px-5 py-4">
        <h2 className="of-display text-[18px] font-semibold leading-tight text-[var(--pf-text)]">{s.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge label={s.category || 'Uncategorised'} tone="neutral" />
          {s.hasProfile ? (
            <>
              <Badge label={s.status} tone={STATUS_TONE[s.status] ?? 'neutral'} />
              <Badge label={`${s.risk} risk`} tone={RISK_TONE[s.risk] ?? 'neutral'} />
            </>
          ) : (
            <Badge label="No profile yet" tone="warning" />
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <dt className="text-[var(--pf-text-muted)]">Spend MTD</dt>
            <dd className="of-num mt-0.5 font-semibold text-[var(--pf-text)]">{zar0.format(s.spendMtd)}</dd>
          </div>
          <div>
            <dt className="text-[var(--pf-text-muted)]">Last order</dt>
            <dd className="mt-0.5 text-[var(--pf-text-body)]">{fmtDate(s.lastOrder)}</dd>
          </div>
          <div>
            <dt className="text-[var(--pf-text-muted)]">Rating</dt>
            <dd className="of-num mt-0.5 text-[var(--pf-text-body)]">{s.hasProfile ? `${s.rating} / 5` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[var(--pf-text-muted)]">Lead time</dt>
            <dd className="mt-0.5 text-[var(--pf-text-body)]">{s.leadTimeDays == null ? '—' : `${s.leadTimeDays} day${s.leadTimeDays === 1 ? '' : 's'}`}</dd>
          </div>
        </dl>
      </div>

      {/* ---- contacts ---- */}
      <Section title="Contacts">
        {s.contacts.length === 0 && !s.contactName && !s.contactEmail && !s.contactPhone ? (
          <Blank>No contacts captured for this supplier.</Blank>
        ) : (
          <ul className="space-y-2.5">
            {/* The denormalised quick-fields on the supplier row are a contact
                too — showing them only when there is no contacts table row for
                the same person keeps the list from doubling up. */}
            {s.contacts.length === 0 ? (
              <li className="text-[13px]">
                <div className="font-medium text-[var(--pf-text)]">{s.contactName ?? 'Main contact'}</div>
                <div className="mt-0.5 text-[var(--pf-text-secondary)]">
                  {[s.contactPhone, s.contactEmail].filter(Boolean).join(' · ') || '—'}
                </div>
              </li>
            ) : (
              s.contacts.map((c) => (
                <li key={c.id} className="text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--pf-text)]">{c.name || '—'}</span>
                    {c.isPrimary ? <Badge label="Primary" tone="info" /> : null}
                  </div>
                  <div className="mt-0.5 text-[var(--pf-text-secondary)]">
                    {[c.role, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--pf-text-muted)]">Prefers {c.preferredMethod}</div>
                </li>
              ))
            )}
          </ul>
        )}
        {s.location ? <p className="mt-3 text-[12px] text-[var(--pf-text-muted)]">{s.location}</p> : null}
      </Section>

      {/* ---- pricing ---- */}
      <Section
        title="Prices on file"
        right={<span className="text-[12px] text-[var(--pf-text-muted)]">{s.pricing.length}</span>}
      >
        {s.pricing.length === 0 ? (
          <Blank>No prices recorded for this supplier yet.</Blank>
        ) : (
          <ul className="space-y-2">
            {s.pricing.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--pf-text)]">{p.item}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--pf-text-muted)]">
                    per {p.unit} · {p.source === 'price_list' ? 'price list' : 'from documents'}
                    {p.lastUpdated ? ` · ${fmtDate(p.lastUpdated)}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="of-num font-semibold text-[var(--pf-text)]">{money(p.currentPrice)}</div>
                  {p.changePct != null && p.changePct !== 0 ? (
                    <div
                      className="of-num mt-0.5 text-[12px]"
                      style={{ color: p.changePct > 0 ? 'var(--tone-critical-fg)' : 'var(--tone-positive-fg)' }}
                    >
                      {p.changePct > 0 ? '+' : ''}
                      {p.changePct}%
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ---- credit notes ---- */}
      <Section
        title="Supplier credit notes"
        right={
          s.unresolvedCreditCount > 0 ? (
            <Badge label={`${zar0.format(s.unresolvedCreditTotal)} unresolved`} tone="warning" />
          ) : null
        }
      >
        {s.credits.length === 0 && s.creditDocs.length === 0 ? (
          <Blank>No credits claimed against this supplier.</Blank>
        ) : (
          <>
            <ul className="space-y-3">
              {s.credits.map((c) => (
                <li key={c.id} className="text-[13px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--pf-text)]">
                        {c.reference ? `${c.reference} · ` : ''}
                        {c.item || c.issueLabel}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--pf-text-muted)]">
                        {c.issueLabel} · claimed {fmtDate(c.claimedOn)}
                        {c.unresolved && c.ageDays > 0 ? ` · ${c.ageDays} day${c.ageDays === 1 ? '' : 's'} open` : ''}
                      </div>
                      {c.description ? (
                        <p className="mt-1 text-[12px] text-[var(--pf-text-secondary)]">{c.description}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="of-num font-semibold text-[var(--pf-text)]">{money(c.amount)}</div>
                      <div className="mt-1">
                        <Badge label={c.statusLabel} tone={c.unresolved ? 'warning' : 'positive'} />
                      </div>
                    </div>
                  </div>
                  {c.documentId ? (
                    <Link
                      href={`/app/stock/uploads/${c.documentId}`}
                      className="mt-1 inline-block text-[12px] font-medium text-[var(--pf-accent-strong)] hover:underline"
                    >
                      Open the document →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>

            {s.creditDocs.length > 0 ? (
              <div className="mt-4 border-t border-[var(--pf-border-soft)] pt-3">
                <p className="text-[12px] text-[var(--pf-text-muted)]">
                  Credit notes filed against this supplier{s.credits.length > 0 ? ' with no claim logged' : ''}:
                </p>
                <ul className="mt-2 space-y-1.5">
                  {s.creditDocs.map((d) => (
                    <li key={d.id} className="text-[13px]">
                      <Link
                        href={`/app/stock/uploads/${d.id}`}
                        className="font-medium text-[var(--pf-accent-strong)] hover:underline"
                      >
                        {d.filename || 'Credit note'}
                      </Link>
                      <span className="ml-2 text-[12px] text-[var(--pf-text-muted)]">{fmtDate(d.date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </Section>
    </div>
  );
}
