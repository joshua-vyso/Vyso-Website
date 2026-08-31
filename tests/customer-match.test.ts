import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchExistingCustomer,
  resolveExistingCustomerForOrg,
  type ExistingCustomerDirectory,
} from '../lib/platform/docu/customer-match.ts';

const ORG = 'org-turn-n-slice';
const OTHER_ORG = 'org-someone-else';

function directory(): ExistingCustomerDirectory {
  return {
    customers: [
      {
        id: 'standard-bank',
        name: 'Standard Bank Global Leadership Centre',
        tradingName: 'Standard Bank GLC',
        email: 'orders@standardbank.co.za',
        accountCode: 'SB-001',
        vatNumber: null,
        registrationNumber: null,
      },
      {
        id: 'bakubung',
        name: 'Bakubung Bush Lodge',
        tradingName: null,
        email: 'orders@bakubung.co.za',
        accountCode: 'BAK-04',
        vatNumber: null,
        registrationNumber: null,
      },
    ],
    contacts: [
      { customerId: 'standard-bank', name: 'Letlhogonolo Lehutso', email: 'Letlhogonolo.Lehutso@standardbank.co.za' },
    ],
    addresses: [],
  };
}

test('deterministic customer resolution prefers exact known email', () => {
  const match = matchExistingCustomer(directory(), {
    senderEmail: 'letlhogonolo.lehutso@standardbank.co.za',
    extractedCustomerName: 'An unrelated OCR name',
  });
  assert.equal(match.customerId, 'standard-bank');
  assert.equal(match.method, 'exact_email');
  assert.equal(match.confidence, 100);
});

test('a uniquely mapped business domain resolves an existing customer', () => {
  const match = matchExistingCustomer(directory(), {
    senderEmail: 'another.buyer@standardbank.co.za',
  });
  assert.equal(match.customerId, 'standard-bank');
  assert.equal(match.method, 'unique_email_domain');
  assert.equal(match.confidence, 98);
});

test('domain matching fails closed when multiple customers share it', () => {
  const rows = directory();
  rows.customers.push({
    id: 'standard-bank-branch',
    name: 'Standard Bank Branch',
    tradingName: null,
    email: 'branch@standardbank.co.za',
    accountCode: null,
    vatNumber: null,
    registrationNumber: null,
  });
  const match = matchExistingCustomer(rows, { senderEmail: 'new.person@standardbank.co.za' });
  assert.equal(match.customerId, null);
  assert.equal(match.method, 'unresolved');
  assert.equal(match.ambiguous, true);
  assert.equal(match.candidates.length, 2);
});

test('exact normalized company name works without making optional fields required', () => {
  const match = matchExistingCustomer(directory(), {
    extractedCustomerName: 'Bakubung Bush Lodge (Pty) Ltd',
  });
  assert.equal(match.customerId, 'bakubung');
  assert.equal(match.method, 'exact_name');
});

test('ambiguous fuzzy candidates remain unresolved for human review', () => {
  const rows = directory();
  rows.customers = [
    { ...rows.customers[0], id: 'one', name: 'Acme Hotel Sandton', tradingName: null, email: null },
    { ...rows.customers[1], id: 'two', name: 'Acme Hotel Pretoria', tradingName: null, email: null },
  ];
  rows.contacts = [];
  const match = matchExistingCustomer(rows, { extractedCustomerName: 'Acme Hotel' });
  assert.equal(match.customerId, null);
  assert.equal(match.method, 'unresolved');
  assert.equal(match.ambiguous, true);
  assert.deepEqual(match.candidates.map((candidate) => candidate.customer_id).sort(), ['one', 'two']);
});

test('server resolver scopes every read and cannot match a row from another organisation', async () => {
  const calls: Array<{ table: string; column: string; value: string }> = [];
  let writeCalls = 0;
  const responses: Record<string, { data: unknown[]; error: null }> = {
    of_customers: {
      data: [
        {
          id: 'right-org-customer', org_id: ORG, name: 'Right Org Customer', trading_name: null,
          email: 'buyer@right.example', account_code: null, vat_number: null, registration_number: null,
        },
        {
          id: 'wrong-org-customer', org_id: OTHER_ORG, name: 'Wrong Org Customer', trading_name: null,
          email: 'target@wrong.example', account_code: null, vat_number: null, registration_number: null,
        },
      ],
      error: null,
    },
    cd_contacts: {
      data: [{ org_id: OTHER_ORG, customer_id: 'wrong-org-customer', name: 'Target', email: 'target@wrong.example' }],
      error: null,
    },
    cd_delivery_addresses: { data: [], error: null },
  };
  const fakeSupabase = {
    from(table: string) {
      const query = {
        select() { return query; },
        eq(column: string, value: string) {
          calls.push({ table, column, value });
          return query;
        },
        insert() { writeCalls += 1; throw new Error('write attempted'); },
        update() { writeCalls += 1; throw new Error('write attempted'); },
        upsert() { writeCalls += 1; throw new Error('write attempted'); },
        delete() { writeCalls += 1; throw new Error('write attempted'); },
        then(resolve: (value: { data: unknown[]; error: null }) => void) { resolve(responses[table]); },
      };
      return query;
    },
  };

  const match = await resolveExistingCustomerForOrg(fakeSupabase as never, ORG, {
    senderEmail: 'target@wrong.example',
    extractedCustomerName: 'Wrong Org Customer',
  });
  assert.equal(match.customerId, null, 'another organisation is filtered even if the backend returns it');
  assert.equal(writeCalls, 0, 'customer resolution performs no customer writes');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.column === 'org_id' && call.value === ORG));
});

