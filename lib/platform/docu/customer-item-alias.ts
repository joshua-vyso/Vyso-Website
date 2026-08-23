/**
 * LEARNED, COUNTERPARTY-SCOPED PRODUCT LINKS — the key, the lookup and the
 * sentence the reviewer reads.
 *
 * WHY THIS EXISTS. `order-line-match.ts` is deliberately unable to learn. It
 * refuses anything short of identity, because every one of the Bakubung
 * misbillings was a near miss waved through, and a matcher that got *better* at
 * guessing would be a matcher that reintroduces them. So the review screen asks
 * a human — "Paper said 'VEG - SWEET CORN PKT Each' → not matched · closest:
 * Sweet Corn (kg) (80%) · confirm it" — and the human answers, and until now the
 * answer died with the document. The customer's next order asked the same
 * question again, and the one after that, forever. The matcher cannot be taught
 * and was never supposed to be; the CUSTOMER'S OWN VOCABULARY can be, and that
 * is a different fact stored in a different place.
 *
 * SCOPED TO ONE COUNTERPARTY, AND THAT IS NOT A LIMITATION — IT IS THE CLAIM.
 * "Strawberries" means the 250g punnets to Indaba because somebody at Indaba
 * writes it that way. It means nothing of the sort to Sandton Sun until somebody
 * confirms it there too, and a system that generalised the first ruling to the
 * second would be inventing a fact about a customer it has never been told
 * anything about. Every lookup here is keyed by `customer_id`; there is no
 * org-wide variant of it and there should not be one. (The org-wide table is
 * `pp_name_aliases`, and it is scoped that way for the opposite reason: it maps
 * what a SUPPLIER prints onto our own catalogue, where there is only one truth.)
 *
 * THE KEY IS DELIBERATELY BLUNT — lowercase, collapsed whitespace, and nothing
 * else. It is NOT `normalizeName`, and the difference matters more than it
 * looks: `normalizeName` throws packaging words away, so it folds
 * "SWEET CORN PKT" and "SWEET CORN BOX" onto one key. That is right for spotting
 * duplicate products and catastrophic here, because a learned link decides which
 * SKU gets billed and a packet is not a box. Whatever the paper says about the
 * pack stays in the key.
 *
 * PURE. No React, no Supabase, no dates-from-now. `.ts`-suffixed relative
 * imports: `node --test` strips types but resolves neither extensionless ESM
 * specifiers nor the `@/` alias.
 */

/** `source` on a row a reviewer confirmed on a document, vs one typed by hand. */
export const ALIAS_SOURCE_REVIEW_CONFIRM = 'review_confirm';

