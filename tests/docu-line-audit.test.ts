import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditLines,
  auditLine,
  moneyMatches,
  applyShift,
  checkTotal,
  describeShift,
  REPAIRED_CONFIDENCE_CAP,
  LINE_MATH_CONFIDENCE_CAP,
  type AuditableLine,
} from '../lib/platform/docu/line-audit.ts';

// ---------------------------------------------------------------------------
// The Turn 'n Slice invoice — a photographed, skewed A4 with 11 product lines.
//
// PAPER is what the printed document actually says. EXTRACTED is what the model
// returned: every description and quantity is right, but the UNIT PRICE column
// was read one row late and the AMOUNT column two rows late, so line 1 came back
// with no price at all, line 2 borrowed line 1's rate, line 3 borrowed line 2's
// rate and line 1's amount, and so on down the page. The tell is that 5 × 89.90
// is nowhere near 60.85 — the arithmetic fails on nearly every line, which is
// exactly what this audit exists to notice.
// ---------------------------------------------------------------------------

interface PaperLine {
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

const PAPER: PaperLine[] = [
  { description: 'Carrots-Grated', quantity: '5', unit_price: '25.50', amount: '127.50' },
  { description: 'Onion-Sliced', quantity: '4', unit_price: '29.90', amount: '119.60' },
  { description: 'Onion-Red Sliced', quantity: '3', unit_price: '32.50', amount: '97.50' },
  { description: 'Cabbage-Shredded', quantity: '6', unit_price: '18.75', amount: '112.50' },
  { description: 'Butternut-Diced', quantity: '8', unit_price: '42.00', amount: '336.00' },
  { description: 'Peppers-Mixed Diced', quantity: '2', unit_price: '68.40', amount: '136.80' },
  { description: 'Potato-Chipped', quantity: '10', unit_price: '34.90', amount: '349.00' },
  { description: 'Spinach-Chopped', quantity: '7', unit_price: '55.20', amount: '386.40' },
  { description: 'Mushroom-Sliced', quantity: '1', unit_price: '60.85', amount: '60.85' },
  { description: 'Beetroot-Cubed', quantity: '3', unit_price: '89.90', amount: '269.70' },
  { description: 'Broccoli-Florets', quantity: '5', unit_price: '75.50', amount: '377.50' },
];

/** R 2 373.35 — the invoice's own total, and the sum of the PAPER amounts. */
const PAPER_TOTAL = 2373.35;

/** What came back from the model: price one row late, amount two rows late. */
const EXTRACTED: AuditableLine[] = PAPER.map((line, i) => ({
  description: line.description,
  quantity: line.quantity,
  unit: 'boxes',
  unit_price: PAPER[i - 1]?.unit_price ?? '',
  amount: PAPER[i - 2]?.amount ?? '',
}));

test('the fixture reproduces the reported extraction exactly', () => {
  // The four rows the human read off the review screen and the paper side by side.
  assert.equal(EXTRACTED[0].unit_price, '');
  assert.equal(EXTRACTED[0].amount, '');
  assert.equal(EXTRACTED[1].unit_price, '25.50'); // Carrots' rate
  assert.equal(EXTRACTED[1].amount, '');
  assert.equal(EXTRACTED[2].unit_price, '29.90'); // Onion-Sliced's rate
  assert.equal(EXTRACTED[2].amount, '127.50'); // Carrots' amount
  assert.equal(EXTRACTED[10].description, 'Broccoli-Florets');
  assert.equal(EXTRACTED[10].unit_price, '89.90');
  assert.equal(EXTRACTED[10].amount, '60.85');
  // …and 5 × 89.90 is nothing like 60.85.
  assert.ok(!moneyMatches(5 * 89.9, 60.85));
  assert.equal(PAPER.reduce((s, l) => s + Number(l.amount), 0).toFixed(2), PAPER_TOTAL.toFixed(2));
});

test('Turn n Slice invoice: row shift detected and repaired to the paper values', () => {
  const audit = auditLines({ lines: EXTRACTED, total: PAPER_TOTAL });

  assert.equal(audit.diagnosis, 'row_shift');
  assert.deepEqual(audit.shift, { unit_price: 1, amount: 2 });
  assert.equal(describeShift(audit.shift!), 'price +1, amount +2');
  assert.ok(audit.repaired);

  // Every line back to what the paper says — descriptions and quantities as
  // extracted, price and amount re-aligned.
  const repaired = audit.repaired!;
  assert.equal(repaired.length, 11);
  repaired.forEach((line, i) => {
    assert.equal(line.description, PAPER[i].description, `row ${i + 1} description`);
    assert.equal(line.quantity, PAPER[i].quantity, `row ${i + 1} quantity`);
    assert.equal(line.unit_price, PAPER[i].unit_price, `row ${i + 1} unit price`);
    assert.equal(line.amount, PAPER[i].amount, `row ${i + 1} amount`);
  });

  // …and the repaired document now adds up, on every line and in total.
  assert.equal(audit.failed, 0);
  assert.equal(audit.passed, 11);
  assert.deepEqual(audit.failingRows, []);
  assert.deepEqual(audit.unresolvedRows, []);
  assert.equal(audit.totalCheck.basis, 'match');
  assert.equal(audit.totalCheck.lineSum, PAPER_TOTAL);

  // It goes to a human either way.
  assert.equal(audit.confidenceCap, REPAIRED_CONFIDENCE_CAP);
  assert.match(audit.note ?? '', /re-aligned automatically/);
  assert.match(audit.note ?? '', /worth an eye/i);
  assert.equal(audit.reconstructedFromTotal, true);
});

test('Turn n Slice invoice without a document total: repairs what it can, admits the rest', () => {
  const audit = auditLines({ lines: EXTRACTED });

  assert.equal(audit.diagnosis, 'row_shift');
  assert.deepEqual(audit.shift, { unit_price: 1, amount: 2 });
  const repaired = audit.repaired!;

  // Rows 1–10 are recoverable from the slide alone (row 10's amount is implied
  // by its quantity and recovered rate).
  for (let i = 0; i <= 9; i += 1) {
    assert.equal(repaired[i].unit_price, PAPER[i].unit_price, `row ${i + 1} unit price`);
    assert.equal(repaired[i].amount, PAPER[i].amount, `row ${i + 1} amount`);
  }
  // Row 11's price and amount were never in the model's output — nothing is invented.
  assert.equal(repaired[10].unit_price, '');
  assert.equal(repaired[10].amount, '');
  assert.deepEqual(audit.unresolvedRows, [11]);
  assert.equal(audit.reconstructedFromTotal, false);
  assert.equal(audit.totalCheck.basis, 'unknown');
  assert.match(audit.note ?? '', /Row 11 could not be recovered/);
});

// ---------------------------------------------------------------------------
// Table-driven cases
// ---------------------------------------------------------------------------

function line(
  description: string,
  quantity: string,
  unit_price: string,
  amount: string,
  extra: Partial<AuditableLine> = {},
): AuditableLine {
  return { description, quantity, unit_price, amount, ...extra };
}

const CLEAN_FIVE: AuditableLine[] = [
  line('Apples Granny Smith', '2', '10.00', '20.00'),
  line('Bananas', '3', '5.50', '16.50'),
  line('Cabbage', '1', '44.00', '44.00'),
  line('Dates', '5', '8.20', '41.00'),
  line('Endive', '4', '12.25', '49.00'),
];
/** 20.00 + 16.50 + 44.00 + 41.00 + 49.00 */
const CLEAN_FIVE_TOTAL = 170.5;

/** The whole price+amount pair slid down one row, and the top row picked up a
 *  stray pair from somewhere above the table — so the repair leaves an orphan. */
const UNIFIED_SHIFT: AuditableLine[] = CLEAN_FIVE.map((l, i) => ({
  ...l,
  unit_price: i === 0 ? '99.00' : CLEAN_FIVE[i - 1].unit_price,
  amount: i === 0 ? '999.00' : CLEAN_FIVE[i - 1].amount,
}));

const CASES: {
  name: string;
  lines: AuditableLine[];
  total?: number | null;
  expect: {
    diagnosis: string;
    shift?: { unit_price: number; amount: number } | null;
    failingRows?: number[];
    confidenceCap?: number | null;
    repaired?: boolean;
    totalBasis?: string;
  };
}[] = [
  {
    name: 'clean invoice — every line multiplies out',
    lines: CLEAN_FIVE,
    total: CLEAN_FIVE_TOTAL,
    expect: { diagnosis: 'clean', shift: null, failingRows: [], confidenceCap: null, repaired: false, totalBasis: 'match' },
  },
  {
    name: 'clean invoice, VAT-inclusive total — recognised, not flagged',
    lines: CLEAN_FIVE,
    total: Number((CLEAN_FIVE_TOTAL * 1.15).toFixed(2)),
    expect: { diagnosis: 'clean', totalBasis: 'match_incl_vat' },
  },
  {
    name: 'both columns slid one row together',
    lines: UNIFIED_SHIFT,
    total: CLEAN_FIVE_TOTAL,
    expect: { diagnosis: 'row_shift', shift: { unit_price: 1, amount: 1 }, failingRows: [], confidenceCap: REPAIRED_CONFIDENCE_CAP, repaired: true },
  },
  {
    name: 'scattered arithmetic failures — no clean shift, so no guessing',
    lines: [
      line('Apples', '2', '10.00', '25.00'),
      line('Bananas', '3', '5.00', '15.00'),
      line('Carrots', '4', '7.00', '30.00'),
      line('Dates', '1', '9.00', '12.00'),
      line('Endive', '6', '2.00', '13.00'),
    ],
    expect: { diagnosis: 'line_math', shift: null, failingRows: [1, 3, 4, 5], confidenceCap: LINE_MATH_CONFIDENCE_CAP, repaired: false },
  },
  {
    name: 'one odd line among four good ones — flagged, never realigned',
    lines: [
      line('Apples', '2', '10.00', '20.00'),
      line('Bananas', '3', '5.50', '16.50'),
      line('Carrots', '4', '7.00', '30.00'),
      line('Dates', '5', '8.20', '41.00'),
      line('Endive', '4', '12.25', '49.00'),
    ],
    expect: { diagnosis: 'line_math', shift: null, failingRows: [3], confidenceCap: LINE_MATH_CONFIDENCE_CAP, repaired: false },
  },
  {
    name: 'weight-priced lines — amount is kilograms × rate, not boxes × rate',
    lines: [
      line('Beef Mince', '4', '89.00', '890.00', { weight: '2.5', total_kg: '10', unit: 'kg' }),
      line('Chicken Portions', '3', '62.00', '558.00', { weight: '3', total_kg: '9', unit: 'kg' }),
      line('Boxed Lettuce', '4', '89.00', '356.00', { weight: '2.5', total_kg: '10', unit: 'boxes' }),
    ],
    expect: { diagnosis: 'clean', failingRows: [] },
  },
  {
    name: 'a two-line document is never "realigned" on 80% of two lines',
    lines: [line('Apples', '2', '10.00', '25.00'), line('Bananas', '3', '5.00', '20.00')],
    expect: { diagnosis: 'line_math', shift: null, repaired: false },
  },
  {
    name: 'nothing to check — descriptions only',
    lines: [{ description: 'Apples' }, { description: 'Bananas' }],
    expect: { diagnosis: 'not_enough_data', shift: null, confidenceCap: null, repaired: false },
  },
];

for (const c of CASES) {
  test(`auditLines: ${c.name}`, () => {
    const audit = auditLines({ lines: c.lines, total: c.total });
    assert.equal(audit.diagnosis, c.expect.diagnosis, 'diagnosis');
    if (c.expect.shift !== undefined) assert.deepEqual(audit.shift, c.expect.shift, 'shift');
    if (c.expect.failingRows) assert.deepEqual(audit.failingRows, c.expect.failingRows, 'failingRows');
    if (c.expect.confidenceCap !== undefined) assert.equal(audit.confidenceCap, c.expect.confidenceCap, 'confidenceCap');
    if (c.expect.repaired !== undefined) assert.equal(audit.repaired != null, c.expect.repaired, 'repaired');
    if (c.expect.totalBasis) assert.equal(audit.totalCheck.basis, c.expect.totalBasis, 'totalCheck.basis');
  });
}

test('a unified shift repairs to the clean values and reports the orphan pair', () => {
  const audit = auditLines({ lines: UNIFIED_SHIFT, total: CLEAN_FIVE_TOTAL });
  const repaired = audit.repaired!;
  repaired.forEach((l, i) => {
    assert.equal(l.unit_price, CLEAN_FIVE[i].unit_price, `row ${i + 1} unit price`);
    assert.equal(l.amount, CLEAN_FIVE[i].amount, `row ${i + 1} amount`);
  });
  assert.deepEqual(audit.orphans, [{ index: 0, unit_price: '99.00', amount: '999.00' }]);
  assert.equal(audit.totalCheck.basis, 'match');
  assert.equal(describeShift(audit.shift!), '+1 row');
});

test('the repair never touches descriptions or quantities', () => {
  const audit = auditLines({ lines: EXTRACTED, total: PAPER_TOTAL });
  audit.repaired!.forEach((l, i) => {
    assert.equal(l.description, EXTRACTED[i].description);
    assert.equal(l.quantity, EXTRACTED[i].quantity);
  });
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

const TOLERANCE_CASES: { expected: number; actual: number; ok: boolean }[] = [
  { expected: 127.5, actual: 127.5, ok: true },
  { expected: 127.5, actual: 127.51, ok: true }, // within a cent
  { expected: 10000, actual: 10040, ok: true }, // within 0.5%
  { expected: 100, actual: 101, ok: false }, // 1% off, and more than a cent
  { expected: 449.5, actual: 60.85, ok: false }, // Broccoli, as extracted
  { expected: 0, actual: 0, ok: true },
];

for (const c of TOLERANCE_CASES) {
  test(`moneyMatches(${c.expected}, ${c.actual}) === ${c.ok}`, () => {
    assert.equal(moneyMatches(c.expected, c.actual), c.ok);
  });
}

test('auditLine reads Rand formatting and reports the basis', () => {
  const ok = auditLine({ description: 'Potato-Chipped', quantity: '10', unit_price: 'R 34.90', amount: 'R 349.00' }, 6);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.basis, 'quantity');
  assert.equal(ok.row, 7);

  const bad = auditLine({ description: 'Broccoli-Florets', quantity: '5', unit_price: '89.90', amount: '60.85' }, 10);
  assert.equal(bad.status, 'mismatch');
  assert.equal(bad.expected, 449.5);
  assert.equal(bad.actual, 60.85);

  const skip = auditLine({ description: 'Carrots-Grated', quantity: '5' }, 0);
  assert.equal(skip.status, 'unchecked');
});

test('applyShift pulls the columns from the offset row and leaves the tail empty', () => {
  const shifted = applyShift(CLEAN_FIVE, { unit_price: 1, amount: 1 });
  assert.equal(shifted[0].unit_price, CLEAN_FIVE[1].unit_price);
  assert.equal(shifted[4].unit_price, '');
  assert.equal(shifted[0].description, CLEAN_FIVE[0].description);
});

test('checkTotal is VAT-aware in both directions', () => {
  assert.equal(checkTotal(100, 100).basis, 'match');
  assert.equal(checkTotal(100, 115).basis, 'match_incl_vat');
  assert.equal(checkTotal(100, 140).basis, 'mismatch');
  assert.equal(checkTotal(100, null).basis, 'unknown');
});
