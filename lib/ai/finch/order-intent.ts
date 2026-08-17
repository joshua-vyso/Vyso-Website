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
