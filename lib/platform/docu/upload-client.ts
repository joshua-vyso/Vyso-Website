/**
 * One way into Doc-U from the browser (`.ai/plan_brief_chat_v2.md` §2.6, W5).
 *
 * WHY THIS FILE EXISTS. Uploading a document was written three times before
 * this wave — the Doc-U upload page, the inbox's upload bubble, and (from now)
 * the chat's drop zone. Three copies of "Storage object, then a `pending`
 * `documents` row, then kick extraction" is three chances for a dropped file to
 * land somewhere the inbox never looks. The body below is `UploadBubble`'s
 * `uploadOne` moved, not rewritten: same bucket, same path shape, same insert,
 * same fire-and-forget extract call.
 *
 * A DOCUMENT DROPPED INTO A CHAT IS A DOC-U DOCUMENT. That is the whole point
 * of routing the chat through here rather than through
 * `/api/ai/agent/ingest-document`: the owner drops an invoice into a
 * conversation, and it is in their inbox, extracted, feeding ProcurePulse and
 * SupplySync, exactly as if they had uploaded it on the Doc-U screen. The chat
 * is a second door onto the same room, not a side channel.
 *
 * NO RUNTIME IMPORTS. The Supabase client is a parameter and the only import is
 * a type, so the pure halves (`validateUploadFile`, `attachmentMessage`) are
 * reachable from `node --test` without a browser or a bundler.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The client-side ceiling, matched to `MAX_EXTRACT_BYTES` in
 * `app/api/ai/extract/route.ts`.
 *
 * They are two different guarantees and both are needed: the server's cap is
 * the real one (a direct Storage PUT never touches this file), and this one
 * exists so a 40 MB scan is refused in the drop zone with a sentence the owner
 * can act on, instead of being uploaded, stored, charged for and then rejected
 * by an extract call that already has the bytes in memory.
 *
 * W5 left this governing the chat's drop zone only, while the two Doc-U upload
 * surfaces advertised and enforced 20 MB — a number that was simply wrong, since
 * a 17 MB scan uploaded, failed extraction with "That file is too large to
 * process", and sat on `pending` forever. The batch wave routed both surfaces
 * through `validateUploadFile`, so 15 MB is now the one ceiling everywhere and
 * that divergence is closed.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

/**
 * How many documents Doc-U will stage and upload in one go.
 *
 * WHY 20, AND WHY IT IS NOT THE CHAT'S NUMBER. Three different ceilings live in
 * this codebase and they are three different constraints, not an inconsistency
 * anyone should "tidy up":
 *
 *  - **20 here** — a Doc-U batch is bounded only by patience and by Storage.
 *    Nothing reads all twenty at once; each file gets its own extraction and its
 *    own inbox row, so the cap exists to keep one dropped folder from turning
 *    into a hundred sequential uploads behind a button the owner cannot cancel.
 *  - **10 in the chat** (`MAX_ATTACHMENTS`, `app/api/ai/agent/route.ts`) — that
 *    one is a *model context* limit: those documents are cited into a Haiku turn.
 *    Raising it to match this would quietly change what the chat can think about.
 *  - **8 for OrderFlow ingest** (`MAX_ORDER_FILES`, `docu/order-ingest-client`) —
 *    each of those files creates customers, orders and invoices, so its ceiling
 *    is about write amplification.
 *
 * They are deliberately unequal. Change one and you have changed one product.
 */
export const MAX_BATCH_FILES = 20;

/** The `accept` string for every file input that feeds this module. */
export const UPLOAD_ACCEPT = 'application/pdf,image/*';

/** Browsers do not always report a MIME type (dragged-from-Finder PDFs, some
 *  Android pickers), so the extension is the fallback — the same list the
 *  upload bubble has always used. */
const FILENAME_RE = /\.(pdf|png|jpe?g|webp|gif|heic|heif|bmp|tiff?)$/i;

/** Just enough of `File` to decide about it. Widened from `File` so the rules
 *  below can be tested without a DOM; a real `File` satisfies it structurally. */
export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
}

/**
 * Could Doc-U read this at all — is it a PDF or a picture?
 *
 * SPLIT OUT OF `validateUploadFile` FOR THE FOLDER CASE. A folder dropped on the
 * uploader arrives with everything in it: `.DS_Store`, a `notes.txt`, last
 * year's spreadsheet. Those are not *errors the owner made* — they are the
 * ordinary contents of a folder — so the batch drops them quietly and counts
 * them, while a file the owner picked by hand still earns the full sentence from
 * `validateUploadFile`. Same rule, two volumes.
 */
