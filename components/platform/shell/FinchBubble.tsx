'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChatComposer } from '@/components/platform/chat/ChatComposer';
import { ChatDropZone } from '@/components/platform/chat/ChatDropZone';
import { ChatTranscript } from '@/components/platform/chat/ChatTranscript';
import { DockCards } from '@/components/platform/chat/OrderCards';
import { FinchMark } from '@/components/platform/finch/FinchMark';
import { useFinchChat } from './FinchChatProvider';
import { moduleForPathname } from './shell-data';

/**
 * Finch on a module screen (`.ai/plan_brief_chat_v2.md` §1.5, W4; design 1d).
 *
 * THE ONE FINCH. Until this wave there were two chats in this product: the dock
 * (Brief-scoped, everywhere) and FinchModal behind a gradient pill in OrderFlow's
 * and Doc-U's chrome (module-scoped, in a full-screen dialog, with its own
 * transcript that shared nothing with the dock's). An owner who asked the dock
 * something on the Brief and then opened the pill in OrderFlow met a blank
 * stranger. This component is the dock's COLLAPSED state on those screens — the
 * same conversation, the same provider, drawn small until it is wanted — which
 * is why the modal, its button and its launcher could be deleted rather than
 * restyled.
 *
 * THE PILL IS THE MODAL'S. `finch-gradient` + `FinchMark` + "Finch", moved from
 * FinchButton (this is the "little blue gradient bubble titled Finch" the brief
 * names). What changed is only where it lives: it used to sit in each module's
 * sub-nav, so it landed in a different place on every screen and moved when the
 * chrome above it did. Now it is pinned to the bottom-right of the main column,
 * 24px in on both edges, identical on all thirteen routes.
 *
 * GEOMETRY. Absolute, not fixed — the containing block is the flex column that
 * holds <main> (app/app/layout.tsx marks it `relative`), the same trick and the
 * same reason as GlobalChatDock's docblock spells out: `fixed` would escape the
 * column and slide under the 216px rail. Being inside that column also means the
 * mobile top bar is simply above it and needs no allowance; the panel's 62vh cap
 * keeps it clear of the header on short screens. z-20 like the dock: module
 * drawers and modals at z-30+ still cover it.
 *
 * WHAT THE PANEL IS. Header (mark, name, the module the owner is standing in,
 * collapse), the live transcript, the OrderFlow cards, and the shared composer —
 * every one of them the same component the Brief and the chat pages use, so the
 * caret, the streaming rules and the drop zone cannot drift between the three
 * surfaces. 420 × 62vh on desktop; a full-width sheet on the phone, where a
 * 420px panel would be the whole screen with a margin.
 */

/** Where the bubble sits, on every route that has one. */
const ANCHOR = 'pointer-events-none absolute bottom-0 right-0 z-20 flex max-w-full flex-col items-end';