/** Just enough of a `cd_customer_item_aliases` row to resolve a line by. */
export interface CustomerItemAliasLite {
  customer_id: string;
  raw_name: string;
  stock_item_id: string | null;
  /** 'review_confirm' when learned in review; null/absent when hand-typed. */
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * The lookup key for a line's paper text.
 *
 * Lowercase + collapse runs of whitespace + trim. Case and stray spacing are
 * printer noise — the same POS prints "VEG - SWEET CORN PKT  Each" and
 * "VEG - Sweet Corn Pkt Each" on consecutive weeks — and folding them is the
 * whole reason a human confirms once rather than once per document. Everything
 * else in the string is evidence and survives, packaging words included: see
 * the docblock above for why that is not an oversight.
 *
 * Empty in → empty out, and an empty key never matches anything: a hand-added
 * review row has no paper behind it, so there is no ruling about a customer's
 * wording to be made from it.
 */
export function aliasKey(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Index one customer's aliases by key.
 *
 * `customerId` is required and rows belonging to anyone else are dropped, even
 * though the caller normally fetched with `.eq('customer_id', …)` already. The
 * belt and the braces are both wanted: this is the function a test can point at
 * to prove that the same raw text under a different customer resolves to
 * nothing, and a filter that only exists in a query string is a filter no test
 * can see. A null `customerId` — the customer is not known yet — yields an empty
 * index, because "which customer's vocabulary is this?" has no answer yet.
 *
 * Later rows win on a duplicate key, which is what "the human's latest decision
 * wins" means when two rows differ only in the casing the DB stored them under.
 * Order the input by `updated_at` ascending to make that the newest ruling.
 */
export function indexAliasesForCustomer<T extends CustomerItemAliasLite>(
  aliases: T[],
  customerId: string | null,
): Map<string, T> {
  const out = new Map<string, T>();
  if (!customerId) return out;
  for (const a of aliases) {
    if (a.customer_id !== customerId) continue;
    const key = aliasKey(a.raw_name);
    if (!key) continue;
    out.set(key, a);
  }
  return out;
}

/**
 * What this customer has ruled about this line's wording, if anything.
 *
 * The paper's own words first; a reader's rewrite is only consulted when the
 * paper text is missing, exactly as `resolveOrderLines` consults it — a rewrite
 * is a suggestion, and a suggestion is not what the human confirmed.
 */
export function lookupAlias<T extends CustomerItemAliasLite>(
  index: Map<string, T>,
  rawName: string | null | undefined,
  fallbackName?: string | null,
): T | null {
  const primary = aliasKey(rawName);
  if (primary) {
    const hit = index.get(primary);
    if (hit) return hit;
  }
  const secondary = aliasKey(fallbackName);
  if (secondary && secondary !== primary) return index.get(secondary) ?? null;
  return null;
}

// --- provenance -------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "23 Aug 2026" from an ISO timestamp, in UTC. Empty for anything unreadable. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Where a pinned line's product came from, in the reviewer's words.
 *
 * A line pinned by an alias shows this INSTEAD of the amber "not matched"
 * bubble — it is matched, at 100%, and the sentence says why we are entitled to
 * claim that. The two sources get two sentences on purpose: one of them is a
 * decision this person (or a colleague) made while looking at a real document,
 * and the other is a mapping typed into a settings screen. Printing "Learned
 * from your confirmation" over the second would be a small, load-bearing lie —
 * it is the sentence that tells a reviewer whether to go and look at the ruling
 * or at the settings page when the link turns out to be wrong.
 */
export function aliasProvenanceLabel(
  source: string | null | undefined,
  confirmedAt: string | null | undefined,
): string {
  if (source === ALIAS_SOURCE_REVIEW_CONFIRM) {
    const when = shortDate(confirmedAt);
    return when ? `Learned from your confirmation on ${when}` : 'Learned from your confirmation';
  }
  return 'From this customer’s order mappings';
}

// --- the bubble -------------------------------------------------------------

/**
 * What has happened to one line's learned link during THIS review session.
 *
 * `pending_customer` is the honest state and the reason this is a machine rather
 * than a boolean. A link is a fact about a named counterparty; if nobody has said
 * which counterparty this document is from, there is no fact yet — so the product
 * goes onto the line (that part is about this order and is safe) and the offer to
 * remember it is held open until a customer exists to remember it against.
 */
export type ConfirmStatus = 'saving' | 'saved' | 'pending_customer' | 'failed';

/** One line's in-session confirmation. Keyed by the row's React key. */
export interface LineConfirmation {
  /** The catalogue row the human chose. */
  stockItemId: string;
  productName: string;
  /** The paper's own words the link is keyed on. Empty → nothing to learn. */
  rawName: string;
  status: ConfirmStatus;
  /** Why the save failed, when it did. Shown verbatim; never swallowed. */
  message?: string | null;
}

export type BubbleState =
  /** The line is matched and nothing was confirmed here — no bubble. */
  | { kind: 'none' }
  /** Amber. The matcher would not claim this line; the ask is still open. */
  | { kind: 'unmatched' }
  /** Amber, transient. */
  | { kind: 'saving'; productName: string }
  /** Green. The link is stored against this customer. */
  | { kind: 'saved'; productName: string }
  /** Amber. Product set for this order; the link is waiting on a customer. */
  | { kind: 'pending_customer'; productName: string }
  /** Amber. The product is set, the link is not stored, and we say so. */
  | { kind: 'failed'; productName: string; message: string };

/**
 * The bubble one row shows, from what the last sync recorded and what the human
 * has done since.
 *
 * The confirmation wins whenever there is one. It has to: the record is what the
 * server believed when the document was last synced, and a reviewer who has just
 * clicked "Sweet Corn" must not be told the line is still unmatched because the
 * page has not been re-synced. It also wins over a MATCHED record — confirming a
 * product on a line the matcher had already claimed is a real thing to do (the
 * matcher can be confidently wrong) and it deserves the same green receipt.
 *
 * `recordMatched: null` means there is NO record — a document that has never
 * been synced, or a row the reviewer added by hand. That is not the same as
 * "not matched" and must not paint the row amber: nothing has been claimed
 * about the line yet, so there is nothing for a reviewer to answer.
 */
export function bubbleState(recordMatched: boolean | null, confirmation: LineConfirmation | null): BubbleState {
  if (confirmation) {
    const { productName, status, message } = confirmation;
    switch (status) {
      case 'saving':
        return { kind: 'saving', productName };
      case 'saved':
        return { kind: 'saved', productName };
      case 'pending_customer':
        return { kind: 'pending_customer', productName };
      case 'failed':
        return { kind: 'failed', productName, message: message ?? 'Could not save the link.' };
    }
  }
  return recordMatched === false ? { kind: 'unmatched' } : { kind: 'none' };
}

/** The sentence for a bubble state. Empty for the states that render no bubble. */
export function bubbleText(state: BubbleState): string {
  switch (state.kind) {
    case 'none':
    case 'unmatched':
      return '';
    case 'saving':
      return `Saving ${state.productName}…`;
    case 'saved':
      return `Saved. We’ll remember this link for next time — ${state.productName}.`;
    case 'pending_customer':
      return `Linked for this order. Pick the customer and we’ll remember it next time — ${state.productName}.`;
    case 'failed':
      return `Linked for this order, but not remembered — ${state.message}`;
  }
}

/** True when the state should paint the row green rather than amber. */
export function bubbleIsGood(state: BubbleState): boolean {
  return state.kind === 'saved';
}

/**
 * The confirmations still waiting on a customer, in row order.
 *
 * Drives the one-click "Remember these N links for {customer}?" offer that
 * appears the moment a customer IS picked. Deliberately an offer and not an
 * automatic write: the reviewer confirmed a product, which is a statement about
 * this order; teaching us a permanent fact about a named counterparty is a
 * second, larger thing, and it happened here only because they had not yet said
 * who the counterparty was. Asking costs one click and makes the scope of what
 * is being stored visible at the moment it is stored.
 */
export function pendingConfirmations(
  confirmations: Map<string, LineConfirmation>,
  order: string[],
): LineConfirmation[] {
  const out: LineConfirmation[] = [];
  for (const key of order) {
    const c = confirmations.get(key);
    if (c && c.status === 'pending_customer' && aliasKey(c.rawName) && c.stockItemId) out.push(c);
  }
  return out;
}
