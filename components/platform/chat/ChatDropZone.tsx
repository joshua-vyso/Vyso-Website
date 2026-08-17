'use client';

import { useCallback, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';
import { AttachError } from './AttachmentCard';

/**
 * Drop a PDF or a photo onto the conversation (`.ai/plan_brief_chat_v2.md`
 * §1.3, §2.6 — W5).
 *
 * A WRAPPER, NOT A TARGET. The zone is the whole chat surface, because that is
 * what the owner aims at: someone dragging an invoice out of their email drops
 * it on the conversation, not on a 200×120 dashed rectangle they first have to
 * find. Nothing is drawn until a drag with files is actually over the surface —
 * the overlay is the affordance, and it appears exactly when it is useful.
 *
 * ALL THE WORK IS THE PROVIDER'S. This component knows how to notice a drag and
 * nothing else; `attach()` does the uploading, reading and sending (see
 * FinchChatProvider). That split is what lets the composer's paperclip be the
 * same feature rather than a second implementation of it, and it is why this
 * file has no upload code to review.
 *
 * THE DEPTH COUNTER. `dragleave` fires every time the pointer crosses into a
 * CHILD element, so a naive `onDragLeave → hide` makes the overlay strobe as
 * the file passes over each message bubble. Counting enters against leaves is
 * the standard fix and the only subtle thing here.
 *
 * `dragover` MUST call preventDefault, on every event, or the browser refuses
 * the drop and navigates to the file instead — the single most common way this
 * feature is shipped broken.
 */
export function ChatDropZone({
  children,
  className = '',
  /** What the overlay says. The dock's panel is small enough to want fewer
   *  words than a full chat page. */
  label = 'Drop it here — I’ll read it and file it in Doc-U',
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const { attach, attachError, canAttach } = useFinchChat();
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    // Required on EVERY dragover, not just the first: without it the drop is
    // rejected and the browser opens the file over the app.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      attach(e.dataTransfer.files);
    },
    [attach],
  );

  // No org on the profile means no `documents` row can be written; a target
  // that silently swallows files would be worse than no target.
  if (!canAttach) return <div className={className}>{children}</div>;

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}

      {/* Inline, under the conversation — a rejected file is answered where the
          owner is looking, not in a toast that has gone by the time they read
          it. Cleared by the next attempt. */}
      {attachError ? (
        <div className="mt-5">
          <AttachError message={attachError} />
        </div>
      ) : null}

      {over ? (
        // pointer-events-none: the drop must land on the wrapper's handler.
        // z-30 clears the dock's z-20 scrim so the overlay covers the composer
        // too — the pill is inside the area the owner is aiming at.
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-[#3E8FE0] bg-white/85 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-1.5 px-6 text-center">
            <span className="text-[20px] text-[#3E8FE0]" aria-hidden>
              ✦
            </span>
            <span className="text-[14px] font-medium text-[var(--pf-text)]">{label}</span>
            <span className="text-[12px] text-[var(--pf-text-faint)]">PDF or photo · up to 15 MB</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
