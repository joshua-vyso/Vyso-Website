'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { BouncingDots } from '@/components/platform/finch/BouncingDots';
import { AI_GRADIENT_CHROME, AI_GRADIENT_TEXT } from '@/components/platform/brief/brief-display';
import { useFinchChat } from './FinchChatProvider';

/**
 * The chat, everywhere (.ai/plan_chat_first_shell.md §4.3, §12 D1 — Wave 4).
 *
 * A VIEW, NOT A STATE OWNER. Every piece of conversation state lives in
 * FinchChatProvider up in app/app/layout.tsx; this component only draws it and
 * owns two bits of purely local chrome state (is the composer focused, is the
 * transcript collapsed). That split is the whole point: this component may
 * re-render or restyle per route, and none of that can cost the owner a turn.
 *
 * PLACEMENT — SIBLING OF <main>, NOT CHILD (deviation from the plan's literal
 * wording, same result). Plan §4.3 says "bottom-docked overlay inside <main>
 * (absolute, bottom:0)". <main> is the scroll container, and an
 * absolutely-positioned child of a scroll container is positioned against the
 * SCROLLED padding box — `bottom:0` would park the dock at the bottom of the
 * document and scroll it away, not pin it to the viewport. So the layout marks
 * the flex column that holds <main> `relative` and renders the dock as <main>'s
 * next sibling: identical geometry (the column's bottom edge IS <main>'s bottom
 * edge), correct pinning, no `position: fixed` — which would have escaped the
 * column and slid under the 216px rail.
 *
 * z-20, and the scrim is `pointer-events-none` (plan §8 E5). Module drawers,
 * modals and sticky footers live at z-30+ and therefore sit above the dock; the
 * fade-to-white band the pill floats on doesn't swallow clicks meant for the
 * table underneath it — only the pill and the transcript panel take pointer
 * events.
 *
 * VARIANTS (§12 D1, APPROVED). Full 680px pill with the caption on the Brief;
 * compact ~420px ring with the ✦ glyph and no caption everywhere else,
 * expanding to full width on focus or on the first turn at `--dur-control`
 * `--ease-out-soft`. The Brief test is `pathname === '/app'`, which covers
 * `/app?view=history` for free — history is a search param on the same route,
 * so this needs no useSearchParams() and no Suspense boundary (unlike RailNav,
 * whose active state genuinely depends on the param).
 *
 * GATING (§8 E6). Renders nothing when Finch is switched off platform-wide, or
 * when there is no email on the session, or when the trial has expired — the
 * chat must not be a way around the hard lock TrialGate puts over <main>. Note
 * the deliberate change from Wave A: the old BriefChatPill drew inert
 * "switched off" chrome when `finchEnabled` was false. A dead pill on ONE page
 * was a useful explanation; a dead pill on all thirteen is furniture, so the
 * dock renders nothing instead (plan §8 E6).
 *
 * The bespoke blue pill shadow is kept inline (plan §7 ruling — it is an
 * AI-voice moment, not a menu).
 */

const SCRIM = 'w-full bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#FFFFFF_55%)] px-4 pb-6 pt-7';

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

export function GlobalChatDock() {
  const { email, finchEnabled, trial } = usePlatform();
  const { turns, input, setInput, streaming, streamText, error, send, inputRef } = useFinchChat();
  const pathname = usePathname() ?? '';

  const [focused, setFocused] = useState(false);
  const [transcriptHidden, setTranscriptHidden] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const hasConversation = turns.length > 0 || streaming || !!error;

  // Keep the newest line in view as the answer grows. `block: 'nearest'` scrolls
  // the transcript panel, which is its own scroll box — not the page.
  useEffect(() => {
    if (hasConversation && !transcriptHidden) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [turns, streamText, streaming, hasConversation, transcriptHidden]);

  if (!finchEnabled || !email || trial?.expired) return null;

  const isBrief = pathname === '/app';
  const expanded = isBrief || focused || hasConversation;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center">
      {hasConversation && !transcriptHidden ? (
        <div className="pointer-events-auto mx-4 flex max-h-[46vh] w-[calc(100%-2rem)] max-w-[680px] flex-col overflow-y-auto rounded-2xl border border-[var(--pf-border-strong)] bg-white px-5 pb-4 pt-3 shadow-[var(--pf-shadow-menu)]">
          <div className="sticky top-0 -mx-5 -mt-3 mb-3 flex items-center justify-between border-b border-[var(--pf-border-soft)] bg-white px-5 pb-2 pt-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
              Asking Vyso
            </span>
            <button
              type="button"
              onClick={() => setTranscriptHidden(true)}
              className="rounded-md px-1.5 py-0.5 text-[12px] text-[var(--pf-text-muted)] transition-colors hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)] motion-reduce:transition-none"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              Hide
            </button>
          </div>

          <div className="flex flex-col gap-[22px]">
            {turns.map((t, i) =>
              t.role === 'user' ? (
                <p
                  key={i}
                  className="max-w-[80%] self-end whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-[#F1EEE9] px-[18px] py-3 text-[15px] leading-[1.5] text-[var(--pf-text)]"
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
            <div ref={endRef} />
          </div>
        </div>
      ) : null}

      <div className={SCRIM}>
        {/* 1.5px gradient border, drawn as padding under a white inner pill —
            the AI voice, now on every /app/* route (see brief-display.ts). */}
        <div
          className="pointer-events-auto mx-auto rounded-full p-[1.5px] shadow-[0_16px_50px_-12px_rgba(31,95,168,0.25)] transition-[max-width] motion-reduce:transition-none"
          style={{
            background: AI_GRADIENT_CHROME,
            maxWidth: expanded ? '680px' : '420px',
            transitionDuration: 'var(--dur-control)',
            transitionTimingFunction: 'var(--ease-out-soft)',
          }}
        >
          <form
            className="flex items-center gap-3 rounded-full bg-white py-[13px] pl-5 pr-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Asking again always re-opens a transcript the owner collapsed —
              // done here rather than in an effect on `streaming`, which would
              // be a setState cascade the lint config rightly rejects.
              setTranscriptHidden(false);
              send();
            }}
          >
            <AiMark className="text-[15px]" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={streaming}
              placeholder={isBrief ? 'Ask Vyso anything about your operation…' : 'Ask Vyso…'}
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

        {/* The caption is the Brief's alone: it explains the finding cards that
            are only on that screen (plan §12 D1 — compact variant, no caption). */}
        {isBrief ? (
          <p className="mx-auto mt-2 max-w-[680px] text-center text-[11.5px] text-[var(--pf-text-faint)]">
            Tap any finding to bring it into the conversation
          </p>
        ) : null}
      </div>
    </div>
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

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
