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
  /**
   * THE DOCUMENT'S OWN TITLE — a filename, an attachment name, a PO heading.
   *
   * Added alongside `subject` because the two carry the same kind of evidence
   * and neither of them used to reach the name arms at all: `subject` was
   * loaded, then used ONLY by the identifier arm (arm 4), and `documentTitle`
   * did not exist. "Scooters Pizza Rosebank" sat in the subject of the message
   * that filed document f3f894e6 while the matcher recorded
   * 'no-customer-signal' against a customer of that exact name.
   */
  documentTitle?: string | null;
  /**
   * The HUMAN the order came from, once the reader is allowed to say so
   * separately from the business — `ExtractedData.contact_person`.
   *
   * It is PERSON-KIND evidence and is treated as such throughout: it can
   * resolve a customer through that customer's own contact list, and it can
   * never outrank a business name. Absent on every historical row.
   */
  contactPersonName?: string | null;
}

export type CustomerMatchMethod =
  | 'exact_email'
  | 'unique_email_domain'
  /** A shared business domain, split by a distinctive branch token in the
   *  subject/title. The Doppio shape — see `branchTokenWinner`. */
  | 'domain_branch_token'
  /** An existing customer's own name, found as a whole phrase inside the
   *  subject or the document title. The Scooters arm — see arm 2c. */
  | 'exact_name_in_text'
  | 'exact_name'
  | 'exact_identifier'
  | 'fuzzy_name'
  | 'unresolved';

/**
 * WHICH KIND OF NAME EARNED THE MATCH.
 *
 * `business_name` means a customer/trading name matched. `contact_person` means
 * only a person did, and the customer was reached through that person's
 * contact record — the same resolution the ladder has always performed, now
 * recorded rather than silently indistinguishable from the other. The
 * distinction is what lets the precedence rule be checked: a person-kind match
 * must never be returned while a business-kind one was available.
 */
export type CustomerMatchVia = 'business_name' | 'contact_person';

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
  /** Null when nothing resolved. See `CustomerMatchVia`. */
  matchedVia: CustomerMatchVia | null;
  evidence: {
    sender_email: string | null;
    sender_domain: string | null;
    sender_name: string | null;
    extracted_customer_name: string | null;
    purchase_order_number: string | null;
    delivery_location: string | null;
    /** BOUNDED, and written on every result including the unresolved ones —
     *  which is the only reason to write them at all. 'ambiguous-email-domain'
     *  was an unarguable verdict because the subject token that would have
     *  explained it ("BALLYOAKS") was thrown away before anyone could see it. */
    subject: string | null;
    document_title: string | null;
    contact_person_name: string | null;
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

/**
 * EVERY NAME A CUSTOMER ANSWERS TO — unchanged, and still the pool arms 3 and 5
 * fall back to. `businessNames` and `contactNames` below split the same list in
 * two so the arms can ask the business half FIRST; this one is kept because
 * "match anything" remains the correct last question, after the ordered ones
 * have declined.
 */
function customerNames(customer: ExistingCustomerIdentity, contacts: ExistingCustomerContact[]): string[] {
  return [customer.name, customer.tradingName, ...contacts.filter((c) => c.customerId === customer.id).map((c) => c.name)]
    .map(normalizeCustomerName)
    .filter(Boolean);
}

/**
 * THE BUSINESS HALF: the customer's registered and trading names, and nothing
 * else. These are the names a document means when it says who placed an order.
 */
function businessNames(customer: ExistingCustomerIdentity): string[] {
  return [customer.name, customer.tradingName].map(normalizeCustomerName).filter(Boolean);
}

/**
 * THE PERSON HALF: the humans on this customer's Core Data contact list.
 *
 * A match here is still a real match — "Keshisha Ramsewak is Montecasino's
 * buyer" is exactly the kind of fact the contact list exists to hold — but it
 * is a WEAKER statement than a business name, because a person can move
 * employers and two people can share a name while a registered company name is
 * the customer's own identity. So it is asked second, everywhere.
 */
function contactNames(customer: ExistingCustomerIdentity, contacts: ExistingCustomerContact[]): string[] {
  return contacts
    .filter((c) => c.customerId === customer.id)
    .map((c) => normalizeCustomerName(c.name))
    .filter(Boolean);
}

function result(
  directory: ExistingCustomerDirectory,
  evidence: CustomerIdentityEvidence,
  selected: {
    id: string;
    confidence: number;
    method: CustomerMatchMethod;
    reason: string;
    via?: CustomerMatchVia;
  } | null,
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
    // Defaults to `business_name` on a resolution that did not say otherwise —
    // every arm that can land on a person (3b, 5b) states `via` explicitly, and
    // an email or identifier match is about the ACCOUNT, not about a name.
    matchedVia: customer ? selected?.via ?? 'business_name' : null,
    evidence: {
      sender_email: emailKey(evidence.senderEmail) || null,
      sender_domain: emailDomain(evidence.senderEmail),
      sender_name: clean(evidence.senderName) || null,
      extracted_customer_name: clean(evidence.extractedCustomerName) || null,
      purchase_order_number: clean(evidence.purchaseOrderNumber) || null,
      delivery_location: clean(evidence.deliveryLocation) || null,
      subject: clean(evidence.subject).slice(0, 500) || null,
      document_title: clean(evidence.documentTitle).slice(0, 300) || null,
      contact_person_name: clean(evidence.contactPersonName) || null,
    },
  };
}

