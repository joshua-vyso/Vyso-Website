import 'server-only';
import {
  MAX_MEDIA_BYTES,
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_GRAPH_VERSION,
} from '@/lib/platform/whatsapp-policy';

/**
 * The Meta Cloud API calls this lane makes: send a reply, and fetch media a customer
 * sent us. Both need the system-user access token, which is server-only.
 *
 * SESSION WINDOW: free-form (non-template) messages are only allowed within 24 hours
 * of the customer's last message to the business. Every reply this module sends is an
 * answer to a message we just received, so it is always inside that window and never
 * needs a pre-approved template. If a future feature needs to message a customer
 * FIRST — an unprompted "your order is out for delivery" — that one does need an
 * approved template and a different call shape.
 */

const GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`;

/**
 * Send a plain-text WhatsApp reply. Best-effort by design.
 *
 * Returns false rather than throwing: a failed reply must NEVER fail the order.
 * The order is the thing of value and it is already recorded; the reply is a
 * courtesy. A throw here would mark a perfectly good ingest as failed and, on the
 * cron's retry, re-run the whole parse.
 */
export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  toWaId: string;
  body: string;
}): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN) return false;
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(params.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.toWaId,
        type: 'text',
        // preview_url off: a link in an order message must not render a preview card
        // fetched from an untrusted URL.
        text: { preview_url: false, body: params.body.slice(0, 4096) },
      }),
    });
    if (!res.ok) {
      console.error('[whatsapp] send failed:', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[whatsapp] send threw:', err);
    return false;
  }
}

export interface FetchedMedia {
  base64: string;
  mimeType: string;
  byteLength: number;
}

/**
 * Download media a customer sent, by media id.
 *
 * Two hops, both authenticated: the id resolves to a short-lived URL on Meta's CDN,
 * and that URL still requires the bearer token. The size is checked from the
 * metadata BEFORE the bytes are fetched — that's the only check that costs nothing
 * — and again after, because the metadata is Meta's claim rather than a guarantee.
 */
export async function fetchWhatsAppMedia(mediaId: string): Promise<FetchedMedia | { error: string }> {
  if (!WHATSAPP_ACCESS_TOKEN) return { error: 'WhatsApp is not configured.' };

  const metaRes = await fetch(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!metaRes.ok) {
    return { error: `Could not look up the media (${metaRes.status}).` };
  }
  const meta = (await metaRes.json().catch(() => null)) as
    | { url?: unknown; mime_type?: unknown; file_size?: unknown }
    | null;
  const url = typeof meta?.url === 'string' ? meta.url : '';
  if (!url) return { error: 'The media had no download URL.' };

  const declaredSize = typeof meta?.file_size === 'number' ? meta.file_size : 0;
  if (declaredSize > MAX_MEDIA_BYTES) {
    return { error: 'That file is too large to read (max ~13MB).' };
  }

  const fileRes = await fetch(url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!fileRes.ok) {
    return { error: `Could not download the media (${fileRes.status}).` };
  }
  const buf = Buffer.from(await fileRes.arrayBuffer());
  if (buf.byteLength > MAX_MEDIA_BYTES) {
    return { error: 'That file is too large to read (max ~13MB).' };
  }

  return {
    base64: buf.toString('base64'),
    // Prefer what the transfer actually says it is; fall back to Meta's metadata.
    mimeType:
      (fileRes.headers.get('content-type') ?? '').split(';')[0].trim() ||
      (typeof meta?.mime_type === 'string' ? meta.mime_type : 'application/octet-stream'),
    byteLength: buf.byteLength,
  };
}
