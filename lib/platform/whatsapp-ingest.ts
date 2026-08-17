import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractOrderFromText } from '@/lib/ai/anthropic';
import { ingestDocument, ordersFolderId } from '@/lib/platform/document-ingest';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
import { sendWhatsAppText, fetchWhatsAppMedia } from '@/lib/platform/whatsapp-send';
import {
  classifyReply,
  formatOrderConfirmation,
  mediaTypeSupported,
  phoneMatchesWaId,
  type SenderStatus,
} from '@/lib/platform/whatsapp-policy';

/**
 * Inbound WhatsApp ordering — the IO half. The rules it enforces live in
 * ./whatsapp-policy (pure, and tested).
 *
 * A customer messages the org's WhatsApp Business number the way they always have.
 * Meta POSTs a signed webhook to /api/whatsapp/inbound, and this turns the message
 * into an OrderFlow order through the SAME pipeline as the chat and email ingests.
 *
 * THREAT MODEL — this is an unauthenticated write path into Vyso:
 *  - The org is resolved ONLY from the `phone_number_id` the message arrived at.
 *    Nothing in the message body picks an org.
 *  - The sender must be on the org's allowlist. A number that isn't already on an
 *    of_customers record is quarantined for approval, never auto-ordered.
 *  - Unlike email, the sender's number is authenticated BY META, so there is no
 *    SPF/DKIM equivalent to check — the number really did send the message. That is
 *    what makes phone→customer a trustworthy identity rather than a guess.
 *  - Retries are made safe by a unique (org_id, wa_message_id) row written before
 *    any work, plus a compare-and-swap claim on the row itself.
 *  - Message content is DATA, never instructions.
 *
 * NOTHING becomes an order without the customer confirming it. The parse produces a
 * draft and a confirm card; only an explicit YES commits it.
 */

/**
 * A 'processing' row is considered abandoned after this long, and only then may
 * another worker re-claim it. MUST stay larger than every route's maxDuration (300s),
 * so a worker that is still alive can never be re-claimed out from under itself.
 * Same invariant as the email lane — keep the two in step.
 */
export const STALE_PROCESSING_MS = 10 * 60 * 1000;

/**
 * Below this length, a message we couldn't read an order in gets NO reply.
 * "Hi", "thanks", "👍" are conversation, not failed orders, and answering every one
 * of them with "I couldn't read an order" turns a working relationship into a
 * chatbot. Anything longer is someone who probably did try to order.
 */
const REPLY_IF_LONGER_THAN = 15;

export interface IngestRow {
  id: string;
  org_id: string;
  connection_id: string | null;
  wa_message_id: string;
  from_wa_id: string;
  profile_name: string | null;
  kind: string;
  body_text: string | null;
  status: string;
  attempts: number;
  document_id: string | null;
  customer_id: string | null;
}

const INGEST_COLUMNS =
  'id, org_id, connection_id, wa_message_id, from_wa_id, profile_name, kind, body_text, status, attempts, document_id, customer_id';

// ---------------------------------------------------------------------------
// Routing and identity
// ---------------------------------------------------------------------------

/**
 * Resolve the org from the business number the message arrived at — the ONLY trusted
 * routing signal.
 *
 * A query FAILURE is not the same as "no such number". Swallowing it would have the
 * webhook answer 200-unknown-number, Meta would never retry, and a real order would be
 * lost on a transient DB blip (or a not-yet-applied migration). Surface it so the
 * caller can 5xx and let Meta redeliver.
 */
