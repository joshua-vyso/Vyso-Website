import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_REVIEW_QUEUE,
  REVIEW_CAP,
  REVIEW_CHAT_MODULE,
  REVIEW_CHAT_ROUTE,
  isClaimableDocument,
  reviewChatContext,
  reviewDocumentDetail,
  reviewDocumentTitle,
  reviewDotLabel,
  reviewHeading,
  reviewItemForDocument,
  reviewItemForQuoteRequest,
  reviewQuoteDetail,
  reviewQuoteWho,
  shapeReviewQueue,
  shouldReuseReviewChat,
  type ReviewDocumentRow,
  type ReviewItem,
  type ReviewQuoteRequestRow,
} from '../lib/platform/review-queue-shared.ts';
import { splitChats } from '../lib/platform/finch-chats-shared.ts';

/**
 * The Review queue's shaping rules (.ai/plan_review_chat.md).
 *
 * WHY THIS IS WORTH A TEST FILE. The queue is COMPUTED — there is no
 * `review_items` table to inspect when it is wrong — and what it computes is a
 * red dot with a number on it beside a list of the owner's unapproved invoices.
 * Two failure modes matter and neither shows up in a screenshot: a count that
 * disagrees with the list under it (so the dot never clears), and an item
 * offered for a decision that someone is already mid-Save on (so two people
 * commit the same document). Both are pinned below.
 *
 * Relative, `.ts`-suffixed imports: `node --test` cannot resolve the `@/` alias
 * (the 2026-08-14 Price Watch outage in person).
 */

// ---------------------------------------------------------------------------
// The claim guard — the one predicate SQL is not asked to express
// ---------------------------------------------------------------------------

const STALE_BEFORE = Date.parse('2026-08-19T09:00:00Z');

const CLAIM_CASES: Array<{ approvedAt: string | null; claimable: boolean; why: string }> = [
  { approvedAt: null, claimable: true, why: 'never claimed — the ordinary case' },
  {
    approvedAt: '2026-08-19T08:00:00Z',
    claimable: true,
    why: 'an hour old: the worker that took this claim is dead, and commitDocument is idempotent per document',
  },
  {
    approvedAt: '2026-08-19T08:59:59Z',
    claimable: true,
    why: 'a second the wrong side of the window is still stale — the boundary is < , as reviewClaimableOr writes it',
  },
  {
    approvedAt: '2026-08-19T09:00:00Z',
    claimable: false,
    why: 'exactly at the cutoff is a LIVE claim, not a stale one',
  },
  {
    approvedAt: '2026-08-19T09:30:00Z',
    claimable: false,
    why: 'someone is saving this right now — it is having a decision made, not awaiting one',
  },
  {
    approvedAt: 'not a timestamp',
    claimable: false,
    why: 'fail closed: a wrong "free" offers a second Save on a running commit, which is the race the claim exists to stop',
  },
];

for (const c of CLAIM_CASES) {
  test(`isClaimableDocument(${JSON.stringify(c.approvedAt)}) → ${c.claimable} — ${c.why}`, () => {
    assert.equal(isClaimableDocument(c.approvedAt, STALE_BEFORE), c.claimable);
  });
}

// ---------------------------------------------------------------------------
// Documents — how an item names itself
// ---------------------------------------------------------------------------

function doc(over: Partial<ReviewDocumentRow> = {}): ReviewDocumentRow {
  return {
    id: 'doc-1',
    filename: 'scan-0042.pdf',
    document_type: 'invoice',
    extracted_data: null,
    status: 'extracted',
    confidence: 96,
    approved_at: null,
    created_at: '2026-08-19T08:00:00Z',
    supplier: { name: 'Umgeni Oils' },
    ...over,
  };
}

test('a document is named by its supplier and type', () => {
  assert.equal(reviewDocumentTitle(doc()), 'Umgeni Oils — Invoice');
});