export function isReadableDocument(file: UploadCandidate): boolean {
  return (
    file.type === 'application/pdf' || file.type.startsWith('image/') || FILENAME_RE.test(file.name ?? '')
  );
}

/**
 * Why this file cannot be uploaded, as a sentence to put in front of the owner
 * — or null when it can.
 *
 * A STRING, NOT A BOOLEAN. The drop zone shows this verbatim, so the reason has
 * to travel with the verdict: "that didn't work" over a 22 MB scan is a support
 * ticket, and "Statement.pdf is 22.4 MB — Doc-U reads files up to 15 MB" is
 * something the owner can fix in the next ten seconds.
 */
export function validateUploadFile(file: UploadCandidate): string | null {
  const name = file.name?.trim() || 'That file';

  if (!file.size) return `${name} is empty.`;

  if (!isReadableDocument(file)) return `${name} isn’t a PDF or an image — Doc-U reads PDFs, photos and scans.`;

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return `${name} is ${mb} MB — Doc-U reads files up to ${MAX_UPLOAD_MB} MB.`;
  }

  return null;
}

/** One staged row in the tray: the file, and why it will not upload (or null). */
export interface StagedCandidate<T extends UploadCandidate> {
  file: T;
  problem: string | null;
}

export interface BatchSelection<T extends UploadCandidate> {
  /** What belongs in the tray after this selection, in the order it arrived. */
  staged: StagedCandidate<T>[];
  /** What happened to the files that never reached the tray — or null when
   *  every one of them did. Shown above the tray, once. */
  notice: string | null;
}

/**
 * Turn a pile of picked/dropped/traversed files into the rows of the staging
 * tray, and a sentence about the ones that did not make it.
 *
 * PURE, AND THEREFORE TESTED. Everything that can be got wrong about a batch is
 * in here — the cap arithmetic, whether the cap counts what is *already* staged,
 * de-duplication when the owner picks the same folder twice — and none of it
 * needs a browser to check. The React around it only renders what this returns.
 *
 * A FILE WITH A PROBLEM IS STILL STAGED. It is shown in the tray with its reason
 * next to it and a ✕, rather than vanishing: the owner chose that file, and a
 * batch that silently loses two of twelve is how a supplier invoice goes missing
 * for a month. `dropUnreadable` is the one exception, for folders — see
 * `isReadableDocument`.
 *
 * THE CAP COUNTS THE WHOLE TRAY, not this selection: dropping ten files twice is
 * twenty, and a third drop is refused with the same sentence as one drop of
 * thirty.
 */
export function selectBatch<T extends UploadCandidate>(
  candidates: readonly T[],
  opts: {
    /** What the tray already holds. Counts against the cap, and against dupes. */
    existing?: readonly UploadCandidate[];
    /** Folder mode: quietly leave out anything that isn't a PDF or an image. */
    dropUnreadable?: boolean;
  } = {},
): BatchSelection<T> {
  const existing = opts.existing ?? [];
  // Name + size is the strongest identity a File offers cheaply, and it is the
  // one that matters: the same folder dragged twice, or the picker reopened.
  // (size first so a colon inside a filename cannot shift the boundary)
  const identity = (f: UploadCandidate) => `${f.size}:${f.name}`;
  const seen = new Set(existing.map(identity));
  const room = Math.max(0, MAX_BATCH_FILES - existing.length);

  const staged: StagedCandidate<T>[] = [];
  let unreadable = 0;
  let duplicates = 0;
  let overflow = 0;

  for (const candidate of candidates) {
    if (opts.dropUnreadable && !isReadableDocument(candidate)) {
      unreadable += 1;
      continue;
    }
    const key = identity(candidate);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    if (staged.length >= room) {
      overflow += 1;
      continue;
    }
    staged.push({ file: candidate, problem: validateUploadFile(candidate) });
  }

  const parts: string[] = [];
  if (overflow > 0) {
    const kept = existing.length + staged.length;
    const total = kept + overflow;
    parts.push(
      `Only the first ${kept} of ${total} files were added — Doc-U takes ${MAX_BATCH_FILES} documents at a time, so the rest were skipped.`,
    );
  }
  if (unreadable > 0) {
    parts.push(`Skipped ${unreadable} file${unreadable === 1 ? '' : 's'} that ${unreadable === 1 ? 'isn’t a PDF or an image' : 'aren’t PDFs or images'}.`);
  }
  if (duplicates > 0) {
    parts.push(`Skipped ${duplicates} file${duplicates === 1 ? '' : 's'} already in the list.`);
  }

  return { staged, notice: parts.length ? parts.join(' ') : null };
}

