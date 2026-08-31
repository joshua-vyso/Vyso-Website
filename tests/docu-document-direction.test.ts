import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COUNTERPARTY_DICE,
  ORG_IDENTITY_DICE,
  OUTGOING_UNMATCHED_NOTE,
  buildDirectionRecord,
  counterpartyDisplayName,
  counterpartyRoleLabel,
  documentCounterpartyRole,
  isOutgoingDocument,
  matchCounterparty,
  matchesOrgIdentity,
  normaliseParty,
  normaliseVat,
  resolveDocumentDirection,
  tradingAsSegments,
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

// ---------------------------------------------------------------------------
// Invoice 105375 — the labels that contradicted the record.
//
// Turn 'n Slice issued an invoice to a Tsogo Sun property. Every stored value
// was RIGHT: direction 'outgoing', issuer read off the letterhead, supplier
// resolution skipped on both paths, ProcurePulse refusing the lines, the flag
// reading "Outgoing invoice — customer not recognised". Then three screens
// printed the word "Supplier" over it, twice with an em dash beside it, because
// an outgoing document has no supplier by construction.
//
// The second half was the counterparty match: the page prints "Tsogo Sun
// Casino's Pty Ltd" on one line and "t/a Montecasino" on the next, the org's
// directory holds the TRADING name, and the two share almost no tokens.
//
// SYNTHETIC. The shapes and the reference numbers are the ones that failed; the
// live document is never read, reprocessed or mutated by anything here.
// ---------------------------------------------------------------------------

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The org, as invoice 105375's letterhead prints it against the register: a
 *  registered name one token short of the letterhead, and no trading name on
 *  file — which is why the live record reads `matched_on: 'legal_name'`. */
const TNS_HO: OrgIdentity = { legalName: "Turn 'n Slice", tradingName: null, vatNumber: '4123456789' };

/** A directory that holds the property under its TRADING name — which is how a
 *  hospitality group's customers are actually filed, and why the legal entity
 *  on the invoice matched nothing. */
const GROUP_CUSTOMERS: CounterpartyCandidate[] = [
  { id: 'cust-monte', name: 'Montecasino' },
  { id: 'cust-silverstar', name: 'Silverstar Casino' },
  { id: 'cust-westcliff', name: 'Four Seasons Hotel The Westcliff' },
];

test('D1. TnS → Montecasino: outgoing, and the trading-as segment finds the customer', () => {
  const input = {
    issuer: 'Turn n Slice HO (Pty) Ltd',
    issuerVatNumber: null,
    billTo: "Tsogo Sun Casino's Pty Ltd t/a Montecasino",
    identity: TNS_HO,
  };
  const verdict = resolveDocumentDirection(input);
  assert.equal(verdict.direction, 'outgoing');
  assert.equal(verdict.matchedOn, 'legal_name');

  // Whole, the printed name misses by a mile — this is the live miss.
  assert.equal(matchCounterparty("Tsogo Sun Casino's Pty Ltd", GROUP_CUSTOMERS).missReason, 'below_threshold');
  // With the trading-as continuation kept, it lands.
  const match = matchCounterparty(input.billTo, GROUP_CUSTOMERS);
  assert.equal(match.customerId, 'cust-monte');
  assert.equal(match.customerName, 'Montecasino', 'the DIRECTORY row name, not the string on the paper');
  assert.equal(match.missReason, null);

  const record = buildDirectionRecord(verdict, input, match);
  assert.ok(record);
  assert.equal(record.customer_id, 'cust-monte');
  assert.equal(record.counterparty_as_read, "Tsogo Sun Casino's Pty Ltd t/a Montecasino");
  assert.equal(record.note, 'Outgoing invoice — you invoiced Montecasino');
  // The role the whole UI now reads.
  assert.equal(documentCounterpartyRole({ direction: record }), 'customer');
  assert.equal(counterpartyRoleLabel(documentCounterpartyRole({ direction: record })), 'Customer');
});

test('D2. "trading as" is the same rule, and a name with no marker costs nothing', () => {
  assert.deepEqual(tradingAsSegments('Hospitality Holdings (Pty) Ltd trading as The Grand'), [
    'hospitality holdings',
    'the grand',
  ]);
  assert.deepEqual(tradingAsSegments("Tsogo Sun Casino's Pty Ltd t/a Montecasino"), [
    'tsogo sun casino s',
    'montecasino',
  ]);
  // The ordinary case: no marker, no segments, no extra scoring.
  assert.deepEqual(tradingAsSegments('Meridian Foods (Pty) Ltd'), []);
  assert.deepEqual(tradingAsSegments(null), []);

  assert.equal(
    matchCounterparty('Hospitality Holdings (Pty) Ltd trading as The Grand', [
      { id: 'cust-grand', name: 'The Grand' },
    ]).customerId,
    'cust-grand',
  );
});

