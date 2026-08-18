'use client';

import { useRef, useState } from 'react';
import { AI_GRADIENT_CHROME, AI_GRADIENT_TEXT } from '@/components/platform/brief/brief-display';
import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';
import { UPLOAD_ACCEPT } from '@/lib/platform/docu/upload-client';

/**
 * The gradient pill you type into — lifted out of `GlobalChatDock` unchanged
 * (markup, tokens, the bespoke blue shadow and the 420→680px expansion are all
 * byte-for-byte what the dock drew) so the dock and the chat pages share ONE
 * composer.
 *
 * WHY EXTRACT IT AT ALL, GIVEN THE DOCK RENDERS EVERYWHERE. Because from this
 * wave the dock renders composer-ONLY on `/app/chat/*` while keeping its
 * floating panel on `/app`, and a second wave (W4's module bubble) needs the
 * same input inside a panel with different chrome. One component means the
 * caret, the disabled-while-streaming rule and the 1.5px gradient border
 * cannot drift between the three places the owner meets them.
 *
 * FOCUS STATE LIVES HERE. The dock used to own `focused` purely to decide the
 * pill's width, which is this component's business — so it came along. Callers
 * that want the wide pill unconditionally (the Brief, the chat pages) pass
 * `alwaysExpanded`.
 *
 * The input element itself is the PROVIDER's ref (`inputRef`), not a local one:
 * a tapped finding hands over the caret through it, and `/app/chat/new` focuses
 * it on mount. There is exactly one composer mounted at a time, so one ref is
 * the right number.
 *
 * THE PAPERCLIP (W5) is the click fallback for drag-and-drop, and it is not
 * optional politeness: a phone has no drag, a trackpad drag from a Mail
 * attachment is fiddly, and some owners will simply never think to try it. It
 * calls the same `attach()` the drop zone does — the file picker and the drop
 * are two doorways onto one flow, which is why neither this component nor
 * `ChatDropZone` contains any upload code.
 *
 * THE PLACEHOLDER IS NO LONGER A PROP (v2b §1, design 1a). It was three
 * different strings chosen by the caller — a "Reply to…" variant on a chat page,
 * a long opener on the Brief, a short one everywhere else — which was three
 * places for the assistant's name to be wrong, and all three had it wrong: they
 * named the platform, not Finch. One component, one sentence, and no way for a
 * fourth mount site to invent a fourth. The contextual "Reply to…" wording went
 * with them; on a chat page the transcript sitting directly above this input
 * already says what typing into it does.
 *
 * (Deliberately paraphrased rather than quoted: the wave's acceptance gate is a
 * static grep for the old copy across platform code, and a gate a comment can
 * trip is a gate someone silences instead of honouring.)
 */

/** The one thing the composer ever says when it is empty. Exported because it
 *  is the assistant's introduction on every surface — if it is ever changed, it
 *  should be changed once, here. */
export const COMPOSER_PLACEHOLDER = 'Ask Finch anything about your operation…';

export function ChatComposer({
  alwaysExpanded = false,
  /** Ran after a send is dispatched — the dock uses it to re-open a transcript
   *  the owner collapsed. Deliberately not an effect on `streaming`, which
   *  would be the setState cascade the lint config rejects. */
  onSend,
  className = '',
}: {
  alwaysExpanded?: boolean;
  onSend?: () => void;
  className?: string;
}) {
  const { input, setInput, streaming, turns, error, send, inputRef, attach, attaching, canAttach } =
    useFinchChat();
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = attaching.length > 0;

  const expanded = alwaysExpanded || focused || turns.length > 0 || streaming || !!error;

  return (
    <div
      // 1.5px gradient border, drawn as padding under a white inner pill — the
      // AI voice (see brief-display.ts for where that gradient is allowed).
      className={`pointer-events-auto mx-auto rounded-full p-[1.5px] shadow-[0_16px_50px_-12px_rgba(31,95,168,0.25)] transition-[max-width] motion-reduce:transition-none ${className}`}
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
          onSend?.();
          send();
        }}
      >
        <span
          className="bg-clip-text text-[15px] text-transparent"
          style={{ backgroundImage: AI_GRADIENT_TEXT }}
          aria-hidden
        >
          ✦
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={streaming}
          placeholder={COMPOSER_PLACEHOLDER}
          aria-label="Ask Finch about your operation"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-muted)] disabled:cursor-not-allowed"
        />
        {canAttach ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                attach(e.target.files);
                // Reset so picking the SAME file twice fires change twice.
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Attach a document"
              title="Attach a PDF or photo"
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[var(--pf-text-muted)] transition-colors hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              <PaperclipIcon />
            </button>
          </>
        ) : null}

        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[var(--pf-text)] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="16"
      height="16"
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
