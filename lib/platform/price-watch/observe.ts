/**
 * Price Watch — observation + recommended_action generation (plan step 7).
 *
 * Turns one detected price move into the two strings a human actually reads in
 * The Brief and the weekly digest: a 1-2 sentence plain-language observation and
 * a one-line recommended action.
 *
 * THE GUARANTEE THIS FILE EXISTS FOR (acceptance criterion 7): the agent never
 * states a number it was not given.
 *
 * Everything here follows from that. The prompt is handed ONLY structured values
 * — already computed by detect.ts from real invoice rows — and is told in as
 * many words that arithmetic is forbidden. But a prompt rule is a request, not a
 * mechanism, so the output is VALIDATED AT RUNTIME, not merely in tests: every
 * number is regex-extracted from the generated text and matched against the
 * structured inputs. A mismatch buys one retry naming the violation; a second
 * failure falls back to a deterministic template built from the same values.
 *
 * The reason this is worth the machinery: a finding's whole product is "here is
 * a rand figure you can act on". One hallucinated R14,000 that a bookkeeper
 * checks and cannot reproduce destroys trust in every finding that follows,
 * including the correct ones. A slightly stiff template sentence costs nothing.
 *
 * The validator is deliberately TOLERANT ABOUT FORMATTING and STRICT ABOUT
 * VALUE: "R 12,480.37", "R12 480.37", "12480.37" and "R12,480" (rounded to the
 * precision shown) all pass for the same input; 12,481 does not.
 *
 * Pure by construction — the Claude call is injected and defaults to a lazy
 * import of the server-only client, so the validator and the fallback are unit-
 * testable offline with canned text.
 */

// ---------------------------------------------------------------------------
// Types
//
// Local + minimal: detect.ts is being written in parallel and owns the real
// finding-candidate shape. This is the subset the writer needs.
// ---------------------------------------------------------------------------

export interface FindingFacts {
  /** Canonical item name, e.g. "Tomatoes Saladette". */
  itemName: string;
  /** Document-level supplier (`suppliers.name`). */
  supplierName: string;
  /** Per-line market agent, on market statements only. */
  lineSupplier?: string | null;
  /** 'kg' | 'unit' | 'l' — what the prices below are per. */
  baseUnit: string;
  /** Latest normalised unit price, in rand. */
  latestPrice: number;
  /** Trailing-window median normalised unit price, in rand. */
  medianPrice: number;
  /** How far above the median the latest price is, in percent. */
  deltaPct: number;
  /** Estimated annualised rand impact (signed: + costs more). */
  randImpact: number;
  /** ISO date, 'YYYY-MM-DD'. */
  windowStart: string;
  /** ISO date, 'YYYY-MM-DD'. */
  windowEnd: string;
  /** Number of source documents backing the finding (evidence_refs length). */
  evidenceCount: number;
}

/** Where the accepted text came from — recorded so tuning can measure fallbacks. */
export type ObservationSource = 'model' | 'model_retry' | 'template';

export interface ObservationResult {
  observation: string;
  recommendedAction: string;
  source: ObservationSource;
  /** Violations that forced the fallback. Empty when a model answer was accepted. */
  violations: string[];
}

export interface FidelityReport {
  ok: boolean;
  violations: string[];
  /** Every number token found in the text, as written. Useful in test output. */
  numbers: string[];
}

/** The single injectable seam. `attempt` is 1 for the first call, 2 for the retry. */
export type ObserveModelCall = (
  prompt: { system: string; user: string },
  attempt: number,
) => Promise<string>;

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Two short sentences. Over-long output is rejected, never truncated —
 *  cutting a string mid-number is exactly how a mangled figure gets published. */
export const OBSERVATION_MAX_CHARS = 320;
export const ACTION_MAX_CHARS = 200;

