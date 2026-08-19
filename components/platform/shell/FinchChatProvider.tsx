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
import {
  MAX_ORDER_FILES,
  ingestOrderDocument,
  validateOrderFile,
  type OrderIngestResult,
} from '@/lib/platform/docu/order-ingest-client';
import { agentModuleForPathname, isBubbleRoute } from '@/lib/ai/finch/module-route';
import { splitTurnText, type TurnText } from '@/lib/ai/finch/narration';
import { looksLikeOrderRequest } from '@/lib/ai/finch/order-intent';
import type { ParsedOrder } from '@/lib/ai/finch/order-handoff';
import type { AgentModule } from '@/lib/ai/finch/config';
import type { Suggestion } from '@/lib/platform/finch-suggestions';
import { REVIEW_CHAT_ROUTE } from '@/lib/platform/review-queue-shared';

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
 * ── ONE FINCH (W4) ──────────────────────────────────────────────────────────
 * `module` is no longer hardcoded: it is `agentModuleForPathname(pathname)`, so
 * the conversation the owner opens on an OrderFlow screen reaches OrderFlow's
 * tools and the one they open on Doc-U reaches Doc-U's, without a second chat
 * component existing to provide it. That is what let FinchLauncher/FinchButton/
 * FinchModal be deleted this wave; everything those three did that survives
 * lives here or in the two components this provider feeds (FinchBubble,
 * chat/OrderCards).
 *
 * WHAT CAME ACROSS FROM THE MODAL, AND WHY IT HAD TO. Three things:
 *   1. `orderMode` — the sticky workflow arm. The server escalates a turn to
 *      the Sonnet tier (and offers `orderflow_prepare_order`) when the message
 *      LOOKS like an order request, but "Bakers, 3 crates" — the owner's answer
 *      to Finch's own clarifying question — does not look like one. Without the
 *      arm, the follow-up drops to Haiku with no order tool offered and the
 *      order is silently never built. It is set by the same regex the route
 *      uses (order-intent.ts, one copy now), cleared the moment a draft arrives
 *      or the conversation is emptied.
 *   2. `orderDraft` SSE events — previously dropped on the floor here. They are
 *      the prepared order, and without a card carrying them into the New Order
 *      builder the workflow tier can talk about an order it can never hand over.
 *   3. The OrderFlow drop path (see `order-ingest-client.ts` for why W5's Doc-U
 *      route cannot invoice a dropped customer order).
 * Both card kinds are provider state rather than transcript turns: they are
 * live UI, and nothing server-side persists what they point at.
 *
 * THE BUBBLE'S OWN STATE lives here for the reason everything else does —
 * GlobalChatDock re-renders per route, so collapsed/expanded held in the bubble
 * would reset every time the owner walked from Suppliers to Stock, and the
 * whole point of the surface is that it is the same conversation everywhere.
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

/** An order Finch prepared through `orderflow_prepare_order`, waiting to be
 *  carried into the New Order builder. */
export interface OrderDraftDockCard {
  kind: 'draft';
  id: string;
  order: ParsedOrder;
}

/** A document dropped on an OrderFlow screen, after the ingest route filed it
 *  (and, when it was a customer order, invoiced it). */
export interface IngestDockCard {
  kind: 'ingest';
  id: string;
  filename: string;
  result: OrderIngestResult;
}

/** The non-sentence things Finch hands back. Drawn by chat/OrderCards.tsx under
 *  the bubble's transcript; see that file for why they are not messages. */
export type DockCard = OrderDraftDockCard | IngestDockCard;

interface OrderDraftEvent {
  customerName?: string | null;
  items?: Array<{ name: string; qty: number; unit_price: number }>;
}

