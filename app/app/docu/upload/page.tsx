'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MAX_BATCH_FILES, UPLOAD_ACCEPT } from '@/lib/platform/docu/upload-client';
import {
  FOLDER_INPUT_PROPS,
  UploadStagingTray,
  useUploadBatch,
} from '@/components/platform/docu/UploadStagingTray';

/**
 * Upload documents into Doc-U — a batch of up to twenty, or a folder.
 *
 * WHAT THIS PAGE USED TO DO. `handleFile` read `e.target.files?.[0]`, uploaded
 * that one file, fired extraction and navigated away, all from a single click on
 * a `<label>`. Selecting five files uploaded one of them, silently. That is the
 * bug behind "it takes the one image and immediately starts extraction", and
 * both halves of it are fixed here: many files, and a tray between choosing and
 * committing (see `UploadStagingTray`).
 *
 * WHERE IT LANDS AFTERWARDS — and why it changed. The old page pushed to
 * `/app/docu`, which is the folder *hub*: a grid of folder tiles and KPI cards,
 * with no document rows on it and, unlike the inbox, no realtime subscription
 * and no pending-poll. Twenty documents uploaded to a screen that shows none of
 * them, and would not have updated if it did, is not a destination. `/app/docu/
 * recent` is the same inbox component (`InboxView`) that the folder views use:
 * it subscribes to `documents` via `useRealtimeRefresh` AND polls every 6 s while
 * any row is `pending`, so the batch appears as pending rows that fill in by
 * themselves as extraction finishes. No manual refresh.
 */
export default function UploadPage() {
  const router = useRouter();
  const batch = useUploadBatch();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (batch.busy) return;
    // Awaits inside — `filesFromDrop` reads the item list synchronously first.
    await batch.addFromDrop(e.dataTransfer);
  }

  async function upload() {
    setSummary(null);
    const { uploaded, failed } = await batch.run();
    if (uploaded === 0) {
      setSummary('Nothing was uploaded. Check the files above and try again.');
      return;
    }
    if (failed > 0) {
      // Stay put: the failed rows are on screen with their reasons, and leaving
      // would take the only record of what went wrong with it.
      setSummary(
        `${uploaded} uploaded, ${failed} failed. The successful ones are in Doc-U; the failures are listed above.`,
      );
      router.refresh();
      return;
    }
    router.push('/app/docu/recent');
    router.refresh();
  }

  return (
    <div className="px-8 py-7">
      <Link href="/app/docu" className="text-[13px] font-medium text-[#6B6F68] transition-colors hover:text-[#174C87]">
        ← Documents
      </Link>
      <h1 className="of-display mt-3 text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">
        Upload documents
      </h1>
      <p className="mt-1.5 text-[14px] text-[#8A8E86]">
        PDF, JPG or PNG — up to {MAX_BATCH_FILES} at a time. Add them all, check the list, then upload.
      </p>

      <div
        onDragOver={(e) => {
          // Required on every dragover, not just the first, or the browser
          // refuses the drop and navigates to the file instead.
          e.preventDefault();
          if (!batch.busy) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => void onDrop(e)}
        className={`mt-6 flex max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragging ? 'border-[#3E7BC4] bg-[#E7EEF8]' : 'border-[#E2E6EC] bg-[#FBFCFE]'
        }`}
      >
        <span className="of-display text-[16px] font-semibold text-[#171A17]">
          {dragging ? 'Drop them here' : 'Drag files or a folder here'}
        </span>
        <span className="mt-1 text-[13px] text-[#A0A49C]">PDF, JPG or PNG · up to 15 MB each</span>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            disabled={batch.busy}
            className="inline-flex items-center rounded-[11px] bg-[#1F5FA8] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            disabled={batch.busy}
            className="inline-flex items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 py-2 text-[13px] font-semibold text-[#171A17] transition-colors hover:border-[#3E7BC4]/40 hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Upload a folder
          </button>
        </div>

        <input
          ref={filesRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          className="hidden"
          disabled={batch.busy}
          onChange={(e) => {
            batch.addFiles(e.target.files);
            // Reset so picking the same file twice still fires a change event.
            e.target.value = '';
          }}
        />
        {/* The folder picker cannot filter by type — it hands over everything in
            the directory — so its contents are filtered on arrival instead. */}
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          disabled={batch.busy}
          onChange={(e) => {
            batch.addFromFolderInput(e.target.files);
            e.target.value = '';
          }}
          {...FOLDER_INPUT_PROPS}
        />
      </div>

      <UploadStagingTray batch={batch} onUpload={() => void upload()} />

      {summary ? (
        <div className="mt-4 max-w-xl rounded-[14px] bg-[#FFF6E8] px-3.5 py-2.5 text-[13px] font-medium text-[#8A5A16]">
          {summary}
        </div>
      ) : null}
    </div>
  );
}