// ---------------------------------------------------------------------------
// ENTITY RESOLUTION (matrix 1–4): a business is not a person, and a subject
// line is evidence.
//
// Three live rows motivated all of this, and none of them is reproduced here —
// the fixtures below are synthetic organisations with the same SHAPES:
//
//   1. Scooters body doc f3f894e6: customer_name "Ashan Ajoodha" (a person),
//      match 'no-customer-signal' — while "Scooters Pizza Rosebank" existed
//      verbatim in of_customers AND verbatim in the ingest subject. The subject
//      reached only the identifier arm; nothing ever compared it to a name.
//   2. Doppio body doc 5cb3f957: 'ambiguous-email-domain' among seven branches,
//      subject token "BALLYOAKS" matching no Core Data name at all (the real
//      branch is filed as "Doppio Zero Bel Air", at Ballyoaks Office Park).
//   3. PO 144583: "Keshisha Ramsewak" in the customer slot, with nowhere to say
//      which property she buys for.
// ---------------------------------------------------------------------------

/** Seven branches on one domain, plus a franchise with a distinctive name — the
 *  Doppio and Scooters shapes, anonymised. */
function branchDirectory(): ExistingCustomerDirectory {
  const branch = (id: string, name: string) => ({
    id,
    name,
    tradingName: null,
    email: `orders@caffenove.co.za`,
    accountCode: null,
    vatNumber: null,
    registrationNumber: null,
  });
  return {
    customers: [
      branch('nove-bel-air', 'Caffe Nove Bel Air'),
      branch('nove-sandton', 'Caffe Nove Sandton'),
      branch('nove-parkview', 'Caffe Nove Parkview'),
      branch('nove-fourways', 'Caffe Nove Fourways'),
    ],
    contacts: [{ customerId: 'nove-bel-air', name: 'Chef Thabo', email: null }],
    addresses: [],
  };
}

test('1. ENTITY: a business name in the SUBJECT resolves the customer a person name could not', () => {
  const rows: ExistingCustomerDirectory = {
    customers: [
      {
        id: 'wheelers-rosebank',
        name: 'Wheelers Pizza Rosebank',
        tradingName: null,
        email: null,
        accountCode: null,
        vatNumber: null,
        registrationNumber: null,
      },
    ],
    contacts: [],
    addresses: [],
  };
  // Exactly the f3f894e6 shape: the extracted name is the human who sent it,
  // there is no usable email signal, and the business is written on the subject.
  const match = matchExistingCustomer(rows, {
    senderEmail: 'a.naidoo@gmail.com',
    senderName: 'Aran Naidoo',
    subject: 'Wheelers Pizza Rosebank order for Friday',
    extractedCustomerName: 'Aran Naidoo',
    contactPersonName: 'Aran Naidoo',
  });
  assert.equal(match.customerId, 'wheelers-rosebank');
  assert.equal(match.method, 'exact_name_in_text');
  assert.equal(match.confidence, 97);
  assert.equal(match.matchedVia, 'business_name');
  // The subject is now RECORDED, which is what makes a verdict arguable at all.
  assert.equal(match.evidence.subject, 'Wheelers Pizza Rosebank order for Friday');
  assert.equal(match.evidence.contact_person_name, 'Aran Naidoo');
});

test('1b. the document TITLE counts as much as the subject, and a short name is refused', () => {
  const rows: ExistingCustomerDirectory = {
    customers: [
      { id: 'lodge', name: 'Marula Bush Lodge', tradingName: null, email: null, accountCode: null, vatNumber: null, registrationNumber: null },
      { id: 'tiny', name: 'Zen', tradingName: null, email: null, accountCode: null, vatNumber: null, registrationNumber: null },
    ],
    contacts: [],
    addresses: [],
  };
  assert.equal(
    matchExistingCustomer(rows, { documentTitle: 'PO 8841 Marula Bush Lodge.pdf' }).customerId,
    'lodge',
  );
  // "Zen" must not match "Rozendal": the phrase test is padded on both sides,
  // and a one-token name under six characters is refused outright.
  const short = matchExistingCustomer(rows, { subject: 'Rozendal weekly order' });
  assert.equal(short.customerId, null);
});

