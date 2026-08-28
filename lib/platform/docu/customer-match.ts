import type { SupabaseClient } from '@supabase/supabase-js';

/** Existing customer data that may be used as evidence. Never written by this module. */
export interface ExistingCustomerIdentity {
  id: string;
  name: string;
  tradingName: string | null;
  email: string | null;
  accountCode: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
}

export interface ExistingCustomerContact {
  customerId: string;
  name: string;
  email: string | null;
}

export interface ExistingCustomerAddress {
  customerId: string;
  nickname: string | null;
  street: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

export interface CustomerIdentityEvidence {
  senderEmail?: string | null;
  senderName?: string | null;
  subject?: string | null;
  /** Bounded message text used only for matching existing identifiers. */
  messageText?: string | null;
  extractedCustomerName?: string | null;
  purchaseOrderNumber?: string | null;
  deliveryLocation?: string | null;
}

export type CustomerMatchMethod =
  | 'exact_email'
  | 'unique_email_domain'
  | 'exact_name'
  | 'exact_identifier'
  | 'fuzzy_name'
  | 'unresolved';

export interface CustomerMatchCandidate {
  customer_id: string;
  customer_name: string;
  score: number;
  reason: string;
}

export interface CustomerMatchResult {
  customerId: string | null;
  customerName: string | null;
  confidence: number;
  method: CustomerMatchMethod;
  reason: string;
  ambiguous: boolean;
  candidates: CustomerMatchCandidate[];
  evidence: {
    sender_email: string | null;
    sender_domain: string | null;
    sender_name: string | null;
    extracted_customer_name: string | null;
    purchase_order_number: string | null;
    delivery_location: string | null;
  };
}

export interface ExistingCustomerDirectory {
  customers: ExistingCustomerIdentity[];
  contacts: ExistingCustomerContact[];
  addresses: ExistingCustomerAddress[];
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'yahoo.co.za',
  'proton.me',
  'protonmail.com',
]);

const clean = (value: string | null | undefined): string => (value ?? '').trim();
const emailKey = (value: string | null | undefined): string => clean(value).toLowerCase();

export function emailDomain(value: string | null | undefined): string | null {
  const email = emailKey(value);
  const at = email.lastIndexOf('@');
  return at > 0 && at < email.length - 1 ? email.slice(at + 1) : null;
}

export function normalizeCustomerName(value: string | null | undefined): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(?:pty|proprietary|limited|ltd|inc|incorporated|llc|cc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueCustomerIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)];
}

function words(value: string): Set<string> {
  return new Set(value.split(' ').filter((token) => token.length > 1));
}

function diceNameScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const left = words(a);
  const right = words(b);
  const shared = [...left].filter((token) => right.has(token)).length;
  const tokenScore = (2 * shared) / Math.max(1, left.size + right.size);
  const containment = a.includes(b) || b.includes(a)
    ? Math.min(a.length, b.length) / Math.max(a.length, b.length)
    : 0;
  return Math.round(Math.max(tokenScore, containment) * 100);
}

function customerNames(customer: ExistingCustomerIdentity, contacts: ExistingCustomerContact[]): string[] {
  return [customer.name, customer.tradingName, ...contacts.filter((c) => c.customerId === customer.id).map((c) => c.name)]
    .map(normalizeCustomerName)
    .filter(Boolean);
}

function result(
  directory: ExistingCustomerDirectory,
  evidence: CustomerIdentityEvidence,
  selected: { id: string; confidence: number; method: CustomerMatchMethod; reason: string } | null,
  ambiguous: boolean,
  candidates: CustomerMatchCandidate[],
): CustomerMatchResult {
  const customer = selected ? directory.customers.find((row) => row.id === selected.id) ?? null : null;
  return {
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? null,
    confidence: customer ? selected?.confidence ?? 0 : 0,
    method: customer ? selected?.method ?? 'unresolved' : 'unresolved',
    reason: customer ? selected?.reason ?? 'unresolved' : selected?.reason ?? 'no-confident-existing-customer',
    ambiguous,
    candidates: candidates.slice(0, 5),
    evidence: {
      sender_email: emailKey(evidence.senderEmail) || null,
      sender_domain: emailDomain(evidence.senderEmail),
      sender_name: clean(evidence.senderName) || null,
      extracted_customer_name: clean(evidence.extractedCustomerName) || null,
      purchase_order_number: clean(evidence.purchaseOrderNumber) || null,
      delivery_location: clean(evidence.deliveryLocation) || null,
    },
  };
}

