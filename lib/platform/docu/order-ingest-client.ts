/**
 * The OrderFlow drop path — a customer order dropped into Finch becomes an
 * invoice (`.ai/plan_brief_chat_v2.md` W4).
 *
 * WHY THIS SURVIVED THE MODAL. W5 routed every dropped document through Doc-U
 * (`upload-client.ts`): Storage object → `documents` row → `/api/ai/extract`.
 * That is the right path for an invoice or a statement, and W4's plan asked
 * whether OrderFlow could unify on it too. It cannot, and the reason is one
 * branch in the extract route: `syncOrderFromDocument` — the call that turns a
 * read customer order into an `of_orders` row and auto-invoices it — runs only
 * when the `documents` row was ALREADY typed `'order'` before extraction
 * (app/api/ai/extract/route.ts:69, :121). `uploadDocument` files rows untyped,
 * because on every other surface the classifier is what decides the type, so a
 * customer order dropped through the W5 path is read, filed, and then stops:
 * no order, no invoice. `/api/ai/agent/ingest-document` classifies FIRST and
 * then runs the same shared pipeline (lib/platform/document-ingest.ts, also the
 * inbound-email worker's), which is why it is kept and called from the drop
 * handler when — and only when — the owner is standing in OrderFlow.
 *
 * The document still lands in Doc-U either way. This is a different route to
 * the same room, not a side channel (see `upload-client.ts`'s docblock, which
 * says the same thing about the other door).
 *
 * Everything below is FinchModal's, moved: the same base64 conversion, the same
 * canvas downscale, the same two size caps and the same 8-file batch limit. The
 * one addition is `validateOrderFile`, which is FinchModal's inline validation
 * loop turned into a pure function so its wording — which the owner reads
 * verbatim — is testable.
 */

/** Read a File as a data URL string. */
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/** Read a File as base64 (no data: prefix) + its media type. */
async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const result = await readDataUrl(file);
  const comma = result.indexOf(',');
  return {
    base64: comma >= 0 ? result.slice(comma + 1) : result,
    mediaType: file.type || 'application/octet-stream',
  };
}

/**
 * Downscale an image to at most `maxDim` on the long edge and re-encode as JPEG,
 * so a 12MP phone photo (which would blow the request-size limit and 413) becomes
 * a couple of hundred KB while staying LEGIBLE FOR THE ORDER READER. Falls back
 * to the raw bytes if the browser can't decode it.
 *
 * 2600px matches `Vyso Mobile/lib/documents.js` and for the reason set out in
 * full there: Claude's vision pipeline resizes every image to the model's own
 * budget first — 1568px / 1568 visual tokens on a standard-tier model, 2576px /
 * 4784 on Claude 4.7 and later — so 2600px is the smallest cap that can feed the
 * high-res tier everything it will take, and anything larger is discarded by the
 * API anyway. (https://platform.claude.com/docs/en/build-with-claude/vision)
 *
 * THE QUALITY IS LOWER THAN MOBILE'S q0.9, AND THAT IS DELIBERATE. This path
 * posts the bytes base64-encoded inside a JSON body to `/api/ai/agent/
 * ingest-document`, and the platform edge refuses a request body over 4.5MB
 * before the handler can explain why — base64 inflating by a third the whole
 * way. Mobile uploads the bytes straight to Storage and has no such ceiling, so
 * it can afford the extra fidelity. q0.85 at 2600px lands near 1-1.5MB, which
 * base64s to about 2MB and leaves real headroom under the edge limit; q0.9 on a
 * busy page can approach it.
 */
async function imageToScaledBase64(
  file: File,
  maxDim = 2600,
  quality = 0.85,
): Promise<{ base64: string; mediaType: string }> {
  try {
    const dataUrl = await readDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode failed'));
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fileToBase64(file);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', quality);
    const comma = out.indexOf(',');
    return { base64: comma >= 0 ? out.slice(comma + 1) : out, mediaType: 'image/jpeg' };
  } catch {
    return fileToBase64(file);
  }
}

