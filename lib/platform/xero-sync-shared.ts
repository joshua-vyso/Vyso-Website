/**
 * The Xero sync's PURE half: what a Xero payload means, what a mirror row is,
 * and what the mirror adds up to. No fetch, no Supabase, no clock of its own.
 *
 * WHY EVERYTHING HERE IS PURE AND TESTED. `lib/platform/xero-sync.ts` beside it
 * cannot be unit tested — it imports `server-only` and talks to two networks —
 * and the parts of a sync that go wrong quietly are not the HTTP: they are the
 * date that came back as `/Date(1518685950940+0000)/` and got stored as the
 * string `NaN`, the ACCPAY that was filed as a receivable, the invoice number
 * that never matched because one side wrote "INV-9268" and the other "9268".
 * Those decisions live here, where `node --test` pins them against fixture
 * payloads shaped like Xero's own.
 *
 * NOTHING IN THIS FILE HAS EVER TALKED TO XERO. The fixtures in
 * tests/xero-sync.test.ts were written from Xero's published response shapes,
 * not captured from a live tenant, and the fields this module RELIES ON are
 * therefore listed explicitly so a future reader can check them against the API
 * rather than against a hope:
 *
 *   GET /api.xro/2.0/Invoices  → `{ "Invoices": [ … ] }`, each entry using
 *     `InvoiceID` (guid), `Type` ("ACCREC" | "ACCPAY"), `InvoiceNumber`,
 *     `Reference`, `Contact.ContactID`, `Contact.Name`, `Date`, `DueDate`,
 *     `Status`, `Total`, `AmountDue`, `AmountPaid`, `CurrencyCode`,
 *     `UpdatedDateUTC`.
 *   GET /api.xro/2.0/Contacts  → `{ "Contacts": [ … ] }`, each entry using
 *     `ContactID`, `Name`, `EmailAddress`, `IsSupplier`, `IsCustomer`,
 *     `UpdatedDateUTC`.
 *
 * Anything else Xero sends is ignored rather than stored: a mirror is only worth
 * keeping if you can say what is in it.
 *
 * Relative, `.ts`-suffixed imports and no framework dependencies — the rule every
 * unit-tested module under lib/platform follows, because `node --test` cannot
 * resolve the `@/` alias.
 */

import { rand } from './procurepulse.ts';

// ---------------------------------------------------------------------------
// Reading Xero's JSON
// ---------------------------------------------------------------------------

/**
 * Xero's Accounting API answers `Accept: application/json` with .NET-serialised
 * dates — `/Date(1518685950940+0000)/` — NOT ISO-8601. Every date this module
 * reads therefore goes through here, and here accepts both, because Xero also
 * sends plain `2018-02-15T00:00:00` in the `*String` companions of those fields
 * and a future API version could settle on one.
 *
 * Returns an ISO instant, or null for anything it cannot read. NULL RATHER THAN
 * A GUESS: a due date the sync invented is a bill the agent says is overdue when
 * it is not.
 */