test('D3. The thresholds did not move, and nothing is ever created', () => {
  // A trading-as segment is scored against the SAME bar. "t/a Harbour" must not
  // land on "Harbour Foods Cape Town" just because it is the only row there.
  assert.equal(
    matchCounterparty('Coastal Ventures (Pty) Ltd t/a Harbour', [
      { id: 'a', name: 'Harbour Foods Cape Town' },
    ]).missReason,
    'below_threshold',
  );
  // Two rows carrying the SAME trading name are a data question, not a choice.
  // Josh merges the duplicates; this function does not pick one.
  const duplicates = matchCounterparty("Tsogo Sun Casino's Pty Ltd t/a Montecasino", [
    { id: 'cust-monte-1', name: 'Montecasino' },
    { id: 'cust-monte-2', name: 'Montecasino' },
  ]);
  assert.equal(duplicates.customerId, null);
  assert.equal(duplicates.missReason, 'ambiguous');
  // An unmatched counterparty stays blank. There is no create path in here at all.
  assert.equal(src('lib/platform/docu/document-direction.ts').includes('insert('), false);
});

test('D4. An ordinary supplier invoice is INBOUND and completely unchanged', () => {
  const input = {
    issuer: 'Karsten Farms (Pty) Ltd',
    issuerVatNumber: '4999888777',
    billTo: 'Turn n Slice HO (Pty) Ltd',
    identity: TNS_HO,
  };
  const verdict = resolveDocumentDirection(input);
  assert.equal(verdict.direction, 'incoming');
  assert.equal(buildDirectionRecord(verdict, input, matchCounterparty(input.billTo, GROUP_CUSTOMERS)), null);
  // No record → role 'supplier' → the label and the value the pane has always
  // shown. Every legacy row answers the same way with no backfill.
  assert.equal(documentCounterpartyRole({ direction: null }), 'supplier');
  assert.equal(documentCounterpartyRole(null), 'supplier');
  assert.equal(documentCounterpartyRole({ fields: [] } as never), 'supplier');
  assert.equal(counterpartyRoleLabel('supplier'), 'Supplier');
  assert.equal(
    counterpartyDisplayName({ direction: null, supplier: 'Karsten Farms (Pty) Ltd' }, null),
    'Karsten Farms (Pty) Ltd',
  );
  // The resolved SUPPLIER ROW still wins over the extracted string, as before.
  assert.equal(
    counterpartyDisplayName({ direction: null, supplier: 'Karsten Farms' }, 'Karsten Farms (Pty) Ltd'),
    'Karsten Farms (Pty) Ltd',
  );
});

test('D5. Both names on the page cannot flip the direction — the ISSUER decides', () => {
  // An invoice TnS received that prints TnS in its Bill To block, which is every
  // supplier invoice ever sent to them. The org's own name being on the paper is
  // not evidence of authorship; being on the LETTERHEAD is.
  assert.equal(
    resolveDocumentDirection({
      issuer: 'Country Mushrooms (Pty) Ltd',
      billTo: "Turn 'n Slice",
      identity: TNS_HO,
    }).direction,
    'incoming',
  );
  // The org's own VAT number printed in a Bill To block is likewise not proof —
  // `issuerVatNumber` is the number against the ISSUER specifically.
  assert.equal(
    resolveDocumentDirection({
      issuer: 'Country Mushrooms (Pty) Ltd',
      issuerVatNumber: '4999888777',
      billTo: 'Turn n Slice HO (Pty) Ltd',
      identity: TNS_HO,
    }).direction,
    'incoming',
  );
  // And when the org is on BOTH sides, nothing is decided. 'unknown' is the
  // existing behaviour, which is the point of it.
  assert.equal(
    resolveDocumentDirection({
      issuer: 'Turn n Slice HO (Pty) Ltd',
      billTo: "Turn 'n Slice Depot",
      identity: TNS_HO,
    }).direction,
    'unknown',
  );
});

