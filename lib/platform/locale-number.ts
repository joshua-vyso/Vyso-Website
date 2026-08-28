/**
 * ONE deterministic, locale-aware numeric parser for every money/quantity
 * string Doc-U or OrderFlow reads off a document or an editable field.
 *
 * WHY THIS EXISTS. `parseAmount()` (lib/platform/docu/extract.ts) used to do
 * `String(s).replace(/[^0-9.\-]/g, '')` — it DELETED commas instead of reading
 * them. On a South African document, where the decimal separator IS the comma,
 * that is not a rounding error, it is a change of magnitude: "0,20" (a fifth of
 * a unit) became the digits "020" → 20; "269,000" (two hundred and sixty-nine
 * rand) became "269000" → two hundred and sixty-nine THOUSAND rand. The bug was
 * silent because every corrupted figure still looked like a plausible price in
 * isolation, and it was systematic because the same one-line regex was copied
 * into five other modules (extract.ts, orderflow-from-doc.ts,
 * invoice-from-extraction.ts, anthropic.ts, and two UI keystroke sanitisers).
 * Standard Bank PO SBSA94517 is the paper trail: a R53.80 Gooseberries line was
 * shown, matched and very nearly invoiced as R5 380 000.00.
 *
 * THE FIX IS NOT "always treat a comma as a decimal". South African input and
 * US/UK-style input BOTH reach this codebase — sometimes on the SAME screen, if
 * a customer's own purchase order uses en formatting while the org's price list
 * is SA comma-decimal. Guessing wrong in either direction is exactly the bug
 * this module exists to end, so `parseLocaleNumber` only guesses when the
 * string is genuinely ambiguous on its own (a lone comma followed by exactly
 * three digits, e.g. "269,000" — could be "two-hundred-and-sixty-nine
 * thousand" or "two-hundred-and-sixty-nine point oh-oh-oh"), and even then only
 * after every UNAMBIGUOUS format cue has had a vote — see
 * `inferDecimalSeparator`. A string that is not ambiguous is never touched by
 * the hint; "0,20" is a decimal-comma read whether or not the caller supplies
 * one, and "1,234,567" is en-thousands whether or not it does.
 *
 * MALFORMED INPUT RETURNS null, NEVER a best-effort guess. A null flags the row
 * for a human. A wrong number that looks plausible is the failure mode that put
 * a R13,457.60 order on an invoice for R25,958.95 — silence is always the safer
 * failure here.
 *
 * PURE. No imports from app code, no I/O — every caller (extract.ts,
 * order-line-totals.ts, row-arithmetic.ts, line-audit.ts, orderflow-from-doc.ts,
 * invoice-from-extraction.ts, anthropic.ts, OrderReviewEditor.tsx) is a thin
 * delegate to the algorithm here, so there is exactly one place a numeric
 * format decision can be made.
 */

export type DecimalSeparator = ',' | '.';

/** Currency markers this codebase's documents actually print, stripped only
 *  from the EDGES of a token (never mid-string, so "12a34" is never mistaken
 *  for a decorated number). Longest-alternative-first doesn't matter here
 *  because every alternative is tried at the same anchored position and the
 *  first one that matches wins ("R" matches "R1,395", "ZAR" matches "ZAR
 *  269,00" — the two never collide because "R" cannot match a leading "Z"). */
const CURRENCY_PREFIX_RE = /^([+-]?)\s*(R|ZAR|USD|EUR|GBP|\$|€|£)\s*/i;
const CURRENCY_SUFFIX_RE = /\s*(R|ZAR|USD|EUR|GBP|\$|€|£)\s*([+-]?)$/i;
/** A percentage is not a currency, but it decorates the SAME way a trailing
 *  currency symbol does ("15%" the same shape as "R15") and this codebase
 *  reads percentages off documents too (a printed VAT rate) — so it is
 *  stripped from the trailing edge the same way, never mid-string. */
