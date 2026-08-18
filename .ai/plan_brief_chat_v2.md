# Plan: Brief chat v2 — finding detail, persistent chats, drag-drop docs, module bubble, scroll fix, cheap models

Status: **AWAITING JOSH'S APPROVAL** (W0 is pre-approved by Josh's direct asks — "I can't scroll", "use a cheap model" — and may start immediately; W1–W6 wait).
Architect: Fable, 2026-08-17. Implementers: subagents (Sonnet for W0; Opus for W1–W5, one wave at a time; commit after each green wave; never `git add -A`; never push — Josh pushes).
Design source of truth: `.ai/design/vyso-brief/Vyso - The Brief.dc.html` (verified identical to the live claude.ai/design project today; sections 1a Brief, 1b Chat view, 1c Finding detail, 1d Under-the-hood module page, 1e Mobile) + `_ds/.../tokens/*.css` + `support.js`. Elevate the existing shell language; do not restyle what already matches.

Repo facts every wave relies on (verified 2026-08-17 — see the survey in the session log; file:line quoted where it matters):
- Shell: `app/app/layout.tsx` → `PlatformProvider` → `FinchChatProvider` (`components/platform/shell/FinchChatProvider.tsx`) → `AppRail` (server; `RailNav`, `UnderTheHood`, `UserChipMenu` client) + `MobileTopBar`/`MobileDrawer` + `<main class="min-h-0 min-w-0 flex-1 overflow-y-auto">` + `GlobalChatDock` (absolute, sibling of `<main>`, `pointer-events-none` wrapper). Layout does one `fetchFindings()` and feeds `briefChatContext()` to the provider.
- Chat: `GlobalChatDock` is the only live surface on the Brief; it POSTs `/api/ai/agent` SSE with **`module:'brief'` hardcoded** (`FinchChatProvider.tsx:179`), drops `{tool}` status events (`:202-204`), one global in-memory `turns[]`, nothing persisted. Legacy `FinchLauncher`/`FinchButton`/`FinchModal` (`components/platform/finch/*`) mounted only in `app/app/orderflow/layout.tsx:58` and `components/platform/docu/DocuNav.tsx:52` — module-aware, has tool status lines, `/` customer picker, attach-files → `/api/ai/agent/ingest-document`, and the order-prefill handoff (`lib/ai/finch/order-handoff.ts`). `FinchButton.tsx:10-22` is the "blue gradient bubble titled Finch" (`finch-gradient` class in `app/globals.css`, `FinchMark`).
- Findings: `lib/platform/agent-findings.ts` (RLS reads, evidence resolver), `components/platform/brief/FindingCard.tsx` (click body → `askBrief()` fills the composer; Dismiss writes via `supabase-browser` + `router.refresh()`), `brief-display.ts` (agent chips), `brief-chat.ts` (`askBrief`/`onBriefAsk`, `briefChatContext`, `findingPrompt`). No detail route exists.
- Upload: two duplicated client flows (`app/app/docu/upload/page.tsx:15-67`, `components/platform/docu/UploadBubble.tsx:34-62`): Storage `documents/{org}/{ts}_{name}` → insert `documents` row (`status:'pending'`) → `fetch('/api/ai/extract',{documentId, keepalive:true})` unawaited. `/api/ai/extract` is blocking, 15 MB server cap.
- Tools: `lib/ai/finch/tools.ts` `TOOLS_BY_MODULE` (brief = 2 docu + 2 debtors), `runtime.ts`, `knowledge.ts` (`BRIEF_KNOWLEDGE` documents the findings schema), route `app/api/ai/agent/route.ts` (`MAX_TURNS=5`, 40/hr/user, `canSeeMoney` = owner/admin, workflow-tier escalation only when `module==='orderflow'`).
- Models: chat `claude-haiku-4-5` (`lib/ai/finch/config.ts:58`), workflow `claude-sonnet-4-6` (`:59`), extraction/summary/categorise/match all Haiku, **`MODEL` default `claude-opus-4-8`** (`lib/ai/anthropic.ts:11`, env `ANTHROPIC_MODEL`) used by `runPrompt` and Price Watch observation (`price-watch-model.ts:41`).
- Scroll bug root cause: `app/globals.css:292-297` `html, body { overflow-x:hidden }` (unscoped; forces `overflow-y:auto` on html/body, so the page and `<main>` both scroll/steal wheel events); the marketing site already neutralises it via `html:has(.finch-site)` (`globals.css:915-924`) but `.finch-site` never appears under `/app/*`. `docu/[id]/page.tsx:106-116` works around it locally.

