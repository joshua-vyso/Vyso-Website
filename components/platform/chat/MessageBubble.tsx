'use client';

import Link from 'next/link';
import { usePlatform } from '@/lib/platform/session';
import { AI_GRADIENT_CHROME } from '@/components/platform/brief/brief-display';
import { FinchMark } from '@/components/platform/finch/FinchMark';
import { sourceLinksFor } from './chat-display';

/**
 * The two shapes a message takes (design 1b).
 *
 * The owner's words sit right, in the warm grey bubble with the squared
 * bottom-right corner; Vyso's answer sits left, unboxed, behind the gradient
 * disc with the Finch bird on it. That asymmetry is the design's whole grammar
 * for "who is speaking" —
 * a chat where both sides were bubbles would read as two people, and this is
 * one person and their software.
 *
 * Both were inline in `GlobalChatDock`; they moved here so the dock's floating
 * panel and the full chat page draw the identical message, which is the thing
 * that makes navigating from one to the other feel like the same conversation
 * rather than two views of it.
 */

export function UserBubble({ text }: { text: string }) {
  return (
    <p className="max-w-[80%] self-end whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-[#F1EEE9] px-[18px] py-3 text-[15px] leading-[1.5] text-[var(--pf-text)]">
      {text}
    </p>
  );
}

/**
 * One Vyso answer.
 *
 * `tools` drives the source pills underneath — see `sourceLinksFor` for why
 * they point at screens rather than at individual documents. They are omitted
 * entirely while the answer is still streaming: a link that appears halfway
 * through a sentence invites a click that abandons the answer being written.
 *
 * A pill into a module this org has LOCKED is dropped rather than drawn.
 * ModuleLockGuard would catch the click and explain, but "here's where that
 * came from" followed by an upsell screen is a small betrayal — Finch read the
 * data through tools that don't care about the module gate, so the honest move
 * is to answer and offer no link.
 */
export function AssistantMessage({
  text,
  tools,
  streaming = false,
}: {
  text: string;
  tools?: readonly string[];
  streaming?: boolean;
}) {
  const { lockedModules } = usePlatform();
  const sources = streaming
    ? []
    : sourceLinksFor(tools).filter((s) => !(lockedModules as string[]).includes(s.feature));

  return (
    <div className="flex gap-3.5">
      {/* The speaker's mark, so it is the BIRD and not the ✦: a disc beside an
          answer is an avatar, and an avatar is an identity. The ✦ still means
          "Vyso is working / Vyso wrote this line" and keeps the inline status
          lines (ToolStatusLine) and the recommendation blocks. 21px in a 30px
          disc — the bird is line art and needs ~70% to hold its stroke. */}
      <span
        className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full"
        style={{ background: AI_GRADIENT_CHROME }}
        aria-hidden
      >
        <FinchMark size={21} title="" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-[15.5px] leading-[1.6] text-[var(--pf-text-body)]">{text}</p>
        {sources.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-full bg-[var(--pf-accent-weak)] px-3 py-[5px] text-[12.5px] text-[var(--pf-accent-strong)] transition-colors hover:bg-[var(--pf-accent-weak-hover)]"
                style={{ transitionDuration: 'var(--dur-hover)' }}
              >
                {s.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
