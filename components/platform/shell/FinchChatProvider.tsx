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
import { onBriefAsk } from '@/components/platform/brief/brief-chat';

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
 * WHAT THIS WAVE DELIBERATELY DOES NOT DO. No navigation, no rail, no visual
 * change to GlobalChatDock — those are W2. `module` is still the hardcoded
 * 'brief' the dock has always sent. The only user-visible difference is that
 * the conversation now survives, and `{tool}` events are kept.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Tool names this answer's model ran, in call order. Assistant turns only;
   *  absent when it answered from context alone. Kept rather than dropped from
   *  this wave on (W2 renders them as ✦ status lines). */
  tools?: string[];
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
    content?: { text?: unknown; tools?: unknown } | null;
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
  /** Sends whatever is in `input`. No-op while streaming or when empty. */
  send: () => void;
  /** Replace the transcript with a stored chat. No-op if it can't be read. */
  openChat: (id: string) => void;
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
  children,
}: {
  /** The open findings, serialised by the LAYOUT from the findings read it
   *  already does for the rail badges (plan §4.1 — one fetch, two consumers).
   *  Prefixed to the first user turn only; see brief-chat.ts. */
  context: string;
  orgName: string | null;
  children: ReactNode;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamTools, setStreamTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A finding card was tapped: name it in the composer and hand over the caret,
  // so the owner writes the actual question. (Verbatim from BriefChatPill; the
  // subscription is per-provider now, and there is one provider.)
  useEffect(
    () =>
      onBriefAsk((prompt) => {
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
    // The reader's `finally` skips this when the signal is aborted, so the
    // reset has to lower the flag itself or the composer stays disabled.
    setStreaming(false);
  }, []);

  /** Forget the current conversation without touching an answer still in
   *  flight — the owner asked for a blank page, not for their last question to
   *  be cancelled. (Contrast `reset()`, which is sign-out and aborts.) */
  const newChat = useCallback(() => {
    setTurns([]);
    setInput('');
    setError(null);
    setActiveChatId(null);
  }, []);

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
        loaded.push({ role, content, ...(tools.length ? { tools } : {}) });
      }
      setTurns(loaded);
      setError(null);
      setActiveChatId(id);
    } catch {
      /* offline / aborted — keep what's on screen */
    }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: text }];
    setTurns(nextTurns);
    setInput('');
    setError(null);
    setStreaming(true);
    setStreamText('');
    setStreamTools([]);

    // The prelude rides on the FIRST user turn only — the findings don't change
    // mid-conversation, and repeating them every turn would just re-bill them.
    const outbound = nextTurns.map((m, i) =>
      i === 0 && context ? { ...m, content: `${context}\n\n${m.content}` } : m,
    );

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';
    const usedTools: string[] = [];

    // Give the conversation a home before streaming into it. A failure here is
    // not an error the owner needs to see: `chatId` stays null, the turn goes
    // up unpersisted, and they get their answer.
    let chatId = activeChatId;
    if (!chatId) {
      try {
        const res = await fetch('/api/finch/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: 'brief' }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const created = (await res.json()) as { id?: unknown };
          if (typeof created.id === 'string') {
            chatId = created.id;
            setActiveChatId(created.id);
          }
        }
      } catch {
        /* unpersisted turn — the answer still matters more than the record */
      }
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
    }
  }, [input, streaming, turns, context, orgName, activeChatId]);

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
      send: () => void send(),
      openChat: (id: string) => void openChat(id),
      newChat,
      reset,
      inputRef,
    }),
    [turns, input, streaming, streamText, streamTools, error, activeChatId, send, openChat, newChat, reset],
  );

  return <FinchChatContext.Provider value={value}>{children}</FinchChatContext.Provider>;
}
