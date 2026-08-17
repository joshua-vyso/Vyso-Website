/**
 * Price Watch model transport — prompt in, raw model text out.
 *
 * WHY THIS FILE EXISTS (2026-08-14 incident): match.ts and observe.ts each
 * defaulted to `await import('@/lib/ai/anthropic')`. That resolves under
 * Next/Turbopack and nowhere else — the `@/` alias is a bundler construct, and
 * anthropic.ts opens with `import 'server-only'`, which THROWS the moment a
 * plain node or tsx process loads it. The backfill CLI is a plain node process,
 * so every match and every observation call it ever made failed. The designed
 * fallbacks absorbed it perfectly (review queue, template observation), which is
 * exactly why nobody noticed for two full runs.
 *
 * So the transport lives here instead: no `server-only` marker, no `@/` alias,
 * no imports beyond the SDK itself — importable from a route handler, a script,
 * or a test alike. lib/ai/anthropic.ts delegates its two Price Watch helpers to
 * these functions, so there is still exactly ONE place in this codebase that
 * constructs an Anthropic client, which is the rule that file sets out.
 *
 * SERVER/CLI ONLY. Without the `server-only` marker nothing stops a client
 * component importing this at build time, so treat that as a review error. The
 * key itself cannot leak: ANTHROPIC_API_KEY is a non-NEXT_PUBLIC variable, so in
 * a browser bundle it is simply undefined and `client()` throws.
 *
 * Deliberately DUMB: shortlisting, JSON parsing, the ≥0.9 auto-link rule and the
 * number-fidelity validator all live in the pure price-watch modules. Nothing
 * here decides anything.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ModelPrompt {
  system: string;
  user: string;
}

// Default tier is Sonnet, not Opus (plan_brief_chat_v2.md §2.7 — no code path may
// reference an Opus id as a default). This file still can't import lib/ai/anthropic.ts's
// own default (see file header: `server-only` throws under the backfill CLI's plain
// node process), so the default has to be repeated here rather than imported.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
/** Product-name matching: pick the right canonical from a short candidate list. */
const MATCH_MODEL = process.env.ANTHROPIC_MATCH_MODEL || 'claude-haiku-4-5';
/** Observation text is the only agent output a human reads verbatim, so it runs
 *  on the strong default tier rather than Haiku (plan D3). */
const OBSERVE_MODEL = process.env.ANTHROPIC_OBSERVE_MODEL || MODEL;

/** True when a key is present. Callers use it to fail loudly and early. */
export function priceWatchModelConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  // Read at call time, not at module load: the backfill CLI parses .env.local
  // itself and populates process.env AFTER this module is imported.
  return new Anthropic({ apiKey });
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/**
 * Claude models from Opus 4.7 onward (plus Sonnet 5 / Fable 5 / Mythos 5)
 * REMOVED the sampling parameters: sending `temperature` at all returns a 400,
 * not a warning. Mirrors the identical guard in lib/ai/anthropic.ts.
 */
const SAMPLING_REMOVED = /(opus-4-[78]|opus-5|sonnet-5|fable-5|mythos-5)/;
function samplingParams(model: string): { temperature?: number } {
  return SAMPLING_REMOVED.test(model) ? {} : { temperature: 0 };
}

/** Canonical-item matching for one Doc-U line. Haiku tier. */
export async function priceWatchMatchCall(prompt: ModelPrompt): Promise<string> {
  const message = await client().messages.create({
    model: MATCH_MODEL,
    // The reply is a single small JSON object; anything longer is malformed
    // output, which the caller routes to review rather than salvaging.
    max_tokens: 400,
    ...samplingParams(MATCH_MODEL),
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  return textOf(message);
}

/** Observation + recommended action for one finding. Default (Opus) tier. */
export async function priceWatchObservationCall(prompt: ModelPrompt): Promise<string> {
  const message = await client().messages.create({
    model: OBSERVE_MODEL,
    // Two short sentences plus a one-liner, as JSON. Generous enough that a
    // truncation never silently mangles a number mid-digit.
    max_tokens: 700,
    ...samplingParams(OBSERVE_MODEL),
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  return textOf(message);
}
