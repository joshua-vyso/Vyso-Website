'use client';

import { useEffect } from 'react';
import { AI_GRADIENT_TEXT } from '@/components/platform/brief/brief-display';
import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';
import { AttachmentProgressLines } from './AttachmentCard';
import { SuggestionChips } from './SuggestionChips';

/**
 * The blank page (`/app/chat/new`) — a greeting, four openers, and a hint that
 * documents can be dropped here.
 *
 * WHY A CLIENT COMPONENT AT ALL. Three things need the provider: clearing the
 * conversation so this really is a new one, putting the caret in the composer
 * (which lives in the dock, at the bottom of the shell), and knowing whether a
 * turn is already in flight. The greeting itself is SERVER text, passed in —
 * "Morning, Josh" depends on the owner's clock in SAST, and a client
 * recomputing it at hydration can disagree with the HTML it is hydrating.
 *
 * THE DROP HINT IS NOW TRUE (W5). The page is wrapped in a `ChatDropZone` by
 * its route, so the line below describes something that works; the dashed
 * target appears only while a file is actually over the screen. The progress
 * lines are here rather than in a transcript because this screen has no
 * transcript to put them in — the conversation does not exist until the upload
 * finishes and sends its message, and until then this is the only surface that
 * can say "Reading invoice.pdf…".
 */
export function NewChatView({ greeting }: { greeting: string }) {
  const { newChat, streaming, inputRef, attaching, canAttach } = useFinchChat();

  useEffect(() => {
    // A blank screen should be blank. Not while an answer is arriving, though:
    // `newChat()` detaches the transcript without aborting the request, and
    // pulling the conversation out from under a turn in flight would leave the
    // reply landing in an emptied array. Anyone who opens this mid-answer gets
    // the (still-running) conversation until it finishes.
    if (!streaming) newChat();
    inputRef.current?.focus();
    // Once, on arrival. Re-running when `streaming` flips would wipe the
    // conversation the instant its answer completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-6 pb-[200px] pt-16 sm:px-10">
      <h1 className="of-display text-[clamp(22px,2.8vw,30px)] font-semibold leading-[1.3] tracking-[-0.01em] text-balance text-[var(--pf-text)]">
        {greeting}{' '}
        <span className="bg-clip-text text-transparent" style={{ backgroundImage: AI_GRADIENT_TEXT }}>
          What can I look into?
        </span>
      </h1>

      <p className="mt-3 text-[13.5px] leading-[1.6] text-[var(--pf-text-secondary)]">
        Ask about your suppliers, your prices, who owes you money, or anything in your documents. I read; you
        decide.
      </p>

      <SuggestionChips className="mt-7" />

      <AttachmentProgressLines items={attaching} className="mt-7 self-start" />

      {canAttach ? (
        <p className="mt-8 flex items-center gap-2 text-[12.5px] text-[var(--pf-text-faint)]">
          <PaperclipIcon />
          Drop a PDF or a photo of an invoice anywhere on this screen and I&apos;ll read it.
        </p>
      ) : null}
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.4 11.05 12.3 20.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.1 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" />
    </svg>
  );
}
