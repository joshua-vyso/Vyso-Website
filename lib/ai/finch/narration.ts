/**
 * What Finch SAID on the way to the answer, versus the answer.
 *
 * THE BUG THIS EXISTS FOR. The agentic loop in app/api/ai/agent/route.ts runs
 * up to five model turns, and a turn that ends by calling a tool can still emit
 * text first — "I'll look up the cooking oil price history and see who else
 * supplies it." The route used to accumulate every text delta of every turn
 * into one string, so the owner read:
 *
 *   "I'll look up the cooking oil price history and see who else supplies
 *    it.Now let me get the price history over the past 12 months.Cooking Oil
 *    is up 19%…"
 *
 * Three sentences from three different moments, glued with no space, the first
 * two of which are the model talking to itself. That is not a formatting nit:
 * the first sentence promises something in the future tense that has already
 * happened by the time it is read, which makes the whole answer read as if it
 * had not finished.
 *
 * THE RULE. A turn whose `stop_reason` is `tool_use` was on its way somewhere —
 * its text is INTERIM. The answer is the text of the turn that stopped because
 * it had finished talking. Interim text is shown live, under the ✦ status
 * lines, as the muted aside it is; it is never stored, because a week later
 * "let me get the price history" is not something Finch has to say for itself.
 *
 * PURE, NO IMPORTS. The route (server), the provider (client) and the tests all
 * read the same two functions — a second copy of "which text was the answer"
 * living on the client is exactly how a transcript and a stored row end up
 * disagreeing about what Finch said.
 */

/** One turn's worth of assistant text, and whether the turn then called tools. */
export interface TurnText {
  /** The loop iteration this text was emitted on. */
  turn: number;
  text: string;
  /** True when the turn ENDED by calling a tool — the text was narration on
   *  the way to the answer, not the answer. */
  interim: boolean;
}

/**
 * Turns → the muted asides and the answer body.
 *
 * The answer joins any non-interim turns with a blank line rather than taking
 * only the last: the loop can only produce one of them today (it breaks the
 * moment a turn does not call tools), and if that ever changes, a paragraph
 * break is a better failure than a silently dropped paragraph.
 */
export function splitTurnText(turns: readonly TurnText[]): { interim: string[]; answer: string } {
  const interim: string[] = [];
  const answer: string[] = [];
  for (const t of turns) {
    const text = (t.text ?? '').trim();
    if (!text) continue;
    if (t.interim) interim.push(text);
    else answer.push(text);
  }
  return { interim, answer: answer.join('\n\n') };
}

/**
 * Collapse runs of the same line.
 *
 * The margin question calls `pw_margin_exposure` twice when the first call is
 * refined (once with a supplier, once without), and the owner saw
 * "✦ Sizing the margin effect…" twice in a row — which reads as a stutter, or
 * worse, as two different things being sized. CONSECUTIVE only: the same tool
 * called again after a different one really is a second look, and hiding that
 * would misreport what the answer was built from.
 */
export function dedupeConsecutive(lines: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const line of lines ?? []) {
    if (out.length === 0 || out[out.length - 1] !== line) out.push(line);
  }
  return out;
}