export function parseXeroTimestamp(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return new Date(raw).toISOString();
  if (typeof raw !== 'string') return null;

  const dotNet = /^\/Date\((-?\d+)([+-]\d{4})?\)\/$/.exec(raw.trim());
  if (dotNet) {
    // The trailing offset is Xero's rendering of the SAME instant, not an extra
    // shift to apply — the millisecond count is already UTC. Applying it would
    // move every South African invoice two hours.
    const ms = Number(dotNet[1]);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/** The calendar day of a Xero date, 'YYYY-MM-DD'. Invoice and due dates are days
 *  in Xero's UI even though the wire format carries a time, and every comparison
 *  this product makes against them ("due within 7 days") is a day comparison. */
export function parseXeroDay(raw: unknown): string | null {
  const iso = parseXeroTimestamp(raw);
  return iso ? iso.slice(0, 10) : null;
}

/** A number out of Xero's JSON. Amounts arrive as JSON numbers, but a value that
 *  is absent, null or unparseable becomes null rather than 0 — "we do not know
 *  what is outstanding" and "nothing is outstanding" are different claims. */
export function parseXeroAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Invoice numbers
// ---------------------------------------------------------------------------

/**
 * An invoice number reduced to what two systems can agree on: letters and digits,
 * uppercased. "INV-9268" → "INV9268"; "inv 9268" → "INV9268".
 */
export function normaliseInvoiceNumber(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
}

/**
 * Every key an invoice number could legitimately be recognised by.
 *
 * THE PREFIX PROBLEM, which is the edge case the plan names. A supplier's own
 * paper says "INV-9268"; the same bill keyed into Xero by hand is often just
 * "9268". Normalising alone puts those in different buckets forever, so a second
 * key is emitted: the TRAILING RUN OF DIGITS, when there are at least three of
 * them. Three is the floor because a two-digit tail ("INV-12" → "12") collides
 * with every other short number a business has ever issued, and a false "this
 * bill is already in Xero" is the expensive direction of this comparison.
 *
 * The full key always comes first, so a caller wanting the strictest reading can
 * take `[0]`.
 */
export function invoiceNumberKeys(raw: string | null | undefined): string[] {
  const full = normaliseInvoiceNumber(raw);
  if (!full) return [];
  const keys = [full];
  const digits = /(\d{3,})$/.exec(full);
  if (digits && digits[1] !== full) keys.push(digits[1]);
  return keys;
}

/** True when two invoice numbers share any recognised key. Symmetric. */
export function invoiceNumbersMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = invoiceNumberKeys(a);
  if (left.length === 0) return false;
  const right = new Set(invoiceNumberKeys(b));
  if (right.size === 0) return false;
  return left.some((k) => right.has(k));
}

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

/**
 * Where this invoice lives in Xero.
 *
 * The two long-standing `go.xero.com` view routes, one per ledger. They are
 * stored on the mirror row at sync time rather than built at render time so a
 * finding's link is a fact recorded when the row was read, not a URL scheme this
 * build happened to believe in — if Xero moves the page, old cards keep the link
 * that worked and only new rows change.
 *
 * Returns null for a type this module does not mirror, so a bad row can never
 * produce a link into the wrong ledger.
 */
export function xeroInvoiceUrl(type: string | null | undefined, invoiceId: string): string | null {
  if (!invoiceId) return null;
  const id = encodeURIComponent(invoiceId);
  if (type === 'ACCREC') return `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${id}`;
  if (type === 'ACCPAY') return `https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=${id}`;
  return null;
}

// ---------------------------------------------------------------------------
// Mirror rows
// ---------------------------------------------------------------------------

/** The two ledgers Vyso mirrors. ACCREC = money owed TO this business, ACCPAY =
 *  money this business owes. Anything else Xero can hold (credit notes, prepayments)
 *  is out of scope for X1 and is dropped rather than filed under a guess. */
export const XERO_INVOICE_TYPES = ['ACCREC', 'ACCPAY'] as const;
export type XeroInvoiceType = (typeof XERO_INVOICE_TYPES)[number];

/**
 * Statuses this mirror keeps. DELETED and VOIDED are dropped — a voided bill is
 * not a bill, and keeping one would let it turn up as a duplicate of the invoice
 * that replaced it.
 */
export const MIRRORED_INVOICE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'AUTHORISED',
  'PAID',
] as const;

/** One row of `xero_invoices`, as the sync writes it. */
export interface XeroInvoiceRow {
  org_id: string;
  xero_invoice_id: string;
  type: XeroInvoiceType;
  contact_id: string | null;
  contact_name: string | null;
  invoice_number: string | null;
  reference: string | null;
  date: string | null;
  due_date: string | null;
  currency: string | null;
  total: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  status: string | null;
  updated_date_utc: string | null;
  xero_url: string | null;
}

/** One row of `xero_contacts`. */
export interface XeroContactRow {
  org_id: string;
  xero_contact_id: string;
  name: string | null;
  email: string | null;
  is_supplier: boolean;
  is_customer: boolean;
  updated_date_utc: string | null;
}

/** The shape Xero's `Invoices` array carries, narrowed to what is read. */
export interface XeroInvoicePayload {
  InvoiceID?: string | null;
  Type?: string | null;
  InvoiceNumber?: string | null;
  Reference?: string | null;
  Contact?: { ContactID?: string | null; Name?: string | null } | null;
  Date?: unknown;
  DueDate?: unknown;
  Status?: string | null;
  Total?: unknown;
  AmountDue?: unknown;
  AmountPaid?: unknown;
  CurrencyCode?: string | null;
  UpdatedDateUTC?: unknown;
}

