'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_BATCH_FILES, UPLOAD_ACCEPT } from '@/lib/platform/docu/upload-client';
import {
  FOLDER_INPUT_PROPS,
  UploadStagingTray,
  useUploadBatch,
} from '@/components/platform/docu/UploadStagingTray';

/**
 * The Uploads tab's drop zone — how paperwork gets into Stock & Suppliers
 * (`.ai/plan_stock_suppliers_page.md`, "Uploads").
 *
 * WHY THIS EXISTS RATHER THAN A LINK TO `/app/docu/upload`. Stock is FED by
 * documents: the catalogue, the prices and half the supplier records on the
 * other five tabs are built by extraction. Sending someone to another module to
 * start that — and landing them in Doc-U's inbox afterwards, three clicks from
 * the numbers they were looking at — is the seam the merged module exists to
 * remove. So the tray is here, and it stays here: a finished upload refreshes
 * the table below instead of navigating away.
 *
 * IT REUSES THE UPLOAD PATH WHOLESALE, and that is deliberate. `useUploadBatch`
 * owns the state machine (stage → validate → sequential upload → fire
 * extraction) and `lib/platform/docu/upload-client.ts` owns the bucket, the path
 * shape, the `documents` insert and the `/api/ai/extract` call. A second copy of
 * any of that is a second place a dropped invoice can go missing — the exact
 * bug that file's header was written about. A document uploaded here IS a Doc-U
 * document; this is a second door onto the same room.
 *
 * THE TRAY ROWS ARE DOC-U'S COMPONENT, not a rebuild. The module's rule is new
 * JSX on `--pf-*` tokens, and this is the one place it is not worth honouring
 * literally: `UploadStagingTray`'s palette (#EAEDF2, #1F5FA8, #174C87, #8A8E86)
 * is byte-for-byte what `--pf-border`, `--pf-accent-strong`, `--pf-accent-deep`
 * and `--pf-text-muted` resolve to, so a token-styled copy would render
 * identically while giving "Uploading…" two places to be wrong. The drop zone
 * around it — the part that is actually this module's — is written in tokens.
 */
export function UploadDropZone() {
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
    // STAY ON THIS PAGE. The Doc-U uploader pushes to its inbox because that is
    // where its documents live; here the list is already six inches below, so a
    // refresh puts the new rows on screen without moving anyone. They arrive
    // `pending` and fill in as extraction finishes — this page has no realtime
    // subscription, so "Refresh" on the table is how the status catches up.
    setSummary(
      failed > 0
        ? `${uploaded} uploaded, ${failed} failed. The failures are listed above with their reasons.`
        : `${uploaded} ${uploaded === 1 ? 'document is' : 'documents are'} in — they appear below as they're read.`,
    );
    router.refresh();
  }

  return (
    <div>
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
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? 'border-[var(--pf-accent)] bg-[var(--pf-accent-weak)]'
            : 'border-[var(--pf-border-strong)] bg-[var(--pf-surface-tint-faint)]'
        }`}
      >
        <span className="of-display text-[16px] font-semibold text-[var(--pf-text)]">
          {dragging ? 'Drop them here' : 'Drag invoices, delivery notes or price lists here'}
        </span>
        <span className="mt-1 text-[13px] text-[var(--pf-text-faint)]">
          PDF, JPG or PNG · up to 15 MB each · {MAX_BATCH_FILES} at a time
        </span>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            disabled={batch.busy}
            className="inline-flex h-[38px] items-center rounded-[var(--pf-radius-control)] bg-[var(--pf-accent-strong)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--pf-accent-deep)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            disabled={batch.busy}
            className="inline-flex h-[38px] items-center rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-4 text-[13px] font-semibold text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)] disabled:cursor-not-allowed disabled:opacity-40"
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
        <p className="mt-4 rounded-[var(--pf-radius-control)] bg-[var(--pf-surface-tint)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--pf-text-body)]">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