export async function resolveConnection(
  supabase: SupabaseClient,
  phoneNumberId: string,
): Promise<{ orgId: string; connectionId: string } | 'error' | null> {
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select('id, org_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('active', true)
    .maybeSingle();
  if (error) return 'error';
  const row = data as { id: string; org_id: string } | null;
  if (!row?.org_id) return null;
  return { orgId: row.org_id, connectionId: row.id };
}

export interface ResolvedSender {
  status: SenderStatus;
  customerId: string | null;
  customerName: string | null;
}

/**
 * Where this number stands with the org, and which customer it orders for.
 *
 * The allowlist is seeded from the org's own records rather than from an approval
 * queue nobody would ever drain: a number already saved on an of_customers row is the
 * org stating, in its own data, that this number is that customer. Auto-approving that
 * case is what makes the feature usable on day one for an org that already has its
 * customers' numbers — which is exactly the org replacing a WhatsApp group.
 *
 * Every OTHER number is quarantined. A stranger messaging the business number gets a
 * pending row and a human decision, never an order.
 */
export async function resolveSender(
  supabase: SupabaseClient,
  orgId: string,
  waId: string,
  profileName: string | null,
): Promise<ResolvedSender> {
  const { data: senderRow } = await supabase
    .from('whatsapp_senders')
    .select('status, customer_id')
    .eq('org_id', orgId)
    .eq('wa_id', waId)
    .maybeSingle();
  const sender = senderRow as { status: string; customer_id: string | null } | null;

  if (sender?.status === 'blocked') {
    return { status: 'blocked', customerId: null, customerName: null };
  }
  if (sender?.status === 'pending') {
    return { status: 'pending', customerId: null, customerName: null };
  }

  // Match the number against the org's customer records.
  const { data: custRows } = await supabase
    .from('of_customers')
    .select('id, name, phone')
    .eq('org_id', orgId)
    .not('phone', 'is', null);
  const customers = (custRows ?? []) as { id: string; name: string; phone: string | null }[];
  const matched = customers.find((c) => phoneMatchesWaId(c.phone, waId)) ?? null;

  if (sender?.status === 'approved') {
    // An approved sender keeps its explicit mapping; fall back to the phone match so
    // approving a number before linking a customer still works.
    if (sender.customer_id) {
      const named = customers.find((c) => c.id === sender.customer_id) ?? null;
      return { status: 'approved', customerId: sender.customer_id, customerName: named?.name ?? null };
    }
    return { status: 'approved', customerId: matched?.id ?? null, customerName: matched?.name ?? null };
  }

  // No row yet — decide, and record the decision so the settings screen shows it.
  if (matched) {
    await supabase.from('whatsapp_senders').insert({
      org_id: orgId,
      wa_id: waId,
      customer_id: matched.id,
      profile_name: profileName,
      status: 'approved',
    });
    return { status: 'approved', customerId: matched.id, customerName: matched.name };
  }

  await supabase.from('whatsapp_senders').insert({
    org_id: orgId,
    wa_id: waId,
    profile_name: profileName,
    status: 'pending',
  });
  return { status: 'pending', customerId: null, customerName: null };
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

type FinishFn = (
  status: 'done' | 'ignored' | 'failed' | 'quarantined' | 'awaiting_confirmation' | 'cancelled',
  patch?: Record<string, unknown>,
) => Promise<void>;

/**
 * Process one received message. Safe to run twice: it claims the row with a
 * compare-and-swap, so the webhook's after() and the cron can never both work it.
 */
export async function processWhatsAppIngest(supabase: SupabaseClient, ingestId: string): Promise<void> {
  const { data: row } = await supabase.from('whatsapp_ingests').select(INGEST_COLUMNS).eq('id', ingestId).maybeSingle();
  const ingest = row as IngestRow | null;
  if (!ingest) return;
  if (ingest.status !== 'queued' && ingest.status !== 'processing') return;

  // CLAIM it atomically. The claim's WHERE clause — not the value we happened to read
  // — is the concurrency guard: the UPDATE only lands on a row still 'queued', or one
  // 'processing' whose claim has gone STALE. Postgres re-checks that predicate under
  // the row lock, so of two racing workers exactly one matches. Because maxDuration
  // (300s) < STALE_PROCESSING_MS (600s), a live worker's claim is never stale, and a
  // stale claim's worker is dead, so there is no one left to clobber.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('whatsapp_ingests')
    .update({ status: 'processing', attempts: (ingest.attempts ?? 0) + 1, claimed_at: new Date().toISOString() })
    .eq('id', ingest.id)
    .or(`status.eq.queued,and(status.eq.processing,claimed_at.lt.${staleBefore})`)
    .select('id')
    .maybeSingle();

  // A broken UPDATE (e.g. a missing column before the migration is applied) is NOT the
  // same as losing the race: surface it instead of silently stranding every message.
  if (claimErr) {
    await supabase
      .from('whatsapp_ingests')
      .update({ status: 'failed', error: `Could not claim the message: ${claimErr.message}`.slice(0, 500) })
      .eq('id', ingest.id);
    return;
  }
  if (!claimed) return; // someone else holds a live claim

  const finish: FinishFn = async (status, patch = {}) => {
    await supabase
      .from('whatsapp_ingests')
      .update({ status, processed_at: new Date().toISOString(), ...patch })
      .eq('id', ingest.id);
  };

  // Resolved lazily and cached: most messages send at most one reply, and a row whose
  // connection was deleted must degrade to "no reply" rather than querying `id = ''`,
  // which Postgres rejects outright on a uuid column.
  let phoneNumberId: string | null | undefined;
  const reply = async (body: string) => {
    if (phoneNumberId === undefined) {
      if (!ingest.connection_id) {
        phoneNumberId = null;
      } else {
        const { data: conn } = await supabase
          .from('whatsapp_connections')
          .select('phone_number_id')
          .eq('id', ingest.connection_id)
          .maybeSingle();
        phoneNumberId = (conn as { phone_number_id: string } | null)?.phone_number_id ?? null;
      }
    }
    if (!phoneNumberId) return;
    await sendWhatsAppText({ phoneNumberId, toWaId: ingest.from_wa_id, body });
  };

  try {
    const sender = await resolveSender(supabase, ingest.org_id, ingest.from_wa_id, ingest.profile_name);

    if (sender.status === 'blocked') {
      // Silent by design. Telling a blocked number what happened just tells them which
      // wording to try next, and they were blocked by a human for a reason.
      await finish('quarantined', { error: 'Sender is blocked.' });
      return;
    }
    if (sender.status !== 'approved') {
      await finish('quarantined', { error: 'Sender is not linked to a customer yet.' });
      await reply(
        "Thanks for your message! We don't have this number linked to an account yet, so I can't take the order automatically — one of the team will pick it up from here.",
      );
      return;
    }

    if (ingest.kind === 'audio') {
      await finish('ignored', { error: 'Voice notes are not supported yet.' });
      await reply(
        "Thanks! I can't listen to voice notes yet — please send the order as a text message or a photo and I'll take it from there.",
      );
      return;
    }

    if (ingest.kind === 'image' || ingest.kind === 'document') {
      await handleMedia(supabase, ingest, sender, finish, reply);
      return;
    }

    if (ingest.kind !== 'text') {
      // Stickers, reactions, locations, contact cards. Nothing to order and nothing
      // worth answering.
      await finish('ignored', { error: `Unsupported message type: ${ingest.kind}` });
      return;
    }

    await handleText(supabase, ingest, sender, finish, reply);
  } catch (err) {
    await finish('failed', { error: (err instanceof Error ? err.message : 'Processing failed.').slice(0, 500) });
  }
}

// ---------------------------------------------------------------------------
// Text — the order + confirm loop
// ---------------------------------------------------------------------------

async function handleText(
  supabase: SupabaseClient,
  ingest: IngestRow,
  sender: ResolvedSender,
  finish: FinishFn,
  reply: (body: string) => Promise<void>,
): Promise<void> {
  const body = (ingest.body_text ?? '').trim();
  const intent = classifyReply(body);

  if (intent) {
    // Answering the confirm card. There is at most one open draft per sender — the
    // database enforces it — so this is unambiguous by construction.
    const { data: draftRow } = await supabase
      .from('whatsapp_ingests')
      .select(INGEST_COLUMNS)
      .eq('org_id', ingest.org_id)
      .eq('from_wa_id', ingest.from_wa_id)
      .eq('status', 'awaiting_confirmation')
      .maybeSingle();
    const draft = draftRow as IngestRow | null;

    if (!draft) {
      await finish('ignored', { error: 'No order was awaiting confirmation.' });
      await reply("I don't have an order waiting for you to confirm — send me the items and I'll set one up.");
      return;
    }

    if (intent === 'cancel') {
      await supabase
        .from('whatsapp_ingests')
        .update({ status: 'cancelled', processed_at: new Date().toISOString() })
        .eq('id', draft.id);
      await finish('done');
      await reply("No problem — I've cancelled that one. Send the order again whenever you're ready.");
      return;
    }

    await commitDraft(supabase, draft, finish, reply);
    return;
  }

  // Not a confirmation — read it as a new order.
  const { data: catalogueRows } = await supabase
    .from('pp_stock_items')
    .select('name')
    .eq('org_id', ingest.org_id)
    .order('name', { ascending: true });
  const products = ((catalogueRows ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean);

  const order = await extractOrderFromText({ body, products });

  if (order.line_items.length === 0) {
    await finish('ignored', { error: 'No order items found in the message.' });
    if (body.length > REPLY_IF_LONGER_THAN) {
      await reply(
        "Sorry, I couldn't read an order in that. Please send the items and quantities (e.g. \"5 boxes tomatoes, 2 bags onions\"), or a photo of the order.",
      );
    }
    return;
  }

  // SUPERSEDE any open draft before opening a new one. A customer who corrects their
  // order sends a fresh message rather than editing the old one, and if both stayed
  // open, "YES" could not say which it meant. The partial unique index makes this a
  // guarantee — if the update below is skipped, the status change further down fails
  // rather than quietly leaving two open drafts.
  await supabase
    .from('whatsapp_ingests')
    .update({ status: 'superseded', processed_at: new Date().toISOString() })
    .eq('org_id', ingest.org_id)
    .eq('from_wa_id', ingest.from_wa_id)
    .eq('status', 'awaiting_confirmation');

  // File the raw message as a Doc-U document. This is the audit copy the founders can
  // open next to the order, and it is what syncOrderFromDocument reads on confirm —
  // the same contract as an uploaded photo or a forwarded email, so the order lands in
  // OrderFlow through exactly one code path regardless of how it arrived.
  const documentId = await fileTextOrder(supabase, ingest, sender, body, order);
  if (!documentId) {
    await finish('failed', { error: 'Could not file the order document.' });
    await reply("Something went wrong on our side saving that order — the team has been alerted, please bear with us.");
    return;
  }

  const { error: openErr } = await supabase
    .from('whatsapp_ingests')
    .update({
      status: 'awaiting_confirmation',
      document_id: documentId,
      customer_id: sender.customerId,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', ingest.id);

  if (openErr) {
    // Almost certainly the open-draft unique index: another message from this sender
    // opened a draft in the gap. Leave it retryable rather than guessing which wins.
    await finish('failed', { error: `Could not open the draft: ${openErr.message}`.slice(0, 500) });
    return;
  }

  await reply(
    formatOrderConfirmation({
      customerName: sender.customerName,
      lines: order.line_items.map((l) => ({
        description: l.description,
        quantity: l.quantity ?? '',
        unit: l.unit ?? '',
      })),
    }),
  );
}

/**
 * Store the message text as a document + its extraction, ready for
 * syncOrderFromDocument. Returns the document id, or null if it couldn't be filed.
 *
 * The customer name written into extracted_data is the one the PHONE resolved to, not
 * anything read out of the message — the text reader is explicitly told not to guess a
 * name, because the number is the better identity.
 */
async function fileTextOrder(
  supabase: SupabaseClient,
  ingest: IngestRow,
  sender: ResolvedSender,
  body: string,
  order: Awaited<ReturnType<typeof extractOrderFromText>>,
): Promise<string | null> {
  const who = (sender.customerName || ingest.profile_name || ingest.from_wa_id).replace(/[^\w.\-() ]+/g, '_');
  const day = new Date().toISOString().slice(0, 10);
  const filename = `WhatsApp order - ${who} - ${day}.txt`;
  const storagePath = `${ingest.org_id}/${randomUUID()}_whatsapp-order.txt`;

  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, Buffer.from(body, 'utf8'), { contentType: 'text/plain; charset=utf-8', upsert: false });
  if (upErr) {
    console.error('[whatsapp] could not store the message text:', upErr.message);
    return null;
  }

  const folderId = await ordersFolderId(supabase, ingest.org_id, null);
  const { data: inserted, error: insErr } = await supabase
    .from('documents')
    .insert({
      org_id: ingest.org_id,
      filename,
      status: 'extracted',
      storage_path: storagePath,
      uploaded_by: null, // arrived by WhatsApp — no uploading user
      document_type: 'order',
      confidence: order.overall_confidence,
      extracted_data: {
        fields: [],
        line_items: order.line_items,
        customer_name: sender.customerName,
        // The phone match is the identity, so this is certain in a way a name read off
        // a screenshot never is.
        customer_confidence: sender.customerId ? 100 : 0,
      },
      whatsapp_ingest_id: ingest.id,
      ...(folderId ? { folder_id: folderId } : {}),
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    console.error('[whatsapp] could not file the order document:', insErr?.message);
    return null;
  }
  return (inserted as { id: string }).id;
}

/**
 * The customer said YES — build the OrderFlow order.
 *
 * `finalize` is deliberately NOT passed. The customer confirmed WHAT they ordered, not
 * what it costs, so the existing gate still decides invoice-vs-draft: a known customer
 * with every line priced auto-invoices, anything else holds as a draft for the founders
 * to price. Forcing finalize here would issue invoices off unpriced lines.
 */
async function commitDraft(
  supabase: SupabaseClient,
  draft: IngestRow,
  finish: FinishFn,
  reply: (body: string) => Promise<void>,
): Promise<void> {
  if (!draft.document_id) {
    await supabase.from('whatsapp_ingests').update({ status: 'failed', error: 'Draft had no document.' }).eq('id', draft.id);
    await finish('failed', { error: 'Draft had no document.' });
    await reply('Sorry — I lost track of that order. Please send it again.');
    return;
  }

  const result = await syncOrderFromDocument(supabase, {
    documentId: draft.document_id,
    orgId: draft.org_id,
    customerId: draft.customer_id,
  });

  if (!result.ok) {
    // Leave the draft OPEN and retryable. Closing it would strand a confirmed order
    // with no way for the customer to re-confirm, and the customer has already done
    // the one thing we needed from them.
    await finish('failed', { error: `Could not build the order: ${result.reason ?? 'unknown'}`.slice(0, 500) });
    await reply("I couldn't get that order onto our system just now — the team has been alerted and will sort it out.");
    return;
  }

  const now = new Date().toISOString();
  await supabase
    .from('whatsapp_ingests')
    .update({ status: 'done', order_id: result.orderId ?? null, confirmed_at: now, processed_at: now, error: null })
    .eq('id', draft.id);

  // The customer's YES IS the review for this document — mark it approved so it leaves
  // the Doc-U queue. syncOrderFromDocument is idempotent per source_document_id, so a
  // founder opening and re-saving it later upserts the same order rather than a second.
  await supabase.from('documents').update({ status: 'approved', approved_at: now }).eq('id', draft.document_id);

  await finish('done');

  await reply(
    result.invoice_number
      ? `Order placed — invoice ${result.invoice_number}. Thank you!`
      : "Order received, thank you! We'll confirm pricing and come back to you shortly.",
  );
}

// ---------------------------------------------------------------------------
// Media — photos and PDFs of orders
// ---------------------------------------------------------------------------

/**
 * A photo or PDF of an order goes to the Doc-U review queue, NOT through the confirm
 * loop.
 *
 * Reading a photo is where extraction is least reliable — handwriting, glare, a
 * cropped page — and a confirm card can only ask "is this right?" about the lines the
 * model managed to see, not about the ones it missed entirely. So media keeps a human
 * in the loop, exactly as the email lane does. Text, where the customer's own words are
 * right there to read back, is the case the confirm loop can actually stand behind.
 */
async function handleMedia(
  supabase: SupabaseClient,
  ingest: IngestRow,
  sender: ResolvedSender,
  finish: FinishFn,
  reply: (body: string) => Promise<void>,
): Promise<void> {
  const { data: mediaRow } = await supabase
    .from('whatsapp_ingests')
    .select('raw_payload')
    .eq('id', ingest.id)
    .maybeSingle();
  const raw = (mediaRow as { raw_payload: Record<string, unknown> | null } | null)?.raw_payload ?? null;
  const mediaId = typeof raw?.media_id === 'string' ? raw.media_id : '';
  const declaredType = typeof raw?.media_mime_type === 'string' ? raw.media_mime_type : null;
  const declaredName = typeof raw?.media_filename === 'string' ? raw.media_filename : null;

  if (!mediaId) {
    await finish('failed', { error: 'The message had no media id.' });
    return;
  }
  if (!mediaTypeSupported(declaredType)) {
    await finish('ignored', { error: `Unsupported media type: ${declaredType ?? 'unknown'}` });
    await reply("I can read photos and PDFs — that file type I can't. Please send a photo of the order or type it out.");
    return;
  }

  const media = await fetchWhatsAppMedia(mediaId);
  if ('error' in media) {
    await finish('failed', { error: media.error.slice(0, 500) });
    return;
  }

  const result = await ingestDocument({
    supabase,
    orgId: ingest.org_id,
    userId: null, // arrived by WhatsApp — no uploading user
    base64: media.base64,
    mediaType: media.mimeType,
    filename: (declaredName || `whatsapp-${ingest.wa_message_id.slice(-12)}.${media.mimeType.includes('pdf') ? 'pdf' : 'jpg'}`).slice(0, 200),
    // The caption is the customer talking about the file — guidance, not instructions.
    note: (ingest.body_text ?? '').slice(0, 500) || undefined,
    whatsappIngestId: ingest.id,
    // Arrived with no human present, and a photo is the least reliable thing we read:
    // it lands in the review queue and nothing touches OrderFlow until a founder saves.
    deferCommit: true,
  });

  if (!result.ok) {
    await finish('failed', { error: result.error.slice(0, 500), ...(result.documentId ? { document_id: result.documentId } : {}) });
    await reply("Thanks — I couldn't read that one automatically, so the team will look at it directly.");
    return;
  }

  await finish('done', { document_id: result.documentId, customer_id: sender.customerId });
  await reply("Got it, thanks! We're checking that order now and will confirm shortly.");
}
