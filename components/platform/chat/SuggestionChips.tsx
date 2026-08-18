'use client';

import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';

/**
 * Four things worth asking, computed from what this business actually has open
 * (plan §1.4). Clicking one sends it — the chip's `label` is the pill, its
 * `prompt` is the message.
 *
 * WHERE THEY COME FROM. `app/app/layout.tsx` builds them once per server
 * render (`lib/platform/finch-suggestions*.ts`) and hands them to
 * `FinchChatProvider`, so this component reads context rather than props. That
 * was true when it had two mount sites and is still true with one: `NewChatView`
 * is rendered by `/app/chat/new`, three levels below the layout that computes
 * the row, and prop-drilling through the shell to reach it would be worse than
 * a context read.
 *
 * ONE MOUNT SITE NOW (v2b). The chips used to appear above the dock's composer
 * on an empty `/app` as well. The owner's ruling was that they belong only in a
 * new chat — the Brief already presents a list of things worth attending to, and
 * a second list of things worth asking underneath it splits the same decision in
 * two. `GlobalChatDock` no longer imports this component.
 *
 * WHY THEY DISAPPEAR ONCE A CONVERSATION STARTS. The caller gates on an empty
 * transcript — `/app/chat/new` clears the conversation on arrival and navigates
 * away on the first send, so the screen this renders on is by definition the
 * blank one. A suggestion is an opener; offering "What should I look at first
 * today?" underneath an answer about butternut would read as Finch not having
 * listened. Nothing here needs to know that rule — the caller owns it — but it
 * is why this component has no "hide after first turn" logic of its own.
 *
 * Styled as the design's evidence pills (1b): accent-weak ground, accent-strong
 * text, fully rounded. That is already the platform's "this is a link into your
 * data" shape, and a chip IS that — the question it asks is about their data.
 */
export function SuggestionChips({ className = '' }: { className?: string }) {
  const { suggestions, streaming, send } = useFinchChat();

  if (suggestions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {suggestions.map((s) => (
        <button
          key={s.label}
          type="button"
          disabled={streaming}
          onClick={() => send(s.prompt)}
          className="rounded-full border border-transparent bg-[var(--pf-accent-weak)] px-3.5 py-[7px] text-[12.5px] text-[var(--pf-accent-strong)] transition-colors hover:bg-[var(--pf-accent-weak-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
