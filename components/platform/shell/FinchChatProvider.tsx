'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onBriefAsk } from '@/components/platform/brief/brief-chat';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { attachmentMessage, uploadDocument, validateUploadFile } from '@/lib/platform/docu/upload-client';
import type { Suggestion } from '@/lib/platform/finch-suggestions';

/**
 * The conversation, lifted out of the pill (.ai/plan_chat_first_shell.md §4.3,
 * Wave 4).
 *
 * WHY IT LIVES IN THE LAYOUT. Next 16 layouts do not re-render on client-side
 * navigation and their client children are never unmounted by one
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md:240),
 * so state held here is the only chat state that survives moving between
 * /app/* routes. BriefChatPill's `useState` lived under app/app/page.tsx and
 * was therefore thrown away the moment the owner opened a module — the exact
 * bug this wave exists to fix. `router.refresh()` (what FindingCard calls after
 * a dismiss) re-renders the layout's SERVER components and merges the new RSC
 * payload "without losing unaffected client-side React (e.g. useState)"
 * (…/04-functions/use-router.md:46), so a refreshed findings badge does not
 * cost the owner their conversation (plan §8 E9).
 *
 * WHAT MOVED VERBATIM. The SSE reader, the abort controller, the
 * prelude-on-turn-0 rule and the `onBriefAsk` subscription are BriefChatPill's,
 * line for line — this wave changes where they live, not what they do. The
 * wire contract is untouched: POST /api/ai/agent with
 * `{ messages, module: 'brief', orgName }`, replying as SSE `data:` frames.
 * Still exactly ONE subscriber to the `brief-chat.ts` pub/sub (that file is
 * single-subscriber by design), because there is exactly one provider and it is
 * mounted once, in app/app/layout.tsx — so FindingCard's tap-to-discuss keeps
 * landing in the composer.
 *
 * ABORT (plan §8 E7, E8). The in-flight stream is aborted in exactly two
 * places: provider teardown (leaving /app/* altogether) and `reset()`. It is
 * deliberately NOT aborted on navigation — the provider stays mounted, so an
 * answer that started on the Brief keeps streaming while the owner reads
 * OrderFlow, and is waiting for them when they come back.
 *
 * SIGN-OUT. `reset()` is the whole mechanism: the two sign-out call sites
 * (UserChipMenu on desktop, MobileDrawer on mobile) call it before
 * `supabase.auth.signOut()`, which aborts any in-flight request and empties the
 * transcript so one user's questions can't survive into the next session on a
 * shared workstation — the same reason `clearParsedOrder()` is called there. A
 * context method rather than a second pub/sub channel because both menus are
 * already inside this provider (it wraps the whole shell in the layout), so
 * this costs one hook call and no new global state.
 *
 * ── PERSISTENCE (.ai/plan_brief_chat_v2.md §2.5, W1) ────────────────────────
 * The transcript is now a row. `activeChatId` is the whole mechanism: null
 * means "this conversation has no home yet", and the first `send()` gives it
 * one by POSTing /api/finch/chats BEFORE opening the stream, because
 * /api/ai/agent needs the id to file the exchange against. Every later turn
 * reuses it, which is what makes a reply continue a conversation rather than
 * start a new one.
 *
 * IF THE CHAT CANNOT BE CREATED, WE STILL ANSWER. A 503 (the migration hasn't
 * been pasted into Supabase yet) or any other failure leaves `activeChatId`
 * null and the stream goes up without a `chatId`: the owner gets their answer,
 * it just isn't stored — precisely the behaviour this provider had before this
 * wave (plan §5, first bullet). Persistence is an improvement to the chat, not
 * a precondition for it.
 *
 * ── NAVIGATION + SUGGESTIONS (W2) ───────────────────────────────────────────
 * A conversation started from the Brief now MOVES to its own screen. The
 * moment `send()` has an id, it pushes `/app/chat/<id>` — mid-stream, on
 * purpose: the turns live here, not on the page, so the answer keeps arriving
 * into the same array and the chat page simply renders it. The push happens
 * only from `/app` and `/app/chat/new`; from a module screen the dock keeps
 * the conversation where the owner is working (W4's bubble makes that a
 * deliberate surface rather than an accident).
 *
 * `router.refresh()` fires once per chat, after its FIRST complete exchange —
 * that is when the rail gains a row and the agent route's `after()` has had
 * something to title. Refreshing on every turn would re-run the whole platform
 * layout's server reads for a list that has not changed.
 *
 * `findingId` is remembered, not acted on: tapping a card fills the composer
 * (see brief-chat.ts) and the id rides in a ref until the owner actually
 * sends, so reading a finding and changing your mind does not leave an empty
 * chat in the rail.
 *
 * `module` is still the hardcoded 'brief' the dock has always sent — module
 * awareness is W4.
 *
 * ── ATTACHMENTS (W5) ────────────────────────────────────────────────────────
 * `attach()` is the whole drag-and-drop feature; `ChatDropZone` and the
 * composer's paperclip are two ways to call it. It lives HERE rather than in
 * the drop zone for the same reason the turns do: the zone wrapping the chat
 * page and the paperclip inside the dock are in different subtrees (the dock is
 * a SIBLING of <main>), so a context owned by the zone could not reach the
 * paperclip, and two copies of the upload flow would drift.
 *
 * It ends in `send()`, which is what makes a dropped invoice a normal turn of
 * conversation: the message is the owner's ("I've uploaded invoice.pdf."), the
 * ids ride alongside it, and the server both stores them on the row and hands
 * them to the model. Nothing about the transcript knows a file was involved
 * except the cards.
 */