const PERCENT_SUFFIX_RE = /\s*%\s*([+-]?)$/;

/** Every character this module treats as "grouping, not digits" — the ordinary
 *  space plus the Unicode spaces a phone keyboard or a copy-pasted PDF can
 *  produce for a thousands gap (NBSP, narrow NBSP, thin space). JS `\s` already
 *  matches all three under normal (non-`u`-flag) semantics on every engine this
 *  runs on, but they are listed explicitly so the rule does not silently depend
 *  on that and survives an engine where it isn't true. Spaces are ALWAYS
 *  grouping — no locale this reads uses a space as a decimal separator — so
 *  they are removed unconditionally, before any decimal/grouping decision. */
const WHITESPACE_RE = /[\s   ]/g;

/** After currency/paren/sign/whitespace stripping, the token must be digits and
 *  separators only, and must contain at least one digit — anything else (a
 *  stray letter, a leftover '-' that wasn't the single leading sign, an empty
 *  string) is refused rather than guessed at. */
const CHARSET_RE = /^[0-9.,]+$/;

interface Preprocessed {
  negative: boolean;
  /** Digits and separators only — currency, parens, sign and whitespace gone. */
  token: string;
}

/** Steps 1(string case)–5 of the algorithm: strip accounting parens, a
 *  currency token, a single leading sign, and all whitespace/grouping-space,
 *  then validate the charset. Shared by `parseLocaleNumber` (which goes on to
 *  resolve separators) and `inferDecimalSeparator` (which only needs the
 *  cleaned token to read separator evidence off). Returns null for anything
 *  that cannot possibly be one number — the caller decides what "malformed"
 *  means for its own purpose (parse failure vs. no inference evidence). */
