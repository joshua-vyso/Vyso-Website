/**
 * SupplySync measured derivations — the parts of the module that are counted
 * rather than illustrated.
 *
 *  - `measureEvents`  : performance counted off the relationship log
 *                       (`ss_supplier_history`), so "3 late deliveries in 90
 *                       days" is a fact with rows behind it. Anything the log
 *                       can't answer stays on the illustrative scorecards, and
 *                       every surface says which is which.
 *  - `buildDocExpiries`: expiring/expired/missing compliance documents turned
 *                       into an actionable, ordered worklist.
 *
 * Pure functions — the data layer fetches, this file derives.
 */

import type { Supplier, SupplierDocument, SupplierDocumentStatus, SupplierHistoryEvent } from '@/lib/platform/supplysync-data';

// ---------------------------------------------------------------------------
// Measured performance
// ---------------------------------------------------------------------------

/** Default measurement window — a quarter of trading. */
export const MEASURE_WINDOW_DAYS = 90;

/** Event types (and history channels) that count as a delivery failure. */
const LATE_EVENTS = new Set(['late_delivery']);
const DELIVERY_ISSUE_EVENTS = new Set(['delivery_issue']);
const QUALITY_EVENTS = new Set(['complaint', 'quality_issue']);
const COMPLIANCE_EVENTS = new Set(['compliance_issue']);
const CONTACT_EVENTS = new Set(['call', 'whatsapp', 'email', 'meeting']);
const PRICE_EVENTS = new Set(['price_update', 'price_list_received']);

export interface MeasuredPerformance {
  windowDays: number;
  /** Events logged inside the window — 0 means nothing is measured yet. */
  events: number;
  lateDeliveries: number;
  deliveryIssues: number;
  qualityComplaints: number;
  complianceIssues: number;
  priceMoves: number;
  contacts: number;
  /** Late + delivery + quality + compliance. */
  issues: number;
  /** Issues per 30 days across the window, one decimal. */
  issuesPer30Days: number;
  lastEventDate: string | null;
  lastIssueDate: string | null;
  /** Days since anything at all was logged, null when the log is empty. */
  daysSinceContact: number | null;
  hasData: boolean;
}

export const EMPTY_MEASURED: MeasuredPerformance = {
  windowDays: MEASURE_WINDOW_DAYS,
  events: 0,
  lateDeliveries: 0,
  deliveryIssues: 0,
  qualityComplaints: 0,
  complianceIssues: 0,
  priceMoves: 0,
  contacts: 0,
  issues: 0,
  issuesPer30Days: 0,
  lastEventDate: null,
  lastIssueDate: null,
  daysSinceContact: null,
  hasData: false,
};