/** A document filed against a message. `document_id`/`filename` are what the
 *  server stores in `finch_messages.content.attachments`; `note` is CLIENT-ONLY
 *  — an extraction that failed or ran long is worth saying now, and reads as
 *  stale history tomorrow, so it deliberately does not survive a reload. */
export interface ChatAttachment {
  document_id: string;
  filename: string;
  note?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Tool names this answer's model ran, in call order. Assistant turns only;
   *  absent when it answered from context alone. Kept rather than dropped from
   *  this wave on (W2 renders them as ✦ status lines). */
  tools?: string[];
  /** Documents dropped into this message. User turns only. */
  attachments?: ChatAttachment[];
}

/** A file on its way in, for the line the transcript shows while it happens. */
export interface AttachmentProgress {
  key: string;
  filename: string;
  label: string;
}

interface SseEvent {
  text?: string;
  tool?: string;
  done?: boolean;
  error?: string;
}

/** The transcript as GET /api/finch/chats/[id] returns it. Mirrors
 *  `ChatMessage` in lib/platform/finch-chats.ts — declared here rather than
 *  imported because that module reaches `next/headers` and this is a client
 *  component. */
interface LoadedChat {
  chat?: { id?: unknown } | null;
  messages?: {
    role?: unknown;
    content?: { text?: unknown; tools?: unknown; attachments?: unknown } | null;
  }[];
}

function parseSse(line: string): SseEvent | null {
  if (!line.startsWith('data:')) return null;
  try {
    return JSON.parse(line.slice(5).trim());
  } catch {
    return null;
  }
}

/** Narrow a stored `content.attachments` array. Shared by `openChat` and the
 *  chat page's server rows, both of which read the same jsonb column. */
export function parseStoredAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => ({
      document_id: typeof a.document_id === 'string' ? a.document_id : '',
      filename: typeof a.filename === 'string' ? a.filename : 'Document',
    }))
    .filter((a) => a.document_id);
}

/* ── The document drop path (plan §2.6) ─────────────────────────────────────
 * Module-level because none of it touches React state directly: the component
 * owns WHEN these run and what they do to the transcript; these own the wire.
 */

/** How long the chat waits on `/api/ai/extract` before it stops watching. The
 *  route's own `maxDuration` is 60s, so this is "as long as it could possibly
 *  take" rather than an arbitrary patience — past it, the work is still running
 *  server-side and the honest thing to say is where the result will appear. */
const EXTRACT_TIMEOUT_MS = 60_000;

const EXTRACT_SLOW_NOTE = 'Still reading — it’ll appear in Doc-U when done.';
const EXTRACT_FAILED_NOTE = 'Couldn’t read this file — it’s in Doc-U marked as error.';

/**
 * Extract a document and wait for it, unlike every other upload surface.
 *
 * The waiting IS the feature: a chat that answered "I've uploaded invoice.pdf"
 * before the extraction finished would call `docu_get_document_summary` on a
 * `pending` row and truthfully report that there is nothing in it yet.
 *
 * Returns a note for the attachment card, or null when the document read
 * cleanly. Never throws — a failed extraction downgrades the card, it does not
 * cancel the message: the file IS in Doc-U either way, and the owner should be
 * told that rather than left thinking the drop did nothing.
 */
