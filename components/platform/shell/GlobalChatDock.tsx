'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { AttachError } from '@/components/platform/chat/AttachmentCard';
import { ChatComposer } from '@/components/platform/chat/ChatComposer';
import { ChatDropZone } from '@/components/platform/chat/ChatDropZone';
import { ChatTranscript } from '@/components/platform/chat/ChatTranscript';
import { HubdocCards } from '@/components/platform/chat/HubdocConfirmCard';
import { BatchCards } from '@/components/platform/chat/BatchConfirmCard';
import { isBubbleRoute } from '@/lib/ai/finch/module-route';
import { FinchBubble } from './FinchBubble';
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
 * NO CHIPS HERE ANY MORE (v2b). Until this wave the dock drew the suggestion
 * row above its pill on an empty `/app`. The owner's ruling: "suggestions should
 * only show up in a new chat above the text bar, not in the brief with the cards
 * already there" — and he is right about why. The Brief is already a list of
 * things Vyso thinks are worth your attention; a second, differently-shaped list
 * of things worth asking, six inches below it, competes with the first for the
 * same decision. On `/app/chat/new` there is nothing else on the screen, which
 * is exactly where an opener belongs. `SuggestionChips` therefore has ONE mount
 * site now (NewChatView), and it still reads the provider rather than props
 * because that is how it reaches the layout's server-built row.
 *
 * THREE VARIANTS, ONE COMPOSER (§12 D1; W2 adds the third, W4 replaces it).
 *   - `/app` — full 680px pill, the caption, and the floating transcript panel.
 *   - `/app/chat/*` — COMPOSER ONLY. The transcript is the page; a floating
 *     copy of it hovering over itself would be two scroll boxes showing the
 *     same words. The pill stays wide because a reply box that shrinks on a
 *     screen dedicated to replying would be perverse.
 *   - everywhere else — the module BUBBLE (W4). The wide pill floating across
 *     the bottom of every module screen was chat-first taken literally: it sat
 *     over the tables the owner had come to read, on thirteen routes where the
 *     conversation is the second thing they want. `FinchBubble` collapses it to
 *     the gradient pill the design asks for and expands to a corner panel —
 *     same provider, same composer, same drop zone, so nothing about the
 *     conversation changes, only how much room it takes when nobody asked it
 *     anything.
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
  const {
    turns,
    streaming,
    streamText,
    streamInterim,
    streamTools,
    error,
    attaching,
    attachError,
    attach,
    canAttach,
  } = useFinchChat();
  const pathname = usePathname() ?? '';

  const [transcriptHidden, setTranscriptHidden] = useState(false);
  // Is a file being dragged anywhere over the Brief, before there's a
  // conversation for `ChatDropZone` to wrap? See the whole-page listener
  // below.
  const [briefDragOver, setBriefDragOver] = useState(false);
  const briefDragDepth = useRef(0);

  // An upload in flight counts as a conversation (W5): the panel is the only
  // place "Reading invoice.pdf…" can appear, and a file picked from the
  // paperclip on a screen with nothing said yet must not read as a no-op.
  const hasConversation = turns.length > 0 || streaming || !!error || attaching.length > 0;

  const isBrief = pathname === '/app';
  const isChatPage = pathname.startsWith('/app/chat');
  // The page owns the transcript on a chat route; the dock is the reply box.
  const showPanel = hasConversation && !transcriptHidden && !isChatPage;

  /**
   * The Brief accepts a drop anywhere, before there's a conversation for
   * `ChatDropZone` to wrap.
   *
   * THE GAP. `ChatDropZone` only exists inside `showPanel` — with no active
   * conversation on `/app`, the dock renders nothing but its bottom scrim, so
   * a PDF dropped on a finding card (or anywhere else on the page) had no
   * target and silently did nothing.
   *
   * WHY `window`, NOT AN OVERLAY DIV. A full-viewport catcher would need
   * `pointer-events: auto` to receive the first `dragenter` — but that same
   * setting would sit on top of every finding card underneath it and eat
   * their clicks (and text selection) the rest of the time. Listening on
   * `window` sidesteps the trade-off entirely: `dragenter`/`dragover`/
   * `dragleave`/`drop` bubble to `window` regardless of which element they hit
   * first, so this sees every drag over the page without ever being a target
   * in the hit-testing sense. The visual overlay below is purely cosmetic —
   * `pointer-events-none` — and never intercepts a click.
   *
   * THE DEPTH COUNTER is `ChatDropZone`'s own fix for the same problem,
   * pointed at `window` instead of a wrapper element: `dragleave` fires on
   * every boundary crossing between children, so counting enters against
   * leaves (rather than toggling on the first leave) is what keeps the
   * overlay from strobing as the pointer passes over each card.
   *
   * FILES ONLY (`hasFiles`), same check `ChatDropZone` makes: without it this
   * would hijack a plain text/link drag — someone dragging a URL or a bit of
   * copied text across the Brief — as well as a file.
   *
   * Scoped to `isBrief && !showPanel && canAttach`: once `attach()` runs, an
   * `attaching` entry makes `hasConversation` true and the panel takes over
   * as the drop target, so this and the panel's zone are never both live for
   * the same drag. `canAttach` mirrors `ChatDropZone`'s own gate — no org, no
   * target.
   */
  useEffect(() => {
    // Mirrors the gates the render below applies (they run AFTER this hook,
    // since hooks can't follow a conditional return) — a dock that is off,
    // signed out, or trial-expired must not upload a dropped file just
    // because nothing on screen said so.
    if (!finchEnabled || !email || trial?.expired) return;
    if (!isBrief || showPanel || !canAttach) return;

    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      briefDragDepth.current += 1;
      setBriefDragOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Required on every dragover, not just the first: without it the drop
      // is rejected and the browser opens the file over the app.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      briefDragDepth.current = Math.max(0, briefDragDepth.current - 1);
      if (briefDragDepth.current === 0) setBriefDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      briefDragDepth.current = 0;
      setBriefDragOver(false);
      attach(e.dataTransfer?.files ?? null);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      briefDragDepth.current = 0;
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [finchEnabled, email, trial?.expired, isBrief, showPanel, canAttach, attach]);

  if (!finchEnabled || !email || trial?.expired) return null;

  // Module screens get the bubble instead of the bar (W4). Same gates above it,
  // same provider behind it — this is the dock collapsed, not a second chat.
  if (isBubbleRoute(pathname)) return <FinchBubble />;

  return (
    <>
      {/* The Brief-wide drop affordance (see the effect above). Purely
          cosmetic — `pointer-events-none`, so it never steals a click or
          breaks text selection over a finding card — the actual drag
          detection happens on `window`, not on this element. `fixed inset-0`
          rather than sizing against the layout's `relative` column: it only
          needs to cover the viewport, and `fixed` gets there without caring
          what its ancestor's positioning is. */}
      {briefDragOver ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-white/85 backdrop-blur-[1px]"
        >
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[#3E8FE0] px-10 py-8 text-center">
            <span className="text-[20px] text-[#3E8FE0]" aria-hidden>
              ✦
            </span>
            <span className="text-[14px] font-medium text-[var(--pf-text)]">
              Drop to send to Finch — it’ll be saved in Doc-U
            </span>
            <span className="text-[12px] text-[var(--pf-text-faint)]">PDF or photo · up to 15 MB</span>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center">
        {showPanel ? (
          // The expanded panel is a drop target (plan §1.3): with the transcript
          // open on a module screen, the conversation the owner is looking at is
          // in here, and that is what they will drag an invoice onto.
          <ChatDropZone
            className="pointer-events-auto mx-4 flex max-h-[46vh] w-[calc(100%-2rem)] max-w-[680px] flex-col overflow-y-auto rounded-2xl border border-[var(--pf-border-strong)] bg-white px-5 pb-4 pt-3 shadow-[var(--pf-shadow-menu)]"
            label="Drop it here — I’ll read it"
          >
            <div className="sticky top-0 -mx-5 -mt-3 mb-3 flex items-center justify-between border-b border-[var(--pf-border-soft)] bg-white px-5 pb-2 pt-3">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
                Asking Finch
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
              streamInterim={streamInterim}
              streamTools={streamTools}
              error={error}
              attaching={attaching}
            />
            {/* Plugins X2 — chat hand-off. The Brief's panel gets the confirm card
                for the same reason the chat page does: "push it to Hubdoc" is
                asked wherever the owner is standing. The order/ingest cards stay
                bubble-only — they can only arise on an OrderFlow screen. */}
            <HubdocCards />
            {/* Manufacturing C2 — here for the same reason: "I've just made 20 kg
                of coleslaw" is said wherever the owner is standing, and the
                Brief carries ProcurePulse's tools. */}
            <BatchCards />
          </ChatDropZone>
        ) : null}

        <div className={SCRIM}>
          {/* A rejection with no panel to land in — a file picked from the
              paperclip on a screen where nothing has been said yet. Not on the
              chat routes: their own ChatDropZone is already showing it, and two
              copies of the same red line is worse than none. */}
          {attachError && !showPanel && !isChatPage ? (
            <div className="pointer-events-auto mb-3">
              <AttachError message={attachError} />
            </div>
          ) : null}

          {/* No `placeholder` prop any more (v2b §1, design 1a): the composer owns
              the one sentence it says on every surface. This dock used to pick
              between three of them, all naming Vyso rather than Finch. */}
          <ChatComposer
            alwaysExpanded={isBrief || isChatPage}
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
    </>
  );
}
