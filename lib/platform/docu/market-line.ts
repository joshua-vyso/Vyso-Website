/**
 * Fresh-produce MARKET statement lines — identity and de-duplication.
 *
 * WHY THIS MODULE EXISTS (2026-09-03 stock-intake test, 47 Johannesburg Fresh
 * Produce Market buyer statements, 1,308 rows, diffed row-for-row against the
 * paper):
 *
 *   1. The reader was asked for a "cleaned, Title Case" produce name and used it
 *      as the STOCK ITEM KEY. Across two months the same printed commodity came
 *      back under several names ("Bananas" / "Bananas Hand" / "Bananas 18kg
 *      Banana Hand"), and one name swallowed several pack sizes ("Lemons" held
 *      ten different packs, "Parsley" merged the 2KG and 3KG box). 441 printed
 *      commodity strings became 255 stock items, 102 of them fragmented. A
 *      warehouse count keyed like that is meaningless. So the name is now
 *      DERIVED IN CODE from the commodity cell the market prints, which is a
 *      fixed comma-separated record — the model only has to transcribe it.
 *
 *   2. In roughly one read in seven the reader emitted a whole "PURCHASES ON
 *      CARD ID" section a second time (a section that continues onto the next
 *      page is the usual trigger). Every phantom row carried the market's own
 *      per-row INVOICE number, and those numbers are unique per row on every
 *      statement we have — so a repeated reference with identical figures is a
 *      re-listing, never a second purchase, and is dropped here. A repeated
 *      reference with DIFFERENT figures is kept and counted, because that is a
 *      misread the reviewer has to see, not something to guess at.
 *
 * Both functions are pure so the behaviour is pinned by tests/docu-market-line.test.ts.
 */

export interface MarketCommodity {
  /** "BANANAS", "BABY BUTTERNUT" — as printed, upper-cased. */
  commodity: string;
  /** The pack cell verbatim: "18KG BANAN", "300G PUNNE", "6KG POCKET". */
  pack: string;
  /** Pack weight in kilograms, or null when the pack cell prints none. */
  packKg: number | null;
  /** Variety/cultivar as printed ("HAND", "MONDIAL", "NAVEL"), or null for "*". */
  variety: string | null;
  /** Remaining positional codes (grade, size, count, colour), kept for reviewers. */
  codes: string[];
}

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(KG|G)\b/i;

/**
 * Parse the market's commodity cell — "COMMODITY,PACK,VARIETY,GRADE,SIZE,COUNT,COLOUR"
 * with "*" for empty slots. Returns null for anything that is not that shape, so
 * an ordinary invoice description is never mistaken for one.
 */
export function parseMarketCommodity(raw: string | null | undefined): MarketCommodity | null {
  const text = (raw ?? '').trim();
  if (!text.includes(',')) return null;
  const parts = text.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;
  const [commodity, pack, variety, ...codes] = parts;
  if (!commodity || !/[A-Za-z]/.test(commodity)) return null;
  const weight = WEIGHT_RE.exec(pack);
  // The pack cell is the tell: no weight-bearing pack, no market line.
  if (!weight) return null;
  const n = Number(weight[1].replace(',', '.'));
  const packKg = !Number.isFinite(n) ? null : weight[2].toUpperCase() === 'G' ? n / 1000 : n;
  const varietyText = variety && variety !== '*' && /[A-Za-z]/.test(variety) ? variety : null;
  return {
    commodity: commodity.toUpperCase(),
    pack,
    packKg,
    variety: varietyText ? varietyText.toUpperCase() : null,
    codes,
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** "18" → "18kg", "0.3" → "300g", "18.5" → "18.5kg". */
export function formatPackKg(kg: number): string {
  if (kg < 1) return `${Math.round(kg * 1000)}g`;
  return `${Number(kg.toFixed(3))}kg`;
}

/**
 * The stock-item name for a market line: commodity, variety, pack weight.
 * "BANANAS,18KG BANAN,HAND,1,XL,*,*" → "Bananas Hand 18kg";
 * "LETTUCE,500G PUNNE,*,0,*,8,*"     → "Lettuce 500g".
 *
 * Grade, size, per-box count and colour codes are deliberately NOT part of the
 * name — they change week to week for the same product and would fragment the
 * item again, just more finely. They stay on the line for the reviewer.
 */
export function canonicalMarketName(raw: string | null | undefined): string | null {
  const parsed = parseMarketCommodity(raw);
  if (!parsed) return null;
  const parts = [titleCase(parsed.commodity.replace(/\//g, ' '))];
  if (parsed.variety) parts.push(titleCase(parsed.variety.replace(/\//g, ' ')));
  if (parsed.packKg != null) parts.push(formatPackKg(parsed.packKg));
  return parts.join(' ');
}

export interface ReferencedLine {
  reference?: string | null;
  quantity?: string | null;
  unit_price?: string | null;
  amount?: string | null;
}

export interface DedupeResult<T> {
  lines: T[];
  /** Rows dropped as exact re-listings of an earlier reference. */
  dropped: number;
  /** References that recur with DIFFERENT figures — kept, but a reviewer must look. */
  conflicting: number;
}

const norm = (v: string | null | undefined): string => (v ?? '').trim().replace(/\s+/g, '');

/**
 * Drop rows that repeat an earlier row's reference with the same figures. Rows
 * without a reference are never touched: only a printed row number is evidence
 * of identity, and a genuine statement can list the same product at the same
 * price twice from two different invoices.
 */
export function dedupeByReference<T extends ReferencedLine>(lines: T[]): DedupeResult<T> {
  const seen = new Map<string, string>();
  const out: T[] = [];
  let dropped = 0;
  let conflicting = 0;
  for (const line of lines) {
    const ref = norm(line.reference);
    if (!ref) {
      out.push(line);
      continue;
    }
    const figures = `${norm(line.quantity)}|${norm(line.unit_price)}|${norm(line.amount)}`;
    const prior = seen.get(ref);
    if (prior === undefined) {
      seen.set(ref, figures);
      out.push(line);
    } else if (prior === figures) {
      dropped += 1;
    } else {
      conflicting += 1;
      out.push(line);
    }
  }
  return { lines: out, dropped, conflicting };
}