export interface XeroContactPayload {
  ContactID?: string | null;
  Name?: string | null;
  EmailAddress?: string | null;
  IsSupplier?: unknown;
  IsCustomer?: unknown;
  UpdatedDateUTC?: unknown;
}

/**
 * One Xero invoice → one mirror row, or null when it is not something to mirror.
 *
 * NULL, LOUDLY, FOR FOUR CASES: no id (nothing to key on), a type outside the two
 * ledgers, a status outside the four kept, and — implicitly — anything that is
 * not an object. Each of those would otherwise become a row that a detector later
 * reads as real money.
 */
export function mapXeroInvoice(
  raw: XeroInvoicePayload | null | undefined,
  orgId: string,
): XeroInvoiceRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const xeroInvoiceId = (raw.InvoiceID ?? '').trim();
  if (!xeroInvoiceId) return null;

  const type = (raw.Type ?? '').trim().toUpperCase();
  if (!(XERO_INVOICE_TYPES as readonly string[]).includes(type)) return null;

  const status = (raw.Status ?? '').trim().toUpperCase();
  if (!(MIRRORED_INVOICE_STATUSES as readonly string[]).includes(status)) return null;

  const contactName = (raw.Contact?.Name ?? '').trim();
  const invoiceNumber = (raw.InvoiceNumber ?? '').trim();
  const reference = (raw.Reference ?? '').trim();

  return {
    org_id: orgId,
    xero_invoice_id: xeroInvoiceId,
    type: type as XeroInvoiceType,
    contact_id: (raw.Contact?.ContactID ?? '').trim() || null,
    contact_name: contactName || null,
    invoice_number: invoiceNumber || null,
    reference: reference || null,
    date: parseXeroDay(raw.Date),
    due_date: parseXeroDay(raw.DueDate),
    currency: (raw.CurrencyCode ?? '').trim().toUpperCase() || null,
    total: parseXeroAmount(raw.Total),
    amount_due: parseXeroAmount(raw.AmountDue),
    amount_paid: parseXeroAmount(raw.AmountPaid),
    status,
    updated_date_utc: parseXeroTimestamp(raw.UpdatedDateUTC),
    xero_url: xeroInvoiceUrl(type, xeroInvoiceId),
  };
}

/** One Xero contact → one mirror row, or null without an id. `IsSupplier` /
 *  `IsCustomer` are coerced rather than trusted: Xero omits them on some
 *  responses, and `undefined` is not "no". */
export function mapXeroContact(
  raw: XeroContactPayload | null | undefined,
  orgId: string,
): XeroContactRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const xeroContactId = (raw.ContactID ?? '').trim();
  if (!xeroContactId) return null;

  const name = (raw.Name ?? '').trim();
  const email = (raw.EmailAddress ?? '').trim();
  return {
    org_id: orgId,
    xero_contact_id: xeroContactId,
    name: name || null,
    email: email || null,
    is_supplier: raw.IsSupplier === true,
    is_customer: raw.IsCustomer === true,
    updated_date_utc: parseXeroTimestamp(raw.UpdatedDateUTC),
  };
}

/** Every mirrorable invoice in one page of Xero's response, in order. Anything
 *  the mapper rejects is silently dropped — the caller counts the difference so
 *  the sync summary can report it. */
export function mapXeroInvoicePage(
  payload: { Invoices?: XeroInvoicePayload[] | null } | null | undefined,
  orgId: string,
): XeroInvoiceRow[] {
  const rows = payload?.Invoices;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapXeroInvoice(r, orgId)).filter((r): r is XeroInvoiceRow => r != null);
}

export function mapXeroContactPage(
  payload: { Contacts?: XeroContactPayload[] | null } | null | undefined,
  orgId: string,
): XeroContactRow[] {
  const rows = payload?.Contacts;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapXeroContact(r, orgId)).filter((r): r is XeroContactRow => r != null);
}

// ---------------------------------------------------------------------------
// Talking to the API politely
// ---------------------------------------------------------------------------

/**
 * `If-Modified-Since`, in the format Xero's Accounting API documents: a UTC
 * instant with NO timezone suffix and no milliseconds — `2026-08-19T03:20:00`.
 *
 * Not RFC-1123, which is what the HTTP spec says for this header and what most
 * clients would send by reflex; Xero reads its own format and answers a full
 * resync for anything it cannot parse. A full resync is not incorrect, just
 * expensive, which is exactly the kind of bug that hides for months.
 */
