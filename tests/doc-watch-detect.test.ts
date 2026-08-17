import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDocWatchFinding,
  buildDocWatchDedupeKey,
  parseDocWatchDedupeKey,
  isWatchedDocType,
  parseAmount,
  readWhenPhrase,
  type DocWatchInput,
} from '../lib/platform/doc-watch/detect.ts';

/** en-ZA groups thousands with a NON-BREAKING space (U+00A0) — `rand()` formats
 *  every money figure in this product, so the observations carry it. */
const NB = '\u00A0';
function zar(whole: number): string {
  return `R ${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NB)}`;
}

function input(overrides: Partial<DocWatchInput> = {}): DocWatchInput {
  return {
    documentId: 'doc-901',
    documentType: 'invoice',
    supplierName: 'Winelands Protein Co.',
    orgName: 'Meridian Food Co.',
    extracted: {
      fields: [
        { label: 'Invoice number', value: 'INV-9268' },
        { label: 'Total (incl. VAT)', value: 'R 447 856.00' },
      ],
      line_items: [
        { description: 'Line fish fillet', quantity: '440', unit: 'kg', unit_price: '176.00', amount: '77440.00' },
        { description: 'Chicken portions', quantity: '500', unit: 'box', unit_price: '624.00', amount: '312000.00' },
      ],
    },
    createdAt: '2026-08-12T07:45:00+02:00',
    now: new Date('2026-08-12T09:00:00+02:00'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Which documents get a card at all
// ---------------------------------------------------------------------------

const TYPE_CASES: Array<[type: string | null, watched: boolean]> = [
  ['invoice', true],
  ['statement', true],
  ['price_list', true],
  ['delivery_note', false],
  ['order', false],
  ['', false],
  [null, false],
];

for (const [type, watched] of TYPE_CASES) {
  test(`isWatchedDocType(${JSON.stringify(type)}) === ${watched}`, () => {
    assert.equal(isWatchedDocType(type), watched);
    assert.equal(detectDocWatchFinding(input({ documentType: type })) != null, watched);
  });
}

test('detectDocWatchFinding: an empty extraction says nothing at all', () => {
  assert.equal(detectDocWatchFinding(input({ extracted: null })), null);
  assert.equal(detectDocWatchFinding(input({ extracted: { fields: [], line_items: [] } })), null);
});

test('detectDocWatchFinding: a statement with no priced lines says nothing', () => {
  assert.equal(
    detectDocWatchFinding(
      input({
        documentType: 'statement',
        extracted: { fields: [{ label: 'Closing balance', value: 'R 406 100.00' }], line_items: [] },
      }),
    ),
    null,
  );
});

test('detectDocWatchFinding: a price list with no described items says nothing', () => {
  assert.equal(
    detectDocWatchFinding(
      input({ documentType: 'price_list', extracted: { fields: [], line_items: [{ description: '  ' }] } }),
    ),
    null,
  );
});

// ---------------------------------------------------------------------------
// Every card is informational — no money, no advice
// ---------------------------------------------------------------------------

test('detectDocWatchFinding: never carries a rand impact or a recommendation', () => {
  for (const documentType of ['invoice', 'statement', 'price_list']) {
    const f = detectDocWatchFinding(input({ documentType }));
    assert.ok(f, documentType);
    assert.equal(f.randImpact, null);
    assert.equal(f.recommendedAction, null);
    assert.deepEqual(f.evidenceRefs, ['doc-901']);
    assert.equal(f.dedupeKey, buildDocWatchDedupeKey('doc-901'));
  }
});

test('parseDocWatchDedupeKey: round-trips, and refuses anything it cannot read in full', () => {
  assert.deepEqual(parseDocWatchDedupeKey(buildDocWatchDedupeKey('doc-901')), { documentId: 'doc-901' });
  for (const bad of ['', 'doc_watch', 'doc_watch:', 'doc_watch:a:b', 'price_watch:doc-1']) {
    assert.equal(parseDocWatchDedupeKey(bad), null, bad);
  }
});

test('detectDocWatchFinding: re-extracting the same document produces the same key (no second card)', () => {
  const first = detectDocWatchFinding(input());
  const again = detectDocWatchFinding(input({ now: new Date('2026-08-13T11:00:00+02:00') }));
  assert.equal(first?.dedupeKey, again?.dedupeKey);
});

// ---------------------------------------------------------------------------
// "when", in the owner's words (SAST)
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-17T09:00:00+02:00');
const WHEN_CASES: Array<[createdAt: string, phrase: string]> = [
  ['2026-08-17T02:10:00+02:00', 'overnight'],
  ['2026-08-17T07:45:00+02:00', 'this morning'],
  ['2026-08-17T13:20:00+02:00', 'this afternoon'],
  ['2026-08-17T19:05:00+02:00', 'this evening'],
  ['2026-08-16T22:40:00+02:00', 'overnight'],
  ['2026-08-16T10:00:00+02:00', 'yesterday'],
  ['2026-08-14T10:00:00+02:00', '3 days ago'],
  ['2026-06-30T16:05:00+02:00', 'on 30 June'],
  ['not a date', 'recently'],
];

for (const [createdAt, phrase] of WHEN_CASES) {
  test(`readWhenPhrase(${createdAt}) === "${phrase}"`, () => {
    assert.equal(readWhenPhrase(createdAt, NOW), phrase);
  });
}

// ---------------------------------------------------------------------------
// parseAmount — extraction hands over display text, not numbers
// ---------------------------------------------------------------------------

const AMOUNT_CASES: Array<[raw: string | null, value: number | null]> = [
  ['R 447 856.00', 447856],
  ['447,856.00', 447856],
  ['1 308.00', 1308],
  ['77440.00', 77440],
  ['-2800.00', -2800],
  ['', null],
  ['n/a', null],
  [null, null],
];

for (const [raw, value] of AMOUNT_CASES) {
  test(`parseAmount(${JSON.stringify(raw)}) === ${value}`, () => {
    assert.equal(parseAmount(raw), value);
  });
}

// ---------------------------------------------------------------------------
// MERIDIAN — the exact sentences the demo produces
// ---------------------------------------------------------------------------

test('detectDocWatchFinding: Meridian invoice — document 901, supabase/demo-refresh-2026-08.sql §1.2', () => {
  const f = detectDocWatchFinding(input());
  assert.equal(
    f?.observation,
    `Invoice INV-9268 from Winelands Protein Co. read this morning — ${zar(447_856)}. ` +
      `Biggest lines: Chicken portions ${zar(312_000)}, Line fish fillet ${zar(77_440)}.`,
  );
});

test('detectDocWatchFinding: Meridian market statement — document 25, supabase/demo-all-in-one.sql', () => {
  const f = detectDocWatchFinding(
    input({
      documentId: 'doc-025',
      documentType: 'statement',
      supplierName: 'Bergriver Growers',
      createdAt: '2026-06-30T16:05:00+02:00',
      now: new Date('2026-08-17T09:00:00+02:00'),
      extracted: {
        fields: [
          { label: 'Supplier', value: 'Bergriver Growers' },
          { label: 'Statement period', value: 'June 2026' },
          { label: 'Closing balance', value: 'R 406 100.00' },
        ],
        line_items: [
          { description: 'SALAD LEAF MIX 5KG CRT', quantity: '1180', unit: 'crate', unit_price: '147.00', amount: '173460.00' },
          { description: 'SPINACH BABY 4KG', quantity: '940', unit: 'crate', unit_price: '131.00', amount: '123140.00' },
          { description: 'PALLET DEPOSIT', quantity: '40', unit: 'pallet', unit_price: '70.00', amount: '2800.00' },
        ],
      },
    }),
  );
  assert.equal(
    f?.observation,
    `Market sheet from Bergriver Growers scanned on 30 June — 3 lines worth ${zar(299_400)}. ` +
      `Meridian Food Co. spent the most on SALAD LEAF MIX 5KG CRT ${zar(173_460)}, ` +
      `SPINACH BABY 4KG ${zar(123_140)}, PALLET DEPOSIT ${zar(2_800)}.`,
  );
  // The closing balance is NOT quoted as the total: it carries last month's
  // opening figure and payments, and the lines do not add up to it.
  assert.ok(!f!.observation.includes('406'));
});

test('detectDocWatchFinding: a price list counts items, and only claims changes it was given', () => {
  const priceList = (priceListChanges: number | null) =>
    detectDocWatchFinding(
      input({
        documentType: 'price_list',
        supplierName: 'Riebeek Oils & Fats',
        createdAt: '2026-08-17T07:10:00+02:00',
        now: new Date('2026-08-17T09:00:00+02:00'),
        priceListChanges,
        extracted: {
          fields: [],
          line_items: [
            { description: 'Cooking oil (5L)', unit_price: '664.00' },
            { description: 'Frying medium (20L)', unit_price: '1308.00' },
          ],
        },
      }),
    );

  assert.equal(
    priceList(null)?.observation,
    "Riebeek Oils & Fats's new price list read this morning — 2 items.",
  );
  assert.equal(
    priceList(1)?.observation,
    "Riebeek Oils & Fats's new price list read this morning — 2 items, 1 price changed vs the last one.",
  );
  // No previous list to compare against is not "nothing changed" — the clause
  // is dropped rather than claiming zero.
  assert.equal(
    priceList(0)?.observation,
    "Riebeek Oils & Fats's new price list read this morning — 2 items.",
  );
});

test('detectDocWatchFinding: an unattributed invoice drops the supplier clause instead of saying "Unknown"', () => {
  const f = detectDocWatchFinding(input({ supplierName: null }));
  assert.equal(
    f?.observation,
    `Invoice INV-9268 read this morning — ${zar(447_856)}. ` +
      `Biggest lines: Chicken portions ${zar(312_000)}, Line fish fillet ${zar(77_440)}.`,
  );
});

test('detectDocWatchFinding: a line with no amount is priced from quantity × unit price', () => {
  const f = detectDocWatchFinding(
    input({
      extracted: {
        fields: [{ label: 'Invoice number', value: 'INV-1' }],
        line_items: [{ description: 'Tomatoes', quantity: '100', unit: 'kg', unit_price: '23.50' }],
      },
    }),
  );
  assert.equal(f?.observation, `Invoice INV-1 from Winelands Protein Co. read this morning. Biggest lines: Tomatoes ${zar(2_350)}.`);
});
