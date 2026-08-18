#!/usr/bin/env node
/**
 * demo-invoice-pdfs.mjs — render the Meridian demo's paper.
 *
 * WHY THIS EXISTS
 *   Every `documents` row in `supabase/demo-all-in-one.sql` and
 *   `supabase/demo-refresh-2026-08.sql` carries a `storage_path` of
 *   `demo/docu/<filename>` — but no object was ever uploaded to that path. So
 *   `app/app/docu/[id]/page.tsx:80` calls
 *   `supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600)`
 *   for a key that does not exist, and Doc-U's preview pane 404s on every seed
 *   document. Extracted fields and line items still render (they come out of
 *   `extracted_data`), but the demo's whole promise is "with the invoice to
 *   prove it", and an empty preview undercuts the sentence.
 *
 *   This script generates one-page PDFs whose CONTENT IS PARSED OUT OF THE SEED
 *   FILES THEMSELVES, so the paper and the extraction cannot disagree. Nothing
 *   is typed twice: supplier name, town and e-mail come from the seed's
 *   `suppliers` rows; invoice number, date, VAT, totals and every line item come
 *   from that document's own `extracted_data`.
 *
 * WHAT IT DOES NOT DO
 *   It does not upload anything. Supabase Storage writes need a service-role key
 *   this repo deliberately does not carry locally (`.ai/plan_demo_mvp_finch.md`
 *   §2 blocker 9). Josh drops the folder into the dashboard by hand — see
 *   `docs/demo-runbook.md` §"Uploading the demo PDFs".
 *
 * USAGE
 *   # pdfkit is NOT a dependency of this repo and must not become one.
 *   npm --prefix /tmp/pdfgen install pdfkit
 *   node scripts/demo-invoice-pdfs.mjs --pdfkit /tmp/pdfgen --out /tmp/demo-pdfs
 *
 *   --pdfkit <dir>   directory containing node_modules/pdfkit (or set PDFKIT_PREFIX).
 *                    Omit it if pdfkit happens to resolve normally.
 *   --out <dir>      output directory (default ./demo-pdfs). Created if absent.
 *   --only <a,b>     render only these seed counters, e.g. --only 1,2,3,901
 *   --list           print what would be rendered and exit.
 *
 * OUTPUT FILENAMES ARE THE SEED'S `filename` VALUES, BYTE FOR BYTE. That is the
 * whole contract: `storage_path` is `'demo/docu/' || filename`, so a rename here
 * is a 404 there.
 */

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const SEED_FILES = [
  join(REPO, 'supabase', 'demo-all-in-one.sql'),
  join(REPO, 'supabase', 'demo-refresh-2026-08.sql'),
];

/* The bill-to. `organisations` row, demo-all-in-one.sql §0.2. */
const ORG = { name: 'Meridian Food Co.', location: 'Stellenbosch, Western Cape' };

/* ─────────────────────────────────────────────────────────────────────────────
   CLI
   ────────────────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = { pdfkit: process.env.PDFKIT_PREFIX ?? null, out: 'demo-pdfs', only: null, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--pdfkit') out.pdfkit = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--only') out.only = new Set(argv[++i].split(',').map((s) => Number(s.trim())));
    else if (a === '--list') out.list = true;
    else if (a === '--help' || a === '-h') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

async function loadPDFKit(prefix) {
  const attempts = [];
  if (prefix) attempts.push(join(resolve(prefix), 'node_modules', 'pdfkit'));
  attempts.push('pdfkit');
  for (const spec of attempts) {
    try {
      const require = createRequire(import.meta.url);
      const resolved = require.resolve(spec, { paths: [REPO, process.cwd()] });
      const mod = await import(`file://${resolved}`);
      return mod.default ?? mod;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    'pdfkit could not be resolved. It is deliberately NOT a dependency of this repo.\n' +
      '  npm --prefix /tmp/pdfgen install pdfkit\n' +
      '  node scripts/demo-invoice-pdfs.mjs --pdfkit /tmp/pdfgen --out /tmp/demo-pdfs',
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Parsing the seed
   ─────────────────────────────────────────────────────────────────────────────
   Both files insert documents from a `values` list whose rows are two lines:

     ( 1, 4, null, null, 'winelands-protein-INV-8814.pdf', 'invoice', 'reviewed', 94,
       '{"supplier":…,"fields":[…],"line_items":[…]}',
       '', null, null, '2026-06-05T07:35:00+02'),

   The jsonb literal is always on its own line and contains no apostrophes, so a
   single-quoted-string match is safe. `''` is unescaped anyway, in case a future
   line item ever carries one.
   ────────────────────────────────────────────────────────────────────────── */