export function ifModifiedSinceHeader(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, '');
}

/** Xero's rate limit is 60 calls/minute per tenant. This is the pause between
 *  sequential pages — enough that a long sync cannot approach the ceiling on its
 *  own, small enough that a few thousand invoices still finish inside the cron's
 *  300s. */
export const PAGE_PAUSE_MS = 250;

/** How long to wait after a 429, in milliseconds.
 *
 *  `Retry-After` is Xero's own number and is honoured when it is sane. When it is
 *  missing, unparseable or absurd, an exponential back-off stands in — capped,
 *  because a cron that sleeps for the header's word (Xero can quote a daily-limit
 *  retry in the tens of thousands of seconds) would burn its whole budget
 *  waiting instead of recording a partial sync and trying again tomorrow. */
export const MAX_RETRY_WAIT_MS = 30_000;

export function retryAfterMs(header: string | null | undefined, attempt: number): number {
  const seconds = Number((header ?? '').trim());
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_WAIT_MS);
  }
  const backoff = 1_000 * 2 ** Math.max(0, attempt);
  return Math.min(backoff, MAX_RETRY_WAIT_MS);
}

// ---------------------------------------------------------------------------
// What the mirror adds up to
// ---------------------------------------------------------------------------

/** The subset of a mirror row the snapshot reads. Declared separately from
 *  `XeroInvoiceRow` so the page can hand over a narrow select. */
export interface XeroSnapshotInput {
  type: string | null;
  status: string | null;
  due_date: string | null;
  amount_due: number | null;
  currency: string | null;
  contact_id: string | null;
  contact_name: string | null;
}

export interface XeroContactBalance {
  contactId: string | null;
  contactName: string;
  amount: number;
  invoiceCount: number;
  /** Days past due of the OLDEST overdue invoice for this contact. */
  oldestDaysOverdue: number;
}

export interface XeroMirrorSnapshot {
  /** The currency every figure below is in. Null when the mirror is empty. */
  currency: string | null;
  /** Currencies present in the mirror but EXCLUDED from the totals, with how
   *  many rows each. Vyso does no FX, so mixing them into one number would be a
   *  figure that exists nowhere. */
  excludedCurrencies: { currency: string; invoiceCount: number }[];
  receivablesOutstanding: number;
  receivablesOverdue: number;
  receivablesOverdueCount: number;
  payablesOutstanding: number;
  payablesDueSoon: number;
  payablesDueSoonCount: number;
  payablesOverdue: number;
  payablesOverdueCount: number;
  /** Worst receivable debtors, most owed first. Capped by the caller's slice. */
  topDebtors: XeroContactBalance[];
  invoicesMirrored: number;
}

/** Only AUTHORISED invoices carry money anyone is owed. A DRAFT is a keystroke
 *  and a PAID one is history; SUBMITTED is awaiting approval inside Xero and is
 *  not yet a commitment either party can act on. */
const OWING_STATUS = 'AUTHORISED';

/** Below this, a balance is a rounding artefact of VAT arithmetic rather than
 *  money. Mirrors the epsilon Debtors Watch uses on the same question. */
const AMOUNT_EPSILON = 0.005;