/**
 * Resolve against a caller-supplied, already org-scoped directory. It can only
 * return one of those rows and deliberately has no mutation API.
 */
export function matchExistingCustomer(
  directory: ExistingCustomerDirectory,
  evidence: CustomerIdentityEvidence,
): CustomerMatchResult {
  const byId = new Map(directory.customers.map((customer) => [customer.id, customer]));
  const contacts = directory.contacts.filter((contact) => byId.has(contact.customerId));
  const senderEmail = emailKey(evidence.senderEmail);

  // 1. Exact known email. A collision is data ambiguity, not permission to pick.
  if (senderEmail) {
    const exactEmailIds = uniqueCustomerIds([
      ...directory.customers.filter((customer) => emailKey(customer.email) === senderEmail).map((customer) => customer.id),
      ...contacts.filter((contact) => emailKey(contact.email) === senderEmail).map((contact) => contact.customerId),
    ]);
    if (exactEmailIds.length === 1) {
      return result(directory, evidence, {
        id: exactEmailIds[0], confidence: 100, method: 'exact_email', reason: 'sender-email-exact',
      }, false, []);
    }
    if (exactEmailIds.length > 1) {
      const candidates = exactEmailIds.map((id) => ({
        customer_id: id,
        customer_name: byId.get(id)?.name ?? 'Existing customer',
        score: 100,
        reason: 'shared-exact-email',
      }));
      return result(directory, evidence, { id: '', confidence: 0, method: 'unresolved', reason: 'ambiguous-exact-email' }, true, candidates);
    }
  }

  // 2. A business domain may identify a customer only when it maps uniquely.
  const domain = emailDomain(senderEmail);
  if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
    const domainIds = uniqueCustomerIds([
      ...directory.customers.filter((customer) => emailDomain(customer.email) === domain).map((customer) => customer.id),
      ...contacts.filter((contact) => emailDomain(contact.email) === domain).map((contact) => contact.customerId),
    ]);
    if (domainIds.length === 1) {
      return result(directory, evidence, {
        id: domainIds[0], confidence: 98, method: 'unique_email_domain', reason: 'sender-domain-unique-in-org',
      }, false, []);
    }
    if (domainIds.length > 1) {
      const candidates = domainIds.map((id) => ({
        customer_id: id,
        customer_name: byId.get(id)?.name ?? 'Existing customer',
        score: 98,
        reason: 'shared-email-domain',
      }));
      return result(directory, evidence, { id: '', confidence: 0, method: 'unresolved', reason: 'ambiguous-email-domain' }, true, candidates);
    }
  }

  // 3. Exact normalized company/contact name.
  const evidenceNames = [evidence.extractedCustomerName, evidence.senderName]
    .map(normalizeCustomerName)
    .filter(Boolean);
  for (const name of evidenceNames) {
    const exactNameIds = uniqueCustomerIds(directory.customers
      .filter((customer) => customerNames(customer, contacts).includes(name))
      .map((customer) => customer.id));
    if (exactNameIds.length === 1) {
      return result(directory, evidence, {
        id: exactNameIds[0], confidence: 96, method: 'exact_name', reason: 'normalized-name-exact',
      }, false, []);
    }
    if (exactNameIds.length > 1) {
      const candidates = exactNameIds.map((id) => ({
        customer_id: id,
        customer_name: byId.get(id)?.name ?? 'Existing customer',
        score: 96,
        reason: 'shared-normalized-name',
      }));
      return result(directory, evidence, { id: '', confidence: 0, method: 'unresolved', reason: 'ambiguous-exact-name' }, true, candidates);
    }
  }

  // 4. Existing account/VAT/registration identifiers, matched as whole tokens.
  const identifierSignal = `${clean(evidence.subject)}\n${clean(evidence.messageText)}\n${clean(evidence.purchaseOrderNumber)}`.toLowerCase();
  const identifierIds = uniqueCustomerIds(directory.customers.filter((customer) =>
    [customer.accountCode, customer.vatNumber, customer.registrationNumber]
      .map((value) => clean(value).toLowerCase())
      .filter((value) => value.length >= 3)
      .some((value) => new RegExp(`(^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(identifierSignal)),
  ).map((customer) => customer.id));
  if (identifierIds.length === 1) {
    return result(directory, evidence, {
      id: identifierIds[0], confidence: 95, method: 'exact_identifier', reason: 'existing-account-identifier-exact',
    }, false, []);
  }
  if (identifierIds.length > 1) {
    const candidates = identifierIds.map((id) => ({
      customer_id: id,
      customer_name: byId.get(id)?.name ?? 'Existing customer',
      score: 95,
      reason: 'multiple-exact-identifiers',
    }));
    return result(directory, evidence, { id: '', confidence: 0, method: 'unresolved', reason: 'ambiguous-identifier' }, true, candidates);
  }

  // 5. Conservative fuzzy ranking over existing customers only. A high score
  // still needs a clear margin; otherwise the candidates remain review evidence.
  const fuzzyNames = evidenceNames;
  const ranked = directory.customers
    .map((customer) => ({
      customer_id: customer.id,
      customer_name: customer.name,
      score: Math.max(0, ...fuzzyNames.flatMap((name) => customerNames(customer, contacts).map((candidate) => diceNameScore(name, candidate)))),
      reason: 'fuzzy-name-ranking',
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.customer_name.localeCompare(b.customer_name));
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (best && best.score >= 92 && (!runnerUp || best.score - runnerUp.score >= 10)) {
    return result(directory, evidence, {
      id: best.customer_id, confidence: best.score, method: 'fuzzy_name', reason: 'conservative-fuzzy-name',
    }, false, ranked);
  }
  return result(
    directory,
    evidence,
    { id: '', confidence: 0, method: 'unresolved', reason: ranked.length ? 'fuzzy-match-below-threshold-or-ambiguous' : 'no-customer-signal' },
    ranked.length > 1 && !!best && !!runnerUp && best.score - runnerUp.score < 10,
    ranked,
  );
}

/**
 * Load one organisation's customer directory and resolve against it. Every read
 * carries the verified org id; rows returned by a service-role client for any
 * other org are filtered again before matching. There are intentionally no
 * insert/update/upsert/delete calls in this path.
 */
export async function resolveExistingCustomerForOrg(
  supabase: SupabaseClient,
  orgId: string,
  evidence: CustomerIdentityEvidence,
): Promise<CustomerMatchResult> {
  if (!orgId.trim()) throw new Error('A verified organisation id is required for customer matching.');
  const [customerResult, contactResult, addressResult] = await Promise.all([
    supabase
      .from('of_customers')
      .select('id, org_id, name, trading_name, email, account_code, vat_number, registration_number')
      .eq('org_id', orgId),
    supabase
      .from('cd_contacts')
      .select('org_id, customer_id, name, email')
      .eq('org_id', orgId),
    supabase
      .from('cd_delivery_addresses')
      .select('org_id, customer_id, nickname, street, suburb, city, province, postal_code')
      .eq('org_id', orgId),
  ]);
  if (customerResult.error) throw new Error(`Could not read existing customers: ${customerResult.error.message}`);

  const customerRows = (customerResult.data ?? []) as Array<Record<string, unknown>>;
  const customers: ExistingCustomerIdentity[] = customerRows
    .filter((row) => row.org_id === orgId)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      tradingName: typeof row.trading_name === 'string' ? row.trading_name : null,
      email: typeof row.email === 'string' ? row.email : null,
      accountCode: typeof row.account_code === 'string' ? row.account_code : null,
      vatNumber: typeof row.vat_number === 'string' ? row.vat_number : null,
      registrationNumber: typeof row.registration_number === 'string' ? row.registration_number : null,
    }));
  const customerIds = new Set(customers.map((customer) => customer.id));
  const contacts: ExistingCustomerContact[] = ((contactResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.org_id === orgId && customerIds.has(String(row.customer_id)))
    .map((row) => ({
      customerId: String(row.customer_id),
      name: String(row.name ?? ''),
      email: typeof row.email === 'string' ? row.email : null,
    }));
  const addresses: ExistingCustomerAddress[] = ((addressResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.org_id === orgId && customerIds.has(String(row.customer_id)))
    .map((row) => ({
      customerId: String(row.customer_id),
      nickname: typeof row.nickname === 'string' ? row.nickname : null,
      street: typeof row.street === 'string' ? row.street : null,
      suburb: typeof row.suburb === 'string' ? row.suburb : null,
      city: typeof row.city === 'string' ? row.city : null,
      province: typeof row.province === 'string' ? row.province : null,
      postalCode: typeof row.postal_code === 'string' ? row.postal_code : null,
    }));

  return matchExistingCustomer({ customers, contacts, addresses }, evidence);
}
