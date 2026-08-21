#!/usr/bin/env node
/**
 * extraction-bench.mjs — measure the ORDER reader instead of arguing about it.
 *
 * WHY THIS EXISTS
 *   Turn 'n Slice reported that order extraction had been "near perfect on any
 *   document, handwritten or printed" and then, across one day of changes,
 *   started garbling names and digits DIFFERENTLY ON EVERY RUN. Three things
 *   moved in that day and each has a plausible story:
 *
 *     1. the MODEL. Order reads left `claude-haiku-4-5` for `claude-sonnet-4-6`
 *        (129456b) and then for `gpt-5.6-luna` (02a25ef). The model that was
 *        good is the one nobody has run since.
 *     2. the PROMPT. `raw_description` (129456b), `raw_amount` + "TRANSCRIBE,
 *        DO NOT INTERPRET — never substitute an expected word" (12ff849), and
 *        `bulk_quantity`/`unit_quantity` + the two-column clause (02a25ef). A
 *        reader forbidden from using a prior is a reader that cannot repair a
 *        smudged glyph, which is the whole trick on a phone photo.
 *     3. the OUTPUT SIZE. Five fields per line became ten, on a 22-line
 *        document, under a ceiling that went 4000 → 8000 on the Anthropic path.
 *
 *   Every one of those is testable and none of them is obvious, so this file
 *   tests them. It runs the SAME images through named variants — a prompt
 *   crossed with a model — twice each, and scores what actually comes back:
 *   product names, digits, row count, and how much a variant agrees with
 *   ITSELF between two runs, which is the symptom Josh actually reported.
 *
 * THE PRE-YESTERDAY PROMPT IS NOT COPY-PASTED HERE.
 *   It is recovered at run time out of `git show 28c1da2^:lib/ai/anthropic.ts`.
 *   A transcribed copy of the thing under test is a copy that drifts, and the
 *   one question this harness exists to answer is "was the old one better?" —
 *   which a paraphrase cannot answer. Likewise the CURRENT prompt is imported
 *   from `lib/ai/order-prompt.ts` itself (it is pure and type-only-importing
 *   precisely so a plain node script can load it).
 *
 * THE IMAGES
 *   `--images <dir>` runs any directory of jpg/png. It defaults to
 *   `~/Desktop/bakubung` WHEN THAT EXISTS — Josh is dropping the real photos
 *   there — and otherwise to a SYNTHETIC degraded page this script renders
 *   itself: the ground-truth fixture laid out as a NebulaPOS-style purchase
 *   order, screenshotted with headless Chrome, rotated ~2°, downscaled and
 *   JPEG-crushed to imitate a phone photo. Synthetic paper is a weaker test
 *   than real paper and says so in the output; it is here so the bench runs
 *   NOW rather than after the photos arrive.
 *
 * USAGE
 *   node scripts/extraction-bench.mjs --make-image          # render all levels
 *   node scripts/extraction-bench.mjs                       # full bench, N=2
 *   node scripts/extraction-bench.mjs --variants pre-haiku,head-sonnet --runs 1
 *   node scripts/extraction-bench.mjs --images ~/Desktop/bakubung
 *   node scripts/extraction-bench.mjs --list
 *
 *   --runs <n>        runs per variant (default 2 — nondeterminism needs ≥2)
 *   --degrade <lvl>   synthetic difficulty: light | heavy | brutal (default heavy).
 *                     At `light` every current variant ties at 100% and the bench
 *                     tells you nothing — see the DEGRADE table below.
 *   --variants <a,b>  variant ids (default: all)
 *   --images <dir>    directory of order images
 *   --out <dir>       where renders and raw responses land (default .bench/)
 *   --no-catalogue    omit the org's product list from the prompt
 *   --list            print the variants and exit
 *
 * KEYS come from the environment or from `.env.local` (ANTHROPIC_API_KEY,
 * OPENAI_API_KEY). Values are never printed — only whether a name was found.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

/* ─────────────────────────────────────────────────────────────────────────────
   The ground truth
   ────────────────────────────────────────────────────────────────────────────

   The Bakubung Bush Lodge → Turn 'n Slice purchase order, 22 lines, as
   reconstructed from the three test suites that already carry pieces of it:
   `tests/docu-order-line-match.test.ts` (eighteen paper lines, verbatim raw
   descriptions and the four that were mis-resolved), `tests/docu-row-arithmetic
   .test.ts` (the avocado / pineapple / cucumber two-column rows with their
   printed netts) and `tests/docu-order-line-totals.test.ts` (Apples Top Red at
   569.90, the digit the reader turned into 560.90).

   `bulk`/`each` are the document's TWO quantity columns; `cost` is per EACH
   where an each column exists and per BULK otherwise, and `nett` is what the
   paper prints — the row's own arithmetic has to close, because the amount
   column cross-check is one of the things under test.                        */

