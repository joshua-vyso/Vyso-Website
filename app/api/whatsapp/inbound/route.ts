import { NextResponse, after } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import { processWhatsAppIngest, resolveConnection } from '@/lib/platform/whatsapp-ingest';
import {
  WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN,
  parseInboundMessages,
  verifyHandshake,
  verifyMetaSignature,
  whatsappConfigured,
} from '@/lib/platform/whatsapp-policy';

// after() runs the AI parse post-response, inside this budget.
export const maxDuration = 300;

/**
 * Meta's webhook handshake. Called once, when the callback URL is saved in the
 * Meta app dashboard, and again whenever the subscription is re-verified.
 *
 * Returns the challenge as PLAIN TEXT. Meta compares the body byte-for-byte, so a
 * JSON-wrapped or quoted challenge fails verification with no useful error.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const challenge = verifyHandshake(url.searchParams, WHATSAPP_VERIFY_TOKEN);
  if (challenge === null) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * WhatsApp Cloud API inbound webhook — a customer messaged the business number.
 *
 * The flow, in the order that matters for safety:
 *   1. Verify the X-Hub-Signature-256 over the RAW body. Nothing else runs on an
 *      unsigned request — this URL is public.
 *   2. Resolve the org from the `phone_number_id` the message ARRIVED AT, never from
 *      anything in the message, which the sender controls.
 *   3. Write the (org_id, wa_message_id) row BEFORE any work. This is the idempotency
 *      guard: Meta retries webhooks, and a retry must not re-order.
 *   4. Return 200 immediately and do the slow AI parse in after().
 *
 * Returns 200 for messages we intentionally drop (unknown number, status callbacks)
 * so Meta doesn't retry them, and 5xx only when we failed to RECORD a message — in
 * which case a retry is exactly what we want.
 */
export async function POST(req: Request) {
  if (!whatsappConfigured) {
    return NextResponse.json({ error: 'WhatsApp ingestion is not configured.' }, { status: 503 });
  }

  const raw = await req.text();

  // 1. Signature, over the raw bytes. Re-serialising the parsed JSON would change key
  //    order and whitespace and the HMAC would never match.
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Signed but unparseable. Retrying can't help, so don't ask Meta to.
    return NextResponse.json({ ok: true, ignored: 'unparseable' });
  }

  // Status callbacks (sent/delivered/read) come through this same webhook and yield
  // no messages. They are not customer input and there is nothing to record.
  const messages = parseInboundMessages(payload);
  if (messages.length === 0) {
    return NextResponse.json({ ok: true, messages: 0 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    // Configured but the service role is missing — we cannot record anything, so ask
    // for the redelivery rather than dropping a real order on the floor.
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const queued: string[] = [];
  let recordFailed = false;

  for (const message of messages) {
    const connection = await resolveConnection(supabase, message.phoneNumberId);
    if (connection === 'error') {
      // A DB fault, not "unknown number". Ask Meta to redeliver.
      recordFailed = true;
      continue;
    }
    // A number we don't know. Someone else's WABA, or a connection that was
    // deactivated — either way there is no org to file it against.
    if (!connection) continue;

    const { data: inserted, error } = await supabase
      .from('whatsapp_ingests')
      .insert({
        org_id: connection.orgId,
        connection_id: connection.connectionId,
        wa_message_id: message.waMessageId,
        from_wa_id: message.fromWaId,
        profile_name: message.profileName,
        kind: message.kind,
        body_text: message.text || null,
        // Normalised media pointers alongside the raw message, so the processor never
        // has to re-walk Meta's payload shape.
        raw_payload: {
          media_id: message.mediaId,
          media_mime_type: message.mediaMimeType,
          media_filename: message.mediaFilename,
          waba_id: message.wabaId,
          display_number: message.displayNumber,
          message: message.raw,
        },
        status: 'queued',
      })
      .select('id')
      .single();

    if (error) {
      // Already recorded — this is a Meta retry of a message we have. Not a failure.
      if (isUniqueViolation(error)) continue;
      recordFailed = true;
      continue;
    }
    queued.push((inserted as { id: string }).id);
  }

  // Something we could not RECORD. 5xx so Meta redelivers the batch; the rows we did
  // write are protected by the unique index, so the retry only picks up the gaps.
  if (recordFailed) {
    return NextResponse.json({ error: 'Could not record every message.' }, { status: 503 });
  }

  // 4. ACK now, parse after. Meta retries on a slow or non-2xx response, and the AI
  //    call is far slower than its timeout.
  after(async () => {
    // Serial on purpose: each message runs an AI extraction, and a batch of them in
    // parallel would blow both the function budget and the model rate limit.
    for (const id of queued) {
      try {
        await processWhatsAppIngest(supabase, id);
      } catch (err) {
        console.error('[whatsapp] processing threw:', err);
      }
    }
  });

  return NextResponse.json({ ok: true, queued: queued.length });
}
