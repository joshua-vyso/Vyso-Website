'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { ChatComposer } from '@/components/platform/chat/ChatComposer';
import { ChatTranscript } from '@/components/platform/chat/ChatTranscript';
import { SuggestionChips } from '@/components/platform/chat/SuggestionChips';
import { useFinchChat } from './FinchChatProvider';

/**
 * The chat, everywhere (.ai/plan_chat_first_shell.md §4.3, §12 D1 — Wave 4).
 *
 * A VIEW, NOT A STATE OWNER. Every piece of conversation state lives in
 * FinchChatProvider up in app/app/layout.tsx; this component only draws it and
 * owns one bit of purely local chrome state (is the transcript collapsed).
 * That split is the whole point: this component may re-render or restyle per
 * route, and none of that can cost the owner a turn.
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
 * THREE VARIANTS, ONE COMPOSER (§12 D1; W2 adds the third).
 *   - `/app` — full 680px pill, the caption, the floating transcript panel,
 *     and (while nothing has been said) the suggestion chips above the pill.
 *   - `/app/chat/*` — COMPOSER ONLY. The transcript is the page; a floating
 *     copy of it hovering over itself would be two scroll boxes showing the
 *     same words. The pill stays wide because a reply box that shrinks on a
 *     screen dedicated to replying would be perverse.
 *   - everywhere else — compact ~420px ring that expands on focus or on the
 *     first turn, with the floating panel for the answer.
 *
 * The route tests are `pathname === '/app'` and `startsWith('/app/chat')`,
 * which covers `/app?view=history` for free — history is a search param on the
 * same route, so this needs no useSearchParams() and no Suspense boundary
 * (unlike RailNav, whose active state genuinely depends on the param).
 *
 * GATING (§8 E6). Renders nothing when Finch is switched off platform-wide, or
 * when there is no email on the session, or when the trial has expired — the
 * chat must not be a way around the hard lock TrialGate puts over <main>. Note
 * the deliberate change from Wave A: the old BriefChatPill drew inert
 * "switched off" chrome when `finchEnabled` was false. A dead pill on ONE page
 * was a useful explanation; a dead pill on all thirteen is furniture, so the
 * dock renders nothing instead (plan §8 E6).
 */

const SCRIM = 'w-full bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#FFFFFF_55%)] px-4 pb-6 pt-7';

export function GlobalChatDock() {
  const { email, finchEnabled, trial } = usePlatform();
  const { turns, streaming, streamText, streamTools, error } = useFinchChat();
  const pathname = usePathname() ?? '';

  const [transcriptHidden, setTranscriptHidden] = useState(false);

  const hasConversation = turns.length > 0 || streaming || !!error;

  if (!finchEnabled || !email || trial?.expired) return null;

  const isBrief = pathname === '/app';
  const isNewChat = pathname === '/app/chat/new';
  const isChatPage = pathname.startsWith('/app/chat');
  // The page owns the transcript on a chat route; the dock is the reply box.
  const showPanel = hasConversation && !transcriptHidden && !isChatPage;
  // An opener is only an opener. Once there is a conversation the chips would
  // read as Vyso not having listened.
  const showChips = isBrief && !hasConversation;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center">
      {showPanel ? (
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

          <ChatTranscript
            turns={turns}
            streaming={streaming}
            streamText={streamText}
            streamTools={streamTools}
            error={error}
          />
        </div>
      ) : null}

      <div className={SCRIM}>
        {showChips ? (
          <SuggestionChips className="pointer-events-auto mx-auto mb-3 max-w-[680px] justify-center" />
        ) : null}

        <ChatComposer
          alwaysExpanded={isBrief || isChatPage}
          placeholder={
            // "Reply" only where there is something to reply TO — a blank
            // /app/chat/new asks the same opening question the Brief does.
            isChatPage && !isNewChat
              ? 'Reply to Vyso…'
              : isBrief || isNewChat
                ? 'Ask Vyso anything about your operation…'
                : 'Ask Vyso…'
          }
          onSend={() => {
            // Asking again always re-opens a transcript the owner collapsed —
            // done here rather than in an effect on `streaming`, which would
            // be a setState cascade the lint config rightly rejects.
            setTranscriptHidden(false);
          }}
        />

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