const GROUND_TRUTH = [
  { raw: 'FF - APPLES TOP RED BOX',      bulk: '1',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '569.90', nett: '569.90' },
  { raw: 'FF - AVOCADO BOX',             bulk: '4',  bulkUnit: 'Box',    each: '48', eachUnit: 'Each', cost: '15.75',  nett: '756.00' },
  { raw: 'FF - GRAPES WHITE BOX',        bulk: '2',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '659.00', nett: '1318.00' },
  { raw: 'FF - GRAPES BLACK BOX',        bulk: '2',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '659.00', nett: '1318.00' },
  { raw: 'FF - STRAWBERRIES PKT',        bulk: '20', bulkUnit: 'Pkt',    each: '',   eachUnit: '',     cost: '29.90',  nett: '598.00' },
  { raw: 'FF - BANANAS BOX',             bulk: '2',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '189.00', nett: '378.00' },
  { raw: 'FF - NAARTJIES BOX',           bulk: '1',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '145.50', nett: '145.50' },
  { raw: 'FF - PINEAPPLE BOX',           bulk: '3',  bulkUnit: 'Box',    each: '18', eachUnit: 'Each', cost: '24.83',  nett: '446.94' },
  { raw: 'VEG - MIX VEGETABLES 2 PKT',   bulk: '2',  bulkUnit: 'Pkt',    each: '',   eachUnit: '',     cost: '88.00',  nett: '176.00' },
  { raw: 'VEG - CAULIFLOWER',            bulk: '25', bulkUnit: 'Each',   each: '',   eachUnit: '',     cost: '30.90',  nett: '772.50' },
  { raw: 'VEG - SWEET CORN',             bulk: '15', bulkUnit: 'Punnet', each: '',   eachUnit: '',     cost: '46.40',  nett: '696.00' },
  { raw: 'VEG - PATTY PAN YELLOW',       bulk: '20', bulkUnit: 'Punnet', each: '',   eachUnit: '',     cost: '23.50',  nett: '470.00' },
  { raw: 'VEG - PEPPERS GREEN',          bulk: '3',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '210.00', nett: '630.00' },
  { raw: 'VEG - PEPPERS RED',            bulk: '2',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '245.00', nett: '490.00' },
  { raw: 'VEG - PEPPERS YELLOW',         bulk: '2',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '245.00', nett: '490.00' },
  { raw: 'VEG - BABY MARROW',            bulk: '4',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '165.00', nett: '660.00' },
  { raw: 'VEG - TOMATOES ROUND',         bulk: '6',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '132.00', nett: '792.00' },
  { raw: 'VEG - BUTTERNUT WHOLE',        bulk: '3',  bulkUnit: 'Box',    each: '',   eachUnit: '',     cost: '98.00',  nett: '294.00' },
  { raw: 'VEG - BUTTERNUT CUBED PKT',    bulk: '10', bulkUnit: 'Pkt',    each: '',   eachUnit: '',     cost: '32.50',  nett: '325.00' },
  { raw: 'VEG - LETTUCE ICEBERG',        bulk: '8',  bulkUnit: 'Each',   each: '',   eachUnit: '',     cost: '18.90',  nett: '151.20' },
  { raw: 'VEG - CUCUMBER BOX',           bulk: '4',  bulkUnit: 'Box',    each: '60', eachUnit: 'Each', cost: '22.90',  nett: '1374.00' },
  { raw: 'VEG - TOMATO-YELLOW COCKTAIL', bulk: '12', bulkUnit: 'Punnet', each: '',   eachUnit: '',     cost: '27.40',  nett: '328.80' },
];

const GROUND_TRUTH_CUSTOMER = 'Bakubung Bush Lodge';

/** Turn 'n Slice's catalogue as the failing lines found it — see docu-order-line-match.test.ts. */
const CATALOGUE = [
  'Apples Top Red', 'Avocado (box)', 'Grapes White', 'Grapes Black', 'Strawberries',
  'Cabbage', 'Cauliflower', 'Baby Sweet Corn', 'Tomato-Yellow Cocktail', 'Patty Pan',
  'Peppers Green', 'Peppers Red', 'Peppers Yellow', 'Naartjies', 'Baby Marrow',
  'Tomatoes Round', 'Butternut Whole', 'Butternut Cubed', 'Bananas', 'Lettuce Iceberg',
  'Pineapple', 'Cucumber', 'Mixed Vegetables', 'Broccoli', 'Tomatoes Cocktail',
];

/* ─────────────────────────────────────────────────────────────────────────────
   CLI + environment
   ────────────────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = {
    runs: 2, variants: null, images: null, out: join(REPO, '.bench'),
    makeImage: false, list: false, catalogue: true, degrade: 'heavy',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--degrade') out.degrade = argv[++i];
    else if (a === '--out') out.out = resolve(argv[++i]);
    else if (a === '--runs') out.runs = Number(argv[++i]);
    else if (a === '--variants') out.variants = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--images') out.images = argv[++i];
    else if (a === '--make-image') out.makeImage = true;
    else if (a === '--no-catalogue') out.catalogue = false;
    else if (a === '--list') out.list = true;
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

/**
 * Load `.env.local` into `process.env` without overwriting anything already set.
 *
 * Deliberately minimal, and deliberately silent about values: this file prints
 * a lot and a key that leaks into a bench table is a key that leaks into a
 * commit. Only the NAMES are ever reported.
 */
function loadEnvLocal() {
  const path = join(REPO, '.env.local');
  if (!existsSync(path)) return [];
  const names = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, name, rawValue] = m;
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (!process.env[name]) process.env[name] = value;
    names.push(name);
  }
  return names;
}

/* ─────────────────────────────────────────────────────────────────────────────
   The synthetic page
   ────────────────────────────────────────────────────────────────────────────

   Rendered, then DEGRADED, AT A CHOSEN LEVEL.

   The first run of this bench taught the lesson the hard way: at `light` every
   variant but the pre-yesterday one scored 100% on both names and digits, which
   measures nothing at all. A crisp render of an HTML table is a document every
   model reads perfectly, and a bench where everything ties cannot name a winner.

   So degradation is a DIAL, and the interesting reading is taken where glyphs
   are genuinely ambiguous — which is the only condition under which "use your
   priors" and "never substitute an expected word" can possibly differ. Below
   that threshold the two prompts are the same prompt.

     light   what a good scan looks like. A control; expect ties.
     heavy   a phone photo across a kitchen counter. THE DEFAULT.
     brutal  a photo of a photocopy, held at arm's length.

   Each level is the same four physical effects at increasing strength — lens
   blur, lost contrast, rotation, and a JPEG crush after a downscale — because
   those are what a phone actually does to a printed page.                    */

const DEGRADE = {
  light:  { blur: 0.45, contrast: 0.90, rotate: -1.2, scale: 0.97, width: 950, quality: 38 },
  heavy:  { blur: 1.05, contrast: 0.72, rotate: -1.9, scale: 0.95, width: 690, quality: 22 },
  brutal: { blur: 1.55, contrast: 0.60, rotate: -2.6, scale: 0.93, width: 540, quality: 14 },
};

