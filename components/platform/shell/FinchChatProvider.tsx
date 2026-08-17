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
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface SseEvent {
  text?: string;
  tool?: string;
  done?: boolean;
  error?: string;
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
  error: string | null;
  /** Sends whatever is in `input`. No-op while streaming or when empty. */
  send: () => void;
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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    // The reader's `finally` skips this when the signal is aborted, so the
    // reset has to lower the flag itself or the composer stays disabled.
    setStreaming(false);
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

    // The prelude rides on the FIRST user turn only — the findings don't change
    // mid-conversation, and repeating them every turn would just re-bill them.
    const outbound = nextTurns.map((m, i) =>
      i === 0 && context ? { ...m, content: `${context}\n\n${m.content}` } : m,
    );

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: outbound, module: 'brief', orgName }),
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
          // `{tool}` status lines are deliberately dropped: v1 answers are text
          // (.ai/plan_brief_home.md § Out of scope), and the brief module has no
          // tools anyway.
          else if (evt.text) {
            acc += evt.text;
            setStreamText(acc);
          }
        }
      }

      if (streamError) throw new Error(streamError);
      setTurns((prev) => [...prev, { role: 'assistant', content: acc || '…' }]);
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        // Keep any partial answer — half an answer still beats losing it.
        if (acc) setTurns((prev) => [...prev, { role: 'assistant', content: acc }]);
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setStreaming(false);
        setStreamText('');
      }
    }
  }, [input, streaming, turns, context, orgName]);

  const value = useMemo<FinchChatValue>(
    () => ({
      turns,
      input,
      setInput,
      streaming,
      streamText,
      error,
      send: () => void send(),
      reset,
      inputRef,
    }),
    [turns, input, streaming, streamText, error, send, reset],
  );

  return <FinchChatContext.Provider value={value}>{children}</FinchChatContext.Provider>;
}