interface SseEvent {
  text?: string;
  /** Which turn of the agentic loop this text came from. Absent on older
   *  servers, which is read as turn 0 — one turn, all of it the answer. */
  turn?: number;
  /** "The text you have from turn N was narration on the way to a tool call."
   *  Arrives after that turn's deltas, because that is when the model commits
   *  to calling something (lib/ai/finch/narration.ts). */
  interim?: number;
  tool?: string;
  done?: boolean;
  error?: string;
  /** The workflow tier's prepared order (W4). Dropped by this provider until
   *  this wave, because nothing here could draw it. */
  orderDraft?: OrderDraftEvent;
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
  /** The partial answer as it arrives; '' between turns. Narration the model
   *  emitted on its way to a tool call is NOT in here — see `streamInterim`. */
  streamText: string;
  /** What Finch said while it was still working ("I'll look up the price
   *  history…"), oldest first. Live only: it is drawn as a muted aside under
   *  the ✦ lines and is never stored, because it is a thing said in passing,
   *  not part of the answer. Empty between turns. */
  streamInterim: string[];
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
  /** Which Finch this route is talking to (W4). Read by the bubble for its
   *  header and by anything that needs to know an OrderFlow-only affordance is
   *  reachable. */
  agentModule: AgentModule;
  /** Prepared orders and filed documents waiting for a decision. */
  cards: DockCard[];
  /** Throw one away. The order it described was never saved server-side, so
   *  this is the whole of "no thanks". */
  dismissCard: (id: string) => void;
  /** Is the module bubble open? Held here so walking between module screens
   *  doesn't collapse a conversation the owner left open. */
  bubbleOpen: boolean;
  /** Open/collapse the bubble. Opening also clears the unread dot. */
  setBubbleOpen: (open: boolean) => void;
  /** An answer landed on a module screen while the bubble was shut. */
  bubbleUnread: boolean;
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
  reviewContext = '',
  orgName,
  suggestions,
  children,
}: {
  /** The open findings, serialised by the LAYOUT from the findings read it
   *  already does for the rail badges (plan §4.1 — one fetch, two consumers).
   *  Prefixed to the first user turn only; see brief-chat.ts. */
  context: string;
  /** The review queue, serialised by the same layout from the same read the
   *  rail's Review row counts. It REPLACES `context` on `/app/chat/review` and
   *  is unused everywhere else: on that screen the owner is asking about the
   *  list in front of them, so shipping the Brief's findings instead would be
   *  answering a question they did not ask — and shipping both would spend the
   *  turn's whole character budget on preamble. */
  reviewContext?: string;
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
  const [streamInterim, setStreamInterim] = useState<string[]>([]);
  const [streamTools, setStreamTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<AttachmentProgress[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [cards, setCards] = useState<DockCard[]>([]);
  const [bubbleOpen, setBubbleOpenState] = useState(false);
  const [bubbleUnread, setBubbleUnread] = useState(false);

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
  /** The sticky workflow arm (W4, ported from FinchModal). A ref, not state:
   *  `send` must read the CURRENT value at the moment it fires, and a re-render
   *  per arm/disarm would buy nothing — nothing draws it. */
  const orderModeRef = useRef(false);
  /** Sequence for card keys. Two drafts in one conversation are two cards. */
  const cardSeq = useRef(0);

  const router = useRouter();
  const pathname = usePathname() ?? '';
  /** The agent this screen talks to (plan §2.5). Recomputed per render, which
   *  is per navigation — layouts don't re-render on one, but this client
   *  component does, because `usePathname()` subscribes it to the route. */
  const agentModule = agentModuleForPathname(pathname);

  /** `pathname` and `bubbleOpen` as an async tail can read them. A turn started
   *  on OrderFlow can finish after the owner has walked to Doc-U and opened the
   *  bubble there; the unread dot must answer to where they ARE, not to where
   *  the closure was built. */
  const pathnameRef = useRef(pathname);
  const bubbleOpenRef = useRef(bubbleOpen);
  useEffect(() => {
    pathnameRef.current = pathname;
    bubbleOpenRef.current = bubbleOpen;
  }, [pathname, bubbleOpen]);

  /** Opening the bubble is what "reading" an answer means. */
  const setBubbleOpen = useCallback((open: boolean) => {
    setBubbleOpenState(open);
    if (open) setBubbleUnread(false);
  }, []);

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
    setStreamInterim([]);
    setStreamTools([]);
    setError(null);
    setActiveChatId(null);
    pendingFindingRef.current = null;
    setAttaching([]);
    setAttachError(null);
    // Sign-out: a prepared order names a real customer, so it must not be on
    // screen for whoever signs in next on a shared workstation — the same
    // reason `clearParsedOrder()` is called there.
    setCards([]);
    orderModeRef.current = false;
    setBubbleOpenState(false);
    setBubbleUnread(false);
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
    // The cards belong to the conversation that produced them; a blank page
    // that still showed yesterday's order draft would be offering to open
    // something the next question has nothing to do with.
    setCards([]);
    orderModeRef.current = false;
  }, []);

  /** Throw a card away. Nothing server-side holds what it described (the route
   *  streams the draft as display data and saves no order), so this is a local
   *  delete by design. */
  const dismissCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
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
      setCards([]);
      orderModeRef.current = false;
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
      setCards([]);
      orderModeRef.current = false;
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
    setStreamInterim([]);
    setStreamTools([]);

    // WHICH PRELUDE. One per screen, never both: the Review chat gets the
    // queue, everything else gets the Brief's findings. Both end with the same
    // marker, so the agent route strips whichever it was back off the message
    // before storing it (`stripBriefPrelude`) and the transcript still redraws
    // the owner's own words on reload.
    const prelude = pathname === REVIEW_CHAT_ROUTE ? reviewContext : context;

    // The prelude rides on the FIRST user turn only — the findings don't change
    // mid-conversation, and repeating them every turn would just re-bill them.
    // Only role + content cross the wire: `tools` and `attachments` are the
    // transcript's business, and the attachment IDS reach the model through the
    // route's own prelude (lib/ai/finch/attachments.ts) so one turn's documents
    // cannot be re-announced on every later turn of the conversation.
    const outbound = nextTurns.map((m, i) => ({
      role: m.role,
      content: i === 0 && prelude ? `${prelude}\n\n${m.content}` : m.content,
    }));

    // Stay in the order workflow for the whole exchange (W4, from FinchModal):
    // once armed by an order-looking message, every later turn keeps routing to
    // the workflow tier — so the model's clarifying question ("which customer?")
    // and the owner's one-word answer to it are not dropped back to the Q&A
    // tier, where `orderflow_prepare_order` isn't even offered. Disarmed when a
    // draft arrives (below) or the conversation is emptied. OrderFlow only:
    // it is the only module with a workflow tool, and the route agrees
    // (`module === 'orderflow' && …`), so arming it anywhere else would ask for
    // an escalation the server would refuse.
    const isOrderText = agentModule === 'orderflow' && looksLikeOrderRequest(text);
    if (isOrderText) orderModeRef.current = true;
    const workflow = agentModule === 'orderflow' && orderModeRef.current;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    /* The turn-by-turn accumulator (lib/ai/finch/narration.ts). The server
     * cannot know a turn was narration until the model calls a tool, so text
     * arrives first and its classification arrives after — which is why this is
     * a keyed list rather than one running string. `splitTurnText` then answers
     * the only two questions the UI has: what is the answer, and what did it
     * say on the way. */
    const byTurn = new Map<number, TurnText>();
    const textOf = (turn: number) => {
      const existing = byTurn.get(turn);
      if (existing) return existing;
      const fresh: TurnText = { turn, text: '', interim: false };
      byTurn.set(turn, fresh);
      return fresh;
    };
    const redraw = () => {
      const { interim, answer } = splitTurnText([...byTurn.values()]);
      setStreamText(answer);
      setStreamInterim(interim);
      return answer;
    };
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
          // The module the conversation STARTED in, stored on the row: it
          // labels the chat in the rail and is what the owner will recognise
          // it by ("that one I started in OrderFlow").
          body: JSON.stringify({ module: agentModule, findingId: pendingFindingRef.current }),
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
          module: agentModule,
          orgName,
          ...(workflow ? { workflow: true } : {}),
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
          // The route already drops a repeat of the line it just sent; this is
          // the second belt, for a chat streamed by an older server.
          else if (evt.tool) {
            if (usedTools[usedTools.length - 1] !== evt.tool) {
              usedTools.push(evt.tool);
              setStreamTools([...usedTools]);
            }
          }
          // Turn N's text was narration, not the answer: move it under the ✦
          // lines. Arrives after that turn's deltas, by construction.
          else if (typeof evt.interim === 'number') {
            textOf(evt.interim).interim = true;
            acc = redraw();
          }
          // The workflow tier prepared an order. It is display data — the route
          // saves nothing — so the card IS the handover: it stashes the draft
          // and opens the New Order builder, which reads it back through
          // order-handoff.ts. Disarms the workflow mode: the order is built,
          // and the next question is a question.
          else if (evt.orderDraft) {
            const draft = evt.orderDraft;
            const items = Array.isArray(draft.items) ? draft.items : [];
            setCards((prev) => [
              ...prev,
              {
                kind: 'draft',
                id: `draft_${cardSeq.current++}`,
                order: { customerName: draft.customerName ?? null, items },
              },
            ]);
            orderModeRef.current = false;
          } else if (evt.text) {
            // No `turn` = an older server, which streamed one string: turn 0,
            // never interim, so this reads exactly as it always did.
            textOf(typeof evt.turn === 'number' ? evt.turn : 0).text += evt.text;
            acc = redraw();
          }
        }
      }

      if (streamError) throw new Error(streamError);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: acc || '…', ...(usedTools.length ? { tools: usedTools } : {}) },
      ]);

      // An answer nobody saw. Only on a bubble route and only while the bubble
      // is shut — on the Brief and the chat pages the answer arrives in front
      // of the owner, so a dot there would be telling them about something they
      // are looking at. Both facts are read from refs because this line runs
      // however many seconds after the closure was built, by which time the
      // owner may have walked to another screen.
      if (!bubbleOpenRef.current && isBubbleRoute(pathnameRef.current)) setBubbleUnread(true);

      // The rail has a new row to draw, and the agent route's `after()` has by
      // now named it. ONCE per chat — every later turn changes only
      // `updated_at`, and re-running the whole platform layout's server reads
      // for that would be an expensive way to reorder a list of one.
      //
      // THE REVIEW CHAT IS THE EXCEPTION, and it refreshes on EVERY turn. Its
      // opening card is the live queue, rendered server-side; the owner asks
      // about an item, approves it in another tab, comes back and asks
      // something else — and without this the card would still be offering the
      // document they already dealt with. `pathnameRef` rather than the
      // closure's `pathname` because this line runs however many seconds after
      // the turn started, by which time they may have walked away.
      if (createdNow || pathnameRef.current === REVIEW_CHAT_ROUTE) router.refresh();
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
        setStreamInterim([]);
        setStreamTools([]);
      }
      // Outside the guard: an ABORTED turn is not in flight either, and a queued
      // upload waiting on `waitUntilIdle` would otherwise wait out its full
      // minute for a stream that ended when the owner signed out.
      streamingRef.current = false;
    }
  }, [input, streaming, turns, context, reviewContext, orgName, activeChatId, agentModule, pathname, router]);

  // The attach flow calls through this rather than closing over `send`.
  useEffect(() => {
    sendRef.current = (text?: string, opts?: { attachments?: ChatAttachment[] }) => void send(text, opts);
  }, [send]);

  /**
   * A document dropped on an OrderFlow screen goes through Finch's ingest route
   * (W4, from FinchModal) — and comes back as an invoice.
   *
   * WHY NOT W5's DOC-U PATH. `order-ingest-client.ts` carries the full reason;
   * the short version is that `/api/ai/extract` only builds the OrderFlow order
   * when the `documents` row was typed `'order'` BEFORE extraction, and the
   * Doc-U upload helper files rows untyped, so a customer order dropped through
   * it is read and filed and then stops. The ingest route classifies first and
   * runs the shared pipeline, so the drop still lands in Doc-U — it just also
   * becomes an order.
   *
   * NO CHAT MESSAGE, ON PURPOSE. This is the modal's behaviour kept: filing a
   * document is not a question, and the card says everything a model turn could
   * ("read as a customer order for Bakers · 6 lines · invoice INV-1042
   * created") without a second of latency or a cent of tokens. The owner can
   * then ask about it in their own words, and `orderflow_find_customer` /
   * the invoice tools answer.
   *
   * SEQUENTIAL, NOT CONCURRENT — FinchModal's rule, and it is load-bearing:
   * each file's create-on-upload (a new customer, a new product) must commit
   * before the next runs, or a batch that is several pages of ONE new
   * customer's order races into duplicate customer / order / invoice rows.
   */
  const attachAsOrders = useCallback(async (picked: File[]) => {
    const problems: string[] = [];
    const queue: File[] = [];
    for (const file of picked.slice(0, MAX_ORDER_FILES)) {
      const problem = validateOrderFile(file);
      if (problem) problems.push(problem);
      else queue.push(file);
    }
    if (picked.length > MAX_ORDER_FILES) problems.push(`Only the first ${MAX_ORDER_FILES} files were read.`);
    setAttachError(problems.length ? problems.join(' ') : null);
    if (queue.length === 0) return;

    for (const file of queue) {
      const key = `${Date.now()}-${file.name}-${cardSeq.current}`;
      setAttaching((prev) => [...prev, { key, filename: file.name, label: `Reading & filing ${file.name}…` }]);
      try {
        const result = await ingestOrderDocument(file);
        setCards((prev) => [
          ...prev,
          { kind: 'ingest', id: `ingest_${cardSeq.current++}`, filename: file.name, result },
        ]);
      } catch (err) {
        problems.push(
          err instanceof Error && err.message ? `${file.name}: ${err.message}` : `Couldn’t file ${file.name}.`,
        );
      } finally {
        setAttaching((prev) => prev.filter((a) => a.key !== key));
      }
    }

    setAttachError(problems.length ? problems.join(' ') : null);
  }, []);

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

      // One drop zone, two destinations — decided by where the owner is
      // standing, which is the only signal available at drop time and the right
      // one: a document dropped on an OrderFlow screen is being dropped INTO
      // OrderFlow.
      if (agentModule === 'orderflow') {
        await attachAsOrders(picked);
        return;
      }

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
    [org?.id, userId, agentModule, attachAsOrders],
  );

  const value = useMemo<FinchChatValue>(
    () => ({
      turns,
      input,
      setInput,
      streaming,
      streamText,
      streamInterim,
      streamTools,
      error,
      activeChatId,
      suggestions,
      attaching,
      attachError,
      canAttach: !!org?.id,
      agentModule,
      cards,
      dismissCard,
      bubbleOpen,
      setBubbleOpen,
      bubbleUnread,
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
      streamInterim,
      streamTools,
      error,
      activeChatId,
      suggestions,
      attaching,
      attachError,
      org?.id,
      agentModule,
      cards,
      dismissCard,
      bubbleOpen,
      setBubbleOpen,
      bubbleUnread,
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
