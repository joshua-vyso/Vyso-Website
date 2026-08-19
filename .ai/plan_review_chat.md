# Plan: "Review" — an auto-opening chat under Today's brief for items that need a human decision

Status: **approved by Josh 2026-08-18** ("a new chat open beneath today's brief if any items need attention. e.g. if the
system picks up a new quote request, a new chat automatically opens called 'Review', where user can take immediate
action. if any documents are uploaded, review opens with direct link to check and approve that doc. once all review
items are done, the review chat goes away. it'll come back when new items are ready for review. have the button itself
subtly emit light ebbing borders, as well as a small red dot similar to how notifications are universally").
Architect: Fable. Implementer: one Opus agent on `main`, AFTER Plugins X1 lands (shared rail files).

## What "needs review" means (v1 — the queue is computed, never stored)
`lib/platform/review-queue.ts` (server, RLS client, `.eq('org_id')`) returns `ReviewItem[]`, each `{kind, id, title,
detail, href, created_at, actions:[{label, href}]}`, newest first, capped 25, plus counts by kind:
1. **Documents awaiting review** — `documents` where the Doc-U review queue would show them (read `lib/platform/docu/*`
   + `app/app/docu/review` / `awaiting` / `flagged` pages to reuse THEIR predicates exactly: extracted-but-unapproved,
   flagged, low-confidence): title "{supplier or filename} — {type}", href `/app/docu/[id]`, actions "Open & approve".
2. **Quote requests** — `of_quote_requests` (see `supabase/quote-requests.sql`, `app/app/orderflow/quotes`) in their
   "new/unanswered" status: href to the quote screen; action "Open quote".
3. **Price Watch review queue** — `pw_item_matches` `status='review'` grouped: one item "N supplier lines need a match
   decision" → href `/app/plugins/xero`? NO — there is no review UI (known gap); include only if a screen exists; else omit
   and note.
4. **Findings marked `in_progress` older than 7 days**? No — out of scope; keep the queue to things with an approve/act
   screen. Extensible registry: `REVIEW_SOURCES = [{kind, load(supabase, orgId)}]`.
Members vs admins: documents + quotes are operational, so the Review chat is visible to **any** user whose module access
includes Doc-U/OrderFlow (`features`/`lockedModules`); money-only kinds (none in v1) would be `canSeeMoney`.

## Rail behaviour
- `RailChats.tsx` gains a first, pinned row **"Review"** (icon: small tick-in-circle) rendered ONLY when
  `reviewCount > 0`, placed directly under "Today's brief" and above "New chat". It carries: a **red notification dot**
  (`#D64545`-ish, 8 px, top-right of the icon, with the count as `aria-label`), and a **subtle ebbing glow border** —
  a 1 px border whose colour/box-shadow breathes between two low-alpha values of the AI gradient blue over ~2.4 s
  (`@keyframes vyso-ebb`, opacity 0.35↔0.85; `prefers-reduced-motion` → static border, dot stays). Tokens from
  `app/globals.css` (`--fn-*`/`--pf-*`); do NOT add the animated `finch-gradient` fill (rationed) — border + shadow only.
- `MobileDrawer` mirrors it. Layout fetches `loadReviewQueue()` (in the same `Promise.all` as findings/chats — one query
  per source, cheap) and passes `reviewCount` + items to rail and page.

## The Review chat
- Route `/app/chat/review` (`app/app/chat/review/page.tsx`, server). Not a normal `finch_chats` row: it is a **system
  conversation** whose opening card is regenerated from the live queue on every visit (deterministic template, ZERO model
  calls): "Review · {N} items" heading; grouped list — Documents (each: title, detail, "Open & approve →" link),
  Quote requests (each: "Open quote →"); a one-line "When these are done this chat closes itself." Below it, a real
  persisted chat so the user can ask Finch about any item: use W1's `finch_chats` with `module='review'` — the data
  module exposes `getOrCreateReviewChat(orgId, userId)` returning the single open review chat for this user (created
  on first visit while `reviewCount>0`); when a visit finds `reviewCount===0`, the page shows "Nothing to review — all
  clear" and the rail row is hidden; the chat row is left in place (its transcript is history) but is not listed under
  recent chats (filter `module='review'` out of `RailChats` recent list; it appears in History as "Review (closed)"
  when older than 14 d like any other). Next time the queue is non-empty and the previous review chat has messages,
  **reuse it if it was active in the last 14 d, else create a new one** — smallest honest option; record it.
- Chat context: the provider's `send()` on this route includes the queue as a prelude on the first turn (same mechanism
  as `briefChatContext`, capped 4 kB), so "what's in the flagged invoice?" works via `docu_get_document_summary`. Tools =
  `brief` set + `docu` set (+ orderflow quote lookup if a tool exists; don't add write tools — approvals happen on the
  Doc-U/quote screens; say so in knowledge).
- Doc Watch synergy: when a document is uploaded via chat (W5), it lands in the queue if Doc-U's predicate says it needs
  review — nothing extra to build; verify.

## Files
Create: `lib/platform/review-queue.ts` (+ `-shared.ts` pure: grouping, cap, count text; tests
`tests/review-queue.test.ts`), `app/app/chat/review/page.tsx`, `components/platform/chat/ReviewOpening.tsx`,
`components/platform/shell/RailReview.tsx` (row + dot + ebb), CSS keyframes in `app/globals.css` (one small block,
commented). Modify: `app/app/layout.tsx`, `components/platform/shell/{RailNav or RailChats,MobileDrawer,
FinchChatProvider}.tsx` (review prelude on `/app/chat/review`), `lib/platform/finch-chats.ts` (`getOrCreateReviewChat`,
filter in `listChats`), `lib/ai/finch/knowledge.ts` (Review paragraph), `.ai/implementation.md`.
Do not touch: agents, price-watch, plugins (X1/X2 files), marketing.

## Edge cases
Queue changes while the page is open → the opening card refreshes on `router.refresh()` after any Finch turn and on
navigation; approving on Doc-U and coming back → count drops; two users → each has their own review chat; a doc both
uploaded-by-chat and awaiting review → appears once; queue > 25 → "and N more" link to `/app/docu/review`; no Doc-U or
OrderFlow enabled → those sources skipped; `finch_chats` migration missing → the opening card still renders, chat below
degrades like W1.

## Verification
Unit tests for the pure shaping; tsc/test/build/lint gates; W6 clicks: upload a PDF via chat → "Review" row appears with
dot + ebbing border → click → opening card lists it with "Open & approve" → approve in Doc-U → back → row gone; new
quote request → row returns. Commit `chat: review — auto-opening system chat for items needing a decision`.
