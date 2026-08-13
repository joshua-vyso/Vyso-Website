'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '@/lib/platform/session';
import { BouncingDots } from '@/components/platform/finch/BouncingDots';
import { AI_GRADIENT_CHROME, AI_GRADIENT_TEXT } from './brief-display';
import { onBriefAsk } from './brief-chat';

/**
 * The chat pill — the Brief's second half, now wired to Finch.
 *
 * WHAT IT TALKS TO. The existing agent endpoint, unchanged: POST
 * /api/ai/agent with `{ messages, module: 'brief', orgName }`, replying as SSE
 * `data:` frames of `{text} | {tool} | {done} | {error}`. The 'brief' module is
 * a normal Finch module (lib/ai/finch/config.ts + its knowledge doc); the route
 * validates it through `isAgentModule`, so nothing there needed changing.
 *
 * WHY THE READER IS OPEN-CODED. `useFinchStream` owns the messages it sends,
 * and this surface needs to send something different from what it shows: the
 * first turn carries the findings prelude (see brief-chat.ts). That is the same
 * reason FinchModal was never refactored onto the hook — a surface with an
 * extra branch keeps its own ~20-line reader rather than widening a hook that
 * three callers share. The wire protocol is identical, deliberately.
 *
 * GATING. Finch is on for every signed-in user unless FINCH_ENABLED is turned
 * off; the browser can't read that server-only var, so the pill reads the
 * server-resolved `finchEnabled` flag off the platform session — exactly as
 * FinchLauncher does. When it's off the pill renders its Wave A disabled
 * chrome rather than an input that swallows what the owner types.
 *
 * Sticky rather than fixed: it sits at the bottom of the page's own scroll
 * column, so the platform TopBar above it and the modules beside it are
 * untouched.
 */

interface Turn {
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

const WRAP = 'sticky bottom-0 mt-8 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#FFFFFF_55%)] px-1 pb-6 pt-7';
const HINT = 'mx-auto mt-2 max-w-[680px] text-center text-[11.5px] text-[var(--pf-text-faint)]';

/** The ✦ mark, in the sanctioned gradient — "Vyso wrote this". */
function AiMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`bg-clip-text text-transparent ${className}`}
      style={{ backgroundImage: AI_GRADIENT_TEXT }}
      aria-hidden
    >
      ✦
    </span>
  );
}

export function BriefChatPill({ context, orgName }: {
  /** The open findings, serialised — prefixed to the first turn. See brief-chat.ts. */
  context: string;
  orgName: string | null;
}) {
  const { email, finchEnabled } = usePlatform();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // A finding card was tapped: name it in the composer and hand over the caret,
  // so the owner writes the actual question.
  useEffect(
    () =>
      onBriefAsk((prompt) => {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${prompt}` : prompt));
        inputRef.current?.focus();
      }),
    [],
  );

  // Abort any in-flight stream if the page navigates away mid-answer.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest turn in view as the answer grows.
  useEffect(() => {
    if (turns.length > 0 || streaming) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns, streamText, streaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const nextTurns: Turn[] = [...turns, { role: 'user', content: text }];
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

  // Kill switch (or a session without an email): the Wave A chrome, still
  // honest about being inert rather than pretending to listen.
  if (!finchEnabled || !email) return <DisabledPill />;

  const open = turns.length > 0 || streaming || !!error;

  return (
    // The conversation is a SIBLING of the pill, not a child of it: a sticky
    // element can only stick inside its own box, so a transcript rendered
    // within the pill's wrapper would grow that box until the composer stopped
    // pinning and scrolled away mid-answer. Out here it scrolls underneath the
    // pill's gradient fade instead, which is what the mock shows.
    <>
      {open ? (
        <div className="mx-auto flex max-w-[680px] flex-col gap-[22px] px-1">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <p
                key={i}
                className="max-w-[70%] self-end whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-[#F1EEE9] px-[18px] py-3 text-[15px] leading-[1.5] text-[var(--pf-text)]"
              >
                {t.content}
              </p>
            ) : (
              <VysoReply key={i} text={t.content} />
            ),
          )}
          {streaming ? (
            streamText ? (
              <VysoReply text={streamText} />
            ) : (
              <div className="flex items-center gap-3 pl-0.5">
                <BouncingDots size={7} />
                <span className="text-[12.5px] text-[var(--pf-text-faint)]">Reading your brief…</span>
              </div>
            )
          ) : null}
          {error ? <p className="text-[12.5px] text-[#A32D2D]">{error}</p> : null}
          {/* The scroll target sits a pill's height clear of the bottom, so the
              newest line never lands underneath the composer. */}
          <div ref={endRef} className="scroll-mb-[150px]" />
        </div>
      ) : null}

      <div className={WRAP}>
        {/* 1.5px gradient border, drawn as padding under a white inner pill —
            one of the four places this gradient is allowed to appear. */}
        <div
          className="mx-auto max-w-[680px] rounded-full p-[1.5px] shadow-[0_16px_50px_-12px_rgba(31,95,168,0.25)]"
          style={{ background: AI_GRADIENT_CHROME }}
        >
          <form
            className="flex items-center gap-3 rounded-full bg-white py-[13px] pl-5 pr-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <AiMark className="text-[15px]" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
              placeholder="Ask Vyso anything about your operation…"
              aria-label="Ask Vyso about your operation"
              className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-muted)] disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send"
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[var(--pf-text)] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendIcon />
            </button>
          </form>
        </div>
        <p className={HINT}>Tap any finding to bring it into the conversation</p>
      </div>
    </>
  );
}

/** One Vyso answer: the ✦ badge and plain text. No charts, no tool-status
 *  lines — those are later waves (.ai/plan_brief_home.md § Out of scope). */
function VysoReply({ text }: { text: string }) {
  return (
    <div className="flex gap-3.5">
      <span
        className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[13px] text-white"
        style={{ background: AI_GRADIENT_CHROME }}
        aria-hidden
      >
        ✦
      </span>
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-[15.5px] leading-[1.6] text-[var(--pf-text-body)]">
        {text}
      </p>
    </div>
  );
}

/** The Wave A chrome, for when Finch is switched off platform-wide. */
function DisabledPill() {
  return (
    <div className={WRAP}>
      <div
        className="mx-auto max-w-[680px] rounded-full p-[1.5px] opacity-60 shadow-[0_16px_50px_-12px_rgba(31,95,168,0.18)]"
        style={{ background: AI_GRADIENT_CHROME }}
      >
        <div className="flex items-center gap-3 rounded-full bg-white py-[13px] pl-5 pr-2">
          <AiMark className="text-[15px]" />
          <input
            type="text"
            disabled
            placeholder="Ask Vyso anything about your operation…"
            aria-label="Ask Vyso (unavailable)"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-muted)] disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            aria-label="Send (unavailable)"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[var(--pf-text)] text-white disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>
      </div>
      <p className={HINT}>Asking Vyso is switched off right now.</p>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
