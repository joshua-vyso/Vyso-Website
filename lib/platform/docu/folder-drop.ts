/**
 * Getting the files OUT of a dropped folder.
 *
 * WHY THIS IS NOT TWO LINES. `DataTransfer.files` contains exactly nothing when
 * the thing dropped is a directory — the browser hands you a `DataTransferItem`
 * whose entry is a folder, and the contents are behind an async, batched,
 * callback-shaped API (`webkitGetAsEntry` → `createReader().readEntries`) that
 * predates promises and has two traps in it. Both are handled below and both are
 * why this lives in its own file instead of inline in a component.
 *
 * TRAP 1 — THE ITEM LIST IS EMPTIED THE MOMENT YOU AWAIT. `dataTransfer.items`
 * is only valid during the synchronous part of the drop handler. Every
 * `webkitGetAsEntry()` call therefore happens in the first loop, before anything
 * is awaited; awaiting first is the bug that makes folder drop work in a demo
 * and fail on a real machine under load.
 *
 * TRAP 2 — `readEntries` LIES ON THE FIRST CALL. It returns at most ~100 entries
 * and you must keep calling it until it answers with an empty array, or a folder
 * of 300 invoices silently becomes a folder of 100.
 *
 * NOT A WATCHED FOLDER. This reads a folder once, at the moment it is dropped.
 * A folder Doc-U keeps watching needs `showDirectoryPicker()` (Chromium only) or
 * the Electron shell — see the feasibility note in `.ai/implementation.md`.
 */

/** Stop walking a pathological tree. Twenty files are staged; scanning a few
 *  hundred to find them is generous, scanning a home directory is not. */
const MAX_SCAN = 500;
/** A folder of scans is flat or nearly so; eight levels is already paranoia. */
const MAX_DEPTH = 8;

/** `.DS_Store`, `._invoice.pdf` (AppleDouble) and friends. The second of those
 *  passes the extension check, so name-based filtering is not redundant. */
function isHidden(name: string): boolean {
  return name.startsWith('.');
}

function fileOf(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (f) => resolve(f),
      () => resolve(null),
    );
  });
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    reader.readEntries(
      (batch) => resolve(batch),
      () => resolve([]),
    );
  });
}

async function walk(entry: FileSystemEntry, out: File[], depth: number): Promise<void> {
  if (out.length >= MAX_SCAN) return;
  if (isHidden(entry.name)) return;

  if (entry.isFile) {
    const file = await fileOf(entry as FileSystemFileEntry);
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory || depth >= MAX_DEPTH) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await readBatch(reader);
    if (batch.length === 0) break; // Trap 2: empty answer, not the first answer.
    for (const child of batch) {
      await walk(child, out, depth + 1);
      if (out.length >= MAX_SCAN) return;
    }
  }
}

/**
 * Every file in a drop, folders walked — falling back to the flat file list when
 * the browser has no entry API (Firefox on some platforms, older Safari), which
 * degrades to "dropped files work, dropped folders do nothing" rather than to a
 * crash.
 */
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  const items = dataTransfer.items;
  // Trap 1: synchronous, before the first await.
  for (let i = 0; i < (items?.length ?? 0); i += 1) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  const flat = Array.from(dataTransfer.files ?? []).filter((f) => !isHidden(f.name));

  if (entries.length === 0) return flat;

  const out: File[] = [];
  for (const entry of entries) {
    await walk(entry, out, 0);
    if (out.length >= MAX_SCAN) break;
  }
  // A drop of only hidden files, or an entry API that gave us nothing usable:
  // the flat list is still better than an empty tray.
  return out.length > 0 ? out : flat;
}

/** The folder picker's `FileList`, minus the dot-files every folder carries. */
export function filesFromFolderInput(list: FileList | null): File[] {
  return Array.from(list ?? []).filter((f) => !isHidden(f.name));
}