/**
 * The text a NAME may be found in: the subject and the document's own title.
 *
 * NOT THE MESSAGE BODY, and the omission is deliberate. A body carries quoted
 * threads, signatures and cc'd footers, any of which can contain a customer's
 * name that has nothing to do with who sent this message — and an arm that
 * resolves at confidence 97 must not be reading a signature block three replies
 * down. Subject and title are both written ABOUT this document by whoever sent
 * it. (The plan permits a bounded body prefix; it is not taken, and this is the
 * reason.)
 */
function nameSearchText(evidence: CustomerIdentityEvidence): string {
  return ` ${normalizeCustomerName(`${clean(evidence.subject).slice(0, 500)} ${clean(evidence.documentTitle).slice(0, 300)}`)} `;
}

/**
 * Does `name` appear as a WHOLE PHRASE inside the normalised search text?
 *
 * Both sides go through `normalizeCustomerName` first, so "Scooters Pizza
 * Rosebank" in a subject and "Scooters Pizza Rosebank (Pty) Ltd" in Core Data
 * meet in the middle. The space padding on both sides is what makes it a phrase
 * match rather than a substring one: without it, a customer named "Zen" would
 * match every subject containing "Rozendal".
 *
 * SHORT NAMES ARE REFUSED. A normalised name of fewer than two tokens AND fewer
 * than six characters is not distinctive enough to resolve anything at 97 —
 * "abc" appearing in a filename is a coincidence, not evidence.
 */
function nameAppearsAsPhrase(name: string, haystack: string): boolean {
  if (!name) return false;
  if (name.split(' ').length < 2 && name.length < 6) return false;
  return haystack.includes(` ${name} `);
}

/**
 * SEVEN DOPPIO ZEROS SHARE ONE EMAIL DOMAIN. WHICH ONE SENT THIS?
 *
 * Document 5cb3f957 came from a doppio address, matched seven branches on the
 * domain, and stopped at 'ambiguous-email-domain' — which is the correct answer
 * to the question the ladder asked, and the wrong place to stop, because the
 * subject said "BALLYOAKS" and the branch names are exactly what distinguishes
 * these seven customers from each other.
 *
 * THE RULE: a token from the subject or title that appears in EXACTLY ONE
 * candidate's names, and is therefore distinctive among them, resolves the
 * ambiguity. A token shared by all of them ("doppio", "zero") distinguishes
 * nothing and is skipped. Two tokens that select two DIFFERENT candidates
 * cancel out and the ambiguity stands.
 *
 * AND ON THE CASE THAT MOTIVATED IT, IT ANSWERS "NO". "ballyoaks" appears in no
 * Core Data name at all — the real branch is filed as "Doppio Zero Bel Air", at
 * Ballyoaks Office Park — so no token qualifies, the result stays unresolved
 * with all seven candidates listed, and the subject is now recorded in the
 * evidence so the alias gap is visible instead of merely suspected. That gap is
 * a thing for a human to fix in Core Data. Inventing the alias here would be
 * the same class of error as picking the newest branch: a guess that reads
 * exactly like a finding.
 *
 * Scoped to candidates that already share a verified email domain — it is not a
 * general fuzzy arm, and it never widens the pool it chooses from.
 */
