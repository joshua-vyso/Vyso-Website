'use client';

import { useEffect, useMemo } from 'react';
import { useFinchChat, type ChatTurn } from '@/components/platform/shell/FinchChatProvider';
import { ChatTranscript } from './ChatTranscript';

/**
 * One stored conversation, live (`/app/chat/[id]`, design 1b).
 *
 * TWO SOURCES OF TRUTH, AND A RULE FOR CHOOSING (the crux of this component).
 * The server read this chat's rows and passed them in as `initial`. The
 * provider may ALSO be holding this same conversation — either because the
 * owner has been talking in it, or because they sent from the Brief moments ago
 * and the answer is still arriving as this page mounts. The rule:
 *
 *     activeChatId === chatId  →  the provider's turns win.
 *
 * That is what makes "send from the Brief" work: `send()` pushes here the
 * instant the chat has an id, MID-STREAM, and the server read that follows
 * legitimately returns a transcript with nothing in it (the exchange is stored
 * by the agent route's `after()`, which has not run). Preferring `initial`
 * would blank the answer the owner is watching arrive; preferring the provider
 * shows the same words continuing to appear, on a new screen, without a seam.
 *
 * WHY THE FIRST PAINT IS ALWAYS `initial`. On a HARD load the provider is
 * empty, `activeChatId` is null, and the client's first render must match the
 * server's HTML or React will complain about the mismatch — so the derivation
 * above resolves to `initial` at exactly the moment that matters, and the
 * effect below adopts the chat one tick later with identical content. On a
 * CLIENT navigation there is no hydration to match, and the provider (already
 * holding the live turns) wins from the first frame.
 *
 * ADOPTING, NOT FETCHING. `adoptChat` hands the server's rows to the provider
 * rather than making it re-request them over `GET /api/finch/chats/[id]` — the
 * page just read them. It refuses while a turn is in flight, which is why this
 * effect depends on `streaming`: open chat B while A is still answering and the
 * adoption simply waits for A to land instead of splicing A's reply into B.
 */
export function ChatView({ chatId, initial }: { chatId: string; initial: ChatTurn[] }) {
  const { turns, streaming, streamText, streamTools, error, activeChatId, adoptChat, attaching } =
    useFinchChat();

  // Stable identity across renders so the effect below doesn't re-fire on every
  // parent render (RSC hands a fresh array each time).
  const initialTurns = useMemo(() => initial, [initial]);

  const live = activeChatId === chatId;

  useEffect(() => {
    if (!live && !streaming) adoptChat(chatId, initialTurns);
  }, [live, streaming, chatId, initialTurns, adoptChat]);

  const shown = live ? turns : initialTurns;

  return (
    <ChatTranscript
      turns={shown}
      // Only ever draw the in-flight turn onto the chat it belongs to.
      streaming={live && streaming}
      streamText={live ? streamText : ''}
      streamTools={live ? streamTools : []}
      error={live ? error : null}
      // Same rule as the stream: an upload belongs to the conversation it was
      // dropped into, not to whichever chat happens to be on screen.
      attaching={live ? attaching : []}
    />
  );
}
