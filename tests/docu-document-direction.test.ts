import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTERPARTY_DICE,
  ORG_IDENTITY_DICE,
  OUTGOING_UNMATCHED_NOTE,
  buildDirectionRecord,
  isOutgoingDocument,
  matchCounterparty,
  matchesOrgIdentity,
  normaliseParty,
  normaliseVat,
  resolveDocumentDirection,
  type CounterpartyCandidate,
  type OrgIdentity,
} from '../lib/platform/docu/document-direction.ts';

// ---------------------------------------------------------------------------
// The Turn 'n Slice failure, verbatim.
//
// A photographed A4 on Turn 'n Slice letterhead, with the TnS logo top-left and
// "Invoice To: Investec Bank Limited" in the address block. Doc-U read the
// letterhead as the issuing party — correctly — and then the ingest pipeline
// turned that issuer into a SUPPLIER, because `resolveSupplierProfile` only
// refuses the org's own name on EXACT normalised equality and the letterhead
// says "Turn n Slice HQ (Pty) Ltd" where the org is registered as "Turn 'n
// Slice". One token apart; guard silent; the org became its own vendor.
//
// Investec is not one of TnS's customers, so the correct outcome is: outgoing,
// no supplier, no customer, and a flag saying so.
// ---------------------------------------------------------------------------

const TNS: OrgIdentity = {
  legalName: "Turn 'n Slice",
  tradingName: null,
  vatNumber: '4123456789',
};

/** The org's real customer list — Investec is deliberately not on it. */
const TNS_CUSTOMERS: CounterpartyCandidate[] = [
  { id: 'cust-baker', name: 'Bakers Delight CC' },
  { id: 'cust-meridian', name: 'Meridian Foods (Pty) Ltd' },
  { id: 'cust-woolf', name: 'Woolf & Sons Catering' },
];

test('normaliseParty strips punctuation, parentheticals and legal suffixes', () => {
  assert.equal(normaliseParty("Turn 'n Slice"), 'turn n slice');
  assert.equal(normaliseParty('Turn n Slice HQ (Pty) Ltd'), 'turn n slice hq');
  assert.equal(normaliseParty('Investec Bank Limited'), 'investec bank');
  assert.equal(normaliseParty('Woolf & Sons Catering'), 'woolf and sons catering');
  assert.equal(normaliseParty(null), '');
});

test('normaliseVat keeps digits and rejects anything too short to be one', () => {
  assert.equal(normaliseVat('VAT No. 4123 456 789'), '4123456789');
  assert.equal(normaliseVat('4/123'), '');
  assert.equal(normaliseVat(null), '');
});

test('the org letterhead is recognised even though exact equality misses it', () => {
  // This is precisely the comparison resolveSupplierProfile makes, and loses.
  assert.notEqual(normaliseParty("Turn 'n Slice"), normaliseParty('Turn n Slice HQ (Pty) Ltd'));

  const hit = matchesOrgIdentity('Turn n Slice HQ (Pty) Ltd', null, TNS);
  assert.ok(hit, 'the letterhead should be recognised as the org');
  assert.equal(hit.kind, 'legal_name');
  assert.ok(hit.score >= ORG_IDENTITY_DICE, `score ${hit.score} should clear ${ORG_IDENTITY_DICE}`);
});

test('TnS case: outgoing, supplier dropped, customer left blank, flagged', () => {
  const input = {
    issuer: 'Turn n Slice HQ (Pty) Ltd',
    issuerVatNumber: null,
    billTo: 'Investec Bank Limited',
    identity: TNS,
  };

  const verdict = resolveDocumentDirection(input);
  assert.equal(verdict.direction, 'outgoing');
  assert.equal(verdict.matchedOn, 'legal_name');

  // Investec is not a customer of this org, and inventing one is the one thing
  // the rule forbids.
  const match = matchCounterparty(input.billTo, TNS_CUSTOMERS);
  assert.equal(match.customerId, null);
  assert.equal(match.customerName, null);
  assert.equal(match.missReason, 'below_threshold');

  const record = buildDirectionRecord(verdict, input, match);
  assert.ok(record);
  assert.equal(record.direction, 'outgoing');
  assert.equal(record.customer_id, null, 'no customer may be guessed');
  assert.equal(record.customer_name, null);
  assert.equal(record.issuer_as_read, 'Turn n Slice HQ (Pty) Ltd', 'kept for audit, never as a supplier');
  assert.equal(record.counterparty_as_read, 'Investec Bank Limited');
  assert.equal(record.note, OUTGOING_UNMATCHED_NOTE);
  assert.equal(isOutgoingDocument({ direction: record }), true);
});

