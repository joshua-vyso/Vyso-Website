'use client';

import Link from 'next/link';
import { BouncingDots } from '@/components/platform/finch/BouncingDots';
import type { AttachmentProgress, ChatAttachment } from '@/components/platform/shell/FinchChatProvider';

/**
 * A document the owner dropped into the conversation (`.ai/plan_brief_chat_v2.md`
 * §2.6, W5).
 *
 * WHY A CARD AND NOT A LINE OF TEXT. The message says "I've uploaded
 * invoice.pdf." — but the file itself went somewhere, and the card is the
 * receipt for that: it names the file, says what kind it is, and offers the one
 * link that proves the claim. Dropping a document into a chat and having it
 * vanish into an answer would leave the owner with no way to check that Vyso
 * read the right thing, or to find the document again tomorrow.
 *
 * IT LINKS TO DOC-U, NOT TO A FILE. `/app/docu/[id]` is the document's real
 * home — extraction status, the extracted fields, the signed preview URL, the
 * retry — and it is RLS-scoped. The chat never handles the file's bytes or its
 * storage path, exactly as Finch's tools never surface them.
 *
 * THE NOTE IS TRANSIENT. Extraction failures and slow reads are worth saying
 * while they are news; a card reopened next week just shows the document, and
 * Doc-U is where its current state actually lives. That is why `note` is not
 * stored on the row (see ChatAttachment).
 */

/** Filename → what to call it in one word. Deliberately coarse: the card is a
 *  receipt, and "PDF" vs "Photo" is the distinction the owner cares about. */
function kindOf(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'bmp', 'tif', 'tiff'].includes(ext)) return 'Photo';
  return 'Document';
}

export function AttachmentCard({ attachment }: { attachment: ChatAttachment }) {
  const { document_id: documentId, filename, note } = attachment;

  return (
    <div className="flex max-w-[80%] items-start gap-3 self-end rounded-[14px] border border-[var(--pf-border-strong)] bg-white px-3.5 py-3">
      <span
        className="mt-[1px] grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-[var(--pf-accent-weak)] text-[var(--pf-accent-strong)]"
        aria-hidden
      >
        <DocumentIcon />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-[var(--pf-text)]">{filename}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--pf-text-faint)]">
          <span>{kindOf(filename)}</span>
          <Link
            href={`/app/docu/${documentId}`}
            className="text-[var(--pf-accent-strong)] transition-colors hover:underline"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            Open in Doc-U ↗
          </Link>
        </p>
        {note ? <p className="mt-1.5 text-[12px] leading-[1.45] text-[#A32D2D]">{note}</p> : null}
      </div>
    </div>
  );
}

/** Every card on one message, right-aligned above the owner's words. */
export function AttachmentCards({ attachments }: { attachments: readonly ChatAttachment[] | undefined }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {attachments.map((a) => (
        <AttachmentCard key={a.document_id} attachment={a} />
      ))}
    </div>
  );
}

/**
 * "Reading invoice.pdf…" — the seconds between the drop and the answer.
 *
 * This is the only part of the flow the owner can misread as a hang: the file
 * has left their machine, nothing is on screen yet, and extraction on a
 * multi-page statement genuinely takes ten or twenty seconds. Same bouncing
 * dots the transcript uses while waiting for a first token, so the two waits
 * read as the same kind of waiting.
 */
export function AttachmentProgressLines({
  items,
  /** Right-aligned in a transcript (it is about to become the owner's own
   *  message); the empty new-chat screen passes a left-aligned override. */
  className = 'self-end',
}: {
  items: readonly AttachmentProgress[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-3 rounded-[14px] border border-dashed border-[var(--pf-border-strong)] px-3.5 py-2.5"
        >
          <BouncingDots size={6} />
          <span className="truncate text-[12.5px] text-[var(--pf-text-secondary)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Why a dropped file didn't make it.
 *
 * One component with two callers (the drop zone, and the dock when it has no
 * panel open to put it in) because the rejection has to be visible wherever the
 * file was dropped — an owner who drags a 30 MB scan onto the Brief and sees
 * nothing at all concludes the feature is broken, not that their file is.
 */
export function AttachError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="mx-auto max-w-[560px] rounded-[10px] bg-[#FCEBEB] px-3.5 py-2.5 text-center text-[12.5px] font-medium leading-[1.5] text-[#A32D2D]"
    >
      {message}
    </p>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
