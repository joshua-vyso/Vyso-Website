'use client';

import { useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import {
  MAX_BATCH_FILES,
  selectBatch,
  startExtraction,
  uploadDocument,
  type UploadCandidate,
} from '@/lib/platform/docu/upload-client';
import { filesFromDrop, filesFromFolderInput } from '@/lib/platform/docu/folder-drop';

/**
 * The staging tray — the step Doc-U was missing.
 *
 * WHAT JOSH ACTUALLY REPORTED: "it takes the one image and immediately starts
 * extraction". Both halves were the complaint. *One* image, because the upload
 * page read `files[0]` and threw the rest away; and *immediately*, because
 * choosing a file was the same gesture as committing it — there was no moment in
 * between where a person could look at what they had picked, notice the wrong
 * scan, and take it out again. A tray is that moment. Nothing is stored and no
 * extraction is spent until the button is pressed.
 *
 * ONE TRAY, TWO SURFACES. The full-page uploader and the inbox's upload bubble
 * are the same feature at two densities, so the state machine lives in
 * `useUploadBatch` and the rows live in `UploadStagingTray`, and neither surface
 * owns a second copy of "upload, then kick extraction, then keep going after a
 * failure". The pure half of the decision-making (cap, de-dupe, per-file
 * validation) is `selectBatch` in `lib/platform/docu/upload-client`, under test.
 *
 * SEQUENTIAL, NOT `Promise.all`. Twenty parallel PUTs to Storage from a phone on
 * a shop's wifi is how you get twenty timeouts instead of twenty documents; and
 * a serial loop is what lets the tray say which file it is on. The batch keeps
 * going after a failure — a single bad file must never cost the other nineteen.
 */

export type StageState = 'waiting' | 'uploading' | 'queued' | 'failed';

export interface TrayItem {
  key: string;
  file: File;
  /** Why this one will not upload — validation, decided at staging time. */
  problem: string | null;
  state: StageState;
  /** Why the upload failed, once it has. */
  error: string | null;
}

const STATE_LABEL: Record<StageState, string> = {
  waiting: 'Waiting',
  uploading: 'Uploading…',
  // Honest wording: the file is stored and the extract call has been fired with
  // `keepalive`, but nobody is awaiting it — the inbox is where it lands.
  queued: 'Queued for reading',
  failed: 'Failed',
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/** `webkitdirectory` is a real attribute on every browser that matters and is
 *  still absent from React's typings, so it is spread in through one cast, here,
 *  rather than with an `any` at each call site. */
export const FOLDER_INPUT_PROPS = {
  webkitdirectory: '',
  directory: '',
} as unknown as React.InputHTMLAttributes<HTMLInputElement>;

export interface UploadBatch {
  items: TrayItem[];
  /** What was left out of the last selection (cap, non-documents, dupes). */
  notice: string | null;
  busy: boolean;
  /** How many rows would actually upload if the button were pressed now. */
  ready: number;
  addFiles: (files: FileList | File[] | null, opts?: { dropUnreadable?: boolean }) => void;
  addFromDrop: (dataTransfer: DataTransfer) => Promise<void>;
  addFromFolderInput: (files: FileList | null) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Uploads everything staged and valid; resolves with the tally. */
  run: () => Promise<{ uploaded: number; failed: number }>;
}

export function useUploadBatch(): UploadBatch {
  const { org, userId } = usePlatform();
  // Pulled out as a primitive: `run` depending on `org?.id` reads to the React
  // Compiler as a dependency on the whole `org` object, which it then refuses to
  // memoize ("inferred less specific property than source").
  const orgId = org?.id;
  const [items, setItems] = useState<TrayItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const stage = useCallback((files: File[], dropUnreadable: boolean) => {
    setItems((prev) => {
      const existing: UploadCandidate[] = prev.map((i) => i.file);
      const { staged, notice: why } = selectBatch(files, { existing, dropUnreadable });
      setNotice(why);
      const added = staged.map(({ file, problem }) => ({
        key: `${file.name}-${file.size}-${(seq.current += 1)}`,
        file,
        problem,
        state: 'waiting' as StageState,
        error: null,
      }));
      return [...prev, ...added];
    });
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[] | null, opts?: { dropUnreadable?: boolean }) => {
      const picked = Array.from(files ?? []);
      if (picked.length === 0) return;
      stage(picked, opts?.dropUnreadable ?? false);
    },
    [stage],
  );

  // A drop may be files, folders, or both; the traversal is in folder-drop.ts.
  // Folder contents are filtered quietly — a folder holds what a folder holds.
  const addFromDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      const files = await filesFromDrop(dataTransfer);
      if (files.length === 0) return;
      stage(files, true);
    },
    [stage],
  );

  const addFromFolderInput = useCallback(
    (files: FileList | null) => {
      const picked = filesFromFolderInput(files);
      if (picked.length === 0) return;
      stage(picked, true);
    },
    [stage],
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setNotice(null);
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setNotice(null);
  }, []);

  const patch = useCallback((key: string, next: Partial<TrayItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)));
  }, []);

  const run = useCallback(async () => {
    // Read the queue off the current render's items: the loop must not observe
    // its own state updates, and nothing can be added while `busy`.
    const queue = items.filter((i) => !i.problem && i.state !== 'queued');
    if (queue.length === 0) return { uploaded: 0, failed: 0 };

    setBusy(true);
    setNotice(null);
    const supabase = createClient();
    let uploaded = 0;
    let failed = 0;

    for (const item of queue) {
      patch(item.key, { state: 'uploading', error: null });
      try {
        const { documentId } = await uploadDocument(item.file, { orgId, userId, supabase });
        // Fire-and-forget with `keepalive`, exactly as the single-file page did:
        // extraction outlives the navigation that follows, and the inbox row
        // flips from "Extracting…" on its own. Awaiting twenty extractions here
        // would hold the owner on this screen for minutes for no benefit.
        startExtraction(documentId);
        patch(item.key, { state: 'queued' });
        uploaded += 1;
      } catch (err) {
        patch(item.key, {
          state: 'failed',
          error: err instanceof Error && err.message ? err.message : 'Upload failed.',
        });
        failed += 1;
      }
    }

    setBusy(false);
    return { uploaded, failed };
  }, [items, orgId, patch, userId]);

  const ready = items.filter((i) => !i.problem && i.state !== 'queued').length;

  return { items, notice, busy, ready, addFiles, addFromDrop, addFromFolderInput, remove, clear, run };
}