const NULLABLE = String.raw`(?:\d+|null(?:::int)?)`;

const DOC_ROW = new RegExp(
  String.raw`\(\s*(\d+),\s*(${NULLABLE}),\s*${NULLABLE},\s*${NULLABLE},\s*` +
    String.raw`'([^'\n]+)',\s*'([a-z_]+)',\s*'([a-z]+)',\s*${NULLABLE},\s*\r?\n` +
    String.raw`\s*'(\{[^\n]*\})',`,
  'g',
);

const SUPPLIER_ROW = /\(\s*(\d+),\s*'([^']+)',\s*'[A-Z]{2}',\s*'([^']+)',\s*'([^']+)'\)/g;

function unq(sql) {
  return sql.replace(/''/g, "'");
}

function parseSuppliers(sqlText) {
  const start = sqlText.indexOf('insert into suppliers (id, org_id, name, initials, location, contact_email)');
  if (start < 0) throw new Error('suppliers insert not found in demo-all-in-one.sql');
  const block = sqlText.slice(start, sqlText.indexOf('as v(n, name, initials, location, contact_email)', start));
  const byId = new Map();
  for (const m of block.matchAll(SUPPLIER_ROW)) {
    byId.set(Number(m[1]), { name: unq(m[2]), location: unq(m[3]), email: unq(m[4]) });
  }
  if (byId.size === 0) throw new Error('no supplier rows parsed');
  return byId;
}