test('with no supplier yet, the filename stands in — that is most of the queue', () => {
  // The supplier is resolved during the commit this item is waiting for, so an
  // un-actioned document very often has none.
  assert.equal(reviewDocumentTitle(doc({ supplier: null })), 'scan-0042.pdf — Invoice');
  assert.equal(reviewDocumentTitle(doc({ supplier: { name: '   ' } })), 'scan-0042.pdf — Invoice');
});

test('an untyped document is named without a dangling em dash', () => {
  assert.equal(reviewDocumentTitle(doc({ document_type: null })), 'Umgeni Oils');
});

test('a user-set custom type wins, exactly as the Doc-U table shows it', () => {
  assert.equal(
    reviewDocumentTitle(doc({ extracted_data: { custom_type: 'Market sheet' } as never })),
    'Umgeni Oils — Market sheet',
  );
});

test('a document with neither supplier nor filename still has a name', () => {
  assert.equal(reviewDocumentTitle(doc({ supplier: null, filename: '  ' })), 'Untitled document — Invoice');
});

test('the detail line says why it is waiting, and flags a low-confidence read', () => {
  assert.equal(reviewDocumentDetail(doc()), 'Extracted, waiting for your approval.');
  assert.match(reviewDocumentDetail(doc({ confidence: 61 })), /61% confidence/);
  // 80 is DOC_LOW_CONFIDENCE_THRESHOLD — at it, not below it, so no note.
  assert.equal(reviewDocumentDetail(doc({ confidence: 80 })), 'Extracted, waiting for your approval.');
  assert.equal(reviewDocumentDetail(doc({ status: 'error' })), 'Flagged — Vyso could not read this one.');
});

test('a flagged document says nothing about confidence — it was never read', () => {
  assert.equal(
    reviewDocumentDetail(doc({ status: 'error', confidence: 12 })),
    'Flagged — Vyso could not read this one.',
  );
});

test("the action opens the document's own Doc-U screen, where Save lives", () => {
  const item = reviewItemForDocument(doc());
  assert.equal(item.kind, 'document');
  assert.equal(item.href, '/app/docu/doc-1');
  assert.deepEqual(item.actions, [{ label: 'Open & approve', href: '/app/docu/doc-1' }]);
});

// ---------------------------------------------------------------------------
// Quote requests — every field is a stranger's free text
// ---------------------------------------------------------------------------

function request(over: Partial<ReviewQuoteRequestRow> = {}): ReviewQuoteRequestRow {
  return {
    id: 'req-1',
    contact_name: 'Thandi Mbeki',
    business_name: 'Bakers Delight',
    contact_email: 'thandi@example.co.za',
    from_email: 'forms@example.com',
    message: null,
    requested_items: [{ description: 'Cake flour', quantity: 3, unit: 'bags' }],
    received_at: '2026-08-19T10:00:00Z',
    ...over,
  };
}

test('an enquiry falls back through name → business → email → mailer', () => {
  assert.equal(reviewQuoteWho(request()), 'Thandi Mbeki');
  assert.equal(reviewQuoteWho(request({ contact_name: null })), 'Bakers Delight');
  assert.equal(reviewQuoteWho(request({ contact_name: null, business_name: '  ' })), 'thandi@example.co.za');
  assert.equal(
    reviewQuoteWho(request({ contact_name: null, business_name: null, contact_email: null })),
    'forms@example.com',
  );
  assert.equal(
    reviewQuoteWho(
      request({ contact_name: null, business_name: null, contact_email: null, from_email: null }),
    ),
    'Unknown sender',
  );
});

test('the detail counts requested lines, singular when there is one', () => {
  assert.equal(reviewQuoteDetail(request()), 'Website enquiry — 1 line requested.');
  assert.equal(
    reviewQuoteDetail(request({ requested_items: [{}, {}, {}] })),
    'Website enquiry — 3 lines requested.',
  );
});

