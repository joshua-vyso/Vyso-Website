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
 * NOTE it is LOWER than the 20 MB the two Doc-U upload surfaces advertise and
 * enforce. Their number is wrong — a 17 MB scan uploads, then fails extraction
 * with "That file is too large to process" and sits on `pending` — but this
 * wave was scoped to leave those two callers behaving exactly as they did, so
 * this constant governs the chat's drop zone only and the divergence is
 * recorded here rather than silently fixed under a refactor.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

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

  const looksReadable =
    file.type === 'application/pdf' || file.type.startsWith('image/') || FILENAME_RE.test(file.name ?? '');
  if (!looksReadable) return `${name} isn’t a PDF or an image — Doc-U reads PDFs, photos and scans.`;

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return `${name} is ${mb} MB — Doc-U reads files up to ${MAX_UPLOAD_MB} MB.`;
  }

  return null;
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
