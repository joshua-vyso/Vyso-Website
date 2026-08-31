/**
 * The expense categories Doc-U will suggest for a receipt.
 *
 * A FIXED LIST, AND SHORT ON PURPOSE. The reader is asked to pick one of these
 * ten and nothing else; a suggestion that is not on the list is dropped to null
 * rather than accepted, because a model that can invent a category can invent
 * ten spellings of "Meals" and the reviewer would be sorting a taxonomy instead
 * of checking a receipt. These are the ordinary lines an SME's accountant
 * already has, not a chart of accounts — Vyso has no ledger and this is not one.
 *
 * NOTHING HERE IS BINDING. The suggestion is preselected in the review card, the
 * reviewer changes it with a select, and no rule is learned, locked or applied
 * to the next receipt from the same merchant. Silent category locking is how a
 * mis-filed first receipt becomes a mis-filed year, and we would rather ask
 * every time than be confidently wrong for free.
 *
 * PURE. No I/O, no React. `.ts`-suffixed relative imports for `node --test`.
 */

/** The only categories that may be stored. Order is display order. */
export const EXPENSE_CATEGORIES = [
  'Meals & entertainment',
  'Fuel',
  'Travel',
  'Accommodation',
  'Parking',
  'Office expenses',
  'Subscriptions',
  'Repairs & maintenance',
  'Professional services',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Case- and whitespace-insensitive lookup, built once. The reader is told to
 *  copy a label exactly; matching leniently on case only means "Fuel" and
 *  "fuel" agree, while still refusing anything that is not one of the ten. */
const BY_NORMALISED = new Map<string, ExpenseCategory>(
  EXPENSE_CATEGORIES.map((c) => [c.toLowerCase(), c]),
);

/**
 * The suggested category, or null.
 *
 * NULL IS A PERFECTLY GOOD ANSWER and the commonest one worth defending: a
 * receipt whose category we could not recognise should reach the reviewer with
 * the select empty, not quietly filed under "Other". "Other" is a choice a human
 * makes; it is not a synonym for "we did not know", and using it as one is how a
 * category column stops meaning anything.
 */
export function coerceExpenseCategory(v: unknown): ExpenseCategory | null {
  if (typeof v !== 'string') return null;
  const key = v.trim().toLowerCase();
  if (!key) return null;
  return BY_NORMALISED.get(key) ?? null;
}