/** Float comparison slack: these are rand and percent, not physics. */
const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Formatting (shared by the fallback template and, implicitly, the prompt's
// worked examples — so the template always satisfies its own validator)
// ---------------------------------------------------------------------------

/** "1240.374" → "1,240.37". Hand-rolled rather than Intl: a locale change must
 *  never silently alter a figure the validator then rejects. */
export function formatRand(n: number): string {
  const fixed = Math.abs(n).toFixed(2);
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${grouped}.${frac}`;
}

/** "12.44" → "12.4". One decimal is how the UI shows a percentage move. */
export function formatPct(n: number): string {
  return n.toFixed(1);
}

/** Whole-day span of the trailing window, or null if a date is unparseable. */
export function windowDays(facts: FindingFacts): number | null {
  const a = Date.parse(`${facts.windowStart}T00:00:00Z`);
  const b = Date.parse(`${facts.windowEnd}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** "Botha Roodt at Johannesburg Fresh Produce Market", or just the supplier. */
function sellerLabel(facts: FindingFacts): string {
  const agent = facts.lineSupplier?.trim();
  return agent ? `${agent} at ${facts.supplierName}` : facts.supplierName;
}

// ---------------------------------------------------------------------------
// The number-fidelity validator
// ---------------------------------------------------------------------------

/**
 * Every number-shaped token in a piece of text.
 *
 * Two alternatives: grouped thousands first ("1,240.50", "1 240"), then plain
 * ("12.4", "60"). The `(?<![\d.])` guard stops a token starting mid-number, so
 * "12.50" yields one token rather than "12" and "50", and a hyphen that follows
 * a digit ("2026-08") cannot be read as a minus sign.
 */
const NUMBER_RE =
  /(?<![\d.])-?\d{1,3}(?:[ \u00a0,]\d{3})+(?:\.\d+)?|(?<![\d.])-?\d+(?:\.\d+)?/g;

/** ISO dates are structured inputs quoted verbatim; drop them before scanning
 *  so "2026-08-13" isn't dissected into three suspicious numbers. */
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

interface NumberToken {
  raw: string;
  value: number;
  /** Decimal places as WRITTEN — the precision the claim is made at. */
  decimals: number;
}

function tokenise(text: string): NumberToken[] {
  const scrubbed = text.replace(ISO_DATE_RE, ' ');
  const out: NumberToken[] = [];
  for (const m of scrubbed.matchAll(NUMBER_RE)) {
    const raw = m[0];
    // Thousands separators may be commas, plain spaces or non-breaking spaces.
    const bare = raw.replace(/[ \u00a0,]/g, '');
    const value = Number(bare);
    if (!Number.isFinite(value)) continue;
    const dot = bare.indexOf('.');
    out.push({ raw, value, decimals: dot === -1 ? 0 : bare.length - dot - 1 });
  }
  return out;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Numbers embedded in the names themselves ("Oranges 6kg Pocket") are legitimate
 *  for the model to echo, so they count as given values. */
function numbersInText(text: string | null | undefined): number[] {
  if (!text) return [];
  return tokenise(text).map((t) => t.value);
}

/**
 * The complete set of values the agent is allowed to write.
 *
 * Exported because "what counts as given" is the load-bearing definition here —
 * a test that asserts the allowed set is asserting the guarantee.
 */
export function allowedNumbers(facts: FindingFacts): number[] {
  const core = [
    facts.latestPrice,
    facts.medianPrice,
    facts.deltaPct,
    facts.randImpact,
    facts.evidenceCount,
  ];
  const days = windowDays(facts);
  if (days != null) core.push(days);

  const values = new Set<number>();
  for (const n of core) {
    if (!Number.isFinite(n)) continue;
    values.add(n);
    // A sign flip is a formatting choice ("R1,240 more" vs "-1240"), not a new
    // claim, so the magnitude is allowed too.
    values.add(Math.abs(n));
  }

  // Date components, for prose forms like "14 June 2026" that the ISO scrub
  // above does not cover.
  for (const iso of [facts.windowStart, facts.windowEnd]) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
    if (m) for (const part of m.slice(1)) values.add(Number(part));
  }

  // Numbers that are part of the given names.
  for (const s of [facts.itemName, facts.supplierName, facts.lineSupplier, facts.baseUnit]) {
    for (const n of numbersInText(s)) values.add(n);
  }

  return [...values];
}

/**
 * Check that every number in `text` corresponds to a structured input.
 *
 * A token matches a value if it equals it outright, OR equals it rounded to the
 * precision the token is written at — so "R12,480" is a valid way to write
 * 12480.37, but "R12,481" is not.
 */
export function verifyNumberFidelity(text: string, facts: FindingFacts): FidelityReport {
  const allowed = allowedNumbers(facts);
  const tokens = tokenise(text);
  const violations: string[] = [];

  for (const token of tokens) {
    const matched = allowed.some(
      (v) =>
        Math.abs(v - token.value) < EPSILON ||
        Math.abs(roundTo(v, token.decimals) - token.value) < EPSILON,
    );
    if (!matched) {
      violations.push(
        `the number "${token.raw}" does not correspond to any value you were given`,
      );
    }
  }

  return { ok: violations.length === 0, violations, numbers: tokens.map((t) => t.raw) };
}

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------

/**
 * The template used when the model cannot be trusted twice in a row.
 *
 * Built from the same structured values with the same formatters, so it passes
 * `verifyNumberFidelity` by construction (there is a test that asserts this —
 * a fallback that trips its own validator would be a silent disaster).
 * Deliberately exempt from the length limits: it is provably truthful, and
 * truncating it is the one thing that could make it untruthful.
 */
export function buildFallbackObservation(facts: FindingFacts): {
  observation: string;
  recommendedAction: string;
} {
  const seller = sellerLabel(facts);
  const docs = facts.evidenceCount === 1 ? 'document' : 'documents';
  const observation =
    `${facts.itemName} from ${seller} is now R ${formatRand(facts.latestPrice)} per ` +
    `${facts.baseUnit}, ${formatPct(facts.deltaPct)}% above its R ` +
    `${formatRand(facts.medianPrice)} median for ${facts.windowStart} to ` +
    `${facts.windowEnd} across ${facts.evidenceCount} ${docs}. At recent volumes ` +
    `that is about R ${formatRand(facts.randImpact)} a year.`;
  const recommendedAction =
    `Ask ${seller} to justify the ${facts.itemName} increase, or price the same ` +
    `line with an alternative supplier before the next order.`;
  return { observation, recommendedAction };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const OBSERVE_SYSTEM = `You write the observation and the recommended action for a "Price Watch" finding for an SME food & wholesale business in South Africa.

You are given a small set of STRUCTURED VALUES that were computed from the business's own supplier invoices. Those values are the only facts that exist. You have no other information about this business, this supplier or this product.

Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{"observation": string, "recommended_action": string}

Rules:
- "observation": 1 to 2 short, plain sentences, at most ${OBSERVATION_MAX_CHARS} characters in total. Say what changed, for which item and supplier, by how much, and what it costs over a year. Calm, specific, no filler, no markdown, no bullet points, no headings.
- "recommended_action": ONE line, at most ${ACTION_MAX_CHARS} characters, telling the owner what to do next. It is an instruction to a person — never an action you have taken or will take.
- NUMBERS — this is the rule that matters most. You may ONLY write numbers that appear in the structured values given to you. Do NOT calculate anything: no differences, no multiples, no "double", no "3x", no per-week or per-month figures, no percentages you worked out yourself, no totals. If you want to express something you have no number for, use words instead. Every digit you write is checked against the input, and the entire answer is discarded if a single number does not match.
- Formatting a given number is fine: "12480.37" may be written "R 12,480.37" or "R 12,480". Rounding to fewer decimals is fine. Changing the value is not.
- Percentages are written like "12.4%". Dates are written exactly as given.
- Do not speculate about WHY the price moved, do not promise a saving, and do not describe what the system will do next.`;

/** Build the prompt pair for one attempt. Pure; exported for tests. */
export function buildObservePrompt(
  facts: FindingFacts,
  violations: string[] = [],
): { system: string; user: string } {
  const payload = {
    item: facts.itemName,
    supplier: facts.supplierName,
    market_agent: facts.lineSupplier ?? null,
    price_unit: facts.baseUnit,
    latest_unit_price_rand: facts.latestPrice,
    median_unit_price_rand: facts.medianPrice,
    increase_percent: facts.deltaPct,
    estimated_annual_rand_impact: facts.randImpact,
    window_start: facts.windowStart,
    window_end: facts.windowEnd,
    window_days: windowDays(facts),
    evidence_documents: facts.evidenceCount,
  };

  // The retry names the exact violation rather than repeating "be careful" —
  // a model that invented a figure needs to know which one.
  const correction = violations.length
    ? `\n\nYour previous answer was REJECTED because ${violations.join('; ')}. ` +
      `Write it again using only the numbers in the values above. If you cannot ` +
      `make a sentence work without a number you were not given, leave that idea out.`
    : '';

  return {
    system: OBSERVE_SYSTEM,
    user: `STRUCTURED VALUES:\n${JSON.stringify(payload, null, 2)}${correction}`,
  };
}

// ---------------------------------------------------------------------------
// Parsing + validation of one attempt
// ---------------------------------------------------------------------------

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```$/, '')
    .trim();
}

/**
 * Parse and fully validate one model reply.
 *
 * Exported so tests can drive the whole accept/reject decision from a canned
 * string — including the shape checks, not just the number check.
 */
export function evaluateObservationReply(
  raw: string,
  facts: FindingFacts,
): { value: { observation: string; recommendedAction: string } | null; violations: string[] } {
  let obj: Record<string, unknown> | null = null;
  try {
    const cleaned = stripFences(raw);
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      obj = parsed as Record<string, unknown>;
    }
  } catch {
    obj = null;
  }
  if (!obj) {
    return { value: null, violations: ['the reply was not the required JSON object'] };
  }

  const observation = typeof obj.observation === 'string' ? obj.observation.trim() : '';
  const recommendedAction =
    typeof obj.recommended_action === 'string' ? obj.recommended_action.trim() : '';

  const violations: string[] = [];
  if (!observation) violations.push('"observation" was missing or empty');
  if (!recommendedAction) violations.push('"recommended_action" was missing or empty');
  if (observation.length > OBSERVATION_MAX_CHARS) {
    violations.push(
      `"observation" was ${observation.length} characters (the limit is ${OBSERVATION_MAX_CHARS})`,
    );
  }
  if (recommendedAction.length > ACTION_MAX_CHARS) {
    violations.push(
      `"recommended_action" was ${recommendedAction.length} characters (the limit is ${ACTION_MAX_CHARS})`,
    );
  }

  // Both fields are checked together: a number invented in the action line is
  // just as published as one in the observation.
  const fidelity = verifyNumberFidelity(`${observation} ${recommendedAction}`, facts);
  violations.push(...fidelity.violations);

  if (violations.length) return { value: null, violations };
  return { value: { observation, recommendedAction }, violations: [] };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Lazy so this module's static graph stays free of `server-only` and the SDK
 *  (see the equivalent note in match.ts). */
async function defaultCall(prompt: { system: string; user: string }): Promise<string> {
  const mod = await import('@/lib/ai/anthropic');
  return mod.runPriceWatchObservation(prompt);
}

/**
 * Generate the observation + recommended action for one finding.
 *
 * Attempt → validate → one retry naming the violation → deterministic template.
 * Never throws: a finding always gets text, because a finding with no
 * observation cannot be written to `agent_findings` (the column is NOT NULL)
 * and a real price increase must not be dropped because a model call failed.
 */
export async function generateObservation(
  facts: FindingFacts,
  call: ObserveModelCall = defaultCall,
): Promise<ObservationResult> {
  let lastViolations: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw: string;
    try {
      raw = await call(buildObservePrompt(facts, attempt === 1 ? [] : lastViolations), attempt);
    } catch (error) {
      // A transport failure is not a fidelity violation — don't feed it back to
      // the model as if it had written something wrong.
      lastViolations = [
        `the writing model could not be reached (${
          error instanceof Error ? error.message : 'unknown error'
        })`,
      ];
      break;
    }

    const { value, violations } = evaluateObservationReply(raw, facts);
    if (value) {
      return {
        observation: value.observation,
        recommendedAction: value.recommendedAction,
        source: attempt === 1 ? 'model' : 'model_retry',
        violations: [],
      };
    }
    lastViolations = violations;
  }

  const fallback = buildFallbackObservation(facts);
  return {
    observation: fallback.observation,
    recommendedAction: fallback.recommendedAction,
    source: 'template',
    violations: lastViolations,
  };
}
