'use client';

import { useState } from 'react';
import { AI_GRADIENT_CHROME, AI_GRADIENT_TEXT } from '@/components/platform/brief/brief-display';
import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';

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
 */
export function ChatComposer({
  placeholder,
  alwaysExpanded = false,
  /** Ran after a send is dispatched — the dock uses it to re-open a transcript
   *  the owner collapsed. Deliberately not an effect on `streaming`, which
   *  would be the setState cascade the lint config rejects. */
  onSend,
  className = '',
}: {
  placeholder: string;
  alwaysExpanded?: boolean;
  onSend?: () => void;
  className?: string;
}) {
  const { input, setInput, streaming, turns, error, send, inputRef } = useFinchChat();
  const [focused, setFocused] = useState(false);

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
          placeholder={placeholder}
          aria-label="Ask Vyso about your operation"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-muted)] disabled:cursor-not-allowed"
        />
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