test('D6. An outgoing document reaches no supplier, no spend and no stock', () => {
  // The guards are the ones that were already right on invoice 105375 — this
  // pins them, because the UI change must not be mistaken for the whole fix.
  const feed = src('lib/platform/procurepulse-feed.ts');
  assert.match(feed, /if \(isOutgoingDocument\(doc\.extracted_data as DocuExtractedData \| null\)\) \{\s*\n\s*return \{ \.\.\.base, reason: 'outgoing-document' \};/);

  // SUPPLIER RESOLUTION IS GATED ON A NAME THAT IS NULL FOR AN OUTGOING
  // DOCUMENT, on both extraction paths, so neither can create the org as its
  // own vendor.
  for (const path of ['lib/platform/document-ingest.ts', 'app/api/ai/extract/route.ts']) {
    const source = src(path);
    const resolveAt = source.indexOf('resolveSupplierProfile(supabase');
    assert.ok(resolveAt > 0, `${path} resolves a supplier`);
    const guard = source.lastIndexOf('parties.supplierName', resolveAt);
    assert.ok(guard > 0 && resolveAt - guard < 400, `${path} gates it on parties.supplierName`);
  }
  // And the extract route writes the role beside the direction, so the two can
  // never disagree.
  assert.match(
    src('app/api/ai/extract/route.ts'),
    /counterparty_role: documentCounterpartyRole\(\{ direction: parties\.record \}\),/,
  );
  assert.match(
    src('lib/platform/document-ingest.ts'),
    /counterparty_role: documentCounterpartyRole\(\{ direction: parties\.record \}\),/,
  );
});

test('D7. The stamped role wins, and a legacy row still derives the same answer', () => {
  assert.equal(documentCounterpartyRole({ counterparty_role: 'customer' }), 'customer');
  assert.equal(documentCounterpartyRole({ counterparty_role: 'supplier' }), 'supplier');
  // Absent (every row filed before this shipped) → derived from the direction.
  assert.equal(documentCounterpartyRole({ counterparty_role: null, direction: null }), 'supplier');
  const outgoing = buildDirectionRecord(
    resolveDocumentDirection({ issuer: 'Turn n Slice HO (Pty) Ltd', billTo: 'Montecasino', identity: TNS_HO }),
    { issuer: 'Turn n Slice HO (Pty) Ltd', billTo: 'Montecasino' },
    matchCounterparty('Montecasino', GROUP_CUSTOMERS),
  );
  assert.equal(documentCounterpartyRole({ direction: outgoing }), 'customer');
  // The display ladder on an outgoing document: resolved row, then the name as
  // printed, and never the org's own.
  assert.equal(counterpartyDisplayName({ direction: outgoing }, 'Montecasino'), 'Montecasino');
  assert.equal(
    counterpartyDisplayName(
      { direction: { ...outgoing!, customer_id: null, customer_name: null, counterparty_as_read: 'Tsogo Sun t/a Montecasino' } },
      null,
    ),
    'Tsogo Sun t/a Montecasino',
  );
});

test('D8. THE LABELS. Every screen that names the counterparty asks which one it is', () => {
  // The review pane: label AND value are direction-aware, and the incoming
  // branch is still `detail.supplier` with an em dash when there is none.
  const pane = src('components/platform/review/DocumentReviewPane.tsx');
  assert.match(pane, /label=\{detail\.counterpartyRole === 'customer' \? 'Customer' : 'Supplier'\}/);
  assert.match(pane, /value=\{\(detail\.counterpartyRole === 'customer' \? detail\.counterparty : detail\.supplier\) \?\? '—'\}/);
  assert.equal(/<Field label="Supplier"/.test(pane), false, 'the hardcoded label is gone');

  // The extraction editor: the label follows the direction, and an outgoing
  // document's placeholder names a CUSTOMER rather than inviting a market agent.
  const editor = src('components/platform/ExtractionEditor.tsx');
  assert.match(editor, /\{outgoing \? 'Customer' : 'Supplier'\}/);
  assert.match(editor, /the customer you invoiced/);
  // And a reviewer's typing can never put a name back into the supplier slot on
  // a document the org issued.
  assert.match(editor, /\{ supplier: null, bill_to: party\.trim\(\) \|\| null \}/);

  // The detail panel header: the counterparty, never "Unknown supplier" on a
  // document that has no supplier by construction.
  const panel = src('components/platform/docu/DocumentDetailPanel.tsx');
  assert.match(panel, /const counterpartyHeading =/);
  assert.match(panel, /'Customer not recognised'/);
  assert.equal(panel.includes('>{supplierName}</div>'), false, 'the header no longer prints it raw');

  // And the pane is fed the role and the value from the stored row.
  const actions = src('lib/platform/review-actions.ts');
  assert.match(actions, /counterpartyRole: documentCounterpartyRole\(row\.extracted_data\),/);
  assert.match(actions, /counterparty: counterpartyDisplayName\(row\.extracted_data, row\.supplier\?\.name \?\? null\),/);
});

test('D9. PROMPT: bill_to keeps a printed trading-as continuation, verbatim', () => {
  const anthropic = src('lib/ai/anthropic.ts');
  const clause = anthropic.slice(anthropic.indexOf('- "bill_to"'), anthropic.indexOf('- "summary"'));
  assert.match(clause, /KEEP A PRINTED TRADING-AS CONTINUATION/);
  assert.match(clause, /t\/a/);
  assert.match(clause, /trading as/);
  assert.match(clause, /return BOTH/);
  // The failure it exists to stop, named in the prompt itself.
  assert.match(clause, /matched to nobody/);
});

test('D10. The Four Seasons property resolves under the name the directory holds', () => {
  // The other side of the same coin: a hotel group's property is filed under its
  // own name, and the customer, the supplier and the human are three different
  // answers that must not be pooled. TnS is the SUPPLIER on that purchase order,
  // the property is the customer, and Canaan Myeni is the contact — which is why
  // `contact_person` exists beside `customer_name` rather than instead of it.
  const match = matchCounterparty('Four Seasons Hotel The Westcliff', GROUP_CUSTOMERS);
  assert.equal(match.customerId, 'cust-westcliff');
  // The org's own name is never a customer of the org.
  assert.equal(matchCounterparty('Turn n Slice HO (Pty) Ltd', GROUP_CUSTOMERS).customerId, null);
  // A person is not a business, and scores like one.
  assert.equal(matchCounterparty('Canaan Myeni', GROUP_CUSTOMERS).missReason, 'below_threshold');
});