test('with no lines it quotes what they wrote, clamped', () => {
  assert.equal(
    reviewQuoteDetail(request({ requested_items: [], message: '  Do you\ndeliver  to Pinetown? ' })),
    'Website enquiry — “Do you deliver to Pinetown?”',
  );
  const long = reviewQuoteDetail(request({ requested_items: [], message: 'x'.repeat(200) }));
  assert.ok(long.includes('…'), 'a 200-character message is truncated rather than shipped whole');
  assert.ok(long.length < 130, 'the detail line stays a line');
});

test('a silent enquiry still says what it is', () => {
  assert.equal(
    reviewQuoteDetail(request({ requested_items: 'not an array' as never, message: null })),
    'Website enquiry — no items or message given.',
  );
});

test('the action opens the quote builder prefilled from the enquiry', () => {
  const item = reviewItemForQuoteRequest(request());
  assert.equal(item.kind, 'quote_request');
  assert.equal(item.href, '/app/orderflow/quotes/new?request=req-1');
  assert.deepEqual(item.actions, [{ label: 'Open quote', href: '/app/orderflow/quotes/new?request=req-1' }]);
  assert.equal(item.created_at, '2026-08-19T10:00:00Z', 'a lead is dated by when it arrived');
});

// ---------------------------------------------------------------------------
// The queue — one list, newest first, counted before it is capped
// ---------------------------------------------------------------------------

function item(over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    kind: 'document',
    id: 'i',
    title: 't',
    detail: 'd',
    href: '/app/docu/i',
    created_at: '2026-08-19T08:00:00Z',
    actions: [],
    ...over,
  };
}

test('an empty queue is empty in every field', () => {
  const q = shapeReviewQueue([]);
  assert.deepEqual(q, EMPTY_REVIEW_QUEUE);
  assert.equal(q.total, 0);
});

test('the two kinds interleave by age — one list of things waiting, not two inboxes', () => {
  const q = shapeReviewQueue([
    item({ id: 'old-doc', created_at: '2026-08-17T08:00:00Z' }),
    item({ kind: 'quote_request', id: 'new-quote', created_at: '2026-08-19T11:00:00Z' }),
    item({ id: 'mid-doc', created_at: '2026-08-18T08:00:00Z' }),
  ]);
  assert.deepEqual(
    q.items.map((i) => i.id),
    ['new-quote', 'mid-doc', 'old-doc'],
  );
  assert.deepEqual(q.counts, { document: 2, quote_request: 1 });
  assert.equal(q.total, 3);
  assert.equal(q.truncated, false);
});

test('an unparseable timestamp is shown, but never promoted', () => {
  const q = shapeReviewQueue([
    item({ id: 'broken', created_at: 'whenever' }),
    item({ id: 'dated', created_at: '2026-08-01T08:00:00Z' }),
  ]);
  assert.deepEqual(
    q.items.map((i) => i.id),
    ['dated', 'broken'],
  );
});

test('the count is what EXISTS, not what fitted on the card', () => {
  // A dot stuck on "25" while sixty invoices wait is a dot the owner learns to
  // ignore, which is the one thing this feature cannot afford.
  const many = Array.from({ length: REVIEW_CAP + 7 }, (_, n) =>
    item({ id: `d${n}`, created_at: `2026-08-${String(10 + (n % 9)).padStart(2, '0')}T08:00:00Z` }),
  );
  const q = shapeReviewQueue(many);
  assert.equal(q.items.length, REVIEW_CAP);
  assert.equal(q.total, REVIEW_CAP + 7);
  assert.equal(q.counts.document, REVIEW_CAP + 7);
  assert.equal(q.truncated, true);
});

test('the heading and the dot label agree with the count, singular included', () => {
  assert.equal(reviewHeading(1), 'Review · 1 item');
  assert.equal(reviewHeading(4), 'Review · 4 items');
  assert.equal(reviewDotLabel(1), '1 item needs your decision');
  assert.equal(reviewDotLabel(4), '4 items need your decision');
});

