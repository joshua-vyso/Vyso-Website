'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_BATCH_FILES, UPLOAD_ACCEPT } from '@/lib/platform/docu/upload-client';
import { FOLDER_INPUT_PROPS, UploadStagingTray, useUploadBatch } from './UploadStagingTray';

/**
 * In-place upload popover (no page navigation), anchored by the caller.
 *
 * WHAT IT DID BEFORE, HONESTLY. This bubble was never single-file — its input
 * carried `multiple`, it walked a `FileList`, and it uploaded each file in turn.
 * What it lacked was the *pause*: `handleFiles` ran off the change/drop event, so
 * choosing files WAS committing them, with no list to check and nothing to take
 * back out. It also enforced its own 20 MB ceiling and its own extension regex —
 * both a fork of `validateUploadFile`, and the 20 MB was wrong (extraction
 * refuses anything over 15 MB, so a 17 MB scan uploaded and then sat on
 * `pending` forever). Both are gone: the bubble now stages into the same tray as
 * the full-page uploader and validates through the same shared function.
 *
 * Folders work here too — dropped (traversed) or picked — because the owner who
 * has a folder of scans is more likely to be standing in the inbox than on the
 * upload page.
 */
export function UploadBubble({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const batch = useUploadBatch();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Escape closes the bubble (unless an upload is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !batch.busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [batch.busy, onClose]);

  async function upload() {
    setSummary(null);
    const { uploaded, failed } = await batch.run();
    // The inbox around this bubble subscribes to `documents` and polls while any
    // row is pending, so a refresh here just gets the new rows on screen sooner.
    router.refresh();
    if (uploaded > 0 && failed === 0) {
      onClose();
      return;
    }
    setSummary(
      uploaded === 0
        ? 'Nothing was uploaded — see the reasons above.'
        : `${uploaded} uploaded, ${failed} failed. The failures are listed above.`,
    );
  }

  return (
    <>
      {/* Click-away backdrop */}
      <button
        type="button"
        aria-label="Close upload"
        disabled={batch.busy}
        onClick={() => (batch.busy ? null : onClose())}
        className={`fixed inset-0 z-40 bg-black/5 ${batch.busy ? 'cursor-not-allowed' : 'cursor-default'}`}
      />
      {/* Bubble */}
      <div
        role="dialog"
        aria-label="Upload documents"
        className="absolute right-0 top-full z-50 mt-2 w-[360px] rounded-2xl border border-[#EAEDF2] bg-white p-4 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Upload documents</h3>
          <button
            type="button"
            onClick={() => (batch.busy ? null : onClose())}
            disabled={batch.busy}
            aria-label="Close"
            className="text-[#A0A49C] transition-colors hover:text-[#171A17] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!batch.busy) setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!batch.busy) void batch.addFromDrop(e.dataTransfer);
          }}
          className={`flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed px-5 py-6 text-center transition-colors ${
            dragging ? 'border-[#3E7BC4] bg-[#E7EEF8]' : 'border-[#E2E6EC] bg-[#FBFCFE]'
          }`}
        >
          <span className="text-[13px] font-semibold text-[#171A17]">
            {dragging ? 'Drop to add' : 'Drag files or a folder here'}
          </span>
          <span className="mt-1 text-[12px] text-[#A0A49C]">
            PDF, JPG, PNG · up to {MAX_BATCH_FILES} files, 15 MB each
          </span>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => filesRef.current?.click()}
              disabled={batch.busy}
              className="rounded-[10px] border border-[#E2E6EC] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#171A17] transition-colors hover:border-[#3E7BC4]/40 hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Choose files
            </button>
            <button
              type="button"
              onClick={() => folderRef.current?.click()}
              disabled={batch.busy}
              className="rounded-[10px] border border-[#E2E6EC] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#171A17] transition-colors hover:border-[#3E7BC4]/40 hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Choose a folder
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
              e.target.value = '';
            }}
          />
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

        <UploadStagingTray batch={batch} dense onUpload={() => void upload()} />

        {summary ? (
          <p className="mt-3 rounded-[10px] bg-[#FCEBEB] px-3 py-2 text-[12px] font-medium text-[#A32D2D]">{summary}</p>
        ) : null}
      </div>
    </>
  );
}
