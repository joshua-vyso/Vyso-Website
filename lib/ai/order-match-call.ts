import 'server-only';
import { openaiConfigured, openaiJson } from './openai';
import {
  MATCH_AGENT_SYSTEM,
  buildAgentUserMessage,
  parseAgentDecisions,
  type MatchAgentDecision,
  type MatchAgentLine,
} from '@/lib/platform/docu/order-match-agent';

/**
 * Transport for the matching agent. Deliberately dumb: lines in, decisions out.
 *
 * A SECOND, INDEPENDENT CALL — its own model var, its own prompt, its own
 * budget. It shares the provider plumbing with the reader and nothing else,
 * because the two jobs failed for opposite reasons: the reader was failing by
 * seeing catalogue words on the page, and the matcher fails by not seeing the
 * catalogue at all. Giving them one call is what made the reader hallucinate
 * produce.
 *
 * FAILURE IS NOT AN ERROR HERE. Every fault — no key, a rejected model, a
 * timeout, unreadable JSON — returns an empty decision list, which leaves every
 * deterministic verdict from `order-line-match.ts` exactly where it was. The
 * agent can only ever improve on the gate or be absent; it cannot break it.
 */

/**
 * How long the agent may take, and it must be SHORTER THAN THE ROUTE THAT
 * CONTAINS IT.
 *
 * It was 90 seconds, inside `/api/orderflow/order-from-document` (maxDuration
 * 60) and inside `/api/ai/extract` (60 at the time) — a sub-call budgeted for
 * longer than the whole invocation it runs in. That is not a slow agent, it is
 * a guarantee that the work AFTER it never happens, and the work after it is
 * the `order_lines` audit trail the review screen draws every annotation from.
 * On 23 Aug 2026 an order read at 08:01 reached `status: 'extracted'` with 22
 * perfect line items and no `order_lines` at all, because the invocation was
 * killed before the write.
 *
 * 30 seconds is generous for a JSON reply about a handful of unsettled lines,
 * and leaves room in every route budget for the writes that follow. A timeout
 * here is not a failure — `runOrderMatchAgent` returns `[]` and the
 * deterministic verdicts stand, which is the whole design.
 */
export const ORDER_MATCH_AGENT_TIMEOUT_MS = 30_000;

/** The OpenAI model the matching agent uses. */
export function openaiMatchModel(): string {
  return (process.env.OPENAI_MATCH_MODEL ?? '').trim() || 'gpt-5.6-luna';
}

/**
 * Ask the agent to decide the lines the deterministic gate could not.
 *
 * Returns `[]` on anything short of a readable answer — see above. The reason is
 * logged rather than thrown: a matching agent that can take down an upload is a
 * worse product than one that is quietly unavailable, because the deterministic
 * result it would have improved on is already correct-or-honest by construction.
 */
export async function runOrderMatchAgent(requests: MatchAgentLine[]): Promise<MatchAgentDecision[]> {
  if (requests.length === 0) return [];
  if (!openaiConfigured()) return [];

  try {
    const raw = await openaiJson({
      model: openaiMatchModel(),
      system: MATCH_AGENT_SYSTEM,
      prompt: buildAgentUserMessage(requests),
      // No image: the agent decides from the paper's own words, which the reader
      // has already transcribed verbatim. Handing it the picture again would
      // invite it to re-read rather than to choose.
      maxTokens: 8_000,
      timeoutMs: ORDER_MATCH_AGENT_TIMEOUT_MS,
    });
    return parseAgentDecisions(raw);
  } catch (e) {
    console.warn('[order-match-agent] falling back to the deterministic matcher:', e);
    return [];
  }
}
