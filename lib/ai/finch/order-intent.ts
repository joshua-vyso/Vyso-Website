/**
 * "Is the owner asking me to build an order?" — one copy, two readers
 * (`.ai/plan_brief_chat_v2.md` W4).
 *
 * WHY IT IS ITS OWN FILE. This regex decides which MODEL answers: a match
 * escalates the turn to the Sonnet workflow tier and puts
 * `orderflow_prepare_order` on the table (app/api/ai/agent/route.ts). It was
 * written twice — once on the server, once in FinchModal — and the two copies
 * had to agree or the client would arm order-building for a turn the server
 * then answered on the cheap tier with no order tool offered, which reads to
 * the owner as Finch simply ignoring them. FinchModal is deleted this wave and
 * the dock inherits its job, so the regex moved here rather than being pasted a
 * third time.
 *
 * NO IMPORTS, ON PURPOSE: the server route and a client component both take it.
 */

/**
 * A create-an-order request in the owner's own words.
 *
 * Deliberately loose — a false positive costs one Q&A turn on a pricier model,
 * a false negative costs the feature. The `[\s\S]{0,24}` gap is what lets
 * "make me a new order", "put together an order" and "draft an order" all land
 * while "in order to" (no verb in front) does not.
 */
export const CREATE_ORDER_RE =
  /\b(create|creating|make|making|start|place|build|draft|new|set up|put together|prepare)\b[\s\S]{0,24}\border\b|\border\s+for\b/i;

/** `CREATE_ORDER_RE.test`, minus the `lastIndex` foot-gun and the import of a
 *  raw regex into a component. */
export function looksLikeOrderRequest(text: string): boolean {
  return CREATE_ORDER_RE.test(text ?? '');
}

/**
 * "I made a batch" in the owner's own words (Manufacturing C2).
 *
 * SAME JOB AS `CREATE_ORDER_RE`, DIFFERENT TIER TRIGGER: a match escalates a
 * ProcurePulse (or Brief) turn to the workflow tier and puts
 * `pp_prepare_batch_log` on the table. Without it the sentence lands on Haiku
 * with no batch tool offered, and Finch explains how to log a batch by hand —
 * which reads as it ignoring what was just said.
 *
 * THREE PHRASINGS, BECAUSE JOSH'S OWN SENTENCE IS THE HARDEST ONE. "used
 * butternut 0.6 kg and broc 1.0 kg. create a product entry using recipe mixed
 * veg" never says "batch" at all — it is recognised by `recipe` appearing
 * alongside a used/made/create verb. The other two are the short forms people
 * actually type once they trust it: "log a batch", "made a batch of coleslaw".
 *
 * Loose on purpose, like its neighbour: a false positive costs one Q&A turn on
 * a pricier model, a false negative costs the feature.
 */
export const LOG_BATCH_RE =
  /\b(log|logged|record|create|creating|make|made|making|produce|produced|run|ran)\b[\s\S]{0,24}\bbatch\b|\bbatch\s+of\b|\b(used|use|using|took|made|make|create|creating|add)\b[\s\S]{0,80}\brecipe\b|\brecipe\b[\s\S]{0,40}\b(batch|made|produced)\b/i;

/** `LOG_BATCH_RE.test`, for the same two reasons as `looksLikeOrderRequest`. */
export function looksLikeBatchRequest(text: string): boolean {
  return LOG_BATCH_RE.test(text ?? '');
}