function parseDocuments(sqlText) {
  const rows = [];
  for (const m of sqlText.matchAll(DOC_ROW)) {
    const [, n, sup, filename, docType, status, json] = m;
    let extracted;
    try {
      extracted = JSON.parse(unq(json));
    } catch (err) {
      throw new Error(`document ${n} (${filename}): extracted_data is not valid JSON — ${err.message}`);
    }
    rows.push({
      n: Number(n),
      supplierId: /^\d+$/.test(sup) ? Number(sup) : null,
      filename,
      docType,
      status,
      extracted,
    });
  }
  return rows;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shaping
   ────────────────────────────────────────────────────────────────────────── */

const fieldOf = (doc, label) =>
  (doc.extracted.fields ?? []).find((f) => f.label.toLowerCase() === label.toLowerCase())?.value ?? null;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * `1234567.5` → `"1 234 567.50"`. Hand-rolled rather than `toLocaleString`,
 * because en-ZA formats the DECIMAL separator as a comma and the thousands
 * separator as a space — and the app renders rands with a decimal point
 * throughout, so a locale-formatted PDF would disagree with the screen beside it.
 */
const plain = (v) => {
  if (v === null || v === undefined) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
};

const rands = (v) =>
  v === null || v === undefined ? '' : `${v < 0 ? '-' : ''}R ${plain(Math.abs(v))}`;

/** "2026-06-05" → "05 June 2026". Anything unparseable is passed through. */
function longDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * A document's reference number and date, whatever kind it is. The labels are
 * the seed's own; `resolveDocumentDate()` in lib/platform/price-watch/run.ts
 * matches "Invoice date" first for an invoice, so that is the order here too.
 */
function reference(doc) {
  const kind = doc.docType;
  if (kind === 'invoice') {
    return { title: 'TAX INVOICE', ref: fieldOf(doc, 'Invoice number'), refLabel: 'Invoice no.', date: fieldOf(doc, 'Invoice date') };
  }
  if (kind === 'delivery_note') {
    return { title: 'DELIVERY NOTE', ref: fieldOf(doc, 'Delivery note'), refLabel: 'Note no.', date: fieldOf(doc, 'Delivery date') };
  }
  if (kind === 'statement') {
    const summary = doc.extracted.summary ?? {};
    return {
      title: 'SUPPLIER STATEMENT',
      ref: fieldOf(doc, 'Statement period'),
      refLabel: 'Period',
      date: summary.statement_date ?? null,
    };
  }
  if (kind === 'price_list') {
    return {
      title: 'PRICE LIST',
      ref: longDate(fieldOf(doc, 'Valid until')),
      refLabel: 'Valid until',
      date: fieldOf(doc, 'Effective date'),
    };
  }
  if (kind === 'order') {
    return { title: 'PURCHASE ORDER', ref: null, refLabel: 'Order no.', date: fieldOf(doc, 'Order date') };
  }
  return { title: kind.replace(/_/g, ' ').toUpperCase(), ref: null, refLabel: '', date: null };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Drawing
   ─────────────────────────────────────────────────────────────────────────────
   One A4 page, no logos, no colour beyond a near-black ink and two greys. The
   layout is the same for every kind so a prospect flipping through Doc-U reads
   one supplier's filing cabinet, not five design exercises.
   ────────────────────────────────────────────────────────────────────────── */

const INK = '#14181D';
const MUTED = '#6B7480';
const RULE = '#D8DDE3';
const M = 48;                 // page margin
const W = 595.28 - M * 2;     // usable width

function hr(d, y, color = RULE, weight = 0.6) {
  d.save().lineWidth(weight).strokeColor(color).moveTo(M, y).lineTo(M + W, y).stroke().restore();
}

function header(d, doc, supplier) {
  const { title, ref, refLabel, date } = reference(doc);

  d.fillColor(INK).font('Helvetica-Bold').fontSize(17).text(supplier?.name ?? doc.extracted.supplier ?? 'Supplier', M, M, { width: W * 0.6 });
  let y = d.y + 2;
  d.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  if (supplier?.location) { d.text(supplier.location, M, y, { width: W * 0.6 }); y = d.y; }
  if (supplier?.email) { d.text(supplier.email, M, y, { width: W * 0.6 }); y = d.y; }

  const rx = M + W * 0.55;
  const rw = W * 0.45;
  d.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(title, rx, M + 2, { width: rw, align: 'right', characterSpacing: 1.2 });
  let ry = d.y + 4;
  if (ref) {
    d.font('Helvetica').fontSize(9).fillColor(MUTED).text(`${refLabel}  `, rx, ry, { width: rw, align: 'right', continued: false });
    ry = d.y;
    d.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(String(ref), rx, ry, { width: rw, align: 'right' });
    ry = d.y + 2;
  }
  if (date) {
    d.font('Helvetica').fontSize(9).fillColor(MUTED).text(longDate(date), rx, ry, { width: rw, align: 'right' });
    ry = d.y;
  }

  const bottom = Math.max(y, ry) + 14;
  hr(d, bottom, INK, 1);
  return bottom + 16;
}

function billTo(d, y, label = 'BILLED TO') {
  d.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, M, y, { characterSpacing: 0.8 });
  d.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(ORG.name, M, d.y + 2);
  d.font('Helvetica').fontSize(9).fillColor(MUTED).text(ORG.location, M, d.y + 1);
  return d.y + 20;
}

/**
 * The line-item table. Columns are fixed rather than measured: every seed line
 * item is a short product name, and a fixed grid keeps twenty-two documents
 * looking like one filing system.
 */
function lineTable(d, y, items, { showQty = true, showPrice = true, showAmount = true } = {}) {
  /* Right edges, laid out from the right margin inward: AMOUNT | UNIT PRICE |
     UNIT | QTY | DESCRIPTION. Every column is a fixed width with a 12pt gutter,
     so no two can ever draw over each other regardless of which are switched off. */
  const AMT_W = 86;
  const PRICE_W = 76;
  const UNIT_W = 52;
  const QTY_W = 46;
  const GAP = 12;

  let right = M + W;
  const xAmount = showAmount ? (right -= AMT_W) : null;
  if (showAmount) right -= GAP;
  const xPrice = showPrice ? (right -= PRICE_W) : null;
  if (showPrice) right -= GAP;
  const xUnit = showQty ? (right -= UNIT_W) : null;
  if (showQty) right -= GAP;
  const xQty = showQty ? (right -= QTY_W) : null;
  if (showQty) right -= GAP;
  const descW = right - M - 8;

  d.save().fillColor('#F4F6F8').rect(M, y - 4, W, 18).fill().restore();
  d.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED);
  d.text('DESCRIPTION', M + 4, y + 1, { width: descW, characterSpacing: 0.6 });
  if (showQty) {
    d.text('QTY', xQty, y + 1, { width: QTY_W, align: 'right', characterSpacing: 0.6 });
    d.text('UNIT', xUnit, y + 1, { width: UNIT_W, align: 'left', characterSpacing: 0.6 });
  }
  if (showPrice) d.text('UNIT PRICE', xPrice, y + 1, { width: PRICE_W, align: 'right', characterSpacing: 0.6 });
  if (showAmount) d.text('AMOUNT', xAmount, y + 1, { width: AMT_W, align: 'right', characterSpacing: 0.6 });
  y += 20;

  for (const it of items) {
    const rowTop = y;
    d.font('Helvetica').fontSize(9.5).fillColor(INK).text(it.description ?? '', M + 4, y, { width: descW });
    const rowH = Math.max(d.y - rowTop, 12);
    if (showQty) {
      d.text(it.quantity ? String(it.quantity) : '', xQty, rowTop, { width: QTY_W, align: 'right' });
      d.fillColor(MUTED).text(it.unit ?? '', xUnit, rowTop, { width: UNIT_W, align: 'left' }).fillColor(INK);
    }
    if (showPrice) d.text(plain(num(it.unit_price)), xPrice, rowTop, { width: PRICE_W, align: 'right' });
    if (showAmount) d.text(plain(num(it.amount)), xAmount, rowTop, { width: AMT_W, align: 'right' });
    y = rowTop + rowH + 6;
    hr(d, y - 3);
  }
  return y + 8;
}