export function FinchBubble() {
  const {
    turns,
    streaming,
    streamText,
    streamTools,
    error,
    attaching,
    cards,
    dismissCard,
    bubbleOpen,
    setBubbleOpen,
    bubbleUnread,
    inputRef,
  } = useFinchChat();
  const pathname = usePathname() ?? '';

  // The screen's own name, for the header. Null on the account routes
  // (/app/settings, /app/organisation, /app/notifications), which are not
  // MODULES entries — there the header is just "Finch", which is true.
  const moduleLabel = moduleForPathname(pathname)?.label ?? null;

  // Escape collapses (plan §1.5). Bound only while open, so it cannot compete
  // with a module drawer's own Escape handler the rest of the time.
  useEffect(() => {
    if (!bubbleOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBubbleOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bubbleOpen, setBubbleOpen]);

  // Hand over the caret when it opens — the owner clicked it to say something.
  useEffect(() => {
    if (!bubbleOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [bubbleOpen, inputRef]);

  if (!bubbleOpen) {
    return (
      <div className={`${ANCHOR} p-4 sm:p-6`}>
        <button
          type="button"
          onClick={() => setBubbleOpen(true)}
          aria-label={bubbleUnread ? 'Open Finch — new answer' : 'Open Finch'}
          aria-expanded={false}
          className="finch-gradient pointer-events-auto relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_10px_-2px_rgba(62,143,224,0.6)] transition-transform hover:scale-[1.03] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{ transitionDuration: 'var(--dur-hover)', transitionTimingFunction: 'var(--ease-out-soft)' }}
        >
          {/* The pill IS the gradient, so the bird sits straight on it — no
              disc of its own. 17px rather than 15: the mark is line art now and
              a 15px bird is a half-pixel stroke. */}
          <FinchMark size={17} title="" />
          Finch
          {bubbleUnread ? (
            // An answer arrived while this was shut. A dot rather than a count:
            // there is one conversation, and what matters is that it moved.
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#E5651F]"
            />
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <div className={`${ANCHOR} sm:p-6`}>
      <div
        role="dialog"
        aria-label={moduleLabel ? `Finch — ${moduleLabel}` : 'Finch'}
        className="vyso-pop-in-up pointer-events-auto flex max-h-[62vh] w-screen max-w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--pf-border-strong)] bg-white shadow-[var(--pf-shadow-menu)] sm:w-[420px] sm:rounded-2xl"
        // The shared open-upward keyframe is anchored bottom-LEFT (the rail's
        // user menu opens from there); this panel grows out of the bubble in
        // the opposite corner. Reduced motion drops the animation entirely —
        // see the @media block beside the keyframe in globals.css.
        style={{ transformOrigin: 'bottom right' }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--pf-border-soft)] px-4 py-3">
          {/* This span is already the gradient disc; the mark must not draw a
              second one inside it (see FinchMark's `chip`). 17px in a 24px disc
              is the ~70% the bird's stroke weight needs to stay legible. */}
          <span className="finch-gradient flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
            <FinchMark size={17} title="" />
          </span>
          <span className="of-display text-[14.5px] font-semibold text-[var(--pf-text)]">Finch</span>
          {moduleLabel ? (
            <span className="min-w-0 truncate text-[12px] text-[var(--pf-text-faint)]">· {moduleLabel}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setBubbleOpen(false)}
            aria-label="Collapse Finch"
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[14px] text-[var(--pf-text-muted)] transition-colors hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)] motion-reduce:transition-none"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            ✕
          </button>
        </div>

        {/* The zone is the panel BODY, not the whole panel — the same split
            GlobalChatDock makes, and for the same reason: it keeps the drop
            overlay pinned to what the owner can see (an `absolute` overlay
            inside the scroller would be laid out against the SCROLLED box and
            appear halfway up a long transcript), and it puts the zone's own
            inline rejection line above the composer rather than under it. The
            padding lives on the zone so that line is inset with everything
            else; the scroller cancels it with a negative margin so the
            transcript still uses the panel's full width. */}
        <ChatDropZone className="flex min-h-0 flex-1 flex-col px-4 pb-1 pt-4" label="Drop it here — I’ll read it">
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
            {turns.length === 0 && !streaming && cards.length === 0 && attaching.length === 0 ? (
              <p className="text-[13px] leading-5 text-[var(--pf-text-faint)]">
                Ask me how to do anything {moduleLabel ? `in ${moduleLabel}` : 'here'}, or about your live numbers,
                orders and customers. Drop a document in and I’ll read it and file it in Doc-U.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <ChatTranscript
                  turns={turns}
                  streaming={streaming}
                  streamText={streamText}
                  streamTools={streamTools}
                  error={error}
                  attaching={attaching}
                  waitingLabel="Looking that up…"
                />
                <DockCards cards={cards} onDismiss={dismissCard} onNavigate={() => setBubbleOpen(false)} />
              </div>
            )}
          </div>
        </ChatDropZone>

        <div className="shrink-0 border-t border-[var(--pf-border-soft)] px-3 py-3">
          {/* v2b: the composer owns its placeholder now — one sentence on all
              three surfaces, so the panel cannot introduce Finch differently
              from the way the Brief does. */}
          <ChatComposer alwaysExpanded />
        </div>
      </div>
    </div>
  );
}