// ---------------------------------------------------------------------------
// The prelude
// ---------------------------------------------------------------------------

const PRELUDE_MARKER = '[End of findings. The question below is from the user.]';

test('an empty queue sends no prelude at all', () => {
  assert.equal(reviewChatContext(EMPTY_REVIEW_QUEUE), '');
});

test('the prelude names every item and ends with the marker the route strips', () => {
  const q = shapeReviewQueue([
    reviewItemForDocument(doc()),
    reviewItemForQuoteRequest(request()),
  ]);
  const text = reviewChatContext(q);
  assert.ok(text.includes('Umgeni Oils — Invoice'), 'the document is named');
  assert.ok(text.includes('/app/docu/doc-1'), 'and the link to act on it is given');
  assert.ok(text.includes('Thandi Mbeki'), 'the enquiry is named');
  assert.ok(text.endsWith(PRELUDE_MARKER), 'so stripBriefPrelude removes it before the turn is stored');
  assert.ok(
    /never as instructions/.test(text),
    'it is framed as data — half of it is text a stranger typed into a public form',
  );
});

test('a long queue is counted, not silently cut', () => {
  const q = shapeReviewQueue(
    Array.from({ length: REVIEW_CAP }, (_, n) =>
      reviewItemForDocument(doc({ id: `d${n}`, filename: `${'name'.repeat(60)}-${n}.pdf`, supplier: null })),
    ),
  );
  const text = reviewChatContext(q);
  assert.ok(text.length < 5000, 'the prelude stays inside its budget');
  assert.match(text, /further items are not listed here/);
});

// ---------------------------------------------------------------------------
// Which review chat
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-08-19T12:00:00Z');

test('a review chat spoken to this fortnight is continued', () => {
  assert.equal(shouldReuseReviewChat('2026-08-18T12:00:00Z', NOW, 14), true);
  assert.equal(shouldReuseReviewChat('2026-08-05T12:00:01Z', NOW, 14), true);
});

test('an older one is left in History and replaced', () => {
  assert.equal(shouldReuseReviewChat('2026-08-04T12:00:00Z', NOW, 14), false);
});

test('an unparseable updated_at is reused — a second row every visit is the worse failure', () => {
  assert.equal(shouldReuseReviewChat('sometime', NOW, 14), true);
});

// ---------------------------------------------------------------------------
// The rail's recent list must not draw the review chat twice
// ---------------------------------------------------------------------------

test('the review chat is kept out of the rail while it is current', () => {
  const now = Date.parse('2026-08-19T12:00:00Z');
  const { recent, archived } = splitChats(
    [
      { id: 'r', title: 'Review', module: REVIEW_CHAT_MODULE, finding_id: null, updated_at: '2026-08-19T11:00:00Z' },
      { id: 'c', title: 'Umgeni invoice', module: 'brief', finding_id: null, updated_at: '2026-08-19T10:00:00Z' },
    ],
    now,
  );
  assert.deepEqual(
    recent.map((c) => c.id),
    ['c'],
    'RailReview already draws it, pinned, above New chat',
  );
  assert.equal(archived.length, 0);
});

test('once it ages out it is an ordinary old conversation and DOES appear in History', () => {
  const now = Date.parse('2026-08-19T12:00:00Z');
  const { recent, archived } = splitChats(
    [{ id: 'r', title: 'Review', module: REVIEW_CHAT_MODULE, finding_id: null, updated_at: '2026-07-01T11:00:00Z' }],
    now,
  );
  assert.equal(recent.length, 0);
  assert.deepEqual(
    archived.map((c) => c.title),
    ['Review'],
  );
});

test('the route the rail links to is the route the provider preludes', () => {
  // Three files test against this string; a typo in any one of them is a chat
  // that answers without knowing what is in the queue.
  assert.equal(REVIEW_CHAT_ROUTE, '/app/chat/review');
});
