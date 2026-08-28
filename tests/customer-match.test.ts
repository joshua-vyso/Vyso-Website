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