async function runExtraction(documentId: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXTRACT_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
      signal: ctrl.signal,
    });
    return res.ok ? null : EXTRACT_FAILED_NOTE;
  } catch {
    return ctrl.signal.aborted ? EXTRACT_SLOW_NOTE : EXTRACT_FAILED_NOTE;
  } finally {
    clearTimeout(timer);
  }
}

/** Longest a finished upload will queue behind an answer in flight. */
const ATTACH_WAIT_MS = 60_000;

/**
 * Wait for the current turn to land before sending the attachment message.
 *
 * `send()` is a no-op while streaming, so without this a document dropped
 * mid-answer would be uploaded, extracted, and then silently dropped on the
 * floor — the one failure mode with no visible cause. Polling a ref rather than
 * subscribing to state because this runs inside a long async function whose
 * closure over `streaming` went stale several awaits ago.
 */
async function waitUntilIdle(busy: { current: boolean }): Promise<boolean> {
  const started = Date.now();
  while (busy.current) {
    if (Date.now() - started > ATTACH_WAIT_MS) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
  return true;
}

interface FinchChatValue {
  turns: ChatTurn[];
  input: string;
  setInput: (value: string) => void;
  streaming: boolean;
  /** The partial answer as it arrives; '' between turns. */
  streamText: string;
  /** Tool names reported by the turn in flight, for a live status line. Empty
   *  between turns. (Nothing renders these yet — W2 does.) */
  streamTools: string[];
  error: string | null;
  /** The row this conversation is being written to, or null when it has none
   *  yet (nothing sent) or could not be created (schema not applied). */
  activeChatId: string | null;
  /** Up to four openers for this business, computed server-side per render. */
  suggestions: Suggestion[];
  /** Files currently being uploaded/read, oldest first. Drawn as status lines
   *  under the transcript; empty the moment they become a message. */
  attaching: AttachmentProgress[];
  /** Why a dropped file didn't make it — wrong type, too big, upload failed.
   *  Shown inline by the drop zone; cleared by the next attempt. */
  attachError: string | null;
  /** True when this session can upload at all (an org on the profile). The
   *  paperclip and the drop target hide rather than fail when it is false. */
  canAttach: boolean;
  /** Sends `text`, or whatever is in `input` when it is omitted. No-op while
   *  streaming or when there is nothing to send. */
  send: (text?: string, opts?: { attachments?: ChatAttachment[] }) => void;
  /** Upload dropped/picked files through Doc-U, read them, then send them as a
   *  message with attachment cards. The whole of W5's flow. */
  attach: (files: FileList | File[] | null) => void;
  /** Replace the transcript with a stored chat. No-op if it can't be read. */
  openChat: (id: string) => void;
  /** Continue a chat the SERVER already read — `/app/chat/[id]` hands over the
   *  rows it rendered rather than making this fetch them again. No-op while an
   *  answer is in flight, so a navigation cannot strand a running turn. */
  adoptChat: (id: string, turns: ChatTurn[]) => void;
  /** Start a fresh conversation. Keeps the in-flight answer alive on purpose —
   *  only `reset()` (sign-out) aborts. */
  newChat: () => void;
  /** Abort + forget everything. Called by the sign-out paths. */
  reset: () => void;
  /** The composer's input, so a tapped finding can hand over the caret. */
  inputRef: RefObject<HTMLInputElement | null>;
}

const FinchChatContext = createContext<FinchChatValue | null>(null);

/** The dock's window onto the conversation. Throws outside the provider — a
 *  silent null would mean a chat surface that quietly never sends anything. */
export function useFinchChat(): FinchChatValue {
  const value = useContext(FinchChatContext);
  if (!value) throw new Error('useFinchChat must be used inside <FinchChatProvider>.');
  return value;
}

export function FinchChatProvider({
  context,
  orgName,
  suggestions,
  children,
}: {
  /** The open findings, serialised by the LAYOUT from the findings read it
   *  already does for the rail badges (plan §4.1 — one fetch, two consumers).
   *  Prefixed to the first user turn only; see brief-chat.ts. */
  context: string;
  orgName: string | null;
  /** Chips for an empty conversation, built by the layout from this org's real
   *  findings/debtors/uploads (lib/platform/finch-suggestions*.ts). Carried
   *  here because both surfaces that draw them — the dock and
   *  `/app/chat/new` — are too far from the layout to be given props. */
  suggestions: Suggestion[];
  children: ReactNode;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamTools, setStreamTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<AttachmentProgress[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const { org, userId } = usePlatform();

  const abortRef = useRef<AbortController | null>(null);
  /** `streaming` as a value an async function can read AFTER awaiting — the
   *  attach flow needs to know whether a turn is in flight several seconds
   *  into its own work, by which time its closure's copy is a fossil. */
  const streamingRef = useRef(false);
  /** Likewise the latest `send`: `attach` is a long async function and must
   *  call the CURRENT one, not the one that existed when the file was dropped
   *  (it closes over `turns`, which the answer in flight has since changed). */
  const sendRef = useRef<(text?: string, opts?: { attachments?: ChatAttachment[] }) => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);
  /** The finding a tapped card is about, held until the owner sends. Cleared
   *  the moment it is spent (or the conversation is emptied) so the NEXT
   *  question doesn't get filed against a finding it has nothing to do with. */
  const pendingFindingRef = useRef<string | null>(null);

  const router = useRouter();
  const pathname = usePathname() ?? '';

  // A finding card was tapped: name it in the composer and hand over the caret,
  // so the owner writes the actual question. (Verbatim from BriefChatPill; the
  // subscription is per-provider now, and there is one provider.)
  useEffect(
    () =>
      onBriefAsk((prompt, findingId) => {
        pendingFindingRef.current = findingId;
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${prompt}` : prompt));
        inputRef.current?.focus();
      }),
    [],
  );

  // Teardown ONLY — not navigation (plan §8 E8). This effect's cleanup runs
  // when the platform layout itself unmounts, i.e. the owner has left /app/*.
  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTurns([]);
    setInput('');
    setStreamText('');
    setStreamTools([]);
    setError(null);
    setActiveChatId(null);
    pendingFindingRef.current = null;
    setAttaching([]);
    setAttachError(null);
    // The reader's `finally` skips this when the signal is aborted, so the
    // reset has to lower the flag itself or the composer stays disabled.
    setStreaming(false);
    streamingRef.current = false;
  }, []);

  /** Forget the current conversation without touching an answer still in
   *  flight — the owner asked for a blank page, not for their last question to
   *  be cancelled. (Contrast `reset()`, which is sign-out and aborts.) */
  const newChat = useCallback(() => {
    setTurns([]);
    setInput('');
    setError(null);
    setActiveChatId(null);
    setAttachError(null);
    pendingFindingRef.current = null;
  }, []);

  /**
   * Take over a conversation the server has already read.
   *
   * `/app/chat/[id]` renders its rows server-side; without this the provider
   * would have to fetch the same transcript again over `openChat` just to be
   * able to continue it. Instead the page hands them across on mount and this
   * becomes the active chat, so the next message appends rather than starting
   * a second conversation about the same thing.
   *
   * Refuses while streaming. Opening chat B in another tab-worth of the same
   * app while A's answer is still arriving would otherwise splice A's reply
   * onto B's transcript — the turn in flight resolves into whatever `turns` is
   * by then. Waiting is the correct behaviour; the page re-runs this once the
   * stream ends.
   */
  const adoptChat = useCallback(
    (id: string, loaded: ChatTurn[]) => {
      if (streaming || activeChatId === id) return;
      setTurns(loaded);
      setError(null);
      setActiveChatId(id);
      pendingFindingRef.current = null;
    },
    [streaming, activeChatId],
  );

  /**
   * Load a stored conversation into the transcript.
   *
   * Silent on failure: a chat that can't be read (deleted, someone else's, or
   * the migration isn't applied → 404) leaves whatever is on screen alone.
   * There is no surface for this error in W1 — the rail that would offer a
   * chat to open is W2, so the only way to reach this today is programmatic.
   */
  const openChat = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/finch/chats/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as LoadedChat;
      const loaded: ChatTurn[] = [];
      for (const m of data.messages ?? []) {
        const role = m.role === 'user' || m.role === 'assistant' ? m.role : null;
        const content = typeof m.content?.text === 'string' ? m.content.text : '';
        if (!role || !content) continue;
        const tools = Array.isArray(m.content?.tools)
          ? m.content.tools.filter((t): t is string => typeof t === 'string')
          : [];
        const attachments = parseStoredAttachments(m.content?.attachments);
        loaded.push({
          role,
          content,
          ...(tools.length ? { tools } : {}),
          ...(attachments.length ? { attachments } : {}),
        });
      }
      setTurns(loaded);
      setError(null);
      setActiveChatId(id);
    } catch {
      /* offline / aborted — keep what's on screen */
    }
  }, []);

  const send = useCallback(async (explicit?: string, opts?: { attachments?: ChatAttachment[] }) => {
    // A suggestion chip sends its own prompt; everything else sends the
    // composer. `explicit` never touches `input`, so a chip clicked while the
    // owner has half a question typed doesn't eat what they wrote.
    const text = (explicit ?? input).trim();
    if (!text || streaming) return;

    // Documents dropped into this turn. `note` is display-only, so it is
    // stripped before the ids go to the server (plan §2.6).
    const attachments = (opts?.attachments ?? []).filter((a) => a.document_id);
    const wireAttachments = attachments.map((a) => ({ document_id: a.document_id, filename: a.filename }));

    const nextTurns: ChatTurn[] = [
      ...turns,
      { role: 'user', content: text, ...(attachments.length ? { attachments } : {}) },
    ];
    setTurns(nextTurns);
    if (explicit === undefined) setInput('');
    setError(null);
    setStreaming(true);
    streamingRef.current = true;
    setStreamText('');
    setStreamTools([]);

    // The prelude rides on the FIRST user turn only — the findings don't change
    // mid-conversation, and repeating them every turn would just re-bill them.
    // Only role + content cross the wire: `tools` and `attachments` are the
    // transcript's business, and the attachment IDS reach the model through the
    // route's own prelude (lib/ai/finch/attachments.ts) so one turn's documents
    // cannot be re-announced on every later turn of the conversation.
    const outbound = nextTurns.map((m, i) => ({
      role: m.role,
      content: i === 0 && context ? `${context}\n\n${m.content}` : m.content,
    }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';
    const usedTools: string[] = [];

    // Give the conversation a home before streaming into it. A failure here is
    // not an error the owner needs to see: `chatId` stays null, the turn goes
    // up unpersisted, and they get their answer.
    let chatId = activeChatId;
    // True only when THIS send created the row — what decides whether the rail
    // needs refreshing afterwards, and whether we move to the chat's screen.
    let createdNow = false;
    if (!chatId) {
      try {
        const res = await fetch('/api/finch/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: 'brief', findingId: pendingFindingRef.current }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const created = (await res.json()) as { id?: unknown };
          if (typeof created.id === 'string') {
            chatId = created.id;
            createdNow = true;
            setActiveChatId(created.id);
          }
        }
      } catch {
        /* unpersisted turn — the answer still matters more than the record */
      }
    }
    // Spent (or unusable): the next question is its own.
    pendingFindingRef.current = null;

    // Move to the conversation's own screen while the answer is still
    // arriving. The turns live HERE, so the page picks up the same stream
    // mid-flight rather than restarting or waiting for it. Only from the two
    // routes where a chat has nowhere of its own to be: on a module screen the
    // dock keeps the answer beside the work (plan §2.5; W4 makes that a
    // designed surface).
    if (createdNow && chatId && (pathname === '/app' || pathname === '/app/chat/new')) {
      router.push(`/app/chat/${chatId}`);
    }

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: outbound,
          module: 'brief',
          orgName,
          ...(chatId ? { chatId } : {}),
          ...(wireAttachments.length ? { attachments: wireAttachments } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const detail = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `Vyso could not answer (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const evt = parseSse(part.trim());
          if (!evt) continue;
          if (evt.error) streamError = evt.error;
          // `{tool}` status lines are KEPT from this wave on (plan §2.5): the
          // brief module has tools now, and "Reading recent invoices…" is the
          // difference between a pause and a hang. They ride on the finished
          // turn so a reopened chat shows what the answer was built from; the
          // server stores the same list on the row.
          else if (evt.tool) {
            usedTools.push(evt.tool);
            setStreamTools([...usedTools]);
          } else if (evt.text) {
            acc += evt.text;
            setStreamText(acc);
          }
        }
      }

      if (streamError) throw new Error(streamError);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: acc || '…', ...(usedTools.length ? { tools: usedTools } : {}) },
      ]);

      // The rail has a new row to draw, and the agent route's `after()` has by
      // now named it. ONCE per chat — every later turn changes only
      // `updated_at`, and re-running the whole platform layout's server reads
      // for that would be an expensive way to reorder a list of one.
      if (createdNow) router.refresh();
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        // Keep any partial answer — half an answer still beats losing it.
        // NOTE the asymmetry with the server, which stores nothing for an
        // incomplete turn (plan §5): on screen a fragment is visibly a
        // fragment, next to its error line; read back from the database a week
        // later it would look like the whole of what Finch said.
        if (acc) setTurns((prev) => [...prev, { role: 'assistant', content: acc }]);
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setStreaming(false);
        setStreamText('');
        setStreamTools([]);
      }
      // Outside the guard: an ABORTED turn is not in flight either, and a queued
      // upload waiting on `waitUntilIdle` would otherwise wait out its full
      // minute for a stream that ended when the owner signed out.
      streamingRef.current = false;
    }
  }, [input, streaming, turns, context, orgName, activeChatId, pathname, router]);

  // The attach flow calls through this rather than closing over `send`.
  useEffect(() => {
    sendRef.current = (text?: string, opts?: { attachments?: ChatAttachment[] }) => void send(text, opts);
  }, [send]);

  /**
   * A dropped (or picked) file becomes a turn of conversation.
   *
   * SEQUENTIAL, THEN ONE MESSAGE. Files upload one at a time — three 10 MB
   * scans racing each other on an ADSL line is how you get three timeouts — and
   * they arrive as a SINGLE message with a card each. One message because
   * `send()` refuses while a turn is in flight, so a message per file would
   * have every file after the first silently swallowed; and because "I've
   * uploaded three documents" is what the owner did.
   *
   * NOTHING IS LOST TO A FAILURE. A rejected file (wrong type, too big) never
   * uploads and says why. A failed upload says so and the others continue. A
   * failed EXTRACTION still sends — the document reached Doc-U, and a card
   * saying it couldn't be read is the truth; the conversation carries on.
   */
  const attach = useCallback(
    async (files: FileList | File[] | null) => {
      const picked = Array.from(files ?? []);
      if (picked.length === 0) return;

      const problems: string[] = [];
      const queue: File[] = [];
      for (const file of picked) {
        const problem = validateUploadFile(file);
        if (problem) problems.push(problem);
        else queue.push(file);
      }
      setAttachError(problems.length ? problems.join(' ') : null);
      if (queue.length === 0) return;

      const supabase = createClient();
      const attached: ChatAttachment[] = [];

      for (const file of queue) {
        const key = `${Date.now()}-${file.name}-${attached.length}`;
        setAttaching((prev) => [...prev, { key, filename: file.name, label: `Uploading ${file.name}…` }]);
        try {
          const { documentId } = await uploadDocument(file, { orgId: org?.id, userId, supabase });
          // The wording the plan asks for, and the honest one: the file is
          // stored, and what takes the seconds is Claude reading it.
          setAttaching((prev) =>
            prev.map((a) => (a.key === key ? { ...a, label: `Reading ${file.name}…` } : a)),
          );
          const note = await runExtraction(documentId);
          attached.push({ document_id: documentId, filename: file.name, ...(note ? { note } : {}) });
        } catch (err) {
          problems.push(
            err instanceof Error && err.message ? `${file.name}: ${err.message}` : `Couldn’t upload ${file.name}.`,
          );
        } finally {
          setAttaching((prev) => prev.filter((a) => a.key !== key));
        }
      }

      setAttachError(problems.length ? problems.join(' ') : null);
      if (attached.length === 0) return;

      // Queue behind an answer already in flight rather than being refused by
      // `send()`; give up loudly rather than quietly if it never lands.
      if (!(await waitUntilIdle(streamingRef))) {
        setAttachError(
          `${attached.map((a) => a.filename).join(', ')} uploaded to Doc-U, but Vyso was still answering — ask about it when the reply lands.`,
        );
        return;
      }
      sendRef.current(attachmentMessage(attached.map((a) => a.filename)), { attachments: attached });
    },
    [org?.id, userId],
  );

  const value = useMemo<FinchChatValue>(
    () => ({
      turns,
      input,
      setInput,
      streaming,
      streamText,
      streamTools,
      error,
      activeChatId,
      suggestions,
      attaching,
      attachError,
      canAttach: !!org?.id,
      send: (text?: string, opts?: { attachments?: ChatAttachment[] }) => void send(text, opts),
      attach: (files: FileList | File[] | null) => void attach(files),
      openChat: (id: string) => void openChat(id),
      adoptChat,
      newChat,
      reset,
      inputRef,
    }),
    [
      turns,
      input,
      streaming,
      streamText,
      streamTools,
      error,
      activeChatId,
      suggestions,
      attaching,
      attachError,
      org?.id,
      send,
      attach,
      openChat,
      adoptChat,
      newChat,
      reset,
    ],
  );

  return <FinchChatContext.Provider value={value}>{children}</FinchChatContext.Provider>;
}