/**
 * Totals. `Total (incl. VAT)` and `VAT` are the seed's own fields where they
 * exist; the subtotal is the difference, which is exactly how docs 1-9 and
 * 901-906 were built ("amounts are ex-VAT per line; total = sum x 1.15").
 * A document with neither field gets the lines' own sum and says so by
 * showing only that one row — nothing is grossed up on a guess.
 */
function totals(d, y, doc, items) {
  const stated = num(fieldOf(doc, 'Total (incl. VAT)'));
  const vat = num(fieldOf(doc, 'VAT'));
  const lineSum = items.reduce((acc, it) => acc + (num(it.amount) ?? 0), 0);

  const rows = [];
  if (stated !== null && vat !== null) {
    rows.push(['Subtotal (excl. VAT)', stated - vat], ['VAT', vat], ['Total (incl. VAT)', stated]);
  } else if (stated !== null) {
    rows.push(['Total (incl. VAT)', stated]);
  } else if (lineSum > 0) {
    rows.push(['Total of lines', lineSum]);
  }
  if (rows.length === 0) return y;

  const boxW = 236;
  const boxX = M + W - boxW;
  for (const [label, value] of rows) {
    const last = label.startsWith('Total');
    d.font(last ? 'Helvetica-Bold' : 'Helvetica').fontSize(last ? 11 : 9.5).fillColor(last ? INK : MUTED);
    d.text(label, boxX, y, { width: boxW - 96, align: 'left' });
    d.fillColor(INK).font(last ? 'Helvetica-Bold' : 'Helvetica').text(rands(value), boxX + boxW - 96, y, { width: 96, align: 'right' });
    y = d.y + (last ? 2 : 5);
    if (last) hr(d, y + 2, INK, 1);
  }
  return y + 16;
}