/** Whole days between two 'YYYY-MM-DD' calendar days, later minus earlier. */
export function daysBetweenDays(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** The window "due this week" means. Seven days INCLUSIVE of today, which is how
 *  an owner reads "falls due by Friday" on a Monday. */
export const PAYABLES_WINDOW_DAYS = 7;

/**
 * The plugin page's Snapshot, and the numbers Finch quotes — computed here so a
 * page, a chat tool and (in the next commit) an agent cannot each arrive at a
 * different total for the same mirror.
 *
 * ONE CURRENCY, NAMED. The dominant currency by row count wins; every other
 * currency's rows are excluded from the totals and reported separately. Vyso
 * holds no exchange rates and inventing one to make a single number would be the
 * worst possible answer — a figure that is wrong by an amount nobody can see.
 * Rows with NO currency at all are counted with the dominant one: Xero omits
 * `CurrencyCode` on single-currency organisations, which is the common case.
 */
export function summariseXeroMirror(
  rows: readonly XeroSnapshotInput[],
  today: string,
): XeroMirrorSnapshot {
  const empty: XeroMirrorSnapshot = {
    currency: null,
    excludedCurrencies: [],
    receivablesOutstanding: 0,
    receivablesOverdue: 0,
    receivablesOverdueCount: 0,
    payablesOutstanding: 0,
    payablesDueSoon: 0,
    payablesDueSoonCount: 0,
    payablesOverdue: 0,
    payablesOverdueCount: 0,
    topDebtors: [],
    invoicesMirrored: 0,
  };
  if (rows.length === 0) return empty;

  // 1. Which currency the figures are in.
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    const code = (r.currency ?? '').trim().toUpperCase();
    if (!code) continue;
    byCurrency.set(code, (byCurrency.get(code) ?? 0) + 1);
  }
  const ranked = [...byCurrency.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dominant = ranked[0]?.[0] ?? null;
  const excludedCurrencies = ranked
    .slice(1)
    .map(([currency, invoiceCount]) => ({ currency, invoiceCount }));

  const inScope = rows.filter((r) => {
    const code = (r.currency ?? '').trim().toUpperCase();
    return !code || code === dominant;
  });

  const snapshot: XeroMirrorSnapshot = {
    ...empty,
    currency: dominant,
    excludedCurrencies,
    invoicesMirrored: inScope.length,
  };

  // 2. The money, one pass.
  const debtors = new Map<string, XeroContactBalance>();
  for (const r of inScope) {
    if ((r.status ?? '').toUpperCase() !== OWING_STATUS) continue;
    const due = r.amount_due;
    if (due == null || !(due > AMOUNT_EPSILON)) continue;
    const daysOverdue = r.due_date ? daysBetweenDays(r.due_date, today) : null;
    const overdue = daysOverdue != null && daysOverdue > 0;

    if (r.type === 'ACCREC') {
      snapshot.receivablesOutstanding += due;
      if (overdue) {
        snapshot.receivablesOverdue += due;
        snapshot.receivablesOverdueCount += 1;
        // Grouped by contact ID where there is one; by NAME otherwise, so a
        // contactless invoice does not silently join every other contactless
        // invoice under one blank heading.
        const key = r.contact_id ?? `name:${r.contact_name ?? ''}`;
        const current = debtors.get(key);
        if (current) {
          current.amount += due;
          current.invoiceCount += 1;
          current.oldestDaysOverdue = Math.max(current.oldestDaysOverdue, daysOverdue);
        } else {
          debtors.set(key, {
            contactId: r.contact_id,
            contactName: r.contact_name ?? 'Unnamed contact',
            amount: due,
            invoiceCount: 1,
            oldestDaysOverdue: daysOverdue,
          });
        }
      }
      continue;
    }

    if (r.type === 'ACCPAY') {
      snapshot.payablesOutstanding += due;
      if (overdue) {
        snapshot.payablesOverdue += due;
        snapshot.payablesOverdueCount += 1;
      } else if (daysOverdue != null && daysOverdue >= -PAYABLES_WINDOW_DAYS) {
        // `daysBetweenDays(due, today)` is NEGATIVE for a future date, so "due
        // within the next seven days" is a floor, not a ceiling. Today itself
        // (0) counts as overdue above and never reaches here.
        snapshot.payablesDueSoon += due;
        snapshot.payablesDueSoonCount += 1;
      }
    }
  }

  snapshot.topDebtors = [...debtors.values()].sort(
    (a, b) => b.amount - a.amount || b.oldestDaysOverdue - a.oldestDaysOverdue,
  );

  return snapshot;
}

/**
 * A mirror figure, in its own currency.
 *
 * ZAR goes through `rand()` so a Xero total and an OrderFlow total are formatted
 * identically on the same screen. Anything else is rendered as
 * "USD 12 400" — the code, then the grouped number — rather than through a
 * symbol table this product does not have and would get wrong for exactly the
 * currencies a South African business actually trades in.
 */
export function xeroMoney(value: number | null | undefined, currency: string | null): string {
  if (value == null) return '—';
  if (!currency || currency === 'ZAR') return rand(value);
  return `${currency} ${Math.round(value).toLocaleString('en-ZA')}`;
}