function dayDiff(fromISO: string, toMs: number): number | null {
  const t = new Date(`${fromISO}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((toMs - t) / 86_400_000);
}

/**
 * Count what the relationship log actually says about a supplier over the last
 * `windowDays`. Channel labels ("Delivery Issue", "Complaint") are honoured
 * alongside event types, because the manual log writes the channel and the
 * Doc-U feed writes the event type.
 */
export function measureEvents(events: SupplierHistoryEvent[], windowDays: number = MEASURE_WINDOW_DAYS): MeasuredPerformance {
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const m: MeasuredPerformance = { ...EMPTY_MEASURED, windowDays };
  for (const e of events) {
    if (!e.date) continue;
    const age = dayDiff(e.date, todayMs);
    if (age == null) continue;
    // Future-dated follow-ups aren't history; anything older than the window is out.
    if (age < 0 || age > windowDays) continue;

    m.events += 1;
    if (!m.lastEventDate || e.date > m.lastEventDate) m.lastEventDate = e.date;

    const type = e.eventType;
    const channel = e.channel ?? '';
    const isLate = LATE_EVENTS.has(type);
    const isDelivery = DELIVERY_ISSUE_EVENTS.has(type) || channel === 'Delivery Issue';
    const isQuality = QUALITY_EVENTS.has(type) || channel === 'Complaint';
    const isCompliance = COMPLIANCE_EVENTS.has(type);

    if (isLate) m.lateDeliveries += 1;
    if (isDelivery) m.deliveryIssues += 1;
    if (isQuality) m.qualityComplaints += 1;
    if (isCompliance) m.complianceIssues += 1;
    if (CONTACT_EVENTS.has(type)) m.contacts += 1;
    if (PRICE_EVENTS.has(type)) m.priceMoves += 1;

    if (isLate || isDelivery || isQuality || isCompliance) {
      if (!m.lastIssueDate || e.date > m.lastIssueDate) m.lastIssueDate = e.date;
    }
  }

  m.issues = m.lateDeliveries + m.deliveryIssues + m.qualityComplaints + m.complianceIssues;
  m.issuesPer30Days = windowDays > 0 ? Math.round((m.issues / windowDays) * 30 * 10) / 10 : 0;
  m.daysSinceContact = m.lastEventDate ? dayDiff(m.lastEventDate, todayMs) : null;
  m.hasData = m.events > 0;
  return m;
}

// ---------------------------------------------------------------------------
// Document expiry worklist
// ---------------------------------------------------------------------------

export type ExpiryUrgency = 'missing' | 'expired' | 'critical' | 'soon';

export interface DocExpiryItem {
  id: string;
  supplierId: string;
  supplierName: string;
  docId: string;
  label: string;
  docType: string;
  status: SupplierDocumentStatus;
  expiry: string | null;
  daysRemaining: number | null;
  urgency: ExpiryUrgency;
  /** What to do about it, phrased as an instruction. */
  action: string;
}

/** Documents inside this many days of expiry make the worklist. */
export const EXPIRY_HORIZON_DAYS = 45;
/** …and inside this many are treated as urgent. */
const CRITICAL_DAYS = 14;

const URGENCY_RANK: Record<ExpiryUrgency, number> = { missing: 0, expired: 1, critical: 2, soon: 3 };

function urgencyOf(doc: SupplierDocument): ExpiryUrgency | null {
  if (doc.status === 'missing') return 'missing';
  if (doc.status === 'expired') return 'expired';
  const d = doc.daysRemaining;
  if (d != null && d < 0) return 'expired';
  if (d != null && d <= CRITICAL_DAYS) return 'critical';
  if (doc.status === 'expiring') return 'critical';
  if (d != null && d <= EXPIRY_HORIZON_DAYS) return 'soon';
  return null;
}

function actionFor(urgency: ExpiryUrgency, doc: SupplierDocument, supplierName: string): string {
  const d = doc.daysRemaining;
  switch (urgency) {
    case 'missing':
      return `Request ${doc.label.toLowerCase()} from ${supplierName} — never supplied.`;
    case 'expired':
      return `${doc.label} expired${d != null ? ` ${Math.abs(d)} days ago` : ''} — request a renewed copy before the next order.`;
    case 'critical':
      return `Chase ${supplierName} for the renewed ${doc.label.toLowerCase()}${d != null && d >= 0 ? ` — ${d} days left` : ''}.`;
    default:
      return `Diarise the ${doc.label.toLowerCase()} renewal${d != null ? ` (${d} days out)` : ''}.`;
  }
}

/**
 * Every compliance document that needs a human, most urgent first: missing,
 * then expired, then inside a fortnight, then inside the horizon. Valid
 * documents with plenty of runway never appear — this is a worklist, not a list.
 */
export function buildDocExpiries(suppliers: Supplier[]): DocExpiryItem[] {
  const out: DocExpiryItem[] = [];
  for (const s of suppliers) {
    for (const doc of s.docs) {
      const urgency = urgencyOf(doc);
      if (!urgency) continue;
      out.push({
        id: `dx-${doc.id}`,
        supplierId: s.id,
        supplierName: s.name,
        docId: doc.id,
        label: doc.label,
        docType: doc.docType,
        status: doc.status,
        expiry: doc.expiry,
        daysRemaining: doc.daysRemaining,
        urgency,
        action: actionFor(urgency, doc, s.name),
      });
    }
  }
  return out.sort((a, b) => {
    const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    const ad = a.daysRemaining ?? -9999;
    const bd = b.daysRemaining ?? -9999;
    if (ad !== bd) return ad - bd;
    return a.supplierName.localeCompare(b.supplierName);
  });
}
