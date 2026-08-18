'use client';

import { useEffect, useRef } from 'react';
import { BouncingDots } from '@/components/platform/finch/BouncingDots';
import type { AttachmentProgress, ChatTurn } from '@/components/platform/shell/FinchChatProvider';
import { AttachmentCards, AttachmentProgressLines } from './AttachmentCard';
import { AssistantMessage, UserBubble } from './MessageBubble';
import { ToolStatusLines } from './ToolStatusLine';

/**
 * A conversation, drawn (design 1b).
 *
 * PROPS, NOT CONTEXT. This component reads nothing from `useFinchChat()` on
 * purpose: it is used twice with two different sources of truth — the dock's
 * floating panel always draws the LIVE conversation, while `/app/chat/[id]`
 * draws either the live one (when that chat is the active one) or the rows the
 * server just read (when it is not). A component that reached for the provider
 * itself could not tell those apart, and would show the wrong transcript for
 * exactly one frame after a navigation, which is the frame the owner is
 * looking at.
 *
 * ORDER WITHIN A TURN (design 1b): the question, then the ✦ lines saying what
 * Vyso went and read, then the answer. The tool lines belong to the ASSISTANT
 * turn — that is where the server stores them — so they render immediately
 * above the answer they explain rather than as a separate block.
 *
 * AUTOSCROLL. `block: 'nearest'` walks up to whichever ancestor is actually
 * scrollable: the panel's own overflow box in the dock, and the platform's
 * `<main>` on the chat page. Same call, two containers, no prop.
 */
export function ChatTranscript({
  turns,
  streaming = false,
  streamText = '',
  streamInterim = [],
  streamTools = [],
  error = null,
  /** Files being uploaded/read right now (W5). Drawn after the last turn,
   *  because that is where the message they become will appear. */
  attaching = [],
  /** What the dots say before the first token. The Brief reads its findings;
   *  a module chat is doing something else, so the caller names it. */
  waitingLabel = 'Reading your brief…',
  className = '',
}: {
  turns: readonly ChatTurn[];
  streaming?: boolean;
  streamText?: string;
  /** What Vyso said on its way to a tool call. Drawn as a muted aside under the
   *  ✦ lines, live only — see lib/ai/finch/narration.ts for why it is not part
   *  of the answer and is never stored. */
  streamInterim?: readonly string[];
  streamTools?: readonly string[];
  error?: string | null;
  attaching?: readonly AttachmentProgress[];
  waitingLabel?: string;
  className?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns, streamText, streamInterim, streamTools, streaming, attaching]);

  return (
    <div className={`flex flex-col gap-[22px] ${className}`}>
      {turns.map((t, i) =>
        t.role === 'user' ? (
          // Cards ABOVE the words: the owner dropped the file and then the
          // message was written for them, so that is the order it happened in.
          t.attachments?.length ? (
            <div key={i} className="flex flex-col gap-2">
              <AttachmentCards attachments={t.attachments} />
              <UserBubble text={t.content} />
            </div>
          ) : (
            <UserBubble key={i} text={t.content} />
          )
        ) : (
          <div key={i} className="flex flex-col gap-[14px]">
            <ToolStatusLines tools={t.tools} />
            <AssistantMessage text={t.content} tools={t.tools} />
          </div>
        ),
      )}

      <AttachmentProgressLines items={attaching} />

      {streaming ? (
        <div className="flex flex-col gap-[14px]">
          <ToolStatusLines tools={streamTools} pulsing />
          {/* "I'll look up the price history and see who else supplies it." —
              true, worth seeing while it happens, and not the answer. Muted and
              italic so it reads as an aside rather than a paragraph, and gone
              from the finished turn (the server stores only the answer). */}
          {streamInterim.length > 0 ? (
            <div className="flex flex-col gap-1 pl-0.5">
              {streamInterim.map((line, i) => (
                <p key={i} className="text-[12.5px] italic leading-[1.5] text-[var(--pf-text-faint)]">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          {streamText ? (
            <AssistantMessage text={streamText} streaming />
          ) : (
            <div className="flex items-center gap-3 pl-0.5">
              <BouncingDots size={7} />
              <span className="text-[12.5px] text-[var(--pf-text-faint)]">{waitingLabel}</span>
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="text-[12.5px] text-[#A32D2D]">{error}</p> : null}
      <div ref={endRef} />
    </div>
  );
}