function preprocess(raw: string): Preprocessed | null {
  let s = raw.trim();
  if (!s) return null;

  // Accounting negatives — "(1 234,56)" means -1 234,56. Unwrapped BEFORE
  // currency stripping so a token sitting just inside the parens ("(R12.50)")
  // is still at the string's edge afterwards.
  let negative = false;
  if (s.length >= 2 && s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  // Currency letters/symbols only ever sit at an edge, with the sign allowed on
  // either side of them ("-R 12,50" and, defensively, "R -12,50"). The digit
  // string underneath is untouched either way. A trailing "%" is stripped the
  // same way ("15%" → "15") — see `PERCENT_SUFFIX_RE`.
  s = s
    .replace(CURRENCY_PREFIX_RE, '$1')
    .replace(CURRENCY_SUFFIX_RE, '$2')
    .replace(PERCENT_SUFFIX_RE, '$1')
    .trim();

  // A single leading sign is ours to interpret. Parens already recorded a
  // negative above; a literal leading '-' on top of that (only reachable via a
  // stray "-(...)") toggles it rather than being ignored, so the two negatives
  // read as a positive the way they would on paper.
  const signMatch = /^[+-]/.exec(s);
  if (signMatch) {
    if (signMatch[0] === '-') negative = !negative;
    s = s.slice(1);
  }

  s = s.replace(WHITESPACE_RE, '');

  if (!CHARSET_RE.test(s) || !/[0-9]/.test(s)) return null;
  return { negative, token: s };
}

const countChar = (s: string, ch: string): number => s.split(ch).length - 1;

/** Validate a grouped integer's shape: the leftmost group is 1–3 digits (the
 *  "odd" leading group — "1" of "1,234,567"), every group after it is exactly
 *  3 (a real thousands group can never be shorter or longer). This is what
 *  tells "1,234,567" (valid) apart from "12,34,5" (not a grouping anyone
 *  uses — flag it rather than silently drop the extra separators). */
function validGroups(digits: string, groupChar: string): boolean {
  const groups = digits.split(groupChar);
  if (groups.some((g) => !/^[0-9]+$/.test(g))) return false;
  if (groups[0].length < 1 || groups[0].length > 3) return false;
  return groups.slice(1).every((g) => g.length === 3);
}

/**
 * Step 6 of the algorithm: given a whitespace/currency/sign-free token of only
 * digits, '.' and ',', decide which (if either) is the decimal separator and
 * return a canonical "plain JS number string" (grouping chars gone, decimal
 * point is '.'), or null if the token cannot be read as one consistent number.
 */
function resolveSeparators(token: string, opts?: { decimalSeparator?: DecimalSeparator }): string | null {
  const hasDot = token.includes('.');
  const hasComma = token.includes(',');

  if (hasDot && hasComma) {
    // Both present: whichever separator occurs LAST is the decimal point — a
    // grouping separator can never appear after the decimal point on any
    // format this reads. It must appear EXACTLY once (a second "decimal
    // point" is not a number, it's two numbers mashed together) — and because
    // it is defined as the position of the last separator in the string, that
    // single occurrence is automatically after every grouping occurrence.
    const lastDot = token.lastIndexOf('.');
    const lastComma = token.lastIndexOf(',');
    const decimalChar = lastDot > lastComma ? '.' : ',';
    const groupChar = decimalChar === '.' ? ',' : '.';
    if (countChar(token, decimalChar) !== 1) return null;

    const decimalIdx = decimalChar === '.' ? lastDot : lastComma;
    const intPart = token.slice(0, decimalIdx);
    const fracPart = token.slice(decimalIdx + 1);
    if (!intPart || !/^[0-9]+$/.test(fracPart)) return null;
    // The integer part is the grouped number — "1.234.567" ahead of a ",89" —
    // and it must actually look like grouping (this is what catches
    // "1.2.3,4": groups "1"/"2"/"3" are not a real thousands grouping).
    if (!validGroups(intPart, groupChar)) return null;
    return `${intPart.split(groupChar).join('')}.${fracPart}`;
  }

  if (hasDot) {
    if (countChar(token, '.') > 1) {
      // Multiple dots with no comma at all: en/SA share no format with a
      // repeated decimal point, so every dot here is grouping — "1.234.567".
      if (!validGroups(token, '.')) return null;
      return token.split('.').join('');
    }
    const idx = token.indexOf('.');
    const intPart = token.slice(0, idx);
    const fracPart = token.slice(idx + 1);
    if (!intPart || !/^[0-9]+$/.test(fracPart)) return null;
    // A single dot is a decimal point BY DEFAULT — that is the common case by
    // far, and defaulting any other way would misread every plain "12.50".
    // The one override: the caller has told us THIS DOCUMENT uses comma for
    // decimals, and the dot sits exactly where an en thousands-grouping dot
    // would ("1.395" — three digits after, 1–3 before). Without that hint we
    // would rather read a genuine SA-thousands dot as a (wrong) decimal than
    // invent grouping nobody asked for.
    if (
      opts?.decimalSeparator === ',' &&
      fracPart.length === 3 &&
      intPart.length >= 1 &&
      intPart.length <= 3
    ) {
      return `${intPart}${fracPart}`;
    }
    return `${intPart}.${fracPart}`;
  }

  if (hasComma) {
    if (countChar(token, ',') > 1) {
      // Multiple commas with no dot: only en-style grouping repeats a comma —
      // "1,234,567" — so read them all as grouping or refuse ("12,34,5").
      if (!validGroups(token, ',')) return null;
      return token.split(',').join('');
    }
    const idx = token.indexOf(',');
    const intPart = token.slice(0, idx);
    const fracPart = token.slice(idx + 1);
    if (!intPart || !/^[0-9]+$/.test(fracPart)) return null;

    if (fracPart.length !== 3) {
      // 1, 2 or 4+ digits after a single comma cannot be a thousands group
      // (real grouping is always exactly 3), so it can only be a decimal
      // comma — "0,20", "13,95" — REGARDLESS of any hint. This is the case
      // that was silently destroyed by the old `.replace(/[^0-9.\-]/g, '')`.
      return `${intPart}.${fracPart}`;
    }
    // Exactly 3 trailing digits IS genuinely ambiguous on its own — "269,000"
    // is both "two hundred sixty-nine thousand" and "two hundred sixty-nine
    // point oh-oh-oh" — so this is the one place a hint is allowed to decide,
    // and the one place "no hint" falls back to an assumption (en thousands,
    // when the leading group is a plausible one) rather than a refusal.
    if (opts?.decimalSeparator === ',') return `${intPart}.${fracPart}`;
    if (opts?.decimalSeparator === '.') return `${intPart}${fracPart}`;
    const looksLikeEnGrouping = intPart.length >= 1 && intPart.length <= 3;
    return looksLikeEnGrouping ? `${intPart}${fracPart}` : `${intPart}.${fracPart}`;
  }

  // No separators at all: a plain integer.
  return token;
}

/**
 * Parse a human/locale-formatted numeric string to a canonical JS number.
 * Returns null for empty/malformed input — never guesses on garbage.
 */
export function parseLocaleNumber(
  raw: string | number | null | undefined,
  opts?: { decimalSeparator?: DecimalSeparator },
): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const pre = preprocess(String(raw));
  if (!pre) return null;

  const canonical = resolveSeparators(pre.token, opts);
  if (canonical == null) return null;

  const n = Number(canonical);
  if (!Number.isFinite(n)) return null;
  return pre.negative ? -n : n;
}

