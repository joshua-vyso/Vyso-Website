/**
 * Small readers over a document's extracted_data — shared by the flags,
 * confidence, supplier-match and supplier-intel derivations.
 */
import type { Document } from '@/lib/platform/types';
// `.ts`-suffixed relative import, not the `@/` alias: this module is loaded
// directly by node --test (via row-arithmetic.ts / order-line-totals.ts's own
// relative imports of it), which resolves neither extensionless ESM specifiers
// nor the `@/` alias — only a value-level import (this one) needs that; the
// `Document` type import above is erased at compile time and never resolved
// at runtime, so it can keep using the alias.
import { parseLocaleNumber, type DecimalSeparator } from '../locale-number.ts';

type HasExtract = Pick<Document, 'extracted_data'>;

/** Value of the first extracted field whose label matches any pattern (case-insensitive substring). */
export function findFieldValue(doc: HasExtract, ...patterns: string[]): string | null {
  const fields = doc.extracted_data?.fields ?? [];
  for (const p of patterns) {
    const hit = fields.find((f) => f.label.toLowerCase().includes(p.toLowerCase()));
    if (hit?.value) return hit.value;
  }
  return null;
}

/** Confidence of the first extracted field whose label matches any pattern. */
export function findFieldConfidence(doc: HasExtract, ...patterns: string[]): number | null {
  const fields = doc.extracted_data?.fields ?? [];
  for (const p of patterns) {
    const hit = fields.find((f) => f.label.toLowerCase().includes(p.toLowerCase()));
    if (hit) return hit.confidence;
  }
  return null;
}

/**
 * Parse a Rand-ish string ("R8 240.00", "R 16,640", "1 234.50", "R 269,00") to
 * a number.
 *
 * FIXED BUG, DO NOT REINTRODUCE: this used to be
 * `String(s).replace(/[^0-9.\-]/g, '')` — it DELETED commas instead of reading
 * them, so a South African comma-decimal figure like "0,20" (a fifth of a
 * unit) became the digits "020" → 20, and "269,000" (two hundred and
 * sixty-nine rand) became "269000" → two hundred and sixty-nine THOUSAND rand.
 * That is not a rounding error, it is a change of magnitude, and it is how
 * Standard Bank PO SBSA94517's R53.80 Gooseberries line was nearly invoiced at
 * R5 380 000.00. `parseAmount` is now a thin delegate to the shared,
 * locale-aware, deterministic parser in `lib/platform/locale-number.ts` — see
 * that module for the algorithm and why guessing "every comma is a decimal"
 * would have been just as wrong. Every other numeric-parsing site in Doc-U /
 * OrderFlow delegates to the same module; do not add a second one here or
 * anywhere else.
 *
 * `opts.decimalSeparator` is an optional document-level hint (see
 * `order-line-totals.ts`'s `lineSeparatorHint` / `inferDecimalSeparator`) that
 * only matters for a string that is genuinely ambiguous on its own (a lone
 * comma followed by exactly three digits, e.g. "269,000"). Omitting it keeps
 * every existing caller's behaviour unchanged for anything unambiguous.
 */
export function parseAmount(
  s: string | number | null | undefined,
  opts?: { decimalSeparator?: DecimalSeparator },
): number | null {
  return parseLocaleNumber(s, opts);
}

/** Document total: prefer an extracted "Total" field, else sum line-item amounts. */
export function docTotal(doc: HasExtract): number | null {
  const t = parseAmount(findFieldValue(doc, 'total', 'amount due', 'grand total'));
  if (t != null) return t;
  const lines = doc.extracted_data?.line_items ?? [];
  if (lines.length === 0) return null;
  const sum = lines.reduce((acc, l) => acc + (parseAmount(l.amount) ?? 0), 0);
  return sum || null;
}

/** Mean confidence across extracted fields (0–100), or null. */
export function avgFieldConfidence(doc: HasExtract): number | null {
  const fields = doc.extracted_data?.fields ?? [];
  if (fields.length === 0) return null;
  return Math.round(fields.reduce((s, f) => s + (f.confidence ?? 0), 0) / fields.length);
}