test('2. ENTITY: a distinctive branch token splits a shared domain — but only when it matches one', () => {
  // The token IS in a Core Data name: "Sandton" picks one of the four.
  const resolved = matchExistingCustomer(branchDirectory(), {
    senderEmail: 'thabo@caffenove.co.za',
    subject: 'SANDTON order Thursday',
  });
  assert.equal(resolved.customerId, 'nove-sandton');
  assert.equal(resolved.method, 'domain_branch_token');
  assert.equal(resolved.confidence, 97);

  // THE DOPPIO/BALLYOAKS CASE. "ballyoaks" appears in NO Core Data name — the
  // branch is filed under a different name at that address — so no token
  // qualifies, the ambiguity stands, and all four candidates are listed. A
  // genuine alias gap, surfaced rather than guessed at.
  const unresolved = matchExistingCustomer(branchDirectory(), {
    senderEmail: 'thabo@caffenove.co.za',
    senderName: 'Chef Thabo',
    subject: 'BALLYOAKS ORDER',
    extractedCustomerName: 'Chef Thabo',
  });
  assert.equal(unresolved.customerId, null);
  assert.equal(unresolved.method, 'unresolved');
  assert.equal(unresolved.reason, 'ambiguous-email-domain');
  assert.equal(unresolved.ambiguous, true);
  assert.equal(unresolved.candidates.length, 4);
  assert.equal(unresolved.evidence.subject, 'BALLYOAKS ORDER');
  // A shared token ("caffe", "nove") distinguishes nothing and must not resolve.
  assert.equal(
    matchExistingCustomer(branchDirectory(), {
      senderEmail: 'thabo@caffenove.co.za',
      subject: 'Caffe Nove order',
    }).customerId,
    null,
  );
});

test('3. ENTITY: a person NEVER outranks an explicit business name', () => {
  const rows: ExistingCustomerDirectory = {
    customers: [
      { id: 'the-business', name: 'Hillcrest Country Club', tradingName: null, email: null, accountCode: null, vatNumber: null, registrationNumber: null },
      { id: 'other-customer', name: 'Vaal Bistro', tradingName: null, email: null, accountCode: null, vatNumber: null, registrationNumber: null },
    ],
    // The same person is on file as a contact of a DIFFERENT customer.
    contacts: [{ customerId: 'other-customer', name: 'Hillcrest Country Club', email: null }],
    addresses: [],
  };
  // One evidence string matches a business name on one customer and a contact
  // name on another. The single-pass pool used to call that ambiguous; the
  // business name is the customer's own identity and now wins.
  const match = matchExistingCustomer(rows, { extractedCustomerName: 'Hillcrest Country Club' });
  assert.equal(match.customerId, 'the-business');
  assert.equal(match.matchedVia, 'business_name');
  assert.equal(match.reason, 'normalized-business-name-exact');
});

test('3b. a contact name still resolves its customer — and says that is what happened', () => {
  // The existing arm is not removed, only asked second. "Keshisha Ramsewak" on
  // Montecasino's contact list is a real fact and still resolves Montecasino.
  const match = matchExistingCustomer(directory(), {
    contactPersonName: 'Letlhogonolo Lehutso',
  });
  assert.equal(match.customerId, 'standard-bank');
  assert.equal(match.method, 'exact_name');
  assert.equal(match.matchedVia, 'contact_person');
  assert.equal(match.reason, 'normalized-contact-name-exact');
});

test('4. ENTITY: none of the existing arms regressed', () => {
  // Email still beats everything, including a subject naming a different customer.
  const email = matchExistingCustomer(directory(), {
    senderEmail: 'letlhogonolo.lehutso@standardbank.co.za',
    subject: 'Bakubung Bush Lodge order',
  });
  assert.equal(email.customerId, 'standard-bank');
  assert.equal(email.method, 'exact_email');
  // A uniquely mapped domain still beats a name in the subject.
  const domain = matchExistingCustomer(directory(), {
    senderEmail: 'someone.new@standardbank.co.za',
    subject: 'Bakubung Bush Lodge order',
  });
  assert.equal(domain.method, 'unique_email_domain');
  // Exact name, identifier and fuzzy arms all still answer as they did.
  assert.equal(
    matchExistingCustomer(directory(), { extractedCustomerName: 'Bakubung Bush Lodge (Pty) Ltd' }).method,
    'exact_name',
  );
  assert.equal(matchExistingCustomer(directory(), { subject: 'Re: account BAK-04' }).method, 'exact_identifier');
  const fuzzy = matchExistingCustomer(directory(), { extractedCustomerName: 'Bakubung Bush Lodges' });
  assert.equal(fuzzy.method, 'fuzzy_name');
  assert.equal(fuzzy.customerId, 'bakubung');
  assert.equal(fuzzy.matchedVia, 'business_name');
  // And an unresolvable document is still unresolved, with its evidence.
  const nothing = matchExistingCustomer(directory(), { extractedCustomerName: 'Somebody Entirely Else' });
  assert.equal(nothing.customerId, null);
  assert.equal(nothing.matchedVia, null);
});