---

## 1. Goal & acceptance criteria

1. **Finding detail (design 1c).** Clicking a finding card opens `/app/finding/[id]`: back link, agent chip + status + "Found HH:MM, Day D Mon", "✦ Send to chat", headline, rand line (+ volume sub-line when derivable), **price history** panel (real `pw_price_points` series for `price_watch` findings, inline SVG, first/last/Δ%; other agents: panel omitted), **Recommended** block (from `recommended_action`), action buttons ("Draft email to {supplier}" → opens a chat pre-prompted; "Dismiss"; "Mark resolved"), **Evidence** list (each evidence doc: number/date/line price where available → `/app/docu/[id]`; "Open in Doc-U ↗"). Unknown id / other org → `notFound()`.
2. **Persistent chats (design 1b + rail).** Rail gains, directly under "Today's brief": **"New chat"** (+ icon) and the list of this user's chats updated in the last 14 days (title, relative time), each → `/app/chat/[id]`. Chats untouched for > 14 days appear under **History** (below the resolved/dismissed findings, section "Older chats"). Sending a message from the Brief dock, from a finding ("Send to chat"), from a suggestion chip, or from a module bubble creates a chat row (with `finding_id`/`module` context) and its messages persist; reload restores it; navigation between routes never loses the active transcript.
3. **Drag-and-drop documents into a chat.** Dropping a PDF/image onto a chat page or the expanded dock uploads it through Doc-U (same Storage path + `documents` row as the Upload page — it shows up in Doc-U's inbox), runs extraction, shows "Reading {filename}…" then an attachment card in the transcript, and Finch replies with a summary of the document. Reject > 15 MB and non-PDF/image with an inline message.
4. **Suggestions.** New-chat empty state and the Brief dock show up to 4 chips computed from recent activity (open findings → "Draft an email to {supplier} about {item}"; overdue debtors → "Draft a payment reminder for {customer}"; docs uploaded in the last 7 days → "What did this week's invoices cost me?"; fallbacks). Chip click sends that prompt. Any "draft email/reminder" answer is **text in the chat with a Copy button — nothing is sent, and Finch says so.**
5. **Module bubble (design 1d).** On every route except `/app` and `/app/chat/*`, the dock renders collapsed as the gradient "Finch" bubble (reuse `finch-gradient` + `FinchMark`, bottom-right, identical position on every module page); click → expands to a bottom-right chat panel (transcript + composer + drop zone) that is **module-aware** (`module` = `moduleForPathname()`), streams tool status lines, and preserves the OrderFlow order-prefill handoff. Legacy `FinchLauncher` mounts in OrderFlow's SubNav and DocuNav are removed (one Finch, not two).
6. **Scroll fix.** Every `/app/*` module page scrolls with the mouse wheel/trackpad anywhere over its content; `<main>` is the only scroll container; the marketing site is unchanged.
7. **Cheap models.** Chat, title generation, summaries stay on Haiku; workflow stays Sonnet; `MODEL` default becomes `claude-sonnet-4-6` (Opus only via explicit env override; Fable never referenced anywhere). Document the tiers in `.env.example`.
8. Gates green per wave: `npx tsc --noEmit`, `npm test` (128 + new), `npm run build`; `npm run lint` no new errors vs main.

Non-goals (say so, don't build): mobile companion (1e) beyond responsive sanity of the new routes; chat charts (design 1b margin sparkline) — the answer is text until P1.2 tools land; sending email/WhatsApp; Xero/Yoco; sharing chats between users; the `/` customer picker (Finch resolves customers by name via `orderflow_find_customer`).

---

## 2. Data / API / interface changes

### 2.1 SQL — `supabase/finch-chats.sql` (new; house style: idempotent, `do $$` prerequisite guards, why-comments)
```sql
create table if not exists finch_chats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,                                  -- null until first assistant reply
  module text,                                 -- 'brief' | module key; context the chat started in
  finding_id uuid references agent_findings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz                      -- reserved; v1 archives by age at read time
);
create table if not exists finch_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references finch_chats(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content jsonb not null,   -- {text, attachments?:[{document_id, filename}], tools?:[string], suggestions?:[string]}
  created_at timestamptz not null default now()
);
create index if not exists idx_finch_chats_user on finch_chats (org_id, user_id, updated_at desc);
create index if not exists idx_finch_messages_chat on finch_messages (chat_id, created_at);
-- RLS: org-scoped AND owner-scoped — chats are private to their author.
--   using (org_id = (select p.org_id from profiles p where p.id = auth.uid()) and user_id = auth.uid())
--   with check (same)
-- finch_messages: using (exists (select 1 from finch_chats c where c.id = chat_id and c.user_id = auth.uid() and c.org_id = <caller org>))
```
Archive rule (v1): a chat is "recent" iff `updated_at >= now() - interval '14 days'`, else it lists under History. No cron, no status column needed. Add to `docs/demo-runbook.md` later.

### 2.2 Server data module — `lib/platform/finch-chats.ts` (new)
RLS-scoped (`createServerSupabase`), same header discipline as `agent-findings.ts` (missing relation → empty flagged result so `/app` still renders before the migration is applied):
- `listChats(orgId, userId): { recent: ChatSummary[], archived: ChatSummary[] }` (14-day split; `ChatSummary = {id,title,module,finding_id,updated_at}`; title fallback "New chat")
- `getChat(orgId, userId, chatId): { chat, messages: ChatMessage[] } | null`
- `createChat(orgId, userId, {module, finding_id?, title?}) → id`
- `appendMessages(chatId, orgId, msgs[])` + bump `updated_at`
- `setChatTitle(chatId, title)`

### 2.3 Routes
- `POST /api/finch/chats` `{module, findingId?}` → `{id}` (RLS client from the session; 401 without session).
- `GET /api/finch/chats/[id]` → `{chat, messages}` (used when the provider opens a chat client-side without a full navigation).
- `POST /api/ai/agent` — body gains optional `chatId` and `attachments?: [{document_id, filename}]`. Behaviour: unchanged streaming; **additionally**, when `chatId` is present the route (a) verifies the chat belongs to the caller (RLS read), (b) after the stream completes appends the user message (with attachments) and the assistant text (with the tool names used) via `appendMessages`, (c) if `chat.title` is null, generates a ≤ 6-word title with the Haiku tier (`max_tokens: 30`, temperature default) in `after()` and `setChatTitle`. Failures in (b)/(c) are logged, never surfaced to the stream. `module` continues to select tools; `'brief'` module tools = current 4 (P1.2 adds more separately).
- Read `node_modules/next/dist/docs/` for `after()` and route-handler conventions before touching the route (AGENTS.md).

### 2.4 Suggestions — `lib/platform/finch-suggestions.ts` (new, server, pure over inputs + one small query fn)
`suggestionsFor({findings: AgentFinding[], overdue: {customer, amount, days}[], recentDocCount: number}): Suggestion[]` (`{label, prompt}`), max 4, deterministic ordering (findings by rand_impact desc → debtors → docs → fallbacks: "What should I look at first today?", "Who owes me money?", "Summarise this week's invoices"). Supplier/item names come from the finding's observation text? No — take them from `evidence`/`pw_items` only if cheaply available; otherwise the chip says "Draft an email about the {agent label} finding" and the **prompt** carries the finding id so Finch has the context. Unit-tested.

### 2.5 Client provider — `FinchChatProvider` changes
State: `activeChatId: string|null`, `turns`, `module` (derived from `usePathname()` via `moduleForPathname`, `'brief'` on `/app` and `/app/chat/*`), `pending`, `attachments`. Methods: `send(text, {attachments?})` — if `activeChatId` is null: `POST /api/finch/chats` first (module + findingId from context), set id, then stream with `chatId`; on completion `router.refresh()` (rail list) and, if we were on `/app` or a module page opened from the Brief dock, `router.push('/app/chat/'+id)`; `openChat(id)` loads via GET; `newChat()` clears; `askBrief` subscription stays. Tool status events are now kept and rendered (`{tool}`), no longer dropped.

### 2.6 Upload helper — `lib/platform/docu/upload-client.ts` (new, `'use client'`-safe, browser Supabase)
`uploadDocument(file, {orgId, userId, supabase}) → Promise<{documentId, storagePath}>` extracted verbatim from `UploadBubble.uploadOne` (Storage upload → `documents` insert). Both existing callers (`UploadBubble.tsx`, `docu/upload/page.tsx`) switch to it (behaviour identical, incl. their unawaited `keepalive` extract call). The chat drop path calls the helper, then **awaits** `POST /api/ai/extract` (show "Reading {filename}…"; 60 s client timeout → "Still reading — it'll appear in Doc-U when done"), then sends a user message with `attachments:[{document_id, filename}]` and text "I've uploaded {filename}." — the model has `docu_get_document_summary` and answers.

### 2.7 Models — `lib/ai/anthropic.ts:11` `MODEL` default → `'claude-sonnet-4-6'`; `.env.example` gains a "Model tiers" block: `ANTHROPIC_AGENT_MODEL` (Haiku, chat), `ANTHROPIC_WORKFLOW_MODEL` (Sonnet), `ANTHROPIC_MODEL` (Sonnet, long-form/observation), `ANTHROPIC_EXTRACT_MODEL`/`SUMMARY`/`CATEGORISE`/`MATCH` (Haiku), `ANTHROPIC_OBSERVE_MODEL` (defaults to `ANTHROPIC_MODEL`). No code path may reference an Opus or Fable id as a default after this wave.

---

## 3. Files

**Create:** `supabase/finch-chats.sql`; `lib/platform/finch-chats.ts`; `lib/platform/finch-suggestions.ts`; `lib/platform/docu/upload-client.ts`; `lib/platform/price-watch/series.ts` (read fn: finding → `pw_price_points` series, see W3); `app/api/finch/chats/route.ts`; `app/api/finch/chats/[id]/route.ts`; `app/app/chat/[id]/page.tsx`; `app/app/chat/new/page.tsx`; `app/app/finding/[id]/page.tsx`; `components/platform/chat/{ChatTranscript,ChatComposer,ChatDropZone,SuggestionChips,AttachmentCard,ToolStatusLine,MessageBubble}.tsx`; `components/platform/brief/{FindingDetail,PriceHistoryChart,EvidenceList}.tsx`; `components/platform/shell/{RailChats,FinchBubble}.tsx`; tests: `tests/finch-suggestions.test.ts`, `tests/finch-chats-archive.test.ts` (pure 14-day split), `tests/price-watch-series.test.ts`.
**Modify:** `app/globals.css` (scroll scope only); `app/app/layout.tsx` (mark shell root, pass chats + suggestions to rail/provider); `components/platform/shell/{FinchChatProvider,GlobalChatDock,RailNav,MobileDrawer,shell-data}.tsx/ts`; `components/platform/brief/{FindingCard,brief-chat,brief-display}.tsx/ts`; `app/app/page.tsx` (history view gains "Older chats"); `app/api/ai/agent/route.ts`; `lib/ai/finch/knowledge.ts` (BRIEF: drafts-only wording, attachments, suggestions); `lib/ai/anthropic.ts:11`; `.env.example`; `app/app/orderflow/layout.tsx` + `components/platform/docu/DocuNav.tsx` (remove `FinchLauncher`); `components/platform/docu/UploadBubble.tsx` + `app/app/docu/upload/page.tsx` (use helper).
**Delete (W4 only, after parity):** `components/platform/finch/{FinchLauncher,FinchButton,FinchModal}.tsx` — keep `FinchMark`/`FinchOrderPrefill`/whatever the dock reuses; move reused pieces rather than re-implementing.
**Do not touch:** `lib/platform/price-watch/{normalize,match,detect,observe,run}.ts`, `app/api/agents/*`, `supabase/demo-*.sql`, marketing routes/components (`components/finch/*`, `app/(marketing)` pages), `proxy.ts`, auth/onboarding, `lib/platform/serviceden*`, `components/platform/vyso-ai/*` and `lib/ai/vyso-agent/*` (dead; separate cleanup), `docu/[id]/page.tsx` (its local scroll container stays).

---

## 4. Ordered waves

### W0 — Scroll fix + cheap models (Sonnet; ≈ 1 h) — PRE-APPROVED
1. `app/app/layout.tsx:85` root div gets `data-platform-shell` (or class `platform-shell`). In `app/globals.css`, extend the existing `:has(.finch-site)` override block (`:915-924`) so `html:has([data-platform-shell]), body:has([data-platform-shell]) { overflow-x: clip; overflow-y: visible; }` — comment why (root cause + the docu/[id] workaround it makes unnecessary but which is left in place). Do NOT edit lines 292-297 themselves (marketing depends on them).
2. `lib/ai/anthropic.ts:11` default → `claude-sonnet-4-6`; `.env.example` model-tier block per §2.7.
3. Verify scroll in the in-app browser on `/app/orderflow`, `/app/procurepulse`, `/app/docu`, `/app` (dev server; the implementer may need Josh's local login — if no session is available, verify by computed style: `getComputedStyle(document.documentElement).overflowY === 'visible'` on `/app/*` is not reachable without login either → fall back to a static check that the selector compiles and report "runtime unverified" honestly).
4. Gates; commit `shell: scope html overflow-x to marketing (fixes /app scroll); models: default long-form tier to Sonnet`.

### W1 — Persistence (Opus; ≈ ½ day)
SQL (2.1) → `lib/platform/finch-chats.ts` (2.2) → routes (2.3) → provider (2.5, minus navigation/rail wiring) → agent route `chatId` persistence + Haiku title in `after()`. Tests for the 14-day split and title-fallback. Add the migration to the "paste into Supabase" list in `.ai/implementation.md`. Nothing user-visible yet except that Brief chats now persist (verify with two page loads).

### W2 — Rail + chat pages + suggestions (Opus; ≈ 1 day)
`RailChats` under "Today's brief" (label **New chat** with a `+`; list of recent chats — title, relative time, module dot; active state via `usePathname`); `MobileDrawer` gets the same block; layout fetches `listChats` + builds `suggestionsFor(...)` (inputs it already has: findings feed; add the overdue + recent-doc counts via existing data fns) and passes both down. `/app/chat/new` (empty state: greeting line, `SuggestionChips`, drop-zone hint, composer focused) and `/app/chat/[id]` (design 1b: transcript in `<main>` — user bubble right, ✦ tool status lines, assistant answer with evidence links, follow-ups; dock = composer only on these routes). History view: "Older chats" section under the resolved findings. Brief dock: chips above the composer when the transcript is empty; sending navigates to the new chat page. `askBrief` (tap a card) → creates chat with `finding_id` and navigates. Knowledge doc: drafts-only rule ("you never send; you write the text and say the owner sends it"), how to treat `attachments`, and that suggestion prompts may reference a finding id it should look up.

### W3 — Finding detail (Opus; ≈ 1 day)
`lib/platform/price-watch/series.ts`: `seriesForFinding(orgId, finding)` — resolve `pw_item_id`+`supplier_id` from `pw_price_points where document_id = any(evidence_refs)` (read `run.ts:~1296` to confirm what a finding's `evidence_refs`/`dedupe_key` carry and prefer the cheapest correct join), return ordered `{date, unit_price, document_id, quantity_base}[]` + `basis` + monthly volume estimate (sum `quantity_base` last 90 d / 3). `app/app/finding/[id]/page.tsx` server-renders `FindingDetail` per design 1c (back link → `/app`; header; rand line; `PriceHistoryChart` inline SVG polyline with min/max labels, first/last/Δ%; Recommended; buttons; `EvidenceList` linking `/app/docu/[id]`). "Send to chat" and "Draft email to {supplier}" → `POST /api/finch/chats {module:'brief', findingId}` then navigate to `/app/chat/[id]` with the first message pre-sent (draft prompt) or composer pre-filled (send-to-chat). Dismiss / Mark resolved reuse `FindingCard`'s browser-client write pattern. `FindingCard` body click → `Link` to the detail route (keep the ✦ "Discuss" affordance as a secondary button that still calls `askBrief`). Tests for `seriesForFinding` shaping (pure part).

### W4 — Module bubble + one Finch (Opus; ≈ 1 day)
`FinchBubble` (collapsed state of `GlobalChatDock` on module routes): gradient pill "Finch" bottom-right (`right: 24px; bottom: 24px` inside the main column, same on every module page; respects the mobile top bar), unread dot when an answer arrived while collapsed. Expanded: bottom-right panel `w-[420px] max-h-[62vh]` (mobile: full-width sheet), header (gradient mark + "Finch" + module label + collapse), `ChatTranscript`, `ChatDropZone`, `ChatComposer`; Escape collapses. Provider sends the real `module`; workflow escalation via the route's existing regex/`workflow` flag; port from `FinchModal`: tool status rendering, `FinchOrderPrefill` card + `order-handoff.ts` navigation to the OrderFlow order form, attach-files (now via drop → `ingest-document`? **No** — unify on the Doc-U upload path from W5; on OrderFlow the dropped customer order still becomes a `documents` row and `orderflow_prepare_order` reads it — confirm with the route; if `ingest-document` is required for order building, keep that endpoint and call it from the drop handler only when `module==='orderflow'`, and say so in implementation.md). Remove `FinchLauncher` from `app/app/orderflow/layout.tsx` and `DocuNav.tsx`; delete the three legacy files once tsc is clean. Chats started from a bubble carry `module` and show in the rail like any other.

### W5 — Drag-and-drop documents (Opus; ≈ ½ day)
`upload-client.ts` helper + refactor the two callers; `ChatDropZone` (whole chat page / expanded panel; visible dashed overlay on dragover; paperclip button as the click fallback); flow per §2.6; `AttachmentCard` in the transcript (filename, type, "Open in Doc-U"); server: `attachments` persisted in `finch_messages.content`; agent route passes attachment document ids into the first user message text so the model calls `docu_get_document_summary` on them. Rejections inline (size/type). Rate-limit note: uploads don't count against the 40/hr chat cap; extraction has its own cost — Haiku.

### W6 — Real-session verification (Fable in the in-app browser, ≈ 2 h)
Every acceptance criterion in §1 checked on the dev server against the Meridian org (Josh signs in — the implementer must not enter credentials): scroll on 3 module pages; card → detail → send to chat → reply → reload persists → rail shows the chat → 14-day rule (temporarily backdate one row via SQL in the local branch of the DB? no — unit test covers it; verify only the recent list); drop a PDF invoice → appears in Doc-U → summary reply; module bubble on `/app/orderflow` expands, answers with orderflow tools; suggestions chips render and send; no `claude-opus` default anywhere (`grep -rn "opus" lib app | grep -v vyso-agent`). Screenshots to `.ai/verification/brief-chat-v2/`. Log to `.ai/implementation.md`.

---

## 5. Edge cases
- Migration not yet applied → `listChats` returns empty+flag; rail hides the chat list but still shows "New chat"; sending creates chat → 42P01 → the provider falls back to the current in-memory behaviour and shows a one-line "Chat history isn't set up yet" (no crash).
- Chat belongs to another user/org → 404 page (`notFound()`), never 500.
- Finding dismissed while its detail page is open → status pill updates after `router.refresh()`; page still renders.
- Finding with `evidence_refs` that resolve to zero documents (deleted docs) → evidence list says "Evidence documents are no longer available"; chart omitted if no points.
- SSE aborted mid-stream (navigate away/sign-out) → route still persists what it has? **No** — persist only complete assistant turns; a partial turn is dropped and the user message is kept.
- Concurrent tabs → last write wins on `updated_at`; no locking.
- Attachments: duplicate filename → helper's timestamp prefix keeps paths unique; extraction failure → attachment card shows "Couldn't read this file — it's in Doc-U marked as error", chat continues.
- Bubble on `/app/settings`, `/app/organisation`, `/app/notifications` (non-module routes) → still shows (module `'brief'` tools).
- `prefers-reduced-motion` → bubble expand/collapse without transition (tokens/motion.css durations otherwise).
- Rate limit hit → composer shows the existing 429 message; nothing persisted for that turn.

## 6. Verification commands
`npx tsc --noEmit` · `npm run lint` (compare error count to main; must not grow) · `npm test` · `npm run build` · `grep -rn "claude-opus\|fable" lib app components --include=*.ts --include=*.tsx | grep -v vyso-agent` → only env-comment hits · per-wave browser checks as above.

## 7. Delegation map
| Wave | Agent | Notes |
|---|---|---|
| W0 | Sonnet | tiny, mechanical |
| W1 | Opus | schema + route; read Next 16 docs for `after()` |
| W2 | Opus | biggest UI wave; read design 1a/1b + existing shell components first |
| W3 | Opus | read `run.ts` finding-write site before designing the series join |
| W4 | Opus | parity checklist from `FinchModal` before deleting it |
| W5 | Opus | refactor two callers, keep behaviour identical |
| W6 | Fable + Josh | Josh signs in; Fable drives the browser |