/** Turn a file into an upload payload — images are downscaled, PDFs pass through. */
async function fileToPayload(file: File): Promise<{ base64: string; mediaType: string }> {
  return file.type.startsWith('image/') ? imageToScaledBase64(file) : fileToBase64(file);
}

export const MAX_ORDER_BYTES = 13 * 1024 * 1024;
/**
 * PDFs are sent base64-in-JSON to the ingest route; Vercel rejects request bodies
 * over 4.5MB at the edge BEFORE the handler runs, and base64 inflates by ~33%, so a
 * PDF above ~3.3MiB would fail as an opaque 413. Cap it client-side with a clear
 * message. (Images are downscaled to a small JPEG before send, so the 13MB gate is
 * fine for them.)
 */
export const MAX_PDF_BYTES = 3 * 1024 * 1024;
/** How many order files we'll read from a single drop/selection. */
export const MAX_ORDER_FILES = 8;

/** Just enough of `File` to decide about it — the same widening
 *  `upload-client.ts` does, and for the same reason (testable without a DOM). */
export interface OrderFileCandidate {
  name: string;
  type: string;
  size: number;
}

/**
 * Why this file cannot be sent to the order reader, as a sentence to put in
 * front of the owner — or null when it can.
 *
 * NOTE the caps are the INGEST route's, not Doc-U's 15 MB: this path posts the
 * bytes as base64 inside a JSON body, and the platform edge refuses that body
 * long before the handler could explain why.
 */
export function validateOrderFile(file: OrderFileCandidate): string | null {
  const name = file.name?.trim() || 'That file';
  const isImage = file.type.startsWith('image/');
  if (file.type !== 'application/pdf' && !isImage) return `${name}: not a PDF or image.`;
  const cap = isImage ? MAX_ORDER_BYTES : MAX_PDF_BYTES;
  if (file.size > cap) return `${name}: too large (max ${isImage ? '~13MB' : '3MB for PDFs'}).`;
  return null;
}

/** What `/api/ai/agent/ingest-document` filed, flattened for the card that
 *  reports it. `orderId`/`invoiceNumber`/`needsReview` are the order half and
 *  are absent for anything that wasn't read as a customer order. */
export interface OrderIngestResult {
  documentId: string;
  documentType: string;
  customerName?: string | null;
  supplier?: string | null;
  itemCount?: number;
  invoiceNumber?: string | null;
  orderId?: string | null;
  needsReview?: boolean;
}

/**
 * File one document through Finch's ingest route: classify it, save it into
 * Doc-U, and — when it is a customer order — build the OrderFlow order,
 * auto-invoicing when the customer is confidently matched, else holding a draft
 * to review.
 *
 * Throws with the route's own message on failure; the caller turns that into
 * the line under the filename. Moved from `FinchModal.ingestPayload`, which set
 * card state directly — the wire half is all that came across.
 */
export async function ingestOrderDocument(file: File): Promise<OrderIngestResult> {
  const { base64, mediaType } = await fileToPayload(file);
  const res = await fetch('/api/ai/agent/ingest-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType, filename: file.name }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    documentId?: string;
    documentType?: string;
    customerName?: string | null;
    supplier?: string | null;
    itemCount?: number;
    orderSync?: { orderId?: string; invoice_number?: string | null; needsCustomerReview?: boolean } | null;
  };
  if (!res.ok || !data.documentId) {
    throw new Error(data.error ?? `Could not file the document (${res.status}).`);
  }
  const sync = data.orderSync ?? undefined;
  return {
    documentId: data.documentId,
    documentType: data.documentType ?? 'document',
    customerName: data.customerName ?? null,
    supplier: data.supplier ?? null,
    itemCount: data.itemCount,
    invoiceNumber: sync?.invoice_number ?? null,
    orderId: sync?.orderId ?? null,
    // Raw flag from the sync — the card derives invoiced / draft / failed from
    // orderId + invoiceNumber + this.
    needsReview: !!sync?.needsCustomerReview,
  };
}