/** The statement summary block — the same keys `extracted_data.summary` carries. */
function statementSummary(d, y, summary) {
  const pairs = [
    ['Opening balance', summary.opening_balance],
    ['Payments received', summary.payments],
    ['Purchases', summary.total_purchases],
    ['Pallet refunds', summary.total_pallet_refunds],
    ['Pallet usage', summary.total_pallet_usage],
    ['Other charges', summary.total_charges],
    ['VAT included', summary.vat],
  ].filter(([, v]) => typeof v === 'number' && v !== 0);

  d.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('ACCOUNT SUMMARY', M, y, { characterSpacing: 0.8 });
  y = d.y + 8;

  const colW = W / 2 - 12;
  let col = 0;
  let rowY = y;
  for (const [label, value] of pairs) {
    const x = M + col * (colW + 24);
    d.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, x, rowY, { width: colW - 92, align: 'left' });
    d.fillColor(INK).text(rands(value), x + colW - 92, rowY, { width: 92, align: 'right' });
    if (col === 1) rowY = d.y + 4;
    col = col === 0 ? 1 : 0;
  }
  if (col === 1) rowY = d.y + 4;

  hr(d, rowY + 4, INK, 1);
  rowY += 12;
  d.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Closing balance', M, rowY, { width: W - 130, align: 'left' });
  d.text(rands(summary.closing_balance), M + W - 130, rowY, { width: 130, align: 'right' });
  return d.y + 22;
}

function footer(d, doc) {
  const y = 841.89 - M - 22;
  hr(d, y);
  d.font('Helvetica').fontSize(7).fillColor(MUTED);
  d.text(`${doc.filename}`, M, y + 6, { width: W * 0.6 });
  d.text('Demonstration data — Meridian Food Co. is a sample organisation.', M + W * 0.4, y + 6, {
    width: W * 0.6,
    align: 'right',
  });
}

function render(PDFDocument, doc, supplier) {
  /* An `order` document came IN from a customer, so the letterhead is theirs and
     Meridian is the one being ordered from. Everything else is a supplier's
     paper addressed to Meridian. */
  const inbound = doc.docType === 'order';
  const entity = supplier ?? (inbound && doc.extracted.customer_name ? { name: doc.extracted.customer_name } : null);

  const d = new PDFDocument({ size: 'A4', margin: M, info: { Title: doc.filename, Author: entity?.name ?? 'Unknown' } });
  const chunks = [];
  d.on('data', (c) => chunks.push(c));
  const done = new Promise((res) => d.on('end', () => res(Buffer.concat(chunks))));

  const TO_LABEL = {
    order: 'ORDERED FROM',
    statement: 'STATEMENT FOR',
    price_list: 'PREPARED FOR',
    delivery_note: 'DELIVERED TO',
  };

  let y = header(d, doc, entity);
  y = billTo(d, y, TO_LABEL[doc.docType] ?? 'BILLED TO');

  const items = doc.extracted.line_items ?? [];
  const summary = doc.extracted.summary;

  if (doc.docType === 'statement' && summary) {
    y = statementSummary(d, y, summary);
    if (items.length) {
      d.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('ACTIVITY THIS PERIOD', M, y, { characterSpacing: 0.8 });
      y = lineTable(d, d.y + 8, items);
    }
  } else if (doc.docType === 'price_list') {
    y = lineTable(d, y, items, { showQty: false, showAmount: false });
    d.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Prices exclude VAT and are held for the period shown above.', M, y);
  } else if (doc.docType === 'order') {
    y = lineTable(d, y, items, { showPrice: false, showAmount: false });
    d.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Quantities only — please invoice at our agreed account prices.', M, y);
  } else if (doc.docType === 'delivery_note') {
    y = lineTable(d, y, items, { showPrice: false, showAmount: false });
    const extras = (doc.extracted.fields ?? []).filter((f) => /cold chain|signed by|linked invoice/i.test(f.label));
    for (const f of extras) {
      d.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`${f.label}: `, M, y, { continued: true }).fillColor(INK).text(f.value);
      y = d.y + 2;
    }
    d.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Quantities only — this note carries no prices.', M, y + 6);
  } else {
    y = lineTable(d, y, items);
    y = totals(d, y, doc, items);
    const terms = supplier ? 'Payment strictly per agreed account terms. Queries to the address above.' : null;
    if (terms) d.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(terms, M, y, { width: W * 0.72 });
  }

  footer(d, doc);
  d.end();
  return done;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Selection
   ─────────────────────────────────────────────────────────────────────────────
   Everything the demo can put on screen as a PDF. Deliberately excluded:
     • docs 32 and 34 — `.jpg`, and `app/app/docu/[id]/page.tsx` picks <img> vs
       <iframe> off the filename extension, so a PDF wearing a .jpg name renders
       as a broken image. They need photographs, not this script.
     • doc 23 — `pending`, `fields: []`, no line items. There is nothing true to
       print on it.
   Doc 29 is the one row whose body is not its own: it is `pending` with no
   extracted_data, and a Q3 price list with an empty table would read as a bug.
   Its lines are Bergriver's own unit prices off document 10 (the July invoice),
   so every figure on it is still a Meridian row.
   ────────────────────────────────────────────────────────────────────────── */