test('an outgoing invoice to a known customer links that customer', () => {
  const input = {
    issuer: 'Turn n Slice HQ (Pty) Ltd',
    issuerVatNumber: null,
    billTo: 'Meridian Foods',
    identity: TNS,
  };
  const verdict = resolveDocumentDirection(input);
  assert.equal(verdict.direction, 'outgoing');

  const match = matchCounterparty(input.billTo, TNS_CUSTOMERS);
  assert.equal(match.customerId, 'cust-meridian');
  // The stored name is the CUSTOMER ROW's, not the (unverified) string on the paper.
  assert.equal(match.customerName, 'Meridian Foods (Pty) Ltd');
  assert.ok(match.score !== null && match.score >= COUNTERPARTY_DICE);

  const record = buildDirectionRecord(verdict, input, match);
  assert.ok(record);
  assert.equal(record.customer_id, 'cust-meridian');
  assert.equal(record.miss_reason, null);
  assert.equal(record.note, 'Outgoing invoice — you invoiced Meridian Foods (Pty) Ltd');
});

test('the VAT number alone identifies the issuer as the org', () => {
  const verdict = resolveDocumentDirection({
    issuer: 'TNS HQ',
    issuerVatNumber: 'VAT 4123 456 789',
    billTo: 'Bakers Delight CC',
    identity: TNS,
  });
  assert.equal(verdict.direction, 'outgoing');
  assert.equal(verdict.matchedOn, 'vat_number');
});

test('an ordinary supplier invoice is unchanged — incoming, no record', () => {
  const input = {
    issuer: 'Karsten Farms (Pty) Ltd',
    issuerVatNumber: '4999888777',
    billTo: "Turn 'n Slice",
    identity: TNS,
  };
  const verdict = resolveDocumentDirection(input);
  assert.equal(verdict.direction, 'incoming');
  assert.equal(verdict.matchedOn, null);
  assert.equal(buildDirectionRecord(verdict, input, matchCounterparty(input.billTo, TNS_CUSTOMERS)), null);
  assert.equal(isOutgoingDocument({ direction: null }), false);
});

test('a supplier whose name overlaps the org is still a supplier', () => {
  // The regression resolveSupplierProfile's comment warns about: org "Fresh
  // Valley Produce" must not swallow supplier "Valley Produce". Dice scores 0.8,
  // under the 0.85 identity bar, so it stays incoming.
  const identity: OrgIdentity = { legalName: 'Fresh Valley Produce', tradingName: null, vatNumber: null };
  assert.equal(matchesOrgIdentity('Valley Produce', null, identity), null);
  assert.equal(
    resolveDocumentDirection({ issuer: 'Valley Produce', billTo: 'Fresh Valley Produce', identity }).direction,
    'incoming',
  );
});

test('ambiguity keeps the current behaviour — unknown', () => {
  // Both sides read as the org — an intra-group transfer from HQ to the depot,
  // or a misread of a document that prints the letterhead twice. Picking a side
  // here would be a guess, so nothing is decided and nothing is written.
  const both = resolveDocumentDirection({
    issuer: 'Turn n Slice HQ (Pty) Ltd',
    billTo: "Turn 'n Slice Depot",
    identity: TNS,
  });
  assert.equal(both.direction, 'unknown');

  // No letterhead read at all.
  assert.equal(resolveDocumentDirection({ issuer: null, billTo: 'Anyone', identity: TNS }).direction, 'unknown');

  // The org itself is not on file, so there is nothing to compare against.
  assert.equal(
    resolveDocumentDirection({
      issuer: 'Turn n Slice HQ (Pty) Ltd',
      billTo: 'Investec Bank Limited',
      identity: { legalName: null, tradingName: null, vatNumber: null },
    }).direction,
    'unknown',
  );
});

test('a near-tie between two customers is a miss, not a coin flip', () => {
  const twins: CounterpartyCandidate[] = [
    { id: 'a', name: 'Harbour Foods Cape Town' },
    { id: 'b', name: 'Harbour Foods Cape Point' },
  ];
  const match = matchCounterparty('Harbour Foods Cape', twins);
  assert.equal(match.customerId, null);
  assert.equal(match.missReason, 'ambiguous');
});

test('an empty bill-to and an empty customer list both miss cleanly', () => {
  assert.equal(matchCounterparty(null, TNS_CUSTOMERS).missReason, 'no_name');
  assert.equal(matchCounterparty('Meridian Foods', []).missReason, 'no_customers');
});