/**
 * What the owner is recorded as having said when they drop files in.
 *
 * The message is theirs, in the transcript, forever — so it reads like
 * something a person would type. One file names it; two are joined with "and";
 * more are counted and then listed, because a bubble containing nine filenames
 * is a directory listing, not a sentence.
 */
export function attachmentMessage(filenames: readonly string[]): string {
  const names = filenames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return 'I’ve uploaded a document.';
  if (names.length === 1) return `I’ve uploaded ${names[0]}.`;
  if (names.length === 2) return `I’ve uploaded ${names[0]} and ${names[1]}.`;
  return `I’ve uploaded ${names.length} documents: ${names.join(', ')}.`;
}

/**
 * What to say when the files got in but the message did not.
 *
 * THE ONE OUTCOME THE DROP PATH COULD END ON IN SILENCE. Every other way an
 * attachment can fail already speaks: a rejected file names its reason, a failed
 * upload names the file, a failed extraction downgrades the card. But the last
 * step — turning the uploaded documents into a message — is a `send()` that
 * refuses without a word when a turn is already in flight, and a refusal there
 * leaves the owner looking at an unchanged screen having watched a file upload.
 * "Nothing happened" is the single worst thing this feature can say, because it
 * is also what a broken drop target says, so the two become indistinguishable
 * and the owner drops the file again.
 *
 * IT NAMES DOC-U ON PURPOSE. The documents ARE filed — that is the half of the
 * outcome worth knowing, and it is the half a silent failure throws away.
 */
export function attachmentStrandedNote(filenames: readonly string[]): string {
  const names = filenames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    return 'Your document is in Doc-U, but it couldn’t be added to this conversation — ask about it in a new message.';
  }
  if (names.length === 1) {
    return `${names[0]} is in Doc-U, but it couldn’t be added to this conversation — ask about it in a new message.`;
  }
  return `${names.join(', ')} are in Doc-U, but they couldn’t be added to this conversation — ask about them in a new message.`;
}

export interface UploadedDocument {
  documentId: string;
  storagePath: string;
}

export interface UploadContext {
  orgId: string | null | undefined;
  userId: string | null | undefined;
  /** `createClient()` from `supabase-browser` — null when Supabase env is
   *  absent, which is a configuration error worth naming rather than a crash. */
  supabase: SupabaseClient | null;
}

/**
 * Put a file in the `documents` bucket and file a `pending` row against it.
 *
 * Throws on either failure — every caller already has an error surface (the
 * bubble's red line, the upload page's banner, the chat's inline note) and a
 * silent partial upload is the one outcome none of them could explain.
 *
 * The path is `{org}/{uuid}_{filename}`: org-scoped because Storage policies
 * are, and prefixed because a batch of same-named files ("invoice.pdf" from
 * three suppliers) must not collide. The random prefix rather than a timestamp
 * is `uploadOne`'s — `Date.now()` repeats inside one loop iteration's
 * millisecond.
 */
export async function uploadDocument(file: File, ctx: UploadContext): Promise<UploadedDocument> {
  const { supabase, orgId, userId } = ctx;
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!orgId) throw new Error('No organisation on your profile.');

  const path = `${orgId}/${crypto.randomUUID()}_${file.name}`;
  const { error: uploadErr } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadErr) throw uploadErr;

  const { data: inserted, error: insertErr } = await supabase
    .from('documents')
    .insert({ org_id: orgId, filename: file.name, status: 'pending', storage_path: path, uploaded_by: userId })
    .select('id')
    .single();
  if (insertErr) throw insertErr;

  return { documentId: (inserted as { id: string }).id, storagePath: path };
}

/**
 * Kick extraction off and walk away — the Doc-U surfaces' behaviour, unchanged.
 *
 * `keepalive` is the load-bearing word: the upload page navigates to
 * `/app/docu` on the next line, and without it the browser cancels the
 * in-flight request and the document is stranded on `pending` forever. A
 * network-level failure is non-fatal by design: the row stays `pending`, the
 * inbox offers a retry, and the extract route self-marks `error` on its own
 * failures.
 *
 * The chat's drop path deliberately does NOT use this — it awaits the same
 * endpoint so it can say "Reading invoice.pdf…" and then talk about what was
 * read (plan §2.6).
 */
export function startExtraction(documentId: string): void {
  void fetch('/api/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId }),
    keepalive: true,
  }).catch(() => {});
}