function StateBadge({ item }: { item: TrayItem }) {
  if (item.problem) {
    return <span className="text-[12px] font-medium text-[#A32D2D]">Can’t upload</span>;
  }
  const tone =
    item.state === 'failed'
      ? 'text-[#A32D2D]'
      : item.state === 'queued'
        ? 'text-[#2E7D5B]'
        : item.state === 'uploading'
          ? 'text-[#174C87]'
          : 'text-[#A0A49C]';
  return <span className={`text-[12px] font-medium ${tone}`}>{STATE_LABEL[item.state]}</span>;
}

/**
 * The rows themselves. Presentational — every decision has already been made by
 * `useUploadBatch`.
 */
export function UploadStagingTray({
  batch,
  dense = false,
  onUpload,
  uploadLabel,
}: {
  batch: UploadBatch;
  /** The bubble is 340px wide and cannot afford the page's breathing room. */
  dense?: boolean;
  onUpload: () => void;
  /** Overrides the default "Upload N documents". */
  uploadLabel?: string;
}) {
  const { items, notice, busy, ready } = batch;
  if (items.length === 0) {
    return notice ? (
      <p className="mt-3 rounded-[10px] bg-[#FFF6E8] px-3 py-2 text-[12px] font-medium text-[#8A5A16]">{notice}</p>
    ) : null;
  }

  return (
    <div className={dense ? 'mt-3' : 'mt-5 max-w-xl'}>
      <div className="flex items-baseline justify-between">
        <h2 className={`of-display font-semibold text-[#171A17] ${dense ? 'text-[13px]' : 'text-[15px]'}`}>
          {items.length} {items.length === 1 ? 'document' : 'documents'} ready
        </h2>
        <span className="text-[12px] text-[#A0A49C]">
          {items.length} of {MAX_BATCH_FILES}
        </span>
      </div>

      {notice ? (
        <p className="mt-2 rounded-[10px] bg-[#FFF6E8] px-3 py-2 text-[12px] font-medium text-[#8A5A16]">{notice}</p>
      ) : null}

      <ul
        className={`mt-2 divide-y divide-[#EEF1F5] overflow-y-auto rounded-[14px] border border-[#EAEDF2] bg-white ${
          dense ? 'max-h-[210px]' : 'max-h-[420px]'
        }`}
      >
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#171A17]" title={item.file.name}>
                {item.file.name}
              </p>
              <p className="mt-0.5 text-[12px] text-[#A0A49C]">
                {formatSize(item.file.size)}
                {item.file.type ? ` · ${item.file.type.replace('application/', '').toUpperCase()}` : ''}
              </p>
              {item.problem ? <p className="mt-1 text-[12px] text-[#A32D2D]">{item.problem}</p> : null}
              {item.error ? <p className="mt-1 text-[12px] text-[#A32D2D]">{item.error}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <StateBadge item={item} />
              <button
                type="button"
                onClick={() => batch.remove(item.key)}
                disabled={busy}
                aria-label={`Remove ${item.file.name}`}
                className="text-[#BFC5CC] transition-colors hover:text-[#171A17] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          disabled={busy || ready === 0}
          className="inline-flex items-center rounded-[11px] bg-[#1F5FA8] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Uploading…' : (uploadLabel ?? `Upload ${ready} ${ready === 1 ? 'document' : 'documents'}`)}
        </button>
        <button
          type="button"
          onClick={batch.clear}
          disabled={busy}
          className="rounded-[11px] px-3 py-2 text-[13px] font-medium text-[#6B6F68] transition-colors hover:text-[#171A17] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