/**
 * Scan a document's numeric strings for unambiguous separator evidence and
 * return the inferred decimal separator, or null if there is none, or the
 * evidence is tied.
 *
 * Only UNAMBIGUOUS samples vote. A string with both separators settles its own
 * question (the last one is decimal, always — see `resolveSeparators`) and
 * that reading counts as strong evidence for the document as a whole. A single
 * separator followed by anything other than exactly 3 digits ("0,20", "13.5")
 * can only be a decimal mark and also votes. Anything else — a plain integer,
 * an already-ambiguous "269,000", or a string that fails to parse at all — is
 * silent: it is exactly the kind of value this function exists to disambiguate
 * FOR, so it must never be allowed to argue with itself.
 */
export function inferDecimalSeparator(
  samples: Array<string | number | null | undefined>,
): DecimalSeparator | null {
  let commaVotes = 0;
  let dotVotes = 0;

  for (const sample of samples) {
    if (typeof sample !== 'string') continue; // a bare number carries no format evidence
    const pre = preprocess(sample);
    if (!pre) continue;
    const { token } = pre;
    const hasDot = token.includes('.');
    const hasComma = token.includes(',');

    if (hasDot && hasComma) {
      const decimalChar = token.lastIndexOf('.') > token.lastIndexOf(',') ? '.' : ',';
      if (decimalChar === ',') commaVotes += 1;
      else dotVotes += 1;
      continue;
    }
    if (hasComma && countChar(token, ',') === 1) {
      const fracLen = token.length - token.indexOf(',') - 1;
      if (fracLen !== 3) commaVotes += 1;
      continue;
    }
    if (hasDot && countChar(token, '.') === 1) {
      const fracLen = token.length - token.indexOf('.') - 1;
      if (fracLen !== 3) dotVotes += 1;
      continue;
    }
    // Plain integer, multi-separator grouping, or a 3-digit-tail single
    // separator: no opinion.
  }

  if (commaVotes === dotVotes) return null; // no evidence, or an exact tie — refuse to guess
  return commaVotes > dotVotes ? ',' : '.';
}

/** Do two Rand figures agree within `toleranceRand` (default 2 cents)? The
 *  epsilon on top absorbs float noise from prior `× ` / rounding, never a
 *  second currency-tolerance opinion. */
export function moneyEquals(a: number, b: number, toleranceRand = 0.02): boolean {
  return Math.abs(a - b) <= toleranceRand + 1e-9;
}