const SKIP = new Set([23, 32, 34]);

function withDerivedPriceList(docs) {
  const doc29 = docs.find((r) => r.n === 29);
  const doc10 = docs.find((r) => r.n === 10);
  if (!doc29 || !doc10) return docs;
  doc29.extracted = {
    supplier: doc29.extracted.supplier,
    fields: [
      { label: 'Effective date', value: '2026-07-01' },
      { label: 'Valid until', value: '2026-09-30' },
    ],
    line_items: (doc10.extracted.line_items ?? []).map((it) => ({
      description: it.description,
      unit: it.unit,
      unit_price: it.unit_price,
    })),
    derived_from_document: 10,
  };
  return docs;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────────────────── */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const seedText = readFileSync(SEED_FILES[0], 'utf8');
  const suppliers = parseSuppliers(seedText);

  let docs = [];
  for (const file of SEED_FILES) docs = docs.concat(parseDocuments(readFileSync(file, 'utf8')));
  docs = withDerivedPriceList(docs);

  let selected = docs
    .filter((r) => r.filename.endsWith('.pdf'))
    .filter((r) => !SKIP.has(r.n))
    .filter((r) => (r.extracted.line_items?.length ?? 0) > 0 || r.extracted.summary);
  if (args.only) selected = selected.filter((r) => args.only.has(r.n));
  selected.sort((a, b) => a.n - b.n);

  if (selected.length === 0) throw new Error('nothing selected — check --only, or the seed parser');

  if (args.list) {
    for (const r of selected) {
      console.log(`${String(r.n).padStart(3)}  ${r.docType.padEnd(14)} ${r.status.padEnd(9)} ${r.filename}`);
    }
    console.log(`\n${selected.length} document(s).`);
    return;
  }

  const PDFDocument = await loadPDFKit(args.pdfkit);
  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });

  let bytes = 0;
  for (const doc of selected) {
    const supplier = doc.supplierId ? suppliers.get(doc.supplierId) : null;
    const buf = await render(PDFDocument, doc, supplier);
    writeFileSync(join(outDir, doc.filename), buf);
    bytes += buf.length;
    console.log(`${String(doc.n).padStart(3)}  ${doc.filename}  ${(buf.length / 1024).toFixed(1)} kB`);
  }
  console.log(`\n${selected.length} PDFs → ${outDir}  (${(bytes / 1024).toFixed(0)} kB total)`);
  console.log('Upload them into the `documents` bucket under the folder path `demo/docu/` — see docs/demo-runbook.md.');
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