function pageHtml(level) {
  const d = DEGRADE[level];
  if (!d) throw new Error(`Unknown degrade level "${level}". Use ${Object.keys(DEGRADE).join(' | ')}.`);
  const rows = GROUND_TRUTH.map((r, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td class="d">${r.raw}</td>
      <td class="q">${r.bulk}</td>
      <td class="u">${r.bulkUnit}</td>
      <td class="q">${r.each}</td>
      <td class="u">${r.eachUnit}</td>
      <td class="m">${r.cost}</td>
      <td class="m">${r.nett}</td>
    </tr>`).join('');
  const total = GROUND_TRUTH.reduce((s, r) => s + Number(r.nett), 0).toFixed(2);
  const vat = (Number(total) * 0.15).toFixed(2);
  const gross = (Number(total) + Number(vat)).toFixed(2);

  return `<!doctype html><meta charset="utf-8">
<style>
  html { background: #6b6a66; }
  body { margin: 0; padding: 46px 60px; font-family: "Helvetica Neue", Arial, sans-serif; }
  /* The photo geometry: a slight rotation and a whisper of blur, applied to the
     paper rather than to the pixels, so the glyph edges degrade the way a lens
     degrades them rather than the way a resampler does. */
  .paper {
    background: #f4f1e9; color: #23211d; padding: 40px 44px;
    transform: rotate(${d.rotate}deg) scale(${d.scale}); transform-origin: 50% 50%;
    filter: blur(${d.blur}px) contrast(${d.contrast}) brightness(1.04);
    box-shadow: 0 10px 40px rgba(0,0,0,.45);
  }
  /* The uneven light of a hand-held photo: one corner of the page brighter
     than the other. It is what makes a digit at the dark end genuinely
     ambiguous rather than merely small. */
  .paper::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(118deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 38%, rgba(40,36,30,.16) 100%);
  }
  .wrap { position: relative; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: .4px; }
  .sub { font-size: 12px; color: #4a463f; margin: 0 0 3px; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; margin: 18px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; border-bottom: 1.4px solid #23211d; padding: 5px 6px; font-size: 11px; letter-spacing: .3px; }
  td { padding: 4.2px 6px; border-bottom: .6px solid #b9b3a6; }
  .n { width: 22px; color: #5a564d; }
  .q, .m { text-align: right; font-variant-numeric: tabular-nums; }
  .m { width: 74px; }
  .q { width: 40px; }
  .u { width: 54px; }
  tfoot td { border: 0; padding-top: 7px; font-size: 12.5px; text-align: right; }
  tfoot .lbl { text-align: right; color: #4a463f; }
</style>
<div class="paper" style="position:relative">
  <h1>BAKUBUNG BUSH LODGE</h1>
  <p class="sub">Pilanesberg, North West &middot; VAT 4180288***</p>
  <p class="sub"><strong>PURCHASE ORDER</strong> &nbsp; No. PO-44127</p>
  <div class="meta">
    <div><strong>Order From:</strong> Bakubung Bush Lodge</div>
    <div><strong>Deliver To:</strong> Turn 'n Slice</div>
    <div><strong>Date:</strong> 2026-08-20</div>
  </div>
  <table>
    <thead><tr>
      <th></th><th>Description</th><th class="q">Qty</th><th>Unit</th>
      <th class="q">Qty</th><th>Unit</th><th class="m">Unit Cost</th><th class="m">Nett</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="6"></td><td class="lbl">Subtotal</td><td class="m">${total}</td></tr>
      <tr><td colspan="6"></td><td class="lbl">VAT 15%</td><td class="m">${vat}</td></tr>
      <tr><td colspan="6"></td><td class="lbl"><strong>Total</strong></td><td class="m"><strong>${gross}</strong></td></tr>
    </tfoot>
  </table>
</div>`;
}

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  process.env.CHROME_PATH,
].filter(Boolean);

function chromeBinary() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error(`No headless Chrome found. Set CHROME_PATH. Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}`);
  return found;
}

/** Render the fixture, degrade it, return the path of the JPEG a model will see. */
function makeSyntheticImage(outDirRaw, level) {
  const d = DEGRADE[level];
  if (!d) throw new Error(`Unknown degrade level "${level}". Use ${Object.keys(DEGRADE).join(' | ')}.`);
  // ABSOLUTE, always. A relative `--out` produced `file://.bench/page.html`,
  // which Chrome resolves as a HOST — it screenshotted its own ERR_INVALID_URL
  // page and every variant scored zero on a bench of Chrome's error screen.
  // The reader said so in plain English, which is the only reason it was caught.
  const outDir = resolve(outDirRaw);
  mkdirSync(outDir, { recursive: true });
  const html = join(outDir, `bakubung-${level}.html`);
  const png = join(outDir, `bakubung-${level}.png`);
  const jpg = join(outDir, `bakubung-${level}.jpg`);
  writeFileSync(html, pageHtml(level));

  execFileSync(chromeBinary(), [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    // 2× first, so the downscale below has real detail to destroy rather than
    // upscaled mush — a phone photographs more pixels than it keeps, too.
    // The window is sized to the paper, not to a page: dead grey below the
    // table survives the downscale as pixels the model pays for and learns
    // nothing from, and it steals resolution from the only part that matters.
    '--force-device-scale-factor=2', '--window-size=1100,830',
    `--screenshot=${png}`, `file://${html}`,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  // Downscale to roughly what an order photo arrives as, then JPEG-crush it.
  // `sips` ships with macOS, so this adds no dependency to a repo that has
  // deliberately kept image tooling out of it (see scripts/demo-invoice-pdfs.mjs).
  execFileSync('/usr/bin/sips', [
    '-Z', String(d.width), png, '--out', jpg, '-s', 'format', 'jpeg', '-s', 'formatOptions', String(d.quality),
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  return jpg;
}

/* ─────────────────────────────────────────────────────────────────────────────
   The prompts
   ────────────────────────────────────────────────────────────────────────── */

/**
 * The PRE-yesterday order prompt, recovered from git rather than retyped.
 *
 * `28c1da2` is the last commit before the day's changes; its parent therefore
 * holds the reader Turn 'n Slice describes as near perfect. The instruction was
 * a plain template literal with no interpolation, so slicing it out of the file
 * is exact.
 */
function preInstruction() {
  const source = execFileSync('git', ['show', '28c1da2^:lib/ai/anthropic.ts'], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  const open = 'const ORDER_EXTRACT_INSTRUCTION = `';
  const start = source.indexOf(open);
  if (start === -1) throw new Error('ORDER_EXTRACT_INSTRUCTION not found at 28c1da2^');
  const from = start + open.length;
  const end = source.indexOf('`;', from);
  if (end === -1) throw new Error('unterminated ORDER_EXTRACT_INSTRUCTION at 28c1da2^');
  const text = source.slice(from, end);
  if (text.includes('${')) throw new Error('the recovered instruction interpolates — slicing it is no longer safe');
  return text;
}

/** The pre-yesterday catalogue clause, recovered the same way it was written. */
function preCatalogueClause(products) {
  if (!products.length) return '';
  return `\n\nMATCH TO CATALOGUE: when an ordered item clearly corresponds to one of the business's products below, set "description" to that EXACT product name — resolve abbreviations, plurals and varieties (e.g. "broc" -> "Broccoli", "toms" -> "Tomatoes", "green apple"/"granny smith" -> whichever apple in the list it is). If an item doesn't clearly match any product, keep the customer's own wording. PRODUCTS: ${products.slice(0, 400).join(', ')}.`;
}

/**
 * The candidate: PRIORS ALLOWED, plus an admission of doubt.
 *
 * The hypothesis this variant exists to test is that "TRANSCRIBE, DO NOT
 * INTERPRET — never substitute an expected word" removed the very faculty that
 * made the reader good. Reading a smudged phone photo IS interpretation: a
 * human reads "GRAPES BLACK" off six legible glyphs and two guesses, and does
 * it well because produce, the row's neighbours and the amount column all
 * constrain the answer. Forbid that and the reader is left transcribing noise,
 * which is exactly the run-to-run garble Josh reported.
 *
 * So this prompt gives the priors back and buys the honesty a different way:
 * every line carries `uncertain`, and a line the reader had to reason its way
 * to is flagged rather than silently smoothed. The safety property we care
 * about — a human sees the rows that might be wrong — is preserved, and it is
 * preserved by a field rather than by crippling the read.
 *
 * The FIELDS are unchanged from HEAD (raw_description, raw_amount, the two
 * quantity columns), because those feed post-processing that is prompt-
 * independent and demonstrably good — the total-first arithmetic, the gross
 * cross-check, the matching honesty gate. Only the READING POSTURE differs.
 */
const PRIORS_INSTRUCTION = `You are Doc-U's ORDER reader for an SME food & wholesale business in South Africa.
The attached file is a CUSTOMER ORDER — it may be a WhatsApp screenshot, an email, a photo of a handwritten note, a typed list, or a printed purchase order from a point-of-sale system. Read it (handwriting included) and return WHO is ordering and WHAT they want.
Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{
  "customer_name": string | null,
  "customer_confidence": number,
  "line_items": [
    { "raw_description": string, "description": string, "quantity": string, "unit": string, "bulk_quantity": string, "bulk_unit": string, "unit_quantity": string, "unit_price": string, "raw_amount": string, "confidence": number, "uncertain": boolean }
  ],
  "overall_confidence": number
}
READ IT THE WAY A PERSON WOULD, THEN SAY WHERE YOU WERE UNSURE. This is a photograph of paper, not a text file: glyphs are blurred, rotated, compressed and sometimes broken. You are expected to READ, which means using everything on the page to resolve an unclear character — the rest of the word, the produce vocabulary of a fruit-and-veg order, the row's own neighbours, and the amount column. That is what makes a good reading of a bad photo, and you should do it confidently.
What you must NOT do is pretend. When you have resolved a character by reasoning rather than by seeing it, that line gets "uncertain": true and a lower confidence, so a human checks it. A flagged line that turns out right costs one glance; an unflagged line that is wrong becomes an invoice. Never invent a whole product, a whole row or a whole figure that is not on the page — the licence here is to read what IS there through the noise, not to supply what is missing.
Rules:
- "customer_name" = who PLACED the order. Read it from the most reliable cue:
    - WhatsApp screenshot: the CONTACT NAME in the chat header at the very top of the screen. NOT a phone number if a saved name is shown, NOT "you", and NEVER the business receiving the order. If only a phone number is shown, return that number.
    - Email: the SENDER's display name. If only an email address is shown, derive a name from the local-part before "@", title-cased and split on "."/"_"/"-" (e.g. "john.smith@shop.co.za" -> "John Smith").
    - Printed purchase order: the party the order is FROM — the buyer whose letterhead or "Order From"/"Delivery To" block heads the page.
    - Handwritten / typed note: a name by "from", "customer", "client", a shop name, or the sign-off.
  Return the cleaned name in Title Case. Use null only if there is genuinely no name anywhere.
- "customer_confidence" (0-100): how sure you are the name is right. A clear WhatsApp contact header or email sender display name is high (85-100); a name guessed from a phone number or an ambiguous scrawl is low (<60).
- "line_items" = every product the customer is asking for, ONE ENTRY PER ROW ON THE PAPER, in the order they appear. Never merge two rows and never invent one. For each:
    - raw_description = your best reading of the product text AS THE PAPER WRITES IT: its words, its order, its abbreviations, its category codes, its colour and size words ("FF - GRAPES WHITE BOX", "PATTY PAN YELLOW", "Mix Vegetables 2 pkt 20 kg"). Read blurred letters through to the word they spell — but keep the paper's own vocabulary and do not translate, expand or resolve it to one of our product names.
    - description = the produce/product, cleaned and Title Case (e.g. "Strawberries", "Mixed Veg", "Baby Marrow").
    - quantity = the row's headline quantity, digits only as a string ("5" from "5 boxes", "10" from "10x"). Where the row prints TWO quantity columns (see below), put the OUTER/BULK figure here and fill the other three fields as well.
    - unit = the counting unit as a short lowercase plural noun read from the text: "boxes","punnets","bags","kg","crates","trays","bunches","packets","pockets","each". "" if none is stated.
    - unit_price = the price PER UNIT exactly as printed in the row's own unit-cost/rate column, else "" (many orders carry no prices at all).
    - raw_amount = the LINE TOTAL as printed in the row's own amount/nett/value column ("569.90"), read digit for digit, else "" when the document has no such column. This is NOT the unit price and NOT the document total, and you must NEVER compute it — if the row shows no amount, return "".
    - confidence = 0-100 for that line.
    - uncertain = true when any character in that row was resolved by reasoning rather than read cleanly. Otherwise false.
- TWO QUANTITY COLUMNS ARE TWO DIFFERENT NUMBERS AND YOU MUST NOT COLLAPSE THEM. A printed purchase order often carries a BULK quantity with its own pack unit AND a UNIT quantity with its own unit — for example "4 | Box | 48 | Each | 15.75 | 756.00", which is four boxes containing forty-eight avocados at fifteen seventy-five each. Where the row prints both:
    - bulk_quantity = the outer/pack figure exactly as printed ("4"); bulk_unit = its unit ("Box").
    - unit_quantity = the inner/each figure exactly as printed ("48"); unit = its unit ("Each").
    - unit_price = the UNIT COST column exactly as printed ("15.75"). ON THESE DOCUMENTS THE UNIT COST IS THE PRICE OF ONE UNIT QUANTITY, NOT THE PRICE OF A BULK PACK — four boxes at a unit cost of 15.75 is a nett of 756.00, never 63.00.
  Copy all of them and do NOT multiply anything out, do NOT decide which one "the real quantity" is, and do NOT drop a column because it looks redundant. If the document prints only ONE quantity column, leave bulk_quantity, bulk_unit and unit_quantity as "".
- THE AMOUNT COLUMN IS YOUR PROOFREADER. When a row prints both a cost and an amount, some pairing of the row's own numbers should reproduce that amount. If none does, you have misread a digit: look at the row again and re-read every figure. Use it to SETTLE an unclear digit — that is the strongest evidence on the page. But never rewrite a digit you can plainly see just to make the row close: report what the paper shows, set "uncertain": true, and let a human decide. A row silently forced into agreement is a wrong invoice nobody catches.
- Parse messy, conversational text: "hi can I get 5 strawberries and 2 boxes blueberries pls 🙏" -> two line items. Ignore greetings, small talk, delivery addresses, dates and totals.
- DO NOT FABRICATE A MISSING FIELD. If a quantity, unit or price is not on the paper at all — blank column, torn corner, cut-off edge — return "" and lower that line's confidence. Do not derive it from a line total, from the document total, from a neighbouring row, or from what would make the arithmetic work. Reading a faint character is the job; supplying an absent one is not.
- Output all numbers as plain strings (no currency symbols); all confidence values 0-100.`;

/** The priors variant's catalogue clause — HEAD's, which is already the restrained one. */
function priorsCatalogueClause(products) {
  if (!products.length) return '';
  return `\n\nTHE BUSINESS'S OWN PRODUCTS, for reference only: ${products.slice(0, 400).join(', ')}.
Use this list ONLY to expand an unmistakable abbreviation in "description" ("broc" -> "Broccoli", "toms" -> "Tomatoes"), and as ONE MORE PIECE OF EVIDENCE when a blurred word on the paper is nearly legible. It must NOT change one character of "raw_description" beyond your honest reading of the paper, and a word you can read plainly is never replaced by a catalogue word it resembles. Do not resolve anything you are not certain of — a separate step decides which product each line is, and it does that better when your "description" is an honest reading of the paper rather than a guess at our catalogue. A different colour, size, cut, grade or variety is a DIFFERENT product: leave the paper's own wording and lower the line's confidence instead.`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   The variants
   ────────────────────────────────────────────────────────────────────────── */

/**
 * A variant is a PROMPT crossed with a MODEL, because both moved yesterday and
 * a bench that varies only one of them cannot tell you which one broke.
 * `pre-haiku` is the configuration Turn 'n Slice is describing as near perfect;
 * `head-luna` is what production serves right now.
 */
async function buildVariants(opts) {
  const head = await import('../lib/ai/order-prompt.ts');
  const products = opts.catalogue ? CATALOGUE : [];
  const filename = 'bakubung-po.jpg';

  const prePrompt = () =>
    `${preInstruction()}${preCatalogueClause(products)}\n\nFilename: ${filename}`;
  const headPrompt = () => head.buildOrderPrompt({ filename, products });
  const priorsPrompt = () =>
    `${PRIORS_INSTRUCTION}${priorsCatalogueClause(products)}\n\nFilename: ${filename}`;

  return [
    { id: 'pre-haiku',     label: 'PRE prompt · haiku-4-5',    prompt: prePrompt,    provider: 'anthropic', model: 'claude-haiku-4-5',  note: 'the pre-yesterday configuration, verbatim' },
    { id: 'head-sonnet',   label: 'HEAD prompt · sonnet-4-6',  prompt: headPrompt,   provider: 'anthropic', model: 'claude-sonnet-4-6', note: 'current Anthropic path' },
    { id: 'head-luna',     label: 'HEAD prompt · gpt-5.6-luna', prompt: headPrompt,  provider: 'openai',    model: 'gpt-5.6-luna',      note: 'current production default' },
    { id: 'head-haiku',    label: 'HEAD prompt · haiku-4-5',   prompt: headPrompt,   provider: 'anthropic', model: 'claude-haiku-4-5',  note: 'isolates the MODEL axis' },
    { id: 'priors-sonnet', label: 'PRIORS prompt · sonnet-4-6', prompt: priorsPrompt, provider: 'anthropic', model: 'claude-sonnet-4-6', note: 'isolates the PROMPT axis' },
    { id: 'priors-haiku',  label: 'PRIORS prompt · haiku-4-5', prompt: priorsPrompt, provider: 'anthropic', model: 'claude-haiku-4-5',  note: 'the candidate' },
    { id: 'priors-luna',   label: 'PRIORS prompt · gpt-5.6-luna', prompt: priorsPrompt, provider: 'openai', model: 'gpt-5.6-luna',      note: 'the candidate, other provider' },
  ].filter((v) => !opts.variants || opts.variants.includes(v.id));
}

/* ─────────────────────────────────────────────────────────────────────────────
   The calls
   ────────────────────────────────────────────────────────────────────────────

   Raw `fetch`, mirroring lib/ai/openai.ts and the Anthropic messages shape the
   app uses, and a GENEROUS ceiling on both: ten fields across twenty-two lines
   is a big object, and a truncated read comes back as valid-looking JSON with
   rows missing — the one failure mode the scoring below would otherwise blame
   on the prompt.                                                             */

const MAX_TOKENS = 16_000;

async function callAnthropic({ model, prompt, base64, mediaType }) {
  const key = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Anthropic ${res.status} for "${model}": ${body?.error?.message ?? 'no error body'}`);
  const text = (body?.content ?? []).filter((b) => b?.type === 'text').map((b) => b.text).join('');
  if (!text.trim()) throw new Error(`Anthropic returned no text (stop_reason: ${body?.stop_reason ?? 'unknown'})`);
  return { text, stop: body?.stop_reason ?? null, usage: body?.usage ?? null };
}

async function callOpenAi({ model, prompt, base64, mediaType }) {
  const key = (process.env.OPENAI_API_KEY ?? '').trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      // NOT max_tokens, NOT temperature — the gpt-5.x family rejects both.
      max_completion_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenAI ${res.status} for "${model}": ${body?.error?.message ?? 'no error body'}`);
  const choice = body?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(`OpenAI returned no content for "${model}" (finish_reason: ${choice?.finish_reason ?? 'unknown'})`);
  }
  return { text, stop: choice?.finish_reason ?? null, usage: body?.usage ?? null };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Scoring
   ────────────────────────────────────────────────────────────────────────────

   Names and digits are scored SEPARATELY and rows are ALIGNED before either,
   so one dropped row does not cascade into twenty-one wrong ones — the metric
   has to distinguish "read the wrong characters" from "lost its place", which
   are different bugs with different fixes.

   The name comparison is deliberately generous about FORM and merciless about
   CHARACTERS: category prefixes ("FF - "), trailing pack words ("BOX", "PKT"),
   case and punctuation are all stripped, because the pre-yesterday prompt never
   asked for them and scoring their absence would rig the bench. What is left is
   the product itself, and "GRAPES BLACK" vs "GRAPHIS BLACK" is exactly the
   failure being measured.                                                    */

const PACK_WORDS = new Set(['BOX', 'BOXES', 'PKT', 'PKTS', 'PACKET', 'PACKETS', 'PUNNET', 'PUNNETS', 'EACH', 'BAG', 'BAGS', 'CRATE', 'CRATES', 'TRAY', 'TRAYS']);

function nameKey(text) {
  const upper = String(text ?? '').toUpperCase();
  const noPrefix = upper.replace(/^\s*(FF|VEG|FRUIT|VEGETABLE|GROC|DRY)\s*[-–—:]\s*/, '');
  const words = noPrefix
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !PACK_WORDS.has(w));
  return words.join(' ');
}

/** Cheap token-overlap similarity, used only to ALIGN rows — never to score them. */
function similarity(a, b) {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  return hit / Math.max(A.size, B.size);
}

const money = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};

/**
 * Align the read rows to the truth rows, best-similarity first.
 *
 * Greedy and global rather than positional: a reader that inserts a phantom row
 * at line 3 has still read lines 4-22 correctly, and a positional comparison
 * would score all nineteen of them as name failures and hand the wrong verdict
 * to the wrong variant.
 */
function alignRows(read) {
  const pairs = [];
  for (let t = 0; t < GROUND_TRUTH.length; t += 1) {
    for (let r = 0; r < read.length; r += 1) {
      const s = similarity(nameKey(GROUND_TRUTH[t].raw), nameKey(read[r].raw_description || read[r].description));
      if (s > 0) pairs.push({ t, r, s });
    }
  }
  pairs.sort((a, b) => b.s - a.s);
  const usedT = new Set();
  const usedR = new Set();
  const aligned = new Map();
  for (const p of pairs) {
    if (usedT.has(p.t) || usedR.has(p.r)) continue;
    usedT.add(p.t);
    usedR.add(p.r);
    aligned.set(p.t, read[p.r]);
  }
  return aligned;
}

function scoreRun(read, customerName) {
  const aligned = alignRows(read);

  let nameHit = 0;
  let qtyHit = 0, qtyAsked = 0;
  let costHit = 0, costAsked = 0;
  let nettHit = 0, nettAsked = 0;
  const nameMisses = [];
  const digitMisses = [];

  for (let t = 0; t < GROUND_TRUTH.length; t += 1) {
    const truth = GROUND_TRUTH[t];
    const row = aligned.get(t);
    if (!row) {
      nameMisses.push(`${truth.raw} → (no row)`);
      continue;
    }

    const got = nameKey(row.raw_description || row.description);
    if (got === nameKey(truth.raw)) nameHit += 1;
    else nameMisses.push(`${nameKey(truth.raw)} → ${got || '(blank)'}`);

    // QUANTITY: on a two-column row EITHER printed figure is a correct read of
    // that row's quantity — which of them multiplies is `row-arithmetic.ts`'s
    // job downstream, and not the reader's. Scoring it here would measure the
    // wrong module.
    qtyAsked += 1;
    const qtyCandidates = [money(row.quantity), money(row.bulk_quantity), money(row.unit_quantity)].filter((n) => n !== null);
    const qtyTruth = [money(truth.bulk), money(truth.each)].filter((n) => n !== null);
    if (qtyCandidates.length && qtyCandidates.every((n) => qtyTruth.includes(n)) && qtyTruth.every((n) => qtyCandidates.includes(n))) qtyHit += 1;
    else digitMisses.push(`${nameKey(truth.raw)} qty ${qtyTruth.join('/')} → ${qtyCandidates.join('/') || '(blank)'}`);

    costAsked += 1;
    if (money(row.unit_price) !== null && money(row.unit_price) === money(truth.cost)) costHit += 1;
    else digitMisses.push(`${nameKey(truth.raw)} cost ${truth.cost} → ${row.unit_price || '(blank)'}`);

    // The amount column only exists in the post-12ff849 schema. A variant that
    // was never asked for it is not marked down for not returning it — it is
    // reported as coverage instead, which is the honest comparison.
    if (row.raw_amount !== undefined && String(row.raw_amount ?? '').trim() !== '') {
      nettAsked += 1;
      if (money(row.raw_amount) === money(truth.nett)) nettHit += 1;
      else digitMisses.push(`${nameKey(truth.raw)} nett ${truth.nett} → ${row.raw_amount}`);
    }
  }

  const digitAsked = qtyAsked + costAsked + nettAsked;
  const digitHit = qtyHit + costHit + nettHit;

  return {
    rows: read.length,
    aligned: aligned.size,
    nameRate: nameHit / GROUND_TRUTH.length,
    qtyRate: qtyAsked ? qtyHit / qtyAsked : 0,
    costRate: costAsked ? costHit / costAsked : 0,
    nettRate: nettAsked ? nettHit / nettAsked : 0,
    nettCoverage: nettAsked / GROUND_TRUTH.length,
    digitRate: digitAsked ? digitHit / digitAsked : 0,
    customerOk: nameKey(customerName) === nameKey(GROUND_TRUTH_CUSTOMER),
    uncertainFlagged: read.filter((r) => r.uncertain === true).length,
    nameMisses,
    digitMisses,
  };
}

/** The signature two runs are compared on — the fields a reviewer would notice. */
const rowSignature = (r) =>
  [nameKey(r.raw_description || r.description), String(r.quantity ?? ''), String(r.bulk_quantity ?? ''),
   String(r.unit_quantity ?? ''), String(r.unit_price ?? ''), String(r.raw_amount ?? '')].join('|');

/**
 * How much does a variant agree with ITSELF across runs?
 *
 * The headline symptom Josh reported is not "wrong" but "wrong DIFFERENTLY
 * every time", and a variant that is stably slightly-wrong is a far better
 * product than one that is unstably nearly-right: the first can be corrected
 * once, the second re-corrupts every re-upload.
 */
function agreement(runs) {
  if (runs.length < 2) return null;
  const sets = runs.map((r) => new Set(r.rows.map(rowSignature)));
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      let shared = 0;
      for (const s of sets[i]) if (sets[j].has(s)) shared += 1;
      total += shared / Math.max(sets[i].size, sets[j].size, 1);
      pairs += 1;
    }
  }
  return pairs ? total / pairs : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Output
   ────────────────────────────────────────────────────────────────────────── */

const pct = (v) => (v === null || v === undefined || Number.isNaN(v) ? '  —  ' : `${(v * 100).toFixed(0)}%`.padStart(5));

function printTable(results) {
  const head = ['variant', 'runs', 'rows', 'names', 'qty', 'cost', 'nett', 'digits', 'agree', 'cust'];
  const widths = [24, 4, 6, 6, 6, 6, 6, 6, 6, 5];
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' ');
  console.log('');
  console.log(line(head));
  console.log(widths.map((w) => '─'.repeat(w)).join(' '));
  for (const r of results) {
    if (r.error) {
      console.log(line([r.id, '-', 'ERROR', r.error.slice(0, 46), '', '', '', '', '', '']));
      continue;
    }
    console.log(line([
      r.id,
      r.runs.length,
      `${r.mean.rows.toFixed(1)}/${GROUND_TRUTH.length}`,
      pct(r.mean.nameRate),
      pct(r.mean.qtyRate),
      pct(r.mean.costRate),
      r.mean.nettCoverage > 0 ? pct(r.mean.nettRate) : ' n/a ',
      pct(r.mean.digitRate),
      pct(r.agreement),
      r.mean.customerOk >= 0.5 ? ' ok' : ' ✗',
    ]));
  }
  console.log('');
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/* ─────────────────────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────────────────── */

/** Read a model's reply as rows, tolerating a fence and tolerating junk. */
function parseRows(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Some readers prepend a sentence. Take the outermost object and try again.
    const from = cleaned.indexOf('{');
    const to = cleaned.lastIndexOf('}');
    if (from === -1 || to <= from) return { customer_name: '', rows: [] };
    try { parsed = JSON.parse(cleaned.slice(from, to + 1)); } catch { return { customer_name: '', rows: [] }; }
  }
  return {
    customer_name: typeof parsed?.customer_name === 'string' ? parsed.customer_name : '',
    rows: Array.isArray(parsed?.line_items) ? parsed.line_items.filter((r) => r && typeof r === 'object') : [],
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const envNames = loadEnvLocal();
  mkdirSync(opts.out, { recursive: true });

  if (opts.list) {
    for (const v of await buildVariants({ ...opts, variants: null })) {
      console.log(`${v.id.padEnd(16)} ${v.label.padEnd(34)} ${v.note}`);
    }
    return;
  }

  if (opts.makeImage) {
    for (const level of Object.keys(DEGRADE)) console.log(`Rendered ${makeSyntheticImage(opts.out, level)}`);
    return;
  }

  // Real photos beat synthetic paper, and the harness says which it used —
  // a bench that quietly measured a crisp render would be worse than none.
  const desktop = join(homedir(), 'Desktop', 'bakubung');
  let imageDir = opts.images ? resolve(opts.images.replace(/^~/, homedir())) : null;
  let synthetic = false;
  if (!imageDir && existsSync(desktop)) imageDir = desktop;
  let images;
  if (imageDir) {
    images = readdirSync(imageDir)
      .filter((f) => ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extname(f).toLowerCase()))
      .sort()
      .map((f) => join(imageDir, f));
    if (!images.length) throw new Error(`No images in ${imageDir}`);
  } else {
    synthetic = true;
    images = [makeSyntheticImage(opts.out, opts.degrade)];
  }

  console.log(`Bench    ${new Date().toISOString()}`);
  console.log(`Source   ${synthetic ? `SYNTHETIC render, degrade=${opts.degrade} (no real photos found)` : imageDir}`);
  console.log(`Images   ${images.length} — ${images.map((i) => i.split('/').pop()).join(', ')}`);
  console.log(`Truth    ${GROUND_TRUTH.length} lines, customer "${GROUND_TRUTH_CUSTOMER}"`);
  console.log(`Env      .env.local ${envNames.length ? `provided ${envNames.length} names` : 'not found'}; ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING'}, OPENAI_API_KEY ${process.env.OPENAI_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`Catalogue ${opts.catalogue ? `${CATALOGUE.length} products` : 'omitted'}`);

  // One image per call, which is what production does — every `documents` row is
  // one file. A multi-page order arrives as a PDF (one document block, all
  // pages) or as N separate rows read separately; there is no N-image call to
  // bench, and inventing one here would bench something the app cannot do.
  const first = images[0];
  const base64 = readFileSync(first).toString('base64');
  const mediaType = extname(first).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  if (images.length > 1) {
    console.log(`Note     ${images.length} images found; benching the FIRST only — production reads one file per document row.`);
  }

  const variants = await buildVariants(opts);
  const results = [];

  for (const v of variants) {
    const runs = [];
    let error = null;
    for (let n = 0; n < opts.runs; n += 1) {
      process.stdout.write(`  ${v.id} run ${n + 1}/${opts.runs} … `);
      try {
        const prompt = v.prompt();
        const call = v.provider === 'openai' ? callOpenAi : callAnthropic;
        const t0 = Date.now();
        const { text, stop, usage } = await call({ model: v.model, prompt, base64, mediaType });
        const ms = Date.now() - t0;
        writeFileSync(join(opts.out, `${v.id}.run${n + 1}.json`), text);
        const { customer_name, rows } = parseRows(text);
        const score = scoreRun(rows, customer_name);
        runs.push({ rows, score, ms, stop, usage });
        console.log(`${rows.length} rows, names ${pct(score.nameRate).trim()}, digits ${pct(score.digitRate).trim()}, ${(ms / 1000).toFixed(1)}s${stop && stop !== 'end_turn' && stop !== 'stop' ? ` [stop: ${stop}]` : ''}`);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        console.log(`FAILED — ${error}`);
        break;
      }
    }

    if (!runs.length) {
      results.push({ id: v.id, label: v.label, error: error ?? 'no runs' });
      continue;
    }

    results.push({
      id: v.id,
      label: v.label,
      runs,
      mean: {
        rows: mean(runs.map((r) => r.score.rows)),
        nameRate: mean(runs.map((r) => r.score.nameRate)),
        qtyRate: mean(runs.map((r) => r.score.qtyRate)),
        costRate: mean(runs.map((r) => r.score.costRate)),
        nettRate: mean(runs.map((r) => r.score.nettRate)),
        nettCoverage: mean(runs.map((r) => r.score.nettCoverage)),
        digitRate: mean(runs.map((r) => r.score.digitRate)),
        customerOk: mean(runs.map((r) => (r.score.customerOk ? 1 : 0))),
        uncertainFlagged: mean(runs.map((r) => r.score.uncertainFlagged)),
      },
      agreement: agreement(runs),
    });
  }

  printTable(results);

  // The misses themselves, because a rate tells you a variant is worse and the
  // misses tell you WHY — "GRAPES → GRAPHIS" and "no row" are the same number
  // and completely different bugs.
  for (const r of results) {
    if (r.error || !r.runs?.length) continue;
    const s = r.runs[0].score;
    if (!s.nameMisses.length && !s.digitMisses.length) continue;
    console.log(`── ${r.id} (run 1) ──`);
    for (const m of s.nameMisses.slice(0, 8)) console.log(`   name  ${m}`);
    for (const m of s.digitMisses.slice(0, 8)) console.log(`   digit ${m}`);
    if (s.nameMisses.length > 8 || s.digitMisses.length > 8) console.log('   …');
    if (r.mean.uncertainFlagged) console.log(`   flagged uncertain: ${r.mean.uncertainFlagged.toFixed(1)} lines`);
    console.log('');
  }

  const ranked = results.filter((r) => !r.error)
    .sort((a, b) => (b.mean.nameRate + b.mean.digitRate) - (a.mean.nameRate + a.mean.digitRate));
  if (ranked.length) {
    console.log(`WINNER on names+digits: ${ranked[0].id} — ${ranked[0].label}`);
  }
  writeFileSync(join(opts.out, 'bench.json'), JSON.stringify({ at: new Date().toISOString(), synthetic, images, results }, null, 2));
  console.log(`Raw responses and bench.json in ${opts.out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