function branchTokenWinner(
  candidateIds: readonly string[],
  namesById: (id: string) => string[],
  searchText: string,
): { id: string; token: string } | null {
  const tokens = [...new Set(searchText.split(' ').filter((t) => t.length >= 4))];
  const winners = new Map<string, string>();
  for (const token of tokens) {
    const matched = candidateIds.filter((id) =>
      namesById(id).some((name) => ` ${name} `.includes(` ${token} `)),
    );
    // Exactly one candidate, and not a token every candidate carries — the
    // second condition is implied by the first whenever there are two or more
    // candidates, and is stated anyway because that is the property being
    // relied on.
    if (matched.length === 1 && candidateIds.length > 1) winners.set(matched[0], token);
  }
  if (winners.size !== 1) return null;
  const [id, token] = [...winners.entries()][0];
  return { id, token };
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
  // Computed once, read by arm 2b and arm 2c. Both of them are asking the same
  // question of the same two strings — "does an existing customer's name appear
  // in what this message calls itself?" — and normalising it twice is how the
  // two would eventually disagree.
  const searchText = nameSearchText(evidence);

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
      // 2b. BRANCH TOKEN — the one thing that can honestly split a shared
      //     domain. See `branchTokenWinner`; on the Doppio/BALLYOAKS case it
      //     returns null and the ambiguity below stands, with the subject now
      //     recorded in the evidence.
      const branch = branchTokenWinner(
        domainIds,
        (id) => {
          const customer = byId.get(id);
          return customer ? businessNames(customer) : [];
        },
        searchText,
      );
      if (branch) {
        return result(directory, evidence, {
          id: branch.id,
          confidence: 97,
          method: 'domain_branch_token',
          reason: `domain-candidate-branch-token:${branch.token}`,
        }, false, candidates);
      }
      return result(directory, evidence, { id: '', confidence: 0, method: 'unresolved', reason: 'ambiguous-email-domain' }, true, candidates);
    }
  }

  // 2c. THE BUSINESS NAME, WRITTEN ON THE MESSAGE ITSELF.
  //
  //     "Scooters Pizza Rosebank" exists verbatim in of_customers AND verbatim
  //     in the subject of the email that filed document f3f894e6 — which was
  //     recorded as 'no-customer-signal', because the subject reached only the
  //     identifier arm and the extracted name was the human who sent it ("Ashan
  //     Ajoodha"). Both facts were in the row. Neither was ever compared.
  //
  //     ABOVE the extracted-name arms and BELOW the email ones, at 97: an
  //     address is a stronger identifier than a name printed anywhere, but a
  //     customer's own registered name found as a whole phrase in what this
  //     document calls itself is stronger than a name a model read off a page.
  //
  //     BUSINESS NAMES ONLY. Contact names are excluded from this arm entirely —
  //     a person's name in a subject line ("Re: Thabo") is not the customer
  //     saying who they are, and at confidence 97 that inference is far too
  //     cheap. Collisions do not pick: two customers whose names both appear is
  //     a question, and the answer is the candidate list.
  if (searchText.trim()) {
    const inTextIds = uniqueCustomerIds(directory.customers
      .filter((customer) => businessNames(customer).some((name) => nameAppearsAsPhrase(name, searchText)))
      .map((customer) => customer.id));
    if (inTextIds.length === 1) {
      return result(directory, evidence, {
        id: inTextIds[0],
        confidence: 97,
        method: 'exact_name_in_text',
        reason: 'existing-business-name-in-subject-or-title',
        via: 'business_name',
      }, false, []);
    }
    if (inTextIds.length > 1) {
      const candidates = inTextIds.map((id) => ({
        customer_id: id,
        customer_name: byId.get(id)?.name ?? 'Existing customer',
        score: 97,
        reason: 'multiple-business-names-in-subject-or-title',
      }));
      return result(directory, evidence, { id: '', confidence: 0, method: 'unresolved', reason: 'ambiguous-name-in-text' }, true, candidates);
    }
  }

  // 3. Exact normalized name — ASKED OF THE BUSINESS NAMES FIRST, THEN OF THE
  //    PEOPLE.
  //
  //    It used to be one pass over a pool that mixed customer names, trading
  //    names and contact names together, which made "Scooters Pizza Rosebank"
  //    and "Ashan Ajoodha" the same kind of answer — interchangeable evidence
  //    for the same question. They are not: one is the customer's identity, the
  //    other is a person who may work there today. Splitting the pass is the
  //    whole of the change; the two passes together resolve exactly the same
  //    set of documents the single pass did, and the only cases whose ANSWER
  //    moves are the ones where a business name and a person name pointed at
  //    different customers — which used to be reported as ambiguous and is now
  //    reported as the business.
  //
  //    `contactPersonName` joins the evidence here, as person-kind, which is
  //    what it is.
  const businessEvidenceNames = [evidence.extractedCustomerName, evidence.senderName]
    .map(normalizeCustomerName)
    .filter(Boolean);
  const personEvidenceNames = [evidence.contactPersonName, evidence.extractedCustomerName, evidence.senderName]
    .map(normalizeCustomerName)
    .filter(Boolean);

  // 3a. Business-kind.
  for (const name of businessEvidenceNames) {
    const exactNameIds = uniqueCustomerIds(directory.customers
      .filter((customer) => businessNames(customer).includes(name))
      .map((customer) => customer.id));
    if (exactNameIds.length === 1) {
      return result(directory, evidence, {
        id: exactNameIds[0],
        confidence: 96,
        method: 'exact_name',
        reason: 'normalized-business-name-exact',
        via: 'business_name',
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

  // 3b. Person-kind — the customer reached through its own contact list. Still
  //     a 96, because a named contact on a named customer is a strong fact;
  //     `matchedVia` is what records that it was a person who got us there.
  for (const name of personEvidenceNames) {
    const exactNameIds = uniqueCustomerIds(directory.customers
      .filter((customer) => contactNames(customer, contacts).includes(name))
      .map((customer) => customer.id));
    if (exactNameIds.length === 1) {
      return result(directory, evidence, {
        id: exactNameIds[0],
        confidence: 96,
        method: 'exact_name',
        reason: 'normalized-contact-name-exact',
        via: 'contact_person',
      }, false, []);
    }
    if (exactNameIds.length > 1) {
      const candidates = exactNameIds.map((id) => ({
        customer_id: id,
        customer_name: byId.get(id)?.name ?? 'Existing customer',
        score: 96,
        reason: 'shared-contact-name',
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
  //
  // TWO RANKINGS, BUSINESS FIRST, AND THE SECOND IS THE ONE THAT ALREADY
  // SHIPPED. 5a ranks against business names alone; if it produces a confident
  // winner with the required margin, that winner is the answer and a
  // person-name near-miss cannot displace it. 5b is the original ranking over
  // the whole pool, byte for byte, so every document that resolved here before
  // still resolves here — and the candidate list returned on failure is still
  // the full-pool one, because a reviewer looking at "why did this not match"
  // needs every near-miss, business or person.
  const fuzzyNames = [...businessEvidenceNames, ...personEvidenceNames];
  const rank = (names: (customer: ExistingCustomerIdentity) => string[]): CustomerMatchCandidate[] =>
    directory.customers
      .map((customer) => ({
        customer_id: customer.id,
        customer_name: customer.name,
        score: Math.max(0, ...fuzzyNames.flatMap((name) => names(customer).map((candidate) => diceNameScore(name, candidate)))),
        reason: 'fuzzy-name-ranking',
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.customer_name.localeCompare(b.customer_name));
  const confidentWinner = (list: CustomerMatchCandidate[]): CustomerMatchCandidate | null => {
    const [top, second] = list;
    return top && top.score >= 92 && (!second || top.score - second.score >= 10) ? top : null;
  };

  // 5a. Business-kind.
  const businessRanked = rank(businessNames);
  const businessBest = confidentWinner(businessRanked);
  if (businessBest) {
    return result(directory, evidence, {
      id: businessBest.customer_id,
      confidence: businessBest.score,
      method: 'fuzzy_name',
      reason: 'conservative-fuzzy-business-name',
      via: 'business_name',
    }, false, businessRanked);
  }

  // 5b. The original whole-pool ranking, unchanged.
  const ranked = rank((customer) => customerNames(customer, contacts));
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (best && best.score >= 92 && (!runnerUp || best.score - runnerUp.score >= 10)) {
    return result(directory, evidence, {
      id: best.customer_id,
      confidence: best.score,
      method: 'fuzzy_name',
      reason: 'conservative-fuzzy-name',
      // 5a produced no confident winner, so this one got over the line on the
      // WIDER pool — but that does not by itself mean a person's name carried
      // it (5a can decline on margin alone). Ask which half actually scored it,
      // rather than assuming: `matchedVia` is only worth recording if it is
      // true.
      via: (businessRanked.find((c) => c.customer_id === best.customer_id)?.score ?? 0) >= best.score
        ? 'business_name'
        : 'contact_person',
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
